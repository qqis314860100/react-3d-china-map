import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer";
import * as d3 from "d3";
import gsap from "gsap";
import ToolTip from "../tooltip";
import Loading from "./components/Loading";
import { GeoJsonType } from "./typed";
import { initScene } from "./scene";
import { initCamera } from "./camera";
import { initLights } from "./light";
import { hideTooltip } from "./utils";
import { disposeObject3D } from "./dispose";
import {
  findPickedObject,
  restorePickedObjectColor,
  applyHoverEffect,
} from "./mouseHandler";
import {
  generateMapObject3D,
  generateMapLabel2D,
  generateMapSpot,
  drawLineBetween2Spot,
} from "./drawFunc";
import {
  ProjectionFnParamType,
  CityConfig,
  ProvinceConfig,
  TooltipData,
} from "./types";

export type { ProjectionFnParamType, CityConfig, ProvinceConfig };

interface Props {
  geoJson: GeoJsonType;
  projectionFnParam: ProjectionFnParamType;
  displayConfig: ProvinceConfig[];
  mapType?: "china" | "world";
}

function Map3D(props: Props) {
  const {
    geoJson,
    projectionFnParam,
    displayConfig,
    mapType = "china",
  } = props;

  const mapRef = useRef<HTMLDivElement>(null);
  const map2dRef = useRef<HTMLDivElement>(null);
  const toolTipRef = useRef<any>();
  const isHoveringTooltipRef = useRef<boolean>(false);
  const currentCityDataRef = useRef<any>(null);
  const lastPickRef = useRef<any>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const perfPanelRef = useRef<HTMLDivElement>(null);
  // Tooltip 隐藏“宽限期”：用于从地图目标移动到 Tooltip（避免一离开就闪没）
  const tooltipGraceUntilRef = useRef<number>(0);

  const [toolTipData, setToolTipData] = useState<TooltipData>({
    text: "",
    districts: [],
    showPanel: false,
    isCity: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const normalizeCityName = (name?: string) => (name || "").replace(/市$/, "");

  useEffect(() => {
    const currentDom = mapRef.current;
    const labelDom = map2dRef.current;
    if (!currentDom || !labelDom) return;

    setIsLoading(true);

    let renderer: THREE.WebGLRenderer | null = null;
    let labelRenderer: CSS2DRenderer | null = null;
    let controls: OrbitControls | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let onResizeEvent: (() => void) | null = null;
    let onMouseMoveEvent: ((e: MouseEvent) => void) | null = null; // 实际挂 pointermove
    let onPointerLeaveEvent: (() => void) | null = null;
    let leaveHideTimer: number | null = null;
    let disposed = false;

    // 延迟初始化，确保 Loading 能显示
    const timer = setTimeout(() => {
      if (disposed) return;
      const enablePerfOverlay =
        new URLSearchParams(window.location.search).get("perf") === "1";
      const sceneLocal = initScene();
      const { camera: cameraLocal } = initCamera(currentDom, mapType);
      // 同步到外层引用，便于 cleanup
      scene = sceneLocal;
      camera = cameraLocal;

      const rendererLocal = new THREE.WebGLRenderer({
        // DPR 较高时 AA 会明显加重负担，这里做一个轻量兜底
        antialias: window.devicePixelRatio <= 1.5,
        powerPreference: "high-performance",
      });
      rendererLocal.setSize(currentDom.clientWidth, currentDom.clientHeight);
      let maxPixelRatio = Math.min(window.devicePixelRatio, 2);
      let currentPixelRatio = maxPixelRatio;
      rendererLocal.setPixelRatio(currentPixelRatio);
      renderer = rendererLocal;

      while (currentDom.firstChild) {
        currentDom.removeChild(currentDom.firstChild);
      }
      currentDom.appendChild(rendererLocal.domElement);

      const labelRendererLocal = new CSS2DRenderer();
      labelRendererLocal.setSize(currentDom.clientWidth, currentDom.clientHeight);
      labelRendererLocal.domElement.style.position = "absolute";
      labelRendererLocal.domElement.style.top = "0px";
      labelRenderer = labelRendererLocal;

      while (labelDom.firstChild) {
        labelDom.removeChild(labelDom.firstChild);
      }
      labelDom.appendChild(labelRendererLocal.domElement);

      const { mapObject3D, label2dData } = generateMapObject3D(
        geoJson,
        projectionFnParam,
        displayConfig,
        mapType
      );
      sceneLocal.add(mapObject3D);

      const labelObject2D = generateMapLabel2D(
        label2dData,
        displayConfig,
        projectionFnParam,
        mapType
      );
      if (labelObject2D && labelObject2D.children.length > 0) {
        mapObject3D.add(labelObject2D);
      }

      // 标签 DOM -> userData 映射：支持“悬浮城市文字标签”也能显示基地列表
      const labelElementUserData = new WeakMap<HTMLElement, any>();
      if (labelObject2D && labelObject2D.children.length > 0) {
        labelObject2D.traverse((obj: any) => {
          const el = obj?.element;
          if (el && el instanceof HTMLElement) {
            labelElementUserData.set(el, obj.userData);
          }
        });
      }

      const getCityUserDataFromEventTarget = (target: EventTarget | null) => {
        const t = target as HTMLElement | null;
        let node: HTMLElement | null = t;
        while (node && node !== labelRendererLocal.domElement) {
          const data = labelElementUserData.get(node);
          if (data && data.isCity) return data;
          node = node.parentElement;
        }
        return null;
      };

      const { spotList, spotObject3D, citySpotList } = generateMapSpot(
        label2dData,
        displayConfig,
        projectionFnParam,
        mapType
      );
      mapObject3D.add(spotObject3D);
      const citySpotListRef = citySpotList || [];

      // 缓存可交互对象（必须在标签/圆点都加入 mapObject3D 之后再做）
      const interactiveObjects: THREE.Object3D[] = [];
      mapObject3D.traverse((obj: any) => {
        if (obj?.userData?.isCity || obj?.userData?.isChangeColor) {
          interactiveObjects.push(obj);
        }
      });

      const modelMixer: any = [];

      // 飞线和飞点flyspot的容器
      const flyObject3D = new THREE.Object3D();
      // 存储所有飞点对象
      const flySpotList: any = [];
      // 中国地图“宁德光斑”目标点（mapObject3D 的本地坐标系）
      let chinaLightTargetLocal: THREE.Vector3 | null = null;

      if (displayConfig && displayConfig.length > 0 && mapType === "china") {
        const { center, scale } = projectionFnParam;
        const projectionFn = d3
          .geoMercator()
          .center(center)
          .scale(scale)
          .translate([0, 0]);

        let ningdeCoord: [number, number] | null = null;
        // ...坐标计算...
        displayConfig.forEach((provinceConfig: any) => {
          if (provinceConfig.name === "福建省" && provinceConfig.cities) {
            const ningdeCity = provinceConfig.cities.find(
              (city: any) => normalizeCityName(city.name) === "宁德"
            );
            if (ningdeCity?.coordinates) {
              const coord = projectionFn(ningdeCity.coordinates);
              if (coord) ningdeCoord = coord;
            }
          }
        });

        if (ningdeCoord) {
          // 地图绘制时 y 会取反，这里提前转换成与地图一致的本地坐标
          chinaLightTargetLocal = new THREE.Vector3(
            ningdeCoord[0],
            -ningdeCoord[1],
            0
          );
          displayConfig.forEach((provinceConfig: any) => {
            provinceConfig.cities?.forEach((cityConfig: any) => {
              if (normalizeCityName(cityConfig.name) === "宁德") return;
              if (cityConfig.coordinates) {
                const cityCoord = projectionFn(cityConfig.coordinates);
                if (cityCoord) {
                  // ...生成飞线和光点...
                  const { flyLine, flySpot } = drawLineBetween2Spot(
                    cityCoord,
                    ningdeCoord!
                  );
                  flyObject3D.add(flyLine);
                  flyObject3D.add(flySpot);
                  // 光点存入数组
                  flySpotList.push(flySpot);
                }
              }
            });
          });
        }
      }

      // 容器加入场景
      mapObject3D.add(flyObject3D);

      const controlsLocal = new OrbitControls(cameraLocal, labelRendererLocal.domElement);
      controlsLocal.enableRotate = true;
      controlsLocal.enableZoom = true;
      controlsLocal.enablePan = true;
      controlsLocal.enableDamping = true;
      controlsLocal.dampingFactor = 0.15;
      controlsLocal.enableZoom = true;
      controls = controlsLocal;

      const { chinaPointLight, worldPointLight } = initLights(sceneLocal);

   
      onResizeEvent = () => {
        cameraLocal.aspect = currentDom.clientWidth / currentDom.clientHeight;
        cameraLocal.updateProjectionMatrix();
        rendererLocal.setSize(currentDom.clientWidth, currentDom.clientHeight);
        labelRendererLocal.setSize(currentDom.clientWidth, currentDom.clientHeight);
        maxPixelRatio = Math.min(window.devicePixelRatio, 2);
        if (currentPixelRatio > maxPixelRatio) currentPixelRatio = maxPixelRatio;
        rendererLocal.setPixelRatio(currentPixelRatio);
      };

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let lastPickAt = 0;
      let pendingPickRaf = 0;
      let lastPointerEvent: PointerEvent | null = null;

      const runPick = (e: PointerEvent) => {
        const prevPicked = lastPickRef.current;
        const prevObject = prevPicked?.object;

        // 优先用“标签命中”的城市数据：避免标签下方的省份网格被 Raycaster 命中，从而覆盖城市 tooltip
        const labelCityData = getCityUserDataFromEventTarget(e.target);
        let nextPicked: any = null;
        if (labelCityData) {
          nextPicked = { object: { userData: labelCityData } };
        } else {
          raycaster.setFromCamera(pointer, cameraLocal);
          // 递归命中子节点：城市点/标签可能是父对象挂 userData，而命中发生在子对象
          const intersects = raycaster.intersectObjects(interactiveObjects, true);
          nextPicked = findPickedObject(intersects);
        }
        const nextObject = nextPicked?.object;

        // 只有目标发生变化时，才恢复旧目标颜色（避免同一目标下频繁闪烁）
        if (
          prevPicked &&
          prevObject &&
          (!nextObject || nextObject !== prevObject)
        ) {
          restorePickedObjectColor(prevPicked);
        }

        lastPickRef.current = nextPicked;

        if (nextPicked) {
          // hover 提示：可交互目标显示 pointer
          if (currentDom) {
            const isCity = !!nextPicked.object?.userData?.isCity;
            const hasUrl = !!nextPicked.object?.userData?.url;
            const hasDistricts =
              Array.isArray(nextPicked.object?.userData?.districts) &&
              nextPicked.object.userData.districts.length > 0;
            currentDom.style.cursor =
              isCity && (hasUrl || hasDistricts) ? "pointer" : "default";
          }

          // 命中目标后，设置宽限时间，方便用户移动到 tooltip
          tooltipGraceUntilRef.current = Date.now() + 500;

          const isSameTarget = prevObject && nextObject === prevObject;
          const isTooltipVisibleNow =
            !!toolTipRef.current?.style &&
            toolTipRef.current.style.visibility === "visible";

          // 同一目标悬浮时不重复更新 tooltip 位置（避免 tooltip 跟着鼠标“逃跑”）
          if (!isSameTarget || !isTooltipVisibleNow) {
            applyHoverEffect(
              nextPicked,
              e as any,
              toolTipRef,
              setToolTipData,
              currentCityDataRef
            );
          }
        } else {
          if (currentDom) currentDom.style.cursor = "default";
          if (!isHoveringTooltipRef.current) {
            if (Date.now() >= tooltipGraceUntilRef.current) {
              hideTooltip(toolTipRef.current);
            }
          }
        }
      };

      const schedulePick = () => {
        if (pendingPickRaf) return;
        pendingPickRaf = requestAnimationFrame(() => {
          pendingPickRaf = 0;
          if (disposed) return;
          if (!lastPointerEvent) return;
          const now = performance.now();
          // 约 30Hz 拾取：减少 intersectObjects 的频率，但仍保持足够的响应
          if (now - lastPickAt < 33) return;
          lastPickAt = now;
          runPick(lastPointerEvent);
        });
      };

      const onPointerMove = (e: PointerEvent) => {
        if (isHoveringTooltipRef.current) return;
        if (leaveHideTimer) {
          window.clearTimeout(leaveHideTimer);
          leaveHideTimer = null;
        }
        // Tooltip 已显示时，给用户一点时间把鼠标移入 Tooltip，避免瞬间消失
        const tooltipVisible =
          !!toolTipRef.current?.style &&
          toolTipRef.current.style.visibility === "visible";
        if (tooltipVisible && Date.now() < tooltipGraceUntilRef.current) return;
        const rect = labelRendererLocal.domElement.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        pointer.x = x * 2 - 1;
        pointer.y = -(y * 2 - 1);

        lastPointerEvent = e;
        schedulePick();
      };

      const onPointerLeave = () => {
        if (currentDom) currentDom.style.cursor = "default";
        // 不要立刻隐藏/清空：给用户时间把鼠标移入 tooltip 点击“基地列表”
        const delay = Math.max(0, tooltipGraceUntilRef.current - Date.now());
        leaveHideTimer = window.setTimeout(() => {
          if (disposed) return;
          if (isHoveringTooltipRef.current) return;
          if (Date.now() < tooltipGraceUntilRef.current) return;

          hideTooltip(toolTipRef.current);
          if (lastPickRef.current) {
            restorePickedObjectColor(lastPickRef.current);
            lastPickRef.current = null;
          }
        }, delay + 60);
      };

      onMouseMoveEvent = onPointerMove as any;
      onPointerLeaveEvent = onPointerLeave;

      // const mapScale = getDynamicMapScale(mapObject3D, currentDom, mapType);
      const mapScale = mapType === "china" ? 3 : 2.2;
      mapObject3D.scale.set(0, 0, 0);
      gsap.to(mapObject3D.scale, {
        x: mapScale,
        y: mapScale,
        z: 1,
        duration: 1,
      });

      if (mapType === "world") {
        const boundingBox = new THREE.Box3().setFromObject(mapObject3D);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        mapObject3D.position.set(-center.x, -center.y, 0);
        mapObject3D.add(worldPointLight);
      }

      if (mapType === "china") {
        const boundingBox = new THREE.Box3().setFromObject(mapObject3D);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);

        mapObject3D.position.set(-center.x, -center.y, 0);

        // 中国地图点光源放到场景里（避免被 mapObject3D 的缩放“拉远”导致整图偏亮）
        // 位置会在 animate 中每帧跟随宁德目标点更新，保证缩放/拖拽时仍锁定宁德
        sceneLocal.add(chinaPointLight);
        // if (!mapObject3D.children.includes(chinaPointLight)) {
        //   mapObject3D.add(chinaPointLight);
        // }
        // if (!scene.children.includes(chinaPointLight)) {
        //   scene.add(chinaPointLight);
        // }
      }

      const clock = new THREE.Clock();
      const tempPosition = new THREE.Vector3();
      const tempLightTargetWorld = new THREE.Vector3();

      // 简易动态降分辨率：当帧时间持续偏高时，自动降低 pixelRatio，减少卡顿
      let perfAcc = 0;
      let perfCount = 0;
      let lastPerfAdjustAt = performance.now();

      // FPS/渲染统计面板（低频更新，避免带来额外开销）
      let fpsFrames = 0;
      let fpsAccMs = 0;
      let lastPerfPanelUpdateAt = performance.now();

      const animate = function () {
        const delta = clock.getDelta();
        const frameMs = delta * 1000;
        perfAcc += frameMs;
        perfCount++;

        if (enablePerfOverlay) {
          fpsFrames++;
          fpsAccMs += frameMs;
          const now = performance.now();
          if (now - lastPerfPanelUpdateAt > 500) {
            const fps = fpsAccMs > 0 ? Math.round((fpsFrames * 1000) / fpsAccMs) : 0;
            fpsFrames = 0;
            fpsAccMs = 0;
            lastPerfPanelUpdateAt = now;

            const info = rendererLocal.info;
            const calls = info.render?.calls ?? 0;
            const triangles = info.render?.triangles ?? 0;
            const lines = info.render?.lines ?? 0;
            const points = info.render?.points ?? 0;
            const geometries = info.memory?.geometries ?? 0;
            const textures = info.memory?.textures ?? 0;

            if (perfPanelRef.current) {
              perfPanelRef.current.textContent =
                `FPS: ${fps} | DPR: ${currentPixelRatio.toFixed(2)}/${maxPixelRatio.toFixed(2)}\n` +
                `Calls: ${calls} | Tri: ${triangles} | Lines: ${lines} | Points: ${points}\n` +
                `Geo: ${geometries} | Tex: ${textures} | Pickables: ${interactiveObjects.length}`;
            }
          }
        }

        if (perfCount >= 30) {
          const avgMs = perfAcc / perfCount;
          perfAcc = 0;
          perfCount = 0;

          const now = performance.now();
          if (now - lastPerfAdjustAt > 1200) {
            // 约 45fps 以下：逐步降到 1；约 58fps 以上：缓慢回升
            if (avgMs > 22 && currentPixelRatio > 1) {
              currentPixelRatio = Math.max(1, currentPixelRatio - 0.25);
              rendererLocal.setPixelRatio(currentPixelRatio);
              lastPerfAdjustAt = now;
            } else if (avgMs < 17 && currentPixelRatio < maxPixelRatio) {
              currentPixelRatio = Math.min(maxPixelRatio, currentPixelRatio + 0.25);
              rendererLocal.setPixelRatio(currentPixelRatio);
              lastPerfAdjustAt = now;
            }
          }
        }

        if (modelMixer.length > 0) {
          modelMixer.forEach((mixer: any) => mixer.update(delta));
        }

        if (controlsLocal.enableDamping) {
          controlsLocal.update();
        }

        rendererLocal.render(sceneLocal, cameraLocal);
        if (labelObject2D && labelObject2D.children.length > 0) {
          labelRendererLocal.render(sceneLocal, cameraLocal);
        }

        if (spotList.length > 0) {
          for (let i = 0; i < spotList.length; i++) {
            const mesh: any = spotList[i];
            mesh._s += 0.01;
            if (mesh._s <= 2) {
              mesh.scale.setScalar(mesh._s);
              mesh.material.opacity = 2 - mesh._s;
            } else {
              mesh._s = 1;
              mesh.scale.setScalar(1);
              mesh.material.opacity = 1;
            }
          }
        }

        if (citySpotListRef.length > 0) {
          for (let i = 0; i < citySpotListRef.length; i++) {
            const mesh: any = citySpotListRef[i];
            if (!mesh._s) mesh._s = 1;
            mesh._s += 0.015;
            if (mesh._s <= 2.5) {
              mesh.scale.setScalar(mesh._s);
              mesh.material.opacity = 2.5 - mesh._s;
            } else {
              mesh._s = 1;
              mesh.scale.setScalar(1);
              mesh.material.opacity = 1;
            }
          }
        }

        if (flySpotList.length > 0) {
          for (let i = 0; i < flySpotList.length; i++) {
            const mesh: any = flySpotList[i];
            mesh._s += 0.003;
            mesh.curve.getPointAt(mesh._s % 1, tempPosition);
            mesh.position.copy(tempPosition);
          }
        }

        // 中国地图：让点光源始终锁定在“宁德”上方，形成小范围光斑
        if (mapType === "china") {
          const targetLocal =
            chinaLightTargetLocal ?? (tempLightTargetWorld.set(0, 0, 0), tempLightTargetWorld);
          tempLightTargetWorld.copy(targetLocal);
          mapObject3D.localToWorld(tempLightTargetWorld);
          // 让灯在目标点正上方一定高度（世界坐标）
          chinaPointLight.position.set(
            tempLightTargetWorld.x,
            tempLightTargetWorld.y,
            tempLightTargetWorld.z + 80
          );
        }

        animationFrameIdRef.current = requestAnimationFrame(animate);
      };

      animationFrameIdRef.current = requestAnimationFrame(animate);
      window.addEventListener("resize", onResizeEvent, { passive: true } as any);
      // 只在地图容器上监听 pointermove，避免全窗口 mousemove 带来的额外压力
      labelRendererLocal.domElement.addEventListener("pointermove", onPointerMove, {
        passive: true,
      });
      labelRendererLocal.domElement.addEventListener("pointerleave", onPointerLeave, {
        passive: true,
      });

      // const gui = new dat.GUI();
      // gui.width = 300;

      // const colorConfig = {
      //   mapColor: mapConfig.mapColor,
      // };

      // gui
      //   .addColor(colorConfig, "mapColor")
      //   .name("地图颜色")
      //   .onChange((v: string) => {
      //     mapConfig.mapColor = v;
      //     mapObject3D.traverse((obj: any) => {
      //       if (obj.material?.[0] && obj.userData.isChangeColor) {
      //         obj.material[0].color.set(v);
      //       }
      //     });
      //   });

      // gui
      //   .add({ intensity: pointLight.intensity }, "intensity", 0, 5)
      //   .name("光强度")
      //   .onChange((v: number) => {
      //     pointLight.intensity = v;
      //   });

      setIsLoading(false);
    }, 100);

    return () => {
      clearTimeout(timer);

      if (leaveHideTimer) {
        window.clearTimeout(leaveHideTimer);
        leaveHideTimer = null;
      }

      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }

      if (onResizeEvent) {
        window.removeEventListener("resize", onResizeEvent as any);
      }

      // pointer 事件解绑（只在初始化成功后才会有 labelRenderer）
      if (labelRenderer?.domElement && onMouseMoveEvent) {
        try {
          labelRenderer.domElement.removeEventListener(
            "pointermove",
            onMouseMoveEvent as any
          );
        } catch {
          // ignore
        }
      }
      if (labelRenderer?.domElement && onPointerLeaveEvent) {
        try {
          labelRenderer.domElement.removeEventListener(
            "pointerleave",
            onPointerLeaveEvent as any
          );
        } catch {
          // ignore
        }
      }

      // 释放控制器
      try {
        controls?.dispose();
      } catch {
        // ignore
      }

      // 释放场景内几何体/材质/纹理
      disposeObject3D(scene);
      try {
        scene?.clear();
      } catch {
        // ignore
      }

      // 释放渲染器
      try {
        renderer?.dispose();
      } catch {
        // ignore
      }
      try {
        // 某些浏览器/驱动上有助于更快回收显存
        (renderer as any)?.forceContextLoss?.();
      } catch {
        // ignore
      }

      // 移除 DOM，避免残留节点叠加
      try {
        renderer?.domElement?.remove();
      } catch {
        // ignore
      }
      try {
        labelRenderer?.domElement?.remove();
      } catch {
        // ignore
      }

      disposed = true;
    };
  }, [geoJson, mapType, projectionFnParam, displayConfig]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        ref={perfPanelRef}
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          zIndex: 9999,
          padding: "8px 10px",
          borderRadius: 8,
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          fontSize: 12,
          lineHeight: 1.4,
          whiteSpace: "pre",
          pointerEvents: "none",
          display:
            typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).get("perf") === "1"
              ? "block"
              : "none",
        }}
      />
      <Loading
        show={isLoading}
        text={`加载${mapType === "china" ? "中国" : "世界"}地图中...`}
      />
      <div ref={map2dRef} />
      <div ref={mapRef} style={{ width: "100%", height: "100%" }}></div>
      <ToolTip
        innterRef={toolTipRef}
        data={toolTipData}
        onMouseEnter={() => {
          isHoveringTooltipRef.current = true;
        }}
        onMouseLeave={() => {
          isHoveringTooltipRef.current = false;
          if (toolTipRef.current?.style) {
            toolTipRef.current.style.visibility = "hidden";
          }
        }}
      />
    </div>
  );
}

export default React.memo(Map3D);

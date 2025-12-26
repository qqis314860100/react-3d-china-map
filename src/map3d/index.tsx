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
import { UI_CONSTANTS } from "./constants";
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
  getDynamicMapScale,
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
  /**
   * 当前 Map3D 是否处于激活状态（用于“两个地图同时挂载”时避免 tooltip/拾取互相干扰）
   */
  active?: boolean;
}

function Map3D(props: Props) {
  const {
    geoJson,
    projectionFnParam,
    displayConfig,
    mapType = "china",
    active = true,
  } = props;

  const mapRef = useRef<HTMLDivElement>(null);
  const map2dRef = useRef<HTMLDivElement>(null);
  const toolTipRef = useRef<any>();
  const isHoveringTooltipRef = useRef<boolean>(false);
  const currentCityDataRef = useRef<any>(null);
  const lastPickRef = useRef<any>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const startLoopFnRef = useRef<(() => void) | null>(null);
  const stopLoopFnRef = useRef<(() => void) | null>(null);
  const activeRef = useRef<boolean>(active);
  // Tooltip 隐藏“宽限期”：用于从地图目标移动到 Tooltip（避免一离开就闪没）
  const tooltipGraceUntilRef = useRef<number>(0);

  const [toolTipData, setToolTipData] = useState<TooltipData>({
    text: "",
    districts: [],
    showPanel: false,
    isCity: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // active 变化时不重新初始化场景，但要立刻停止交互/隐藏 tooltip，避免“两个地图信息同时显示”
  useEffect(() => {
    activeRef.current = active;

    if (!active) {
      // inactive：停止渲染循环（大幅降低 CPU）
      stopLoopFnRef.current?.();
      try {
        if (mapRef.current) mapRef.current.style.cursor = "default";
      } catch {
        // ignore
      }
      try {
        restorePickedObjectColor(lastPickRef.current);
      } catch {
        // ignore
      }
      lastPickRef.current = null;
      currentCityDataRef.current = null;
      tooltipGraceUntilRef.current = 0;
      hideTooltip(toolTipRef.current);
      setToolTipData({
        text: "",
        districts: [],
        showPanel: false,
        isCity: false,
      });
    } else {
      // active：恢复渲染循环
      startLoopFnRef.current?.();
    }
  }, [active]);

  const normalizeCityName = (name?: string) => (name || "").replace(/市$/, "");

  useEffect(() => {
    const currentDom = mapRef.current;
    const labelDom = map2dRef.current;
    if (!currentDom || !labelDom) return;

    setIsLoading(true);

    // 资源/事件引用：用于 cleanup，避免重复监听导致“越来越卡/越来越延迟”
    let renderer: THREE.WebGLRenderer | null = null;
    let labelRenderer: CSS2DRenderer | null = null;
    let controls: OrbitControls | null = null;
    let scene: THREE.Scene | null = null;
    let mapObject3D: THREE.Object3D | null = null;
    let eventTarget: HTMLElement | null = null;
    let onResizeEvent: (() => void) | null = null;
    let onMouseMoveEvent: ((e: MouseEvent) => void) | null = null;
    let onMouseLeaveEvent: (() => void) | null = null;

    // 延迟初始化，确保 Loading 能显示
    const timer = setTimeout(() => {
      scene = initScene();
      const { camera } = initCamera(currentDom, mapType);

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
      // 让背景图透出来：WebGL canvas 清屏透明
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.background = "transparent";
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      while (currentDom.firstChild) {
        currentDom.removeChild(currentDom.firstChild);
      }
      currentDom.appendChild(renderer.domElement);

      labelRenderer = new CSS2DRenderer();
      labelRenderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
      labelRenderer.domElement.style.position = "absolute";
      labelRenderer.domElement.style.top = "0px";
      labelRenderer.domElement.style.background = "transparent";
      while (labelDom.firstChild) {
        labelDom.removeChild(labelDom.firstChild);
      }
      labelDom.appendChild(labelRenderer.domElement);

      const generated = generateMapObject3D(
        geoJson,
        projectionFnParam,
        displayConfig,
        mapType
      );
      mapObject3D = generated.mapObject3D;
      const label2dData = generated.label2dData;
      scene.add(mapObject3D);

      const labelObject2D = generateMapLabel2D(
        label2dData,
        displayConfig,
        projectionFnParam,
        mapType
      );
      if (labelObject2D && labelObject2D.children.length > 0) {
        mapObject3D.add(labelObject2D);
      }

      const { spotList, spotObject3D, citySpotList } = generateMapSpot(
        label2dData,
        displayConfig,
        projectionFnParam,
        mapType
      );
      mapObject3D.add(spotObject3D);
      const citySpotListRef = citySpotList || [];

      const modelMixer: any = [];

      // 飞线和飞点flyspot的容器
      const flyObject3D = new THREE.Object3D();
      // 存储所有飞点对象
      const flySpotList: any = [];
      let ningdeCoordForLight: [number, number] | null = null;
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
          ningdeCoordForLight = ningdeCoord;
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

      controls = new OrbitControls(camera, labelRenderer.domElement);
      controls.enableRotate = true;
      controls.enableZoom = true;
      controls.enablePan = true;
      controls.enableDamping = true;
      controls.dampingFactor = 0.15;
      controls.enableZoom = true;

      const currentPhi = Math.PI / 3; // 当前俯视角
      const oppositePhi = Math.PI - currentPhi; // 相反仰视角

      const spherical = new THREE.Spherical();
      spherical.setFromVector3(camera.position);
      spherical.phi = oppositePhi; // 设置为相反角度
      camera.position.setFromSpherical(spherical);

      // 重新对准目标（通常看原点）
      camera.lookAt(0, 0, 0);

      const { chinaPointLight, worldPointLight } = initLights(scene);

      onResizeEvent = () => {
        const w = currentDom.clientWidth;
        const h = currentDom.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer?.setSize(w, h);
        labelRenderer?.setSize(w, h);
        renderer?.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      };

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      // 可交互对象缓存：避免 mousemove 时每次 traverse scene
      const interactiveObjects: THREE.Object3D[] = [];

      let mouseMoveThrottle = 0;
      onMouseMoveEvent = (e: MouseEvent) => {
        if (!activeRef.current) return;
        if (isHoveringTooltipRef.current) return;
        // Tooltip 已显示时，给用户一点时间把鼠标移入 Tooltip，避免瞬间消失
        const tooltipVisible =
          !!toolTipRef.current?.style &&
          toolTipRef.current.style.visibility === "visible";
        if (tooltipVisible && Date.now() < tooltipGraceUntilRef.current) return;

        mouseMoveThrottle++;
        if (mouseMoveThrottle % UI_CONSTANTS.MOUSE_MOVE_THROTTLE !== 0) return;

        // 关键：用“相对地图容器”的坐标换算，侧栏/头部/边距存在时才不会拾取错位
        const rect = currentDom.getBoundingClientRect();
        const relX = e.clientX - rect.left;
        const relY = e.clientY - rect.top;
        const nx = (relX / rect.width) * 2 - 1;
        const ny = -(relY / rect.height) * 2 + 1;
        pointer.x = Math.max(-1, Math.min(1, nx));
        pointer.y = Math.max(-1, Math.min(1, ny));

        // 使用缓存的可交互对象列表
        raycaster.setFromCamera(pointer, camera);
        const intersects = raycaster.intersectObjects(
          interactiveObjects,
          false
        );

        const prevPicked = lastPickRef.current;
        const prevObject = prevPicked?.object;
        const nextPicked = findPickedObject(intersects);
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
          tooltipGraceUntilRef.current =
            Date.now() + UI_CONSTANTS.TOOLTIP_GRACE_MS;

          const isSameTarget = prevObject && nextObject === prevObject;
          const isTooltipVisibleNow =
            !!toolTipRef.current?.style &&
            toolTipRef.current.style.visibility === "visible";

          // 关键：同一目标悬浮时不重复更新 tooltip 位置（避免 tooltip 跟着鼠标“逃跑”）
          if (!isSameTarget || !isTooltipVisibleNow) {
            applyHoverEffect(
              nextPicked,
              e,
              currentDom.getBoundingClientRect(),
              toolTipRef,
              setToolTipData,
              currentCityDataRef
            );
          }
        } else {
          if (currentDom) currentDom.style.cursor = "default";
          if (!isHoveringTooltipRef.current) {
            // 超过宽限期才隐藏（否则用户从目标移动到 tooltip 会很难）
            if (Date.now() >= tooltipGraceUntilRef.current) {
              hideTooltip(toolTipRef.current);
            }
          }
        }
      };

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
        mapObject3D.position.set(0, 30, 0);
        mapObject3D.add(worldPointLight);
      }

      if (mapType === "china") {
        // 中国地图点光源放到场景里（避免被 mapObject3D 的缩放“拉远”导致整图偏亮）
        // 位置会在 animate 中每帧跟随宁德目标点更新，保证缩放/拖拽时仍锁定宁德
        scene.add(chinaPointLight);
        mapObject3D.position.set(0, 10, 0);
      }

      const clock = new THREE.Clock();
      let frameCount = 0;
      const tempPosition = new THREE.Vector3();
      const tempLightTargetWorld = new THREE.Vector3();

      // 初始化完成后，这些对象在本次 effect 生命周期内应始终存在。
      // 用局部常量收窄类型，避免 TS 认为可能为 null。
      const rendererRef = renderer!;
      const labelRendererRef = labelRenderer!;
      const controlsRef = controls!;
      const sceneRef = scene!;
      const mapObject3DRef = mapObject3D!;
      // 初始化完成后构建一次可交互对象列表（城市点、城市文字、省份面）
      interactiveObjects.length = 0;
      mapObject3DRef.traverse((obj: any) => {
        if (obj?.userData?.isCity || obj?.userData?.isChangeColor) {
          interactiveObjects.push(obj);
        }
      });

      const animate = function () {
        // 非激活状态：不跑 RAF（避免两个地图同时跑导致 CPU 飙高）
        if (!activeRef.current) {
          animationFrameIdRef.current = null;
          return;
        }

        frameCount++;
        const delta = clock.getDelta();

        if (modelMixer.length > 0) {
          modelMixer.forEach((mixer: any) => mixer.update(delta));
        }

        if (controlsRef.enableDamping) {
          controlsRef.update();
        }

        rendererRef.render(sceneRef, camera);
        if (labelObject2D && labelObject2D.children.length > 0) {
          labelRendererRef.render(sceneRef, camera);
        }

        if (spotList.length > 0) {
          spotList.forEach((mesh: any) => {
            mesh._s += 0.01;
            if (mesh._s <= 2) {
              mesh.scale.setScalar(mesh._s);
              mesh.material.opacity = 2 - mesh._s;
            } else {
              mesh._s = 1;
              mesh.scale.setScalar(1);
              mesh.material.opacity = 1;
            }
          });
        }

        if (citySpotListRef.length > 0) {
          citySpotListRef.forEach((mesh: any) => {
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
          });
        }

        if (flySpotList.length > 0) {
          flySpotList.forEach(function (mesh: any) {
            mesh._s += 0.003;
            mesh.curve.getPointAt(mesh._s % 1, tempPosition);
            mesh.position.copy(tempPosition);
          });
        }

        // 中国地图：让点光源始终锁定在“宁德”上方，形成小范围光斑
        if (mapType === "china") {
          const targetLocal =
            chinaLightTargetLocal ??
            (tempLightTargetWorld.set(0, 0, 0), tempLightTargetWorld);
          tempLightTargetWorld.copy(targetLocal);
          mapObject3DRef.localToWorld(tempLightTargetWorld);
          // 让灯在目标点正上方一定高度（世界坐标）
          chinaPointLight.position.set(
            tempLightTargetWorld.x,
            tempLightTargetWorld.y,
            tempLightTargetWorld.z + 80
          );
        }

        animationFrameIdRef.current = requestAnimationFrame(animate);
      };

      // 控制渲染循环启停（给 active effect 调用）
      const startLoop = () => {
        if (animationFrameIdRef.current !== null) return;
        animationFrameIdRef.current = requestAnimationFrame(animate);
      };
      const stopLoop = () => {
        if (animationFrameIdRef.current !== null) {
          cancelAnimationFrame(animationFrameIdRef.current);
          animationFrameIdRef.current = null;
        }
      };
      startLoopFnRef.current = startLoop;
      stopLoopFnRef.current = stopLoop;

      // 初始状态：只在 active 时启动
      if (activeRef.current) startLoop();
      // 监听 window.resize（侧栏动画结束后由 App 触发一次 resize，避免动画过程中频繁 setSize 导致卡/闪）
      if (onResizeEvent) window.addEventListener("resize", onResizeEvent, false);
      // 只在地图层监听，避免全局监听 + 重复绑定带来的延迟/卡顿
      eventTarget = labelRenderer.domElement as unknown as HTMLElement;
      if (onMouseMoveEvent) {
        eventTarget.addEventListener("mousemove", onMouseMoveEvent, false);
      }
      onMouseLeaveEvent = () => {
        if (!activeRef.current) return;
        if (!isHoveringTooltipRef.current) {
          hideTooltip(toolTipRef.current);
        }
      };
      eventTarget.addEventListener("mouseleave", onMouseLeaveEvent, false);
      setIsLoading(false);
    }, 100);

    return () => {
      clearTimeout(timer);

      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      startLoopFnRef.current = null;
      stopLoopFnRef.current = null;

      // 清理事件监听，避免重复绑定
      if (onResizeEvent) {
        window.removeEventListener("resize", onResizeEvent, false);
      }
      if (eventTarget && onMouseMoveEvent) {
        eventTarget.removeEventListener("mousemove", onMouseMoveEvent, false);
      }
      if (eventTarget && onMouseLeaveEvent) {
        eventTarget.removeEventListener("mouseleave", onMouseLeaveEvent, false);
      }

      // 释放 WebGL/Controls/场景资源
      try {
        controls?.dispose();
      } catch {
        // ignore
      }
      try {
        disposeObject3D(mapObject3D);
      } catch {
        // ignore
      }
      try {
        renderer?.dispose();
      } catch {
        // ignore
      }
      try {
        // 移除 labelRenderer dom，避免多层叠加导致事件命中异常
        if (labelRenderer?.domElement?.parentNode) {
          labelRenderer.domElement.parentNode.removeChild(labelRenderer.domElement);
        }
      } catch {
        // ignore
      }
      try {
        // 移除 canvas
        if (renderer?.domElement?.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      } catch {
        // ignore
      }
      scene = null;
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

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

    // 延迟初始化，确保 Loading 能显示
    const timer = setTimeout(() => {
      const scene = initScene();
      const { camera } = initCamera(currentDom, mapType);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      while (currentDom.firstChild) {
        currentDom.removeChild(currentDom.firstChild);
      }
      currentDom.appendChild(renderer.domElement);

      const labelRenderer = new CSS2DRenderer();
      labelRenderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
      labelRenderer.domElement.style.position = "absolute";
      labelRenderer.domElement.style.top = "0px";

      while (labelDom.firstChild) {
        labelDom.removeChild(labelDom.firstChild);
      }
      labelDom.appendChild(labelRenderer.domElement);

      const { mapObject3D, label2dData } = generateMapObject3D(
        geoJson,
        projectionFnParam,
        displayConfig,
        mapType
      );
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

      const controls = new OrbitControls(camera, labelRenderer.domElement);
      controls.enableRotate = true;
      controls.enableZoom = true;
      controls.enablePan = true;
      controls.enableDamping = true;
      controls.dampingFactor = 0.15;
      controls.enableZoom = true;

      const { chinaPointLight, worldPointLight } = initLights(scene);

   
      const onResizeEvent = () => {
        camera.aspect = currentDom.clientWidth / currentDom.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
        labelRenderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      };

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      let mouseMoveThrottle = 0;
      const onMouseMoveEvent = (e: MouseEvent) => {
        if (isHoveringTooltipRef.current) return;
        // Tooltip 已显示时，给用户一点时间把鼠标移入 Tooltip，避免瞬间消失
        const tooltipVisible =
          !!toolTipRef.current?.style &&
          toolTipRef.current.style.visibility === "visible";
        if (tooltipVisible && Date.now() < tooltipGraceUntilRef.current) return;

        mouseMoveThrottle++;
        if (mouseMoveThrottle % UI_CONSTANTS.MOUSE_MOVE_THROTTLE !== 0) return;

        pointer.x = (e.clientX / currentDom.clientWidth) * 2 - 1;
        pointer.y = -(e.clientY / currentDom.clientHeight) * 2 + 1;

        const interactiveObjects: THREE.Object3D[] = [];
        scene.traverse((obj: any) => {
          if (obj.userData.isCity || obj.userData.isChangeColor) {
            interactiveObjects.push(obj);
          }
        });
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
        if (prevPicked && prevObject && (!nextObject || nextObject !== prevObject)) {
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
            currentDom.style.cursor = isCity && (hasUrl || hasDistricts) ? "pointer" : "default";
          }

          // 命中目标后，设置宽限时间，方便用户移动到 tooltip
          tooltipGraceUntilRef.current = Date.now() + 500;

          const isSameTarget = prevObject && nextObject === prevObject;
          const isTooltipVisibleNow =
            !!toolTipRef.current?.style &&
            toolTipRef.current.style.visibility === "visible";

          // 关键：同一目标悬浮时不重复更新 tooltip 位置（避免 tooltip 跟着鼠标“逃跑”）
          if (!isSameTarget || !isTooltipVisibleNow) {
            applyHoverEffect(
              nextPicked,
            e,
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
        scene.add(chinaPointLight);
        console.log("mapObject3D", mapObject3D);
        // if (!mapObject3D.children.includes(chinaPointLight)) {
        //   mapObject3D.add(chinaPointLight);
        // }
        // if (!scene.children.includes(chinaPointLight)) {
        //   scene.add(chinaPointLight);
        // }
      }

      const clock = new THREE.Clock();
      let frameCount = 0;
      const tempPosition = new THREE.Vector3();
      const tempLightTargetWorld = new THREE.Vector3();

      const animate = function () {
        frameCount++;
        const delta = clock.getDelta();

        if (modelMixer.length > 0) {
          modelMixer.forEach((mixer: any) => mixer.update(delta));
        }

        if (controls.enableDamping) {
          controls.update();
        }

        if (frameCount % 3 === 0) {
          raycaster.setFromCamera(pointer, camera);
        }

        renderer.render(scene, camera);
        if (labelObject2D && labelObject2D.children.length > 0) {
          labelRenderer.render(scene, camera);
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
      window.addEventListener("resize", onResizeEvent, false);
      window.addEventListener("mousemove", onMouseMoveEvent, false);

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

      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
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

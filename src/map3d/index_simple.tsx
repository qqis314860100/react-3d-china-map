import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer";
import * as d3 from "d3";
import gsap from "gsap";
import * as dat from "dat.gui";

import ToolTip from "../tooltip";
import Loading from "./components/Loading";
import { GeoJsonType } from "./typed";
import { initScene } from "./scene";
import { initCamera } from "./camera";
import { initLights } from "./light";
import { mapConfig } from "./mapConfig";
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
  const { geoJson, projectionFnParam, displayConfig, mapType = "china" } = props;
  
  const mapRef = useRef<HTMLDivElement>(null);
  const map2dRef = useRef<HTMLDivElement>(null);
  const toolTipRef = useRef<any>();
  const isHoveringTooltipRef = useRef<boolean>(false);
  const currentCityDataRef = useRef<any>(null);
  const lastPickRef = useRef<any>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  
  const [toolTipData, setToolTipData] = useState<TooltipData>({
    text: "",
    districts: [],
    showPanel: false,
    isCity: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const currentDom = mapRef.current;
    const labelDom = map2dRef.current;
    if (!currentDom || !labelDom) return;

    setIsLoading(true);

    // 短暂延迟以显示 Loading
    setTimeout(() => {
      try {
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

        const flyObject3D = new THREE.Object3D();
        const flySpotList: any = [];
        
        if (displayConfig && displayConfig.length > 0 && mapType === "china") {
          const { center, scale } = projectionFnParam;
          const projectionFn = d3.geoMercator().center(center).scale(scale).translate([0, 0]);
          
          let ningdeCoord: [number, number] | null = null;
          displayConfig.forEach((provinceConfig: any) => {
            if (provinceConfig.name === "福建省" && provinceConfig.cities) {
              const ningdeCity = provinceConfig.cities.find((city: any) => city.name === "宁德市");
              if (ningdeCity?.coordinates) {
                const coord = projectionFn(ningdeCity.coordinates);
                if (coord) ningdeCoord = coord;
              }
            }
          });
          
          if (ningdeCoord) {
            displayConfig.forEach((provinceConfig: any) => {
              provinceConfig.cities?.forEach((cityConfig: any) => {
                if (cityConfig.name === "宁德市") return;
                if (cityConfig.coordinates) {
                  const cityCoord = projectionFn(cityConfig.coordinates);
                  if (cityCoord) {
                    const { flyLine, flySpot } = drawLineBetween2Spot(cityCoord, ningdeCoord!);
                    flyObject3D.add(flyLine);
                    flyObject3D.add(flySpot);
                    flySpotList.push(flySpot);
                  }
                }
              });
            });
          }
        }
        mapObject3D.add(flyObject3D);

        const controls = new OrbitControls(camera, labelRenderer.domElement);
        controls.enableRotate = false;
        controls.enableZoom = true;
        controls.enablePan = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        const { pointLight } = initLights(scene);

        const onResizeEvent = () => {
          camera.aspect = currentDom.clientWidth / currentDom.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
          labelRenderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
        };

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();

        let mouseMoveThrottle = 0;
        const onMouseMoveEvent = (e: MouseEvent) => {
          if (isHoveringTooltipRef.current) return;
          
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
          const intersects = raycaster.intersectObjects(interactiveObjects, false);

          if (lastPickRef.current) {
            restorePickedObjectColor(lastPickRef.current);
          }
          
          lastPickRef.current = findPickedObject(intersects);

          if (lastPickRef.current) {
            applyHoverEffect(lastPickRef.current, e, toolTipRef, setToolTipData, currentCityDataRef);
          } else {
            if (!isHoveringTooltipRef.current) {
              hideTooltip(toolTipRef.current);
            }
          }
        };

        const mapScale = getDynamicMapScale(mapObject3D, currentDom, mapType);
        mapObject3D.scale.set(0, 0, 0);
        gsap.to(mapObject3D.scale, { x: mapScale, y: mapScale, z: 1, duration: 1 });
        
        if (mapType === "world") {
          const boundingBox = new THREE.Box3().setFromObject(mapObject3D);
          const center = new THREE.Vector3();
          boundingBox.getCenter(center);
          mapObject3D.position.set(-center.x, -center.y, 0);
        }

        const clock = new THREE.Clock();
        let frameCount = 0;
        const tempPosition = new THREE.Vector3();
        
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

          animationFrameIdRef.current = requestAnimationFrame(animate);
        };
        
        animationFrameIdRef.current = requestAnimationFrame(animate);

        window.addEventListener("resize", onResizeEvent, false);
        window.addEventListener("mousemove", onMouseMoveEvent, false);

        const gui = new dat.GUI();
        gui.width = 300;
        
        gui.addColor({ color: mapConfig.mapColor }, "color").name("地图颜色").onChange((v: string) => {
          mapConfig.mapColor = v;
          mapObject3D.traverse((obj: any) => {
            if (obj.material?.[0] && obj.userData.isChangeColor) {
              obj.material[0].color.set(v);
            }
          });
        });

        gui.add({ intensity: pointLight.intensity }, "intensity", 0, 5).name("光强度").onChange((v: number) => {
          pointLight.intensity = v;
        });

        setIsLoading(false);

        return () => {
          if (animationFrameIdRef.current !== null) {
            cancelAnimationFrame(animationFrameIdRef.current);
          }
          window.removeEventListener("resize", onResizeEvent);
          window.removeEventListener("mousemove", onMouseMoveEvent);
          gui.destroy();
          
          scene.traverse((object: any) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach((mat: any) => mat.dispose?.());
              } else {
                object.material.dispose?.();
              }
            }
          });
          
          renderer.dispose();
          labelRenderer.domElement.remove();
        };
      } catch (error) {
        console.error("地图初始化失败:", error);
        setIsLoading(false);
      }
    }, 100);
  }, [geoJson, mapType]);

  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
      <Loading show={isLoading} text={`加载${mapType === "china" ? "中国" : "世界"}地图中...`} />
      <div ref={map2dRef} />
      <div ref={mapRef} style={{ width: "100%", height: "100%" }}></div>
      <ToolTip
        innterRef={toolTipRef}
        data={toolTipData}
        onMouseEnter={() => { isHoveringTooltipRef.current = true; }}
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

export default Map3D;


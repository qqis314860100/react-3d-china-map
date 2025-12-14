import { useEffect, useMemo, useState, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer";
import * as d3 from "d3";
import gsap from "gsap";
import * as dat from "dat.gui";

import ToolTip from "../tooltip";
import Loading from "./components/Loading";
import { GeoJsonType } from "./typed";

// 导入公共模块
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

// 重新导出类型，保持向后兼容
export type { ProjectionFnParamType, CityConfig, ProvinceConfig };

interface Props {
  geoJson: GeoJsonType;
  projectionFnParam: ProjectionFnParamType;
  displayConfig: ProvinceConfig[];
  mapType?: "china" | "world"; // 地图类型
}

// 全局缓存存储，避免重复初始化
const globalMapCache: {
  [key: string]: {
    isInitialized: boolean;
    container: HTMLElement | null;
    labelContainer: HTMLElement | null;
  };
} = {};

function Map3D(props: Props) {
  const { geoJson, projectionFnParam, displayConfig, mapType = "china" } = props;
  
  const mapRef = useRef<HTMLDivElement>(null);
  const map2dRef = useRef<HTMLDivElement>(null);
  const toolTipRef = useRef<any>();
  const isHoveringTooltipRef = useRef<boolean>(false);
  const currentCityDataRef = useRef<any>(null);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const lastPickRef = useRef<any>(null);
  
  const [toolTipData, setToolTipData] = useState<TooltipData>({
    text: "",
    districts: [],
    showPanel: false,
    isCity: false,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 计算缓存键值
  const cacheKey = useMemo(
    () => `${mapType}-${geoJson.features?.length || 0}`,
    [mapType, geoJson.features?.length]
  );

  useEffect(() => {
    const currentDom = mapRef.current;
    const labelDom = map2dRef.current;
    if (!currentDom || !labelDom) return;

    // 如果这个地图已经初始化过，直接显示缓存的内容
    if (globalMapCache[cacheKey]?.isInitialized) {
      setIsLoading(false);
      const cached = globalMapCache[cacheKey];
      
      // 显示缓存的容器
      if (cached.container && cached.labelContainer) {
        cached.container.style.display = "block";
        cached.labelContainer.style.display = "block";
        
        // 将缓存的容器添加到当前 DOM（如果还没有）
        if (!currentDom.contains(cached.container)) {
          currentDom.appendChild(cached.container);
        }
        if (!labelDom.contains(cached.labelContainer)) {
          labelDom.appendChild(cached.labelContainer);
        }
      }
      
      // 隐藏其他地图的容器
      Object.keys(globalMapCache).forEach((key) => {
        if (key !== cacheKey && globalMapCache[key].isInitialized) {
          const otherCache = globalMapCache[key];
          if (otherCache.container) {
            otherCache.container.style.display = "none";
          }
          if (otherCache.labelContainer) {
            otherCache.labelContainer.style.display = "none";
          }
        }
      });
      
      return;
    }

    // 如果正在初始化，不重复执行
    if (initPromiseRef.current) {
      return;
    }

    // 开始初始化
    setIsLoading(true);
    
    // 异步初始化地图
    const initMap = async () => {
      try {
        // 模拟资源加载时间
        await new Promise(resolve => setTimeout(resolve, 300));

        /**
         * 初始化场景
         */
        const scene = initScene();

        /**
         * 初始化摄像机
         */
        const { camera, cameraHelper } = initCamera(currentDom, mapType);

        /**
         * 初始化渲染器 - 性能优化
         */
        const renderer = new THREE.WebGLRenderer({
          antialias: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        });
        renderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = false;
        
        // 清空当前容器
        while (currentDom.firstChild) {
          currentDom.removeChild(currentDom.firstChild);
        }
        currentDom.appendChild(renderer.domElement);

        /**
         * 创建css2 Renderer 渲染器
         */
        const labelRenderer = new CSS2DRenderer();
        labelRenderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
        labelRenderer.domElement.style.position = "absolute";
        labelRenderer.domElement.style.top = "0px";
        
        // 清空标签容器
        while (labelDom.firstChild) {
          labelDom.removeChild(labelDom.firstChild);
        }
        labelDom.appendChild(labelRenderer.domElement);

        /**
         * 初始化模型（绘制3D模型）
         */
        const { mapObject3D, label2dData } = generateMapObject3D(
          geoJson,
          projectionFnParam,
          displayConfig,
          mapType
        );
        scene.add(mapObject3D);

        /**
         * 绘制 2D 标签
         */
        const labelObject2D = generateMapLabel2D(
          label2dData,
          displayConfig,
          projectionFnParam,
          mapType
        );
        if (labelObject2D && labelObject2D.children.length > 0) {
          mapObject3D.add(labelObject2D);
        }

        /**
         * 绘制点位
         */
        const { spotList, spotObject3D, citySpotList } = generateMapSpot(
          label2dData,
          displayConfig,
          projectionFnParam,
          mapType
        );
        mapObject3D.add(spotObject3D);
        const citySpotListRef = citySpotList || [];

        // 模型混合器
        const modelMixer: any = [];


        /**
         * 绘制连线（仅中国地图）
         */
        const flyObject3D = new THREE.Object3D();
        const flySpotList: any = [];
        
        if (displayConfig && displayConfig.length > 0 && mapType === "china") {
          const { center, scale } = projectionFnParam;
          const projectionFn = d3
            .geoMercator()
            .center(center)
            .scale(scale)
            .translate([0, 0]);
          
          let ningdeCoord: [number, number] | null = null;
          displayConfig.forEach((provinceConfig: any) => {
            if (provinceConfig.name === "福建省" && provinceConfig.cities) {
              const ningdeCity = provinceConfig.cities.find(
                (city: any) => city.name === "宁德市"
              );
              if (ningdeCity && ningdeCity.coordinates) {
                const coord = projectionFn(ningdeCity.coordinates);
                if (coord) ningdeCoord = coord;
              }
            }
          });
          
          if (ningdeCoord) {
            displayConfig.forEach((provinceConfig: any) => {
              if (provinceConfig.cities && provinceConfig.cities.length > 0) {
                provinceConfig.cities.forEach((cityConfig: any) => {
                  if (cityConfig.name === "宁德市") return;
                  if (cityConfig.coordinates) {
                    const cityCoord = projectionFn(cityConfig.coordinates);
                    if (cityCoord) {
                      const { flyLine, flySpot } = drawLineBetween2Spot(
                        cityCoord,
                        ningdeCoord!
                      );
                      flyObject3D.add(flyLine);
                      flyObject3D.add(flySpot);
                      flySpotList.push(flySpot);
                    }
                  }
                });
              }
            });
          }
        }
        mapObject3D.add(flyObject3D);

        /**
         * 初始化控制器
         */
        const controls = new OrbitControls(camera, labelRenderer.domElement);
        controls.enableRotate = false;
        controls.enableZoom = true;
        controls.enablePan = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        /**
         * 初始化光源
         */
        const { ambientLight, pointLight } = initLights(scene);
        const light = pointLight;

        // 视窗伸缩
        const onResizeEvent = () => {
          camera.aspect = currentDom.clientWidth / currentDom.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
          labelRenderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        };

        /**
         * 设置 raycaster
         */
        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();

        // 鼠标移动事件 - 节流处理
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
          const intersects = raycaster.intersectObjects(interactiveObjects, false);

          if (lastPickRef.current) {
            restorePickedObjectColor(lastPickRef.current);
          }
          
          lastPickRef.current = findPickedObject(intersects);

          if (lastPickRef.current) {
            applyHoverEffect(
              lastPickRef.current,
              e,
              toolTipRef,
              setToolTipData,
              currentCityDataRef
            );
          } else {
            if (!isHoveringTooltipRef.current) {
              hideTooltip(toolTipRef.current);
            }
          }
        };

        /**
         * 地图缩放动画
         */
        const mapScale = getDynamicMapScale(mapObject3D, currentDom, mapType);
        mapObject3D.scale.set(0, 0, 0);
        gsap.to(mapObject3D.scale, {
          x: mapScale,
          y: mapScale,
          z: 1,
          duration: 1,
        });
        
        // 世界地图居中
        if (mapType === "world") {
          const boundingBox = new THREE.Box3().setFromObject(mapObject3D);
          const center = new THREE.Vector3();
          boundingBox.getCenter(center);
          mapObject3D.position.set(-center.x, -center.y, 0);
        }

        /**
         * 动画循环 - 性能优化版本
         */
        const clock = new THREE.Clock();
        let frameCount = 0;
        const tempPosition = new THREE.Vector3();
        let animationId: number | null = null;
        
        const animate = function () {
          frameCount++;
          const delta = clock.getDelta();
          
          // 更新模型动画
          if (modelMixer.length > 0) {
            modelMixer.forEach((mixer: any) => mixer.update(delta));
          }

          // 更新控制器
          if (controls.enableDamping) {
            controls.update();
          }

          // 减少raycaster更新频率
          if (frameCount % 3 === 0) {
            raycaster.setFromCamera(pointer, camera);
          }

          // 渲染场景
          renderer.render(scene, camera);
          if (labelObject2D && labelObject2D.children.length > 0) {
            labelRenderer.render(scene, camera);
          }

          // 省份圆环动画
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
          
          // 城市圆环动画
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

          // 飞行的圆点
          if (flySpotList.length > 0) {
            flySpotList.forEach(function (mesh: any) {
              mesh._s += 0.003;
              mesh.curve.getPointAt(mesh._s % 1, tempPosition);
              mesh.position.copy(tempPosition);
            });
          }

          animationId = requestAnimationFrame(animate);
        };
        
        animationId = requestAnimationFrame(animate);

        // 添加事件监听
        window.addEventListener("resize", onResizeEvent, false);
        window.addEventListener("mousemove", onMouseMoveEvent, false);

        // dat.GUI 配置
        const gui = new dat.GUI();
        gui.width = 300;
        const colorConfig = {
          mapColor: mapConfig.mapColor,
          mapHoverColor: mapConfig.mapHoverColor,
          mapSideColor1: mapConfig.mapSideColor1,
          mapSideColor2: mapConfig.mapSideColor2,
          topLineColor:
            typeof mapConfig.topLineColor === "number"
              ? `#${mapConfig.topLineColor.toString(16)}`
              : mapConfig.topLineColor,
        };
        
        gui
          .addColor(colorConfig, "mapColor")
          .name("地图颜色")
          .onChange((value: string) => {
            mapConfig.mapColor = value;
            mapObject3D.traverse((obj: any) => {
              if (obj.material && obj.material[0] && obj.userData.isChangeColor) {
                obj.material[0].color.set(value);
              }
            });
          });
        gui
          .addColor(colorConfig, "mapHoverColor")
          .name("地图Hover颜色")
          .onChange((value: string) => {
            mapConfig.mapHoverColor = value;
          });
        gui
          .addColor(colorConfig, "mapSideColor1")
          .name("侧面渐变1")
          .onChange((value: string) => {
            mapConfig.mapSideColor1 = value;
            mapObject3D.traverse((obj: any) => {
              if (
                obj.material &&
                obj.material[1] &&
                obj.material[1].uniforms &&
                obj.material[1].uniforms.color1
              ) {
                obj.material[1].uniforms.color1.value.set(value);
              }
            });
          });
        gui
          .addColor(colorConfig, "mapSideColor2")
          .name("侧面渐变2")
          .onChange((value: string) => {
            mapConfig.mapSideColor2 = value;
            mapObject3D.traverse((obj: any) => {
              if (
                obj.material &&
                obj.material[1] &&
                obj.material[1].uniforms &&
                obj.material[1].uniforms.color2
              ) {
                obj.material[1].uniforms.color2.value.set(value);
              }
            });
          });
        gui
          .addColor(colorConfig, "topLineColor")
          .name("顶线颜色")
          .onChange((value: string) => {
            mapConfig.topLineColor = parseInt(value.replace("#", ""), 16);
            mapObject3D.traverse((obj: any) => {
              if (obj.type === "Line2" && obj.material) {
                obj.material.color.set(value);
              }
            });
          });

        const lightConfig = { intensity: light.intensity };
        gui
          .add(lightConfig, "intensity", 0, 5)
          .name("光强度")
          .onChange((v: number) => {
            light.intensity = v;
          });

        // 标记初始化完成并缓存
        globalMapCache[cacheKey] = {
          isInitialized: true,
          container: renderer.domElement,
          labelContainer: labelRenderer.domElement,
        };
        
        // 隐藏其他地图容器
        Object.keys(globalMapCache).forEach((key) => {
          if (key !== cacheKey && globalMapCache[key].isInitialized) {
            const otherCache = globalMapCache[key];
            if (otherCache.container) {
              otherCache.container.style.display = "none";
            }
            if (otherCache.labelContainer) {
              otherCache.labelContainer.style.display = "none";
            }
          }
        });
        
        setIsLoading(false);
        
        // 清理函数（组件卸载时不执行，只在清理缓存时执行）
        const cleanup = () => {
          if (animationId !== null) {
            cancelAnimationFrame(animationId);
          }
          window.removeEventListener("resize", onResizeEvent);
          window.removeEventListener("mousemove", onMouseMoveEvent);
          gui.destroy();
          
          scene.traverse((object: any) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach((mat: any) => {
                  if (mat.dispose) mat.dispose();
                });
              } else if (object.material.dispose) {
                object.material.dispose();
              }
            }
          });
          
          renderer.dispose();
          labelRenderer.domElement.remove();
        };
      } catch (error) {
        console.error("地图初始化失败:", error);
        setIsLoading(false);
      } finally {
        initPromiseRef.current = null;
      }
    };
    
    initPromiseRef.current = initMap();
    initMap();
  }, [cacheKey, geoJson, projectionFnParam, displayConfig, mapType]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Loading show={isLoading} text={`加载${mapType === "china" ? "中国" : "世界"}地图中...`} />
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
          if (toolTipRef.current && toolTipRef.current.style) {
            toolTipRef.current.style.visibility = "hidden";
          }
        }}
      />
    </div>
  );
}

export default Map3D;

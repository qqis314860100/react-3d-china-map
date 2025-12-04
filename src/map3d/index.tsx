import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import ToolTip from "../tooltip";
import {
  drawLineBetween2Spot,
  generateMapLabel2D,
  generateMapObject3D,
  generateMapSpot,
  getDynamicMapScale,
} from "./drawFunc";
import { GeoJsonType } from "./typed";
import gsap from "gsap";
import * as d3 from "d3";

import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";

// 雷达功能已移除
import { initScene } from "./scene";
import { mapConfig } from "./mapConfig";
import { initCamera } from "./camera";
import { initLights } from "./light";
import * as dat from "dat.gui";

export type ProjectionFnParamType = {
  center: [number, number];
  scale: number;
};

export interface CityConfig {
  name: string;
  url?: string;
}

export interface ProvinceConfig {
  name: string;
  cities: CityConfig[];
}

export interface CityGeoJsonData {
  provinceName: string;
  cityName: string;
  geoJson: GeoJsonType;
}

export interface DistrictGeoJsonData {
  provinceName: string;
  cityName: string;
  geoJson: GeoJsonType;
}

interface Props {
  geoJson: GeoJsonType;
  projectionFnParam: ProjectionFnParamType;
  displayConfig: ProvinceConfig[];
  cityGeoJsonData: CityGeoJsonData[];
  districtGeoJsonData: DistrictGeoJsonData[];
  mapType?: "china" | "world"; // 地图类型
}

let lastPick: any = null;

function Map3D(props: Props) {
  const { geoJson, projectionFnParam, displayConfig, cityGeoJsonData, districtGeoJsonData, mapType = "china" } = props;
  const mapRef = useRef<any>();
  const map2dRef = useRef<any>();
  const toolTipRef = useRef<any>();
  const isHoveringTooltipRef = useRef<boolean>(false); // 标记鼠标是否在面板上
  const currentCityDataRef = useRef<any>(null); // 当前显示的地级市数据
  const isPinnedRef = useRef<boolean>(false); // 标记面板是否被固定
  const animationFrameIdRef = useRef<number | null>(null); // 保存动画帧ID，用于清理
  // 使用mapType作为key，分别跟踪每个地图类型的动画状态
  const hasAnimatedRef = useRef<{ [key: string]: boolean }>({});
  // 保存每个地图的相机状态
  const cameraStateRef = useRef<{ 
    [key: string]: { 
      position: THREE.Vector3; 
      zoom: number;
      target: THREE.Vector3;
    } 
  }>({});

  const [toolTipData, setToolTipData] = useState<any>({
    text: "",
    districts: [],
    showPanel: false,
    isCity: false,
  });

  useEffect(() => {
    const currentDom = mapRef.current;
    if (!currentDom) return;

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
      powerPreference: "high-performance", // 优先使用高性能GPU
      stencil: false, // 禁用不需要的功能
      depth: true,
    });
    renderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制像素比，提高性能
    renderer.shadowMap.enabled = false; // 禁用阴影（如果不需要）
    // 防止开发时重复渲染
    // if (!currentDom.hasChildNodes()) {
    //   currentDom.appendChild(renderer.domElement);
    // }
    // 这里修改为下面写法，否则 onresize 不生效
    if (currentDom.childNodes[0]) {
      currentDom.removeChild(currentDom.childNodes[0]);
    }
    currentDom.appendChild(renderer.domElement);

    /**
     * 创建css2 Renderer 渲染器
     */
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0px";
    const labelRendererDom = map2dRef.current;
    if (labelRendererDom?.childNodes[0]) {
      labelRendererDom.removeChild(labelRendererDom.childNodes[0]);
    }
    labelRendererDom.appendChild(labelRenderer.domElement);

    /**
     * 初始化模型（绘制3D模型）
     */
    const { mapObject3D, label2dData } = generateMapObject3D(
      geoJson,
      projectionFnParam,
      displayConfig,
      cityGeoJsonData,
      mapType
    );
    scene.add(mapObject3D);

    // 提前计算 animationKey 和 hasPreviousState，供后续使用
    // 变量名改为 initAnimationKey 和 initHasPreviousState 以避免与其他地方冲突
    const initAnimationKey = `${mapType}-${geoJson.features?.length || 0}`;
    const initHasPreviousState = !!cameraStateRef.current[initAnimationKey];

    /**
     * 动态地图缩放大小
     */
    // 移动到动画逻辑中处理，避免重复声明
    // const animationKey = `${mapType}-${geoJson.features?.length || 0}`;
    // const hasPreviousState = !!cameraStateRef.current[animationKey];
    // const mapScale = getDynamicMapScale(mapObject3D, currentDom, mapType);
    // ...

    /**
     * 绘制 2D 面板 - 只显示地级市标签（不显示省份标签）
     */
    const labelObject2D = generateMapLabel2D(
      label2dData, 
      displayConfig, 
      cityGeoJsonData, 
      projectionFnParam,
      districtGeoJsonData,
      mapType
    );
    if (labelObject2D && labelObject2D.children.length > 0) {
      mapObject3D.add(labelObject2D);
    }

    /**
     * 绘制点位 - 只显示配置中的省份和地级市
     */
    const { spotList, spotObject3D, citySpotList } = generateMapSpot(
      label2dData, 
      displayConfig, 
      cityGeoJsonData, 
      projectionFnParam,
      mapType
    );
    mapObject3D.add(spotObject3D);
    
    // 保存citySpotList到外部作用域，供动画循环使用
    const citySpotListRef = citySpotList || [];

    // Models
    // coneUncompression.glb 是压缩过的模型，需要用dracoLoader加载
    // cone.glb 是未压缩，用 gltfLoader 加载即可

    const modelObject3D = new THREE.Object3D();
    // let mixer: any = null;
    let modelMixer: any = [];
    const loader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    loader.setDRACOLoader(dracoLoader);


    /**
     * 绘制连线
     * 中国地图：所有配置点都连接到福建省宁德市
     * 世界地图：不绘制连线
     */
    const flyObject3D = new THREE.Object3D();
    const flySpotList: any = [];
    
    // 如果没有配置，不绘制任何连线
    if (!displayConfig || displayConfig.length === 0) {
      mapObject3D.add(flyObject3D);
    } else if (mapType === "world") {
      // 世界地图模式：不绘制连线
      mapObject3D.add(flyObject3D);
    } else {
      // 中国地图模式：连接到宁德市
      // 收集所有需要连线的地区坐标
      const allLocationCoords: Array<{ coord: [number, number], name: string }> = [];
      
      // 1. 添加省份坐标
      const displayProvinceNames = displayConfig.map((p: any) => p.name);
      const filteredLabel2dData = label2dData.filter((item: any) => 
        displayProvinceNames.includes(item.featureName)
      );
      filteredLabel2dData.forEach((item: any) => {
        allLocationCoords.push({
          coord: item.featureCenterCoord,
          name: item.featureName
        });
      });
      
      // 2. 添加地级市坐标
      if (cityGeoJsonData && cityGeoJsonData.length > 0) {
        const { center, scale } = projectionFnParam;
        const cityProjectionFn = d3.geoMercator()
          .center(center)
          .scale(scale)
          .translate([0, 0]);
        
        const provinceConfigMap = new Map();
        displayConfig.forEach((config: any) => {
          provinceConfigMap.set(config.name, config);
        });
        
        cityGeoJsonData.forEach((cityData: any) => {
          const provinceName = cityData.provinceName;
          const provinceConfig = provinceConfigMap.get(provinceName);
          
          if (!provinceConfig || !provinceConfig.cities) {
            return;
          }
          
          const cityGeoJson = cityData.geoJson;
          if (!cityGeoJson || !cityGeoJson.features) {
            return;
          }
          
          // 遍历地级市数据，找到匹配的地级市并添加坐标
          provinceConfig.cities.forEach((cityConfig: any) => {
            const cityFeature = cityGeoJson.features.find((f: any) => 
              f.properties.name === cityConfig.name
            );
            
            if (cityFeature && cityFeature.properties.centroid) {
              const cityCoord = cityProjectionFn(cityFeature.properties.centroid);
              if (cityCoord) {
                allLocationCoords.push({
                  coord: cityCoord,
                  name: cityConfig.name
                });
              }
            }
          });
        });
      }
      
      // 3. 查找福建省宁德市的坐标
      let ningdeCoord: [number, number] | null = null;
      
      // 从cityGeoJsonData中查找福建省宁德市
      if (cityGeoJsonData && cityGeoJsonData.length > 0) {
        const { center, scale } = projectionFnParam;
        const cityProjectionFn = d3.geoMercator()
          .center(center)
          .scale(scale)
          .translate([0, 0]);
        
        const fujianCityData = cityGeoJsonData.find((data: any) => data.provinceName === "福建省");
        if (fujianCityData && fujianCityData.geoJson && fujianCityData.geoJson.features) {
          const ningdeFeature = fujianCityData.geoJson.features.find((f: any) => 
            f.properties.name === "宁德市"
          );
          if (ningdeFeature && ningdeFeature.properties.centroid) {
            const coord = cityProjectionFn(ningdeFeature.properties.centroid);
            if (coord) {
              ningdeCoord = coord;
            }
          }
        }
      }
      
      // 如果找不到宁德市，尝试从geoJson中查找福建省的centroid作为备选
      if (!ningdeCoord) {
        const fujianFeature = geoJson.features.find((f: any) => f.properties.name === "福建省");
        if (fujianFeature && fujianFeature.properties.centroid) {
          const { center, scale } = projectionFnParam;
          const projectionFn = d3.geoMercator()
            .center(center)
            .scale(scale)
            .translate([0, 0]);
          const coord = projectionFn(fujianFeature.properties.centroid);
          if (coord) {
            ningdeCoord = coord;
          }
        }
      }
      
      // 4. 如果找到了宁德市坐标，让所有配置点都连接到宁德市
      if (ningdeCoord && allLocationCoords.length > 0) {
        allLocationCoords.forEach((location) => {
          // 跳过宁德市自己
          if (location.name === "宁德市") {
            return;
          }
          
          const { flyLine, flySpot } = drawLineBetween2Spot(
            location.coord,
            ningdeCoord!
          );
          flyObject3D.add(flyLine);
          flyObject3D.add(flySpot);
          flySpotList.push(flySpot);
        });
      }
      
      mapObject3D.add(flyObject3D);
    }

    /**
     * 绘制雷达 - 已移除
     */
    const radarMeshes: THREE.Mesh[] = [];
    // 雷达功能已移除

    /**
     * 初始化控制器 - 禁止旋转
     */
    const controls = new OrbitControls(camera, labelRenderer.domElement);
    controls.enableRotate = false; // 禁止旋转
    controls.enableZoom = true; // 允许缩放
    controls.enablePan = true; // 允许平移
    controls.enableDamping = true; // 开启阻尼，让相机移动更平滑
    controls.dampingFactor = 0.05; // 阻尼系数
    
    // 如果有之前保存的相机状态，立即恢复
    // 使用 initAnimationKey
    if (initHasPreviousState && cameraStateRef.current[initAnimationKey]) {
      const savedState = cameraStateRef.current[initAnimationKey];
      camera.position.copy(savedState.position);
      camera.zoom = savedState.zoom;
      camera.updateProjectionMatrix();
      controls.target.copy(savedState.target);
      controls.update();
    }

    /**
     * 初始化光源 - 使用公共灯光函数
     */
    const { ambientLight, pointLight } = initLights(scene);
    const light = pointLight; // 保持向后兼容，用于 dat.GUI 控制

    // 视窗伸缩
    const onResizeEvent = () => {
      // 更新摄像头
      camera.aspect = currentDom.clientWidth / currentDom.clientHeight;
      // 更新摄像机的投影矩阵
      camera.updateProjectionMatrix();
      // 更新渲染器
      renderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
      labelRenderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
      // 设置渲染器的像素比例 - 限制最大像素比
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    /**
     * 设置 raycaster
     */
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    // 鼠标移入事件 - 性能优化：节流处理
    let mouseMoveThrottle = 0;
    const onMouseMoveEvent = (e: MouseEvent) => {
      // 如果鼠标在面板上，不处理地图交互
      if (isHoveringTooltipRef.current) {
        return;
      }
      
      // 节流：每3帧更新一次鼠标位置（约50ms）
      mouseMoveThrottle++;
      if (mouseMoveThrottle % 3 !== 0) {
        return;
      }
      
      pointer.x = (e.clientX / currentDom.clientWidth) * 2 - 1;
      pointer.y = -(e.clientY / currentDom.clientHeight) * 2 + 1;
      
      // 性能优化：只检测可交互的对象，减少检测范围
      const interactiveObjects: THREE.Object3D[] = [];
      scene.traverse((obj: any) => {
        if (obj.userData.isCity || obj.userData.isChangeColor) {
          interactiveObjects.push(obj);
        }
      });
      const intersects = raycaster.intersectObjects(interactiveObjects, false);

      // 如果存在，则鼠标移出需要重置
      if (lastPick) {
        // 检查是否是地级市圆点或标签
        if (lastPick.object.userData.isCity) {
          // 地级市圆点恢复原色
          if (lastPick.object.material && lastPick.object.material.color) {
            lastPick.object.material.color.set("#FFD700");
          }
        } else if (lastPick.object.userData.isChangeColor) {
          // 省份恢复原色
          const color = mapConfig.mapColorGradient[Math.floor(Math.random() * 4)];
          lastPick.object.material[0].color.set(color);
          lastPick.object.material[0].opacity = mapConfig.mapOpacity;
        }
      }
      lastPick = null;
      
      // 优先检查地级市圆点、标签和标签的父对象
      lastPick = intersects.find(
        (item: any) => {
          // 检查对象本身
          if (item.object.userData.isCity) return true;
          // 检查父对象（标签可能挂载在父对象上）
          if (item.object.parent && item.object.parent.userData && item.object.parent.userData.isCity) {
            return true;
          }
          return false;
        }
      );
      
      // 如果找到的是标签的父对象，使用父对象
      if (lastPick && lastPick.object.parent && lastPick.object.parent.userData && lastPick.object.parent.userData.isCity) {
        lastPick = {
          ...lastPick,
          object: lastPick.object.parent
        };
      }
      
      // 如果没有找到地级市，再检查省份（但省份不显示面板）
      if (!lastPick) {
        lastPick = intersects.find(
          (item: any) => item.object.userData.isChangeColor
        );
      }

      if (lastPick) {
        // 处理地级市悬浮
        if (lastPick.object.userData.isCity) {
          const cityData = lastPick.object.userData;
          if (lastPick.object.material && lastPick.object.material.color) {
            lastPick.object.material.color.set("#FF6B6B"); // 悬浮时变红色
          }

          // 保存当前地级市数据
          currentCityDataRef.current = cityData;

          // 跟随鼠标位置显示面板
          if (toolTipRef.current && toolTipRef.current.style) {
            // 在鼠标位置旁边显示，添加偏移避免遮挡
            const offsetX = 15; // 右侧偏移
            const offsetY = 15; // 下方偏移
            toolTipRef.current.style.left = (e.clientX + offsetX) + "px";
            toolTipRef.current.style.top = (e.clientY + offsetY) + "px";
            toolTipRef.current.style.visibility = "visible";
          }
          
          // 显示地级市信息和市区列表
          setToolTipData({
            text: cityData.cityName,
            isCity: true,
            provinceName: cityData.provinceName || cityData.countryName,
            districts: cityData.districts || [],
            showPanel: true,
            isPinned: false,
            url: cityData.url,
          });
        } else {
          // 处理省份悬浮 - 显示省份名字
          const properties = lastPick.object.parent.customProperties;
          if (lastPick.object.material[0]) {
            lastPick.object.material[0].color.set(mapConfig.mapHoverColor);
            lastPick.object.material[0].opacity = 1;
          }
          
          // 显示省份面板
          if (toolTipRef.current && toolTipRef.current.style) {
            const offsetX = 15;
            const offsetY = 15;
            toolTipRef.current.style.left = (e.clientX + offsetX) + "px";
            toolTipRef.current.style.top = (e.clientY + offsetY) + "px";
            toolTipRef.current.style.visibility = "visible";
          }
          
          setToolTipData({
            text: properties.name,
            isCity: false,
            provinceName: properties.name,
            districts: [],
            showPanel: true, // 省份也显示面板
          });
        }
       } else {
         // 如果鼠标不在面板上，则隐藏
         if (!isHoveringTooltipRef.current) {
           if (toolTipRef.current && toolTipRef.current.style) {
             toolTipRef.current.style.visibility = "hidden";
           }
         }
       }
    };
    
     // 移除点击事件 - 只使用悬浮展开面板

    /**
     * 动画 - 只在首次加载时执行，切换tab时不重新执行
     */
    const animationKey = `${mapType}-${geoJson.features?.length || 0}`;
    const hasPreviousState = !!cameraStateRef.current[animationKey];
    
    // 计算动态缩放大小
    const mapScale = getDynamicMapScale(mapObject3D, currentDom, mapType);
    
    // 如果有之前的状态，直接设置最终缩放值，不执行动画
    if (hasPreviousState) {
      mapObject3D.scale.set(mapScale, mapScale, 1);
    } else {
      // 如果没有之前的状态（首次加载），才执行动画
      if (!hasAnimatedRef.current[animationKey]) {
        mapObject3D.scale.set(0, 0, 0);
        gsap.to(mapObject3D.scale, { x: mapScale, y: mapScale, z: 1, duration: 1 });
        hasAnimatedRef.current[animationKey] = true;
      } else {
        // 如果已经标记为动画过（但没有保存状态），直接设置缩放
        mapObject3D.scale.set(mapScale, mapScale, 1);
      }
    }
    
    // 对于世界地图，计算bounding box并调整位置以居中
    if (mapType === "world") {
      const boundingBox = new THREE.Box3().setFromObject(mapObject3D);
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      // 将地图对象移动到原点，使地图居中
      mapObject3D.position.set(-center.x, -center.y, 0);
    }

    /**
     * Animate - 性能优化版本
     */
    const clock = new THREE.Clock();
    let frameCount = 0;
    const animate = function () {
      frameCount++;
      const delta = clock.getDelta();
      
      // Update mixer - 只在有动画时更新
      if (modelMixer.length > 0) {
        modelMixer.forEach((mixer: any) => mixer.update(delta));
      }

      // 雷达功能已移除
      
      // 更新控制器（如果开启了阻尼）
      if (controls.enableDamping) {
        controls.update();
      }

      // 性能优化：减少raycaster更新频率（每3帧更新一次）
      if (frameCount % 3 === 0) {
        raycaster.setFromCamera(pointer, camera);
      }

      // 渲染场景 - 只在需要时渲染
      renderer.render(scene, camera);
      // CSS2D渲染器只在有标签时渲染
      if (labelObject2D && labelObject2D.children.length > 0) {
        labelRenderer.render(scene, camera);
      }

      // 省份圆环动画 - 批量处理，减少循环开销
      if (spotList.length > 0) {
        spotList.forEach((mesh: any) => {
          mesh._s += 0.01;
          if (mesh._s <= 2) {
            mesh.scale.setScalar(mesh._s); // 使用setScalar代替三个参数
            mesh.material.opacity = 2 - mesh._s;
          } else {
            mesh._s = 1;
            mesh.scale.setScalar(1);
            mesh.material.opacity = 1;
          }
        });
      }
      
      // 地级市圆环动画 - 更明显的闪烁效果
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

      // 飞行的圆点 - 优化：减少向量创建
      if (flySpotList.length > 0) {
        const tempPosition = new THREE.Vector3(); // 复用向量对象
        flySpotList.forEach(function (mesh: any) {
          mesh._s += 0.003;
          mesh.curve.getPointAt(mesh._s % 1, tempPosition); // 使用第二个参数避免创建新对象
          mesh.position.copy(tempPosition);
        });
      }

      animationFrameIdRef.current = requestAnimationFrame(animate);
    };
    animationFrameIdRef.current = requestAnimationFrame(animate);

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
        // 实时更新所有地图mesh颜色
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
        // 修正类型，将颜色字符串转为number
        mapConfig.topLineColor = parseInt(value.replace("#", ""), 16);
        mapObject3D.traverse((obj: any) => {
          if (obj.type === "Line2" && obj.material) {
            obj.material.color.set(value);
          }
        });
      });

    // 光强度调节
    const lightConfig = { intensity: light.intensity };
    gui
      .add(lightConfig, "intensity", 0, 5)
      .name("光强度")
      .onChange((v: number) => {
        light.intensity = v;
      });

    return () => {
      // 保存相机状态，以便下次切换回来时恢复
      const cameraKey = `${mapType}-${geoJson.features?.length || 0}`;
      cameraStateRef.current[cameraKey] = {
        position: camera.position.clone(),
        zoom: camera.zoom,
        target: controls.target.clone(),
      };
      
      // 清理动画帧
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      
      // 清理事件监听器
      window.removeEventListener("resize", onResizeEvent);
      window.removeEventListener("mousemove", onMouseMoveEvent);
      
      // 清理GUI
      gui.destroy();
      
      // 清理雷达网格 - 已移除雷达功能
      // radarMeshes.forEach((mesh: any) => {
      //   if (mesh.geometry) mesh.geometry.dispose();
      //   if (mesh.material) mesh.material.dispose();
      //   scene.remove(mesh);
      // });
      
      // 清理几何体和材质
      scene.traverse((object: any) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
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
      
      // 清理渲染器
      renderer.dispose();
      labelRenderer.domElement.remove();
    };
  }, [geoJson]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
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
           // 鼠标移出面板时隐藏
           if (toolTipRef.current && toolTipRef.current.style) {
             toolTipRef.current.style.visibility = "hidden";
           }
         }}
       ></ToolTip>
    </div>
  );
}

export default Map3D;

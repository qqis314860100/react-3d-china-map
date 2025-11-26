import * as THREE from "three";
import * as d3 from "d3";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";

import {
  GeoJsonType,
  GeoJsonFeature,
  GeometryCoordinates,
  GeometryType,
  ExtendObject3D,
} from "./typed";
import { ProjectionFnParamType } from ".";
import { mapConfig } from "./mapConfig";

export function getDynamicMapScale(
  mapObject3D: THREE.Object3D,
  containerRef: any
) {
  // const width = containerRef.offsetWidth;
  // const height = containerRef.offsetHeight;
  const width = containerRef.clientWidth;
  const height = containerRef.clientHeight;
  const refArea = width * height;

  const boundingBox = new THREE.Box3().setFromObject(mapObject3D);
  // 获取包围盒的尺寸
  const size = new THREE.Vector3();
  boundingBox.getSize(size);
  // 新增 Math.random避免缩放为1，没有动画效果
  const scale =
    Math.round(Math.sqrt(refArea / (size.x * size.y * 400))) +
    parseFloat((Math.random() + 0.5).toFixed(2));
  return scale;
}

// 绘制挤出的材质
export function drawExtrudeMesh(
  point: [number, number][],
  projectionFn: any
): any {
  const shape = new THREE.Shape();
  const pointsArray = [];

  for (let i = 0; i < point.length; i++) {
    const [x, y]: any = projectionFn(point[i]); // 将每一个经纬度转化为坐标点
    if (i === 0) {
      shape.moveTo(x, -y);
    }
    shape.lineTo(x, -y);
    pointsArray.push(x, -y, mapConfig.topLineZIndex);
  }

  // 性能优化：使用更少的段数，减少顶点数
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: mapConfig.mapDepth, // 挤出的形状深度
    bevelEnabled: false, // 对挤出的形状应用是否斜角
    curveSegments: 8, // 减少曲线段数（默认12），提高性能
  });

  // 性能优化：使用更简单的材质，减少计算
  const material = new THREE.MeshLambertMaterial({
    color: mapConfig.mapColorGradient[Math.floor(Math.random() * 4)], // 随机颜色
    transparent: mapConfig.mapTransparent,
    opacity: mapConfig.mapOpacity,
  });

  const materialSide = new THREE.ShaderMaterial({
    uniforms: {
      color1: {
        value: new THREE.Color(mapConfig.mapSideColor1),
      },
      color2: {
        value: new THREE.Color(mapConfig.mapSideColor2),
      },
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 color1;
      uniform vec3 color2;
      varying vec3 vPosition;
      void main() {
        vec3 mixColor = mix(color1, color2, 0.5 - vPosition.z * 0.2); // 使用顶点坐标 z 分量来控制混合
        gl_FragColor = vec4(mixColor, 1.0);
      }
    `,
    //   wireframe: true,
  });

  const mesh: any = new THREE.Mesh(geometry, [material, materialSide]);
  // userData 存储自定义属性
  mesh.userData = {
    isChangeColor: true,
  };

  // 边框线，赋值空间点坐标，3个一组
  const lineGeometry = new LineGeometry();
  lineGeometry.setPositions(pointsArray);

  const lineMaterial = new LineMaterial({
    color: mapConfig.topLineColor,
    linewidth: mapConfig.topLineWidth,
  });
  lineMaterial.resolution.set(window.innerWidth, window.innerHeight);
  const line = new Line2(lineGeometry, lineMaterial);

  return { mesh, line };
}

// 生成地图3D模型
export function generateMapObject3D(
  mapdata: GeoJsonType,
  projectionFnParam: ProjectionFnParamType,
  displayConfig?: any[],
  cityGeoJsonData?: any[]
) {
  // 地图对象
  const mapObject3D = new THREE.Object3D();
  // 地图数据
  const { features: basicFeatures } = mapdata;

  const { center, scale } = projectionFnParam;

  const projectionFn = d3
    .geoMercator()
    .center(center)
    .scale(scale)
    .translate([0, 0]);

  const label2dData: any = []; // 存储自定义 2d 标签数据
  
  // 获取需要显示的省份名称列表
  const displayProvinceNames = displayConfig ? displayConfig.map((p: any) => p.name) : [];
  
  // 移除调试日志，提高性能

  // 每个省的数据
  basicFeatures.forEach((basicFeatureItem: GeoJsonFeature) => {
    // 每个省份的地图对象
    const provinceMapObject3D = new THREE.Object3D() as ExtendObject3D;
    // 将地图数据挂在到模型数据上
    provinceMapObject3D.customProperties = basicFeatureItem.properties;

    // 每个坐标类型
    const featureType = basicFeatureItem.geometry.type;
    // 每个坐标数组
    const featureCoords: GeometryCoordinates<GeometryType> =
      basicFeatureItem.geometry.coordinates;
    // 每个中心点位置
    const featureCenterCoord: any =
      basicFeatureItem.properties.centroid &&
      projectionFn(basicFeatureItem.properties.centroid);
    // 名字
    const featureName: string = basicFeatureItem.properties.name;

    if (featureCenterCoord) {
      label2dData.push({
        featureCenterCoord,
        featureName,
      });
    }
    
    // 如果有配置且当前省份不在配置中，跳过绘制（但保留label2dData用于后续过滤）
    // 仍然绘制所有省份的地图，但只有配置的省份有标记和动画

    // MultiPolygon 类型
    if (featureType === "MultiPolygon") {
      featureCoords.forEach((multiPolygon: [number, number][][]) => {
        multiPolygon.forEach((polygon: [number, number][]) => {
          const { mesh, line } = drawExtrudeMesh(polygon, projectionFn);
          provinceMapObject3D.add(mesh);
          provinceMapObject3D.add(line);
        });
      });
    }

    // Polygon 类型
    if (featureType === "Polygon") {
      featureCoords.forEach((polygon: [number, number][]) => {
        const { mesh, line } = drawExtrudeMesh(polygon, projectionFn);
        provinceMapObject3D.add(mesh);
        provinceMapObject3D.add(line);
      });
    }

    mapObject3D.add(provinceMapObject3D);
  });

  return { mapObject3D, label2dData };
}

// 生成地图2D标签 - 只显示地级市标签（不显示省份标签）
export function generateMapLabel2D(
  label2dData: any, 
  displayConfig?: any[], 
  cityGeoJsonData?: any[],
  projectionFnParam?: ProjectionFnParamType,
  districtGeoJsonData?: any[]
) {
  const labelObject2D = new THREE.Object3D();
  
  // 如果没有配置，不显示任何标签
  if (!displayConfig || displayConfig.length === 0) {
    return labelObject2D;
  }
  
  const displayProvinceNames = displayConfig.map((p: any) => p.name);
  
  // 创建省份名称到配置的映射
  const provinceConfigMap = new Map();
  displayConfig.forEach((config: any) => {
    provinceConfigMap.set(config.name, config);
  });
  
  // 创建地级市数据映射：省份名 -> 地级市GeoJson数据
  const cityDataMap = new Map();
  if (cityGeoJsonData) {
    cityGeoJsonData.forEach((data: any) => {
      cityDataMap.set(data.provinceName, data.geoJson);
    });
  }
  
  // 创建投影函数用于地级市坐标转换
  let cityProjectionFn: any = null;
  if (projectionFnParam) {
    const { center, scale } = projectionFnParam;
    cityProjectionFn = d3.geoMercator()
      .center(center)
      .scale(scale)
      .translate([0, 0]);
  }
  
  let labelCount = 0;
  
  // 不显示省份标签，只显示地级市标签
  
  // 显示地级市标签（使用真实坐标）
  if (cityGeoJsonData && cityProjectionFn) {
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
      
      // 遍历地级市数据，找到匹配的地级市
      provinceConfig.cities.forEach((cityConfig: any) => {
        const cityFeature = cityGeoJson.features.find((f: any) => 
          f.properties.name === cityConfig.name
        );
        
        if (cityFeature && cityFeature.properties.centroid) {
          const cityCoord = cityProjectionFn(cityFeature.properties.centroid);
          if (cityCoord) {
            // 获取该地级市的市区列表
            const districts = cityConfig.districts || [];
            
            const cityLabelItem = draw2dLabel(cityCoord, cityConfig.name, true);
            if (cityLabelItem) {
              // 存储地级市信息到userData，包括市区列表
              cityLabelItem.userData = {
                isCity: true,
                cityName: cityConfig.name,
                provinceName: provinceName,
                districts: districts, // 市区列表
              };
              labelObject2D.add(cityLabelItem);
              labelCount++;
            }
          }
        }
      });
    });
  }
  
  return labelObject2D;
}

// 生成地图spot点位 - 只显示配置中的省份和地级市（使用真实坐标）
export function generateMapSpot(
  label2dData: any, 
  displayConfig?: any[], 
  cityGeoJsonData?: any[],
  projectionFnParam?: ProjectionFnParamType
) {
  const spotObject3D = new THREE.Object3D();
  const spotList: any = [];
  const citySpotList: any = [];
  
  // 如果没有配置，不显示任何圆点
  if (!displayConfig || displayConfig.length === 0) {
    return { spotObject3D, spotList, citySpotList };
  }
  
  const displayProvinceNames = displayConfig.map((p: any) => p.name);
  
  // 不显示省份圆点（center标签）- 只显示地级市圆点
  
  // 显示地级市圆点（使用真实坐标）
  if (cityGeoJsonData && projectionFnParam) {
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
      
      // 遍历地级市数据，找到匹配的地级市并添加圆点
      provinceConfig.cities.forEach((cityConfig: any) => {
        const cityFeature = cityGeoJson.features.find((f: any) => 
          f.properties.name === cityConfig.name
        );
        
        if (cityFeature && cityFeature.properties.centroid) {
          const cityCoord = cityProjectionFn(cityFeature.properties.centroid);
          if (cityCoord) {
            // 为地级市创建圆点和圆环（使用不同的颜色区分）
            const districts = cityConfig.districts || [];
            const citySpotItem = drawCitySpot(cityCoord);
            if (citySpotItem && citySpotItem.circle && citySpotItem.ring) {
              // 存储地级市信息，包括市区列表
              const cityUserData = {
                isCity: true,
                cityName: cityConfig.name,
                provinceName: provinceName,
                districts: districts, // 市区列表
              };
              
              // 为所有元素添加用户数据
              citySpotItem.circle.userData = cityUserData;
              citySpotItem.ring.userData = cityUserData;
              if (citySpotItem.innerGlow) {
                citySpotItem.innerGlow.userData = cityUserData;
              }
              if (citySpotItem.outerGlow) {
                citySpotItem.outerGlow.userData = cityUserData;
              }
              
              // 添加到场景
              spotObject3D.add(citySpotItem.circle);
              spotObject3D.add(citySpotItem.ring);
              if (citySpotItem.innerGlow) {
                spotObject3D.add(citySpotItem.innerGlow);
              }
              if (citySpotItem.outerGlow) {
                spotObject3D.add(citySpotItem.outerGlow);
              }
              citySpotList.push(citySpotItem.ring);
            }
          }
        }
      });
    });
  }
  
  return { spotObject3D, spotList, citySpotList };
}

// 绘制地级市圆点（使用不同颜色，更明显好看）
export const drawCitySpot = (coord: [number, number]) => {
  if (coord && coord.length) {
    /**
     * 绘制圆点 - 地级市使用更明显的金色，更大尺寸
     */
    const spotGeometry = new THREE.CircleGeometry(0.25, 32); // 性能优化：减少段数
    const spotMaterial = new THREE.MeshBasicMaterial({
      color: "#FFD700", // 金色
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const circle = new THREE.Mesh(spotGeometry, spotMaterial);
    circle.position.set(coord[0], -coord[1], mapConfig.spotZIndex);
    
    // 添加发光效果 - 内圈
    const innerGlowGeometry = new THREE.CircleGeometry(0.2, 32); // 性能优化：减少段数
    const innerGlowMaterial = new THREE.MeshBasicMaterial({
      color: "#FFFF00", // 亮黄色
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
    innerGlow.position.set(coord[0], -coord[1], mapConfig.spotZIndex + 0.01);

    // 圆环 - 地级市使用更明显的颜色和更大尺寸
    const ringGeometry = new THREE.RingGeometry(0.25, 0.4, 32); // 性能优化：减少段数
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: "#FFD700", // 金色，更亮
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.set(coord[0], -coord[1], mapConfig.spotZIndex);
    
    // 添加外圈发光效果
    const outerGlowGeometry = new THREE.RingGeometry(0.4, 0.5, 32); // 性能优化：减少段数
    const outerGlowMaterial = new THREE.MeshBasicMaterial({
      color: "#FFA500", // 橙色
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
    });
    const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
    outerGlow.position.set(coord[0], -coord[1], mapConfig.spotZIndex - 0.01);
    
    return { circle, ring, innerGlow, outerGlow };
  }
};

// 绘制二维标签
export const draw2dLabel = (coord: [number, number], proviceName: string, isCity: boolean = false) => {
  if (coord && coord.length && coord[0] !== undefined && coord[1] !== undefined) {
    // 地级市标签样式 - 明显且与省份区别开
    const labelStyle = isCity 
      ? `
        color: #FFD700;
        font-size: 13px;
        font-weight: bold;
        text-shadow: 
          0 0 6px rgba(255, 215, 0, 0.8),
          0 0 10px rgba(255, 215, 0, 0.6),
          0 2px 4px rgba(0, 0, 0, 0.9);
        white-space: nowrap;
      ` 
      : "color: #fff; font-size: 14px; font-weight: bold; text-shadow: 0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7); background: rgba(0,0,0,0.4); padding: 3px 8px; border-radius: 4px;";
    const innerHTML = `<div class="map-label" style="${labelStyle}">${proviceName}</div>`;
    const labelDiv = document.createElement("div");
    labelDiv.innerHTML = innerHTML;
    labelDiv.style.pointerEvents = "none"; // 禁用事件，否则tooltip悬浮在当前div会导致失去事件追踪
    labelDiv.style.userSelect = "none"; // 禁止选择文本
    
    const labelObject = new CSS2DObject(labelDiv);
    labelObject.position.set(coord[0], -coord[1], mapConfig.label2dZIndex);
    
    // 确保标签可见
    labelObject.visible = true;
    
    return labelObject;
  }
  return null;
};

// 绘制圆点
export const drawSpot = (coord: [number, number]) => {
  if (coord && coord.length) {
    /**
     * 绘制圆点 - 性能优化：减少段数
     */
    const spotGeometry = new THREE.CircleGeometry(0.2, 32); // 从200减少到32，足够平滑
    const spotMaterial = new THREE.MeshBasicMaterial({
      color: "#3EC5FB",
      side: THREE.DoubleSide,
    });
    const circle = new THREE.Mesh(spotGeometry, spotMaterial);
    circle.position.set(coord[0], -coord[1], mapConfig.spotZIndex);

    // 圆环 - 性能优化：减少段数
    const ringGeometry = new THREE.RingGeometry(0.2, 0.3, 32); // 从50减少到32
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: "#3FC5FB",
      side: THREE.DoubleSide,
      transparent: true,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.position.set(coord[0], -coord[1], mapConfig.spotZIndex);
    return { circle, ring };
  }
};

/**
 * 线上移动物体
 */
export const drawflySpot = (curve: any) => {
  const aGeo = new THREE.SphereGeometry(0.2);
  const aMater = new THREE.MeshBasicMaterial({
    color: "#77f077",
    side: THREE.DoubleSide,
  });
  const aMesh: any = new THREE.Mesh(aGeo, aMater);
  // 保存曲线实例
  aMesh.curve = curve;
  aMesh._s = 0;
  return aMesh;
};

// 绘制两点链接飞线
export const drawLineBetween2Spot = (
  coordStart: [number, number],
  coordEnd: [number, number]
) => {
  const [x0, y0, z0] = [...coordStart, mapConfig.spotZIndex];
  const [x1, y1, z1] = [...coordEnd, mapConfig.spotZIndex];
  // 使用 QuadraticBezierCurve3 创建 三维二次贝塞尔曲线
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(x0, -y0, z0),
    new THREE.Vector3((x0 + x1) / 2, -(y0 + y1) / 2, 20),
    new THREE.Vector3(x1, -y1, z1)
  );

  const flySpot = drawflySpot(curve);

  const lineGeometry = new THREE.BufferGeometry();
  // 性能优化：减少曲线点数
  const points = curve.getPoints(30); // 从50减少到30，足够平滑
  const positions = [];
  const colors = [];
  const color = new THREE.Color();

  // 给每个顶点设置演示 实现渐变
  for (let j = 0; j < points.length; j++) {
    color.setHSL(0.21 + j, 0.77, 0.55 + j * 0.0025); // 色
    colors.push(color.r, color.g, color.b);
    positions.push(points[j].x, points[j].y, points[j].z);
  }
  // 放入顶点 和 设置顶点颜色
  lineGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(positions), 3, true)
  );
  lineGeometry.setAttribute(
    "color",
    new THREE.BufferAttribute(new Float32Array(colors), 3, true)
  );

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    // color: "red",
    side: THREE.DoubleSide,
  });
  const flyLine = new THREE.Line(lineGeometry, material);

  return { flyLine, flySpot };
};

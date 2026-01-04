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

// ===== 首都标识（北京） =====
const BEIJING_LNGLAT: [number, number] = [116.4074, 39.9042];

function createFivePointStarShape(
  outerRadius: number,
  innerRadius: number,
  points: number = 5
) {
  const shape = new THREE.Shape();
  const step = Math.PI / points;
  const start = -Math.PI / 2; // 顶部开始

  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const a = start + i * step;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createCapitalMarker(mapType: "china" | "world" = "china") {
  // 中国地图单位下：城市圆点半径 0.25，因此星星做大一些更醒目
  const outer = mapType === "china" ? 0.45 : 1.2;
  const inner = mapType === "china" ? 0.2 : 0.52;

  const starShape = createFivePointStarShape(outer, inner, 5);
  const geo = new THREE.ShapeGeometry(starShape);

  // 白色描边（底层稍大）
  const border = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  border.scale.setScalar(1.12);

  // 红色五角星
  const star = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: "#ff2d2d",
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );

  const group = new THREE.Object3D();
  group.add(border);
  group.add(star);

  // 不参与拾取（避免增加交互 CPU）
  group.traverse((o: any) => {
    o.userData = { ...(o.userData || {}), isCapital: true };
  });

  return group;
}

// 获取地图的动态缩放值
export function getDynamicMapScale(
  mapObject3D: THREE.Object3D,
  containerRef: any,
  mapType: "china" | "world" = "china"
) {
  const width = containerRef.clientWidth;
  const height = containerRef.clientHeight;
  const refArea = width * height;

  const boundingBox = new THREE.Box3().setFromObject(mapObject3D);
  // 获取包围盒的尺寸
  const size = new THREE.Vector3();
  boundingBox.getSize(size);

  // scaleFactor 数值越大，地图越小
  // 世界地图需要更大的 scaleFactor 才能完整显示
  const scaleFactor = mapType === "world" ? 500 : 400;

  const scale =
    Math.round(Math.sqrt(refArea / (size.x * size.y * scaleFactor))) +
    parseFloat((Math.random() + 0.5).toFixed(2));

  // 确保缩放值在合理范围内
  if (mapType === "world") {
    return Math.max(0.5, Math.min(scale, 1.2));
  }

  return scale;
}

// 中国配色（与世界主色调接近的蓝色系）
// 让中国地图更接近世界地图观感：更“暗”的蓝 + 更深侧面
const CHINA_COLOR_THEME = {
  base: "#356AA5",
  side1: "#244A7A",
  side2: "#1B365A",
};

// 绘制挤出的材质
export function drawExtrudeMesh(
  point: [number, number][],
  projectionFn: any,
  color?: string,
  mapType: "china" | "world" = "china"
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

  // 性能优化：根据模式调整段数。低配模式设为 1 (直线化)，大幅减少顶点。
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: mapConfig.mapDepth, // 挤出的形状深度
    bevelEnabled: false, // 对挤出的形状应用是否斜角
    curveSegments: mapConfig.performanceMode === 'low' ? 1 : 2, 
  });

  const material = new THREE.MeshLambertMaterial({
    color: mapConfig.mapColor,
    transparent: mapConfig.mapTransparent,
    opacity: mapConfig.mapOpacity,
  });

  // 性能优化：低配模式下侧面使用纯色 Lambert 材质，避免 ShaderMaterial 计算开销
  const materialSide = mapConfig.performanceMode === 'low' 
    ? new THREE.MeshLambertMaterial({
        color: mapType === "china" ? CHINA_COLOR_THEME.side1 : mapConfig.mapSideColor1,
        transparent: mapConfig.mapTransparent,
        opacity: mapConfig.mapOpacity,
      })
    : new THREE.ShaderMaterial({
        uniforms: {
          color1: {
            value: new THREE.Color(mapType === "china" ? CHINA_COLOR_THEME.side1 : mapConfig.mapSideColor1),
          },
          color2: {
            value: new THREE.Color(mapType === "china" ? CHINA_COLOR_THEME.side2 : mapConfig.mapSideColor2),
          },
          opacity: {
            value: mapConfig.mapOpacity,
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
          uniform float opacity;
          varying vec3 vPosition;
          void main() {
            vec3 mixColor = mix(color1, color2, 0.5 - vPosition.z * 0.2); // 使用顶点坐标 z 分量来控制混合
            gl_FragColor = vec4(mixColor, opacity);
          }
        `,
        transparent: mapConfig.mapTransparent,
      });

  const mesh: any = new THREE.Mesh(geometry, [material, materialSide]);
  // userData 存储自定义属性，保存原始颜色用于恢复
  mesh.userData = {
    isChangeColor: true,
    originalColor: mapConfig.mapColor, // 保存原始颜色
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
export function generateMapObject3D(
  mapdata: GeoJsonType,
  projectionFnParam: ProjectionFnParamType,
  displayConfig?: any[],
  mapType: "china" | "world" = "china"
) {
  // 地图对象
  const mapObject3D = new THREE.Object3D();
  // 地图数据
  const { features: basicFeatures } = mapdata;

  const { center, scale } = projectionFnParam;

  // 创建投影函数
  // 对于世界地图，使用translate来确保居中显示
  const projectionFn = d3
    .geoMercator()
    .center(center)
    .scale(scale)
    .translate(mapType === "world" ? [0, 0] : [0, 0]); // 世界地图和中国地图都使用[0,0]作为初始translate

  const label2dData: any = []; // 存储自定义 2d 标签数据

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

    // MultiPolygon 类型 多个多边形（如带飞地的行政区） 三维数组 [[[lng,lat]]]

    if (featureType === "MultiPolygon") {
      featureCoords.forEach((multiPolygon: [number, number][][]) => {
        multiPolygon.forEach((polygon: [number, number][]) => {
          const { mesh, line } = drawExtrudeMesh(
            polygon,
            projectionFn,
            mapConfig.mapColor
          );
          provinceMapObject3D.add(mesh);
          provinceMapObject3D.add(line);
        });
      });
    }

    // Polygon 类型 单个连续的多边形（如圆形区域） 二维数组 [[lng,lat]]
    if (featureType === "Polygon") {
      featureCoords.forEach((polygon: [number, number][]) => {
        const { mesh, line } = drawExtrudeMesh(
          polygon,
          projectionFn,
          mapConfig.mapColor
        );
        provinceMapObject3D.add(mesh);
        provinceMapObject3D.add(line);
      });
    }

    mapObject3D.add(provinceMapObject3D);
  });

  return { mapObject3D, label2dData };
}

interface CityLabelData {
  coord: [number, number];
  cityName: string;
  parentName: string; // provinceName or countryName
  url?: string;
  districts?: any[];
}

function prepareCityData(
  displayConfig: any[],
  projectionFnParam: ProjectionFnParamType,
  mapType: "china" | "world"
): CityLabelData[] {
  const cityDataList: CityLabelData[] = [];
  const { center, scale } = projectionFnParam;
  const projectionFn = d3
    .geoMercator()
    .center(center)
    .scale(scale)
    .translate([0, 0]);

  displayConfig.forEach((parentConfig: any) => {
    if (parentConfig.cities && parentConfig.cities.length > 0) {
      parentConfig.cities.forEach((cityConfig: any) => {
        if (cityConfig.coordinates) {
          const cityCoord = projectionFn(cityConfig.coordinates);
          if (cityCoord) {
            cityDataList.push({
              coord: cityCoord,
              cityName: cityConfig.name,
              parentName: parentConfig.name,
              url: cityConfig.url,
              districts: cityConfig.districts || [],
            });
          }
        }
      });
    }
  });

  return cityDataList;
}

// 生成地图2D标签 - 只显示城市标签（统一逻辑，简化版）
export function generateMapLabel2D(
  label2dData: any,
  displayConfig?: any[],
  projectionFnParam?: ProjectionFnParamType,
  mapType: "china" | "world" = "china"
) {
  const labelObject2D = new THREE.Object3D();

  // 如果没有配置或投影参数，不显示任何标签
  if (!displayConfig || displayConfig.length === 0 || !projectionFnParam) {
    return labelObject2D;
  }

  // 准备统一格式的城市数据（只使用配置中的坐标）
  const cityDataList = prepareCityData(
    displayConfig,
    projectionFnParam,
    mapType
  );

  // 使用统一逻辑创建标签（传递 mapType 以使用正确的样式）
  cityDataList.forEach((cityData) => {
    const cityLabelItem = draw2dLabel(
      cityData.coord,
      cityData.cityName,
      true,
      mapType
    );
    if (cityLabelItem) {
      cityLabelItem.userData = {
        isCity: true,
        cityName: cityData.cityName,
        ...(mapType === "world"
          ? { countryName: cityData.parentName }
          : { provinceName: cityData.parentName }),
        url: cityData.url,
        districts: cityData.districts,
      };
      labelObject2D.add(cityLabelItem);
    }
  });

  return labelObject2D;
}

// 生成地图spot点位 - 只显示城市圆点（统一逻辑，简化版）
export function generateMapSpot(
  label2dData: any,
  displayConfig?: any[],
  projectionFnParam?: ProjectionFnParamType,
  mapType: "china" | "world" = "china"
) {
  const spotObject3D = new THREE.Object3D();
  const spotList: any = [];
  const citySpotList: any = [];

  // 如果没有配置或投影参数，不显示任何圆点
  if (!displayConfig || displayConfig.length === 0 || !projectionFnParam) {
    return { spotObject3D, spotList, citySpotList };
  }

  // 准备统一格式的城市数据（只使用配置中的坐标）
  const cityDataList = prepareCityData(
    displayConfig,
    projectionFnParam,
    mapType
  );

  // 中国地图：额外加“首都北京”标识（红色五角星）
  if (mapType === "china" && projectionFnParam) {
    const { center, scale } = projectionFnParam;
    const projectionFn = d3
      .geoMercator()
      .center(center)
      .scale(scale)
      .translate([0, 0]);
    const coord = projectionFn(BEIJING_LNGLAT);
    if (coord) {
      const capital = createCapitalMarker(mapType);
      capital.position.set(coord[0], -coord[1], mapConfig.spotZIndex + 0.08);
      spotObject3D.add(capital);
    }
  }

  // 使用统一逻辑创建圆点（传递 mapType 以使用正确的尺寸）
  cityDataList.forEach((cityData) => {
    const citySpotItem = drawCitySpot(cityData.coord, mapType);
    if (citySpotItem && citySpotItem.circle && citySpotItem.ring) {
      const config = CITY_SPOT_CONFIG[mapType];
      const cityUserData = {
        isCity: true,
        cityName: cityData.cityName,
        ...(mapType === "world"
          ? { countryName: cityData.parentName }
          : { provinceName: cityData.parentName }),
        url: cityData.url,
        districts: cityData.districts,
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

      // 额外增加一个“透明拾取热区”，让城市名/黄点附近更容易触发基地列表
      const hitGeometry = new THREE.CircleGeometry(config.hitRadius, 24);
      const hitMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const hit = new THREE.Mesh(hitGeometry, hitMaterial);
      hit.position.set(cityData.coord[0], -cityData.coord[1], mapConfig.spotZIndex + 0.02);
      // 只让 hit 参与拾取（raycast），并把 hover 目标指向可见的 circle（用于变色）
      hit.userData = {
        ...cityUserData,
        isCity: true,
        isCityPick: true,
        hoverMesh: citySpotItem.circle,
      };

      // 添加到场景
      spotObject3D.add(citySpotItem.circle);
      spotObject3D.add(citySpotItem.ring);
      if (citySpotItem.innerGlow) {
        spotObject3D.add(citySpotItem.innerGlow);
      }
      if (citySpotItem.outerGlow) {
        spotObject3D.add(citySpotItem.outerGlow);
      }
      spotObject3D.add(hit);
      citySpotList.push(citySpotItem.ring);
    }
  });

  return { spotObject3D, spotList, citySpotList };
}

// 城市圆点配置（公共配置）
export const CITY_SPOT_CONFIG = {
  china: {
    circleRadius: 0.25,
    innerGlowRadius: 0.2,
    ringInnerRadius: 0.25,
    ringOuterRadius: 0.5, // 增大外圆环
    outerGlowInnerRadius: 0.5,
    outerGlowOuterRadius: 0.7, // 增大光环
    // 用于“更容易悬浮/点击”的拾取热区（透明，不影响视觉）
    hitRadius: 1.2,
  },
  world: {
    // 世界地图的圆点需要更大，因为地图整体缩放更小
    circleRadius: 1.0,
    innerGlowRadius: 0.8,
    ringInnerRadius: 1.0,
    ringOuterRadius: 2.0, // 增大外圆环
    outerGlowInnerRadius: 2.0,
    outerGlowOuterRadius: 2.8, // 增大光环
    hitRadius: 4.2,
  },
};

// 绘制地级市/城市圆点（统一逻辑，支持不同地图类型）
// 性能优化：共享常用几何体和材质，减少内存分配和 GPU 切换开销
const sharedGeometries = {
  cityCircle: new THREE.CircleGeometry(0.25, 16),
  cityInnerGlow: new THREE.CircleGeometry(0.2, 16),
  cityRing: new THREE.RingGeometry(0.25, 0.5, 16),
  cityOuterGlow: new THREE.RingGeometry(0.4, 0.7, 16),
  citySpotWorld: new THREE.CircleGeometry(0.12, 16),
  cityRingWorld: new THREE.RingGeometry(0.12, 0.35, 16),
};

const sharedMaterials = {
  citySpot: new THREE.MeshBasicMaterial({
    color: mapConfig.spot.glowMaterialColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9,
  }),
  cityInnerGlow: new THREE.MeshBasicMaterial({
    color: mapConfig.spot.innerGlowMaterialColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.6,
  }),
  cityRing: new THREE.MeshBasicMaterial({
    color: mapConfig.spot.ringMaterialColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  }),
  cityOuterGlow: new THREE.MeshBasicMaterial({
    color: mapConfig.spot.outerGlowMaterialColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.4,
  }),
};

// 绘制城市光点（统一逻辑，支持国内/海外不同尺寸）
export const drawCitySpot = (
  coord: [number, number],
  mapType: "china" | "world" = "china"
) => {
  if (coord && coord.length) {
    const isChina = mapType === "china";
    
    // 基础圆点
    const circle = new THREE.Mesh(
      isChina ? sharedGeometries.cityCircle : sharedGeometries.citySpotWorld,
      sharedMaterials.citySpot
    );
    circle.position.set(coord[0], -coord[1], mapConfig.spotZIndex);

    // 内圈发光
    const innerGlow = new THREE.Mesh(
      sharedGeometries.cityInnerGlow,
      sharedMaterials.cityInnerGlow
    );
    innerGlow.position.set(coord[0], -coord[1], mapConfig.spotZIndex + 0.01);

    // 动态圆环
    const ring = new THREE.Mesh(
      isChina ? sharedGeometries.cityRing : sharedGeometries.cityRingWorld,
      sharedMaterials.cityRing
    );
    ring.position.set(coord[0], -coord[1], mapConfig.spotZIndex);

    // 外圈发光（仅国内显示，增强视觉）
    let outerGlow = null;
    if (isChina) {
      outerGlow = new THREE.Mesh(
        sharedGeometries.cityOuterGlow,
        sharedMaterials.cityOuterGlow
      );
      outerGlow.position.set(coord[0], -coord[1], mapConfig.spotZIndex - 0.01);
    }

    return { circle, ring, innerGlow, outerGlow };
  }
};

// 标签样式配置（公共配置）
export const LABEL_STYLE_CONFIG = {
  china: {
    fontSize: 15, // 字体稍小
    color: mapConfig.fontColor,
  },
  world: {
    fontSize: 14, // 世界地图标签稍小一点
    color: "#FFD700",
  },
};

// 绘制二维标签（统一逻辑，支持不同地图类型）
export const draw2dLabel = (
  coord: [number, number],
  proviceName: string,
  isCity: boolean = false,
  mapType: "china" | "world" = "china"
) => {
  if (
    coord &&
    coord.length &&
    coord[0] !== undefined &&
    coord[1] !== undefined
  ) {
    const styleConfig = LABEL_STYLE_CONFIG[mapType];

    // 城市标签样式 - 明显且与省份区别开
    const labelStyle = isCity
      ? `
        color: ${styleConfig.color};
        font-size: ${styleConfig.fontSize}px;
        font-weight: bold;
        transform: translateY(-16px); /* 城市名抬高一点，离黄色标记远点 */
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
    // 允许标签参与 pointer 事件：用于“悬浮城市文字也能显示基地列表”
    //（事件会冒泡到 labelRenderer.domElement，不会影响 OrbitControls）
    labelDiv.style.pointerEvents = "auto";
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

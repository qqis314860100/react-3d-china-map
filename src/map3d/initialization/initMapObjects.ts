import * as THREE from "three";
import * as d3 from "d3";
import {
  generateMapObject3D,
  generateMapLabel2D,
  generateMapSpot,
  drawLineBetween2Spot,
  getDynamicMapScale,
} from "../drawFunc";
import { GeoJsonType } from "../typed";
import { ProjectionFnParamType, ProvinceConfig } from "../types";
import gsap from "gsap";

/**
 * 初始化地图对象（3D模型、标签、点位）
 */
export const initMapObjects = (
  geoJson: GeoJsonType,
  projectionFnParam: ProjectionFnParamType,
  displayConfig: ProvinceConfig[],
  mapType: "china" | "world"
) => {
  // 生成3D地图对象
  const { mapObject3D, label2dData } = generateMapObject3D(
    geoJson,
    projectionFnParam,
    displayConfig,
    mapType
  );

  // 生成2D标签
  const labelObject2D = generateMapLabel2D(
    label2dData,
    displayConfig,
    projectionFnParam,
    mapType
  );
  if (labelObject2D && labelObject2D.children.length > 0) {
    mapObject3D.add(labelObject2D);
  }

  // 生成点位
  const { spotList, spotObject3D, citySpotList } = generateMapSpot(
    label2dData,
    displayConfig,
    projectionFnParam,
    mapType
  );
  mapObject3D.add(spotObject3D);

  return {
    mapObject3D,
    label2dData,
    labelObject2D,
    spotList,
    spotObject3D,
    citySpotList: citySpotList || [],
  };
};

/**
 * 初始化连线（仅中国地图）
 */
export const initFlyLines = (
  displayConfig: ProvinceConfig[],
  projectionFnParam: ProjectionFnParamType,
  mapType: "china" | "world"
) => {
  const flyObject3D = new THREE.Object3D();
  const flySpotList: any = [];

  if (!displayConfig || displayConfig.length === 0 || mapType === "world") {
    return { flyObject3D, flySpotList };
  }

  const { center, scale } = projectionFnParam;
  const projectionFn = d3
    .geoMercator()
    .center(center)
    .scale(scale)
    .translate([0, 0]);

  // 查找宁德市坐标
  let ningdeCoord: [number, number] | null = null;
  displayConfig.forEach((provinceConfig: any) => {
    if (provinceConfig.name === "福建省" && provinceConfig.cities) {
      const ningdeCity = provinceConfig.cities.find(
        (city: any) => city.name === "宁德市"
      );
      if (ningdeCity && ningdeCity.coordinates) {
        const coord = projectionFn(ningdeCity.coordinates);
        if (coord) {
          ningdeCoord = coord;
        }
      }
    }
  });

  // 绘制连线
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

  return { flyObject3D, flySpotList };
};

/**
 * 应用地图缩放动画
 */
export const applyMapScaleAnimation = (
  mapObject3D: THREE.Object3D,
  currentDom: HTMLElement,
  mapType: "china" | "world",
  animationKey: string,
  hasAnimatedRef: React.MutableRefObject<{ [key: string]: boolean }>,
  hasPreviousState: boolean
) => {
  const mapScale = getDynamicMapScale(mapObject3D, currentDom, mapType);

  if (hasPreviousState) {
    mapObject3D.scale.set(mapScale, mapScale, 1);
  } else {
    if (!hasAnimatedRef.current[animationKey]) {
      mapObject3D.scale.set(0, 0, 0);
      gsap.to(mapObject3D.scale, { x: mapScale, y: mapScale, z: 1, duration: 1 });
      hasAnimatedRef.current[animationKey] = true;
    } else {
      mapObject3D.scale.set(mapScale, mapScale, 1);
    }
  }

  // 世界地图居中处理
  if (mapType === "world") {
    const boundingBox = new THREE.Box3().setFromObject(mapObject3D);
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    mapObject3D.position.set(-center.x, -center.y, 0);
  }
};


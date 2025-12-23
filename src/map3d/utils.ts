// 工具函数文件

import { GeoJsonType } from "./typed";

/**
 * 过滤 GeoJSON 数据，移除极地区域（南极和北极）
 * @param geoJsonData 原始 GeoJSON 数据
 * @returns 过滤后的 GeoJSON 数据
 */
export function filterPolarRegions(geoJsonData: any): GeoJsonType | null {
  if (!geoJsonData || geoJsonData.type !== "FeatureCollection") {
    return null;
  }

  const filteredFeatures = geoJsonData.features.filter((feature: any) => {
    if (!feature.geometry || !feature.geometry.coordinates) {
      return false;
    }

    try {
      const coordinates = feature.geometry.coordinates;
      let maxLat = -90;
      let minLat = 90;
      let hasValidCoords = false;

      // 递归检查坐标
      const checkCoordinates = (coords: any, depth: number = 0): void => {
        if (!Array.isArray(coords)) return;

        if (depth > 10) return; // 防止无限递归

        if (
          coords.length >= 2 &&
          typeof coords[0] === "number" &&
          typeof coords[1] === "number"
        ) {
          // 这是一个坐标点 [lng, lat]
          const lat = coords[1];
          const lng = coords[0];

          // 验证坐标有效性
          if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            maxLat = Math.max(maxLat, lat);
            minLat = Math.min(minLat, lat);
            hasValidCoords = true;
          }
        } else {
          // 这是一个嵌套数组，继续递归
          coords.forEach((coord: any) => checkCoordinates(coord, depth + 1));
        }
      };

      checkCoordinates(coordinates);

      // 排除南极（纬度 < -60）和北极（纬度 > 85），但保留有有效坐标的feature
      if (!hasValidCoords) return false;
      return minLat > -60 && maxLat < 85;
    } catch (e) {
      console.warn("过滤feature时出错:", e);
      return false;
    }
  });

  return {
    type: "FeatureCollection",
    features: filteredFeatures,
  };
}

/**
 * 恢复对象原始颜色
 * @param object Three.js 对象
 * @param defaultColors 默认颜色数组（用于没有保存原始颜色的情况）
 * @param opacity 不透明度
 */
export function restoreObjectColor(
  object: any,
  defaultColors: string,
  opacity: number = 0.9
): void {
  if (!object || !object.material) return;

  const originalColor = object.userData?.originalColor;
  if (originalColor && object.material[0]) {
    object.material[0].color.set(originalColor);
    object.material[0].opacity = opacity;
  } else if (object.material[0]) {
    object.material[0].color.set(defaultColors);
    object.material[0].opacity = opacity;
  }
}

/**
 * 设置 Tooltip 位置
 * @param tooltipElement Tooltip DOM 元素
 * @param mouseX 鼠标 X 坐标
 * @param mouseY 鼠标 Y 坐标
 * @param offsetX X 偏移量
 * @param offsetY Y 偏移量
 */
export function setTooltipPosition(
  tooltipElement: any,
  mouseX: number,
  mouseY: number,
  offsetX: number = 15,
  offsetY: number = 15
): void {
  if (tooltipElement && tooltipElement.style) {
    tooltipElement.style.left = mouseX + offsetX + "px";
    tooltipElement.style.top = mouseY + offsetY + "px";
    tooltipElement.style.visibility = "visible";
  }
}

/**
 * 隐藏 Tooltip
 * @param tooltipElement Tooltip DOM 元素
 */
export function hideTooltip(tooltipElement: any): void {
  if (tooltipElement && tooltipElement.style) {
    tooltipElement.style.visibility = "hidden";
  }
}

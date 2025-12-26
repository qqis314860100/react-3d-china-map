// 鼠标事件处理器

import * as THREE from "three";
import { mapConfig } from "./mapConfig";
import { COLORS, UI_CONSTANTS } from "./constants";
import { restoreObjectColor, setTooltipPosition, hideTooltip } from "./utils";
import { TooltipData } from "./types";

/**
 * 查找被拾取的对象
 * @param intersects Raycaster 相交结果
 * @returns 被拾取的对象，优先返回城市对象，其次返回省份/国家对象
 */
export function findPickedObject(intersects: THREE.Intersection[]): any {
  // 优先检查地级市圆点、标签和标签的父对象
  let picked = intersects.find((item: any) => {
    // 检查对象本身
    if (item.object.userData.isCity) return true;
    // 检查父对象（标签可能挂载在父对象上）
    if (item.object.parent && item.object.parent.userData && item.object.parent.userData.isCity) {
      return true;
    }
    return false;
  });
  
  // 如果找到的是标签的父对象，使用父对象
  if (picked && picked.object.parent && picked.object.parent.userData && picked.object.parent.userData.isCity) {
    picked = {
      ...picked,
      object: picked.object.parent
    };
  }
  
  // 如果没有找到地级市，再检查省份/国家
  if (!picked) {
    picked = intersects.find(
      (item: any) => item.object.userData.isChangeColor
    );
  }

  return picked;
}

/**
 * 恢复对象颜色到原始状态
 * @param pickedObject 被拾取的对象
 */
export function restorePickedObjectColor(pickedObject: any): void {
  if (!pickedObject) return;
  
  // 检查是否是地级市圆点或标签
  if (pickedObject.object.userData.isCity) {
    const hoverMesh = pickedObject.object.userData?.hoverMesh;
    const target = hoverMesh?.material?.color ? hoverMesh : pickedObject.object;
    // 地级市圆点恢复原色
    if (target.material && target.material.color) {
      target.material.color.set(COLORS.CITY_DEFAULT);
    }
  } else if (pickedObject.object.userData.isChangeColor) {
    // 省份/国家恢复原色
    restoreObjectColor(
      pickedObject.object,
      mapConfig.mapColor,
      mapConfig.mapOpacity
    );
  }
}

/**
 * 应用悬浮高亮效果
 * @param pickedObject 被拾取的对象
 * @param mouseEvent 鼠标事件
 * @param tooltipRef Tooltip 引用
 * @param setTooltipData 设置 Tooltip 数据的函数
 * @param currentCityDataRef 当前城市数据引用
 */
export function applyHoverEffect(
  pickedObject: any,
  mouseEvent: MouseEvent,
  containerRect: DOMRect | null,
  tooltipRef: any,
  setTooltipData: (data: TooltipData) => void,
  currentCityDataRef: React.MutableRefObject<any>
): void {
  if (!pickedObject) return;

  // Tooltip 改为 position:absolute 后，这里必须用“相对容器”的坐标定位
  const baseX = containerRect ? mouseEvent.clientX - containerRect.left : mouseEvent.clientX;
  const baseY = containerRect ? mouseEvent.clientY - containerRect.top : mouseEvent.clientY;
  
  // 处理城市悬浮
  if (pickedObject.object.userData.isCity) {
    const cityData = pickedObject.object.userData;
    
    // 设置悬浮颜色
    const hoverMesh = pickedObject.object.userData?.hoverMesh;
    const target = hoverMesh?.material?.color ? hoverMesh : pickedObject.object;
    if (target.material && target.material.color) {
      target.material.color.set(COLORS.CITY_HOVER);
    }

    // 保存当前城市数据
    currentCityDataRef.current = cityData;

    // 设置 Tooltip 位置
    setTooltipPosition(
      tooltipRef.current,
      baseX,
      baseY,
      UI_CONSTANTS.TOOLTIP_OFFSET_X,
      UI_CONSTANTS.TOOLTIP_OFFSET_Y
    );
    
    // 显示城市信息
    setTooltipData({
      text: cityData.cityName,
      isCity: true,
      provinceName: cityData.provinceName || cityData.countryName,
      districts: cityData.districts || [],
      showPanel: true,
      isPinned: false,
      url: cityData.url,
    });
  } else {
    // 处理省份/国家悬浮
    const properties = pickedObject.object.parent.customProperties;
    
    // 设置悬浮颜色
    if (pickedObject.object.material[0]) {
      pickedObject.object.material[0].color.set(mapConfig.mapHoverColor);
      pickedObject.object.material[0].opacity = 1;
    }
    
    // 设置 Tooltip 位置
    setTooltipPosition(
      tooltipRef.current,
      baseX,
      baseY,
      UI_CONSTANTS.TOOLTIP_OFFSET_X,
      UI_CONSTANTS.TOOLTIP_OFFSET_Y
    );
    
    // 显示省份/国家信息
    setTooltipData({
      text: properties.name,
      isCity: false,
      provinceName: properties.name,
      districts: [],
      showPanel: true,
    });
  }
}

/**
 * 处理鼠标移出地图对象
 * @param tooltipRef Tooltip 引用
 * @param isHoveringTooltip 是否正在悬浮在 Tooltip 上
 */
export function handleMouseLeaveMap(
  tooltipRef: any,
  isHoveringTooltip: boolean
): void {
  if (!isHoveringTooltip) {
    hideTooltip(tooltipRef.current);
  }
}


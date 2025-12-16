import * as THREE from "three";
import * as d3 from "d3";

/**
 * 初始化场景灯光
 * 使用环境光 + 点光源的组合，提供更好的光照效果
 * @param scene Three.js 场景对象
 * @returns 返回灯光对象数组，可用于后续控制
 */
export function initLights(scene: THREE.Scene): {
  ambientLight: THREE.AmbientLight;
  worldPointLight: THREE.PointLight;
  chinaPointLight: THREE.PointLight;
} {
  /**
   * 环境光 - 提供基础照明，避免完全黑暗的区域
   */
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 白色环境光，强度0.6
  scene.add(ambientLight);

  /**
   * 点光源 - 提供主要照明和阴影效果
   */
  const worldPointLight = new THREE.PointLight(0xffffff, 1.5);
  worldPointLight.position.set(0, -5, 35);
  // scene.add(worldPointLight);

  const chinaPointLight = new THREE.PointLight(0xffffff, 1.5);
  const projectedCoordinates = projectionFn(ningdeCoordinates);
  if (projectedCoordinates) {
    const [x, y] = projectedCoordinates;
    console.log(x, y);
    chinaPointLight.position.set(x, y, 50);
  } else {
    // 处理投影失败的情况，例如设置默认位置
    chinaPointLight.position.set(0, 0, 50);
  }
  return {
    ambientLight,
    worldPointLight,
    chinaPointLight,
  };
}

// 设置投影参数
const projectionFnParam = {
  center: [105, 35],
  scale: 1500,
  translate: [0, 0],
} as any;

// 使用投影参数创建投影函数
const projectionFn = d3
  .geoMercator()
  .center(projectionFnParam.center)
  .scale(projectionFnParam.scale)
  .translate(projectionFnParam.translate);

// 宁德的地理坐标
const ningdeCoordinates: [number, number] = [119.5115, 26.6663];

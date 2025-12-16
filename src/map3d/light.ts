import * as THREE from "three";

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

  const chinaPointLight = new THREE.PointLight(0xffffff, 1.5);
  // 中国地图的点光源位置由 Map3D 按当前投影/配置（如宁德坐标）来设置
  // 这里给一个合理默认值，避免未设置时黑屏
  chinaPointLight.position.set(0, 0, 50);
  return {
    ambientLight,
    worldPointLight,
    chinaPointLight,
  };
}

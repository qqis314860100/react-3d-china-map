import * as THREE from "three";

/**
 * 初始化场景灯光
 * 使用环境光 + 点光源的组合，提供更好的光照效果
 * @param scene Three.js 场景对象
 * @returns 返回灯光对象数组，可用于后续控制
 */
export function initLights(scene: THREE.Scene): {
  ambientLight: THREE.AmbientLight;
  pointLight: THREE.PointLight;
} {
  /**
   * 环境光 - 提供基础照明，避免完全黑暗的区域
   */
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // 白色环境光，强度0.6
  scene.add(ambientLight);

  /**
   * 点光源 - 提供主要照明和阴影效果
   */
  const pointLight = new THREE.PointLight(0xffffff, 1.5);
  pointLight.position.set(0, -5, 30);
  scene.add(pointLight);

  return {
    ambientLight,
    pointLight,
  };
}


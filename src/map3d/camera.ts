import * as THREE from "three";

export function initCamera(currentDom: HTMLElement, mapType: "china" | "world" = "china") {
  /**
   * 摄像机
   */
  const camera = new THREE.PerspectiveCamera(
    35, // 视野角度
    currentDom.clientWidth / currentDom.clientHeight,
    0.1,
    5000 // 增加far plane，防止地图在缩放时消失
  );
  /** 摆放相机的位置 - 根据地图类型调整距离，确保能看到全貌 */
  const zPosition = mapType === "world" ? 800 : 180; // 世界地图拉远一些，确保全景
  camera.position.set(0, 0, zPosition);
  camera.lookAt(0, 0, 0); // 相机看向地图中心

  /**
   * 设置CameraHelper
   */
  const cameraHelper = new THREE.CameraHelper(camera);

  return { camera, cameraHelper };
}

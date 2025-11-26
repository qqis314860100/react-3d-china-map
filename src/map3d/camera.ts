import * as THREE from "three";

export function initCamera(currentDom: HTMLElement) {
  /**
   * 摄像机
   */
  const camera = new THREE.PerspectiveCamera(
    30, //45
    currentDom.clientWidth / currentDom.clientHeight,
    0.1,
    1000
  );
  /** 摆放相机的位置 - 摆正地图 */
  camera.position.set(0, 0, 130); // 从正上方观看，摆正地图
  camera.lookAt(0, 0, 0); // 相机看向地图中心

  /**
   * 设置CameraHelper
   */
  const cameraHelper = new THREE.CameraHelper(camera);

  return { camera, cameraHelper };
}

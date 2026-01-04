import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ANIMATION_CONSTANTS } from "../constants";

/**
 * 创建优化的动画循环
 */
export const createAnimationLoop = (
  renderer: THREE.WebGLRenderer,
  labelRenderer: any,
  scene: THREE.Scene,
  camera: THREE.Camera,
  controls: OrbitControls,
  raycaster: THREE.Raycaster,
  pointer: THREE.Vector2,
  labelObject2D: THREE.Object3D | null,
  spotList: any[],
  citySpotList: any[],
  flySpotList: any[],
  modelMixer: any[]
) => {
  const clock = new THREE.Clock();
  let frameCount = 0;
  const tempPosition = new THREE.Vector3(); // 复用向量对象

  const animate = function () {
    frameCount++;
    const delta = clock.getDelta();

    // 更新模型动画
    if (modelMixer.length > 0) {
      modelMixer.forEach((mixer: any) => mixer.update(delta));
    }

    // 更新控制器
    if (controls.enableDamping) {
      controls.update();
    }

    // 减少raycaster更新频率
    if (frameCount % 3 === 0) {
      raycaster.setFromCamera(pointer, camera);
    }

    // 渲染场景
    renderer.render(scene, camera);
    if (labelObject2D && labelObject2D.children.length > 0) {
      labelRenderer.render(scene, camera);
    }

    // 省份圆环动画
    if (spotList.length > 0) {
      spotList.forEach((mesh: any) => {
        mesh._s += 0.01;
        if (mesh._s <= 2) {
          mesh.scale.setScalar(mesh._s);
          mesh.material.opacity = 2 - mesh._s;
        } else {
          mesh._s = 1;
          mesh.scale.setScalar(1);
          mesh.material.opacity = 1;
        }
      });
    }

    // 城市圆环动画
    if (citySpotList.length > 0) {
      citySpotList.forEach((mesh: any) => {
        if (!mesh._s) mesh._s = 1;
        mesh._s += 0.015;
        if (mesh._s <= 2.5) {
          mesh.scale.setScalar(mesh._s);
          mesh.material.opacity = 2.5 - mesh._s;
        } else {
          mesh._s = 1;
          mesh.scale.setScalar(1);
          mesh.material.opacity = 1;
        }
      });
    }

    // 飞行的圆点
    if (flySpotList.length > 0) {
      flySpotList.forEach(function (mesh: any) {
        mesh._s += ANIMATION_CONSTANTS.FLY_SPOT_SPEED;
        mesh.curve.getPointAt(mesh._s % 1, tempPosition);
        mesh.position.copy(tempPosition);
      });
    }

    return requestAnimationFrame(animate);
  };

  return animate;
};


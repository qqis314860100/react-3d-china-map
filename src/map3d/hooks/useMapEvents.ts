import { useCallback, useRef } from "react";
import * as THREE from "three";
import { UI_CONSTANTS } from "../constants";
import {
  findPickedObject,
  restorePickedObjectColor,
  applyHoverEffect,
} from "../mouseHandler";
import { hideTooltip } from "../utils";

/**
 * 管理地图的鼠标事件
 */
export const useMapEvents = (
  scene: THREE.Scene | null,
  camera: THREE.Camera | null,
  mapRef: React.RefObject<any>,
  toolTipRef: React.RefObject<any>,
  isHoveringTooltipRef: React.RefObject<boolean>,
  currentCityDataRef: React.RefObject<any>,
  setToolTipData: (data: any) => void
) => {
  const lastPickRef = useRef<any>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const mouseMoveThrottleRef = useRef(0);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!scene || !camera || !mapRef.current) return;
      if (isHoveringTooltipRef.current) return;

      mouseMoveThrottleRef.current++;
      if (mouseMoveThrottleRef.current % UI_CONSTANTS.MOUSE_MOVE_THROTTLE !== 0) {
        return;
      }

      const currentDom = mapRef.current;
      // 关键：用“相对地图容器”的坐标换算，侧栏/头部/边距存在时才不会拾取错位
      const rect = currentDom.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      const nx = (relX / rect.width) * 2 - 1;
      const ny = -(relY / rect.height) * 2 + 1;
      pointerRef.current.x = Math.max(-1, Math.min(1, nx));
      pointerRef.current.y = Math.max(-1, Math.min(1, ny));

      const interactiveObjects: THREE.Object3D[] = [];
      scene.traverse((obj: any) => {
        if (obj.userData.isCity || obj.userData.isChangeColor) {
          interactiveObjects.push(obj);
        }
      });

      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(
        interactiveObjects,
        false
      );

      if (lastPickRef.current) {
        restorePickedObjectColor(lastPickRef.current);
      }

      lastPickRef.current = findPickedObject(intersects);

      if (lastPickRef.current) {
        applyHoverEffect(
          lastPickRef.current,
          e,
          rect,
          toolTipRef,
          setToolTipData,
          currentCityDataRef
        );
      } else {
        if (!isHoveringTooltipRef.current) {
          hideTooltip(toolTipRef.current);
        }
      }
    },
    [scene, camera, mapRef, toolTipRef, isHoveringTooltipRef, currentCityDataRef, setToolTipData]
  );

  const onResize = useCallback(
    (
      renderer: THREE.WebGLRenderer,
      labelRenderer: any,
      camera: THREE.PerspectiveCamera
    ) => {
      return () => {
        if (!mapRef.current) return;
        const currentDom = mapRef.current;

        camera.aspect = currentDom.clientWidth / currentDom.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
        labelRenderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      };
    },
    [mapRef]
  );

  return {
    onMouseMove,
    onResize,
    raycasterRef,
    pointerRef,
    lastPickRef,
  };
};


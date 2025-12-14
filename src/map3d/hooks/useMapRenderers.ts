import { useEffect, useRef } from "react";
import * as THREE from "three";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer";

/**
 * 初始化并管理渲染器
 */
export const useMapRenderers = (
  mapRef: React.RefObject<any>,
  map2dRef: React.RefObject<any>
) => {
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);

  const initRenderers = () => {
    const currentDom = mapRef.current;
    if (!currentDom) return null;

    // WebGL 渲染器
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
    });
    renderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;

    if (currentDom.childNodes[0]) {
      currentDom.removeChild(currentDom.childNodes[0]);
    }
    currentDom.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // CSS2D 渲染器
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(currentDom.clientWidth, currentDom.clientHeight);
    labelRenderer.domElement.style.position = "absolute";
    labelRenderer.domElement.style.top = "0px";

    const labelRendererDom = map2dRef.current;
    if (labelRendererDom?.childNodes[0]) {
      labelRendererDom.removeChild(labelRendererDom.childNodes[0]);
    }
    labelRendererDom.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

    return { renderer, labelRenderer };
  };

  const cleanupRenderers = () => {
    if (rendererRef.current) {
      rendererRef.current.dispose();
    }
    if (labelRendererRef.current) {
      labelRendererRef.current.domElement.remove();
    }
  };

  return {
    initRenderers,
    cleanupRenderers,
    rendererRef,
    labelRendererRef,
  };
};


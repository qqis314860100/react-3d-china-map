import { useRef, useState } from "react";
import * as THREE from "three";
import { TooltipData } from "../types";

/**
 * 管理地图相关的状态
 */
export const useMapState = () => {
  const mapRef = useRef<any>();
  const map2dRef = useRef<any>();
  const toolTipRef = useRef<any>();
  const isHoveringTooltipRef = useRef<boolean>(false);
  const currentCityDataRef = useRef<any>(null);
  const isPinnedRef = useRef<boolean>(false);
  const animationFrameIdRef = useRef<number | null>(null);
  const hasAnimatedRef = useRef<{ [key: string]: boolean }>({});
  
  const cameraStateRef = useRef<{
    [key: string]: {
      position: THREE.Vector3;
      zoom: number;
      target: THREE.Vector3;
    };
  }>({});

  const [toolTipData, setToolTipData] = useState<TooltipData>({
    text: "",
    districts: [],
    showPanel: false,
    isCity: false,
  });

  return {
    mapRef,
    map2dRef,
    toolTipRef,
    isHoveringTooltipRef,
    currentCityDataRef,
    isPinnedRef,
    animationFrameIdRef,
    hasAnimatedRef,
    cameraStateRef,
    toolTipData,
    setToolTipData,
  };
};


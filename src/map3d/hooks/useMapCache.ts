import { useRef, useCallback } from "react";
import * as THREE from "three";

/**
 * 管理地图缓存，避免重复初始化
 */
export const useMapCache = () => {
  // 缓存已初始化的地图场景
  const mapCacheRef = useRef<{
    [key: string]: {
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      renderer: THREE.WebGLRenderer;
      labelRenderer: any;
      controls: any;
      animationFrameId: number | null;
      cleanup: () => void;
      isInitialized: boolean;
    };
  }>({});

  /**
   * 检查是否已缓存
   */
  const hasCached = useCallback((key: string) => {
    return mapCacheRef.current[key]?.isInitialized === true;
  }, []);

  /**
   * 获取缓存
   */
  const getCache = useCallback((key: string) => {
    return mapCacheRef.current[key];
  }, []);

  /**
   * 设置缓存
   */
  const setCache = useCallback((key: string, cache: any) => {
    mapCacheRef.current[key] = cache;
  }, []);

  /**
   * 清除特定缓存
   */
  const clearCache = useCallback((key: string) => {
    if (mapCacheRef.current[key]) {
      const cache = mapCacheRef.current[key];
      if (cache.cleanup) {
        cache.cleanup();
      }
      delete mapCacheRef.current[key];
    }
  }, []);

  /**
   * 清除所有缓存
   */
  const clearAllCache = useCallback(() => {
    Object.keys(mapCacheRef.current).forEach((key) => {
      clearCache(key);
    });
  }, [clearCache]);

  return {
    hasCached,
    getCache,
    setCache,
    clearCache,
    clearAllCache,
  };
};


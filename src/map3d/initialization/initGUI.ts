import * as dat from "dat.gui";
import * as THREE from "three";
import { mapConfig } from "../mapConfig";

/**
 * 初始化 dat.GUI 控制面板
 */
export const initGUI = (
  mapObject3D: THREE.Object3D,
  light: THREE.PointLight
) => {
  const gui = new dat.GUI();
  gui.width = 300;

  const colorConfig = {
    mapColor: mapConfig.mapColor,
    mapHoverColor: mapConfig.mapHoverColor,
    mapSideColor1: mapConfig.mapSideColor1,
    mapSideColor2: mapConfig.mapSideColor2,
    topLineColor:
      typeof mapConfig.topLineColor === "number"
        ? `#${mapConfig.topLineColor.toString(16)}`
        : mapConfig.topLineColor,
  };

  // 地图颜色
  gui
    .addColor(colorConfig, "mapColor")
    .name("地图颜色")
    .onChange((value: string) => {
      mapConfig.mapColor = value;
      mapObject3D.traverse((obj: any) => {
        if (obj.material && obj.material[0] && obj.userData.isChangeColor) {
          obj.material[0].color.set(value);
        }
      });
    });

  // Hover颜色
  gui
    .addColor(colorConfig, "mapHoverColor")
    .name("地图Hover颜色")
    .onChange((value: string) => {
      mapConfig.mapHoverColor = value;
    });

  // 侧面渐变色1
  gui
    .addColor(colorConfig, "mapSideColor1")
    .name("侧面渐变1")
    .onChange((value: string) => {
      mapConfig.mapSideColor1 = value;
      mapObject3D.traverse((obj: any) => {
        if (
          obj.material &&
          obj.material[1] &&
          obj.material[1].uniforms &&
          obj.material[1].uniforms.color1
        ) {
          obj.material[1].uniforms.color1.value.set(value);
        }
      });
    });

  // 侧面渐变色2
  gui
    .addColor(colorConfig, "mapSideColor2")
    .name("侧面渐变2")
    .onChange((value: string) => {
      mapConfig.mapSideColor2 = value;
      mapObject3D.traverse((obj: any) => {
        if (
          obj.material &&
          obj.material[1] &&
          obj.material[1].uniforms &&
          obj.material[1].uniforms.color2
        ) {
          obj.material[1].uniforms.color2.value.set(value);
        }
      });
    });

  // 顶线颜色
  gui
    .addColor(colorConfig, "topLineColor")
    .name("顶线颜色")
    .onChange((value: string) => {
      mapConfig.topLineColor = parseInt(value.replace("#", ""), 16);
      mapObject3D.traverse((obj: any) => {
        if (obj.type === "Line2" && obj.material) {
          obj.material.color.set(value);
        }
      });
    });

  // 光强度
  const lightConfig = { intensity: light.intensity };
  gui
    .add(lightConfig, "intensity", 0, 5)
    .name("光强度")
    .onChange((v: number) => {
      light.intensity = v;
    });

  return gui;
};


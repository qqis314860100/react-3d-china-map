// 统一的类型定义文件

import { GeoJsonType } from "./typed";

// ==================== 投影相关 ====================
export type ProjectionFnParamType = {
  center: [number, number];
  scale: number;
};

// ==================== 配置相关 ====================
// 区级配置
export interface DistrictConfig {
  name: string;
  url?: string; // 区级链接
}

// 城市配置
export interface CityConfig {
  name: string;
  adcode?: number; // 城市的adcode（中国地图）
  coordinates?: [number, number]; // 城市坐标（世界地图）
  url?: string;
  districts?: DistrictConfig[]; // 区级列表
  country?: string; // 所属国家（世界地图）
}

// 省份/国家配置
export interface ProvinceConfig {
  name: string;
  adcode?: number; // 省份的adcode（中国地图）
  cities: CityConfig[];
}

// ==================== GeoJSON 数据相关 ====================
// 城市 GeoJSON 数据
export interface CityGeoJsonData {
  provinceName: string;
  cityName: string;
  geoJson: GeoJsonType;
}

// 区级 GeoJSON 数据
export interface DistrictGeoJsonData {
  provinceName: string;
  cityName: string;
  geoJson: GeoJsonType;
}

// ==================== 事件处理相关 ====================
// Tooltip 数据
export interface TooltipData {
  text: string;
  districts: DistrictConfig[];
  showPanel: boolean;
  isCity: boolean;
  provinceName?: string;
  isPinned?: boolean;
  url?: string;
}


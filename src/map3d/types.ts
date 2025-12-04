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

// 城市配置（统一格式，中国地图和世界地图都使用）
export interface CityConfig {
  name: string;
  coordinates: [number, number]; // 城市坐标（经度，纬度）- 必填
  url?: string;
  districts?: DistrictConfig[]; // 区级列表（可选，用于显示详情）
}

// 省份/国家配置（统一格式）
export interface ProvinceConfig {
  name: string;
  cities: CityConfig[];
}

// ==================== GeoJSON 数据相关 ====================
// 注：cityGeoJsonData 和 districtGeoJsonData 已废弃，改用静态配置

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


import { ProvinceConfig } from "./types";

const Depth = 6;

// ==================== 地图配置 ====================
export const mapConfig = {
  // 地图挤出厚度
  mapDepth: Depth,
  // 地图透明度
  mapTransparent: false,
  mapOpacity: 1,
  // 地图颜色
  mapColor: "#4A90E2", // 默认浅杏色（标准地图常用底色）
  mapHoverColor: "#85b1e4", // Hover时显示金色

  // 地图侧面渐变 - 配合浅色表面，侧面使用稍深的同色系或中性色
  mapSideColor1: "#CFB997", // 深杏色
  mapSideColor2: "#8FBC8F", // 深豆绿（作为混合）
  // 上面的line
  topLineColor: 0x888888, // 深灰色线条，更像标准地图的边界线
  topLineWidth: 2, // 线条稍微细一点
  topLineZIndex: Depth + 0.5,
  // label 2d高度
  label2dZIndex: Depth + 2,
  // spot
  spotZIndex: Depth + 0.2,
  fontSize: 15,
  fontColor: "rgba(87, 74, 1, 1)",

  spot: {
    glowMaterialColor: "#FFD700",
    outerGlowMaterialColor: "#FFA500",
    innerGlowMaterialColor: "#FFFF00",
    ringMaterialColor: "#FFD700",
  },
};

// ==================== 世界地图配置 ====================
// 世界城市配置接口
export interface WorldCityConfig {
  name: string;
  country: string;
  coordinates: [number, number]; // [经度, 纬度]
  url?: string;
  districts?: any[]; // 区级数据（可选）
}

// 世界国家配置接口
export interface WorldCountryConfig {
  name: string;
  cities: WorldCityConfig[];
}

// 示例世界城市配置
export const WORLD_DISPLAY_CONFIG: WorldCountryConfig[] = [
  {
    name: "匈牙利(Hungary)",
    cities: [
      {
        name: "德布勒森(Debrecen)",
        country: "匈牙利(Hungary)",
        coordinates: [21.6267, 47.5334],
        url: "https://example.com/newyork",
      },
    ],
  },
  {
    name: "德国(Germany)",
    cities: [
      {
        name: "阿恩施塔特(Arnstadt)",
        country: "德国(Germany)",
        coordinates: [10.9464, 50.8534],
        url: "https://example.com/london",
      },
    ],
  },
  {
    name: "西班牙(Spain)",
    cities: [
      {
        name: "萨拉戈萨(Zaragoza)",
        country: "西班牙(Spain)",
        coordinates: [-0.8891, 41.6488],
        url: "https://example.com/tokyo",
      },
    ],
  },
  {
    name: "美国(America)",
    cities: [
      {
        name: "斯帕克斯(Sparks)",
        country: "美国(America)",
        coordinates: [-119.7505, 39.5349],
        url: "https://example.com/paris",
      },
    ],
  },
  {
    name: "印度尼西亚(Indonesia)",
    cities: [
      {
        name: "卡拉旺(Karawang)",
        country: "印度尼西亚(Indonesia)",
        coordinates: [107.3378, -6.3189],
        url: "https://example.com/berlin",
      },
    ],
  },
];

// 中国地图城市配置（只需要配置城市名称和经纬度）
export const DISPLAY_CONFIG: ProvinceConfig[] = [
  {
    name: "福建省",
    cities: [
      {
        name: "宁德市",
        coordinates: [119.527, 26.666], // 需要替换实际经纬度
        districts: [
          { name: "JC基地", url: "http://10.145.196.171:8888/#/factoryview" },
          { name: "HZ基地", url: "http://172.18.40.188:8888/#/factoryview" },
          { name: "FD基地", url: "http://10.167.198.58:8888/#/factoryview" },
        ],
      },
      {
        name: "厦门市",
        coordinates: [118.089, 24.48], // 需要替换实际经纬度
        districts: [
          { name: "XM基地", url: "http://10.196.201.228:8888/#/factoryview" },
        ],
      },
    ],
  },
  {
    name: "河南省",
    cities: [
      {
        name: "洛阳市",
        coordinates: [112.454, 34.624], // 需要替换实际经纬度
        districts: [
          { name: "LJ基地", url: "http://10.51.201.84:8888/#/factoryview" },
        ],
      },
    ],
  },
  {
    name: "四川省",
    cities: [
      {
        name: "宜宾市",
        coordinates: [104.643, 28.752], // 需要替换实际经纬度
        districts: [
          { name: "SJ基地", url: "http://10.103.201.33:8888/#/factoryview" },
        ],
      },
    ],
  },
  {
    name: "江苏省",
    cities: [
      {
        name: "常州市",
        coordinates: [119.975, 31.815], // 需要替换实际经纬度
        districts: [
          { name: "LY基地", url: "http://172.21.29.135/#/factoryview" },
        ],
      },
    ],
  },
  {
    name: "山东省",
    cities: [
      {
        name: "济宁市",
        coordinates: [116.587, 35.415], // 需要替换实际经纬度
        districts: [
          { name: "JN基地", url: "http://10.101.201.58:8888/#/factoryview" },
        ],
      },
    ],
  },
  {
    name: "广东省",
    cities: [
      {
        name: "广州市",
        coordinates: [113.265, 23.129], // 需要替换实际经纬度
        districts: [
          { name: "CG基地", url: "http://10.137.65.86:8888/#/factoryview" },
        ],
      },
    ],
  },
  {
    name: "重庆市",
    cities: [
      {
        name: "渝北区",
        coordinates: [106.631, 29.718], // 需要替换实际经纬度
        districts: [
          { name: "CY基地", url: "http://10.107.201.27:8888/#/factoryview" },
        ],
      },
    ],
  },
];

// 世界地图投影参数 - 以欧洲为中心，铺满整个屏幕
export const WORLD_MAP_PROJECTION = {
  center: [15.0, 50.0] as [number, number], // 欧洲中心点（经度15度，纬度50度，大约在德国/捷克附近）
  scale: 60, // 调整缩放比例以铺满屏幕（减小scale让地图更大）
};

// 中国地图投影参数 - 以宁德为中心，铺满整个屏幕
export const CHINA_MAP_PROJECTION = {
  center: [104.0, 37.5] as [number, number],
  scale: 40,
};

// 大洲颜色配置
export const CONTINENT_COLORS: { [key: string]: string } = {
  // 亚洲 - 黄色系
  Asia: "#FFD700",
  亚洲: "#FFD700",
  // 欧洲 - 蓝色系
  Europe: "#4169E1",
  欧洲: "#4169E1",
  // 北美洲 - 绿色系
  "North America": "#32CD32",
  北美洲: "#32CD32",
  // 南美洲 - 红色系
  "South America": "#FF6347",
  南美洲: "#FF6347",
  // 非洲 - 橙色系
  Africa: "#FF8C00",
  非洲: "#FF8C00",
  // 大洋洲 - 紫色系
  Oceania: "#9370DB",
  大洋洲: "#9370DB",
  // 默认颜色
  default: "#4A90E2",
};

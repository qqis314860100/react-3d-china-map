const Depth = 6;

// ==================== 中国地图配置 ====================
export const mapConfig = {
  // 地图挤出厚度
  mapDepth: Depth,
  // 地图透明度
  mapTransparent: true,
  mapOpacity: 0.9,
  // 地图颜色
  mapColor: "#FFECD1", // 默认浅杏色（标准地图常用底色）
  mapHoverColor: "#FFD700", // Hover时显示金色
  // 地图颜色渐变 - 标准政区图配色（淡雅、自然）
  mapColorGradient: [
    "#FFECD1", // 浅杏色
    "#E0F0E9", // 浅豆绿
    "#E3F2F9", // 浅天蓝
    "#F9E6E6", // 浅粉红
    "#F2E6F9", // 浅紫罗兰
    "#FFF8D6", // 浅柠檬
    "#E6F9F5", // 浅青
    "#F9F3E6", // 米色
  ],
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
    name: "中国",
    cities: [
      { name: "北京", country: "中国", coordinates: [116.4074, 39.9042], url: "https://example.com/beijing" },
      { name: "上海", country: "中国", coordinates: [121.4737, 31.2304], url: "https://example.com/shanghai" },
      { name: "广州", country: "中国", coordinates: [113.2644, 23.1291], url: "https://example.com/guangzhou" },
      { name: "深圳", country: "中国", coordinates: [114.0579, 22.5431], url: "https://example.com/shenzhen" },
    ],
  },
  {
    name: "美国",
    cities: [
      { name: "纽约", country: "美国", coordinates: [-74.0060, 40.7128], url: "https://example.com/newyork" },
      { name: "洛杉矶", country: "美国", coordinates: [-118.2437, 34.0522], url: "https://example.com/losangeles" },
      { name: "芝加哥", country: "美国", coordinates: [-87.6298, 41.8781], url: "https://example.com/chicago" },
    ],
  },
  {
    name: "英国",
    cities: [
      { name: "伦敦", country: "英国", coordinates: [-0.1276, 51.5074], url: "https://example.com/london" },
      { name: "曼彻斯特", country: "英国", coordinates: [-2.2426, 53.4808], url: "https://example.com/manchester" },
    ],
  },
  {
    name: "日本",
    cities: [
      { name: "东京", country: "日本", coordinates: [139.6503, 35.6762], url: "https://example.com/tokyo" },
      { name: "大阪", country: "日本", coordinates: [135.5023, 34.6937], url: "https://example.com/osaka" },
    ],
  },
  {
    name: "法国",
    cities: [
      { name: "巴黎", country: "法国", coordinates: [2.3522, 48.8566], url: "https://example.com/paris" },
    ],
  },
  {
    name: "德国",
    cities: [
      { name: "柏林", country: "德国", coordinates: [13.4050, 52.5200], url: "https://example.com/berlin" },
      { name: "慕尼黑", country: "德国", coordinates: [11.5820, 48.1351], url: "https://example.com/munich" },
    ],
  },
];

// 世界地图投影参数 - 以欧洲为中心，铺满整个屏幕
export const WORLD_MAP_PROJECTION = {
  center: [15.0, 50.0] as [number, number], // 欧洲中心点（经度15度，纬度50度，大约在德国/捷克附近）
  scale: 100, // 调整缩放比例以铺满屏幕（减小scale让地图更大）
};

// 大洲颜色配置
export const CONTINENT_COLORS: { [key: string]: string } = {
  // 亚洲 - 黄色系
  "Asia": "#FFD700",
  "亚洲": "#FFD700",
  // 欧洲 - 蓝色系
  "Europe": "#4169E1",
  "欧洲": "#4169E1",
  // 北美洲 - 绿色系
  "North America": "#32CD32",
  "北美洲": "#32CD32",
  // 南美洲 - 红色系
  "South America": "#FF6347",
  "南美洲": "#FF6347",
  // 非洲 - 橙色系
  "Africa": "#FF8C00",
  "非洲": "#FF8C00",
  // 大洋洲 - 紫色系
  "Oceania": "#9370DB",
  "大洋洲": "#9370DB",
  // 默认颜色
  "default": "#4A90E2",
};

# Map3D 模块文档

## 目录结构

```
map3d/
├── index.tsx          # 主组件，渲染3D地图
├── types.ts           # 类型定义
├── constants.ts       # 常量配置
├── mapConfig.ts       # 地图配置（颜色、尺寸等）
├── drawFunc.ts        # 绘图函数（生成地图、标签、圆点等）
├── mouseHandler.ts    # 鼠标事件处理
├── utils.ts           # 工具函数
├── camera.ts          # 相机初始化
├── light.ts           # 灯光初始化
├── scene.ts           # 场景初始化
└── typed.ts           # GeoJSON 类型定义
```

## 核心功能

### 1. 地图渲染
- **中国地图**：使用淡雅多彩配色，展示省份和城市
- **世界地图**：使用大洲配色，展示国家和城市
- 支持 Tab 切换，保持相机状态

### 2. 交互功能
- 鼠标悬浮高亮（省份/国家/城市）
- 城市标签和圆点（金色发光效果）
- Tooltip 面板显示详细信息
- 相机控制（缩放、平移）

### 3. 性能优化
- 节流处理鼠标事件
- 限制像素比
- 减少几何体段数
- 对象池和资源复用

## 配置说明

### mapConfig.ts
- `mapConfig`: 中国地图配置（颜色、透明度、厚度等）
- `WORLD_DISPLAY_CONFIG`: 世界地图城市配置
- `WORLD_MAP_PROJECTION`: 世界地图投影参数
- `CONTINENT_COLORS`: 大洲颜色配置

### constants.ts
- `COLORS`: 颜色常量
- `UI_CONSTANTS`: UI 相关常量（偏移量、节流频率等）
- `ANIMATION_CONSTANTS`: 动画常量
- `PROVINCE_ADCODE_MAP`: 省份 Adcode 映射

## 使用示例

```tsx
import Map3D from "./map3d";

<Map3D
  geoJson={geoJsonData}
  projectionFnParam={{ center: [104.0, 37.5], scale: 40 }}
  displayConfig={displayConfig}
  cityGeoJsonData={cityData}
  districtGeoJsonData={districtData}
  mapType="china"
/>
```

## 扩展指南

### 添加新城市
在 `mapConfig.ts` 的 `WORLD_DISPLAY_CONFIG` 中添加：

```typescript
{
  name: "国家名",
  cities: [
    { name: "城市名", country: "国家名", coordinates: [经度, 纬度] }
  ]
}
```

### 自定义颜色
修改 `mapConfig.ts` 中的：
- `mapColorGradient`: 省份颜色数组
- `CONTINENT_COLORS`: 大洲颜色映射

### 调整标签和圆点大小
修改 `drawFunc.ts` 中的：
- `LABEL_STYLE_CONFIG`: 标签字体大小
- `CITY_SPOT_CONFIG`: 圆点和光环尺寸


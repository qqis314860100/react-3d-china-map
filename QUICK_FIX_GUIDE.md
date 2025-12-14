# 快速问题修复指南

## 🚀 启动项目

```bash
npm run dev
```

然后访问：http://localhost:5173

---

## 🔧 常见问题快速修复

### 问题 1: 世界地图太大，看不全

**修改文件**: `src/map3d/drawFunc.ts`

找到这一行（约第 33 行）：
```typescript
const scaleFactor = mapType === "world" ? 800 : 400;
```

改为：
```typescript
const scaleFactor = mapType === "world" ? 1200 : 400; // 数值越大，地图越小
```

---

### 问题 2: 世界地图太小

**修改文件**: `src/map3d/drawFunc.ts`

找到这一行（约第 33 行）：
```typescript
const scaleFactor = mapType === "world" ? 800 : 400;
```

改为：
```typescript
const scaleFactor = mapType === "world" ? 600 : 400; // 数值越小，地图越大
```

---

### 问题 3: 世界地图相机太近

**修改文件**: `src/map3d/camera.ts`

找到这一行（约第 14 行）：
```typescript
const zPosition = mapType === "world" ? 500 : 180;
```

改为：
```typescript
const zPosition = mapType === "world" ? 600 : 180; // 数值越大，相机越远
```

---

### 问题 4: 切换 Tab 时地图重新加载

**检查文件**: `src/App.tsx`

确保使用的是 `display` 控制，而不是条件渲染：

✅ **正确写法**：
```tsx
<div style={{ display: mapType === "china" ? "block" : "none" }}>
  {geoJson && <Map3D geoJson={geoJson} mapType="china" />}
</div>
```

❌ **错误写法**：
```tsx
{mapType === "china" && geoJson && <Map3D geoJson={geoJson} mapType="china" />}
```

---

### 问题 5: 世界地图加载失败

**原因**: 网络问题，无法访问 GitHub

**解决方案 1**: 检查网络
- 确保能访问 GitHub
- 或使用 VPN

**解决方案 2**: 使用本地 GeoJSON
1. 下载世界地图数据：https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson
2. 保存到 `public/world.json`
3. 修改 `src/App.tsx`:
```typescript
// 改为
const response = await axios.get("/world.json");
```

---

## 📊 推荐配置（平衡版）

### src/map3d/camera.ts
```typescript
const zPosition = mapType === "world" ? 500 : 180;
```

### src/map3d/drawFunc.ts
```typescript
const scaleFactor = mapType === "world" ? 800 : 400;
```

这个配置应该能让世界地图完整显示在屏幕中。

---

## 🎯 调整步骤

1. **先调整 scaleFactor**（地图大小）
   - 太大 → 增加数值（900, 1000, 1200...）
   - 太小 → 减小数值（700, 600, 500...）

2. **再调整 zPosition**（相机距离）
   - 太近 → 增加数值（550, 600, 650...）
   - 太远 → 减小数值（450, 400, 350...）

3. **保存文件，浏览器自动刷新**

4. **查看效果，继续微调**

---

## 🔍 调试技巧

### 查看地图数据是否加载成功

按 F12 打开控制台，输入：
```javascript
// 查看中国地图数据
console.log(window.geoJson);

// 查看世界地图数据
console.log(window.worldGeoJson);
```

### 查看地图缩放值

在 `src/map3d/index.tsx` 的 `getDynamicMapScale` 调用后添加：
```typescript
const mapScale = getDynamicMapScale(mapObject3D, currentDom, mapType);
console.log(`${mapType} 地图缩放值:`, mapScale);
```

---

## ⚡ 一键优化脚本

创建 `optimize-map.js`:
```javascript
// 自动调整地图参数
const fs = require('fs');

// 读取配置
const drawFunc = fs.readFileSync('src/map3d/drawFunc.ts', 'utf8');
const camera = fs.readFileSync('src/map3d/camera.ts', 'utf8');

// 调整世界地图大小
const newDrawFunc = drawFunc.replace(
  /scaleFactor = mapType === "world" \? \d+ : 400/,
  'scaleFactor = mapType === "world" ? 1000 : 400'
);

// 调整相机距离
const newCamera = camera.replace(
  /zPosition = mapType === "world" \? \d+ : 180/,
  'zPosition = mapType === "world" ? 550 : 180'
);

// 写入文件
fs.writeFileSync('src/map3d/drawFunc.ts', newDrawFunc);
fs.writeFileSync('src/map3d/camera.ts', newCamera);

console.log('✅ 地图参数已优化！');
```

运行：
```bash
node optimize-map.js
```

---

## 📱 不同屏幕尺寸的推荐配置

### 小屏幕（笔记本 13-14 寸）
```typescript
// camera.ts
const zPosition = mapType === "world" ? 450 : 180;

// drawFunc.ts
const scaleFactor = mapType === "world" ? 700 : 400;
```

### 中等屏幕（15-17 寸）
```typescript
// camera.ts
const zPosition = mapType === "world" ? 500 : 180;

// drawFunc.ts
const scaleFactor = mapType === "world" ? 800 : 400;
```

### 大屏幕（27 寸+）
```typescript
// camera.ts
const zPosition = mapType === "world" ? 600 : 180;

// drawFunc.ts
const scaleFactor = mapType === "world" ? 1000 : 400;
```

---

## ✅ 验证清单

- [ ] npm run dev 能正常启动
- [ ] http://localhost:5173 能访问
- [ ] 中国地图能正常显示
- [ ] 世界地图能正常显示
- [ ] 切换 Tab 流畅无卡顿
- [ ] 地图能缩放
- [ ] 地图能平移
- [ ] 鼠标悬停有 Tooltip

全部打勾 = 完美！🎉

---

**快速参考**: 修改两个文件，调整两个数值，刷新浏览器即可！


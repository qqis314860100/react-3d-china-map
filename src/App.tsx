import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { GeoJsonType } from "./map3d/typed";
import { DISPLAY_CONFIG, WORLD_DISPLAY_CONFIG, WORLD_MAP_PROJECTION } from "./map3d/mapConfig";
import { filterPolarRegions } from "./map3d/utils";
import {
  ProjectionFnParamType,
} from "./map3d/types";
import MapTabs from "./components/MapTabs";

// React 18 dev + StrictMode 会导致 effect 双执行（开发环境）。
// 这里用模块级缓存去重网络请求，避免重复下载/重复 setState 影响“性能体感”。
let chinaGeoJsonCache: GeoJsonType | undefined;
let chinaGeoJsonPromise: Promise<GeoJsonType> | null = null;
let worldGeoJsonCache: GeoJsonType | undefined;
let worldGeoJsonPromise: Promise<GeoJsonType> | null = null;




function App() {
  const [geoJson, setGeoJson] = useState<GeoJsonType>();
  const [worldGeoJson, setWorldGeoJson] = useState<GeoJsonType>();
  const [mapAdCode] = useState<number>(100000);
  const [projectionFnParam] = useState<ProjectionFnParamType>({
    center: [104.0, 37.5],
    scale: 40,
  });
  const [worldProjectionFnParam] = useState<ProjectionFnParamType>(WORLD_MAP_PROJECTION);

  // 请求中国地图数据
  const queryMapData = useCallback(async (code: number) => {
    if (chinaGeoJsonCache) {
      setGeoJson(chinaGeoJsonCache);
      return;
    }

    if (!chinaGeoJsonPromise) {
      chinaGeoJsonPromise = axios
        .get(`https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json`)
        .then((res) => res.data as GeoJsonType)
        .then((data) => {
          chinaGeoJsonCache = data;
          return data;
        })
        .finally(() => {
          // 允许失败后重试
          chinaGeoJsonPromise = null;
        });
    }

    const data = await chinaGeoJsonPromise;
    setGeoJson(data);
  }, []);

  // 加载中国地图数据（组件挂载时加载）
  useEffect(() => {
    queryMapData(mapAdCode); // 默认的中国adcode码
  }, [mapAdCode, queryMapData]);

  // 加载世界地图数据（过滤掉南极和北极）
  const loadWorldMapData = useCallback(async () => {
    try {
      if (worldGeoJsonCache) {
        setWorldGeoJson(worldGeoJsonCache);
        return;
      }

      if (!worldGeoJsonPromise) {
        worldGeoJsonPromise = axios
          .get(
            "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson",
            { timeout: 15000 }
          )
          .then((res) => res.data)
          .then((raw) => {
            if (!raw || raw.type !== "FeatureCollection") {
              throw new Error("世界地图数据格式不正确");
            }
            const filtered = filterPolarRegions(raw);
            const finalData =
              filtered && filtered.features.length > 0 ? filtered : raw;
            worldGeoJsonCache = finalData;
            return finalData;
          })
          .finally(() => {
            worldGeoJsonPromise = null;
          });
      }

      const data = await worldGeoJsonPromise;
      setWorldGeoJson(data);
    } catch (error: any) {
      console.error("加载世界地图数据失败:", error.message || error);
      setWorldGeoJson({
        type: "FeatureCollection",
        features: []
      });
    }
  }, []);

  // 加载世界地图数据（组件挂载时加载）
  useEffect(() => {
    loadWorldMapData();
  }, [loadWorldMapData]);


  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <MapTabs 
        chinaGeoJson={geoJson}
        worldGeoJson={worldGeoJson}
        chinaProjection={projectionFnParam}
        worldProjection={worldProjectionFnParam}
        chinaDisplayConfig={DISPLAY_CONFIG}
        worldDisplayConfig={WORLD_DISPLAY_CONFIG}
        defaultIndex={0}
      />
    </div>
  );
}

export default App;

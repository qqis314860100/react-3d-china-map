import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { GeoJsonType } from "./map3d/typed";
import {
  CHINA_MAP_PROJECTION,
  DISPLAY_CONFIG,
  WORLD_DISPLAY_CONFIG,
  WORLD_MAP_PROJECTION,
  WorldCountryConfig,
} from "./map3d/mapConfig";
import { filterPolarRegions } from "./map3d/utils";
import { ProjectionFnParamType } from "./map3d/types";
import MapTabs from "./components/MapTabs";
import DomesticConfigSidebar from "./components/DomesticConfigSidebar";
import WorldConfigSidebar from "./components/WorldConfigSidebar";
import "./App.css";

// React 18 dev + StrictMode 可能导致 effect 双执行（开发环境）。
// 用模块级 promise 缓存去重网络请求，避免重复下载/重复 setState。
let chinaGeoJsonCache: GeoJsonType | undefined;
let chinaGeoJsonPromise: Promise<GeoJsonType> | null = null;
let worldGeoJsonCache: GeoJsonType | undefined;
let worldGeoJsonPromise: Promise<GeoJsonType> | null = null;

const CHINA_REMOTE_URL =
  "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json";
const WORLD_REMOTE_URL =
  "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";
const CHINA_LOCAL_FALLBACK = "/json/china.json";
const WORLD_LOCAL_FALLBACK = "/json/world.geojson";

function App() {
  const [geoJson, setGeoJson] = useState<GeoJsonType>();
  const [worldGeoJson, setWorldGeoJson] = useState<GeoJsonType>();
  const [tabIndex, setTabIndex] = useState<number>(0);
  const [projectionFnParam] =
    useState<ProjectionFnParamType>(CHINA_MAP_PROJECTION);
  const [worldProjectionFnParam] =
    useState<ProjectionFnParamType>(WORLD_MAP_PROJECTION);

  // 请求中国地图数据
  const queryMapData = useCallback(async () => {
    try {
      if (chinaGeoJsonCache) {
        setGeoJson(chinaGeoJsonCache);
        return;
      }

      if (!chinaGeoJsonPromise) {
        chinaGeoJsonPromise = (async () => {
          try {
            const remote = await axios.get<GeoJsonType>(CHINA_REMOTE_URL, {
              timeout: 20000,
            });
            return remote.data;
          } catch (err) {
            console.warn("远程中国地图拉取失败，改用本地备份", err);
            const local = await axios.get<GeoJsonType>(CHINA_LOCAL_FALLBACK, {
              timeout: 8000,
            });
            return local.data;
          }
        })()
          .then((data) => {
            chinaGeoJsonCache = data;
            return data;
          })
          .finally(() => {
            chinaGeoJsonPromise = null;
          });
      }

      const data = await chinaGeoJsonPromise;
      setGeoJson(data);
    } catch (error: any) {
      console.error("加载中国地图数据失败:", error?.message || error);
      setGeoJson({
        type: "FeatureCollection",
        features: [],
      });
    }
  }, []);

  // 加载世界地图数据（过滤掉南极和北极）
  const loadWorldMapData = useCallback(async () => {
    try {
      if (worldGeoJsonCache) {
        setWorldGeoJson(worldGeoJsonCache);
        return;
      }

      if (!worldGeoJsonPromise) {
        worldGeoJsonPromise = (async () => {
          const fetchWorld = async (url: string) => {
            const res = await axios.get(url, { timeout: 20000 });
            return res.data;
          };

          let raw: any;
          try {
            raw = await fetchWorld(WORLD_REMOTE_URL);
          } catch (err) {
            console.warn("远程世界地图拉取失败，改用本地备份", err);
            raw = await fetchWorld(WORLD_LOCAL_FALLBACK);
          }

          if (!raw || raw.type !== "FeatureCollection") {
            throw new Error("世界地图数据格式不正确");
          }

          const filteredData = filterPolarRegions(raw);
          const finalData =
            filteredData && filteredData.features.length > 0
              ? filteredData
              : raw;
          worldGeoJsonCache = finalData;
          return finalData;
        })().finally(() => {
          worldGeoJsonPromise = null;
        });
      }

      const data = await worldGeoJsonPromise;
      setWorldGeoJson(data);
    } catch (error: any) {
      console.error("加载世界地图数据失败:", error?.message || error);
      setWorldGeoJson({
        type: "FeatureCollection",
        features: [],
      });
    }
  }, []);

  // 加载中国地图数据（组件挂载时加载）
  useEffect(() => {
    queryMapData();
    loadWorldMapData();
  }, [queryMapData, loadWorldMapData]);

  return (
    <div className="app-root">
      <div className="app-shell">
        <div className="app-header">
          <div className="app-title">
            <div className="app-title__main">🌍MP智能驾舱平台</div>
            <div className="app-title__sub">国内 / 海外 </div>
          </div>
        </div>
        <div className="app-content">
          <div className="app-main">
            <div className="app-sidebar">
              {tabIndex === 0 ? (
                <DomesticConfigSidebar title="基地配置" data={DISPLAY_CONFIG} />
              ) : (
                <WorldConfigSidebar
                  title="海外配置"
                  data={WORLD_DISPLAY_CONFIG as WorldCountryConfig[]}
                  projection={worldProjectionFnParam}
                />
              )}
            </div>
            <div className="app-map">
              <MapTabs
                selectedIndex={tabIndex}
                onSelect={setTabIndex}
                chinaGeoJson={geoJson}
                worldGeoJson={worldGeoJson}
                chinaProjection={projectionFnParam}
                worldProjection={worldProjectionFnParam}
                chinaDisplayConfig={DISPLAY_CONFIG}
                worldDisplayConfig={WORLD_DISPLAY_CONFIG}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="app-bg" />
    </div>
  );
}

export default App;

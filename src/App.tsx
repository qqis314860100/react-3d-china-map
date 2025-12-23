import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { GeoJsonType } from "./map3d/typed";
import {
  CHINA_MAP_PROJECTION,
  DISPLAY_CONFIG,
  WORLD_DISPLAY_CONFIG,
  WORLD_MAP_PROJECTION,
} from "./map3d/mapConfig";
import { filterPolarRegions } from "./map3d/utils";
import { ProjectionFnParamType } from "./map3d/types";
import MapTabs from "./components/MapTabs";
import "./App.css";

function App() {
  const [geoJson, setGeoJson] = useState<GeoJsonType>();
  const [worldGeoJson, setWorldGeoJson] = useState<GeoJsonType>();
  const [projectionFnParam] =
    useState<ProjectionFnParamType>(CHINA_MAP_PROJECTION);
  const [worldProjectionFnParam] =
    useState<ProjectionFnParamType>(WORLD_MAP_PROJECTION);

  // 请求中国地图数据
  const queryMapData = useCallback(async () => {
    const response = await axios.get(`/json/100000_full.json`);
    const { data } = response;
    setGeoJson(data);
  }, []);

  // 加载世界地图数据（过滤掉南极和北极）
  const loadWorldMapData = useCallback(async () => {
    try {
      const response = await axios.get("/json/world.json");

      if (response.data && response.data.type === "FeatureCollection") {
        // 使用工具函数过滤极地区域
        const filteredData = filterPolarRegions(response.data);

        if (filteredData && filteredData.features.length > 0) {
          console.log("过滤后的features数量:", filteredData.features.length);
          setWorldGeoJson(filteredData);
        } else {
          console.warn("过滤后没有features，使用原始数据");
          setWorldGeoJson(response.data);
        }
      } else {
        throw new Error("世界地图数据格式不正确");
      }
    } catch (error: any) {
      console.error("加载世界地图数据失败:", error.message || error);
      console.warn("使用空的世界地图数据，请检查网络连接或数据源");
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
          <MapTabs
            chinaGeoJson={geoJson}
            worldGeoJson={worldGeoJson}
            chinaProjection={projectionFnParam}
            worldProjection={worldProjectionFnParam}
            chinaDisplayConfig={DISPLAY_CONFIG}
            worldDisplayConfig={WORLD_DISPLAY_CONFIG}
          />
        </div>
      </div>
      <div className="app-bg" />
    </div>
  );
}

export default App;

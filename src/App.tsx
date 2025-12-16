import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { GeoJsonType } from "./map3d/typed";
import { DISPLAY_CONFIG, WORLD_DISPLAY_CONFIG, WORLD_MAP_PROJECTION } from "./map3d/mapConfig";
import { filterPolarRegions } from "./map3d/utils";
import {
  ProjectionFnParamType,
  ProvinceConfig,
} from "./map3d/types";
import MapTabs from "./components/MapTabs";




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
    const response = await axios.get(
      `https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json`
    );
    const { data } = response;
    setGeoJson(data);
  }, []);

  // 加载中国地图数据（组件挂载时加载）
  useEffect(() => {
    queryMapData(mapAdCode); // 默认的中国adcode码
  }, [mapAdCode, queryMapData]);

  // 加载世界地图数据（过滤掉南极和北极）
  const loadWorldMapData = useCallback(async () => {
    try {
      const response = await axios.get(
        "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson",
        { timeout: 15000 }
      );
      
      if (response.data && response.data.type === "FeatureCollection") {
        console.log("世界地图数据加载成功，features数量:", response.data.features.length);
        
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

import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import Map3D from "./map3d";
import { GeoJsonType } from "./map3d/typed";
import { WORLD_DISPLAY_CONFIG, WORLD_MAP_PROJECTION } from "./map3d/mapConfig";
import { PROVINCE_ADCODE_MAP } from "./map3d/constants";
import { filterPolarRegions } from "./map3d/utils";
import {
  ProjectionFnParamType,
  DistrictConfig,
  CityConfig,
  ProvinceConfig,
} from "./map3d/types";
import MapTabs from "./components/MapTabs";


// 中国地图城市配置（只需要配置城市名称和经纬度）
const DISPLAY_CONFIG: ProvinceConfig[] = [
  {
    name: "北京市",
    cities: [
      { name: "北京", coordinates: [116.4074, 39.9042], url: "https://example.com/beijing" },
    ],
  },
  {
    name: "上海市",
    cities: [
      { name: "上海", coordinates: [121.4737, 31.2304], url: "https://example.com/shanghai" },
    ],
  },
  {
    name: "广东省",
    cities: [
      { name: "广州", coordinates: [113.2644, 23.1291], url: "https://example.com/guangzhou" },
      { name: "深圳", coordinates: [114.0579, 22.5431], url: "https://example.com/shenzhen" },
    ],
  },
  {
    name: "福建省",
    cities: [
      { name: "宁德市", coordinates: [119.5479, 26.6617], url: "https://example.com/ningde" },
      { name: "福州", coordinates: [119.2965, 26.0745], url: "https://example.com/fuzhou" },
    ],
  },
  {
    name: "浙江省",
    cities: [
      { name: "杭州", coordinates: [120.1551, 30.2741], url: "https://example.com/hangzhou" },
    ],
  },
  {
    name: "江苏省",
    cities: [
      { name: "南京", coordinates: [118.7969, 32.0603], url: "https://example.com/nanjing" },
    ],
  },
];

type MapType = "china" | "world";

function App() {
  const [mapType, setMapType] = useState<MapType>("china"); // 默认显示中国地图
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

  // 加载中国地图数据
  useEffect(() => {
    if (mapType === "china") {
      queryMapData(mapAdCode); // 默认的中国adcode码
    }
  }, [mapAdCode, mapType, queryMapData]);

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

  // 加载世界地图数据
  useEffect(() => {
    // 只有在没有数据时才加载
    if (mapType === "world" && !worldGeoJson) {
      loadWorldMapData();
    }
  }, [mapType, loadWorldMapData, worldGeoJson]);


  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <MapTabs activeTab={mapType} onTabChange={setMapType} />
      
      {/* 中国地图 - 使用CSS控制显示/隐藏，保持状态 */}
      <div style={{ 
        width: "100%", 
        height: "100%", 
        display: mapType === "china" ? "block" : "none",
        position: "absolute",
        top: 0,
        left: 0
      }}>
        {geoJson && (
          <Map3D
            geoJson={geoJson}
            projectionFnParam={projectionFnParam}
            displayConfig={DISPLAY_CONFIG}
            mapType="china"
          />
        )}
      </div>

      {/* 世界地图 - 使用CSS控制显示/隐藏，保持状态 */}
      <div style={{ 
        width: "100%", 
        height: "100%", 
        display: mapType === "world" ? "block" : "none",
        position: "absolute",
        top: 0,
        left: 0
      }}>
        {worldGeoJson && worldGeoJson.features && worldGeoJson.features.length > 0 ? (
          <Map3D
            geoJson={worldGeoJson}
            projectionFnParam={worldProjectionFnParam}
            displayConfig={WORLD_DISPLAY_CONFIG}
            mapType="world"
          />
        ) : (
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#fff",
            fontSize: "16px",
            zIndex: 1000,
            textAlign: "center"
          }}>
            <div>正在加载世界地图数据...</div>
            <div style={{ fontSize: "12px", marginTop: "10px", opacity: 0.7 }}>
              如果长时间未加载，请检查网络连接
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

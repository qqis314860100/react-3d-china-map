import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import Map3D, { ProjectionFnParamType } from "./map3d";
import { GeoJsonType } from "./map3d/typed";
import { WORLD_DISPLAY_CONFIG, WORLD_MAP_PROJECTION } from "./map3d/mapConfig";
import MapTabs from "./components/MapTabs";

// 配置需要显示的省份和地级市
export interface DistrictConfig {
  name: string;
  url?: string; // 市区链接，可选
}

export interface CityConfig {
  name: string;
  adcode?: number; // 地级市的adcode，用于加载市区数据
  districts: DistrictConfig[]; // 市区列表
}

export interface ProvinceConfig {
  name: string;
  adcode?: number; // 省份的adcode，用于加载地级市数据
  cities: CityConfig[];
}

// 省份adcode映射（用于加载地级市数据）
const PROVINCE_ADCODE_MAP: { [key: string]: number } = {
  "北京市": 110000,
  "天津市": 120000,
  "河北省": 130000,
  "山西省": 140000,
  "内蒙古自治区": 150000,
  "辽宁省": 210000,
  "吉林省": 220000,
  "黑龙江省": 230000,
  "上海市": 310000,
  "江苏省": 320000,
  "浙江省": 330000,
  "安徽省": 340000,
  "福建省": 350000,
  "江西省": 360000,
  "山东省": 370000,
  "河南省": 410000,
  "湖北省": 420000,
  "湖南省": 430000,
  "广东省": 440000,
  "广西壮族自治区": 450000,
  "海南省": 460000,
  "重庆市": 500000,
  "四川省": 510000,
  "贵州省": 520000,
  "云南省": 530000,
  "西藏自治区": 540000,
  "陕西省": 610000,
  "甘肃省": 620000,
  "青海省": 630000,
  "宁夏回族自治区": 640000,
  "新疆维吾尔自治区": 650000,
  "台湾省": 710000,
  "香港特别行政区": 810000,
  "澳门特别行政区": 820000,
};

// 示例配置：只显示这些省份和地级市
// 注意：省份名称必须与地图数据中的名称完全匹配（包含"市"、"省"等后缀）
const DISPLAY_CONFIG: ProvinceConfig[] = [
  {
    name: "北京市",
    adcode: 110000,
    cities: [
      { 
        name: "东城区", 
        adcode: 110101,
        districts: [
          { name: "东华门街道", url: "https://example.com/donghuamen" },
          { name: "景山街道", url: "https://example.com/jingshan" },
        ]
      },
      { 
        name: "西城区", 
        adcode: 110102,
        districts: [
          { name: "西长安街街道", url: "https://example.com/xichanganjie" },
          { name: "新街口街道", url: "https://example.com/xinjiekou" },
        ]
      },
    ],
  },
  {
    name: "上海市",
    adcode: 310000,
    cities: [
      { 
        name: "黄浦区", 
        adcode: 310101,
        districts: [
          { name: "南京东路街道", url: "https://example.com/nanjingdonglu" },
          { name: "外滩街道", url: "https://example.com/waitan" },
        ]
      },
      { 
        name: "徐汇区", 
        adcode: 310104,
        districts: [
          { name: "湖南路街道", url: "https://example.com/hunanlu" },
          { name: "天平路街道", url: "https://example.com/tianpinglu" },
        ]
      },
    ],
  },
  {
    name: "广东省",
    adcode: 440000,
    cities: [
      { 
        name: "广州市", 
        adcode: 440100,
        districts: [
          { name: "越秀区", url: "https://example.com/yuexiu" },
          { name: "天河区", url: "https://example.com/tianhe" },
        ]
      },
      { 
        name: "深圳市", 
        adcode: 440300,
        districts: [
          { name: "福田区", url: "https://example.com/futian" },
          { name: "南山区", url: "https://example.com/nanshan" },
        ]
      },
    ],
  },
];

// 地级市数据接口
export interface CityGeoJsonData {
  provinceName: string;
  cityName: string;
  geoJson: GeoJsonType;
}

// 市区数据接口
export interface DistrictGeoJsonData {
  provinceName: string;
  cityName: string;
  geoJson: GeoJsonType;
}

type MapType = "china" | "world";

function App() {
  const [mapType, setMapType] = useState<MapType>("china"); // 默认显示中国地图
  const [geoJson, setGeoJson] = useState<GeoJsonType>();
  const [worldGeoJson, setWorldGeoJson] = useState<GeoJsonType>();
  const [cityGeoJsonData, setCityGeoJsonData] = useState<CityGeoJsonData[]>([]);
  const [districtGeoJsonData, setDistrictGeoJsonData] = useState<DistrictGeoJsonData[]>([]);
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
      // 尝试使用更可靠的数据源
      const response = await axios.get(
        "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson",
        { timeout: 15000 }
      );
      
      if (response.data && response.data.type === "FeatureCollection") {
        console.log("世界地图数据加载成功，features数量:", response.data.features.length);
        
        // 改进的过滤逻辑：过滤掉南极和北极
        const filteredFeatures = response.data.features.filter((feature: any) => {
          if (!feature.geometry || !feature.geometry.coordinates) {
            return false;
          }
          
          try {
            const coordinates = feature.geometry.coordinates;
            let maxLat = -90;
            let minLat = 90;
            let hasValidCoords = false;
            
            // 递归检查坐标
            const checkCoordinates = (coords: any, depth: number = 0): void => {
              if (!Array.isArray(coords)) return;
              
              if (depth > 10) return; // 防止无限递归
              
              if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
                // 这是一个坐标点 [lng, lat]
                const lat = coords[1];
                const lng = coords[0];
                
                // 验证坐标有效性
                if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                  maxLat = Math.max(maxLat, lat);
                  minLat = Math.min(minLat, lat);
                  hasValidCoords = true;
                }
              } else {
                // 这是一个嵌套数组，继续递归
                coords.forEach((coord: any) => checkCoordinates(coord, depth + 1));
              }
            };
            
            checkCoordinates(coordinates);
            
            // 排除南极（纬度 < -60）和北极（纬度 > 85），但保留有有效坐标的feature
            if (!hasValidCoords) return false;
            return minLat > -60 && maxLat < 85;
          } catch (e) {
            console.warn("过滤feature时出错:", e);
            return false;
          }
        });
        
        console.log("过滤后的features数量:", filteredFeatures.length);
        
        if (filteredFeatures.length === 0) {
          console.warn("过滤后没有features，使用原始数据");
          setWorldGeoJson(response.data);
        } else {
          setWorldGeoJson({
            ...response.data,
            features: filteredFeatures
          });
        }
      } else {
        throw new Error("世界地图数据格式不正确");
      }
    } catch (error: any) {
      console.error("加载世界地图数据失败:", error.message || error);
      
      // 尝试备用数据源
      try {
        console.log("尝试备用数据源...");
        const response = await axios.get(
          "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
          { timeout: 15000 }
        );
        
        // 这个数据源可能是TopoJSON格式，需要转换
        if (response.data && response.data.type === "FeatureCollection") {
          console.log("备用数据源加载成功");
          setWorldGeoJson(response.data);
        } else {
          // 如果是TopoJSON，先简单处理
          console.warn("数据可能是TopoJSON格式，尝试直接使用");
          setWorldGeoJson({
            type: "FeatureCollection",
            features: []
          });
        }
      } catch (error2: any) {
        console.error("备用世界地图数据源也失败:", error2.message || error2);
        
        // 如果都失败了，使用一个简单的示例数据
        console.warn("使用空的世界地图数据，请检查网络连接或数据源");
        setWorldGeoJson({
          type: "FeatureCollection",
          features: []
        });
      }
    }
  }, []);

  // 加载世界地图数据
  useEffect(() => {
    // 只有在没有数据时才加载
    if (mapType === "world" && !worldGeoJson) {
      loadWorldMapData();
    }
  }, [mapType, loadWorldMapData, worldGeoJson]);

  // 加载地级市数据
  useEffect(() => {
    const loadCityData = async () => {
      const cityDataPromises = DISPLAY_CONFIG.map(async (province) => {
        const adcode = province.adcode || PROVINCE_ADCODE_MAP[province.name];
        if (!adcode) {
          console.warn(`未找到省份 ${province.name} 的adcode`);
          return null;
        }

        try {
          const response = await axios.get(
            `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`
          );
          return {
            provinceName: province.name,
            cityName: "", // 将在Map3D中处理
            geoJson: response.data,
          };
        } catch (error) {
          console.error(`加载 ${province.name} 地级市数据失败:`, error);
          return null;
        }
      });

      const results = await Promise.all(cityDataPromises);
      const validResults = results.filter((r) => r !== null) as CityGeoJsonData[];
      setCityGeoJsonData(validResults);
    };

    loadCityData();
  }, []);

  // 加载市区数据
  useEffect(() => {
    const loadDistrictData = async () => {
      const districtDataPromises: Promise<DistrictGeoJsonData | null>[] = [];
      
      DISPLAY_CONFIG.forEach((province) => {
        province.cities.forEach((city) => {
          if (city.adcode) {
            districtDataPromises.push(
              axios.get(`https://geo.datav.aliyun.com/areas_v3/bound/${city.adcode}_full.json`)
                .then((response) => ({
                  provinceName: province.name,
                  cityName: city.name,
                  geoJson: response.data,
                }))
                .catch((error) => {
                  console.error(`加载 ${city.name} 市区数据失败:`, error);
                  return null;
                })
            );
          }
        });
      });

      const results = await Promise.all(districtDataPromises);
      const validResults = results.filter((r) => r !== null) as DistrictGeoJsonData[];
      setDistrictGeoJsonData(validResults);
    };

    if (cityGeoJsonData.length > 0) {
      loadDistrictData();
    }
  }, [cityGeoJsonData]);

  // 将世界地图配置转换为Map3D需要的格式（保持完整数据）
  const worldDisplayConfig = WORLD_DISPLAY_CONFIG.map((country) => ({
    name: country.name,
    cities: country.cities.map((city) => ({
      name: city.name,
      coordinates: city.coordinates, // 保留坐标
      url: city.url,
      districts: city.districts || [], // 保留区级数据
      country: city.country, // 保留国家名称
    })),
  }));

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
        {geoJson && cityGeoJsonData.length > 0 && districtGeoJsonData.length > 0 && (
          <Map3D
            geoJson={geoJson}
            projectionFnParam={projectionFnParam}
            displayConfig={DISPLAY_CONFIG}
            cityGeoJsonData={cityGeoJsonData}
            districtGeoJsonData={districtGeoJsonData}
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
            displayConfig={worldDisplayConfig}
            cityGeoJsonData={[]}
            districtGeoJsonData={[]}
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

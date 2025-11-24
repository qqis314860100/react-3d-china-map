import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import Map3D, { ProjectionFnParamType } from "./map3d";
import { GeoJsonType } from "./map3d/typed";

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

function App() {
  const [geoJson, setGeoJson] = useState<GeoJsonType>();
  const [cityGeoJsonData, setCityGeoJsonData] = useState<CityGeoJsonData[]>([]);
  const [districtGeoJsonData, setDistrictGeoJsonData] = useState<DistrictGeoJsonData[]>([]);
  const [mapAdCode, setMapAdCode] = useState<number>(100000);
  const [projectionFnParam, setProjectionFnParam] =
    useState<ProjectionFnParamType>({
      center: [104.0, 37.5],
      scale: 40,
    });

  useEffect(() => {
    queryMapData(mapAdCode); // 默认的中国adcode码
  }, [mapAdCode]);

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

  // 请求地图数据
  const queryMapData = useCallback(async (code: number) => {
    const response = await axios.get(
      `https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json`
    );
    const { data } = response;
    setGeoJson(data);
  }, []);

  return (
    <>
      {geoJson && cityGeoJsonData.length > 0 && districtGeoJsonData.length > 0 && (
        <Map3D
          geoJson={geoJson}
          projectionFnParam={projectionFnParam}
          displayConfig={DISPLAY_CONFIG}
          cityGeoJsonData={cityGeoJsonData}
          districtGeoJsonData={districtGeoJsonData}
        />
      )}
    </>
  );
}

export default App;

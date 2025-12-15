import React, { useState } from "react";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "react-tabs/style/react-tabs.css";
import "./MapTabs.css";
import Map3D from "../map3d";
import { GeoJsonType } from "../map3d/typed";
import { ProjectionFnParamType, ProvinceConfig } from "../map3d/types";

interface MapTabsProps {
  chinaGeoJson?: GeoJsonType;
  worldGeoJson?: GeoJsonType;
  chinaProjection: ProjectionFnParamType;
  worldProjection: ProjectionFnParamType;
  chinaDisplayConfig: ProvinceConfig[];
  worldDisplayConfig: ProvinceConfig[];
  defaultIndex?: number;
}

const MapTabs: React.FC<MapTabsProps> = ({
  chinaGeoJson,
  worldGeoJson,
  chinaProjection,
  worldProjection,
  chinaDisplayConfig,
  worldDisplayConfig,
  defaultIndex = 0,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex);

  return (
    <div className="map-tabs-container">
      <Tabs
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        forceRenderTabPanel
        className="custom-tabs">
        <TabList className="map-tabs">
          <Tab className="tab-btn" selectedClassName="active">
            <span className="tab-icon">🇨🇳</span>
            <span className="tab-text">中国地图</span>
          </Tab>
          <Tab className="tab-btn" selectedClassName="active">
            <span className="tab-icon">🌍</span>
            <span className="tab-text">世界地图</span>
          </Tab>
        </TabList>

        <TabPanel>
          {chinaGeoJson ? (
            <Map3D
              geoJson={chinaGeoJson}
              projectionFnParam={chinaProjection}
              displayConfig={chinaDisplayConfig}
              mapType="china"
            />
          ) : (
            <div className="map-placeholder">加载中国地图中...</div>
          )}
        </TabPanel>
        <TabPanel>
          {worldGeoJson && worldGeoJson.features?.length > 0 ? (
            <Map3D
              geoJson={worldGeoJson}
              projectionFnParam={worldProjection}
              displayConfig={worldDisplayConfig}
              mapType="world"
            />
          ) : (
            <div className="map-placeholder">加载世界地图中...</div>
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
};

export default MapTabs;


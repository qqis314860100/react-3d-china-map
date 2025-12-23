import React, { useEffect, useRef, useState } from "react";
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
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const w = el.clientWidth;
    el.scrollTo({ left: selectedIndex * w, behavior: "smooth" });
  }, [selectedIndex]);

  return (
    <div className="map-tabs-container">
      <div className="custom-tabs">
        <div className="map-tabs" role="tablist" aria-label="地图切换">
          <button
            type="button"
            className={`tab-btn ${selectedIndex === 0 ? "active" : ""}`}
            role="tab"
            aria-selected={selectedIndex === 0}
            onClick={() => setSelectedIndex(0)}
          >
            <span className="tab-text">国内</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${selectedIndex === 1 ? "active" : ""}`}
            role="tab"
            aria-selected={selectedIndex === 1}
            onClick={() => setSelectedIndex(1)}
          >
            <span className="tab-text">海外</span>
          </button>
        </div>

        <div className="tabs-viewport" ref={viewportRef}>
          <div className="tabs-track">
            <div className="map-tabpanel" role="tabpanel" aria-label="中国地图">
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
            </div>
            <div className="map-tabpanel" role="tabpanel" aria-label="世界地图">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapTabs;

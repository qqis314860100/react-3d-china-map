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
  /**
   * 性能模式：'low' (低配/云桌面) | 'normal' (正常)
   */
  performanceMode?: "low" | "normal";
  /**
   * 受控模式：由外部控制当前 Tab（0=国内，1=海外）
   */
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  defaultIndex?: number;
}

const MapTabs: React.FC<MapTabsProps> = ({
  chinaGeoJson,
  worldGeoJson,
  chinaProjection,
  worldProjection,
  chinaDisplayConfig,
  worldDisplayConfig,
  performanceMode = "normal",
  selectedIndex: selectedIndexProp,
  onSelect,
  defaultIndex = 0,
}) => {
  const [uncontrolledIndex, setUncontrolledIndex] = useState(defaultIndex);
  const isControlled = typeof selectedIndexProp === "number" && typeof onSelect === "function";
  const selectedIndex = isControlled ? (selectedIndexProp as number) : uncontrolledIndex;
  const setSelectedIndex = isControlled ? (onSelect as (i: number) => void) : setUncontrolledIndex;
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
                  performanceMode={performanceMode}
                  active={selectedIndex === 0}
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
                  performanceMode={performanceMode}
                  active={selectedIndex === 1}
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

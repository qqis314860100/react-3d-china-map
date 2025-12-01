import React, { useEffect, useRef, useState } from "react";
import "./MapTabs.css";

interface MapTabsProps {
  activeTab: "china" | "world";
  onTabChange: (tab: "china" | "world") => void;
}

const MapTabs: React.FC<MapTabsProps> = ({ activeTab, onTabChange }) => {
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const chinaTabRef = useRef<HTMLButtonElement>(null);
  const worldTabRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });

  useEffect(() => {
    // 更新指示器位置
    const updateIndicator = () => {
      const activeRef = activeTab === "china" ? chinaTabRef : worldTabRef;
      if (activeRef.current && tabsContainerRef.current) {
        const tabRect = activeRef.current.getBoundingClientRect();
        const containerRect = tabsContainerRef.current.getBoundingClientRect();
        setIndicatorStyle({
          left: tabRect.left - containerRect.left,
          width: tabRect.width,
        });
      }
    };

    // 延迟执行以确保DOM已渲染
    const timer = setTimeout(updateIndicator, 0);
    
    // 监听窗口大小变化
    window.addEventListener("resize", updateIndicator);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updateIndicator);
    };
  }, [activeTab]);

  return (
    <div className="map-tabs" ref={tabsContainerRef}>
      <div className="tabs-wrapper">
        <button
          ref={chinaTabRef}
          className={`tab-btn ${activeTab === "china" ? "active" : ""}`}
          onClick={() => onTabChange("china")}
        >
          <span className="tab-icon">🇨🇳</span>
          <span className="tab-text">中国地图</span>
        </button>
        <button
          ref={worldTabRef}
          className={`tab-btn ${activeTab === "world" ? "active" : ""}`}
          onClick={() => onTabChange("world")}
        >
          <span className="tab-icon">🌍</span>
          <span className="tab-text">世界地图</span>
        </button>
        {/* 滑动指示器 */}
        <div
          className="tab-indicator"
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
          }}
        />
      </div>
    </div>
  );
};

export default MapTabs;


import "./tooltip.css";

function ToolTip(props: any) {
  const { innterRef, data, onMouseEnter, onMouseLeave } = props;
  const {
    text,
    districts = [],
    showPanel = false, // 兼容旧字段：目前由外部控制 text 与交互
    isCity = false,
    provinceName,
    url,
  } = data;

  const handleDistrictClick = (url?: string) => {
    if (url) {
      window.open(url, "_blank");
    }
  };

  // 显示地级市面板或省份面板
  if (!text) {
    return null;
  }

  return (
    <div
      ref={innterRef}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`tooltip ${isCity ? "tooltip--city" : "tooltip--province"}`}
    >
      {/* 地级市或省份信息面板 */}
      {isCity ? (
        <>
          <div className="tooltip__title">{text || "地级市"}</div>
          {provinceName && (
            <div className="tooltip__meta">
              所属{provinceName.includes("省") || provinceName.includes("市") ? "省份" : "国家"}: {provinceName}
            </div>
          )}
          {url && (
            <div className="tooltip__link" onClick={() => window.open(url, "_blank")}>
              查看详情
            </div>
          )}
        </>
      ) : (
        <div className="tooltip__title">{text || "省份"}</div>
      )}
      {isCity && districts.length > 0 && (
        <div>
          <div className="tooltip__sectionTitle">基地列表：</div>
          <div className="tooltip__list">
            {districts.map((district: any, index: number) => (
              <div
                key={index}
                onClick={() => handleDistrictClick(district.url)}
                className={`tooltip__item ${district.url ? "tooltip__item--clickable" : ""}`}
                title={district.name}
              >
                {district.name}
              </div>
            ))}
          </div>
        </div>
      )}
      {isCity && districts.length === 0 && (
        <div className="tooltip__empty">暂无基地数据</div>
      )}
    </div>
  );
}

export default ToolTip;

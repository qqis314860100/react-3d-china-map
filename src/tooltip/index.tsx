function ToolTip(props: any) {
  const { innterRef, data, onMouseEnter, onMouseLeave } = props;
  const { text, districts = [], showPanel = false, isCity = false, provinceName, url } = data;

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
      style={{
        position: "fixed", // 使用fixed定位，跟随鼠标
        zIndex: 999,
        background: "#010209",
        minWidth: isCity ? "250px" : "150px",
        maxWidth: isCity ? "400px" : "250px",
        padding: "20px",
        border: isCity ? "2px solid #FFD700" : "2px solid #3B93E6", // 地级市金色，省份蓝色
        visibility: "hidden",
        color: isCity ? "#FFD700" : "#3B93E6", // 地级市金色，省份蓝色
        pointerEvents: "auto", // 允许交互
        borderRadius: "8px",
        boxShadow: isCity 
          ? "0 4px 20px rgba(255, 215, 0, 0.3)" 
          : "0 4px 20px rgba(59, 147, 230, 0.3)",
      }}
    >
      {/* 地级市或省份信息面板 */}
      {isCity ? (
        <>
          <div style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "10px", color: "#FFD700" }}>
            {text || "地级市"}
          </div>
          {provinceName && (
            <div style={{ fontSize: "13px", marginBottom: "15px", color: "#5BB1FF", opacity: 0.9 }}>
              所属{provinceName.includes("省") || provinceName.includes("市") ? "省份" : "国家"}: {provinceName}
            </div>
          )}
          {url && (
            <div 
              style={{ 
                fontSize: "13px", 
                marginBottom: "15px", 
                color: "#FFD700", 
                cursor: "pointer",
                textDecoration: "underline",
                opacity: 0.9 
              }}
              onClick={() => window.open(url, "_blank")}
            >
              查看详情 🔗
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "10px", color: "#3B93E6" }}>
          {text || "省份"}
        </div>
      )}
      {isCity && districts.length > 0 && (
        <div style={{ marginTop: "15px" }}>
          <div style={{ fontSize: "14px", marginBottom: "12px", color: "#5BB1FF", fontWeight: "500" }}>
            市区列表：
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
            {districts.map((district: any, index: number) => (
              <div
                key={index}
                onClick={() => handleDistrictClick(district.url)}
                style={{
                  padding: "10px 12px",
                  background: "#0A1E4D",
                  borderRadius: "5px",
                  cursor: district.url ? "pointer" : "default",
                  transition: "all 0.3s",
                  fontSize: "14px",
                  border: "1px solid #FFD700",
                  color: "#FFD700",
                }}
                onMouseEnter={(e) => {
                  if (district.url) {
                    e.currentTarget.style.background = "#FFD700";
                    e.currentTarget.style.color = "#000";
                    e.currentTarget.style.transform = "translateX(5px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#0A1E4D";
                  e.currentTarget.style.color = "#FFD700";
                  e.currentTarget.style.transform = "translateX(0)";
                }}
              >
                {district.name}
                {district.url && (
                  <span style={{ marginLeft: "8px", fontSize: "12px" }}>🔗</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {isCity && districts.length === 0 && (
        <div style={{ fontSize: "13px", color: "#888", fontStyle: "italic" }}>
          暂无市区数据
        </div>
      )}
    </div>
  );
}

export default ToolTip;

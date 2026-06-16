import { useState } from "react";

export default function UnitDetailPanel({ unit, project, onClose }) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!unit) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0,
      right: 0,
      width: "45%",
      height: "100vh",
      background: "#fff",
      boxShadow: "-2px 0 8px rgba(0,0,0,0.1)",
      overflowY: "auto",
      zIndex: 1000,
    }}>
      {/* Header */}
      <div style={{ padding: "20px", borderBottom: "1px solid #ddd", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>{unit.unit_ref}</h2>
          <p style={{ margin: "4px 0 0 0", color: "#666", fontSize: "14px" }}>{project?.name}</p>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer" }}>×</button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #ddd", padding: "0 20px" }}>
        {["overview", "photos", "plan"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "12px 16px",
              background: activeTab === tab ? "#0F2540" : "none",
              color: activeTab === tab ? "#C9A84C" : "#666",
              border: "none",
              cursor: "pointer",
              fontWeight: activeTab === tab ? "bold" : "normal",
            }}
          >
            {tab === "overview" && "Overview"}
            {tab === "photos" && "Photos"}
            {tab === "plan" && "Floor Plan"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {activeTab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
              {unit.bedrooms && (
                <div style={{ background: "#f5f5f5", padding: "12px", borderRadius: "8px" }}>
                  <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>Bedrooms</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "bold" }}>{unit.bedrooms}</p>
                </div>
              )}
              {unit.bathrooms && (
                <div style={{ background: "#f5f5f5", padding: "12px", borderRadius: "8px" }}>
                  <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>Bathrooms</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "bold" }}>{unit.bathrooms}</p>
                </div>
              )}
              {unit.carpet_area && (
                <div style={{ background: "#f5f5f5", padding: "12px", borderRadius: "8px" }}>
                  <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>Carpet Area</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "bold" }}>{unit.carpet_area.toLocaleString()} sqft</p>
                </div>
              )}
              {unit.view_type && (
                <div style={{ background: "#f5f5f5", padding: "12px", borderRadius: "8px" }}>
                  <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>View</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "bold" }}>{unit.view_type}</p>
                </div>
              )}
            </div>

            {unit.starting_price && (
              <div style={{ background: "#E8D5B7", padding: "16px", borderRadius: "8px", marginBottom: "20px" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "#333" }}>Starting Price</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "bold", color: "#0F2540" }}>
                  AED {Number(unit.starting_price).toLocaleString("en-AE")}
                </p>
              </div>
            )}

            {unit.handover_date && (
              <p><strong>Handover:</strong> {new Date(unit.handover_date).toLocaleDateString("en-AE")}</p>
            )}
          </div>
        )}

        {activeTab === "photos" && (
          <div>
            {unit.photo_urls && unit.photo_urls.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "12px" }}>
                {unit.photo_urls.map((url, i) => (
                  <img key={i} src={url} alt={`Unit photo ${i + 1}`} style={{ width: "100%", height: "250px", objectFit: "cover", borderRadius: "8px" }} />
                ))}
              </div>
            ) : (
              <p style={{ color: "#999" }}>No photos available</p>
            )}
          </div>
        )}

        {activeTab === "plan" && (
          <div>
            {unit.floor_plan_url ? (
              <div>
                <img src={unit.floor_plan_url} alt="Floor plan" style={{ width: "100%", borderRadius: "8px", marginBottom: "12px" }} />
                <a href={unit.floor_plan_url} target="_blank" rel="noopener noreferrer" style={{ color: "#0F2540", display: "block", fontWeight: "bold" }}>View Full Plan →</a>
              </div>
            ) : (
              <p style={{ color: "#999" }}>Floor plan not available</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

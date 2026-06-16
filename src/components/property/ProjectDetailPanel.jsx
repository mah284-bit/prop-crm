import { useState } from "react";

export default function ProjectDetailPanel({ project, onClose }) {
  const [activeTab, setActiveTab] = useState("overview");

  if (!project) return null;

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
        <h2 style={{ margin: 0 }}>{project.name}</h2>
        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer" }}>×</button>
      </div>

      {/* Hero Image */}
      {project.hero_image_url && (
        <img src={project.hero_image_url} alt={project.name} style={{ width: "100%", height: "300px", objectFit: "cover" }} />
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #ddd", padding: "0 20px" }}>
        {["overview", "gallery", "docs"].map(tab => (
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
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "20px" }}>
        {activeTab === "overview" && (
          <div>
            <p><strong>Community:</strong> {project.community}</p>
            <p><strong>Type:</strong> {project.type}</p>
            <p><strong>Units:</strong> {project.total_units}</p>
            <p><strong>Starting Price:</strong> AED {Number(project.starting_price).toLocaleString("en-AE")}</p>
            <p><strong>Handover:</strong> {project.handover_date ? new Date(project.handover_date).toLocaleDateString("en-AE") : "—"}</p>
            {project.amenities && project.amenities.length > 0 && (
              <>
                <p><strong>Amenities:</strong></p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {project.amenities.map(a => (
                    <span key={a} style={{ background: "#E8D5B7", padding: "4px 12px", borderRadius: "16px", fontSize: "12px" }}>
                      {a}
                    </span>
                  ))}
                </div>
              </>
            )}
            {project.website_url && (
              <p><a href={project.website_url} target="_blank" rel="noopener noreferrer" style={{ color: "#0F2540", fontWeight: "bold" }}>Visit Project Website →</a></p>
            )}
          </div>
        )}

        {activeTab === "gallery" && (
          <div>
            {project.photo_gallery_urls && project.photo_gallery_urls.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}>
                {project.photo_gallery_urls.map((url, i) => (
                  <img key={i} src={url} alt={`Gallery ${i + 1}`} style={{ width: "100%", height: "200px", objectFit: "cover", borderRadius: "8px" }} />
                ))}
              </div>
            ) : (
              <p style={{ color: "#999" }}>No photos yet</p>
            )}
          </div>
        )}

        {activeTab === "docs" && (
          <div>
            {project.brochure_url && (
              <p><a href={project.brochure_url} target="_blank" rel="noopener noreferrer" style={{ color: "#0F2540", display: "block", marginBottom: "12px" }}>📄 Download Brochure</a></p>
            )}
            {project.master_plan_url && (
              <p><a href={project.master_plan_url} target="_blank" rel="noopener noreferrer" style={{ color: "#0F2540", display: "block", marginBottom: "12px" }}>🏗️ View Master Plan</a></p>
            )}
            {project.video_url && (
              <p><a href={project.video_url} target="_blank" rel="noopener noreferrer" style={{ color: "#0F2540", display: "block" }}>🎬 Watch Video</a></p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

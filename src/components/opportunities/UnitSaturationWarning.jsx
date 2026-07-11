import React from "react";

export default function UnitSaturationWarning({ saturation, onContinue, onPickDifferent }) {
  if (!saturation || saturation.totalOpps < 3) return null;

  const isCritical = saturation.riskLevel === "critical";
  const isHigh = saturation.riskLevel === "high";

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 12,
        padding: 24,
        maxWidth: 500,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        border: `2px solid ${saturation.riskColor}`,
      }}>
        <div style={{display: "flex", alignItems: "center", gap: 12, marginBottom: 16}}>
          <span style={{fontSize: 32}}>{saturation.riskEmoji}</span>
          <div>
            <div style={{fontSize: 18, fontWeight: 700, color: "#0F2540"}}>Unit Saturation Warning</div>
            <div style={{fontSize: 12, color: "#718096", marginTop: 2}}>Market analysis for smart assignment</div>
          </div>
        </div>

        <div style={{
          background: saturation.riskColor + "15",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}>
          <div>
            <div style={{fontSize: 10, fontWeight: 600, color: "#64748B", textTransform: "uppercase"}}>Your Opps</div>
            <div style={{fontSize: 24, fontWeight: 700, color: saturation.riskColor, marginTop: 4}}>
              {saturation.myOppsCount}
            </div>
          </div>
          <div>
            <div style={{fontSize: 10, fontWeight: 600, color: "#64748B", textTransform: "uppercase"}}>Competitors</div>
            <div style={{fontSize: 24, fontWeight: 700, color: "#94A3B8", marginTop: 4}}>
              {saturation.competitorCount}
            </div>
          </div>
          <div style={{gridColumn: "1/-1"}}>
            <div style={{fontSize: 10, fontWeight: 600, color: "#64748B", textTransform: "uppercase"}}>Total Active</div>
            <div style={{fontSize: 20, fontWeight: 700, color: "#0F2540", marginTop: 4}}>
              {saturation.totalOpps} opportunities
            </div>
          </div>
        </div>

        <div style={{
          padding: 12,
          background: "#FDF3DC",
          borderLeft: `4px solid #C9A84C`,
          borderRadius: 6,
          marginBottom: 16,
          fontSize: 12,
          color: "#8A6200",
          lineHeight: 1.5,
        }}>
          ⚠️ <strong>{saturation.disappointmentRisk} buyer{saturation.disappointmentRisk !== 1 ? "s" : ""} will be disappointed</strong> if this deal doesn't close. High saturation = low conversion odds.
        </div>

        <div style={{display: "flex", gap: 8}}>
          <button onClick={onContinue} style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: 8,
            border: "none",
            background: saturation.riskColor,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}>
            📌 Continue Anyway
          </button>
          <button onClick={onPickDifferent} style={{
            flex: 1,
            padding: "12px 16px",
            borderRadius: 8,
            border: `1.5px solid ${saturation.riskColor}`,
            background: "#fff",
            color: saturation.riskColor,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}>
            🔄 Pick Different Unit
          </button>
        </div>
      </div>
    </div>
  );
}

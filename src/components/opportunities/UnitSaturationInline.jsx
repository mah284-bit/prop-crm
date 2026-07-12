import React from "react";

export default function UnitSaturationInline({ saturation }) {
  
  if (!saturation) {
    return null;
  }
  
  if (saturation.totalOpps < 2) {
    return null;
  }

  return (
    <div style={{
      marginTop: 8,
      padding: 10,
      background: saturation.riskColor + "15",
      borderLeft: `3px solid ${saturation.riskColor}`,
      borderRadius: 4,
      fontSize: 11,
      color: "#475569",
    }}>
      <strong>{saturation.riskEmoji} {saturation.totalOpps} active opps</strong> on this unit
      <span style={{color: saturation.riskColor, fontWeight: 600, marginLeft: 4}}>
        ({saturation.myOppsCount} yours, {saturation.competitorCount} others)
      </span>
    </div>
  );
}

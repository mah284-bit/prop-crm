/**
 * Unit Market Saturation Analysis
 * Analyzes competing opportunity counts for smart unit assignment
 */
export function analyzeUnitSaturation(unitId, allOpps, currentUserId) {
  if (!unitId || !allOpps) return null;

  // All opps on this unit
  const unitOpps = allOpps.filter(o => o.unit_id === unitId && o.status !== "Closed Lost");
  
  // My opps on this unit
  const myOpps = unitOpps.filter(o => o.assigned_to === currentUserId);
  
  // Other brokers' opps
  const competitorOpps = unitOpps.filter(o => o.assigned_to !== currentUserId);
  
  // Risk scoring
  const totalCount = unitOpps.length;
  let riskLevel = "low";
  let riskColor = "#1A7F5A";
  let riskEmoji = "✅";
  
  if (totalCount >= 8) {
    riskLevel = "critical";
    riskColor = "#B83232";
    riskEmoji = "🔴";
  } else if (totalCount >= 5) {
    riskLevel = "high";
    riskColor = "#C9A84C";
    riskEmoji = "🟠";
  } else if (totalCount >= 3) {
    riskLevel = "medium";
    riskColor = "#8A6200";
    riskEmoji = "🟡";
  }
  
  const disappointmentRisk = totalCount - myOpps.length;
  
  return {
    unitId,
    myOppsCount: myOpps.length,
    competitorCount: competitorOpps.length,
    totalOpps: totalCount,
    riskLevel,
    riskColor,
    riskEmoji,
    disappointmentRisk,
    saturationPct: Math.round((totalCount / 10) * 100),
  };
}

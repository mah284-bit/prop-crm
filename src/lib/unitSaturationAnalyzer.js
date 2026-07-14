/**
 * Unit Market Saturation Analysis
 * AI fetches fresh data from DB - always accurate
 */

export async function analyzeUnitSaturation(unitId, currentUserId, supabase) {
  
  if (!unitId || !supabase) {
    console.warn("⚠️ Missing: unitId or supabase");
    return null;
  }

  try {
    
    const { data: satData, error } = await supabase.rpc('get_unit_saturation', { p_unit_id: unitId });

    if (error) {
      console.error("❌ Query error:", error);
      return null;
    }


    const total = Number(satData?.total || 0);
    const mine = Number(satData?.mine || 0);
    const myOpps = { length: mine };
    const competitors = { length: total - mine };

    let risk = "low", color = "#1A7F5A", emoji = "✅";
    if (total >= 8) { risk = "critical"; color = "#B83232"; emoji = "🔴"; }
    else if (total >= 5) { risk = "high"; color = "#C9A84C"; emoji = "🟠"; }
    else if (total >= 3) { risk = "medium"; color = "#8A6200"; emoji = "🟡"; }

    const result = { unitId, myOppsCount: myOpps.length, competitorCount: competitors.length, totalOpps: total, riskLevel: risk, riskColor: color, riskEmoji: emoji, disappointmentRisk: total - myOpps.length, saturationPct: Math.round((total / 10) * 100) };
    
    return result;
  } catch (e) {
    console.error("💥 Analyzer exception:", e);
    return null;
  }
}

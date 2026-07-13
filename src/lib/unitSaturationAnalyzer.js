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
    
    const { data: opps, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('unit_id', unitId)
      .neq('status', 'Closed Lost');

    if (error) {
      console.error("❌ Query error:", error);
      return null;
    }


    console.log("SAT-PROBE unit=", unitId, "uid=", currentUserId, "rows=", (opps||[]).length, "err=", error);
    const myOpps = (opps || []).filter(o => o.assigned_to === currentUserId);
    const competitors = (opps || []).filter(o => o.assigned_to !== currentUserId);
    const total = (opps || []).length;

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

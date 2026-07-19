// CoachPage — AI Coach deal analysis, extracted from App.jsx (MAP A3).
import { useState } from "react";
import { aiInvoke } from "../lib/aiInvoke.js";

export default function CoachPage({ opps, leads, activities, users, currentUser, showToast, onNavigateToOpp }) {
  const role = currentUser?.role || "sales_agent";
  const isManager = ["super_admin", "admin", "sales_manager"].includes(role);
  const SCOPES = [
    { id: "mine",      label: "My Pipeline",  icon: "👤", managerOnly: false },
    { id: "all_opps",  label: "All Opportunities", icon: "🎯", managerOnly: false },
    { id: "attention", label: "Needs Attention",   icon: "🚨", managerOnly: false },
    { id: "stage",     label: "By Stage",     icon: "📊", managerOnly: false },
    { id: "segment",   label: "By Segment",   icon: "🎯", managerOnly: false },
    { id: "portfolio", label: "Portfolio",    icon: "🏛", managerOnly: true  },
  ].filter(s => isManager || !s.managerOnly);
  const [scope, setScope] = useState("mine");
  const [stageFilter, setStageFilter] = useState("Negotiation");
  const [segmentFilter, setSegmentFilter] = useState("investor");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const STAGES = ["New", "Contacted", "Site Visit", "Proposal Sent", "Negotiation", "Offer Accepted", "Reserved", "SPA Requirements", "SPA Signed"];
  const SEGMENTS = [
    { id: "investor", label: "Investor" },
    { id: "owner_occupier", label: "Owner-Occupier" },
    { id: "hybrid", label: "Hybrid" },
    { id: "corporate", label: "Corporate" },
    { id: "reseller", label: "Reseller" },
  ];
  const AI_PURPLE = "#6D28D9";
  const AI_TEAL = "#0E7490";
  const gradient = `linear-gradient(135deg, ${AI_PURPLE} 0%, ${AI_TEAL} 100%)`;

  // ── Gather the deals for the selected scope (Phase 2) ──
  const activeOpps = (opps || []).filter(o =>
    o.stage !== "Closed Won" && o.stage !== "Closed Lost" && o.status !== "On Hold" && o.status !== "Cancelled"
  );
  const scopedOpps = (() => {
    if (scope === "mine") return activeOpps.filter(o => o.assigned_to === currentUser?.id);
    if (scope === "all_opps") return isManager ? activeOpps : activeOpps.filter(o => o.assigned_to === currentUser?.id);
    if (scope === "attention") {
      const base = isManager ? activeOpps : activeOpps.filter(o => o.assigned_to === currentUser?.id);
      return base.filter(o => {
        const acts = (activities || []).filter(a => a.opportunity_id === o.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const lastAt = acts[0]?.created_at || o.stage_updated_at || o.created_at;
        const daysSince = lastAt ? Math.floor((Date.now() - new Date(lastAt).getTime()) / 86400000) : 999;
        const daysStage = o.stage_updated_at ? Math.floor((Date.now() - new Date(o.stage_updated_at).getTime()) / 86400000) : 0;
        return daysSince >= 7 || daysStage >= 14;
      });
    }
    if (scope === "stage") {
      const base = isManager ? activeOpps : activeOpps.filter(o => o.assigned_to === currentUser?.id);
      return base.filter(o => o.stage === stageFilter);
    }
    if (scope === "segment") {
      const base = isManager ? activeOpps : activeOpps.filter(o => o.assigned_to === currentUser?.id);
      return base.filter(o => {
        const ld = (leads || []).find(l => l.id === o.lead_id);
        return ld?.buyer_intent === segmentFilter;
      });
    }
    if (scope === "portfolio") return isManager ? activeOpps : [];
    return [];
  })();
  // Enrich each opp with the context the AI needs
  const enrichedDeals = scopedOpps.map(o => {
    const ld = (leads || []).find(l => l.id === o.lead_id);
    const oppActs = (activities || []).filter(a => a.opportunity_id === o.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const lastActAt = oppActs[0]?.created_at || o.stage_updated_at || o.created_at;
    const daysInStage = o.stage_updated_at ? Math.floor((Date.now() - new Date(o.stage_updated_at).getTime()) / 86400000) : null;
    const daysSinceActivity = lastActAt ? Math.floor((Date.now() - new Date(lastActAt).getTime()) / 86400000) : null;
    const agent = (users || []).find(u => u.id === o.assigned_to);
    return {
      id: o.id,
      title: o.title || "(untitled)",
      lead_name: ld?.name || "Unknown",
      buyer_intent: ld?.buyer_intent || null,
      stage: o.stage,
      value: o.budget || null,
      days_in_stage: daysInStage,
      days_since_activity: daysSinceActivity,
      activity_count: oppActs.length,
      agent_name: agent?.full_name || "Unassigned",
    };
  }).sort((a, b) => (b.days_since_activity || 0) - (a.days_since_activity || 0));

  const dealCount = enrichedDeals.length;
  const totalValue = enrichedDeals.reduce((s, d) => s + (d.value || 0), 0);

  // ── Phase 3: AI analysis of the selected cross-section ──
  const scopeLabel = SCOPES.find(s => s.id === scope)?.label || scope;
  const scopeDescription = (() => {
    if (scope === "stage") return `deals in the "${stageFilter}" stage`;
    if (scope === "segment") return `${SEGMENTS.find(s => s.id === segmentFilter)?.label || segmentFilter} buyers`;
    if (scope === "attention") return "deals that are stalling (no recent activity or stuck in stage)";
    if (scope === "portfolio") return "the entire company's active pipeline";
    if (scope === "all_opps") return "all active opportunities";
    return "your active pipeline";
  })();

  const runBroadCoach = async () => {
    if (dealCount === 0) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      // Keep payload lean — cap at 40 deals to control tokens
      const dealsForAI = enrichedDeals.slice(0, 40).map(d => ({
        id: d.id,
        deal: d.title,
        buyer: d.lead_name,
        intent: d.buyer_intent,
        stage: d.stage,
        value_aed: d.value,
        days_in_stage: d.days_in_stage,
        days_since_activity: d.days_since_activity,
        activities_logged: d.activity_count,
        agent: d.agent_name,
      }));
      const system = `You are PropPulse Coach, an expert UAE real-estate sales advisor reviewing a CROSS-SECTION of a brokerage's pipeline (not a single deal). Your job: read the set of deals and surface the MOST IMPORTANT things the user should act on now. Be specific — name actual deals, cite their stage/value/staleness. Respect UAE norms (DLD 4%, off-plan vs ready, payment plans 10/90, 20/80, 50/50, 40/60). Prioritise deals at risk (stale, stuck) and high-value opportunities. Always respond with valid JSON only — no prose, no markdown fences. Confidence is one of "high", "medium", "low".`;
      const userPrompt = `Analyse this cross-section of the pipeline: ${scopeDescription}.
SCOPE: ${scopeLabel}
DEAL COUNT: ${dealCount}
TOTAL VALUE: AED ${(totalValue/1e6).toFixed(2)}M

DEALS (sorted by staleness, most stale first):
${JSON.stringify(dealsForAI, null, 2)}

TASK: Give a portfolio-level read, then rank the specific deals that need attention most. Reference actual deals by name.
RESPOND WITH VALID JSON ONLY in this exact shape:
{
  "summary": "<2-3 sentence read of this cross-section — health, risks, where to focus>",
  "deals": [
    {
      "deal_id": "<the id field from the deal>",
      "deal_name": "<deal name>",
      "priority": "high" | "medium" | "low",
      "issue": "<what's wrong or the opportunity — cite specifics>",
      "recommended_move": "<the single next action for this deal>"
    }
  ]
}
Rank up to 6 deals, highest priority first. If a deal is healthy, you may omit it.`;
      const reply = await aiInvoke({ system, prompt: userPrompt, max_tokens: 3000 });
      const cleaned = reply.replace(/```json\s*/g, "").replace(/```\s*$/g, "").trim();
      // Robust JSON parse — LLMs sometimes emit trailing commas, smart quotes, or partial trailing junk
      const tryParse = (s) => {
        try { return JSON.parse(s); } catch { return null; }
      };
      const normalize = (s) => s
        .replace(/[\u201C\u201D]/g, '"')   // smart double quotes → "
        .replace(/[\u2018\u2019]/g, "'")   // smart single quotes → '
        .replace(/,(\s*[\}\]])/g, "$1");   // strip trailing commas
      let parsed = tryParse(cleaned) || tryParse(normalize(cleaned));
      if (!parsed) {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) parsed = tryParse(m[0]) || tryParse(normalize(m[0]));
      }
      if (!parsed) throw new Error("AI response was not valid JSON");
      setResult({
        summary: parsed.summary || "",
        deals: Array.isArray(parsed.deals) ? parsed.deals.slice(0, 6) : [],
        scope: scopeLabel,
        analysed_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Broad Coach failed:", e);
      setError(`Couldn't analyse: ${e.message || "unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 26 }}>✨</span>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 800, color: "#0F2540", margin: 0, letterSpacing: "-.5px" }}>AI Coach</h1>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: gradient, padding: "3px 9px", borderRadius: 20, letterSpacing: ".5px" }}>BETA</span>
        </div>
        <p style={{ fontSize: 13, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
          Honest, AI-powered review of your deals. Point it at any slice of your book — your pipeline, a stage, a buyer segment{isManager ? ", or the whole portfolio" : ""} — and get the moves that matter most.
        </p>
      </div>
      <div style={{ background: "#fff", border: "1px solid #E8EDF4", borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 10 }}>What should I analyse?</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {SCOPES.map(s => {
            const active = scope === s.id;
            return (
              <button key={s.id} onClick={() => { setScope(s.id); setResult(null); setError(""); }}
                style={{ padding: "9px 16px", borderRadius: 10, cursor: "pointer",
                  border: active ? `1.5px solid ${AI_PURPLE}` : "1.5px solid #E2E8F0",
                  background: active ? "linear-gradient(135deg, #EDE9FE 0%, #CCFBF1 100%)" : "#F8FAFC",
                  color: active ? "#0F2540" : "#64748B", fontWeight: active ? 700 : 600, fontSize: 13,
                  display: "flex", alignItems: "center", gap: 7,
                  boxShadow: active ? "0 0 0 3px rgba(109,40,217,.08)" : "none", transition: "all .15s" }}>
                <span style={{ fontSize: 15 }}>{s.icon}</span><span>{s.label}</span>
              </button>
            );
          })}
        </div>
        {scope === "stage" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Stage:</span>
            {STAGES.map(st => (
              <button key={st} onClick={() => setStageFilter(st)}
                style={{ padding: "5px 11px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontWeight: stageFilter === st ? 700 : 500,
                  border: stageFilter === st ? `1.5px solid ${AI_TEAL}` : "1.5px solid #E2E8F0",
                  background: stageFilter === st ? "#CCFBF1" : "#fff", color: stageFilter === st ? "#0F2540" : "#64748B" }}>{st}</button>
            ))}
          </div>
        )}
        {scope === "segment" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>Segment:</span>
            {SEGMENTS.map(sg => (
              <button key={sg.id} onClick={() => setSegmentFilter(sg.id)}
                style={{ padding: "5px 11px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontWeight: segmentFilter === sg.id ? 700 : 500,
                  border: segmentFilter === sg.id ? `1.5px solid ${AI_TEAL}` : "1.5px solid #E2E8F0",
                  background: segmentFilter === sg.id ? "#CCFBF1" : "#fff", color: segmentFilter === sg.id ? "#0F2540" : "#64748B" }}>{sg.label}</button>
            ))}
          </div>
        )}
        {scope === "portfolio" && isManager && (
          <div style={{ fontSize: 12, color: "#64748B", fontStyle: "italic" }}>Analysing every active deal across the company.</div>
        )}
        {scope === "mine" && (
          <div style={{ fontSize: 12, color: "#64748B", fontStyle: "italic" }}>Analysing all of your active deals.</div>
        )}
        {scope === "all_opps" && (
          <div style={{ fontSize: 12, color: "#64748B", fontStyle: "italic" }}>Analysing {isManager ? "every active deal" : "all your active deals"} as one book.</div>
        )}
        {scope === "attention" && (
          <div style={{ fontSize: 12, color: "#B45309", fontStyle: "italic" }}>🚨 Deals stalling — no activity 7+ days or stuck in stage 14+ days.</div>
        )}
      </div>
      <div style={{ background: "#fff", border: "1px solid #E8EDF4", borderRadius: 14, padding: "28px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#64748B", marginBottom: 14 }}>
          {dealCount > 0 ? (
            <>Found <strong style={{ color: "#0F2540", fontSize: 18 }}>{dealCount}</strong> active {dealCount === 1 ? "deal" : "deals"}
              {totalValue > 0 ? <> · <strong style={{ color: "#0F2540" }}>AED {(totalValue / 1e6).toFixed(2)}M</strong> total value</> : null}</>
          ) : (
            <span style={{ color: "#94A3B8" }}>No active deals match this scope.</span>
          )}
        </div>
        <button onClick={runBroadCoach} disabled={dealCount === 0 || loading}
          style={{ padding: "11px 28px", borderRadius: 10, border: "none",
            background: (dealCount === 0 || loading) ? "#CBD5E1" : "linear-gradient(135deg, #6D28D9 0%, #0E7490 100%)",
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: (dealCount === 0 || loading) ? "not-allowed" : "pointer",
            boxShadow: (dealCount === 0 || loading) ? "none" : "0 2px 10px rgba(109,40,217,.25)" }}>
          {loading ? "✨ Analysing…" : `✨ Analyse ${dealCount > 0 ? `${dealCount} ${dealCount === 1 ? "deal" : "deals"}` : ""}`}
        </button>

        {error && (
          <div style={{ marginTop: 16, padding: "12px 16px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, color: "#B91C1C", fontSize: 13 }}>
            {error}
          </div>
        )}

        {result && !loading && (
          <div style={{ marginTop: 22, textAlign: "left" }}>
            {/* Summary */}
            <div style={{ padding: "16px 18px", borderRadius: 12, background: "linear-gradient(135deg, #F5F3FF 0%, #ECFEFF 100%)", border: "1px solid #DDD6FE", marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6D28D9", textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 6 }}>
                ✨ Coach read · {result.scope}
              </div>
              <div style={{ fontSize: 14, color: "#0F2540", lineHeight: 1.6, fontWeight: 500 }}>{result.summary}</div>
            </div>
            {/* Ranked deals */}
            {result.deals.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.deals.map((d, i) => {
                  const pc = d.priority === "high" ? { c: "#DC2626", bg: "#FEE2E2", l: "HIGH" }
                    : d.priority === "medium" ? { c: "#D97706", bg: "#FEF3C7", l: "MEDIUM" }
                    : { c: "#0891B2", bg: "#CFFAFE", l: "LOW" };
                  return (
                    <div key={i} onClick={() => d.deal_id && onNavigateToOpp && onNavigateToOpp(d.deal_id)}
                      style={{ padding: "14px 16px", borderRadius: 12, background: "#fff", border: "1px solid #E8EDF4", cursor: d.deal_id ? "pointer" : "default", transition: "all .15s" }}
                      onMouseEnter={e => { if (d.deal_id) { e.currentTarget.style.borderColor = "#A5B4FC"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(109,40,217,.08)"; } }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E8EDF4"; e.currentTarget.style.boxShadow = "none"; }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: pc.c, background: pc.bg, padding: "2px 8px", borderRadius: 20 }}>{pc.l}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#0F2540" }}>{d.deal_name}</span>
                        {d.deal_id && onNavigateToOpp && <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: "auto" }}>Open →</span>}
                      </div>
                      <div style={{ fontSize: 12.5, color: "#64748B", lineHeight: 1.55, marginBottom: 6 }}>{d.issue}</div>
                      <div style={{ fontSize: 12.5, color: "#0F2540", lineHeight: 1.55 }}>
                        <strong style={{ color: "#6D28D9" }}>Next:</strong> {d.recommended_move}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <button onClick={runBroadCoach} style={{ background: "none", border: "none", color: "#6D28D9", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↻ Re-analyse</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


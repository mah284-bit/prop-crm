// AIAssistant — whole-CRM AI concierge, extracted from App.jsx.
// Self-contained: buildContext (full-CRM context) + writeBrokerCreatedLog (audit) live here.
import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabase";

function buildContext(leads, units, projects, salePricing, leasePricing, activities, currentUser) {
  const now = new Date();
  const active = leads.filter(l => !["Closed Won", "Closed Lost"].includes(l.stage));
  const pipeline = {};
  active.forEach(l => { pipeline[l.stage] = (pipeline[l.stage] || 0) + 1; });
  const avail = units.filter(u => u.status === "Available");
  return `You are an AI assistant for PropCRM, a real estate CRM based in Dubai, UAE.
Logged-in user: ${currentUser.full_name} (role: ${currentUser.role})
Today: ${now.toLocaleDateString("en-AE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
=== LIVE DATA ===
LEADS: ${leads.length} total · ${active.length} active · Pipeline: ${Object.entries(pipeline).map(([s, c]) => `${s}:${c}`).join(", ")}
WON: ${leads.filter(l => l.stage === "Closed Won").length} · LOST: ${leads.filter(l => l.stage === "Closed Lost").length}
RECENT LEADS (last 10):
${leads.slice(0, 10).map(l => `• ${l.name} | ${l.stage} | AED ${Number(l.budget || 0).toLocaleString()} | ${l.nationality || "—"} | ${l.source || "—"} | ${l.phone || "—"} | ${l.email || "—"}`).join("\n")}
PROPERTIES: ${units.length} units across ${projects.length} projects · ${avail.length} available
PROJECTS: ${projects.map(p => `${p.name} (${p.developer || "—"}, ${p.status})`).join(" · ")}
AVAILABLE UNITS (first 20):
${avail.slice(0, 20).map(u => {
  const p = projects.find(x => x.id === u.project_id);
  const sp = salePricing.find(s => s.unit_id === u.id);
  const lp = leasePricing.find(l => l.unit_id === u.id);
  const price = sp?.asking_price ? `AED ${Number(sp.asking_price).toLocaleString()}` : lp?.annual_rent ? `AED ${Number(lp.annual_rent).toLocaleString()}/yr` : "TBD";
  return `• #${u.unit_ref} | ${u.sub_type} | ${u.bedrooms === 0 ? "Studio" : (u.unit_type === "Residential" ? u.bedrooms + "BR" : "")} | ${u.size_sqft ? Number(u.size_sqft).toLocaleString() + "sqft" : ""} | ${u.view || ""} | ${price} | ${p?.name || "—"}`;
}).join("\n")}
RECENT ACTIVITY: ${activities.slice(0, 5).map(a => `${a.type} with ${a.lead_name} by ${a.user_name}`).join(" · ")}
=== YOUR JOB ===
1. Answer questions about properties, leads, pipeline using the live data above
2. Draft WhatsApp/email messages (professional Dubai real estate tone, WhatsApp <150 words)
3. Analyse pipeline and suggest next actions
4. Qualify leads — check stage gates: Contacted needs phone+email; Site Visit needs meeting; Proposal needs unit+budget confirmed; Negotiation needs proposal notes; Closed Won needs final price+payment plan
5. Auto-extract lead details from descriptions — when asked to "auto-fill" a lead, extract: name, phone, email, budget, nationality, notes
Respond concisely. Use bullet points for lists. Match the user's language.`;
}

async function writeBrokerCreatedLog(leadRow, currentUser) {
  if (!leadRow?.id || !currentUser?.id) return;
  try {
    const { error } = await supabase.from("lead_assignment_log").insert({
      lead_id: leadRow.id,
      company_id: leadRow.company_id || currentUser.company_id || null,
      action: "broker_created",
      from_user_id: null,
      to_user_id: currentUser.id,
      pool_id: null,
      method: "manual",
      reason: null,
      triggered_by: currentUser.id,
    });
    if (error) console.warn("[writeBrokerCreatedLog] log insert failed:", error.message);
  } catch (e) {
    console.warn("[writeBrokerCreatedLog] unexpected error:", e?.message || e);
  }
}

export default function AIAssistant({ leads, units, projects, salePricing, leasePricing, activities, currentUser, showToast }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [keys, setKeys] = useState(() => { try { return JSON.parse(localStorage.getItem("ai_keys") || "{}"); } catch { return {}; } });
  const [suggestion, setSuggestion] = useState(null);
  const [usedProvider, setUsedProvider] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);
  const cacheStr = localStorage.getItem("propccrm_company_cache");
  const coCache = cacheStr ? JSON.parse(cacheStr) : null;
  const coName = coCache?.name || "PropCRM";
  const aiFullName = coCache?.ai_assistant_name || (coName.split(" ")[0] + " AI");
  const QUICK = [
    { icon: "📊", label: "Pipeline Summary", msg: "Give me a full pipeline summary — total value, deals by stage, and top 3 actions for this week.", category: "analytics" },
    { icon: "🏠", label: "Available Units", msg: "Show all available units with pricing. Highlight the best value options.", category: "inventory" },
    { icon: "👤", label: "Hot Leads", msg: "Which leads are most likely to close this month? Rank them and explain why.", category: "leads" },
    { icon: "⏱", label: "Stale Deals", msg: "Which leads have been stuck the longest? Who needs immediate attention today?", category: "leads" },
    { icon: "✍", label: "Draft WhatsApp", msg: "Draft a luxury, professional WhatsApp message to re-engage a high-value client who viewed a property but went quiet for 2 weeks.", category: "communication" },
    { icon: "🔑", label: "Leasing Overview", msg: "Summarise our leasing portfolio — active leases, expiring soon, overdue payments and available units.", category: "leasing" },
    { icon: "💰", label: "Revenue Forecast", msg: "Based on current pipeline and historical conversion, what revenue should we forecast for the next 90 days?", category: "analytics" },
    { icon: "📝", label: "Add Lead by Voice", msg: "Auto-fill: Ahmed Al Mansouri, +971501234567, UAE national, looking for a luxury villa in Palm Jumeirah, budget AED 8M, met at Cityscape.", category: "action" },
  ];
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const firstName = currentUser.full_name.split(" ")[0];
    setMessages([{ role: "assistant", content:
      `${greeting}, ${firstName}. I'm **${aiFullName}** — your dedicated real estate intelligence concierge.
` +
      `I have live access to **${leads.length} contacts**, **${units.filter(u => u.status === "Available").length} available units** across **${projects.length} projects**` +
      (leads.filter(l => !["Closed Won", "Closed Lost"].includes(l.stage)).length > 0 ? `, and a pipeline of **${leads.filter(l => !["Closed Won", "Closed Lost"].includes(l.stage)).length} active opportunities**` : "") + `.

` +
      `How may I assist you today? Select a quick action below or type your question in natural language.`
    }]);
  }, []);

  const saveKeys = (k) => { setKeys(k); localStorage.setItem("ai_keys", JSON.stringify(k)); };

  const callAI = async (systemPrompt, msgs) => {
    const messages = (msgs || [])
      .filter(m => m && m.content && (m.role === "user" || m.role === "assistant"))
      .map(m => ({ role: m.role, content: m.content }));
    const body = { messages };
    if (systemPrompt) body.system = systemPrompt;
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `AI request failed (${res.status})`);
    setUsedProvider({ id: "claude", name: "Claude" });
    return data.text || "";
  };

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput(""); setLoading(true); setIsTyping(true);
    const newMsgs = [...messages, { role: "user", content: msg }];
    setMessages(newMsgs);
    setTimeout(() => setIsTyping(false), 800);
    try {
      const ctx = buildContext(leads, units, projects, salePricing, leasePricing, activities, currentUser);
      const reply = await callAI(ctx, newMsgs.slice(-12));
      setMessages(p => [...p, { role: "assistant", content: reply }]);
      if (msg.toLowerCase().includes("auto-fill") || msg.toLowerCase().includes("add lead")) {
        const name = reply.match(/name[:\s*]*([A-Z][a-zA-Z\s]{2,30})(?:\n|,|\||\*)/i)?.[1]?.trim();
        const phone = reply.match(/(\+971\d{8,9}|\+\d{10,14})/)?.[0];
        const email = reply.match(/[\w.-]+@[\w.-]+\.\w{2,}/)?.[0];
        const budget = reply.match(/(?:budget|AED)[:\s*]*([0-9,]+(?:\.[0-9]+)?(?:M|m)?)/i)?.[1];
        if (name || phone) {
          let b = 0;
          if (budget) { const r = budget.replace(/,/g, ""); b = r.toLowerCase().includes("m") ? parseFloat(r) * 1e6 : parseFloat(r); }
          setSuggestion({ name: name || "", phone: phone || "", email: email || "", budget: b, notes: "" });
        }
      }
    } catch (e) {
      const noKey = e.message.includes("No API key");
      setMessages(p => [...p, { role: "assistant", content: noKey
        ? `To activate ${aiFullName}, please click **Configure ${aiFullName}** above and add a free API key.`
        : `I encountered an issue: ${e.message}. Please try again.` }]);
      if (noKey) setShowSetup(true);
    }
    setLoading(false);
  };

  const fmt = (text) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
      if (/^#{1,3}\s/.test(line)) return <div key={i} style={{ fontWeight: 800, fontSize: 14, color: "#0F2540", marginTop: 10, marginBottom: 4 }}>{line.replace(/^#+\s/, "")}</div>;
      if (/^\*\*(.+)\*\*$/.test(line)) return <div key={i} style={{ fontWeight: 700, color: "#0F2540", marginTop: 6, marginBottom: 2 }}>{line.replace(/\*\*/g, "")}</div>;
      if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*  ")) {
        const txt = line.replace(/^[•\-\*]\s*/, "");
        const parts = txt.split(/\*\*(.+?)\*\*/g);
        return <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 3, paddingLeft: 4 }}>
          <span style={{ color: "#C9A84C", fontWeight: 700, flexShrink: 0, marginTop: 2 }}>◆</span>
          <span>{parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: "#0F2540" }}>{p}</strong> : p)}</span>
        </div>;
      }
      const parts = line.split(/\*\*(.+?)\*\*/g);
      return <div key={i} style={{ marginBottom: 3, lineHeight: 1.7 }}>{parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: "#0F2540" }}>{p}</strong> : p)}</div>;
    });
  };

  const hasAnyKey = true;
  const catColors = { analytics: "#1A5FA8", inventory: "#1A7F5A", leads: "#5B3FAA", leasing: "#9B7FD4", communication: "#A06810", action: "#B83232" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F7F8FC" }}>

      <div style={{ background: "#fff", padding: "18px 24px 14px", flexShrink: 0, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(201,168,76,.08)" }} />
        <div style={{ position: "absolute", bottom: -30, right: 60, width: 80, height: 80, borderRadius: "50%", background: "rgba(201,168,76,.05)" }} />
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: "linear-gradient(135deg,#C9A84C,#E8C97A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#0F2540", boxShadow: "0 4px 16px rgba(201,168,76,.4)", flexShrink: 0 }}>
              ✦
            </div>
            <div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>
                {aiFullName}
              </div>
              <div style={{ fontSize: 11, color: "rgba(201,168,76,.8)", marginTop: 2, letterSpacing: ".5px", textTransform: "uppercase" }}>
                Real Estate Intelligence Concierge
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1A7F5A", boxShadow: "0 0 6px #1A7F5A" }} />
                <span style={{ fontSize: 10, color: "#64748B" }}>
                  {leads.length} contacts · {units.filter(u => u.status === "Available").length} available units · {projects.length} projects
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 5, marginTop: 12, flexWrap: "wrap" }}>
          <div style={{
            padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600,
            border: "1px solid rgba(201,168,76,.3)",
            background: "rgba(201,168,76,.15)",
            color: "#C9A84C",
            display: "flex", alignItems: "center", gap: 4
          }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#1A7F5A", display: "inline-block" }} />
            Powered by Claude
          </div>
        </div>
      </div>

      <div style={{ padding: "12px 24px 0", flexShrink: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#A0AEC0", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>Quick Actions</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {QUICK.map(q => (
            <button key={q.label} onClick={() => send(q.msg)} disabled={loading || !hasAnyKey} style={{
              padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: !hasAnyKey ? "not-allowed" : "pointer",
              border: `1px solid ${catColors[q.category] || "#E2E8F0"}22`,
              background: `${catColors[q.category] || "#718096"}11`,
              color: !hasAnyKey ? "#C0C0C0" : (catColors[q.category] || "#718096"),
              display: "flex", alignItems: "center", gap: 5, transition: "all .15s", whiteSpace: "nowrap",
            }}
            onMouseOver={e => { if (hasAnyKey) { e.currentTarget.style.background = `${catColors[q.category]}22`; e.currentTarget.style.transform = "translateY(-1px)"; } }}
            onMouseOut={e => { e.currentTarget.style.background = `${catColors[q.category]}11`; e.currentTarget.style.transform = "none"; }}>
              {q.icon} {q.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14,
              background: m.role === "user" ? "#0F2540" : "linear-gradient(135deg,#C9A84C,#E8C97A)",
              color: m.role === "user" ? "#C9A84C" : "#0F2540",
              boxShadow: m.role === "assistant" ? "0 2px 8px rgba(201,168,76,.3)" : "none"
            }}>
              {m.role === "user" ? (currentUser.full_name || "U").charAt(0).toUpperCase() : "✦"}
            </div>
            <div style={{
              maxWidth: "72%",
              background: m.role === "user" ? "#1E3A5F" : "#fff",
              color: m.role === "user" ? "#fff" : "#2D3748",
              borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              padding: "12px 16px", fontSize: 13, lineHeight: 1.7,
              border: m.role === "assistant" ? "1px solid #E8EDF3" : "none",
              boxShadow: m.role === "assistant" ? "0 2px 12px rgba(0,0,0,.06)" : "0 2px 8px rgba(11,31,58,.2)",
            }}>
              {m.role === "assistant" ? fmt(m.content) : m.content}
              {m.role === "assistant" && i === messages.length - 1 && usedProvider && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #F0F2F5", fontSize: 10, color: "#A0AEC0", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#1A7F5A", display: "inline-block" }} />
                  {aiFullName} · Powered by {usedProvider.name}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#C9A84C,#E8C97A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: "#0F2540", boxShadow: "0 2px 8px rgba(201,168,76,.3)" }}>✦</div>
            <div style={{ background: "#fff", border: "1px solid #E8EDF3", borderRadius: "16px 16px 16px 4px", padding: "14px 18px", boxShadow: "0 2px 12px rgba(0,0,0,.06)", display: "flex", gap: 5, alignItems: "center" }}>
              {[0, .15, .3].map((d, i) => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#C9A84C", animationName: "aipulse", animationDuration: "1.2s", animationDelay: `${d}s`, animationIterationCount: "infinite", animationTimingFunction: "ease-in-out" }} />
              ))}
              <style>{`@keyframes aipulse{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}`}</style>
              <span style={{ fontSize: 11, color: "#A0AEC0", marginLeft: 6 }}>{aiFullName} is thinking…</span>
            </div>
          </div>
        )}

        {suggestion && (
          <div style={{ background: "#fff", border: "1px solid rgba(201,168,76,.3)", borderRadius: 14, padding: "16px 18px", boxShadow: "0 4px 20px rgba(11,31,58,.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>✦</span>
              <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, fontWeight: 700, color: "#C9A84C" }}>{aiFullName} detected a lead — add to CRM?</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {[["Name", suggestion.name], ["Phone", suggestion.phone], ["Email", suggestion.email || "—"], ["Budget", suggestion.budget ? `AED ${Number(suggestion.budget).toLocaleString()}` : "—"]].map(([l, v]) => (
                <div key={l} style={{ background: "rgba(255,255,255,.07)", borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 9, color: "rgba(201,168,76,.7)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 2 }}>{l}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{v || "—"}</div>
                </div>
              ))}
            </div>
            <textarea placeholder="Add notes…" rows={2} value={suggestion.notes}
              onChange={e => setSuggestion(s => ({ ...s, notes: e.target.value }))}
              style={{ width: "100%", padding: "8px 10px", border: "1px solid rgba(255,255,255,.15)", borderRadius: 8, fontSize: 12, resize: "none", background: "rgba(255,255,255,.08)", color: "#fff", boxSizing: "border-box", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={async () => {
                try {
                  const { data, error } = await supabase.from("leads").insert({
                    name: suggestion.name, phone: suggestion.phone || null, email: suggestion.email || null,
                    budget: suggestion.budget || 0, source: "AI Import", stage: "New Lead",
                    notes: suggestion.notes || null, assigned_to: currentUser.id,
                    company_id: currentUser.company_id || null,
                    stage_updated_at: new Date().toISOString(), created_by: currentUser.id
                  }).select().single();
                  if (error) throw error;
                  writeBrokerCreatedLog(data, currentUser);
                  showToast(`${suggestion.name} added successfully`, "success");
                  setSuggestion(null);
                } catch (e) { showToast(e.message, "error"); }
              }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#C9A84C", color: "#0F2540", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                + Add to CRM
              </button>
              <button onClick={() => setSuggestion(null)} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,.2)", background: "transparent", color: "rgba(255,255,255,.6)", fontSize: 13, cursor: "pointer" }}>
                Dismiss
              </button>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "0 24px 20px", flexShrink: 0 }}>
        <div style={{
          display: "flex", gap: 8, background: "#fff",
          border: "1.5px solid #E2E8F0", borderRadius: 16,
          padding: "10px 10px 10px 16px",
          boxShadow: "0 4px 20px rgba(0,0,0,.08)",
          transition: "border-color .2s",
        }}
        onFocus={e => e.currentTarget.style.borderColor = "#C9A84C"}
        onBlur={e => e.currentTarget.style.borderColor = "#E2E8F0"}>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={`Ask ${aiFullName} anything… "Show units under AED 3M" · "Draft a proposal for Ahmed" · "Which leads need attention?"`}
            rows={1}
            style={{ flex: 1, border: "none", outline: "none", resize: "none", fontSize: 13, lineHeight: 1.6,
              minHeight: 40, maxHeight: 120, fontFamily: "inherit",
              background: "transparent", color: hasAnyKey ? "#0F2540" : "#A0AEC0" }}
          />
          <button onClick={() => send()} disabled={loading || !input.trim() || !hasAnyKey} style={{
            padding: "10px 20px", borderRadius: 12, border: "none",
            background: loading || !input.trim() || !hasAnyKey ? "#E2E8F0" : "#1E3A5F",
            color: loading || !input.trim() || !hasAnyKey ? "#A0AEC0" : "#C9A84C",
            fontSize: 13, fontWeight: 700, cursor: loading || !input.trim() || !hasAnyKey ? "not-allowed" : "pointer",
            transition: "all .2s", alignSelf: "flex-end",
            boxShadow: !loading && input.trim() && hasAnyKey ? "0 2px 8px rgba(11,31,58,.3)" : "none",
          }}>
            {loading ? "…" : "Send ↑"}
          </button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#A0AEC0", padding: "0 4px" }}>
          <span>Enter to send · Shift+Enter for new line</span>
          <span>{aiFullName} · Powered by Claude</span>
        </div>
      </div>
    </div>
  );
}

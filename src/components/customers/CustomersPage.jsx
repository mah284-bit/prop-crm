import React, { useState, useMemo } from "react";

// ── Phase 2.5 — Customers Screen ───────────────────────────────
// Shows leads that have converted to customers (lifecycle_stage in
// 'customer' / 'portfolio_customer'). Data is already on the lead rows
// (stamped by the convert_lead_to_customer trigger). Receives `leads`
// as a prop and filters client-side — no new DB query, company-scoping
// is inherited from how leads were loaded in App.jsx.

const BRAND_NAVY = "#0F2540";
const BRAND_GOLD = "#C9A84C";

const INTENT_META = {
  investor:       { label: "Investor",       c: "#1A7F5A", bg: "#E6F4EE" },
  owner_occupier: { label: "Owner-Occupier", c: "#1A5FA8", bg: "#E6EFF9" },
  hybrid:         { label: "Hybrid",         c: "#8A6200", bg: "#FDF3DC" },
  corporate:      { label: "Corporate",      c: "#5B21B6", bg: "#EDE9FE" },
  reseller:       { label: "Reseller",       c: "#B83232", bg: "#FCE8E8" },
};

const STAGE_META = {
  customer:           { label: "Customer",           c: "#1A7F5A", bg: "#E6F4EE" },
  portfolio_customer: { label: "Portfolio Customer", c: "#5B21B6", bg: "#EDE9FE" },
};

const fmtAED = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `AED ${(v / 1_000).toFixed(0)}K`;
  return `AED ${v.toLocaleString()}`;
};

const fmtDate = (d) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
};

export default function CustomersPage({ leads = [], currentUser, showToast, onNavigateToLead }) {
  const [intentFilter, setIntentFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Only customers / portfolio customers
  const customers = useMemo(() => {
    return (leads || []).filter(
      (l) => l && (l.lifecycle_stage === "customer" || l.lifecycle_stage === "portfolio_customer")
    );
  }, [leads]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (intentFilter !== "all" && c.buyer_intent !== intentFilter) return false;
      if (stageFilter !== "all" && c.lifecycle_stage !== stageFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${c.name || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [customers, intentFilter, stageFilter, search]);

  // Summary metrics
  const totalValue = useMemo(
    () => filtered.reduce((s, c) => s + (Number(c.total_purchases_aed) || 0), 0),
    [filtered]
  );
  const portfolioCount = useMemo(
    () => customers.filter((c) => c.lifecycle_stage === "portfolio_customer").length,
    [customers]
  );

  const SEGMENTS = [
    { id: "all", label: "All" },
    { id: "investor", label: "Investor" },
    { id: "owner_occupier", label: "Owner-Occupier" },
    { id: "hybrid", label: "Hybrid" },
    { id: "corporate", label: "Corporate" },
    { id: "reseller", label: "Reseller" },
  ];

  return (
    <div style={{ padding: "8px 4px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: BRAND_NAVY, margin: "0 0 2px" }}>Customers</h2>
      <div style={{ fontSize: 13, color: "#718096", marginBottom: 16 }}>
        Leads who became customers — converted automatically when a deal reached Reserved / Closed Won / SPA Signed.
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <SummaryCard label="Total Customers" value={customers.length} />
        <SummaryCard label="Portfolio Customers" value={portfolioCount} hint="2+ properties" />
        <SummaryCard label="Total Purchase Value" value={fmtAED(totalValue)} wide />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Search name, phone, email…"
          style={{ flex: "1 1 260px", minWidth: 200, padding: "9px 13px", border: "1.5px solid #E2E8F0", borderRadius: 9, fontSize: 13, outline: "none", boxSizing: "border-box" }}
        />
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}
          style={{ padding: "9px 13px", border: "1.5px solid #E2E8F0", borderRadius: 9, fontSize: 13, background: "#fff" }}>
          <option value="all">All Stages</option>
          <option value="customer">Customer</option>
          <option value="portfolio_customer">Portfolio Customer</option>
        </select>
      </div>

      {/* Intent segment pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {SEGMENTS.map((sg) => (
          <button key={sg.id} onClick={() => setIntentFilter(sg.id)}
            style={{
              padding: "5px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer",
              fontWeight: intentFilter === sg.id ? 700 : 500,
              border: intentFilter === sg.id ? `1.5px solid ${BRAND_GOLD}` : "1.5px solid #E2E8F0",
              background: intentFilter === sg.id ? "#FDF6E3" : "#fff",
              color: intentFilter === sg.id ? BRAND_NAVY : "#64748B",
            }}>{sg.label}</button>
        ))}
      </div>

      {/* Customer cards */}
      {filtered.length === 0 ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: "#94A3B8", fontSize: 14 }}>
          {customers.length === 0
            ? "No customers yet. Leads convert automatically when a deal reaches Reserved / Closed Won / SPA Signed."
            : "No customers match these filters."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {filtered.map((c) => {
            const intent = INTENT_META[c.buyer_intent];
            const stage = STAGE_META[c.lifecycle_stage];
            return (
              <div key={c.id}
                onClick={() => onNavigateToLead && onNavigateToLead(c.id)}
                style={{ border: "1px solid #E2E8F0", borderRadius: 12, padding: 16, background: "#fff", cursor: onNavigateToLead ? "pointer" : "default", transition: "box-shadow .15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 14px rgba(15,37,64,.10)")}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: BRAND_NAVY }}>{c.name || "Unnamed"}</div>
                  {stage && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: stage.bg, color: stage.c, whiteSpace: "nowrap" }}>{stage.label}</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {intent && (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: intent.bg, color: intent.c }}>{intent.label}</span>
                  )}
                  {c.phone && <span style={{ fontSize: 11, color: "#718096" }}>📞 {c.phone}</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, borderTop: "1px solid #F1F5F9", paddingTop: 12 }}>
                  <Metric label="Properties" value={c.portfolio_size || 0} />
                  <Metric label="Total Value" value={fmtAED(c.total_purchases_aed)} />
                  <Metric label="Customer Since" value={fmtDate(c.became_customer_at)} />
                  <Metric label="Email" value={c.email || "—"} small />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, hint, wide }) {
  return (
    <div style={{ flex: wide ? "1 1 200px" : "0 0 auto", minWidth: 150, border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 18px", background: "#fff" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#0F2540" }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

function Metric({ label, value, small }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
      <div style={{ fontSize: small ? 11 : 14, fontWeight: 700, color: "#0F2540", marginTop: 2, wordBreak: "break-word" }}>{value}</div>
    </div>
  );
}

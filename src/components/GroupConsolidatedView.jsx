// GroupConsolidatedView — group-level cockpit: rollup KPIs + branch comparison + consolidated pipeline.
// Reads from getGroupConsolidatedData (the ONE resolver). Group-scoped, no-blanks gate for standalone.
import { useState, useEffect } from "react";
import { getGroupConsolidatedData } from "./getGroupConsolidatedData.js";

const fmtM = (n) => {
  if (!n) return "0";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return String(Math.round(n));
};

export default function GroupConsolidatedView({ currentUser }) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await getGroupConsolidatedData(currentUser);
      if (!cancelled) setState({ loading: false, ...res });
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  if (state.loading) {
    return (
      <div className="fade-in" style={{ padding: "2rem", textAlign: "center", color: "#718096" }}>
        Loading group data…
      </div>
    );
  }

  // no-blanks gate: standalone / individual / not-in-a-group
  if (state.error) {
    return (
      <div className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 14, padding: "3rem", textAlign: "center" }}>
        <div style={{ fontSize: 48 }}>🏛</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: "#0F2540" }}>Group View</div>
        <div style={{ fontSize: 14, color: "#718096", maxWidth: 460, lineHeight: 1.7 }}>{state.error}</div>
        <div style={{ fontSize: 12, color: "#A0AEC0", maxWidth: 460 }}>
          Group View consolidates pipeline, wins and agent performance across all branches in a group. Link this account to a group in Settings to enable it.
        </div>
      </div>
    );
  }

  const { group, branches, rollup } = state;
  const navy = "#0F2540", gold = "#C9A84C";

  const KPI = ({ label, value, sub, accent }) => (
    <div style={{ flex: 1, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "0.85rem 1rem", borderTop: `3px solid ${accent || gold}` }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, fontWeight: 700, color: navy, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#A0AEC0", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* header */}
      <div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: navy }}>
          🏛 {group?.name || "Group"} — Consolidated View
        </div>
        <div style={{ fontSize: 13, color: "#718096" }}>{rollup.branchCount} branches · {rollup.agentCount} agents</div>
      </div>

      {/* BAND 1 — rollup KPIs */}
      <div style={{ display: "flex", gap: 10 }}>
        <KPI label="Group Pipeline" value={`AED ${fmtM(rollup.totalPipeline)}`} sub={`${rollup.totalActive} active opps`} accent={navy} />
        <KPI label="Won Value" value={`AED ${fmtM(rollup.totalWonValue)}`} sub={`${rollup.totalWon} deals closed`} accent="#1A7F5A" />
        <KPI label="Branches" value={rollup.branchCount} sub="in this group" accent={gold} />
        <KPI label="Agents" value={rollup.agentCount} sub="across group" accent="#5B3FAA" />
        <KPI label="Avg Conversion" value={`${rollup.avgConv}%`} sub="branch average" accent="#A06810" />
      </div>

      {/* BAND 2 — branch comparison table */}
      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, color: navy, marginBottom: 10 }}>Branch Comparison</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 0.8fr 0.8fr", gap: 8, fontSize: 11, fontWeight: 700, color: "#718096", textTransform: "uppercase", letterSpacing: ".3px", paddingBottom: 8, borderBottom: "1px solid #E2E8F0" }}>
          <div>Branch</div>
          <div style={{ textAlign: "right" }}>Pipeline</div>
          <div style={{ textAlign: "right" }}>Active</div>
          <div style={{ textAlign: "right" }}>Won Value</div>
          <div style={{ textAlign: "right" }}>Won</div>
          <div style={{ textAlign: "right" }}>Conv.</div>
        </div>
        {branches.length === 0 && (
          <div style={{ padding: "16px 0", fontSize: 13, color: "#A0AEC0", textAlign: "center" }}>No branches in this group yet.</div>
        )}
        {branches.map((b) => (
          <div key={b.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 0.8fr 0.8fr", gap: 8, fontSize: 13, color: "#2D3748", padding: "9px 0", borderBottom: "1px solid #F0F2F5", alignItems: "center" }}>
            <div style={{ fontWeight: 600, color: navy }}>{b.name}<span style={{ fontSize: 11, color: "#A0AEC0", fontWeight: 400 }}>{b.business_type ? ` · ${b.business_type}` : ""}</span></div>
            <div style={{ textAlign: "right", fontWeight: 600 }}>AED {fmtM(b.pipeline)}</div>
            <div style={{ textAlign: "right" }}>{b.activeCount}</div>
            <div style={{ textAlign: "right", fontWeight: 600, color: "#1A7F5A" }}>AED {fmtM(b.wonValue)}</div>
            <div style={{ textAlign: "right" }}>{b.won}</div>
            <div style={{ textAlign: "right" }}>{b.conv}%</div>
          </div>
        ))}
      </div>

      {/* BAND 3 — consolidated note */}
      <div style={{ fontSize: 11, color: "#A0AEC0", textAlign: "center", padding: "4px 0" }}>
        Consolidated across all branches in {group?.name || "the group"} · group-scoped view
      </div>
    </div>
  );
}

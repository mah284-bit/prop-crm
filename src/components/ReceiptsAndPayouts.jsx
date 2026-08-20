import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase.js";

// Day 92: WHAT CAME IN, AND WHAT IS OWED OUT.
//
// The Commission Outstanding dashboard is built around what is OWED - so a settled invoice drops off
// it entirely, and "did Aldar pay AMP-2026-0001, and when?" had no answer on screen. That is the
// reconciliation an accountant does against a bank statement, and it could not be done.
//
// FOUNDER: "somewhere we need to see the settled invoice showing up, or a reconciliation form...
// and another report for managers and accounts to showcase the payments to the brokers."
//
// TWO HALVES, ONE QUESTION - money in from developers, money out to agents:
//  - RECEIPTS reads pp_commission_receipts, a row per payment (Day 92). A bulk settlement writes
//    several rows sharing a batch_id, so one transfer is shown as one line with the invoices it
//    cleared beneath it - which is how it arrived on the statement.
//  - PAYOUTS reads agent_commission off the invoice. ⚠️ IT SHOWS WHAT IS EARNED, NOT WHAT IS PAID:
//    there is no payout record yet, and a hierarchy of branch and group overrides is boarded and
//    not built. The heading says so rather than implying a settlement that has not happened.

const aed = (n) => "AED " + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "-");
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export default function ReceiptsAndPayouts({ currentUser, showToast }) {
  const [tab, setTab] = useState("receipts");
  const [receipts, setReceipts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [rRes, iRes, dRes, pRes] = await Promise.all([
          supabase.from("pp_commission_receipts")
            .select("id, invoice_id, developer_id, amount, received_date, reference, method, notes, batch_id, status, created_at")
            .eq("company_id", currentUser.company_id)
            .order("received_date", { ascending: false }),
          supabase.from("pp_commission_invoices")
            .select("id, opportunity_id, developer_id, invoice_number, invoice_status, commission_net, amount_received, agent_id, agent_commission, company_net, sale_price")
            .eq("company_id", currentUser.company_id),
          // Day 92: developers are a SHARED master list, not per-company - filtering by company_id
          // returned nothing and every receipt read "(no developer)".
          supabase.from("pp_developers").select("id, name"),
          supabase.from("profiles").select("id, full_name").eq("company_id", currentUser.company_id),
        ]);
        setReceipts(rRes.data || []);
        setInvoices(iRes.data || []);
        setDevelopers(dRes.data || []);
        setPeople(pRes.data || []);
      } catch (e) {
        showToast?.("Could not load: " + (e.message || e), "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser.company_id]);

  const devName = (id) => developers.find((d) => d.id === id)?.name || "(no developer)";
  const personName = (id) => people.find((p) => p.id === id)?.full_name || "(unassigned)";
  const invoiceOf = (id) => invoices.find((i) => i.id === id);

  const inRange = (d) => (!from || d >= from) && (!to || d <= to);

  // A bulk settlement is ONE transfer - group the rows that shared a batch so the list reads the way
  // the money actually arrived. A single receipt is its own group.
  const batches = useMemo(() => {
    const live = receipts.filter((r) => r.status !== "voided" && inRange(r.received_date));
    const map = {};
    live.forEach((r) => {
      const key = r.batch_id || ("single:" + r.id);
      if (!map[key]) {
        map[key] = {
          key, batch: !!r.batch_id, developer_id: r.developer_id,
          received_date: r.received_date, reference: r.reference, method: r.method,
          total: 0, lines: [],
        };
      }
      map[key].total = r2(map[key].total + Number(r.amount || 0));
      map[key].lines.push(r);
    });
    return Object.values(map).sort((a, b) => String(b.received_date).localeCompare(String(a.received_date)));
  }, [receipts, from, to, invoices]);

  const totalIn = r2(batches.reduce((t, b) => t + b.total, 0));

  // Day 95: WHAT WAS INVOICED AGAINST WHAT ARRIVED. The founder ruled out a dispute workflow - an
  // invoice is an invoice - but a shortfall can slip through a bulk settlement unnoticed: one
  // transfer clears eight invoices oldest-first, and a short payment leaves one quietly part-paid
  // until the aging says sixty days. Sorted by the gap, so what slipped sits at the top.
  const gaps = useMemo(() => {
    return invoices
      .filter((i) => !["draft", "written_off"].includes(i.invoice_status))
      .map((i) => {
        const billed = Number(i.commission_net || 0);
        const got = Number(i.amount_received || 0);
        const mine = receipts.filter((r) => r.invoice_id === i.id && r.status !== "voided");
        const batched = mine.filter((r) => r.batch_id);
        return {
          id: i.id, number: i.invoice_number || "(no number)",
          developer: devName(i.developer_id),
          billed, got, diff: r2(billed - got),
          receipts: mine.length,
          viaBatch: batched.length > 0,
          lastDate: mine.map((r) => r.received_date).filter(Boolean).sort().pop() || null,
        };
      })
      .filter((g) => Math.abs(g.diff) > 0.5)
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [invoices, receipts, developers]);

  // Earned per agent, from invoices that have been RAISED. Split between what the developer has
  // actually paid and what is still owed - a brokerage usually pays the agent on receipt.
  const payouts = useMemo(() => {
    const map = {};
    invoices.forEach((i) => {
      if (i.invoice_status === "draft" || i.invoice_status === "written_off") return;
      const share = Number(i.agent_commission || 0);
      if (!(share > 0)) return;
      const id = i.agent_id || "unassigned";
      if (!map[id]) map[id] = { agent_id: id, name: personName(i.agent_id), deals: 0, earned: 0, onReceived: 0, onOutstanding: 0 };
      const net = Number(i.commission_net || 0);
      const got = Number(i.amount_received || 0);
      const ratio = net > 0 ? Math.min(1, got / net) : 0;
      map[id].deals += 1;
      map[id].earned = r2(map[id].earned + share);
      map[id].onReceived = r2(map[id].onReceived + share * ratio);
      map[id].onOutstanding = r2(map[id].onOutstanding + share * (1 - ratio));
    });
    return Object.values(map).sort((a, b) => b.earned - a.earned);
  }, [invoices, people]);

  const T = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
  const TH = { padding: "7px 9px", fontWeight: 700, color: "#64748B", textAlign: "left", borderBottom: "1px solid #E2E8F0", fontSize: 10, textTransform: "uppercase", letterSpacing: ".4px" };
  const TD = { padding: "8px 9px", borderBottom: "1px solid #F1F5F9", color: "#0F2540" };
  const CARD = { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, padding: 14, marginBottom: 14 };

  return (
    <div style={{ padding: "1.25rem" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#0F2540" }}>Receipts &amp; payouts</div>
      <div style={{ fontSize: 12, color: "#64748B", marginBottom: 14 }}>
        What came in from developers, and what the brokerage owes its agents
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        {[["receipts", "Money in"], ["payouts", "Owed to agents"], ["gaps", "What does not match"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid " + (tab === k ? "#0F2540" : "#E2E8F0"), background: tab === k ? "#0F2540" : "#fff", color: tab === k ? "#fff" : "#475569", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {label}
          </button>
        ))}
        {tab === "receipts" && (
          <>
            <span style={{ marginLeft: 10, fontSize: 11, color: "#94A3B8" }}>From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: "5px 8px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 12 }} />
            <span style={{ fontSize: 11, color: "#94A3B8" }}>to</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: "5px 8px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 12 }} />
            {(from || to) && <button onClick={() => { setFrom(""); setTo(""); }} style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 11, cursor: "pointer" }}>Clear</button>}
          </>
        )}
      </div>

      {loading && <div style={{ fontSize: 13, color: "#64748B" }}>Loading…</div>}

      {!loading && tab === "receipts" && (
        <div style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#A0AEC0", textTransform: "uppercase", letterSpacing: ".5px" }}>
              {batches.length} receipt{batches.length === 1 ? "" : "s"}
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#166534" }}>{aed(totalIn)}</div>
          </div>
          {batches.length === 0 && <div style={{ fontSize: 12, color: "#94A3B8" }}>Nothing received in this period.</div>}
          {batches.map((b) => (
            <div key={b.key} style={{ border: "1px solid #E2E8F0", borderRadius: 9, marginBottom: 8, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: "#F8FAFC", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0F2540" }}>{devName(b.developer_id)}</span>
                <span style={{ fontSize: 11, color: "#64748B" }}>{dmy(b.received_date)}</span>
                {b.reference && <span style={{ fontSize: 11, color: "#64748B" }}>{"ref " + b.reference}</span>}
                {b.batch && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "#EEF2FF", color: "#3730A3" }}>{"ONE TRANSFER \u00b7 " + b.lines.length + " INVOICES"}</span>}
                <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: "#166534" }}>{aed(b.total)}</span>
              </div>
              <table style={T}>
                <tbody>
                  {b.lines.map((l) => {
                    const inv = invoiceOf(l.invoice_id);
                    return (
                      <tr key={l.id}>
                        <td style={{ ...TD, width: "30%" }}>{inv?.invoice_number || "(no number)"}</td>
                        <td style={{ ...TD, color: "#64748B" }}>{inv ? aed(inv.commission_net) + " invoiced" : ""}</td>
                        <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{aed(l.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === "gaps" && (
        <div style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#A0AEC0", textTransform: "uppercase", letterSpacing: ".5px" }}>
              {gaps.length === 0 ? "Everything reconciles" : gaps.length + " invoice" + (gaps.length === 1 ? "" : "s") + " do not match"}
            </div>
            {gaps.length > 0 && <div style={{ fontSize: 15, fontWeight: 800, color: "#B45309" }}>{aed(gaps.reduce((t, g) => t + g.diff, 0))}</div>}
          </div>
          <div style={{ fontSize: 11, color: "#64748B", marginBottom: 10 }}>
            What was invoiced against what arrived. A bulk settlement clears the oldest invoices first,
            so a short transfer can leave one quietly part-paid.
          </div>
          {gaps.length === 0 && <div style={{ fontSize: 12, color: "#166534" }}>Every issued invoice has been paid in full.</div>}
          {gaps.length > 0 && (
            <table style={T}>
              <thead>
                <tr>
                  <th style={TH}>Invoice</th>
                  <th style={TH}>Developer</th>
                  <th style={{ ...TH, textAlign: "right" }}>Invoiced</th>
                  <th style={{ ...TH, textAlign: "right" }}>Received</th>
                  <th style={{ ...TH, textAlign: "right" }}>Short by</th>
                  <th style={TH}>Last payment</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((g) => (
                  <tr key={g.id}>
                    <td style={{ ...TD, fontWeight: 600 }}>
                      {g.number}
                      {g.viaBatch && <span title="settled as part of one transfer covering several invoices" style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 9, background: "#EEF2FF", color: "#3730A3" }}>BULK</span>}
                    </td>
                    <td style={{ ...TD, color: "#64748B" }}>{g.developer}</td>
                    <td style={{ ...TD, textAlign: "right" }}>{aed(g.billed)}</td>
                    <td style={{ ...TD, textAlign: "right" }}>{aed(g.got)}</td>
                    <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: g.diff > 0 ? "#B91C1C" : "#166534" }}>
                      {g.diff > 0 ? aed(g.diff) : aed(-g.diff) + " over"}
                    </td>
                    <td style={{ ...TD, color: "#64748B" }}>{dmy(g.lastDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!loading && tab === "payouts" && (
        <div style={CARD}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#A0AEC0", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>
            Earned by agent
          </div>
          <div style={{ fontSize: 11, color: "#B45309", marginBottom: 10 }}>
            ⚠️ What each agent has EARNED on raised invoices. Payouts are not recorded yet, so nothing
            here says what has been paid to them.
          </div>
          <table style={T}>
            <thead>
              <tr>
                <th style={TH}>Agent</th>
                <th style={{ ...TH, textAlign: "center" }}>Deals</th>
                <th style={{ ...TH, textAlign: "right" }}>Earned</th>
                <th style={{ ...TH, textAlign: "right" }}>Against money received</th>
                <th style={{ ...TH, textAlign: "right" }}>Still with the developer</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 && (
                <tr><td style={TD} colSpan={5}><span style={{ color: "#94A3B8" }}>No raised invoices carry an agent share yet.</span></td></tr>
              )}
              {payouts.map((p) => (
                <tr key={p.agent_id}>
                  <td style={{ ...TD, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ ...TD, textAlign: "center", color: "#64748B" }}>{p.deals}</td>
                  <td style={{ ...TD, textAlign: "right", fontWeight: 700 }}>{aed(p.earned)}</td>
                  <td style={{ ...TD, textAlign: "right", color: "#166534", fontWeight: 700 }}>{aed(p.onReceived)}</td>
                  <td style={{ ...TD, textAlign: "right", color: "#92400E" }}>{aed(p.onOutstanding)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";

/**
 * Stage 6 — Commission Outstanding Dashboard (v2 with action modals)
 *
 * THE killer feature: replaces broker logging into 5+ developer portals daily.
 *
 * v2 (Phase 3b): Issue Invoice + Mark Received + Dispute action flows
 *
 * Spec: docs/Stage_4_5_6_REVISED_Spec.md (Stage 6 section)
 */
export default function CommissionOutstanding({ currentUser, showToast, developers: developersProp = [] }) {
  const [invoices, setInvoices] = useState([]);
  const [developers, setDevelopers] = useState(developersProp || []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDeveloper, setFilterDeveloper] = useState("all");
  /* stage1-filters */ const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterAging, setFilterAging] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Modal states
  const [issueModal, setIssueModal] = useState(null); // {invoice, number, date}
  const [paymentModal, setPaymentModal] = useState(null); // {invoice, amount, date, action}
  /* invoice-document */ const [docModal, setDocModal] = useState(null); // {invoice, particulars|null, loading}

  useEffect(() => {
    loadInvoices();
    loadDevelopers();
  }, []);

  // Load developers list for display + filter
  async function loadDevelopers() {
    try {
      const { data, error: dErr } = await supabase
        .from("pp_developers")
        .select("id, name")
        .order("name");
      if (dErr) throw dErr;
      if (data && data.length > 0) setDevelopers(data);
    } catch (err) {
      console.warn("Could not load developers list:", err);
      // Fall back to whatever was passed via props (or empty)
    }
  }

  // invoice-document — fetch deal particulars via opportunity_id, then open the document
  async function openInvoiceDoc(inv) {
    setDocModal({ invoice: inv, particulars: null, loading: true });
    try {
      let particulars = {};
      if (inv.opportunity_id) {
        const { data: opp } = await supabase.from("opportunities")
          .select("id, title, lead_id, unit_id, final_price, budget, commission_pct, master_agreement_id, won_at, stage_updated_at")
          .eq("id", inv.opportunity_id).single();
        if (opp) {
          particulars.opp = opp;
          if (opp.lead_id) {
            const { data: lead } = await supabase.from("leads").select("name, email, phone").eq("id", opp.lead_id).single();
            particulars.buyer = lead || null;
          }
          if (opp.unit_id) {
            const { data: unit } = await supabase.from("project_units")
              .select("unit_ref, sub_type, bedrooms, size_sqft, view, project_id").eq("id", opp.unit_id).single();
            particulars.unit = unit || null;
            if (unit && unit.project_id) {
              const { data: proj } = await supabase.from("projects").select("name, developer, community, emirate").eq("id", unit.project_id).single();
              particulars.project = proj || null;
            }
          }
          if (opp.master_agreement_id) {
            // Day 83: this queried a table called "master_agreements" which does not exist - the table is
            // pp_master_agreements - and asked for "title" and "agreement_number", which are
            // agreement_title and internal_reference. Three wrong names in one query, so the lookup
            // always failed and the invoice could never show WHICH agreement it was raised under.
            // .single() throws on no row, so this also broke the document modal silently.
            const { data: ma } = await supabase.from("pp_master_agreements").select("agreement_title, internal_reference, default_commission_pct").eq("id", opp.master_agreement_id).maybeSingle();
            particulars.agreement = ma || null;
          }
        }
      }
      setDocModal({ invoice: inv, particulars, loading: false });
    } catch (err) {
      console.error("Invoice particulars fetch failed:", err);
      setDocModal({ invoice: inv, particulars: {}, loading: false });
    }
  }
  async function loadInvoices() {
    try {
      setLoading(true);
      setError(null);
      const { data, error: dbErr } = await supabase
        .from("pp_commission_invoices")
        .select(`
          id, opportunity_id, sales_closure_id, developer_id, master_agreement_id,
          sale_price, commission_pct, commission_gross, vat_pct, vat_amount, commission_net,
          invoice_number, invoice_date, invoice_status, amount_received, last_payment_date,
          disputed_reason, notes, created_at, updated_at
        `)
        .order("created_at", { ascending: false });
      if (dbErr) throw dbErr;
      setInvoices(data || []);
    } catch (err) {
      console.error("Failed to load commission invoices:", err);
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  // Day 92: THE INVOICE NUMBER IS SUGGESTED, NOT DEMANDED.
  // A tax invoice needs a unique sequential number and the broker was being asked to invent one.
  // Three kinds of user, one answer: an established brokerage raises the invoice in their ERP and
  // records THAT reference here, so the field stays editable - but a small licensed broker has no
  // accounting system at all, and for him PropCRM IS the invoicing system.
  // ONE COMPANY-WIDE SERIES, not per developer: sequential numbering is the compliance requirement
  // and a single series is unambiguously compliant. The developer is named on the invoice anyway.
  // The unique index on (company_id, invoice_number) prevents a collision when two people issue at
  // the same moment; this only proposes.
  async function nextInvoiceNumber() {
    const year = new Date().getFullYear();
    try {
      const { data: co } = await supabase.from("companies")
        .select("name, invoice_prefix").eq("id", currentUser.company_id).maybeSingle();
      const prefix = (co?.invoice_prefix || "")
        || (co?.name || "INV").split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 4);
      const stem = prefix + "-" + year + "-";
      const { data: rows } = await supabase.from("pp_commission_invoices")
        .select("invoice_number").eq("company_id", currentUser.company_id)
        .not("invoice_number", "is", null).like("invoice_number", stem + "%");
      let top = 0;
      (rows || []).forEach(r => {
        const m = String(r.invoice_number).match(/(\d+)\s*$/);
        if (m) top = Math.max(top, parseInt(m[1], 10));
      });
      return stem + String(top + 1).padStart(4, "0");
    } catch (e) { return ""; }
  }

  // Issue Invoice — flip draft to issued with invoice number + date
  async function submitIssueInvoice() {
    if (!issueModal) return;
    if (!issueModal.number?.trim()) {
      showToast("Invoice number required", "error");
      return;
    }
    if (!issueModal.date) {
      showToast("Invoice date required", "error");
      return;
    }
    try {
      const { error: updErr } = await supabase
        .from("pp_commission_invoices")
        .update({
          invoice_number: issueModal.number.trim(),
          invoice_date: issueModal.date,
          invoice_status: "issued",
          updated_by: currentUser.id,
        })
        .eq("id", issueModal.invoice.id);
      if (updErr) throw updErr;
      showToast(`Invoice ${issueModal.number} issued`, "success");
      setIssueModal(null);
      await loadInvoices();
    } catch (err) {
      console.error("Issue invoice failed:", err);
      showToast(`Failed: ${err.message || "unknown"}`, "error");
    }
  }

  // Record Payment — add to amount_received, update status accordingly
  async function submitPayment() {
    if (!paymentModal) return;
    const { invoice, amount, date, action } = paymentModal;

    if (action === "payment") {
      const amt = Number(amount);
      if (!amt || amt <= 0) {
        showToast("Enter a valid amount", "error");
        return;
      }
      if (!date) {
        showToast("Payment date required", "error");
        return;
      }
      const newReceived = Number(invoice.amount_received || 0) + amt;
      const net = Number(invoice.commission_net);
      let newStatus = invoice.invoice_status;
      if (newReceived >= net - 0.01) newStatus = "paid";
      else if (newReceived > 0) newStatus = "partially_paid";

      try {
        const { error: updErr } = await supabase
          .from("pp_commission_invoices")
          .update({
            amount_received: newReceived,
            ...(paymentModal.followNote?.trim() ? { notes: paymentModal.followNote.trim() } : {}),
            last_payment_date: date,
            invoice_status: newStatus,
            updated_by: currentUser.id,
          })
          .eq("id", invoice.id);
        if (updErr) throw updErr;
        showToast(
          newStatus === "paid"
            ? `✅ Fully paid! AED ${amt.toLocaleString()} received`
            : `Payment of AED ${amt.toLocaleString()} recorded - ${newStatus}`,
          "success"
        );
        setPaymentModal(null);
        await loadInvoices();
      } catch (err) {
        console.error("Payment record failed:", err);
        showToast(`Failed: ${err.message || "unknown"}`, "error");
      }
    } else if (action === "dispute") {
      if (!paymentModal.reason?.trim()) {
        showToast("Reason required for dispute", "error");
        return;
      }
      try {
        const { error: updErr } = await supabase
          .from("pp_commission_invoices")
          .update({
            invoice_status: "disputed",
            disputed_reason: paymentModal.reason.trim(),
            updated_by: currentUser.id,
          })
          .eq("id", invoice.id);
        if (updErr) throw updErr;
        showToast("Invoice marked as disputed", "warning");
        setPaymentModal(null);
        await loadInvoices();
      } catch (err) {
        showToast(`Failed: ${err.message || "unknown"}`, "error");
      }
    }
  }

  // Lookups
  const developerName = (id) => developers.find(d => d.id === id)?.name || "(Unlinked)";

  const daysOutstanding = (inv) => {
    if (inv.invoice_status === "paid" || inv.invoice_status === "written_off") return 0;
    const baseDate = inv.invoice_date || inv.created_at;
    if (!baseDate) return 0;
    const days = Math.floor((Date.now() - new Date(baseDate).getTime()) / 86400000);
    return Math.max(0, days);
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (filterStatus !== "all" && inv.invoice_status !== filterStatus) return false;
      if (filterDeveloper !== "all" && inv.developer_id !== filterDeveloper) return false;
      if (filterDateFrom || filterDateTo) {
        const d = inv.invoice_date;
        if (!d) return false;
        if (filterDateFrom && d < filterDateFrom) return false;
        if (filterDateTo && d > filterDateTo) return false;
      }
      if (filterAging !== "all") {
        const days = daysOutstanding(inv);
        if (filterAging === "current" && days > 30) return false;
        if (filterAging === "mid" && (days <= 30 || days > 60)) return false;
        if (filterAging === "over" && days <= 60) return false;
      }
      if (overdueOnly) {
        const unpaid = inv.invoice_status !== "paid" && inv.invoice_status !== "written_off";
        if (!(unpaid && daysOutstanding(inv) > 60)) return false;
      }
      return true;
    });
  }, [invoices, filterStatus, filterDeveloper, filterDateFrom, filterDateTo, filterAging, overdueOnly]);

  const kpis = useMemo(() => {
    let totalInvoiced = 0, totalReceived = 0, totalOutstanding = 0, countActive = 0;
    filteredInvoices.forEach(inv => {
      const net = Number(inv.commission_net || 0);
      const received = Number(inv.amount_received || 0);
      if (inv.invoice_status === "written_off" || inv.invoice_status === "disputed") return;
      totalInvoiced += net;
      totalReceived += received;
      if (inv.invoice_status !== "paid") {
        totalOutstanding += (net - received);
        countActive++;
      }
    });
    const realizationRate = totalInvoiced > 0 ? Math.round((totalReceived / totalInvoiced) * 100) : 0;
    return { totalInvoiced, totalReceived, totalOutstanding, countActive, realizationRate };
  }, [filteredInvoices]);

  /* stage2-followup */ const followUp = useMemo(() => {
    let draftCount = 0, draftAmount = 0, overdueCount = 0, overdueAmount = 0;
    invoices.forEach(inv => {
      if (inv.invoice_status === "draft") { draftCount++; draftAmount += Number(inv.commission_net || 0); }
      const unpaid = inv.invoice_status !== "paid" && inv.invoice_status !== "written_off" && inv.invoice_status !== "draft";
      if (unpaid && daysOutstanding(inv) > 60) { overdueCount++; overdueAmount += Number(inv.commission_net || 0) - Number(inv.amount_received || 0); }
    });
    return { draftCount, draftAmount, overdueCount, overdueAmount };
  }, [invoices]);

  const byDeveloper = useMemo(() => {
    const map = {};
    filteredInvoices.forEach(inv => {
      if (inv.invoice_status === "paid" || inv.invoice_status === "written_off") return;
      const id = inv.developer_id || "unlinked";
      if (!map[id]) map[id] = { developer_id:id, developer_name:developerName(inv.developer_id), count:0, outstanding:0, oldestDays:0 };
      map[id].count += 1;
      map[id].outstanding += Number(inv.commission_net || 0) - Number(inv.amount_received || 0);
      const days = daysOutstanding(inv);
      if (days > map[id].oldestDays) map[id].oldestDays = days;
    });
    return Object.values(map).sort((a, b) => b.outstanding - a.outstanding);
  }, [filteredInvoices, developers]);

  const byAging = useMemo(() => {
    const buckets = { current: 0, overdue: 0, critical: 0 };
    filteredInvoices.forEach(inv => {
      if (inv.invoice_status === "paid" || inv.invoice_status === "written_off") return;
      const days = daysOutstanding(inv);
      const remaining = Number(inv.commission_net || 0) - Number(inv.amount_received || 0);
      if (days <= 30) buckets.current += remaining;
      else if (days <= 60) buckets.overdue += remaining;
      else buckets.critical += remaining;
    });
    return buckets;
  }, [filteredInvoices]);

  /* stage3-export */ function exportCSV() {
    const esc = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ["Status","Developer","Invoice #","Sale Price (AED)","Commission %","Gross (AED)","VAT (AED)","Net (AED)","Received (AED)","Outstanding (AED)","Invoice Date","Days Outstanding","Notes"];
    const rows = filteredInvoices.map(inv => {
      const net = Number(inv.commission_net || 0);
      const received = Number(inv.amount_received || 0);
      const outstanding = (inv.invoice_status === "paid" || inv.invoice_status === "written_off") ? 0 : (net - received);
      return [
        inv.invoice_status || "",
        developerName(inv.developer_id),
        inv.invoice_number || "",
        Number(inv.sale_price || 0),
        Number(inv.commission_pct || 0),
        Number(inv.commission_gross || 0),
        Number(inv.vat_amount || 0),
        net,
        received,
        outstanding,
        inv.invoice_date || "",
        inv.invoice_status === "paid" ? "" : daysOutstanding(inv),
        inv.notes || "",
      ].map(esc).join(",");
    });
    const csv = [headers.map(esc).join(","), ...rows].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commission_invoices_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredInvoices.length} invoice${filteredInvoices.length===1?"":"s"} to CSV`, "success");
  }
  const fmtAED = (n) => `AED ${Number(n || 0).toLocaleString()}`;
  const fmtDate = (d) => {
    if (!d) return "-";
    try { return new Date(d).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }); } catch { return d; }
  };

  const statusBadge = (status) => {
    const styles = {
      draft:           { bg:"#F1F5F9", fg:"#475569", label:"Draft" },
      issued:          { bg:"#DBEAFE", fg:"#1E40AF", label:"Issued" },
      partially_paid:  { bg:"#FEF3C7", fg:"#92400E", label:"Partial" },
      paid:            { bg:"#DCFCE7", fg:"#166534", label:"Paid" },
      disputed:        { bg:"#FEE2E2", fg:"#991B1B", label:"Disputed" },
      written_off:     { bg:"#F3F4F6", fg:"#6B7280", label:"Written Off" },
    };
    const s = styles[status] || styles.draft;
    return (<span style={{display:"inline-block",padding:"2px 9px",background:s.bg,color:s.fg,borderRadius:10,fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:0.4}}>{s.label}</span>);
  };

  // Action button selector based on status
  const actionForInvoice = (inv) => {
    if (inv.invoice_status === "draft") return { label:"Issue", action:() => setIssueModal({ invoice: inv, number:"", date: new Date().toISOString().slice(0,10) }) };
    if (inv.invoice_status === "issued" || inv.invoice_status === "partially_paid")
      return { label:"Manage", action:() => setPaymentModal({ invoice: inv, amount:"", date: new Date().toISOString().slice(0,10), action:"payment", reason:"" }) };
    return { label:"View", action:() => showToast(`Status: ${inv.invoice_status}`, "info") };
  };

  return (
    <div style={{padding:"20px", paddingBottom:"100px", maxWidth:1400, margin:"0 auto"}}>
      {/* Header */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18}}>
        <div>
          <h1 style={{fontSize:22, fontWeight:700, color:"#0F2540", margin:0}}>💰 Commission Outstanding</h1>
          <div style={{fontSize:12, color:"#718096", marginTop:4}}>Track commission receivables from each developer · No more juggling 5 portals</div>
        </div>
        <button onClick={loadInvoices} style={{padding:"7px 14px", borderRadius:7, border:"1px solid #E2E8F0", background:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", color:"#475569"}}>🔄 Refresh</button>
        <button onClick={exportCSV} disabled={filteredInvoices.length===0} title="Export the filtered list to CSV" style={{padding:"7px 14px", borderRadius:7, border:"1px solid #0F2540", background: filteredInvoices.length===0?"#F1F5F9":"#0F2540", color: filteredInvoices.length===0?"#94A3B8":"#fff", fontSize:12, fontWeight:600, cursor: filteredInvoices.length===0?"not-allowed":"pointer", marginLeft:8}}>⬇ Export CSV</button>
      </div>

      {loading && <div style={{padding:"40px", textAlign:"center", color:"#A0AEC0"}}>⏳ Loading commissions...</div>}
      {error && <div style={{padding:"14px", background:"#FEE2E2", border:"1px solid #FCA5A5", borderRadius:10, color:"#991B1B", fontSize:13}}><strong>Error:</strong> {error}</div>}

      {!loading && !error && invoices.length === 0 && (
        <div style={{background:"#FAFBFC", border:"2px dashed #E2E8F0", borderRadius:12, padding:"40px", textAlign:"center"}}>
          <div style={{fontSize:48, marginBottom:8, opacity:.5}}>💰</div>
          <div style={{fontSize:16, fontWeight:600, color:"#0F2540", marginBottom:6}}>No commission invoices yet</div>
          <div style={{fontSize:12, color:"#718096", maxWidth:480, margin:"0 auto"}}>Commission invoices are auto-created as draft when an opportunity moves to SPA Signed. Once you have closed deals, they'll appear here.</div>
        </div>
      )}

      {!loading && !error && invoices.length > 0 && (
        <>
          {/* KPI Cards */}
          <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:12, marginBottom:18}}>
            <div style={{background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, padding:"14px 16px"}}>
              <div style={{fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:".5px", marginBottom:4}}>Total Invoiced</div>
              <div style={{fontSize:18, fontWeight:700, color:"#0F2540"}}>{fmtAED(kpis.totalInvoiced)}</div>
            </div>
            <div style={{background:"#F0FDF4", border:"1px solid #86EFAC", borderRadius:10, padding:"14px 16px"}}>
              <div style={{fontSize:10, color:"#16A34A", textTransform:"uppercase", letterSpacing:".5px", marginBottom:4}}>Received</div>
              <div style={{fontSize:18, fontWeight:700, color:"#166534"}}>{fmtAED(kpis.totalReceived)}</div>
            </div>
            <div style={{background:"#FEF3C7", border:"1px solid #FCD34D", borderRadius:10, padding:"14px 16px"}}>
              <div style={{fontSize:10, color:"#92400E", textTransform:"uppercase", letterSpacing:".5px", marginBottom:4}}>Outstanding</div>
              <div style={{fontSize:18, fontWeight:700, color:"#92400E"}}>{fmtAED(kpis.totalOutstanding)}</div>
              <div style={{fontSize:10, color:"#92400E", marginTop:2}}>{kpis.countActive} active invoice{kpis.countActive===1?"":"s"}</div>
            </div>
            <div style={{background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, padding:"14px 16px"}}>
              <div style={{fontSize:10, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:".5px", marginBottom:4}}>Realization Rate</div>
              <div style={{fontSize:18, fontWeight:700, color:"#0F2540"}}>{kpis.realizationRate}%</div>
              <div style={{fontSize:10, color:"#718096", marginTop:2}}>received / invoiced</div>
            </div>
          </div>

          {/* stage2-followup action strip */}
          {(followUp.draftCount > 0 || followUp.overdueCount > 0) && (
            <div style={{display:"flex", gap:10, marginBottom:18, flexWrap:"wrap"}}>
              {followUp.draftCount > 0 && (
                <button onClick={()=>{setFilterStatus("draft");setOverdueOnly(false);}} style={{flex:"1 1 240px", textAlign:"left", cursor:"pointer", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:10, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                  <div><div style={{fontSize:12, fontWeight:700, color:"#1E40AF"}}>🧾 {followUp.draftCount} draft{followUp.draftCount===1?"":"s"} to invoice</div><div style={{fontSize:10, color:"#3B82F6", marginTop:2}}>Closed deals awaiting invoice · {fmtAED(followUp.draftAmount)}</div></div>
                  <span style={{fontSize:11, color:"#1E40AF", fontWeight:600}}>Review →</span>
                </button>
              )}
              {followUp.overdueCount > 0 && (
                <button onClick={()=>{setOverdueOnly(true);setFilterStatus("all");}} style={{flex:"1 1 240px", textAlign:"left", cursor:"pointer", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:10, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                  <div><div style={{fontSize:12, fontWeight:700, color:"#991B1B"}}>⏰ {followUp.overdueCount} overdue</div><div style={{fontSize:10, color:"#DC2626", marginTop:2}}>Past 60 days · {fmtAED(followUp.overdueAmount)} to chase</div></div>
                  <span style={{fontSize:11, color:"#991B1B", fontWeight:600}}>Chase →</span>
                </button>
              )}
            </div>
          )}

          {/* By Developer + By Aging */}
          <div style={{display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:14, marginBottom:18}}>
            <div style={{background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, padding:"14px"}}>
              <div style={{fontSize:11, fontWeight:700, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:".5px", marginBottom:10}}>Outstanding by Developer</div>
              {byDeveloper.length === 0 ? (
                <div style={{padding:"16px", textAlign:"center", color:"#A0AEC0", fontSize:12}}>No outstanding receivables</div>
              ) : (
                <div style={{display:"flex", flexDirection:"column", gap:6}}>
                  {byDeveloper.map(d => (
                    <div key={d.developer_id} style={{display:"grid", gridTemplateColumns:"1fr 60px 130px 70px", gap:8, alignItems:"center", padding:"8px 10px", background:"#F8FAFC", borderRadius:8}}>
                      <div style={{fontSize:13, fontWeight:600, color:"#0F2540"}}>{d.developer_name}</div>
                      <div style={{fontSize:11, color:"#718096", textAlign:"center"}}>{d.count} deal{d.count===1?"":"s"}</div>
                      <div style={{fontSize:13, fontWeight:700, color:"#92400E", textAlign:"right"}}>{fmtAED(d.outstanding)}</div>
                      <div style={{fontSize:11, color: d.oldestDays > 60 ? "#991B1B" : d.oldestDays > 30 ? "#92400E" : "#718096", textAlign:"right"}}>{d.oldestDays}d</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, padding:"14px"}}>
              <div style={{fontSize:11, fontWeight:700, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:".5px", marginBottom:10}}>Aging Breakdown</div>
              <div style={{display:"flex", flexDirection:"column", gap:8}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", background:"#F0FDF4", border:"1px solid #86EFAC", borderRadius:8}}>
                  <div><div style={{fontSize:12, fontWeight:600, color:"#166534"}}>Current</div><div style={{fontSize:10, color:"#16A34A"}}>0 – 30 days</div></div>
                  <div style={{fontSize:14, fontWeight:700, color:"#166534"}}>{fmtAED(byAging.current)}</div>
                </div>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", background:"#FEF3C7", border:"1px solid #FCD34D", borderRadius:8}}>
                  <div><div style={{fontSize:12, fontWeight:600, color:"#92400E"}}>Overdue</div><div style={{fontSize:10, color:"#A16207"}}>31 – 60 days</div></div>
                  <div style={{fontSize:14, fontWeight:700, color:"#92400E"}}>{fmtAED(byAging.overdue)}</div>
                </div>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", background:"#FEE2E2", border:"1px solid #FCA5A5", borderRadius:8}}>
                  <div><div style={{fontSize:12, fontWeight:600, color:"#991B1B"}}>Critical</div><div style={{fontSize:10, color:"#B91C1C"}}>60+ days</div></div>
                  <div style={{fontSize:14, fontWeight:700, color:"#991B1B"}}>{fmtAED(byAging.critical)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div style={{display:"flex", gap:10, marginBottom:10, alignItems:"center"}}>
            <span style={{fontSize:11, color:"#A0AEC0", fontWeight:600, textTransform:"uppercase"}}>Filter:</span>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{padding:"5px 10px", border:"1px solid #E2E8F0", borderRadius:6, fontSize:12}}>
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="partially_paid">Partial</option>
              <option value="paid">Paid</option>
              <option value="disputed">Disputed</option>
              <option value="written_off">Written Off</option>
            </select>
            <select value={filterDeveloper} onChange={e=>setFilterDeveloper(e.target.value)} style={{padding:"5px 10px", border:"1px solid #E2E8F0", borderRadius:6, fontSize:12}}>
              <option value="all">All Developers</option>
              {developers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input type="date" value={filterDateFrom} onChange={e=>setFilterDateFrom(e.target.value)} title="Invoice date from" style={{padding:"5px 8px", border:"1px solid #E2E8F0", borderRadius:6, fontSize:12, color:"#475569"}} />
            <span style={{fontSize:11, color:"#A0AEC0"}}>–</span>
            <input type="date" value={filterDateTo} onChange={e=>setFilterDateTo(e.target.value)} title="Invoice date to" style={{padding:"5px 8px", border:"1px solid #E2E8F0", borderRadius:6, fontSize:12, color:"#475569"}} />
            <select value={filterAging} onChange={e=>setFilterAging(e.target.value)} title="Aging" style={{padding:"5px 10px", border:"1px solid #E2E8F0", borderRadius:6, fontSize:12}}>
              <option value="all">All Ages</option>
              <option value="current">Current (≤30d)</option>
              <option value="mid">31–60 days</option>
              <option value="over">60+ days</option>
            </select>
            <button onClick={()=>setOverdueOnly(v=>!v)} style={{padding:"5px 12px", borderRadius:6, fontSize:12, fontWeight:600, cursor:"pointer", border: overdueOnly?"1px solid #991B1B":"1px solid #E2E8F0", background: overdueOnly?"#FEF2F2":"#fff", color: overdueOnly?"#991B1B":"#475569"}}>⏰ Overdue only</button>
            {(filterDateFrom||filterDateTo||filterAging!=="all"||overdueOnly||filterStatus!=="all"||filterDeveloper!=="all") && <button onClick={()=>{setFilterStatus("all");setFilterDeveloper("all");setFilterDateFrom("");setFilterDateTo("");setFilterAging("all");setOverdueOnly(false);}} style={{padding:"5px 10px", borderRadius:6, fontSize:11, cursor:"pointer", border:"1px solid #CBD5E1", background:"#fff", color:"#475569", fontWeight:600}}>Clear</button>}
            <span style={{fontSize:11, color:"#718096", marginLeft:"auto"}}>{filteredInvoices.length} of {invoices.length} invoices</span>
          </div>

          {/* Invoice list */}
          <div style={{background:"#fff", border:"1px solid #E2E8F0", borderRadius:10, overflow:"hidden"}}>
            <div style={{display:"grid", gridTemplateColumns:"90px 1fr 130px 110px 110px 60px 110px", gap:8, padding:"10px 14px", background:"#F8FAFC", borderBottom:"1px solid #E2E8F0", fontSize:10, fontWeight:700, color:"#A0AEC0", textTransform:"uppercase", letterSpacing:".5px"}}>
              <div>Status</div><div>Developer</div><div style={{textAlign:"right"}}>Sale Price</div><div style={{textAlign:"right"}}>Net Comm</div><div style={{textAlign:"right"}}>Received</div><div style={{textAlign:"center"}}>Days</div><div style={{textAlign:"right"}}>Action</div>
            </div>
            {filteredInvoices.length === 0 ? (
              <div style={{padding:"30px", textAlign:"center", color:"#A0AEC0", fontSize:12}}>No invoices match the filters</div>
            ) : (
              filteredInvoices.map(inv => {
                const act = actionForInvoice(inv);
                return (
                  <div key={inv.id} style={{display:"grid", gridTemplateColumns:"90px 1fr 130px 110px 110px 60px 110px", gap:8, padding:"10px 14px", alignItems:"center", borderBottom:"1px solid #F1F5F9", fontSize:12}}>
                    <div>{statusBadge(inv.invoice_status)}</div>
                    <div style={{color:"#0F2540", fontWeight:500}}>
                      {developerName(inv.developer_id)}
                      {inv.invoice_number && <div style={{fontSize:10, color:"#718096"}}>{inv.invoice_number}</div>}
                    </div>
                    <div style={{textAlign:"right", color:"#475569"}}>{fmtAED(inv.sale_price)}</div>
                    <div style={{textAlign:"right", fontWeight:600, color:"#0F2540"}}>{fmtAED(inv.commission_net)}</div>
                    <div style={{textAlign:"right", color: inv.amount_received > 0 ? "#16A34A" : "#A0AEC0"}}>{fmtAED(inv.amount_received)}</div>
                    <div style={{textAlign:"center", fontWeight:600, color: daysOutstanding(inv) > 60 ? "#991B1B" : daysOutstanding(inv) > 30 ? "#92400E" : "#718096"}}>{inv.invoice_status === "paid" ? "✓" : daysOutstanding(inv)}</div>
                    <div style={{textAlign:"right"}}>
                      <button onClick={()=>openInvoiceDoc(inv)} style={{padding:"4px 10px", background:"#fff", color:"#0F2540", border:"1px solid #0F2540", borderRadius:5, fontSize:10, fontWeight:600, cursor:"pointer", marginRight:6}}>📄 View</button>
                      <button onClick={act.action} style={{padding:"4px 10px", background:"#0F2540", color:"#fff", border:"none", borderRadius:5, fontSize:10, fontWeight:600, cursor:"pointer"}}>{act.label}</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* invoice-document modal */}
          {docModal && (()=>{
            const inv = docModal.invoice; const p = docModal.particulars || {};
            const due = inv.invoice_date ? new Date(new Date(inv.invoice_date).getTime()+60*864e5).toISOString().slice(0,10) : "On issue + 60 days";
            const devName = developerName(inv.developer_id);
            const propLine = [p.project?.name, p.unit?.unit_ref, p.unit?.sub_type, p.unit?.size_sqft?`${p.unit.size_sqft} sqft`:null].filter(Boolean).join(" · ");
            return (
              <div onClick={()=>setDocModal(null)} style={{position:"fixed",inset:0,background:"rgba(11,31,58,.55)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:1000,padding:"24px",overflowY:"auto"}}>
                <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,maxWidth:680,width:"100%",boxShadow:"0 24px 70px rgba(11,31,58,.35)",overflow:"hidden"}}>
                  {/* doc header */}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"20px 26px",borderBottom:"2px solid #0F2540"}}>
                    <div>
                      <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:800,color:"#0F2540"}}>{currentUser?.company_name||"Al Mansoori Properties"}</div>
                      <div style={{fontSize:11,color:"#64748B",marginTop:2}}>UAE Real Estate Brokerage · TRN: 100xxxxxxxxxxxx3</div>
                      <div style={{fontSize:11,color:"#64748B"}}>Dubai, United Arab Emirates</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:800,color:"#C9A84C"}}>COMMISSION INVOICE</div>
                      <div style={{fontSize:12,color:"#0F2540",fontWeight:700,marginTop:2}}>{inv.invoice_number||"(draft — number on issue)"}</div>
                      <div style={{fontSize:11,color:"#64748B"}}>Date: {inv.invoice_date||"—"}</div>
                      <div style={{fontSize:11,color:"#64748B"}}>Due: {due}</div>
                    </div>
                  </div>
                  {docModal.loading ? (
                    <div style={{padding:"40px",textAlign:"center",color:"#64748B",fontSize:13}}>Loading deal particulars…</div>
                  ) : (
                  <div style={{padding:"20px 26px"}}>
                    {/* billed to */}
                    <div style={{display:"flex",justifyContent:"space-between",gap:20,marginBottom:18}}>
                      <div>
                        <div style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>Billed To</div>
                        <div style={{fontSize:14,fontWeight:700,color:"#0F2540"}}>{devName}</div>
                        <div style={{fontSize:11,color:"#64748B"}}>Accounts Payable Dept.</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>Status</div>
                        <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{(inv.invoice_status||"draft").toUpperCase()}</div>
                      </div>
                    </div>
                    {/* RE particulars */}
                    <div style={{background:"#F7F9FC",borderRadius:8,padding:"12px 14px",marginBottom:16}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>Re: Commission for Property Transaction</div>
                      <table style={{width:"100%",fontSize:12,color:"#0F2540",borderCollapse:"collapse"}}>
                        <tbody>
                          <tr><td style={{padding:"3px 0",color:"#64748B",width:"40%"}}>Property</td><td style={{padding:"3px 0",fontWeight:600}}>{propLine||p.opp?.title||"—"}</td></tr>
                          {p.project?.community && <tr><td style={{padding:"3px 0",color:"#64748B"}}>Community</td><td style={{padding:"3px 0"}}>{p.project.community}{p.project.emirate?`, ${p.project.emirate}`:""}</td></tr>}
                          <tr><td style={{padding:"3px 0",color:"#64748B"}}>Buyer</td><td style={{padding:"3px 0",fontWeight:600}}>{p.buyer?.name||"—"}</td></tr>
                          <tr><td style={{padding:"3px 0",color:"#64748B"}}>Developer</td><td style={{padding:"3px 0"}}>{devName}</td></tr>
                          <tr><td style={{padding:"3px 0",color:"#64748B"}}>SPA / Closing date</td><td style={{padding:"3px 0"}}>{(p.opp?.won_at||p.opp?.stage_updated_at||"").slice(0,10)||"—"}</td></tr>
                          <tr><td style={{padding:"3px 0",color:"#64748B"}}>Agreement</td><td style={{padding:"3px 0"}}>{p.agreement?.title||p.agreement?.agreement_number||`Master Agreement with ${devName}`}</td></tr>
                        </tbody>
                      </table>
                    </div>
                    {/* calculation */}
                    <table style={{width:"100%",fontSize:13,borderCollapse:"collapse",marginBottom:16}}>
                      <thead><tr style={{borderBottom:"1px solid #E2E8F0"}}>
                        <th style={{textAlign:"left",padding:"8px 0",fontSize:10,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px"}}>Description</th>
                        <th style={{textAlign:"right",padding:"8px 0",fontSize:10,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px"}}>Amount (AED)</th>
                      </tr></thead>
                      <tbody>
                        <tr><td style={{padding:"7px 0",color:"#0F2540"}}>Sales commission @ {Number(inv.commission_pct).toFixed(2)}% of agreed sale price {fmtAED(inv.sale_price)}</td><td style={{textAlign:"right",padding:"7px 0",color:"#0F2540"}}>{fmtAED(inv.commission_gross)}</td></tr>
                        <tr><td style={{padding:"7px 0",color:"#64748B"}}>VAT @ {Number(inv.vat_pct).toFixed(0)}%</td><td style={{textAlign:"right",padding:"7px 0",color:"#64748B"}}>{fmtAED(inv.vat_amount)}</td></tr>
                        <tr style={{borderTop:"2px solid #0F2540"}}><td style={{padding:"9px 0",fontWeight:800,color:"#0F2540",fontSize:14}}>Total Payable</td><td style={{textAlign:"right",padding:"9px 0",fontWeight:800,color:"#0F2540",fontSize:14}}>{fmtAED(inv.commission_net)}</td></tr>
                        {Number(inv.amount_received)>0 && <tr><td style={{padding:"5px 0",color:"#16A34A"}}>Received</td><td style={{textAlign:"right",padding:"5px 0",color:"#16A34A"}}>{fmtAED(inv.amount_received)}</td></tr>}
                      </tbody>
                    </table>
                    {/* bank + terms */}
                    <div style={{background:"#F7F9FC",borderRadius:8,padding:"12px 14px",fontSize:11,color:"#64748B",marginBottom:8}}>
                      <div style={{fontWeight:700,color:"#0F2540",marginBottom:4}}>Payment Details</div>
                      <div>Bank: Emirates NBD · A/C Name: {currentUser?.company_name||"Al Mansoori Properties"} · IBAN: AE00 0000 0000 0000 0000 000</div>
                      <div style={{marginTop:4}}>Terms: Net commission due within 60 days of SPA signing. Please quote the invoice number with payment.</div>
                    </div>
                  </div>
                  )}
                  {/* actions */}
                  <div style={{display:"flex",justifyContent:"flex-end",gap:8,padding:"14px 26px",borderTop:"1px solid #E8EDF4",background:"#FAFBFE"}}>
                    <button onClick={()=>window.print()} style={{padding:"8px 16px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",color:"#475569"}}>🖨 Print</button>
                    {inv.invoice_status==="draft" && <button onClick={()=>{setDocModal(null);setIssueModal({invoice:inv,number:"",date:new Date().toISOString().slice(0,10)});}} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>📤 Issue & Send to Developer</button>}
                    {inv.invoice_status!=="draft" && <button onClick={()=>setDocModal(null)} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Close</button>}
                  </div>
                </div>
              </div>
            );
          })()}
          <div style={{marginTop:14, padding:"10px 14px", background:"#F0F4FA", borderRadius:8, border:"1px solid #DBE4F0", fontSize:11, color:"#1E2D3F", display:"flex", alignItems:"center", gap:10}}>
            <span style={{background:"#16A34A", color:"#fff", padding:"2px 8px", borderRadius:8, fontSize:9, fontWeight:700, letterSpacing:.5}}>STAGE 6 · COMPLETE</span>
            <span style={{color:"#6B7280"}}>Dashboard + Issue Invoice + Mark Received flows. Brokers replace 5 developer portals with 1 view.</span>
          </div>
        </>
      )}

      {/* ISSUE INVOICE MODAL */}
      {issueModal && (
        <div onClick={()=>setIssueModal(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,padding:"22px 24px",maxWidth:480,width:"100%",boxShadow:"0 20px 50px rgba(0,0,0,.15)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:16,fontWeight:700,color:"#0F2540"}}>📤 Issue Invoice</div>
              <button onClick={()=>setIssueModal(null)} style={{background:"transparent",border:"none",fontSize:18,cursor:"pointer",color:"#94A3B8"}}>×</button>
            </div>
            <div style={{padding:"10px 12px",background:"#F0F4FA",border:"1px solid #DBE4F0",borderRadius:8,marginBottom:14,fontSize:12,color:"#1E2D3F"}}>
              <div>Developer: <strong>{developerName(issueModal.invoice.developer_id)}</strong></div>
              <div>Sale Price: <strong>{fmtAED(issueModal.invoice.sale_price)}</strong></div>
              <div>Commission Net: <strong style={{color:"#16A34A"}}>{fmtAED(issueModal.invoice.commission_net)}</strong></div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Invoice Number *</label>
                <input type="text" value={issueModal.number} onChange={e=>setIssueModal({...issueModal,number:e.target.value})} placeholder="e.g. INV-2026-001" style={{width:"100%",padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:6,fontSize:13,boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Invoice Date *</label>
                <input type="date" value={issueModal.date} max={new Date().toISOString().slice(0,10)} onChange={e=>setIssueModal({...issueModal,date:e.target.value})} style={{width:"100%",padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:6,fontSize:13,boxSizing:"border-box"}}/>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setIssueModal(null)} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",color:"#475569"}}>Cancel</button>
              <button onClick={submitIssueInvoice} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>📤 Issue</button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT / DISPUTE MODAL */}
      {paymentModal && (
        <div onClick={()=>setPaymentModal(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:12,padding:"22px 24px",maxWidth:520,width:"100%",boxShadow:"0 20px 50px rgba(0,0,0,.15)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:16,fontWeight:700,color:"#0F2540"}}>{paymentModal.action === "dispute" ? "⚠️ Mark Disputed" : "💵 Record Payment"}</div>
              <button onClick={()=>setPaymentModal(null)} style={{background:"transparent",border:"none",fontSize:18,cursor:"pointer",color:"#94A3B8"}}>×</button>
            </div>
            <div style={{padding:"10px 12px",background:"#F0F4FA",border:"1px solid #DBE4F0",borderRadius:8,marginBottom:14,fontSize:12,color:"#1E2D3F"}}>
              <div>Invoice: <strong>{paymentModal.invoice.invoice_number || "(no number)"}</strong></div>
              <div>Net Amount: <strong>{fmtAED(paymentModal.invoice.commission_net)}</strong></div>
              <div>Already Received: <strong style={{color:"#16A34A"}}>{fmtAED(paymentModal.invoice.amount_received)}</strong></div>
              <div>Outstanding: <strong style={{color:"#92400E"}}>{fmtAED(Number(paymentModal.invoice.commission_net) - Number(paymentModal.invoice.amount_received||0))}</strong></div>
            </div>

            {/* Action toggle */}
            <div style={{display:"flex",gap:6,marginBottom:14,padding:3,background:"#F1F5F9",borderRadius:6}}>
              <button onClick={()=>setPaymentModal({...paymentModal,action:"payment"})} style={{flex:1,padding:"6px 10px",border:"none",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",background:paymentModal.action==="payment"?"#fff":"transparent",color:paymentModal.action==="payment"?"#0F2540":"#94A3B8"}}>💵 Record Payment</button>
              <button onClick={()=>setPaymentModal({...paymentModal,action:"dispute"})} style={{flex:1,padding:"6px 10px",border:"none",borderRadius:5,fontSize:11,fontWeight:700,cursor:"pointer",background:paymentModal.action==="dispute"?"#fff":"transparent",color:paymentModal.action==="dispute"?"#991B1B":"#94A3B8"}}>⚠️ Dispute</button>
            </div>

            {paymentModal.action === "payment" ? (
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Amount Received (AED) *</label>
                  <input type="number" value={paymentModal.amount} onChange={e=>setPaymentModal({...paymentModal,amount:e.target.value})} placeholder={`e.g. ${Number(paymentModal.invoice.commission_net).toLocaleString()}`} style={{width:"100%",padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:6,fontSize:13,boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Payment Date *</label>
                  <input type="date" value={paymentModal.date} max={new Date().toISOString().slice(0,10)} onChange={e=>setPaymentModal({...paymentModal,date:e.target.value})} style={{width:"100%",padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:6,fontSize:13,boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Follow-up Note</label>
                  <input type="text" value={paymentModal.followNote||""} onChange={e=>setPaymentModal({...paymentModal,followNote:e.target.value})} placeholder="e.g. Called Aldar accounts, payment promised by 15th" style={{width:"100%",padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:6,fontSize:13,boxSizing:"border-box"}}/>
                </div>
              </div>
            ) : (
              <div style={{marginBottom:14}}>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Reason for Dispute *</label>
                <textarea value={paymentModal.reason||""} onChange={e=>setPaymentModal({...paymentModal,reason:e.target.value})} placeholder="e.g. Developer disputes commission rate, claims final price was lower, etc." rows={3} style={{width:"100%",padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:6,fontSize:13,boxSizing:"border-box",resize:"vertical"}}/>
              </div>
            )}

            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setPaymentModal(null)} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",color:"#475569"}}>Cancel</button>
              <button onClick={submitPayment} style={{padding:"8px 18px",borderRadius:8,border:"none",background:paymentModal.action==="dispute"?"#991B1B":"#16A34A",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                {paymentModal.action === "dispute" ? "⚠️ Mark Disputed" : "✓ Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

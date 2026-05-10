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

  // Modal states
  const [issueModal, setIssueModal] = useState(null); // {invoice, number, date}
  const [paymentModal, setPaymentModal] = useState(null); // {invoice, amount, date, action}

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
      return true;
    });
  }, [invoices, filterStatus, filterDeveloper]);

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
    <div style={{padding:"20px", maxWidth:1400, margin:"0 auto"}}>
      {/* Header */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18}}>
        <div>
          <h1 style={{fontSize:22, fontWeight:700, color:"#0F2540", margin:0}}>💰 Commission Outstanding</h1>
          <div style={{fontSize:12, color:"#718096", marginTop:4}}>Track commission receivables from each developer · No more juggling 5 portals</div>
        </div>
        <button onClick={loadInvoices} style={{padding:"7px 14px", borderRadius:7, border:"1px solid #E2E8F0", background:"#fff", fontSize:12, fontWeight:600, cursor:"pointer", color:"#475569"}}>🔄 Refresh</button>
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
                      <button onClick={act.action} style={{padding:"4px 10px", background:"#0F2540", color:"#fff", border:"none", borderRadius:5, fontSize:10, fontWeight:600, cursor:"pointer"}}>{act.label}</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

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

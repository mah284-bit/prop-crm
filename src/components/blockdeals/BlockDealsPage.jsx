import { useState, useEffect } from "react";
import { useFreshData } from "../../lib/useFreshData.js";
import { supabase } from "../../lib/supabase.js";
import { getFees } from "../../lib/feeSettings.js";
import { startBookingClock, releaseBookingHold } from "../../lib/bookingClock.js";
import { PAYMENT_PLAN_PRESETS } from "../../modules/constants.js";
import DistributionCalculator from "./DistributionCalculator.jsx";
import BlockWorkspace from "./BlockWorkspace.jsx";
import UnitPicker from "../shared/UnitPicker.jsx";
import { useAsk } from "../shared/AskDialog.jsx";

export default function BlockDealsPage({ currentUser, showToast, onOpenOpp }) {
  const ask = useAsk();  // Day 92: in-app gates
  const [blocks, setBlocks] = useState([]);
  const [leads, setLeads] = useState([]);
  const [units, setUnits] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [buyerOpps, setBuyerOpps] = useState([]);
  const [adoptPick, setAdoptPick] = useState([]);
  const [developers, setDevelopers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [claimedUnitIds, setClaimedUnitIds] = useState(new Set());
  const [softClaims, setSoftClaims] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [calcBlock, setCalcBlock] = useState(null);
  const [wsBlock, setWsBlock] = useState(null);
  // Day 81: PAYMENT TERMS BELONG AT CREATION.
  // Founder: "the purpose of the block is to treat, propose, collect as ONE line, and the benefit
  // to the buyer is better discounts AND better payment plans." So the plan is part of what is
  // being PROPOSED, not an afterthought set later - and a block should never be composed without
  // it. Locked onto D1 by the calculator; changeable there and in the Money tab afterwards.
  const [form, setForm] = useState({ lead_id: "", title: "", developer_name: "", discount_mode: "pct", discount_value: "", reservation_expected: "", payment_plan_preset: "", dld_payer: "buyer" });
  // Day 79: the company's reservation fee POLICY x number of units - computed, not typed.
  // Founder ruling: "for this you have to sum or multiply with the number of units selected."
  const [feePolicy, setFeePolicy] = useState(null);
  useEffect(() => { (async () => {
    if (currentUser?.company_id) setFeePolicy(await getFees(currentUser.company_id));
  })(); }, [currentUser?.company_id]);
  const [lines, setLines] = useState([]);
  // Day 79: company reservation policy x units. MUST sit after `lines` - const-before-init.
  const suggestedReservation = feePolicy && lines.length
    ? feePolicy.reservationFee * lines.length : 0;
  const [unitPick, setUnitPick] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const cid = currentUser.company_id;
    const [b, l, u, sp, dv, op, pj, bl, ao] = await Promise.all([
      supabase.from("block_deals").select("*, block_deal_units(*)").eq("company_id", cid).order("created_at", { ascending: false }),
      supabase.from("leads").select("id, name, phone").eq("company_id", cid).order("name"),
      supabase.from("project_units").select("id, unit_ref, project_id, status").eq("status", "Available").order("unit_ref"),
      supabase.from("unit_sale_pricing").select("*"),
      supabase.from("pp_developers").select("id, name").order("name"),
      supabase.from("opportunities").select("id, title, lead_id, unit_id, stage, budget, current_agreed_price, project_units(unit_ref)").eq("status", "Active").is("block_deal_id", null).not("stage", "in", "(Reserved,SPA Requirements,SPA Signed,Closed Won,Closed Lost)"),
      supabase.from("projects").select("id, developer"),
      supabase.from("block_deal_units").select("unit_id, status, block_deal_id").neq("status", "dropped"),
      supabase.from("opportunities").select("unit_id, stage, status").eq("status", "Active").not("unit_id", "is", null),
    ]);
    // Day 83: SWEEP LAPSED HOLDS. There is no scheduler, so "automatic" means WHEN SOMEONE LOOKS -
    // a hold that lapsed Tuesday releases when a broker opens this list on Thursday. That is honest
    // as long as the RECORD says so, which is why the reason carries BOTH dates: nobody should
    // later think the app sat on it deliberately.
    // Only blocks this user can already see (RLS), only units still Booked, never a unit whose deal
    // has advanced past Offer Accepted - that ground is paid for.
    (async () => {
      const now = Date.now();
      for (const blk of (b.data || [])) {
        if (!blk.hold_expires_at || blk.hold_released_at) continue;
        if (["cancelled","completed"].includes(blk.status)) continue;
        if (new Date(blk.hold_expires_at).getTime() > now) continue;
        const lapsed = new Date(blk.hold_expires_at).toLocaleDateString("en-GB");
        const seen = new Date().toLocaleDateString("en-GB");
        await releaseBookingHold({
          block: blk, currentUser,
          reason: "Hold window expired " + lapsed + " without the reservation being collected; released " + seen + " when next seen.",
        });
      }
    })();
    setBlocks(b.data || []); setLeads(l.data || []); setUnits(u.data || []); setPricing(sp.data || []); setDevelopers(dv.data || []); setProjects(pj.data || []); setBuyerOpps(op.data || []);
    const blockById = {}; (b.data || []).forEach(x => { blockById[x.id] = x; });
    const hard = new Set((ao.data || []).map(x => x.unit_id).filter(Boolean));
    const soft = {};
    (bl.data || []).forEach(x => {
      const parent = blockById[x.block_deal_id];
      if (parent && x.unit_id) {
        if (parent.status === "confirmed" || parent.status === "completed") hard.add(x.unit_id);
        else if (parent.status !== "cancelled") soft[x.unit_id] = parent.title;
      }
    });
    setClaimedUnitIds(hard); setSoftClaims(soft);
    setLoading(false);
  };
  useFreshData(() => { load(); }, []);

  const listPriceOf = (u) => { const sp = pricing.find(s => s.unit_id === u?.id); return Number(sp?.asking_price ?? sp?.list_price ?? sp?.price ?? 0); };

  const addLine = () => {
    // Day 81: this used to live inside a setUnitPick UPDATER, with three showToast calls and a
    // nested setLines. React may run an updater DURING RENDER, so those toasts set state on App
    // mid-render - "Cannot update a component (App) while rendering a different component
    // (BlockDealsPage)". That is the likely root of the stale screens chased all day, and in
    // StrictMode it can also fire a toast twice. Validate first, toast outside, then set state.
    const u = units.find(x => x.id === unitPick);
    if (!u) { showToast("Pick a unit first", "error"); return; }
    if (claimedUnitIds.has(u.id)) { showToast(u.unit_ref + " is committed - active deal or confirmed block", "error"); return; }
    if (softClaims[u.id]) {
      const other = blocks.find(x => x.title === softClaims[u.id]);
      if (other && other.lead_id === form.lead_id) { showToast(u.unit_ref + " is already in this buyer" + String.fromCharCode(39) + "s block " + softClaims[u.id], "error"); return; }
      showToast("Note: " + u.unit_ref + " is also being negotiated in " + softClaims[u.id] + " - first to commit wins", "info");
    }
    setLines(ls => ls.some(x => x.unit_id === u.id) ? ls : [...ls, { unit_id: u.id, unit_ref: u.unit_ref, list_price: listPriceOf(u) }]);
    setUnitPick("");
  };

  const removeLine = (uid) => setLines(ls => ls.filter(x => x.unit_id !== uid));

  const adoptBlock = async () => {
    if (!form.lead_id) { showToast("Pick the buyer", "error"); return; }
    if (!form.title.trim()) { showToast("Title is required", "error"); return; }
    if (adoptPick.length < 2) { showToast("Adopt needs 2+ existing deals of this buyer", "error"); return; }
    const chosen = buyerOpps.filter(o => adoptPick.includes(o.id));
    if (chosen.some(o => o.lead_id !== form.lead_id)) { showToast("All adopted deals must belong to the selected buyer", "error"); return; }
    const cid = currentUser.company_id;
    const { data: bd, error } = await supabase.from("block_deals").insert({
      // Day 81: the OWNER must be set at creation. The Day-79 visibility ladder requires
      // assigned_to = auth.uid() for an agent to SEE a block, so a block created with a null
      // owner is invisible to its own creator - the .select() chained to the insert then fails,
      // which Supabase reports as an RLS violation on the insert itself.
      company_id: cid, assigned_to: currentUser.id, lead_id: form.lead_id, title: form.title.trim(),
      // Day 81: terms chosen at creation ride on the block until the calculator locks D1,
      // which is where they become versioned alongside the price they were agreed with.
      proposed_plan: form.payment_plan_preset || null,
      proposed_dld: form.dld_payer || "buyer",
      developer_name: form.developer_name || null, status: "negotiating", created_by: currentUser.id,
    }).select().single();
    if (error) { showToast(error.message, "error"); return; }
    for (const o of chosen) {
      const u = units.find(x => x.id === o.unit_id);
      const lp = u ? listPriceOf(u) : (Number(o.current_agreed_price) || Number(o.budget) || 0);
      const { error: le } = await supabase.from("block_deal_units").insert({
        company_id: cid, block_deal_id: bd.id, unit_id: o.unit_id, unit_ref: u ? u.unit_ref : (o.title || "unit"),
        list_price: lp, status: "confirmed", child_opportunity_id: o.id, status_reason: "Adopted from existing deal",
      });
      if (le) { showToast("Line failed: " + le.message, "error"); continue; }
      await supabase.from("opportunities").update({ block_deal_id: bd.id }).eq("id", o.id);
      await supabase.from("activities").insert({ opportunity_id: o.id, lead_id: o.lead_id, company_id: cid, type: "Note", status: "completed", user_id: currentUser.id, user_name: currentUser.full_name || null, stage_at_event: o.stage, activity_subtype: "block_adoption", note: "ADOPTED INTO BLOCK: " + bd.title + " - terms to be renegotiated via distribution calculator" });
    }
    showToast(chosen.length + " deals adopted into " + bd.title + " - open it and lock a distribution to set bulk terms", "success");
    setShowCreate(false); setForm({ lead_id: "", title: "", developer_name: "", discount_mode: "pct", discount_value: "", reservation_expected: "" }); setLines([]); setAdoptPick([]);
    load();
  };

    const recordApproval = async (b) => {
    const ref = await ask({
      title: "Developer approval for " + b.title,
      body: "The developer has agreed to the block terms. Record their approval reference so the record shows what was agreed and by whom.",
      needsReason: true,
      reasonLabel: "Approval reference",
      placeholder: "email ref, letter no, approval code",
      confirmLabel: "Record the approval",
    });
    if (ref === null || !ref.trim()) return;
    const who = await ask({
      title: "Who approved it?",
      body: "The name or desk at the developer who gave the approval.",
      needsReason: true,
      reasonLabel: "Name / desk",
      confirmLabel: "Save",
    });
    if (who === null) return;
    const { error } = await supabase.from("block_deals").update({
      developer_approved_at: new Date().toISOString(),
      developer_approval_ref: ref.trim(),
      approved_by_name: (who || "").trim() || null,
      status: "approved", updated_at: new Date().toISOString(),
    }).eq("id", b.id);
    if (error) { showToast(error.message, "error"); return; }
    showToast("Developer approval recorded - bulk terms can now flow to the deals", "success");
    load();
  };

const confirmBlock = async (b) => {
    const { data: dists } = await supabase.from("block_distributions").select("*").eq("block_deal_id", b.id).order("version", { ascending: false }).limit(1);
    const dl = dists && dists[0];
    if (!dl) { showToast("Lock a distribution first - confirmation births deals at D_latest prices", "error"); return; }
    const buyer = leads.find(x => x.id === b.lead_id);
    if (!buyer) { showToast("Buyer lead not found", "error"); return; }
    // IDEMPOTENCY GUARD (Day 77): NEVER trust the page's in-memory copy for a commitment.
    // Root cause of the Khalid double-birth: b.block_deal_units was loaded at page render, so
    // after a first confirm the stale copy still showed lines as "proposed" and a second click
    // birthed the whole set again (six children on three units).
    const { data: freshLines } = await supabase.from("block_deal_units")
      .select("id, unit_id, unit_ref, list_price, status, child_opportunity_id")
      .eq("block_deal_id", b.id);
    const alreadyBorn = (freshLines || []).filter(x => x.child_opportunity_id);
    if (alreadyBorn.length > 0) {
      showToast("This block is already confirmed - " + alreadyBorn.length + " deals were born. Nothing to do.", "error");
      return;
    }
    const activeLines = (freshLines || []).filter(x => x.status === "proposed");
    if (activeLines.length === 0) { showToast("No proposed lines to confirm", "error"); return; }
    if (!(await ask({
      title: "Confirm " + b.title + "?",
      body: "This is the commitment moment. It creates the deals and claims the units against the buyer.",
      detail: activeLines.length + " deal(s) born at offer " + dl.version + " prices",
      confirmLabel: "Confirm the block",
      cancelLabel: "Not yet",
    }))) return;
    let born = 0;
    // Day 84: resolved ONCE for the block - every unit shares a project and so a developer.
    let blockCommissionPct = null;
    try {
      const firstUnit = (units || []).find(u => u.id === activeLines[0]?.unit_id);
      if (firstUnit?.project_id) {
        const { data: r } = await supabase.rpc("get_commission_rate", { p_project_id: firstUnit.project_id, p_company_id: currentUser.company_id });
        if (r != null) blockCommissionPct = Number(r);
      }
    } catch (e) { console.warn("Block commission rate lookup failed:", e); }
    for (const ln of activeLines) {
      const alloc = (dl.allocations || []).find(x => x.unit_id === ln.unit_id);
      const net = alloc ? alloc.net_price : Number(ln.list_price || 0);
      const { data: opp, error: oe } = await supabase.from("opportunities").insert({
        company_id: currentUser.company_id, lead_id: b.lead_id,
        title: ln.unit_ref + " \u2014 " + buyer.name + " (block)",
        stage: "Offer Accepted", status: "Active", unit_id: ln.unit_id,
        budget: net, current_agreed_price: net,
        // Day 84: BIRTH MUST ALSO CARRY THE COMMISSION RATE. An agent cannot read
        // pp_master_agreements (RLS - it holds discount authority and signed contracts), so every
        // child was born with a null rate and the invoice later fell to the company default: 4%
        // where Aldar agreed 4.5%. A five-unit block birthed FIVE deals priced wrong at once.
        commission_pct: blockCommissionPct,
        // Day 81: BIRTH MUST CARRY THE TERMS. Confirm copied the price from D_latest but not the
        // payment plan or DLD, so children were born with a null plan and their first instalment
        // computed to ZERO - the block bill silently omitted the largest line. It only ever looked
        // right because "Set terms" on the Money tab cascades; birth never did.
        current_payment_plan_preset: dl.payment_plan_preset || null,
        current_dld_payer: dl.dld_payer || null,
        current_dld_split_pct: dl.dld_split_pct || null,
        block_deal_id: b.id, assigned_to: currentUser.id,
        notes: "Born from block deal " + b.title + " at D" + dl.version + (alloc ? " (" + (alloc.mode === "pct" ? alloc.value + "% off" : "AED " + Number(alloc.discount).toLocaleString() + " off") + ")" : ""),
        stage_updated_at: new Date().toISOString(),
      }).select().single();
      if (oe) { showToast(ln.unit_ref + " birth failed: " + oe.message, "error"); continue; }
      await supabase.from("project_units").update({ status: "Booked" }).eq("id", ln.unit_id);
      await supabase.from("activities").insert({ opportunity_id: opp.id, lead_id: b.lead_id, company_id: currentUser.company_id, type: "Note", status: "completed", user_id: currentUser.id, user_name: currentUser.full_name || null, lead_name: buyer.name, stage_at_event: "Offer Accepted", activity_subtype: "block_conversion", note: "BLOCK CONVERSION: " + b.title + " confirmed at D" + dl.version + " \u00b7 " + ln.unit_ref + " \u00b7 net AED " + Number(net).toLocaleString() });
      await supabase.from("block_deal_units").update({ status: "confirmed", child_opportunity_id: opp.id, updated_at: new Date().toISOString() }).eq("id", ln.id);
      born++;
    }
    if (born === 0) { showToast("No deals were born - block NOT confirmed. Check the errors above.", "error"); load(); return; }
    // Day 86: this update was UNCHECKED. On the walkthrough it failed silently - children born,
    // lines confirmed, units Booked, the clock stamped - and the block still read "approved".
    const { error: stErr } = await supabase.from("block_deals").update({ status: "confirmed", updated_at: new Date().toISOString() }).eq("id", b.id);
    if (stErr) { console.error("Block status not set:", stErr); showToast("Deals were born but the block status did not update: " + stErr.message, "error"); }
    // Day 83: CONFIRMATION STARTS THE CLOCK. This is the moment the units are claimed, so this is
    // when the promise begins - the hold is bought with a deadline rather than held for free.
    // Fire and forget: the clock is a governance layer over the confirm, never a way to fail it.
    startBookingClock({ block: b, currentUser }).then(r => {
      if (r && r.ok) showToast("Units held until " + new Date(r.expires_at).toLocaleDateString("en-GB") + " - collect the reservation before then", "info");
    }, e => console.warn("Booking clock not started:", e));
    showToast(born + " deals born at Offer Accepted from " + b.title + " - Terms Pending, units claimed", "success");
    load();
  };

  const saveBlock = async () => {
    if (!form.lead_id) { showToast("Pick the buyer", "error"); return; }
    if (!form.title.trim()) { showToast("Title is required", "error"); return; }
    if (lines.length < 2) { showToast("A block needs at least 2 units", "error"); return; }
    const cid = currentUser.company_id;
    const { data: bd, error } = await supabase.from("block_deals").insert({
      // Day 81: the OWNER must be set at creation. The Day-79 visibility ladder requires
      // assigned_to = auth.uid() for an agent to SEE a block, so a block created with a null
      // owner is invisible to its own creator - the .select() chained to the insert then fails,
      // which Supabase reports as an RLS violation on the insert itself.
      company_id: cid, assigned_to: currentUser.id, lead_id: form.lead_id, title: form.title.trim(),
      // Day 81: terms chosen at creation ride on the block until the calculator locks D1,
      // which is where they become versioned alongside the price they were agreed with.
      proposed_plan: form.payment_plan_preset || null,
      proposed_dld: form.dld_payer || "buyer",
      developer_name: form.developer_name || null,
      reservation_expected: form.reservation_expected ? Number(form.reservation_expected) : null,
      
      status: "draft", created_by: currentUser.id,
    }).select().single();
    if (error) { showToast(error.message, "error"); return; }
    const rows = lines.map(x => ({ company_id: cid, block_deal_id: bd.id, unit_id: x.unit_id, unit_ref: x.unit_ref, list_price: x.list_price, status: "proposed" }));
    const { error: e2 } = await supabase.from("block_deal_units").insert(rows);
    if (e2) { showToast(e2.message, "error"); return; }
    showToast("Block deal created (draft)", "success");
    setShowCreate(false); setForm({ lead_id: "", title: "", developer_name: "", discount_mode: "pct", discount_value: "", reservation_expected: "" }); setLines([]);
    load();
  };

  /* BLOCK DEALS RENDER */
  const fmt = (n) => "AED " + Number(n || 0).toLocaleString();
  const linesTotal = lines.reduce((s, x) => s + Number(x.list_price || 0), 0);
  const statusColors = { draft:"#94A3B8", negotiating:"#D97706", approved:"#7C3AED", confirmed:"#16A34A", partially_dropped:"#DC2626", completed:"#0F2540", cancelled:"#64748B" };

  return (
    <div style={{padding:"1.5rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div>
          <h2 style={{margin:0,fontSize:20,fontWeight:700,color:"#0F2540"}}>{String.fromCodePoint(0x1F9F1)} Block Deals</h2>
          <div style={{fontSize:12,color:"#64748B"}}>One buyer, many units, master terms - per-unit truth below</div>
        </div>
        <button onClick={()=>setShowCreate(true)} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ New Block</button>
      </div>
      {loading ? <div style={{color:"#94A3B8",fontSize:13}}>Loading...</div> : blocks.length === 0 ? (
        <div style={{padding:"3rem",textAlign:"center",color:"#94A3B8",border:"2px dashed #E2E8F0",borderRadius:12,fontSize:13}}>No block deals yet. A block = one buyer taking 2+ units on master terms.</div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {blocks.map(b => { const ls = b.block_deal_units || []; const tot = ls.reduce((s,x)=>s+Number(x.list_price||0),0); const buyer = leads.find(l=>l.id===b.lead_id); return (
            <div key={b.id} onClick={()=>{ setWsBlock(b); }} style={{border:"1px solid #E2E8F0",borderRadius:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff",cursor:"pointer"}}>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"#0F2540"}}>{b.title}</div>
                <div style={{fontSize:12,color:"#64748B",marginTop:2}}>{buyer?.name || "-"} {String.fromCharCode(183)} {ls.length} units {String.fromCharCode(183)} {fmt(tot)} {String.fromCharCode(183)} {Number(b.discount_value) > 0 ? (b.discount_mode==="pct" ? (b.discount_value+"% off") : (fmt(b.discount_value)+" off")) : "terms pending"}</div>
              </div>
              <span style={{display:"inline-flex",gap:8,alignItems:"center"}}>{false && <button onClick={(e)=>{ e.stopPropagation(); confirmBlock(b); }} style={{fontSize:11,fontWeight:700,padding:"5px 12px",borderRadius:7,border:"none",background:"#16A34A",color:"#fff",cursor:"pointer"}}>Confirm block</button>}<span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:12,background:(statusColors[b.status]||"#94A3B8")+"22",color:statusColors[b.status]||"#94A3B8",textTransform:"uppercase",letterSpacing:".5px"}}>{b.status}</span></span>
            </div>); })}
        </div>
      )}
      {wsBlock && <BlockWorkspace block={wsBlock} leads={leads} currentUser={currentUser} showToast={showToast} onClose={()=>setWsBlock(null)} onOpenCalculator={(b)=>setCalcBlock(b)} onRecordApproval={(b)=>{ setWsBlock(null); recordApproval(b); }} onConfirm={(b)=>{ setWsBlock(null); confirmBlock(b); }} onReload={load}/>}
      {calcBlock && <DistributionCalculator block={calcBlock} currentUser={currentUser} showToast={showToast} onClose={()=>setCalcBlock(null)} onLocked={load}/>}
      {showCreate && (
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1200,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:760,maxWidth:"96vw",maxHeight:"94vh",overflow:"auto",padding:"1.25rem 1.5rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:15,fontWeight:700,color:"#0F2540"}}>{String.fromCodePoint(0x1F9F1)} New Block Deal</div>
              <button onClick={()=>setShowCreate(false)} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>{String.fromCharCode(215)}</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              <div><label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4}}>BUYER *</label>
                <select value={form.lead_id} onChange={e=>setForm(f=>({...f,lead_id:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:13}}><option value="">Select buyer...</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4}}>TITLE *</label>
                <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Khalid - Grove floor 9 block" style={{width:"100%",padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:13}}/></div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4}}>DEVELOPER</label>
                <select value={form.developer_name} onChange={e=>setForm(f=>({...f,developer_name:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:13}}><option value="">Select developer...</option>{developers.map(d=><option key={d.id} value={d.name}>{d.name}</option>)}</select></div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4}}>RESERVATION AMT EXPECTED (AED)</label>
                <input type="number" value={form.reservation_expected} onChange={e=>setForm(f=>({...f,reservation_expected:e.target.value}))} placeholder="e.g. 75000" style={{width:"100%",padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:13}}/>
                <div style={{fontSize:10,color:"#94A3B8",marginTop:3}}>What the buyer must pay to reserve these units. Discount is set later in the calculator.</div>
              </div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4}}>PAYMENT PLAN *</label>
                <select value={form.payment_plan_preset} onChange={e=>setForm(f=>({...f,payment_plan_preset:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:13}}>
                  <option value="">Select plan...</option>
                  {PAYMENT_PLAN_PRESETS.map(pp=><option key={pp.label} value={pp.label}>{pp.label}</option>)}
                </select>
                <div style={{fontSize:10,color:"#94A3B8",marginTop:3}}>Same for every unit - part of what the block offers. Instalments are computed from it.</div></div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4}}>DLD FEE</label>
                <div style={{display:"flex",gap:5}}>
                  {[["buyer","Buyer pays"],["developer","Developer absorbs"],["split","Split"],["negotiated","Negotiated"]].map(([v,lb])=>(
                    <button key={v} type="button" onClick={()=>setForm(f=>({...f,dld_payer:v}))} style={{padding:"7px 10px",borderRadius:7,border:form.dld_payer===v?"none":"1px solid #D1D5DB",background:form.dld_payer===v?"#16A34A":"#fff",color:form.dld_payer===v?"#fff":"#475569",fontSize:11,fontWeight:600,cursor:"pointer"}}>{lb}</button>
                  ))}
                </div>
                {suggestedReservation > 0 && Number(form.reservation_expected || 0) !== suggestedReservation && (
                  <div style={{fontSize:11,marginTop:4}}>
                    <span style={{color:"#B45309"}}>Company policy: {fmt(suggestedReservation)} ({lines.length} {lines.length===1?"unit":"units"} x {fmt(feePolicy.reservationFee)})</span>
                    <button type="button" onClick={()=>setForm(f=>({...f,reservation_expected:String(suggestedReservation)}))} style={{marginLeft:8,padding:"2px 9px",borderRadius:6,border:"1px solid #B45309",background:"#fff",color:"#B45309",fontSize:11,fontWeight:700,cursor:"pointer"}}>use this</button>
                  </div>
                )}</div>
            </div>
            {form.lead_id && buyerOpps.filter(o => o.lead_id === form.lead_id).length > 0 && (
              <div style={{border:"1px solid #FDE68A",background:"#FFFBEB",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:700,color:"#92400E",marginBottom:6}}>ADOPT FROM EXISTING DEALS ({adoptPick.length} selected)</div>
                <div style={{fontSize:11,color:"#B45309",marginBottom:8}}>This buyer has active deals. Select 2+ to convert them into a block (bulk terms set afterwards in the calculator). Or ignore and pick fresh units below.</div>
                {/* adopt-row-fix */}
                {buyerOpps.filter(o => o.lead_id === form.lead_id).map(o => { const uref = o.project_units?.unit_ref || (o.title || "").match(/[A-Z]{2,4}-\d{2}-\d{2}/)?.[0] || o.title; return (
                  <div key={o.id} onClick={()=>setAdoptPick(p => p.includes(o.id) ? p.filter(x=>x!==o.id) : [...p, o.id])} style={{padding:"8px 6px",borderBottom:"1px dashed #FDE68A",cursor:"pointer",fontSize:12}}>
                    <div style={{display:"block"}}><input type="checkbox" checked={adoptPick.includes(o.id)} readOnly style={{verticalAlign:"middle",margin:"0 6px 0 0"}} /> <b style={{color:"#0F2540"}}>{uref}</b> <span style={{color:"#64748B"}}>&middot; {o.stage}</span></div>
                    <div style={{color:"#475569",fontWeight:600,paddingLeft:22}}>{"AED " + Number(o.current_agreed_price || o.budget || 0).toLocaleString()}</div>
                    </div>); })}
              </div>
            )}
            <div style={{border:"1px solid #E8EDF4",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:"#0F2540",marginBottom:8}}>UNIT LINES ({lines.length}) {String.fromCharCode(183)} {fmt(linesTotal)}</div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                <div style={{flex:1}}><UnitPicker
                  units={units.filter(u=>!claimedUnitIds.has(u.id)).filter(u=>!lines.some(x=>x.unit_id===u.id)).filter(u=>{ if(!form.developer_name) return true; const pr = projects.find(x=>x.id===u.project_id); const norm = s2 => String(s2||"").toLowerCase().split(" ")[0]; return pr && norm(pr.developer) === norm(form.developer_name); })}
                  projects={projects} salePricing={pricing}
                  value={unitPick} onChange={(id)=>setUnitPick(id)}
                  placeholder={form.developer_name ? ("Pick a " + form.developer_name + " unit - click to search") : "Pick a unit - click to search"}
                /></div>
                <button onClick={addLine} style={{padding:"8px 16px",borderRadius:7,border:"1px solid #0F2540",background:"#fff",color:"#0F2540",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Add</button>
              </div>
              {lines.map(x => (
                <div key={x.unit_id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 4px",borderBottom:"1px dashed #F1F5F9",fontSize:13}}>
                  <span style={{fontWeight:600,color:"#0F2540"}}>{x.unit_ref}</span>
                  <span style={{color:"#475569"}}>{fmt(x.list_price)}</span>
                  <button onClick={()=>removeLine(x.unit_id)} style={{background:"none",border:"none",color:"#DC2626",cursor:"pointer",fontSize:12}}>remove</button>
                </div>))}
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowCreate(false)} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>Cancel</button>
              {adoptPick.length >= 2 ? <button onClick={adoptBlock} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#B45309",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Adopt {adoptPick.length} deals into block</button> : <button onClick={saveBlock} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Create Block (draft)</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

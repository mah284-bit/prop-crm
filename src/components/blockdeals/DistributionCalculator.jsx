import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";
import { sendBlockProposal } from "../../lib/sendBlockProposal.js";
import UnitPicker from "../shared/UnitPicker.jsx";
import { rollUpBlockStatus } from "../../lib/rollUpBlockStatus.js";
import { PAYMENT_PLAN_PRESETS } from "../../modules/constants.js";

export default function DistributionCalculator({ block, currentUser, showToast, onClose, onLocked }) {
  const [lines, setLines] = useState([]);
  const [blockMode, setBlockMode] = useState("pct");
  const [blockValue, setBlockValue] = useState("");
  const [dLatest, setDLatest] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [availUnits, setAvailUnits] = useState([]);
  const [addUnitPick, setAddUnitPick] = useState("");
  const [sendingProp, setSendingProp] = useState(false);
  // Day 87: ONE VERSION PER DISTRIBUTION. Without this a broker who reopens the calculator on D1
  // and presses send again gets V2 rendered from the SAME numbers - two versions of one offer, and
  // an awkward thing to explain to a buyer holding both. If the terms have moved, lock D2 first.
  const [sentFromD, setSentFromD] = useState([]);
  useEffect(() => { (async () => {
    if (!block?.id) return;
    const { data } = await supabase.from("proposals").select("structured_data").eq("block_deal_id", block.id);
    setSentFromD((data || []).map(r => r.structured_data?.block_distribution_version).filter(v => v != null));
  })(); }, [block?.id, sendingProp]);
  // Day 87: THE SEND BELONGS BESIDE THE DECISION. Lock and send were two acts for one intention -
  // a broker could lock D2 and forget to tell the buyer, leaving the block's terms ahead of what
  // the buyer knows. This always renders the distribution he is standing in. Same helper as the
  // Proposals tab; second entry point, no rework of the lock.
  const [loading, setLoading] = useState(true);
  // Day 77: BLOCK TERMS - uniform across every child (founder ruling: differing terms = not a block).
  // Stored on the DISTRIBUTION so they version with the price they were agreed alongside.
  // Vocabulary = SPA-ledger side (buyer/developer/split/negotiated) - what dealBill consumes.
  const [planPreset, setPlanPreset] = useState("");
  const [dldPayer, setDldPayer] = useState("buyer");
  const [dldSplitPct, setDldSplitPct] = useState("50");

  useEffect(() => { (async () => {
    const { data: units } = await supabase.from("block_deal_units").select("*").eq("block_deal_id", block.id).neq("status", "dropped").order("created_at");
    const { data: dists } = await supabase.from("block_distributions").select("*").eq("block_deal_id", block.id).order("version", { ascending: false }).limit(1);
    const last = dists && dists[0];
    setDLatest(last || null);
    // Day 81: on a block with no distribution yet, seed the terms PROPOSED at creation.
    // They become versioned the moment D1 locks.
    if (!last) {
      if (block.proposed_plan) setPlanPreset(block.proposed_plan);
      if (block.proposed_dld) setDldPayer(block.proposed_dld);
    }
    if (last) {
      if (last.payment_plan_preset) setPlanPreset(last.payment_plan_preset);
      if (last.dld_payer) setDldPayer(last.dld_payer);
      if (last.dld_split_pct != null) setDldSplitPct(String(last.dld_split_pct));
    }
    const allocOf = (uid) => { const a = (last?.allocations || []).find(x => x.unit_id === uid); return a || null; };
    const { data: pu } = await supabase.from("project_units").select("id, unit_ref, project_id, status").eq("status", "Available");
    const { data: pj } = await supabase.from("projects").select("id, developer");
    const { data: spx } = await supabase.from("unit_sale_pricing").select("unit_id, asking_price");
    const norm = s => String(s||"").toLowerCase().split(" ")[0];
    const priceOf = (id) => { const r = (spx||[]).find(s => s.unit_id === id); return Number(r?.asking_price || 0); };
    const avail = (pu || []).filter(u => { if (!block.developer_name) return true; const pr = (pj||[]).find(x => x.id === u.project_id); return pr && norm(pr.developer) === norm(block.developer_name); }).map(u => ({ id: u.id, unit_ref: u.unit_ref, list_price: priceOf(u.id) }));
    setAvailUnits(avail);
    setLines((units || []).map(u => { const a = allocOf(u.unit_id); return {
      line_id: u.id, child_opportunity_id: u.child_opportunity_id, unit_id: u.unit_id, unit_ref: u.unit_ref, list_price: Number(u.list_price || 0),
      mode: a ? a.mode : "pct", value: a ? String(a.value) : "",
    }; }));
    setLoading(false);
  })(); }, [block.id]);

  const discOf = (x) => {
    const v = Number(x.value) || 0;
    return x.mode === "pct" ? x.list_price * v / 100 : v;
  };
  const netOf = (x) => x.list_price - discOf(x);
  const totList = lines.reduce((s, x) => s + x.list_price, 0);
  const totDisc = lines.reduce((s, x) => s + discOf(x), 0);
  const totNet = totList - totDisc;
  const effPct = totList > 0 ? (totDisc / totList * 100) : 0;

  const blockTarget = () => {
    const v = Number(blockValue) || 0;
    return blockMode === "pct" ? totList * v / 100 : v;
  };
  const remainder = blockTarget() - totDisc;
  const hasBlockTarget = Number(blockValue) > 0;
  const topDownPending = hasBlockTarget && Math.abs(remainder) > 1;

  const applyProRata = () => {
    if (!hasBlockTarget) { showToast("Enter the block discount first", "error"); return; }
    if (blockMode === "pct") {
      const v = Number(blockValue) || 0;
      setLines(ls => ls.map(x => ({ ...x, mode: "pct", value: String(v) })));
    } else {
      const target = Number(blockValue) || 0;
      setLines(ls => { const tl = ls.reduce((s,x)=>s+x.list_price,0) || 1; return ls.map(x => ({ ...x, mode: "flat", value: String(Math.round(target * x.list_price / tl)) })); });
    }
  };

  const updLine = (uid, patch) => setLines(ls => ls.map(x => x.unit_id === uid ? { ...x, ...patch } : x));

  const addUnitLine = async () => {
    const u = availUnits.find(a => a.id === addUnitPick);
    if (!u) { showToast("Pick a unit to add", "error"); return; }
    if (lines.some(x => x.unit_id === u.id)) { showToast("Already in the block", "error"); return; }
    const { data: newLine, error } = await supabase.from("block_deal_units").insert({ company_id: currentUser.company_id, block_deal_id: block.id, unit_id: u.id, unit_ref: u.unit_ref, list_price: u.list_price, status: "proposed" }).select().single();
    if (error) { showToast(error.message, "error"); return; }
    setLines(ls => [...ls, { line_id: newLine.id, child_opportunity_id: null, unit_id: u.id, unit_ref: u.unit_ref, list_price: u.list_price, mode: "pct", value: "" }]);
    setAvailUnits(av => av.filter(a => a.id !== u.id));
    setAddUnitPick("");
    showToast(u.unit_ref + " added - set its discount and lock to birth the deal", "success");
  };

  const doRemove = async (x, mode) => {
    // unborn line (no child + no persisted line_id) -> silent local delete
    if (!x.child_opportunity_id) {
      if (x.line_id) { await supabase.from("block_deal_units").update({ status: "dropped", status_reason: "removed in calculator (unborn line)", updated_at: new Date().toISOString() }).eq("id", x.line_id); }
      setLines(ls => ls.filter(y => y.unit_id !== x.unit_id));
      setRemoveTarget(null);
      showToast(x.unit_ref + " removed from the block", "success");
      return;
    }
    const reason = window.prompt((mode === "detach" ? "DETACH " : "DROP ") + x.unit_ref + "\n\n" + (mode === "detach" ? "Deal survives standalone (keeps stage, loses block terms)." : "Deal -> Closed Lost, unit freed.") + "\n\nReason (audited):");
    if (reason === null || !reason.trim()) return;
    const cid = currentUser.company_id;
    if (x.line_id) await supabase.from("block_deal_units").update({ status: "dropped", status_reason: mode + ": " + reason.trim(), updated_at: new Date().toISOString() }).eq("id", x.line_id);
    const { data: child } = await supabase.from("opportunities").select("id, stage, lead_id").eq("id", x.child_opportunity_id).maybeSingle();
    if (child) {
      if (mode === "detach") {
        await supabase.from("opportunities").update({ block_deal_id: null }).eq("id", child.id);
        await supabase.from("activities").insert({ opportunity_id: child.id, lead_id: child.lead_id, company_id: cid, type: "Note", status: "completed", user_id: currentUser.id, user_name: currentUser.full_name || null, stage_at_event: child.stage, activity_subtype: "block_detach", note: "DETACHED from block " + block.title + " (calculator). Reason: " + reason.trim() });
      } else {
        // Day 82: a DROPPED child KEEPS its block_deal_id. It used to be cleared, which made the block
        // forget a unit it once held - the roll-up reads children BY block_deal_id, so after dropping
        // every unit a block had zero children and its status never derived to cancelled; it sat
        // "confirmed" forever with nothing in it. A block that forgets what it lost cannot tell the
        // story of what happened. DETACH is different and correctly clears the link: that deal
        // genuinely leaves to stand alone.
        await supabase.from("opportunities").update({ stage: "Closed Lost", status: "Lost", lost_at: new Date().toISOString(), stage_updated_at: new Date().toISOString() }).eq("id", child.id);
        if (!["SPA Signed","Closed Won"].includes(child.stage) && x.unit_id) await supabase.from("project_units").update({ status: "Available" }).eq("id", x.unit_id);
        await supabase.from("activities").insert({ opportunity_id: child.id, lead_id: child.lead_id, company_id: cid, type: "Note", status: "completed", user_id: currentUser.id, user_name: currentUser.full_name || null, stage_at_event: "Closed Lost", activity_subtype: "block_drop", note: "DROPPED from block " + block.title + " (calculator) -> Closed Lost, unit freed. Reason: " + reason.trim() });
      }
    }
    setLines(ls => ls.filter(y => y.unit_id !== x.unit_id));
    setRemoveTarget(null);
    showToast(x.unit_ref + (mode === "detach" ? " detached" : " dropped"), "success");
    // 6-2: after a DROP, offer to renegotiate the survivors (bulk was priced for N units)
    if (mode === "drop") {
      const remaining = lines.filter(y => y.unit_id !== x.unit_id);
      if (remaining.length >= 1) {
        const go = window.confirm(x.unit_ref + " dropped. The bulk terms were struck for " + lines.length + " units; " + remaining.length + " remain.\n\nRenegotiate the block discount now? (You can re-run pro-rata or edit lines, then lock a new version.)\n\nOK = keep the calculator open to renegotiate\nCancel = leave terms as-is on the remaining deals");
        if (go) { setRemoveTarget(null); return; } // stay in calculator, don't close
      }
    }
    // Day 82: a drop may have resolved the LAST live child - let the block settle its own status.
    // Fire and forget: a derived convenience must never be able to fail the drop itself.
    if (mode === "drop") rollUpBlockStatus(block.id).then(null, e => console.warn("Block roll-up failed:", e));
    onLocked && onLocked();
  };

  const lockDistribution = async () => {
    if (lines.length === 0) { showToast("No lines to distribute", "error"); return false; }
    if (lines.some(x => Number(x.value) < 0)) { showToast("Negative discounts not allowed", "error"); return false; }
    if (hasBlockTarget && Math.abs(remainder) > 1) { showToast("Remainder must reach zero before locking (AED " + Math.round(remainder).toLocaleString() + " unallocated)", "error"); return; }
    // Day 81: NO LOCK WITHOUT A PAYMENT PLAN. A block locked with no plan births children that
    // compute a ZERO first instalment - on the specimen that hid 300,453 of a 380,584 bill, and
    // nothing anywhere said so. The plan is not optional decoration; it is what the money is
    // derived from. Same discipline as remainder-must-reach-zero.
    if (!planPreset) { showToast("Pick a payment plan before locking - the instalments are computed from it", "error"); return false; }
    const version = (dLatest?.version || 0) + 1;
    const allocations = lines.map(x => ({ unit_id: x.unit_id, unit_ref: x.unit_ref, list_price: x.list_price, mode: x.mode, value: Number(x.value) || 0, discount: Math.round(discOf(x) * 100) / 100, net_price: Math.round(netOf(x) * 100) / 100 }));
    // Day 87: return the inserted row - the single Send button needs it immediately, and dLatest
    // will not have refreshed within the same tick.
    const { data: inserted, error } = await supabase.from("block_distributions").insert({
      company_id: currentUser.company_id, block_deal_id: block.id, version,
      allocations, block_total: totList, discount_total: Math.round(totDisc * 100) / 100,
      payment_plan_preset: planPreset || null,
      dld_payer: dldPayer || null,
      dld_split_pct: dldPayer === "split" ? (Number(dldSplitPct) || 50) : null,
      locked_at: new Date().toISOString(), created_by: currentUser.id,
    }).select().single();
    if (error) { showToast(error.message, "error"); return false; }
    const keepStatus = ["approved","confirmed","partially_dropped","completed"].includes(block.status) ? block.status : "negotiating";
    const { error: e2 } = await supabase.from("block_deals").update({
      discount_mode: hasBlockTarget ? blockMode : "flat",
      discount_value: hasBlockTarget ? (Number(blockValue) || 0) : Math.round(totDisc * 100) / 100,
      status: keepStatus, updated_at: new Date().toISOString(),
    }).eq("id", block.id);
    if (e2) { showToast(e2.message, "error"); return false; }
    // REPRICE existing children - only when the developer has approved, only pre-SPA deals
    const { data: liveLines } = await supabase.from("block_deal_units").select("id, unit_ref, unit_id, child_opportunity_id").eq("block_deal_id", block.id).neq("status", "dropped");
    const withChildren = (liveLines || []).filter(x => x.child_opportunity_id);
    if (withChildren.length > 0) {
      if (block.status !== "approved" && block.status !== "confirmed" && block.status !== "completed") {
        showToast("Model saved as D" + version + ". Deals keep current prices until developer approval is recorded.", "info");
      } else {
        let done = 0, skipped = [];
        for (const ln of withChildren) {
          const alloc = allocations.find(x => x.unit_id === ln.unit_id);
          if (!alloc) continue;
          const { data: child } = await supabase.from("opportunities").select("id, stage, current_agreed_price, budget").eq("id", ln.child_opportunity_id).maybeSingle();
          if (!child) continue;
          if (["SPA Signed","Closed Won","Closed Lost"].includes(child.stage)) { skipped.push(ln.unit_ref + " (" + child.stage + ")"); continue; }
          const before = Number(child.current_agreed_price || child.budget || 0);
          const { error: re } = await supabase.from("opportunities").update({ budget: alloc.net_price, current_agreed_price: alloc.net_price }).eq("id", child.id);
          if (re) { showToast(ln.unit_ref + " reprice failed: " + re.message, "error"); continue; }
          await supabase.from("activities").insert({ opportunity_id: child.id, company_id: currentUser.company_id, type: "Note", status: "completed", user_id: currentUser.id, user_name: currentUser.full_name || null, stage_at_event: child.stage, activity_subtype: "block_reprice", note: "BLOCK REPRICE (D" + version + ", developer-approved): AED " + before.toLocaleString() + " -> AED " + Number(alloc.net_price).toLocaleString() });
          done++;
        }
        if (done > 0) showToast(done + " deal(s) repriced at D" + version + (skipped.length ? " - skipped (contract locked): " + skipped.join(", ") : ""), "success");
        else if (skipped.length) showToast("No repricing - all deals are contract-locked: " + skipped.join(", "), "info");
      }
    }
    // Day 87: the CALLER closes, not this. The single Send button locks then sends, and closing
    // here would unmount the component before the send ran. It also no longer announces the lock -
    // the broker pressed "send an offer", so the toast that matters is the one about the offer.
    onLocked?.();
    return inserted;
  };

  const fmt = (n) => "AED " + Math.round(Number(n || 0)).toLocaleString();

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1300,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:980,maxWidth:"97vw",maxHeight:"95vh",overflow:"auto",padding:"1.25rem 1.5rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{fontSize:15,fontWeight:700,color:"#0F2540"}}>{String.fromCodePoint(0x1F9EE)} Distribution Calculator {String.fromCharCode(183)} {block.title}</div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>{String.fromCharCode(215)}</button>
        </div>
        <div style={{fontSize:11,color:"#64748B",marginBottom:12}}>{dLatest ? ("Current: D" + dLatest.version + " locked " + new Date(dLatest.locked_at).toLocaleDateString("en-GB")) : "No distribution yet - this lock creates D1"}{String.fromCharCode(46)} Every lock is a new version - the record shows how each number arrived.</div>
        <div style={{display:"flex",gap:10,alignItems:"flex-end",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,padding:"10px 14px",marginBottom:12}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:4}}>TOP-DOWN: BLOCK DISCOUNT</label>
            <div style={{display:"flex",gap:6}}>
              <select value={blockMode} onChange={e=>setBlockMode(e.target.value)} style={{padding:"7px 8px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:13}}><option value="pct">%</option><option value="flat">AED</option></select>
              <input type="number" value={blockValue} onChange={e=>{ const v = e.target.value; setBlockValue(blockMode === "pct" && Number(v) > 100 ? "100" : v); }} placeholder="0" style={{width:130,padding:"7px 10px",border:"1px solid #D1D5DB",borderRadius:7,fontSize:13}}/>
            </div>
          </div>
          <button onClick={applyProRata} style={{padding:"8px 14px",borderRadius:7,border:topDownPending?"2px solid #D97706":"1px solid #0F2540",background:topDownPending?"#FFFBEB":"#fff",color:topDownPending?"#B45309":"#0F2540",fontSize:12,fontWeight:700,cursor:"pointer",boxShadow:topDownPending?"0 0 0 3px rgba(217,119,6,.15)":"none"}}>Suggest pro-rata {String.fromCharCode(8595)}</button>{topDownPending && <span style={{fontSize:11,fontWeight:600,color:"#B45309",marginLeft:2}}>{String.fromCharCode(8592)} press to apply {blockValue}{blockMode==="pct"?"%":" AED"} to all lines</span>}
          <div style={{flex:1,fontSize:11,color:"#94A3B8",paddingBottom:6}}>...or work bottom-up: edit any line below, block totals recompute live.</div>
        </div>
        {lines.length > 0 && (
        <div style={{background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:10,padding:'10px 14px',marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:'#92400E',marginBottom:2}}>BLOCK TERMS</div>
          <div style={{fontSize:11,color:'#B45309',marginBottom:8}}>Same for every unit - one buyer, one developer, one arrangement. Price varies per unit; terms do not.</div>
          <div style={{display:'flex',gap:14,alignItems:'flex-end',flexWrap:'wrap'}}>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:'#64748B',display:'block',marginBottom:3,textTransform:'uppercase'}}>Payment plan</label>
              <select value={planPreset} onChange={e=>setPlanPreset(e.target.value)} style={{padding:'7px 9px',border:'1px solid #D1D5DB',borderRadius:7,fontSize:13,minWidth:130}}>
                <option value=''>- Select -</option>
                {PAYMENT_PLAN_PRESETS.map(pp => <option key={pp.label} value={pp.label}>{pp.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:700,color:'#64748B',display:'block',marginBottom:3,textTransform:'uppercase'}}>DLD fee (4%)</label>
              <div style={{display:'flex',gap:5}}>
                {[['buyer','Buyer pays'],['developer','Developer absorbs'],['split','Split'],['negotiated','Negotiated']].map(([v,lbl]) => (
                  <button key={v} onClick={()=>setDldPayer(v)} style={{padding:'7px 11px',borderRadius:7,border:dldPayer===v?'none':'1px solid #D1D5DB',background:dldPayer===v?'#16A34A':'#fff',color:dldPayer===v?'#fff':'#475569',fontSize:12,fontWeight:600,cursor:'pointer'}}>{lbl}</button>
                ))}
              </div>
            </div>
            {dldPayer === 'split' && (
              <div>
                <label style={{fontSize:10,fontWeight:700,color:'#64748B',display:'block',marginBottom:3,textTransform:'uppercase'}}>Buyer share %</label>
                <input type='number' value={dldSplitPct} onChange={e=>setDldSplitPct(e.target.value)} style={{padding:'7px 9px',border:'1px solid #D1D5DB',borderRadius:7,fontSize:13,width:80,textAlign:'right'}} />
              </div>
            )}
          </div>
        </div>
        )}
        {loading ? <div style={{color:"#94A3B8",fontSize:13}}>Loading lines...</div> : (
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:12}}>
          <thead><tr style={{background:"#F8FAFC",color:"#475569"}}>
            <th style={{padding:"7px 8px",textAlign:"left"}}>Unit</th>
            <th style={{padding:"7px 8px",textAlign:"right"}}>List Price</th>
            <th style={{padding:"7px 8px",textAlign:"center"}}>Mode</th>
            <th style={{padding:"7px 8px",textAlign:"right"}}>Value</th>
            <th style={{padding:"7px 8px",textAlign:"right"}}>Discount</th>
            <th style={{padding:"7px 8px",textAlign:"right"}}>Net Price</th>
            <th style={{padding:"7px 8px"}}></th>
          </tr></thead>
          <tbody>{lines.map(x => (
            <tr key={x.unit_id} style={{borderBottom:"1px dashed #F1F5F9"}}>
              <td style={{padding:"7px 8px",fontWeight:700,color:"#0F2540"}}>{x.unit_ref}</td>
              <td style={{padding:"7px 8px",textAlign:"right",color:"#475569"}}>{fmt(x.list_price)}</td>
              <td style={{padding:"7px 8px",textAlign:"center"}}><select value={x.mode} onChange={e=>updLine(x.unit_id,{mode:e.target.value})} style={{padding:"4px 6px",border:"1px solid #D1D5DB",borderRadius:6,fontSize:11}}><option value="pct">%</option><option value="flat">AED</option></select></td>
              <td style={{padding:"7px 8px",textAlign:"right"}}><input type="number" value={x.value} onChange={e=>{ const v = e.target.value; updLine(x.unit_id,{value: x.mode === "pct" && Number(v) > 100 ? "100" : v}); }} placeholder="0" style={{width:110,padding:"5px 8px",border:"1px solid #D1D5DB",borderRadius:6,fontSize:12,textAlign:"right"}}/></td>
              <td style={{padding:"7px 8px",textAlign:"right",color:"#B45309",fontWeight:600}}>{fmt(discOf(x))}</td>
              <td style={{padding:"7px 8px",textAlign:"right",color:"#166534",fontWeight:700}}>{fmt(netOf(x))}</td>
              <td style={{padding:"7px 8px",textAlign:"right"}}><button type="button" onClick={()=>{ if(!x.child_opportunity_id){ doRemove(x); } else { setRemoveTarget(x); } }} style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:6,border:"1px solid #FCA5A5",background:"#fff",color:"#DC2626",cursor:"pointer"}}>remove</button></td>
            </tr>))}</tbody>
        </table>)}
        <div style={{display:"flex",gap:8,alignItems:"center",margin:"10px 0 4px 0",padding:"8px 10px",background:"#F8FAFC",border:"1px dashed #CBD5E1",borderRadius:8}}>
          <span style={{fontSize:11,fontWeight:700,color:"#64748B"}}>+ Add unit:</span>
          {/* Day 84: the shared picker. availUnits is already scoped to what this block may take,
              so no claim exemption is needed - but it carries list_price inline rather than a
              pricing table, so one is synthesised for the picker. */}
          <div style={{flex:1}}><UnitPicker
            units={availUnits}
            projects={[]}
            salePricing={availUnits.map(u => ({ unit_id: u.id, asking_price: u.list_price }))}
            value={addUnitPick}
            onChange={(id)=>setAddUnitPick(id)}
            placeholder="Pick an available unit - click to search"
          /></div>
          <button type="button" onClick={addUnitLine} style={{fontSize:12,fontWeight:700,padding:"6px 14px",borderRadius:7,border:"1px solid #0F2540",background:"#fff",color:"#0F2540",cursor:"pointer"}}>Add</button>
        </div>
        <div style={{display:"flex",gap:18,alignItems:"center",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,padding:"10px 16px",marginBottom:14,fontSize:12}}>
          <div><span style={{color:"#92400E",fontWeight:600}}>Block list:</span> <strong>{fmt(totList)}</strong></div>
          <div><span style={{color:"#92400E",fontWeight:600}}>Discount:</span> <strong style={{color:"#B45309"}}>{fmt(totDisc)}</strong> ({effPct.toFixed(2)}%)</div>
          <div><span style={{color:"#92400E",fontWeight:600}}>Net:</span> <strong style={{color:"#166534"}}>{fmt(totNet)}</strong></div>
          {hasBlockTarget && <div style={{marginLeft:"auto",fontWeight:700,color:Math.abs(remainder)<=1?"#166534":"#DC2626"}}>{Math.abs(remainder)<=1 ? (String.fromCodePoint(0x2705) + " Reconciled") : ("Remainder: " + fmt(remainder))}</div>}
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>Cancel</button>
          {/* Day 87: ONE BUTTON. Lock and send were two acts because the lock existed first and
              the send was bolted beside it - history, not design. Founder: "when I click the button
              it will save the record and send the proposal at the same time - why set first and
              then send?" No good reason. It writes the distribution AND creates the proposal.
              The counter shows what has already gone out: ten offers with no acceptance is a signal
              the broker should see before adding an eleventh. */}
          <button disabled={sendingProp} onClick={async ()=>{
            setSendingProp(true);
            const locked = await lockDistribution();
            if (!locked) { setSendingProp(false); return; }
            const r = await sendBlockProposal({ block, distribution: locked, lines: locked.allocations || [], units: availUnits, currentUser });
            setSendingProp(false);
            if (r.ok) { showToast("Offer sent to the buyer - version " + r.version, "success"); onClose?.(); }
            else showToast(r.error || "Could not send", "error");
          }} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
            {sendingProp ? "Sending..." : (sentFromD.length ? ("Send a revised offer \u00b7 " + sentFromD.length + " already sent") : "Send this offer to the buyer")}
          </button>
        </div>
      </div>
      {removeTarget && (
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1400,padding:"1rem"}} onClick={()=>setRemoveTarget(null)}>
          <div style={{background:"#fff",borderRadius:14,width:460,maxWidth:"94vw",padding:"1.25rem 1.5rem"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:"#0F2540",marginBottom:6}}>Remove {removeTarget.unit_ref}?</div>
            <div style={{fontSize:12,color:"#64748B",marginBottom:16}}>This unit has a live deal. Choose its fate - audited.</div>
            <button onClick={()=>doRemove(removeTarget, "detach")} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",marginBottom:8,borderRadius:8,border:"1px solid #E2E8F0",background:"#fff",cursor:"pointer"}}><div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>Detach - keep the deal</div><div style={{fontSize:11,color:"#64748B"}}>Standalone 1-to-1. Keeps stage &amp; fee. Loses block terms.</div></button>
            <button onClick={()=>doRemove(removeTarget, "drop")} style={{display:"block",width:"100%",textAlign:"left",padding:"10px 14px",marginBottom:14,borderRadius:8,border:"1px solid #FCA5A5",background:"#FEF2F2",cursor:"pointer"}}><div style={{fontSize:13,fontWeight:700,color:"#DC2626"}}>Drop - lose the deal</div><div style={{fontSize:11,color:"#B91C1C"}}>Closed Lost (reversible). Unit freed.</div></button>
            <button onClick={()=>setRemoveTarget(null)} style={{fontSize:12,color:"#64748B",background:"none",border:"none",cursor:"pointer"}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

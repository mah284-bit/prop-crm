import { useState, useEffect } from "react";
import { useFreshData } from "../../lib/useFreshData.js";
import { supabase } from "../../lib/supabase.js";
import { dealBill } from "../../lib/dealBill.js";
import { getFees } from "../../lib/feeSettings.js";
import BlockPaymentDialog from "./BlockPaymentDialog.jsx";
import BlockCollectionDialog from "./BlockCollectionDialog.jsx";
import { sendBlockProposal } from "../../lib/sendBlockProposal.js";
import { generateBlockProposal } from "../../lib/generateBlockProposal.js";
import DeveloperQuestions from "../developer/DeveloperQuestions.jsx";
import { recordBlockCollection } from "../../lib/recordBlockCollection.js";
import { generateBlockStatement } from "../../lib/generateBlockStatement.js";
import { readBookingClock, releaseBookingHold } from "../../lib/bookingClock.js";
import { lockBlockPayment, amendBlockPayment, acceptShortCollection } from "../../lib/lockBlockPayment.js";
import { canDo } from "../../lib/permissions.js";
import BlockTermsForm from "./BlockTermsForm.jsx";

export default function BlockWorkspace({ block, leads, currentUser, showToast, onClose, onOpenCalculator, onRecordApproval, onConfirm, onReload }) {
  const [dLatest, setDLatest] = useState(null);
  const [childRows, setChildRows] = useState([]);
  const [wsTab, setWsTab] = useState("children");
  const [dHistory, setDHistory] = useState([]);
  const [blockActivity, setBlockActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  // Day 87: the block's own proposal history. Until now a block reached Closed Won with nothing
  // the buyer had ever agreed to in writing - no document, no version, no acceptance.
  const [blockProposals, setBlockProposals] = useState([]);
  const [sendingProposal, setSendingProposal] = useState(false);
  useEffect(() => { (async () => {
    if (!block?.id) return;
    const { data } = await supabase.from("proposals")
      .select("*").eq("block_deal_id", block.id).order("version", { ascending: false });
    setBlockProposals(data || []);
  })(); }, [block?.id, sendingProposal]);
  // Day 87: the chain is now draft -> negotiating -> approved -> ACCEPTED -> confirmed. Confirm
  // moved off `approved` because developer approval is not the buyer's agreement: a block was
  // claiming units on an offer the buyer had never accepted.
  const [showPay, setShowPay] = useState(false);
  const [payTick, setPayTick] = useState(0);
  const [locking, setLocking] = useState(false);
  const [payments, setPayments] = useState([]);
  const [payAllocs, setPayAllocs] = useState([]);
  // Day 79: the block has an OWNER (assigned_to) which drives who can see it - show it.
  const [owner, setOwner] = useState(null);
  useEffect(() => { (async () => {
    if (!block.assigned_to) { setOwner(null); return; }
    const { data } = await supabase.from("profiles").select("id, full_name, email")
      .eq("id", block.assigned_to).maybeSingle();
    setOwner(data || null);
  })(); }, [block.assigned_to]);
  // Day 80: a money decision must say WHO made it. "shortfall accepted" alone does not.
  const [closer, setCloser] = useState(null);
  useEffect(() => { (async () => {
    if (!block.collection_closed_by) { setCloser(null); return; }
    const { data } = await supabase.from("profiles").select("full_name, email").eq("id", block.collection_closed_by).maybeSingle();
    setCloser(data ? (data.full_name || data.email) : null);
  })(); }, [block.collection_closed_by]);
  const [editPay, setEditPay] = useState(null);
  const [expEdit, setExpEdit] = useState(false);
  const [expVal, setExpVal] = useState(block.reservation_expected != null ? String(block.reservation_expected) : "");
  const [expSaving, setExpSaving] = useState(false);
  const [showAccept, setShowAccept] = useState(false);
  // Day 82: CANCEL is the one genuinely block-level ceremony. Everything else about a block's end
  // is DERIVED - the closure ceremony is per child, and the block reflects where its children
  // stand. But the arrangement dying wholesale is a human act: "nothing auto-cancels, humans
  // decide" (Day 77). Dropping fifteen units one at a time to kill a block is not a decision,
  // it is data entry.
  const [cancelling, setCancelling] = useState(false);
  const doCancelBlock = async () => {
    const live = (childRows || []).filter(r => r.child && !["Closed Won","Closed Lost"].includes(r.child.stage));
    const msg = "CANCEL " + block.title + "\n\n" + live.length + " live deal" + (live.length === 1 ? "" : "s")
      + " will be closed lost and their units freed. Deals already at SPA Signed or Closed Won are NOT touched."
      + "\n\nReason (audited, and shown to everyone on this block):";
    const reason = window.prompt(msg);
    if (reason === null || !reason.trim()) return;
    setCancelling(true);
    try {
      for (const r of live) {
        await supabase.from("opportunities").update({
          stage: "Closed Lost", status: "Lost", lost_at: new Date().toISOString(),
          stage_updated_at: new Date().toISOString(),
        }).eq("id", r.child.id);
        if (r.line?.id) await supabase.from("block_deal_units").update({
          status: "dropped", status_reason: "block cancelled: " + reason.trim(),
        }).eq("id", r.line.id);
        if (r.child.unit_id) await supabase.from("project_units").update({ status: "Available" }).eq("id", r.child.unit_id);
      }
      await supabase.from("block_deals").update({ status: "cancelled" }).eq("id", block.id);
      await supabase.from("activities").insert({
        company_id: currentUser.company_id, block_deal_id: block.id,
        type: "note", activity_subtype: "block_terms",
        note: "BLOCK CANCELLED by " + (currentUser.full_name || currentUser.email) + " - " + reason.trim()
          + ". " + live.length + " deal(s) closed lost, units freed.",
        user_id: currentUser.id, user_name: currentUser.full_name || currentUser.email,
      });
      showToast("Block cancelled - " + live.length + " deal(s) closed, units freed", "success");
      setPayTick(t => t + 1); onReload && onReload();
    } catch (e) { showToast(String(e.message || e), "error"); }
    setCancelling(false);
  };
  const [acceptReason, setAcceptReason] = useState("");
  // Day 81: THE MANAGER MUST BE ABLE TO SAY NO.
  // Before this he had two options: accept the shortfall, or do nothing. Silence was
  // indistinguishable from refusal - the agent could not tell whether his manager had not looked
  // or had decided against it, and the deal simply sat. Declining is now a RECORDED ACT with a
  // mandatory reason, visible to the owning agent, so he knows to go and collect.
  // It does NOT change collection_status - the block stays open. A refusal is an EVENT, not a
  // state; inventing a "declined" state would complicate the machine for no gain.
  const [declining, setDeclining] = useState(false);
  const doDecline = async () => {
    if (!acceptReason.trim()) return;
    setDeclining(true);
    try {
      // Day 81: a BLOCK event belongs to the BLOCK. It used to be written against each child
      // opportunity, because activities had no block_deal_id - so a block with no children yet
      // recorded NOTHING while the toast still said it had worked. Worse than the gap it replaced.
      const note = "Shortfall of " + fmt(outstanding) + " DECLINED by "
        + (currentUser.full_name || currentUser.email) + " - " + acceptReason.trim()
        + ". Collection stays open; the balance must be collected.";
      const { error: aErr } = await supabase.from("activities").insert({
        company_id: currentUser.company_id, block_deal_id: block.id,
        type: "note", activity_subtype: "block_terms", note: note,
        user_id: currentUser.id, user_name: currentUser.full_name || currentUser.email,
      });
      if (aErr) { showToast("Could not record the decision: " + aErr.message, "error"); setDeclining(false); return; }
      showToast("Shortfall declined - the agent will see the reason", "success");
      setShowAccept(false); setAcceptReason("");
      setPayTick(t => t + 1); onReload && onReload();
    } catch (e) { showToast(String(e.message || e), "error"); }
    setDeclining(false);
  };
  const [accepting, setAccepting] = useState(false);
  const doAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    const live = childRows.filter(r => r.child && r.line.status !== "dropped");
    const res = await acceptShortCollection({ block, members: live, currentUser, reason: acceptReason, due: dueAmt, collected });
    setAccepting(false);
    if (res.ok) {
      showToast("Collection closed - " + res.moved + " units moved to Reserved", "success");
      setShowAccept(false); setAcceptReason(""); setPayTick(t => t + 1); onReload && onReload();
    } else { showToast(res.error || (res.failed || []).join("; "), "error"); }
  };
  const collected = childRows.reduce((t, r) => t + Number(r.child?.reservation_amount || 0), 0);
  const dueAmt = Number(block.reservation_expected || 0);
  const outstanding = dueAmt - collected;
  const collectionClosed = ["satisfied","accepted_short"].includes(block.collection_status);
  const saveExpected = async () => {
    setExpSaving(true);
    const v = expVal === "" ? null : Number(expVal);
    const { error } = await supabase.from("block_deals").update({ reservation_expected: v }).eq("id", block.id);
    setExpSaving(false);
    if (error) { showToast(error.message, "error"); return; }
    block.reservation_expected = v;
    setExpEdit(false);
    showToast("Reservation amount set", "success");
    setPayTick(t => t + 1);
    onReload && onReload();
  };

  useFreshData(() => { (async () => {
    const { data } = await supabase.from("block_distributions").select("*").eq("block_deal_id", block.id).order("version", { ascending: false }).limit(1);
    setDLatest(data && data[0] ? data[0] : null);
    const { data: lines } = await supabase.from("block_deal_units").select("*").eq("block_deal_id", block.id).order("created_at");
    const childIds = (lines || []).map(x => x.child_opportunity_id).filter(Boolean);
    let opps = [];
    if (childIds.length) { const { data: od } = await supabase.from("opportunities").select("id, stage, status, current_agreed_price, budget, reservation_amount, reservation_date, lead_id, unit_id, current_payment_plan_preset, current_dld_payer, current_dld_split_pct").in("id", childIds); opps = od || []; }
    setChildRows((lines || []).map(ln => ({ line: ln, child: opps.find(o => o.id === ln.child_opportunity_id) || null })));
    const { data: allD } = await supabase.from("block_distributions").select("*").eq("block_deal_id", block.id).order("version", { ascending: false });
    setDHistory(allD || []);
    if (childIds.length) {
      // Day 81: the feed is BLOCK events plus the child events born from block acts.
      const { data: bActs } = await supabase.from("activities").select("*").eq("block_deal_id", block.id).order("created_at", { ascending: false });
      const { data: cActs } = childIds.length ? await supabase.from("activities").select("*").in("opportunity_id", childIds).in("activity_subtype", ["block_adoption","block_reprice","block_conversion"]).order("created_at", { ascending: false }) : { data: [] };
      const acts = [...(bActs||[]), ...(cActs||[])].sort((x,y)=> String(y.created_at||"").localeCompare(String(x.created_at||"")));
      // One act on the block writes one activity PER CHILD (each deal keeps its own history,
      // which matters if a unit is later detached). On the BLOCK view that reads as noise -
      // three identical lines for one change - so collapse by note + timestamp for display only.
      const seen = new Set();
      setBlockActivity((acts || []).filter(a2 => {
        const k = (a2.note || "") + "|" + String(a2.created_at || "").slice(0, 19);
        if (seen.has(k)) return false;
        seen.add(k); return true;
      }));
    }
    const { data: pays } = await supabase.from("block_payments").select("*").eq("block_deal_id", block.id).order("created_at", { ascending: false });
    setPayments(pays || []);
    const payIds = (pays || []).map(x => x.id);
    if (payIds.length) { const { data: pa } = await supabase.from("block_payment_allocations").select("*").in("block_payment_id", payIds); setPayAllocs(pa || []); } else { setPayAllocs([]); }
    setLoading(false);
  })(); }, [block.id, payTick], { hold: showPay || showAccept || locking });

  const buyer = leads.find(l => l.id === block.lead_id);
  const fmt = (n) => "AED " + Math.round(Number(n || 0)).toLocaleString();

  // Day 79 (C1): THE BLOCK BILL. Founder ruling: money is recorded ONCE at block level and
  // distributed - "the block is the meaning of record from one source and distribute". So the
  // bill is dealBill() run PER CHILD and summed per particular. The per-unit split stays
  // visible (the buyer's asset register) but is never the entry point.
  // ─────────────────────────────────────────────────────────────────────────────
  // BLOCK TERMS EDITOR (Day 80) - WHY THIS EXISTS, for anyone reading this cold.
  //
  // A block carries UNIFORM TERMS - one payment plan and one DLD arrangement for every unit -
  // because that is what makes it a block (founder ruling Day 77: "if it is different, then the
  // block concept does not have meaning"). Terms are set in the DISTRIBUTION CALCULATOR and
  // versioned with the prices they were agreed alongside.
  //
  // THE PROBLEM THIS SOLVES: once money is collected the calculator LOCKS, because repricing a
  // deal the buyer has already paid against would contradict a settled record. But that lock also
  // sealed the TERMS, and terms legitimately change after confirmation - a developer revises the
  // payment plan across a block, and the app had no way to record it. Blocks confirmed before the
  // Day-77 terms work carry NO plan at all, so their instalments compute to zero.
  //
  // THE DISTINCTION: the lock protects PRICE (money already paid against it). TERMS are a separate
  // concern - changing 20/80 to 50/50 does not alter what the buyer has paid, only what is due
  // next. So this editor changes terms ONLY; prices are carried forward from D_latest untouched.
  //
  // It writes a NEW DISTRIBUTION VERSION so the change is versioned and audited exactly like a
  // reprice, and pushes the plan onto PRE-SPA children only - a contract-locked deal is never
  // touched. This is the founder's Tier-2 change (terms change -> new version -> re-price pre-SPA
  // children), applied to terms instead of price.
  // ─────────────────────────────────────────────────────────────────────────────
  const [termsEdit, setTermsEdit] = useState(false);
  const [termsPlan, setTermsPlan] = useState("");
  const [termsDld, setTermsDld] = useState("buyer");
  const [termsSplit, setTermsSplit] = useState("50");
  const [termsSaving, setTermsSaving] = useState(false);
  // Day 80 (revised): THE OWNER may set terms, as well as a manager.
  // FOUNDER REASONING: block terms come FROM THE DEVELOPER. The broker is not granting a
  // concession - he is RECORDING what the developer offered. Neither agent nor manager has
  // authority over a developer's payment plan; a manager can only be INFORMED that it changed.
  // So an approval gate here would be theatre, and it would put the person WITHOUT the knowledge
  // (the manager was not in the negotiation) doing the data entry, or the agent waiting on him.
  // Oversight comes from the AUDIT TRAIL, not from a queue - every change writes an activity
  // naming who set what, visible to everyone on the block.
  const canSetTerms = block.assigned_to === currentUser?.id
    || canDo(currentUser, "approve_discount") || currentUser?.is_super_admin === true
    || ["admin","super_admin","group_gm","sales_manager"].includes(currentUser?.role);

  // Writes a NEW distribution version: D_latest's allocations (prices) carried forward UNCHANGED,
  // only the terms differ. Then pushes the plan + DLD onto children that have not reached SPA.
  const saveTerms = async () => {
    if (!termsPlan) { showToast("Pick a payment plan", "error"); return; }
    setTermsSaving(true);
    try {
      const version = (dLatest?.version || 0) + 1;
      const { error } = await supabase.from("block_distributions").insert({
        company_id: currentUser.company_id, block_deal_id: block.id, version,
        allocations: dLatest?.allocations || [],
        block_total: dLatest?.block_total || 0,
        discount_total: dLatest?.discount_total || 0,
        payment_plan_preset: termsPlan,
        dld_payer: termsDld,
        dld_split_pct: termsDld === "split" ? (Number(termsSplit) || 50) : null,
        locked_at: new Date().toISOString(), created_by: currentUser.id,
      });
      if (error) { showToast(error.message, "error"); setTermsSaving(false); return; }
      // Pre-SPA children only. A contract-locked deal keeps the terms it signed under.
      const ids = (childRows || [])
        .filter(r => r.child && !["SPA Signed","Closed Won","Closed Lost"].includes(r.child.stage))
        .map(r => r.child.id);
      if (ids.length) {
        await supabase.from("opportunities").update({
          current_payment_plan_preset: termsPlan,
          current_dld_payer: termsDld,
          current_dld_split_pct: termsDld === "split" ? (Number(termsSplit) || 50) : null,
        }).in("id", ids);
      }
      // Day 80: LEAVE A TRACE. A manager can set terms on an agent's block - that changes what
      // every buyer owes, so the owning agent must be able to see who changed what, and when.
      // Day 81: block-level event on the BLOCK, not replicated across children.
      await supabase.from("activities").insert({
        company_id: currentUser.company_id, block_deal_id: block.id,
        type: "note", activity_subtype: "block_terms",
        note: "Block terms set to " + termsPlan + ", DLD " + termsDld + " (D" + version + ") by " + (currentUser.full_name || currentUser.email),
        user_id: currentUser.id, user_name: currentUser.full_name || currentUser.email,
      });
      showToast("Terms set as D" + version + " - applied to " + ids.length + " deal" + (ids.length === 1 ? "" : "s"), "success");
      setTermsEdit(false);
      setPayTick(t => t + 1);
      onReload?.();
    } catch (e) { showToast(String(e.message || e), "error"); }
    setTermsSaving(false);
  };

  const [blockFees, setBlockFees] = useState(null);
  useEffect(() => { (async () => {
    if (currentUser?.company_id) setBlockFees(await getFees(currentUser.company_id));
  })(); }, [currentUser?.company_id]);

  // Day 80: what has already been collected, per particular and per (particular, unit).
  // The allocator subtracts these so a second payment lands on what is still owed.
  const paidByParticular = (() => {
    const m = {};
    (payAllocs || []).forEach(a2 => { if (a2.particular && a2.particular !== "reservation") m[a2.particular] = (m[a2.particular] || 0) + Number(a2.amount || 0); });
    return m;
  })();
  const paidByUnit = (() => {
    const m = {};
    (payAllocs || []).forEach(a2 => { if (a2.particular && a2.particular !== "reservation") { const k = a2.particular + "|" + a2.opportunity_id; m[k] = (m[k] || 0) + Number(a2.amount || 0); } });
    return m;
  })();

  const totGot = (childRows||[]).reduce((t,r)=>t+Number(r.child?.reservation_amount||0),0)
    + Object.values(paidByParticular||{}).reduce((t,v)=>t+Number(v||0),0);
  const blockBill = (() => {
    if (!blockFees) return null;
    const per = [];
    const tot = { reservation: 0, initial: 0, spa: 0, dld: 0, oqood: 0 };
    (childRows || []).forEach(({ line, child }) => {
      if (!child || child.status === "Lost") return;
      const b = dealBill({
        price: Number(child.current_agreed_price || line.list_price || 0),
        planPreset: child.current_payment_plan_preset,
        reservationAmount: Number(child.reservation_amount || 0),
        spaFee: blockFees.spaFee, oqoodFee: blockFees.oqoodFee,
        dldPayer: child.current_dld_payer || "buyer",
        dldSplitPct: child.current_dld_split_pct || 50,
        dldPct: blockFees.dldPct,
      });
      per.push({ unit_ref: line.unit_ref, child_id: child.id, price: Number(child.current_agreed_price || 0), bill: b });
      tot.reservation += b.reservation_fee.expected;
      tot.initial += b.initial_advance.expected;
      tot.spa += b.spa_fee.expected;
      tot.dld += b.dld_fee.waived ? 0 : b.dld_fee.expected;
      tot.oqood += b.oqood_fee.expected;
    });
    const grand = tot.reservation + tot.initial + tot.spa + tot.dld + tot.oqood;
    return { per, tot, grand };
  })();
  const statusColors = { draft:"#94A3B8", negotiating:"#D97706", approved:"#7C3AED", confirmed:"#16A34A", partially_dropped:"#DC2626", completed:"#0F2540", cancelled:"#64748B" };
  const sc = statusColors[block.status] || "#94A3B8";

  return (
    <>
    <style>{"@keyframes blkPulse{0%,100%{opacity:1}50%{opacity:.45}}"}</style>
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1250,padding:"1rem"}}>
      <div style={{background:"#fff",borderRadius:16,width:1020,maxWidth:"97vw",maxHeight:"95vh",overflow:"auto"}}>
        <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #E8EDF4"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                <span style={{fontSize:17,fontWeight:700,color:"#0F2540"}}>{String.fromCodePoint(0x1F9F1)} {block.title}</span>
                <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:12,background:sc+"22",color:sc,textTransform:"uppercase",letterSpacing:".5px"}}>{block.status}</span>
              </div>
              <div style={{fontSize:12,color:"#475569",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                <strong style={{color:"#0F2540"}}>{buyer?.name || "-"}</strong>
                {block.developer_name && <span>{String.fromCharCode(183)} {block.developer_name}</span>}
                <span>{String.fromCharCode(183)} Owner: <strong style={{color:"#0F2540"}}>{owner?.full_name || owner?.email || "unassigned"}</strong></span>
              </div>
              {dLatest && (
                <div style={{fontSize:12,color:"#475569",marginTop:4,display:"flex",gap:14,flexWrap:"wrap"}}>
                  <span>List <strong style={{color:"#0F2540"}}>{fmt(dLatest.block_total)}</strong></span>
                  <span>Discount <strong style={{color:"#B45309"}}>{fmt(dLatest.discount_total)}</strong>{dLatest.block_total ? " (" + (Number(dLatest.discount_total)/Number(dLatest.block_total)*100).toFixed(2) + "%)" : ""}</span>
                  <span>Deal value <strong style={{color:"#166534"}}>{fmt(Number(dLatest.block_total) - Number(dLatest.discount_total))}</strong></span>
                  <span style={{color:"#94A3B8"}}>D{dLatest.version}</span>
                </div>
              )}
              {dueAmt > 0 && (
                <div style={{fontSize:12,marginTop:5,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontWeight:700,color:outstanding>0.5?"#B91C1C":"#166534"}}>
                    Reservation Received {fmt(collected)} of {fmt(dueAmt)}
                  </span>
                  {/* Day 81: once a manager has ACCEPTED a shortfall the units ARE released, so the
                      red "held until collected fully" chip is a lie sitting beside the settled chip -
                      a broker would chase a balance that has already been closed. The money is still
                      short and we say so; what changed is that it is no longer holding anything. */}
                  {/* Day 83: once the HOLD is released the units are no longer held, so "RESERVATION of units
                      held until collected fully" becomes a second lie on the same header - the same
                      class as the accepted-shortfall contradiction fixed on Day 82. The money is
                      still outstanding and we say so; what changed is that it no longer holds anything. */}
                  {outstanding > 0.5 && block.hold_released_at && !collectionClosed
                    ? <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:10,background:"#FFFBEB",color:"#B45309",border:"1px solid #FCD34D"}}>Outstanding {fmt(outstanding)} {String.fromCharCode(183)} units released, no longer held</span>
                    : outstanding > 0.5 && collectionClosed
                    ? <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:10,background:"#FFFBEB",color:"#B45309",border:"1px solid #FCD34D"}}>Short by {fmt(outstanding)} {String.fromCharCode(183)} accepted, units released</span>
                    : outstanding > 0.5
                    ? <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:10,background:"#FEF2F2",color:"#B91C1C",border:"1px solid #FCA5A5",animation:"blkPulse 2.4s ease-in-out infinite"}}>Outstanding {fmt(outstanding)} {String.fromCharCode(183)} RESERVATION of units held until collected fully</span>
                    : (() => {
                      // Day 89: THE HEADER WENT QUIET. "Collected in full" described the RESERVATION -
                      // 50,000 on a block that had actually taken 1,431,643 - and once it settled
                      // nothing said what happened next or where. FOUNDER: "if the money is the end of
                      // the block, give an appropriate message to say now the SPA is unit-wise, select
                      // the unit and move forward." One line that reads the state.
                      // blockBill returns { per, tot, grand } - `grand` is the whole bill. The
                      // collected side comes from paidByParticular, the same source the Money tab
                      // sums. Reading a key that does not exist would have shown "collected in full"
                      // on a block still owing - a false all-clear on the money path.
                      const billTotal = Number(blockBill?.grand || 0);
                      const billPaid = Object.values(paidByParticular || {}).reduce((x, v) => x + Number(v || 0), 0);
                      const left = billTotal - billPaid;
                      const kids = (childRows || []).filter(r => r.child);
                      const won = kids.filter(r => r.child.stage === "Closed Won").length;
                      if (kids.length && won === kids.length)
                        return <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:10,background:"#E6F4EE",color:"#166534",border:"1px solid #A7D8C3"}}>Block complete {String.fromCodePoint(0x2713)} {String.fromCharCode(183)} all {kids.length} units sold</span>;
                      if (billTotal > 0 && left > 0.5)
                        return <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:10,background:"#FFFBEB",color:"#B45309",border:"1px solid #FCD34D"}}>Reservation settled {String.fromCharCode(183)} {fmt(left)} still to collect across the block</span>;
                      return <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:10,background:"#E6F4EE",color:"#166534",border:"1px solid #A7D8C3"}}>Collected in full {String.fromCodePoint(0x2713)} {String.fromCharCode(183)} each unit's SPA is recorded on its own deal{won ? " (" + won + " of " + kids.length + " sold)" : ""}</span>;
                    })()}
                </div>
              )}
              {(() => {
                // Day 83: THE BOOKING CLOCK, shown where the broker looks first. The hold was bought
                // with a deadline; if the reservation is not collected the units go back to the pool
                // and another broker can sell them. Discovering that three days late loses a deal
                // that a phone call could have saved.
                const c = readBookingClock(block, collectionClosed || (dueAmt > 0 && outstanding <= 0.5));
                if (!c) return null;
                if (c.state === "released") {
                  return <div style={{fontSize:11,color:"#64748B",marginTop:4}}>{"\u26a0 Booking hold released " + new Date(c.released_at).toLocaleDateString("en-GB") + (c.reason ? " \u00b7 " + c.reason : "")}</div>;
                }
                const lapsed = c.state === "lapsed";
                const urgent = c.state === "urgent";
                const txt = lapsed ? ("\u26a0 Hold LAPSED " + c.nice + " \u00b7 units may be released")
                  : urgent ? ("\u26a0 Hold expires in " + Math.max(0, c.hours) + "h \u00b7 " + c.nice + " \u00b7 collect the reservation")
                  : ("Units held until " + c.nice + " \u00b7 " + c.days + " day" + (c.days === 1 ? "" : "s") + " to collect");
                return (
                  <div style={{marginTop:4}}>
                    <span style={{fontSize:11,fontWeight:700,padding:"2px 9px",borderRadius:10,background:lapsed?"#FEF2F2":urgent?"#FFFBEB":"#F8FAFC",color:lapsed?"#B91C1C":urgent?"#B45309":"#475569",border:"1px solid "+(lapsed?"#FCA5A5":urgent?"#FCD34D":"#E2E8F0")}}>{txt}</span>
                  </div>
                );
              })()}
              {block.developer_approved_at && <div style={{fontSize:11,color:"#7C3AED",marginTop:4}}>{String.fromCodePoint(0x2713)} Developer approved {String.fromCharCode(183)} ref {block.developer_approval_ref}{block.approved_by_name ? (" \u00b7 " + block.approved_by_name) : ""}</div>}
            </div>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              {dueAmt > 0 && outstanding > 0.5 && !collectionClosed && canDo(currentUser, "amend_payment") && (
                <button onClick={()=>setShowAccept(true)} style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,border:"1px solid #B45309",background:"#fff",color:"#B45309",cursor:"pointer"}}>Accept shortfall {String.fromCharCode(38)} close</button>
              )}
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:9,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".4px"}}>Reservation Amt Expected</div>
                {expEdit ? (
                  <div style={{display:"flex",gap:5,alignItems:"center",marginTop:2}}>
                    <input type="number" autoFocus value={expVal} onChange={e=>setExpVal(e.target.value)} placeholder="e.g. 75000" style={{width:110,padding:"4px 7px",border:"1px solid #CBD5E1",borderRadius:6,fontSize:12,textAlign:"right"}} />
                    <button disabled={expSaving} onClick={saveExpected} style={{padding:"4px 9px",borderRadius:6,border:"none",background:"#16A34A",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>Save</button>
                    <button onClick={()=>{setExpEdit(false);setExpVal(block.reservation_expected!=null?String(block.reservation_expected):"");}} style={{padding:"4px 7px",borderRadius:6,border:"1px solid #CBD5E1",background:"#fff",color:"#64748B",fontSize:11,cursor:"pointer"}}>Cancel</button>
                  </div>
                ) : (
                  <div onClick={()=>setExpEdit(true)} style={{cursor:"pointer",fontSize:14,fontWeight:800,color:block.reservation_expected?"#0F2540":"#B91C1C",marginTop:1}}>
                    {block.reservation_expected ? fmt(block.reservation_expected) : "Not set - click to set"}
                  </div>
                )}
              </div>
              {["draft","negotiating","approved","confirmed","partially_dropped"].includes(block.status) && (canDo(currentUser, "approve_discount") || currentUser?.is_super_admin === true || ["admin","super_admin","group_gm","sales_manager"].includes(currentUser?.role)) && <button onClick={doCancelBlock} disabled={cancelling} style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,border:"1px solid #DC2626",background:"#fff",color:"#DC2626",cursor:"pointer"}}>{cancelling ? "Cancelling..." : "Cancel block"}</button>}
              {["draft","negotiating","approved"].includes(block.status) && <button onClick={async ()=>{
                // Day 85: A DRAFT BLOCK WAS A TRAP. Before confirmation, before any child is born,
                // before any money - it could not be deleted, its developer could not be changed
                // and its units could not be swapped. A broker who picked the wrong developer was
                // left with a permanent dead block holding soft claims on those units, and they
                // accumulate. Meanwhile a CONFIRMED block - far more committed - can be cancelled.
                // Guarded on the LINES, not on status alone: if any child was ever born this is a
                // cancel ceremony, not a delete.
                const { data: kids } = await supabase.from("block_deal_units")
                  .select("id, child_opportunity_id").eq("block_deal_id", block.id);
                if ((kids||[]).some(k => k.child_opportunity_id)) {
                  showToast("This block has deals behind it - cancel it instead of deleting", "error"); return;
                }
                if (!window.confirm("Delete this draft block and release its " + (kids||[]).length + " unit line(s)?\n\nNothing has been confirmed and no deal exists, so nothing is lost.")) return;
                try {
                  await supabase.from("block_distributions").delete().eq("block_deal_id", block.id);
                  await supabase.from("block_deal_units").delete().eq("block_deal_id", block.id);
                  const { error } = await supabase.from("block_deals").delete().eq("id", block.id);
                  if (error) throw error;
                  showToast("Draft block deleted", "success");
                  onClose && onClose();
                } catch (e) { showToast("Could not delete: " + (e.message||e), "error"); }
              }} style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,border:"1px solid #DC2626",background:"#fff",color:"#DC2626",cursor:"pointer"}}>Delete block</button>}
              {block.status==="negotiating" && <button onClick={()=>onRecordApproval && onRecordApproval(block)} style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,border:"1px solid #B45309",background:"#fff",color:"#B45309",cursor:"pointer"}}>Record developer approval</button>}
              {/* Day 87: ACCEPTANCE IS A STATUS, NOT A BUTTON PER VERSION. Founder: "at V10 I move to
                  accepted - I can send 100 proposals, I cannot have a button on every save." The
                  1-to-1 does exactly this: proposals accumulate as history and the DEAL moves to
                  Offer Accepted. The accepted version is implicitly the latest, the same assumption
                  the 1-to-1 makes. Until now a block claimed units, started a clock and demanded a
                  reservation on an offer nobody had agreed to. */}
              {/* Day 87: acceptance moved to the CALCULATOR, beside the offer being accepted - founder: it belongs on the living proposal, not on a crowded header. */}
              {block.status==="accepted" && <button onClick={()=>onConfirm && onConfirm(block)} style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,border:"none",background:"#16A34A",color:"#fff",cursor:"pointer"}}>Confirm block</button>}
              {["confirmed","partially_dropped","completed"].includes(block.status) && (collectionClosed
                ? <span style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,background:"#E6F4EE",color:"#166534",border:"1px solid #A7D8C3"}}>Reservation settled {String.fromCodePoint(0x2713)}{block.collection_status==="accepted_short" ? " - shortfall accepted" : ""}{block.collection_status==="accepted_short" && closer ? " by " + closer : ""}{block.collection_closed_at ? ", " + new Date(block.collection_closed_at).toLocaleDateString("en-GB") : ""}</span>
                : null)}
              {/* Day 86: the settled chip REPLACED this button, so once the reservation closed there
                  was no door to the POST-RESERVATION collection phase at all - the instalments, SPA
                  fees, DLD and Oqood built on Day 80 were reachable only by collecting them BEFORE
                  the reservation settled. The chip states a fact; the button is a separate act. */}
              {["confirmed","partially_dropped","completed"].includes(block.status) &&
                <button onClick={()=>setShowPay(true)} style={{fontSize:12,fontWeight:700,padding:"7px 14px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",cursor:"pointer"}}>Record payment</button>}
              <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>{String.fromCharCode(215)}</button>
            </div>
          </div>
        </div>
        <div style={{padding:"1.25rem 1.5rem"}}>
          {loading ? <div style={{color:"#94A3B8",fontSize:13}}>Loading...</div> : (
            <div>
              <div style={{display:"flex",gap:4,marginBottom:14,borderBottom:"1px solid #E8EDF4"}}>
                {[["children","Deals"],["proposals","Proposals (" + blockProposals.length + ")"],["money","Money"],["payments","Payments (" + payments.length + ")"],["terms","Terms history"],["activity","Activity"]].map(([id,label]) => (
                  <button key={id} onClick={()=>setWsTab(id)} style={{padding:"7px 14px",border:"none",borderBottom:wsTab===id?"2px solid #0F2540":"2px solid transparent",background:"none",color:wsTab===id?"#0F2540":"#94A3B8",fontSize:12,fontWeight:700,cursor:"pointer"}}>{label}</button>
                ))}
              </div>
              {wsTab==="money" && (
                !blockBill ? <div style={{color:"#94A3B8",fontSize:13}}>Loading fee policy...</div> : (
                <div>
                  <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,padding:"10px 14px",marginBottom:16}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                      <span style={{fontSize:11,fontWeight:700,color:"#92400E"}}>TERMS</span>
                      {!termsEdit && canSetTerms && <button onClick={()=>{setTermsPlan(dLatest?.payment_plan_preset||"");setTermsDld(dLatest?.dld_payer||"buyer");setTermsSplit(String(dLatest?.dld_split_pct||50));setTermsEdit(true);}} style={{padding:"3px 10px",borderRadius:6,border:"1px solid #B45309",background:"#fff",color:"#B45309",fontSize:11,fontWeight:700,cursor:"pointer"}}>{dLatest?.payment_plan_preset ? "Change" : "Set terms"}</button>}
                    </div>
                    <div style={{fontSize:11,color:"#B45309",marginBottom:8}}>Same for every unit. A change writes a new version and applies to deals not yet at SPA - prices are not touched.</div>
                    {termsEdit && <BlockTermsForm plan={termsPlan} setPlan={setTermsPlan} dld={termsDld} setDld={setTermsDld} saving={termsSaving} onSave={saveTerms} onCancel={()=>setTermsEdit(false)} />}
                    {!termsEdit && (
                      <div style={{fontSize:12,color:"#475569",display:"flex",gap:18,flexWrap:"wrap"}}>
                        <span>Payment plan <strong style={{color:dLatest?.payment_plan_preset?"#0F2540":"#B91C1C"}}>{dLatest?.payment_plan_preset || "not set"}</strong></span>
                        <span>DLD <strong style={{color:"#0F2540"}}>{dLatest?.dld_payer || "buyer"}</strong></span>
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:3}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>Block bill</div>
                    {/* Day 80: the statement the BUYER receives - block first, then the split. */}
                    <button onClick={async ()=>{
                      const { data: co } = await supabase.from("companies").select("name, brand_color, brand_accent").eq("id", currentUser.company_id).maybeSingle();
                      generateBlockStatement({ block, buyer, company: co, blockBill, paidByParticular, paidByUnit, childRows, dLatest });
                    }} style={{marginLeft:"auto",padding:"4px 12px",borderRadius:7,border:"1px solid #92400E",background:"#fff",color:"#92400E",fontSize:11,fontWeight:700,cursor:"pointer"}}>Statement</button>
                  </div>
                  <div style={{fontSize:11,color:"#94A3B8",marginBottom:10}}>What this block owes across all units. Money is recorded once at block level and distributed - the per-unit split is below.</div>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:14}}>
                    <thead><tr style={{background:"#F8FAFC",color:"#475569"}}>
                      <th style={{padding:"6px 4px",textAlign:"left"}}>Particular</th>
                      <th style={{padding:"6px 4px",textAlign:"right"}}>Bill</th>
                      <th style={{padding:"6px 4px",textAlign:"right"}}>Collected</th>
                      <th style={{padding:"6px 4px",textAlign:"right"}}>Outstanding</th>
                    </tr></thead>
                    <tbody>
                      {/* Day 80: the bill alone told the broker what was owed and nothing of what
                          had been paid. Collections now sit beside it, per particular. */}
                      {[/* Day 81: the reservation BILL is what the block EXPECTS, not what the children have paid.
                          blockBill feeds each child's reservation_amount into dealBill as the expected, so Bill
                          always equalled Collected and Outstanding always read Nil - the Money tab contradicted
                          the header, which correctly showed the shortfall. */
                        ["Reservation",Number(block.reservation_expected||0),"reservation"],["First instalments (per plan)",blockBill.tot.initial,"initial_advance"],["SPA fees",blockBill.tot.spa,"spa_fee"],["DLD fees",blockBill.tot.dld,"dld_fee"],["Oqood fees",blockBill.tot.oqood,"oqood_fee"]].map(([lbl,v,key]) => {
                        const got = key === "reservation"
                          ? childRows.reduce((t,r)=>t+Number(r.child?.reservation_amount||0),0)
                          : Number(paidByParticular[key] || 0);
                        const left = Math.max(0, Number(v||0) - got);
                        return (
                        <tr key={lbl} style={{borderBottom:"1px dashed #F1F5F9"}}>
                          <td style={{padding:"7px 4px",color:"#475569"}}>{lbl}</td>
                          <td style={{padding:"7px 4px",textAlign:"right",fontWeight:600,color:v>0?"#0F2540":"#CBD5E1"}}>{fmt(v)}</td>
                          <td style={{padding:"7px 4px",textAlign:"right",fontWeight:600,color:got>0?"#166534":"#CBD5E1"}}>{got>0?fmt(got):"-"}</td>
                          <td style={{padding:"7px 4px",textAlign:"right",fontWeight:700,color:left>0.5?"#B91C1C":"#166534"}}>{Number(v||0)<=0 ? "-" : (left>0.5?fmt(left):"Nil " + String.fromCodePoint(0x2713))}</td>
                        </tr>); })}
                      <tr style={{borderTop:"2px solid #E8EDF4"}}>
                        <td style={{padding:"9px 4px",fontWeight:800,color:"#0F2540"}}>Total</td>
                        <td style={{padding:"9px 4px",textAlign:"right",fontWeight:800,color:"#0F2540"}}>{fmt(blockBill.grand)}</td>
                        <td style={{padding:"9px 4px",textAlign:"right",fontWeight:800,color:"#166534"}}>{fmt(totGot)}</td>
                        {(() => {
                          // Day 84: a CANCELLED block whose units were released has a bill of zero,
                          // so this read "Nil" in GREEN over money the buyer had actually paid -
                          // 30,000 sitting unreconciled while the screen said nothing was owed.
                          // FOUNDER RULING (Day 82): the app must NOT decide refund vs forfeit vs
                          // transfer - that is law and the developer's policy, and it varies. It
                          // must simply stop showing green over an open obligation.
                          const left = blockBill.grand - totGot;
                          const dead = ["cancelled","completed"].includes(block.status);
                          if (dead && totGot > 0.5 && left <= 0.5) {
                            return <td style={{padding:"9px 4px",textAlign:"right",fontWeight:800,color:"#B45309"}}>{fmt(totGot)} received {String.fromCharCode(183)} unreconciled</td>;
                          }
                          return <td style={{padding:"9px 4px",textAlign:"right",fontWeight:800,color:left>0.5?"#B91C1C":"#166534"}}>{left>0.5?fmt(left):"Nil " + String.fromCodePoint(0x2713)}</td>;
                        })()}
                      </tr>
                    </tbody>
                  </table>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540",marginBottom:3}}>Per unit</div>
                  <div style={{fontSize:11,color:"#94A3B8",marginBottom:8}}>Each unit carries its own cost basis - what the buyer needs when he sells, rents or transfers one.</div>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr style={{background:"#F8FAFC",color:"#475569"}}>
                      <th style={{padding:"6px 8px",textAlign:"left"}}>Unit</th><th style={{padding:"6px 8px",textAlign:"right"}}>Net price</th>
                      <th style={{padding:"6px 8px",textAlign:"right"}}>Instalment</th><th style={{padding:"6px 8px",textAlign:"right"}}>DLD</th>
                      <th style={{padding:"6px 8px",textAlign:"right"}}>SPA</th><th style={{padding:"6px 8px",textAlign:"right"}}>Oqood</th><th style={{padding:"6px 8px",textAlign:"right"}}>Paid</th>
                    </tr></thead>
                    <tbody>
                      {blockBill.per.map(u => (
                        <tr key={u.unit_ref} style={{borderBottom:"1px dashed #F1F5F9"}}>
                          <td style={{padding:"7px 8px",fontWeight:700,color:"#0F2540"}}>{u.unit_ref}</td>
                          <td style={{padding:"7px 8px",textAlign:"right"}}>{fmt(u.price)}</td>
                          <td style={{padding:"7px 8px",textAlign:"right"}}>{fmt(u.bill.initial_advance.expected)}</td>
                          <td style={{padding:"7px 8px",textAlign:"right"}}>{fmt(u.bill.dld_fee.waived ? 0 : u.bill.dld_fee.expected)}</td>
                          <td style={{padding:"7px 8px",textAlign:"right"}}>{fmt(u.bill.spa_fee.expected)}</td>
                          <td style={{padding:"7px 8px",textAlign:"right"}}>{fmt(u.bill.oqood_fee.expected)}</td>
                          {/* Day 80: what this unit HAS PAID - the buyer's actual cost basis, the
                              number he needs when he sells, rents or transfers this unit. */}
                          <td style={{padding:"7px 8px",textAlign:"right",fontWeight:700,color:"#166534"}}>{(() => {
                            const res = Number((childRows.find(r => r.child?.id === u.child_id)?.child?.reservation_amount) || 0);
                            const rest = (payAllocs||[]).filter(x => x.opportunity_id === u.child_id && x.particular && x.particular !== "reservation").reduce((t,x)=>t+Number(x.amount||0),0);
                            const paid = res + rest;
                            return paid > 0 ? fmt(paid) : "-";
                          })()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                )
              )}
              {wsTab==="children" && (<>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>Deals in this block ({childRows.length})</div>
                {["draft","negotiating","approved","confirmed","partially_dropped"].includes(block.status) &&
                  <button onClick={()=>{ if (collectionClosed) { showToast("Reservation settled and locked. Price changes after money is collected need a manager ceremony (arrives with the ledger phase).", "error"); return; } onClose(); onOpenCalculator(block); }} style={{padding:"7px 14px",borderRadius:8,border:"1px solid #0F2540",background:"#fff",color:"#0F2540",fontSize:12,fontWeight:600,cursor:"pointer"}}>{String.fromCodePoint(0x1F9EE)} Open Calculator</button>}
              </div>
              {(() => { const lsc = { proposed:"#94A3B8", confirmed:"#16A34A", dropped:"#DC2626", re_allocated:"#7C3AED" }; const stc = (s) => s==="Closed Won"?"#0F2540":s==="Closed Lost"?"#DC2626":s==="Reserved"||s==="SPA Requirements"||s==="SPA Signed"?"#16A34A":"#D97706"; return (
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr style={{background:"#F8FAFC",color:"#475569",textAlign:"left"}}>
                  <th style={{padding:"8px 10px"}}>Unit</th>
                  <th style={{padding:"8px 10px"}}>Line</th>
                  <th style={{padding:"8px 10px"}}>Deal stage</th>
                  <th style={{padding:"8px 10px",textAlign:"right"}}>List</th>
                  <th style={{padding:"8px 10px",textAlign:"right"}}>Net (deal price)</th>
                </tr></thead>
                <tbody>{childRows.map(({line, child}) => (
                  <tr key={line.id} style={{borderBottom:"1px solid #F1F5F9",opacity:line.status==="dropped"?0.5:1}}>
                    <td style={{padding:"8px 10px",fontWeight:700,color:"#0F2540"}}>{line.unit_ref}</td>
                    <td style={{padding:"8px 10px"}}><span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:lsc[line.status]+"22",color:lsc[line.status]}}>{line.status}</span></td>
                    <td style={{padding:"8px 10px"}}>{child ? <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:stc(child.stage)+"22",color:stc(child.stage)}}>{child.stage}</span> : <span style={{color:"#94A3B8",fontSize:11}}>not born yet</span>}</td>
                    <td style={{padding:"8px 10px",textAlign:"right",color:"#64748B"}}>{fmt(line.list_price)}</td>
                    <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:"#166534"}}>{child ? fmt(child.current_agreed_price || child.budget) : "-"}</td>
                  </tr>))}</tbody>
              </table>); })()}
              <div style={{fontSize:11,color:"#94A3B8",marginTop:10}}>Deals walk their own ladder in Opportunities. Add/remove arrives with drop-out flows.</div>
              </>)}
              {wsTab==="payments" && (
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540",marginBottom:10}}>Block payments received ({payments.length})</div>
                  {payments.length===0 ? <div style={{color:"#94A3B8",fontSize:12}}>No block payment recorded yet.</div> :
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr style={{background:"#F8FAFC",color:"#475569",textAlign:"left"}}>
                      <th style={{padding:"8px 10px"}}>Particular</th><th style={{padding:"8px 10px"}}>Received on</th>
                      <th style={{padding:"8px 10px"}}>Mode / ref</th>
                      <th style={{padding:"8px 10px",textAlign:"right"}}>Received</th>
                      <th style={{padding:"8px 10px",textAlign:"right"}}>Variance</th>
                      <th style={{padding:"8px 10px",textAlign:"right"}}>Members</th>
                      <th style={{padding:"8px 10px"}}></th>
                    </tr></thead>
                    <tbody>{payments.map(pm => { const va = pm.expected_total != null ? (Number(pm.amount)||0) - (Number(pm.expected_total)||0) : 0; const n = payAllocs.filter(x=>x.block_payment_id===pm.id).length; return (
                      <tr key={pm.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                        <td style={{padding:"8px 10px",fontWeight:700,color:"#0F2540"}}>{pm.milestone}{pm.status==="amended" && <span style={{marginLeft:6,fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:8,background:"#FEF3C7",color:"#B45309"}}>AMENDED</span>}</td>
                        <td style={{padding:"8px 10px",color:"#64748B"}}>{pm.received_date || "-"}</td>
                        <td style={{padding:"8px 10px",color:"#64748B"}}>{(pm.payment_type||"-")}{pm.reference ? " " + String.fromCharCode(183) + " " + pm.reference : ""}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:"#166534"}}>{fmt(pm.amount)}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:va===0?"#94A3B8":"#B45309"}}>{va===0 ? "-" : fmt(va)}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",color:"#64748B"}}>{n}</td>
                        <td style={{padding:"8px 10px",textAlign:"right"}}>{collectionClosed && pm.milestone==="Reservation" ? <span title={"accepted by manager"} style={{fontSize:10,fontWeight:700,color:"#166534"}}>settled {String.fromCodePoint(0x2713)}</span> : (canDo(currentUser, "amend_payment") ? <button onClick={()=>{setEditPay(pm);setShowPay(true);}} style={{padding:"5px 11px",borderRadius:7,border:"1px solid #B45309",background:"#fff",color:"#B45309",fontSize:11,fontWeight:600,cursor:"pointer"}}>Amend</button> : <span style={{fontSize:10,color:"#94A3B8"}}>manager only</span>)}</td>
                      </tr>); })}</tbody>
                  </table>}
                  {payments.some(p=>p.notes) && <div style={{fontSize:11,color:"#94A3B8",marginTop:9}}>Amendment reasons are stored on each payment and logged on every affected deal.</div>}
                </div>
              )}
              {wsTab==="proposals" && (
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{fontSize:11,color:"#64748B"}}>What the BUYER has been sent. Each version is rendered from the locked distribution - the distribution stays master, so the two can never drift.</div>
                    {/* Day 87: the send lives in the CALCULATOR, beside the lock - founder's ruling
                        that the act belongs next to the decision it depends on. This tab is HISTORY.
                        It briefly had its own send button and it referenced `lines` and `units`,
                        which exist only in the calculator - two doors to one act, and the second
                        one crashed. */}
                    <span style={{fontSize:11,color:"#94A3B8"}}>Send from the calculator, where the distribution is locked.</span>
                  </div>
                  {!dLatest && <div style={{fontSize:11,color:"#B45309",background:"#FFFBEB",border:"1px solid #FCD34D",borderRadius:7,padding:"8px 10px",marginBottom:10}}>Lock a distribution in the calculator first - the proposal is rendered from it.</div>}
                  {blockProposals.length === 0 ? (
                    <div style={{padding:"18px",textAlign:"center",color:"#94A3B8",fontSize:12}}>Nothing sent yet. The buyer has not received anything in writing.</div>
                  ) : (
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr style={{background:"#F8FAFC",textAlign:"left",color:"#64748B"}}>
                        <th style={{padding:"7px 8px"}}>V#</th><th style={{padding:"7px 8px"}}>Sent</th>
                        <th style={{padding:"7px 8px"}}>Units</th><th style={{padding:"7px 8px",textAlign:"right"}}>Discount</th>
                        <th style={{padding:"7px 8px",textAlign:"right"}}>Total</th><th style={{padding:"7px 8px"}}>From</th>
                        <th style={{padding:"7px 8px"}}>Status</th>
                      </tr></thead>
                      <tbody>{blockProposals.map(pr => { const sd = pr.structured_data || {}; const live = pr.status !== "superseded"; return (
                        <tr key={pr.id} style={{borderBottom:"1px solid #F1F5F9",opacity:live?1:0.55}}>
                          <td style={{padding:"7px 8px",fontWeight:700,color:"#0F2540"}}>V{pr.version}{live && <span style={{fontSize:8,marginLeft:5,padding:"1px 5px",borderRadius:3,background:"#ECFDF5",color:"#065F46",fontWeight:700}}>LATEST</span>}</td>
                          <td style={{padding:"7px 8px",color:"#64748B"}}>{pr.sent_at ? new Date(pr.sent_at).toLocaleDateString("en-GB") : "-"}</td>
                          <td style={{padding:"7px 8px"}}>{sd.unit_count || "-"}</td>
                          <td style={{padding:"7px 8px",textAlign:"right"}}>{sd.block_discount_pct ? sd.block_discount_pct + "%" : "-"}</td>
                          <td style={{padding:"7px 8px",textAlign:"right",fontWeight:700}}>{fmt(sd.total_value || 0)}</td>
                          <td style={{padding:"7px 8px",color:"#64748B"}}>D{sd.block_distribution_version ?? "?"}</td>
                          <td style={{padding:"7px 8px",fontSize:10,fontWeight:700,color:live?"#166534":"#94A3B8"}}>{(pr.status||"sent").toUpperCase()}</td>
                          {/* Day 87: until now "sent" was NOTIONAL - the offer existed as a row and
                              the buyer had nothing to hold. Works on superseded versions too: a
                              broker must be able to reprint what he sent three weeks ago. */}
                          <td style={{padding:"7px 8px"}}><button onClick={async ()=>{
                            try {
                              const { data: co } = await supabase.from("companies").select("name, brand_color, brand_accent").eq("id", currentUser.company_id).maybeSingle();
                              const f = await getFees(currentUser.company_id);
                              const blob = generateBlockProposal({ proposal: pr, block, buyer, company: co, fees: f });
                              window.open(URL.createObjectURL(blob), "_blank");
                            } catch (e) { showToast("Could not build the PDF: " + (e.message||e), "error"); }
                          }} style={{padding:"3px 9px",borderRadius:6,border:"1px solid #0F2540",background:"#fff",color:"#0F2540",fontSize:10,fontWeight:700,cursor:"pointer"}}>PDF</button></td>
                        </tr>); })}</tbody>
                    </table>
                  )}
                </div>
              )}
              {wsTab==="terms" && (
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540",marginBottom:10}}>Distribution versions ({dHistory.length})</div>
                  {dHistory.length===0 ? <div style={{color:"#94A3B8",fontSize:12}}>No distribution locked yet.</div> :
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                    <thead><tr style={{background:"#F8FAFC",color:"#475569",textAlign:"left"}}>
                      <th style={{padding:"8px 10px"}}>Version</th><th style={{padding:"8px 10px"}}>Locked</th>
                      <th style={{padding:"8px 10px",textAlign:"right"}}>Block list</th><th style={{padding:"8px 10px",textAlign:"right"}}>Discount</th>
                    </tr></thead>
                    <tbody>{dHistory.map((d,i) => (
                      <tr key={d.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                        <td style={{padding:"8px 10px",fontWeight:700,color:"#0F2540"}}>D{d.version}{i===0 && <span style={{marginLeft:6,fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:8,background:"#E6F4EE",color:"#1A7F5A"}}>LATEST</span>}</td>
                        <td style={{padding:"8px 10px",color:"#64748B"}}>{d.locked_at ? new Date(d.locked_at).toLocaleString("en-GB") : "-"}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",color:"#64748B"}}>{fmt(d.block_total)}</td>
                        <td style={{padding:"8px 10px",textAlign:"right",fontWeight:700,color:"#B45309"}}>{fmt(d.discount_total)}</td>
                      </tr>))}</tbody>
                  </table>}
                </div>
              )}
              {wsTab==="activity" && (
                <div>
                  {/* Day 81: the developer side of THIS block - what the buyer asked that the
                      broker could not answer, and what came back. The deal's LIFE, not its money. */}
                  <DeveloperQuestions blockId={block.id} currentUser={currentUser} showToast={showToast} />
                  <div style={{height:20}} />
                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540",marginBottom:10}}>Block events ({blockActivity.length})</div>
                  {blockActivity.length===0 ? <div style={{color:"#94A3B8",fontSize:12}}>No block-level events yet.</div> :
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>{blockActivity.map(a => (
                    <div key={a.id} style={{borderLeft:"3px solid #7C3AED",padding:"6px 12px",background:"#FAFAFC",borderRadius:"0 8px 8px 0"}}>
                      <div style={{fontSize:12,color:"#0F2540"}}>{a.note}</div>
                      <div style={{fontSize:10,color:"#94A3B8",marginTop:2}}>{a.created_at ? new Date(a.created_at).toLocaleString("en-GB") : ""}</div>
                    </div>))}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {showAccept && (
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1350,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:14,width:520,maxWidth:"95vw",padding:"1.2rem 1.4rem"}}>
            <div style={{fontSize:15,fontWeight:700,color:"#B45309",marginBottom:4}}>This block is short. What do you decide?</div>
            <div style={{fontSize:12,color:"#64748B",marginBottom:12}}>{block.title}</div>
            <div style={{display:"flex",gap:22,padding:"11px 13px",background:"#FFFBEB",border:"1px solid #FCD34D",borderRadius:9,marginBottom:12}}>
              <div><div style={{fontSize:9,fontWeight:700,color:"#64748B",textTransform:"uppercase"}}>Due</div><div style={{fontSize:14,fontWeight:800,color:"#0F2540"}}>{fmt(dueAmt)}</div></div>
              <div><div style={{fontSize:9,fontWeight:700,color:"#64748B",textTransform:"uppercase"}}>Collected</div><div style={{fontSize:14,fontWeight:800,color:"#16A34A"}}>{fmt(collected)}</div></div>
              <div><div style={{fontSize:9,fontWeight:700,color:"#64748B",textTransform:"uppercase"}}>Shortfall</div><div style={{fontSize:14,fontWeight:800,color:"#B91C1C"}}>{fmt(outstanding)}</div></div>
            </div>
            <div style={{fontSize:11,color:"#78716C",marginBottom:8}}>The shortfall is NOT recorded as received - the block keeps an honest record of what actually arrived. Accepting releases all units to Reserved on your authority.</div>
            <input value={acceptReason} onChange={e=>setAcceptReason(e.target.value)} placeholder="State your reason (required for either decision)" style={{width:"100%",padding:"8px 10px",border:"1px solid #FCD34D",borderRadius:7,fontSize:12,boxSizing:"border-box",marginBottom:12}} />
            <div style={{display:"flex",justifyContent:"flex-end",gap:9}}>
              <button onClick={()=>{setShowAccept(false);setAcceptReason("");}} style={{padding:"8px 16px",borderRadius:8,border:"1px solid #CBD5E1",background:"#fff",color:"#475569",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button disabled={!acceptReason.trim()||declining||accepting} onClick={doDecline} style={{padding:"8px 18px",borderRadius:8,border:"1px solid #B91C1C",background:"#fff",color:"#B91C1C",fontSize:13,fontWeight:700,cursor:acceptReason.trim()?"pointer":"not-allowed"}}>{declining ? "..." : "Decline - collect the balance"}</button>
              <button disabled={!acceptReason.trim()||accepting||declining} onClick={doAccept} style={{padding:"8px 18px",borderRadius:8,border:"none",background:acceptReason.trim()?"#B45309":"#CBD5E1",color:"#fff",fontSize:13,fontWeight:700,cursor:acceptReason.trim()?"pointer":"not-allowed"}}>Accept and close</button>
            </div>
          </div>
        </div>
      )}
      {/* Day 80: TWO PHASES, TWO DIALOGS. Until the reservation is settled the certified
          reservation ceremony runs (fixed fee, equal split, gated). After it, money arrives as a
          CHUNK for the block and is allocated automatically - the broker chooses no particular
          and types no per-unit figure. */}
      {/* Switch on the ARITHMETIC, not the status flag. collection_status only advances when a
          payment closes the balance through the reservation ceremony - a block whose money was
          recorded before its expected amount was set reads "collected in full" while the flag
          still says open. The reservation being fully collected is the honest test. */}
      {showPay && (dueAmt > 0 && outstanding <= 0.5) && !editPay && <BlockCollectionDialog
        block={block} blockBill={blockBill} paidByParticular={paidByParticular} paidByUnit={paidByUnit}
        currentUser={currentUser} showToast={showToast} onClose={()=>setShowPay(false)}
        onRecord={async (entry)=>{ const res = await recordBlockCollection({ block, entry, currentUser });
          if (res.ok) { showToast("AED " + Math.round(entry.amount).toLocaleString() + " recorded and allocated", "success"); setShowPay(false); setPayTick(t=>t+1); onReload && onReload(); }
          else showToast(res.error || "Could not record", "error"); }} />}
      {showPay && !((dueAmt > 0 && outstanding <= 0.5) && !editPay) && <BlockPaymentDialog key={editPay ? editPay.id : "new"} payment={editPay} priorAllocs={editPay ? payAllocs.filter(x=>x.block_payment_id===editPay.id) : []} block={block} childRows={childRows} blockBill={blockBill} priorPayments={payments} priorAllocsAll={payAllocs} currentUser={currentUser} showToast={showToast} onClose={()=>{setShowPay(false);setEditPay(null);}} onLock={async (bank, amendReason, allocs)=>{ if (locking) return; setLocking(true); const live = childRows.filter(r=>r.child && r.line.status!=="dropped"); const res = editPay ? await amendBlockPayment({ block, payment: editPay, bank, allocations: allocs, members: live, priorAllocs: payAllocs.filter(x=>x.block_payment_id===editPay.id), currentUser, reason: amendReason }) : await lockBlockPayment({ block, bank, allocations: allocs, members: live, currentUser }); setLocking(false); if (res.ok) { showToast(bank.milestone + " AED " + Math.round(Number(bank.amount)||0).toLocaleString() + " distributed to " + res.served + " deals", "success"); setShowPay(false); setEditPay(null); setPayTick(t=>t+1); onReload && onReload(); } else { showToast("Partial: " + res.served + " served. " + (res.failed||[]).join("; "), "error"); setPayTick(t=>t+1); } }} />}
    </div>
    </>
  );
}

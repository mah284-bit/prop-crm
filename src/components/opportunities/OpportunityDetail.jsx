import { autoAdvanceOnActivity } from "../../lib/autoAdvance.js";
import VisitOutcomeDialog from "../dialogs/VisitOutcomeDialog.jsx";
import ProposalViewerDialog from "../dialogs/ProposalViewerDialog.jsx";
import HandoverMeetingDialog from "../dialogs/HandoverMeetingDialog.jsx";
import OpenItemsGuard from "./OpenItemsGuard.jsx";
import { openPropertyPack } from "../property/propertyPackBus.js";
import LogActivityModal from "../LogActivityModal.jsx";
import React, { useState, useEffect, useRef, Fragment } from 'react';
import { supabase } from "../../lib/supabase.js";
import { getFees, FALLBACK as FEE_FALLBACK } from "../../lib/feeSettings.js";
import { dealBill } from "../../lib/dealBill.js";
import { generateReceiptPDF } from "../../lib/generateReceiptPDF.js";
import { aiInvoke } from '../../lib/aiInvoke.js';
import { Modal } from "../../modules/shared/Modal.jsx";
import { Btn } from "../../modules/shared/Btn.jsx";
import { FF } from "../../modules/shared/FormComponents.jsx";
import { Toast } from "../../modules/shared/Toast.jsx";
import { Spinner } from "../../modules/shared/Spinner.jsx";
import { Empty } from "../../modules/shared/Empty.jsx";
import { Badge } from "../../modules/shared/Badge.jsx";
import { StageBadge } from "../../modules/shared/StageBadge.jsx";
import { RoleBadge } from "../../modules/shared/RoleBadge.jsx";
import { DiscBadge } from "../../modules/shared/DiscBadge.jsx";
import { TypeBadge } from "../../modules/shared/TypeBadge.jsx";
import { ROLES, COLORS, OPP_STAGES, OPP_STAGE_META, STAGE_CAPTURE_CONFIGS, PAYMENT_PLAN_PRESETS, DLD_OPTIONS, SERVICE_CHARGE_PRESETS, PROPOSAL_STATUS_META, VALIDITY_PRESETS } from "../../modules/constants.js";
import { addWorkingDays } from "../../lib/appUtils.js";
import { canDo } from "../../lib/permissions.js";
import ActivitiesList, { ASKS_GRID_OPTIONS } from "./ActivitiesList.jsx";
import StageCaptureDialog from "./StageCaptureDialog.jsx";
import UnitSearchPicker from "../UnitSearchPicker.jsx";
import NegotiationRoundDialog from "../dialogs/NegotiationRoundDialog.jsx";
import UnitDetailPanel from "../property/UnitDetailPanel.jsx";
import ProposalBuilderDialog from "./ProposalBuilderDialog.jsx";
import { analyzeUnitSaturation } from "../../lib/unitSaturationAnalyzer.js";
import UnitSaturationWarning from "./UnitSaturationWarning.jsx";
import UnitSaturationInline from "./UnitSaturationInline.jsx";

// Stage 6 -- single source of commission resolution (used by BOTH the live display and the
// invoice freeze at SPA-Signed, so frozen numbers exactly match what the SM saw at close).
// 3-tier split: deal override ?? broker bracket ?? company standard; unset = 100% to agent (solo).
function resolveCommission(opp, agent, companyStd, commissionAmt) {
  const _splitMode  = (opp.agent_split_mode ?? agent?.commission_split_mode ?? companyStd.mode) || null;
  const _splitValRaw = (opp.agent_split_value ?? agent?.commission_split_value ?? companyStd.value);
  const _splitVal   = (_splitValRaw === null || _splitValRaw === undefined || _splitValRaw === "") ? null : Number(_splitValRaw);
  const _splitTier = (opp.agent_split_mode != null) ? "deal"
                   : (agent?.commission_split_mode != null) ? "broker"
                   : (companyStd.mode != null) ? "company" : "none";
  const _belowStandard = _splitTier === "deal" && _splitMode != null && _splitMode === companyStd.mode && _splitVal != null && companyStd.value != null && _splitVal < Number(companyStd.value);
  let agentBase;
  if (_splitMode === "fixed" && _splitVal != null)            agentBase = Math.round(_splitVal * 100) / 100;
  else if (_splitMode === "percentage" && _splitVal != null)  agentBase = Math.round(commissionAmt * _splitVal / 100 * 100) / 100;
  else                                                        agentBase = commissionAmt;
  const _bonusMode = opp.appreciation_bonus_mode || null;
  const _bonusValRaw = opp.appreciation_bonus_value;
  const _bonusVal = (_bonusValRaw === null || _bonusValRaw === undefined || _bonusValRaw === "") ? null : Number(_bonusValRaw);
  let appreciationBonus = 0;
  if (_bonusMode === "fixed" && _bonusVal != null)            appreciationBonus = Math.round(_bonusVal * 100) / 100;
  else if (_bonusMode === "percentage" && _bonusVal != null)  appreciationBonus = Math.round(commissionAmt * _bonusVal / 100 * 100) / 100;
  const _bonusConfigured = (_bonusMode === "fixed" || _bonusMode === "percentage") && _bonusVal != null;
  const agentCommission = Math.round((agentBase + appreciationBonus) * 100) / 100;
  const companyNet = Math.round((commissionAmt - agentCommission) * 100) / 100;
  const _splitConfigured = ((_splitMode === "fixed" || _splitMode === "percentage") && _splitVal != null) || _bonusConfigured;
  return { _splitMode, _splitVal, _splitTier, _belowStandard, agentBase, _bonusMode, _bonusVal, appreciationBonus, _bonusConfigured, agentCommission, companyNet, _splitConfigured };
}

function OpportunityDetail({ opp, lead, opps, units, projects, salePricing, users, currentUser, showToast, onBack, onUpdated, onActivityLog }) {
  // 19 May 2026: Internal approval features (broker -> manager -> admin) hidden
  // Hide until full workflow is implemented end-to-end.
  // To re-enable: change to true. Code is preserved.
  const INTERNAL_APPROVAL_FEATURES_ENABLED = false;
  // ISSUE D Phase 2 — Detect if THIS opp's unit has been taken by another deal
  const [showUnitPack, setShowUnitPack] = useState(false);
  const [selectedUnitForPack, setSelectedUnitForPack] = useState(null);
  const [unitConflict, setUnitConflict] = useState(null);
  useEffect(() => {
    if (!opp?.unit_id) { setUnitConflict(null); return; }
    if (["Reserved","SPA Requirements","SPA Signed","Closed Won"].includes(opp.stage)) { setUnitConflict(null); return; }
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, title, stage, stage_updated_at")
        .eq("unit_id", opp.unit_id)
        .neq("id", opp.id)
        .in("stage", ["Reserved", "SPA Requirements", "SPA Signed", "Closed Won"])
        .order("stage_updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive || error) return;
      if (data) {
        const daysAgo = data.stage_updated_at
          ? Math.floor((Date.now() - new Date(data.stage_updated_at).getTime()) / 86400000)
          : null;
        setUnitConflict({ title: data.title, stage: data.stage, daysAgo });
      } else {
        // block hold check (24 Jul): Booked-by-block is a conflicting hold too
        const { data: bl } = await supabase
          .from("block_deal_units")
          .select("block_deal_id, status, block_deals(title, status)")
          .eq("unit_id", opp.unit_id)
          .neq("status", "dropped")
          .limit(1)
          .maybeSingle();
        if (!alive) return;
        if (bl && bl.block_deals && ["draft","negotiating","confirmed"].includes(bl.block_deals.status) && bl.block_deal_id !== opp.block_deal_id) {
          setUnitConflict({ title: bl.block_deals.title + " (block deal)", stage: "Booked by block", daysAgo: null });
          return;
        }
        setUnitConflict(null);
      }
    })();
    return () => { alive = false; };
  }, [opp?.id, opp?.unit_id, opp?.stage]);

  // Phase F W4 — AI Coach state (panel that analyses the deal and suggests next moves)
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachResult, setCoachResult] = useState(null); // {summary, suggestions:[{title,reasoning,confidence,action_type,action_params}], analysed_at}
  const [coachError, setCoachError] = useState("");
  const [coachInfoOpen, setCoachInfoOpen] = useState(false);

  const [activeTab,  setActiveTab]  = useState("activities");
  const [activities, setActivities] = useState([]);
  const [reminders,  setReminders]  = useState([]); // Phase E W3 — pending follow-ups for this opp
  const [payments,   setPayments]   = useState([]);
  const [contract,   setContract]   = useState(null);
  const [commissionInvoice, setCommissionInvoice] = useState(null); // Day 18 — in-opp commission invoice visibility
  const [canSeeCommission, setCanSeeCommission] = useState(false); // Commission Stage 3 — capability gate
  const [companyStd, setCompanyStd] = useState({ mode: null, value: null }); // Commission correction — Tier 1 company-wide standard split
  const [showBonusDialog, setShowBonusDialog] = useState(false); // Stage 5c-1 per-deal performance bonus
  const [bonusForm, setBonusForm] = useState({ mode: "fixed", value: "", reason: "" });
  const [bonusSaving, setBonusSaving] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false); // Stage 5c-2 per-deal split override
  const [overrideForm, setOverrideForm] = useState({ value: "", reason: "" }); // mode inherits company standard
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideConfirm, setOverrideConfirm] = useState(false); // 5c-2 two-step confirm for below-standard
  const [dealHistory, setDealHistory] = useState([]); // 5c shared deal commission history
  const [saving,     setSaving]     = useState(false);
  const [showLog,    setShowLog]    = useState(false);
  const [coachReturn, setCoachReturn] = useState(false); // return to Coach tab after a Coach-triggered action
  const [showPayment,setShowPayment]= useState(false);
  const [showEmail,  setShowEmail]  = useState(false);
  // Edit Opportunity v3 (12 May 2026): allow correcting opp details after creation
  // Includes: title, budget, unit_id, commission_pct, assigned_to, property_category, notes
  const [showEditOpp, setShowEditOpp] = useState(false);
  const [editOppForm, setEditOppForm] = useState({});
  const [saturationWarning, setSaturationWarning] = useState(null);
  const [showStageGate, setShowStageGate] = useState(null); // stage name being gated
  const [stageGateViewMode, setStageGateViewMode] = useState(false);
  // Won-door hydration: reopening Closed Won shows saved handover date + close notes
  useEffect(() => {
    if (showStageGate !== "Closed Won") return;
    setStageGateForm(f => ({
      ...f,
      handover_date: f.handover_date || (opp.expected_handover_date ? String(opp.expected_handover_date).slice(0,10) : ""),
      notes: f.notes || opp.close_notes || "",
    }));
  }, [showStageGate, opp.id]);
  // 19 May 2026 Dashboard Redesign Phase 2a: dashboardTab controls which panel shows
  // null = welcome state, otherwise: 'proposals'|'coach'|'next-steps'|'financials'|'negotiations'|'upfront'|'plan'
  // Note: renamed from 'activeTab' to avoid collision with existing Activity Log filter state
  const [dashboardTab, setDashboardTab] = useState(null);
  const [stageGateForm, setStageGateForm] = useState({});
  const [spaMode, setSpaMode] = useState("detailed"); // quick|detailed
  const [companyFees, setCompanyFees] = useState(null); // Day 78: the company fee POLICY
  // Day 79 (C0b-2): the deal COLLECTION STATE, read from the stored ledger so the broker
  // sees Bill / Collected / To collect without opening any dialog. One truth, two surfaces.
  const [collectionState, setCollectionState] = useState(null);
  useEffect(() => { (async () => {
    if (!["Reserved","SPA Requirements","SPA Signed","Closed Won"].includes(opp.stage)) { setCollectionState(null); return; }
    const { data } = await supabase.from("pp_sales_closures").select("pre_spa_payments").eq("opportunity_id", opp.id).maybeSingle();
    const rows = data && data.pre_spa_payments;
    if (!rows) { setCollectionState(null); return; }
    let bill = 0, collected = 0;
    Object.values(rows).forEach(r => {
      if (!r || r.status === "waived") return;
      bill += Number(r.expected_amount || 0);
      collected += Number(r.amount || 0);
    });
    setCollectionState({ bill: bill, collected: collected, toCollect: Math.round((bill - collected) * 100) / 100 });
  })(); }, [opp.id, opp.stage, showStageGate]);
  // Stage 5 — SPA upload + pre-SPA payments + edit-price toggle
  const [spaUploading, setSpaUploading] = useState(false);
  const [spaUploadError, setSpaUploadError] = useState(null);
  // Stage 5 v2 — 3-state model: pending | received | waived
  const [prePaymentsState, setPrePaymentsState] = useState({
    booking_fee:     { status: "pending", amount: "", date: "", notes: "" },
    reservation_fee: { status: "pending", amount: "", date: "", notes: "" },
    initial_advance: { status: "pending", amount: "", date: "", notes: "" },
    spa_fee:         { status: "pending", amount: "", date: "", notes: "" },
    dld_fee:         { status: "pending", amount: "", date: "", notes: "" },
    oqood_fee:       { status: "pending", amount: "", date: "", notes: "" },
    other_fees:      { status: "pending", amount: "", date: "", notes: "" },
  });
  const [closedWonEditPrice, setClosedWonEditPrice] = useState(false);
  // Stage 5 UX — "quick-fill date for all received" helper
  const [singleDateValue, setSingleDateValue] = useState("");
  // Phase 3b - DLD payer config (defaults to buyer; loaded from master agreement on open)
  const [dldPayer, setDldPayer] = useState(opp?.dld_payer || "buyer");
  // Phase 3b Split - buyer's percentage when dld_payer === 'split' (default 50)
  const [dldSplitPct, setDldSplitPct] = useState(opp?.dld_split_pct ?? 50);
  const [showDiscReq, setShowDiscReq] = useState(false);
  const [discReqForm, setDiscReqForm] = useState({type:"sale_price",discount_pct:"",reason:"",discount_source:"Developer",developer_auth_ref:""});
  const [logForm,    setLogForm]    = useState({type:"Call",note:"",scheduled_at:"",duration_mins:"",ns_enabled:false,ns_type:"Call",ns_due:"",ns_note:""});
  // Phase E W3 — reminder action dialog (Done / Reschedule / Cancel)
  const [remAction, setRemAction] = useState(null); // {mode:"done"|"reschedule"|"cancel", reminder, note, date}

  // Phase E W2 — Negotiation: "Log round" and "Handover meeting" dialogs
  const [showLogRound, setShowLogRound] = useState(false);
  const [showHandover, setShowHandover] = useState(false);
  // Phase E W2 — Site Visit outcome dialog (after the visit happens)
  const [visitOutcomeFor, setVisitOutcomeFor] = useState(null); // an upcoming visit activity
  const [visitOutcomeReturnsToGuard, setVisitOutcomeReturnsToGuard] = useState(false);
  // Phase E W3 — Proposal Builder dialog & loaded proposals for this opp
  const [showProposalDialog, setShowProposalDialog] = useState(false);
  const [showOpenItemsGuard, setShowOpenItemsGuard] = useState(false);
  const [proposals, setProposals] = useState([]);
  // Phase 2.1 — FAB activity logging
  const [showFabLog, setShowFabLog] = useState(false);
  const [fabLogType, setFabLogType] = useState("Call");
  const [viewingProposal, setViewingProposal] = useState(null); // proposal row to show in viewer

  // Phase E W3 — open-items guard: a proposal is the first official document.
  // Before opening the proposal builder, check for upcoming Site Visits / Handover
  // Meetings that haven't had outcomes captured. If any exist, show the guard first.
  const requestProposalDialog = () => {
    // Wilderness Part 3 LOCK (completed post stage-split): SPA Signed now MEANS executed
    if (opp.stage === "SPA Signed" || opp.stage === "Closed Won" || opp.stage === "Closed Lost") {
      showToast("\ud83d\udd12 Terms are contractually executed - proposals are locked. Activities and messaging remain open.", "warning");
      return;
    }
    const hasOpenItems = activities.some(a =>
      a.status === "upcoming" && (
        (a.activity_subtype === "stage_advance" && a.to_stage === "Site Visit")
        || a.activity_subtype === "handover_meeting"
      )
    );
    if (hasOpenItems) {
      setShowOpenItemsGuard(true);
    } else {
      setShowProposalDialog(true);
    }
  };

  // Phase E W3 — shared helper used by both the inline strip (snooze) and the action dialog (done/reschedule/cancel)
  const updateReminderStatus = async(reminderId, newStatus, extra={})=>{
    const{error}=await supabase.from("reminders").update({status:newStatus, ...extra}).eq("id",reminderId);
    if(error){
      console.error("Reminder update failed:", error);
      showToast(`Failed to update reminder: ${error.message||"unknown error"}`,"error");
      return false;
    }
    if(newStatus==="pending" && extra.trigger_at){
      // rescheduled — keep in list with new date
      setReminders(p=>p.map(r=>r.id===reminderId?{...r,trigger_at:extra.trigger_at}:r).sort((a,b)=>new Date(a.trigger_at)-new Date(b.trigger_at)));
    }else{
      // done/cancelled — remove from pending list
      setReminders(p=>p.filter(r=>r.id!==reminderId));
    }
    return true;
  };
  const [payForm,    setPayForm]    = useState({milestone:"Booking Deposit",amount:"",percentage:"",due_date:"",payment_type:"Cheque",cheque_number:"",cheque_date:"",bank_name:"",status:"Pending",notes:"",cheque_file_url:""});
  const [emailForm,  setEmailForm]  = useState({to:"",subject:"",body:""});
  const [editPayment,setEditPayment]= useState(null);
  const canEdit  = canDo(currentUser,"write");
  const [tookOwnership, setTookOwnership] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [reassignForm, setReassignForm] = useState({assigned_to:"", reason:""});
  const isOwner  = opp.assigned_to === currentUser.id;
  const canSeeCompanyMargin = canSeeCommission;  // company margin == brokerage-commission crown jewel (single gate)

  // Commission correction — load company-wide standard agent split (Tier 1 fallback).
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!currentUser?.company_id) return;
      try {
        const { data, error } = await supabase
          .from("companies")
          .select("default_agent_split_mode, default_agent_split_value")
          .eq("id", currentUser.company_id)
          .maybeSingle();
        if (!alive || error) return;
        setCompanyStd({
          mode: data?.default_agent_split_mode ?? null,
          value: (data?.default_agent_split_value === null || data?.default_agent_split_value === undefined) ? null : Number(data.default_agent_split_value),
        });
      } catch (e) {
        console.warn("Company standard split load error:", e);
      }
    })();
    return () => { alive = false; };
  }, [currentUser?.company_id]);

  // Commission Stage 3 — resolve whether this user may see company-side commission figures.
  // Admin/super_admin auto-pass (mirrors App.jsx hasCapability); else check see_brokerage_commission.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (currentUser?.is_super_admin === true) {   // platform owner only; admin+tenant read config
        if (alive) setCanSeeCommission(true);
        return;
      }
      if (!currentUser?.company_id) { if (alive) setCanSeeCommission(false); return; }
      try {
        const { data, error } = await supabase
          .from("role_capabilities")
          .select("capability, enabled")
          .eq("company_id", currentUser.company_id)
          .eq("role", currentUser.role)
          .eq("capability", "see_brokerage_commission");
        if (!alive) return;
        if (error) throw error;
        setCanSeeCommission(!!(data && data[0] && data[0].enabled === true));
      } catch (e) {
        console.warn("Commission capability load error:", e);
        if (alive) setCanSeeCommission(false);
      }
    })();
    return () => { alive = false; };
  }, [currentUser?.role, currentUser?.company_id]);
  const canAction = isOwner || tookOwnership;
  const canReassign = canDo(currentUser,"assign_leads");
  const isWon    = opp.stage==="Closed Won";
  const isDeveloper = (()=>{try{const c=JSON.parse(localStorage.getItem("propccrm_company_cache")||"null");return c?.company_category==="Developer";}catch{return false;}})();
  const isOffPlan = opp.property_category==="Off-Plan" || (!opp.property_category && sp?.booking_pct>0);
  const isResale = opp.property_category==="Ready / Resale";
  const isCommercial = opp.property_category==="Commercial";
  const isLocked = ["Proposal Sent","Negotiation","Closed Won","Closed Lost"].includes(opp.stage);

  const unit     = units.find(u=>u.id===opp.unit_id);
  const proj     = unit ? projects.find(p=>p.id===unit.project_id) : null;
  const sp       = unit ? salePricing.find(s=>s.unit_id===unit.id) : null;
  const agent    = users.find(u=>u.id===opp.assigned_to);
  // Stage 5c-1 -- per-deal performance bonus (additive, reason-mandatory, audited)
  const fmtHistVal = (mode, val) => val == null ? "" : (mode === "percentage" ? `${val}%` : `AED ${Number(val).toLocaleString()}`);
  const fmtHistDate = (iso) => { try { return new Date(iso).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}); } catch { return ""; } };
  const histLabel = (h) => h.action==="bonus_grant"?`Bonus +${fmtHistVal(h.to_mode,h.to_value)}`:h.action==="bonus_clear"?"Bonus removed":h.action==="deal_override"?`Split override \u2192 ${fmtHistVal(h.to_mode,h.to_value)}`:h.action==="deal_override_clear"?"Override removed":h.action;
  const loadDealHistory = async () => {
    setDealHistory([]);
    try {
      const { data } = await supabase.from("commission_audit_log").select("action, to_mode, to_value, reason, created_at").eq("opportunity_id", opp.id).in("action", ["bonus_grant","bonus_clear","deal_override","deal_override_clear"]).order("created_at",{ascending:false}).limit(20);
      setDealHistory(data || []);
    } catch (e) { console.warn("deal history load error", e); }
  };
  const openBonusDialog = () => {
    loadDealHistory();
    setBonusForm({
      mode: opp.appreciation_bonus_mode || "fixed",
      value: opp.appreciation_bonus_value != null ? String(opp.appreciation_bonus_value) : "",
      reason: "",
    });
    setShowBonusDialog(true);
  };
  const saveBonus = async ({ clear = false } = {}) => {
    const reason = bonusForm.reason.trim();
    if (!reason) { showToast?.("A reason is required (audit trail)", "error"); return; }
    let toMode = null, toValue = null;
    if (!clear) {
      const v = Number(String(bonusForm.value).trim());
      if (Number.isNaN(v) || v <= 0) { showToast?.("Enter a bonus amount greater than zero", "error"); return; }
      if (bonusForm.mode === "percentage" && v > 100) { showToast?.("Percentage cannot exceed 100%", "error"); return; }
      toMode = bonusForm.mode; toValue = v;
    }
    const fromMode = opp.appreciation_bonus_mode || null;
    const fromValue = opp.appreciation_bonus_value != null ? Number(opp.appreciation_bonus_value) : null;
    if (fromMode === toMode && fromValue === toValue) { showToast?.("No change to save", "error"); return; }
    setBonusSaving(true);
    try {
      const logRow = {
        company_id: currentUser.company_id,
        action: clear ? "bonus_clear" : "bonus_grant",
        subject_user_id: opp.assigned_to || null,
        opportunity_id: opp.id,
        from_mode: fromMode, from_value: fromValue,
        to_mode: toMode, to_value: toValue,
        reason: reason, triggered_by: currentUser.id,
      };
      const { error: logErr } = await supabase.from("commission_audit_log").insert(logRow);
      if (logErr) throw new Error("Audit log failed - change not applied: " + logErr.message);
      const { error: upErr } = await supabase.from("opportunities").update({
        appreciation_bonus_mode: toMode,
        appreciation_bonus_value: toValue,
        appreciation_bonus_reason: clear ? null : reason,
      }).eq("id", opp.id);
      if (upErr) throw upErr;
      onUpdated?.({ ...opp, appreciation_bonus_mode: toMode, appreciation_bonus_value: toValue, appreciation_bonus_reason: clear ? null : reason });
      showToast?.(clear ? "Bonus removed" : "Performance bonus saved", "success");
      setShowBonusDialog(false);
    } catch (e) {
      showToast?.("Couldn't save: " + e.message, "error");
    } finally {
      setBonusSaving(false);
    }
  };
  // Stage 5c-2 -- per-deal split override (this deal only; overrides the agent's bracket).
  // Per founder decision (30 Jun): INFORM, do not block below standard -- warn + reason + audit.
  const openOverrideDialog = () => {
    const sameMode = opp.agent_split_mode === companyStd.mode;
    setOverrideForm({
      value: (sameMode && opp.agent_split_value != null) ? String(opp.agent_split_value) : "",
      reason: "",
    });
    setOverrideConfirm(false);
    loadDealHistory();
    setShowOverrideDialog(true);
  };
  const saveOverride = async ({ clear = false } = {}) => {
    const reason = overrideForm.reason.trim();
    if (!reason) { showToast?.("A reason is required (audit trail)", "error"); return; }
    const mode = companyStd.mode; // inherits company mode (single-mode model)
    if (!clear && !mode) { showToast?.("Set a company standard in Commission Defaults first", "error"); return; }
    let toMode = null, toValue = null;
    if (!clear) {
      const v = Number(String(overrideForm.value).trim());
      if (Number.isNaN(v) || v <= 0) { showToast?.("Enter an override value greater than zero", "error"); return; }
      if (mode === "percentage" && v > 100) { showToast?.("Percentage cannot exceed 100%", "error"); return; }
      toMode = mode; toValue = v;
    }
    const fromMode = opp.agent_split_mode || null;
    const fromValue = opp.agent_split_value != null ? Number(opp.agent_split_value) : null;
    if (fromMode === toMode && fromValue === toValue) { showToast?.("No change to save", "error"); return; }
    setOverrideSaving(true);
    try {
      const logRow = {
        company_id: currentUser.company_id,
        action: clear ? "deal_override_clear" : "deal_override",
        subject_user_id: opp.assigned_to || null,
        opportunity_id: opp.id,
        from_mode: fromMode, from_value: fromValue,
        to_mode: toMode, to_value: toValue,
        reason: reason, triggered_by: currentUser.id,
      };
      const { error: logErr } = await supabase.from("commission_audit_log").insert(logRow);
      if (logErr) throw new Error("Audit log failed - change not applied: " + logErr.message);
      const { error: upErr } = await supabase.from("opportunities").update({
        agent_split_mode: toMode, agent_split_value: toValue,
      }).eq("id", opp.id);
      if (upErr) throw upErr;
      onUpdated?.({ ...opp, agent_split_mode: toMode, agent_split_value: toValue });
      showToast?.(clear ? "Deal override removed" : "Deal split override saved", "success");
      setShowOverrideDialog(false);
    } catch (e) {
      showToast?.("Couldn't save: " + e.message, "error");
    } finally {
      setOverrideSaving(false);
    }
  };
  const sm       = OPP_STAGE_META[opp.stage]||OPP_STAGE_META["New"];

  useEffect(()=>{
    supabase.from("activities").select("*").eq("opportunity_id",opp.id).order("created_at",{ascending:false}).then(({data})=>setActivities(data||[]));
    supabase.from("sales_payments").select("*").eq("opportunity_id",opp.id).order("created_at").then(({data})=>setPayments(data||[]));
    supabase.from("sales_contracts").select("*").eq("opportunity_id",opp.id).limit(1).then(({data})=>setContract(data?.[0]||null));
    // Phase E W3: load pending reminders for this opportunity
    supabase.from("reminders").select("*").eq("related_opportunity_id",opp.id).eq("status","pending").order("trigger_at",{ascending:true}).then(({data})=>setReminders(data||[]));
    // Phase E W3: load proposals for this opportunity (latest first)
    supabase.from("proposals").select("*").eq("opportunity_id",opp.id).order("created_at",{ascending:false}).then(({data,error})=>{
      if(error){console.warn("Proposal load failed:",error);}
      setProposals(data||[]);
    });
    supabase.from("pp_commission_invoices").select("*").eq("opportunity_id",opp.id).order("created_at",{ascending:false}).limit(1).then(({data,error})=>{ if(error){console.warn("Commission invoice load failed:",error);} setCommissionInvoice(data?.[0]||null); });
  },[opp.id]);
  // Phase 2.0 Day 1 subtask 2 — per-opp realtime for proposals (dedupe-safe)
  // Local save handlers already do optimistic state updates. The realtime
  // event then arrives a moment later for the same row. We dedupe by id so
  // the saving tab doesn't see the row twice. Other tabs (no local update
  // happened) still get the row appended via realtime.
  useEffect(()=>{
    if(!opp?.id)return;
    const ch=supabase.channel("opp-proposals-"+opp.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"proposals",filter:`opportunity_id=eq.${opp.id}`},p=>{
        if(p.eventType==="INSERT"){
          setProposals(x=> x.some(r=>r.id===p.new.id) ? x : [p.new,...x]);
        } else if(p.eventType==="UPDATE"){
          setProposals(x=> x.map(r=>r.id===p.new.id?p.new:r));
        } else if(p.eventType==="DELETE"){
          setProposals(x=> x.filter(r=>r.id!==p.old.id));
        }
      })
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[opp?.id]);
  // Phase 2.0 Day 1 subtask 1 — realtime for activities
  useEffect(()=>{
    if(!opp?.id)return;
    const ch=supabase.channel("opp-activities-"+opp.id)
      .on("postgres_changes",{event:"*",schema:"public",table:"activities",filter:`opportunity_id=eq.${opp.id}`},p=>{
        if(p.eventType==="INSERT")setActivities(x=> x.some(r=>r.id===p.new.id) ? x : [p.new,...x]);
        else if(p.eventType==="UPDATE")setActivities(x=> x.map(r=>r.id===p.new.id?p.new:r));
        else if(p.eventType==="DELETE")setActivities(x=> x.filter(r=>r.id!==p.old.id));
      })
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[opp?.id]);

  const GATED_STAGES = ["Offer Accepted","Reserved","SPA Signed","Closed Won","Closed Lost"];

  // Phase E W1 — stage capture dialog for transitions that need structured input
  const [showCaptureDialog, setShowCaptureDialog] = useState(null); // target stage being captured

  // Phase F W4 — AI Coach: analyse the deal and surface 1-3 actionable next moves.
  // Pattern: visible always, runs on click, caches in component state until refresh.
  // We don't auto-run because (a) it burns tokens on opps the user might just glance at,
  // (b) users dislike AI doing work without their consent, (c) on-click feels purposeful.
  const runCoach = async () => {
    setCoachLoading(true);
    setCoachError("");
    try {
      // Build the deal context for the AI — keep it lean to control token spend
      const proj = units.find(u => u.id === opp.unit_id) ? projects.find(p => p.id === units.find(u => u.id === opp.unit_id).project_id) : null;
      const unit = units.find(u => u.id === opp.unit_id) || null;
      const dealContext = {
        opportunity: {
          stage: opp.stage,
          status: opp.status,
          budget_aed: opp.budget,
          days_in_stage: opp.stage_updated_at ? Math.round((new Date() - new Date(opp.stage_updated_at)) / (1000*60*60*24)) : null,
          days_since_created: opp.created_at ? Math.round((new Date() - new Date(opp.created_at)) / (1000*60*60*24)) : null,
          unit_ref: unit?.unit_ref || null,
          unit_project: proj?.name || null,
          unit_handover: proj?.handover_date || null,
        },
        lead: {
          name: lead?.name || null,
          nationality: lead?.nationality || null,
          source: lead?.source || null,
          property_type_interest: lead?.property_type || null,
          notes: lead?.notes || null,
          stated_budget: lead?.budget || null,
        },
        recent_activities: (activities || []).slice(0, 10).map(a => ({
          type: a.type,
          subtype: a.activity_subtype,
          status: a.status,
          note: a.note,
          when: a.created_at,
          stage_at_event: a.stage_at_event,
        })),
        proposals_sent: (proposals || []).map(p => ({
          status: p.status,
          total_value_aed: p.total_value || (p.structured_data?.total_value),
          payment_plan: p.payment_plan || (p.structured_data?.payment_plan),
          dld_handling: p.structured_data?.dld_handling,
          discount_applied_pct: p.structured_data?.units?.[0]?.discount_pct,
          sent_at: p.created_at,
          expires_at: p.expiry_date || (p.structured_data?.expiry_date),
        })),
        pending_reminders: (reminders || []).map(r => ({
          message: r.message,
          due_at: r.trigger_at,
          overdue: new Date(r.trigger_at) < new Date(),
        })),
      };

      const system = `You are PropPulse Coach, an expert UAE real-estate broker advisor reviewing a single deal in progress. Your job: analyse the deal data and recommend the SINGLE MOST IMPORTANT next move, plus 1-2 secondary suggestions. Be specific, reference actual events from the timeline (not generic advice), and respect UAE market norms (DLD 4%, off-plan vs ready dynamics, common payment plans 10/90, 20/80, 50/50 PHP, 40/60).

Action types you can recommend:
- build_proposal: send a (revised) proposal. Provide suggested_discount_pct and suggested_payment_plan in action_params if you have a basis.
- schedule_followup: schedule a call/whatsapp/meeting follow-up. Provide suggested_followup_type and suggested_days_out in action_params.
- mark_lost: deal looks dead, recommend closing as Lost. Provide suggested_lost_reason in action_params.
- advance_stage: agent should manually move to a specific later stage. Provide suggested_stage in action_params.
- note_only: just an observation, no specific action.

Always respond with valid JSON only — no prose, no markdown fences. Confidence is one of: "high", "medium", "low".`;

      const userPrompt = `Analyse this real-estate deal and recommend the next moves.

DEAL CONTEXT:
${JSON.stringify(dealContext, null, 2)}

TASK: Return 1-3 actionable suggestions ranked by importance. Be specific — reference actual events ("Site Visit on May 1 had price-concern feedback", "Proposal #2 expires in 3 days", etc).

RESPOND WITH VALID JSON ONLY in this exact shape:
{
  "summary": "<1-sentence high-level read of where the deal stands>",
  "suggestions": [
    {
      "title": "<short imperative — 'Send revised proposal at 5% discount'>",
      "reasoning": "<2-3 sentences citing specific events>",
      "confidence": "high" | "medium" | "low",
      "action_type": "<one of the action types listed>",
      "action_params": { /* depends on action_type, can be empty */ }
    }
  ]
}`;

      const reply = await aiInvoke({ system, prompt: userPrompt, max_tokens: 3000 });
      const cleaned = reply.replace(/```json\s*/g,"").replace(/```\s*$/g,"").trim();
      let parsed;
      try { parsed = JSON.parse(cleaned); }
      catch (e) {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("AI response was not valid JSON");
        parsed = JSON.parse(m[0]);
      }
      if (!parsed.suggestions || !Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
        throw new Error("AI returned no suggestions");
      }
      setCoachResult({
        summary: parsed.summary || "",
        suggestions: parsed.suggestions.slice(0, 3),
        analysed_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("AI Coach failed:", e);
      setCoachError(`Couldn't analyse: ${e.message || "unknown error"}`);
    } finally {
      setCoachLoading(false);
    }
  };

  // Apply a coach action — opens the relevant existing dialog with sensible pre-fills
  const applyCoachAction = (suggestion) => {
    const { action_type, action_params = {} } = suggestion;
    if (action_type === "build_proposal") {
      // Open proposal builder; pre-fill happens via the builder's defaults +
      // we'll rely on the user reading the suggestion. Future: pass action_params
      // through to ProposalBuilderDialog as initial overrides.
      setCoachReturn(true);
      requestProposalDialog();
    } else if (action_type === "schedule_followup") {
      const days = Number(action_params.suggested_days_out) || 2;
      const due = new Date(); due.setDate(due.getDate()+days); due.setHours(9,0,0,0);
      setLogForm(f => ({
        ...f,
        type: action_params.suggested_followup_type || "Call",
        ns_enabled: true,
        ns_type: action_params.suggested_followup_type || "Call",
        ns_due: due.toISOString().split("T")[0],
        ns_note: suggestion.title,
      }));
      setCoachReturn(true);
      setShowLog(true);
    } else if (action_type === "mark_lost") {
      setShowStageGate("Closed Lost");
      setStageGateForm({ lost_reason: action_params.suggested_lost_reason || "", lost_notes: suggestion.reasoning });
    } else if (action_type === "advance_stage" && action_params.suggested_stage) {
      // Don't auto-execute — show the stage capture dialog so agent confirms with details
      const target = action_params.suggested_stage;
      setCoachReturn(true);
      if (STAGE_CAPTURE_CONFIGS[target]) setShowCaptureDialog(target);
      else if (GATED_STAGES.includes(target)) setShowStageGate(target);
      else moveStage(target);
    }
    // note_only — no action
  };

  const proposalGate = async (toStage) => {
    if (opp.block_deal_id) return true; // block_deal_id: terms live at block level - locked distribution IS E2 evidence (24 Jul doctrine)
    // Evidence gate v1 (walk finding GF-walk-11): money stages require a documented offer.
    // Reserve/SPA with ZERO sent proposals = taking money with no paper trail (RERA risk).
    if (!["Reserved", "SPA Requirements", "SPA Signed"].includes(toStage)) return true;
    if ((proposals || []).length > 0) return true;
    const reason = window.prompt("Evidence gate: no proposal has been sent on this deal.\n\n" + toStage + " means money/contract - the buyer should have documented terms first.\n\nBest: Cancel and send a proposal.\nTo override: type the REASON for proceeding without one:");
    if (reason === null || !reason.trim()) return false;
    await supabase.from("activities").insert({
      opportunity_id: opp.id, lead_id: opp.lead_id, company_id: opp.company_id || currentUser.company_id || null,
      type: "Note", status: "completed",
      note: "EVIDENCE gate OVERRIDE at " + toStage + " (no proposals sent) - reason: " + reason.trim(),
      user_id: currentUser.id, user_name: currentUser.full_name || null,
      lead_name: lead?.name || null, stage_at_event: toStage, activity_subtype: "evidence_override",
    });
    return true;
  };
  const kycGate = async (toStage) => {
    // KYC v1 soft gates (Design Capture #1): Reserved wants >= docs-collected; SPA wants verified.
    const need = toStage === "Reserved" ? "in_progress" : (toStage === "SPA Requirements" || toStage === "SPA Signed") ? "verified" : null;
    if (!need) return true;
    try {
      const { data: l } = await supabase.from("leads").select("kyc_status, kyc_docs, name").eq("id", opp.lead_id).maybeSingle();
      const k = l?.kyc_status || "not_started";
      const _exp = (d) => d?.url && d?.expiry && new Date(d.expiry) < new Date(new Date().toDateString());
      const idExpired = _exp(l?.kyc_docs?.passport) || _exp(l?.kyc_docs?.eid_visa);
      const ok = need === "in_progress" ? (["in_progress","verified"].includes(k) && !idExpired) : (k === "verified" && !idExpired);
      if (ok) return true;
      const label = need === "verified" ? "Verified" : "Docs Collected";
      const reason = window.prompt("KYC gate: " + (l?.name || "buyer") + " is '" + k.replace("_"," ") + "' but " + toStage + " expects at least '" + label + "'.\n\nBest: Cancel and update KYC from the lead page.\nTo override: type the REASON for proceeding without KYC (e.g. docs promised at signing):");
      if (reason === null || !reason.trim()) return false;
      await supabase.from("activities").insert({
        opportunity_id: opp.id, lead_id: opp.lead_id, company_id: opp.company_id || currentUser.company_id || null,
        type: "Note", status: "completed",
        note: "KYC gate OVERRIDE at " + toStage + " (status: " + k + ") - reason: " + reason.trim(),
        user_id: currentUser.id, user_name: currentUser.full_name || null,
        lead_name: l?.name || null, stage_at_event: toStage, activity_subtype: "kyc_override",
      });
      return true;
    } catch (e) { console.warn("kycGate skipped:", e); return true; }
  };
  const moveStage = async(toStage) => {
    // Executed deals are read-only (activities/messaging excepted) - Wilderness lock principle
    if (opp.stage === "Closed Won" || opp.stage === "Closed Lost") {
      showToast("\ud83d\udd12 This deal is closed - stages are read-only. Activities remain open.", "warning");
      return;
    }
    if ((toStage === "Reserved" || toStage === "SPA Requirements") && !(await proposalGate(toStage))) return;
    if ((toStage === "Reserved" || toStage === "SPA Requirements" || toStage === "SPA Signed") && !(await kycGate(toStage))) return;
    // ISSUE D guard duplication — block at moveStage entry too
    // (Dialogs like Capture Contact bypass commitStageMove, so guard
    //  has to be here before any dialog opens)
    if (toStage !== "Closed Lost" && toStage !== "On Hold" && opp.unit_id) {
      try {
        const { data: conflictOpps } = await supabase
          .from("opportunities")
          .select("id, title, stage, stage_updated_at")
          .eq("unit_id", opp.unit_id)
          .neq("id", opp.id)
          .in("stage", ["Reserved", "SPA Requirements", "SPA Signed", "Closed Won"]);
        if (conflictOpps && conflictOpps.length > 0) {
          const c = conflictOpps[0];
          const days = c.stage_updated_at
            ? Math.floor((Date.now() - new Date(c.stage_updated_at).getTime()) / 86400000)
            : null;
          const ageStr = days !== null ? ` (${days} day${days === 1 ? "" : "s"} ago)` : "";
          showToast(
            `⛔ Unit reserved by "${c.title}" at ${c.stage}${ageStr}. Pick a different unit or wait.`,
            "error"
          );
          return;
        }
      } catch (e) {
        console.error("moveStage guard exception:", e);
      }
    }

    // Phase E W3: advancing to "Proposal Sent" should open the proposal builder,
    // not just bump the stage. The dialog handles stage advance + activity + reminders.
    if (toStage === "Proposal Sent") {
      requestProposalDialog();
      return;
    }
    // Phase E W1: if target stage has a capture config, open the dialog
    if (STAGE_CAPTURE_CONFIGS[toStage]) {
      setShowCaptureDialog(toStage);
      return;
    }
    if(GATED_STAGES.includes(toStage)) {
      setStageGateForm({});
      setStageGateViewMode(false);
      setShowStageGate(toStage);
      return;
    }
    await commitStageMove(toStage, {});
  };

  // Stage 5 fix — sync stageGateForm.final_price with displayed value when SPA dialog opens
  // Bug A fix (12 May 2026): Load saved pp_sales_closures state when reopening SPA Signed/Closed Won dialog
  // Real broker workflow: save partial state, return next day to complete
  // Must load BEFORE pre-fill useEffects to prevent overwriting saved data
  // 12 May extension: Also fires for Closed Won so Gate 6 validation sees saved data
  useEffect(() => {
    if (showStageGate !== "SPA Signed") return;
    (async () => {
      const fees = await getFees(currentUser.company_id);
      setCompanyFees(fees);
      const { data: co } = await supabase.from("companies").select("spa_mode,default_spa_fee,default_oqood_fee").eq("id", currentUser.company_id).maybeSingle();
      if (co?.spa_mode) setSpaMode(co.spa_mode);
      let spaFee = co?.default_spa_fee, oqoodFee = co?.default_oqood_fee;
      if (opp.developer_id) {
        const { data: dv } = await supabase.from("pp_developers").select("default_spa_fee,default_oqood_fee").eq("id", opp.developer_id).maybeSingle();
        if (dv?.default_spa_fee != null) spaFee = dv.default_spa_fee;
        if (dv?.default_oqood_fee != null) oqoodFee = dv.default_oqood_fee;
      }
      setPrePaymentsState(p => {
        const out = {...p};
        if (spaFee && !out.spa_fee?.expected_amount) out.spa_fee = {...out.spa_fee, expected_amount: Number(spaFee), notes: out.spa_fee?.notes || "Expected: developer/company default"};
        if (oqoodFee && !out.oqood_fee?.expected_amount) out.oqood_fee = {...out.oqood_fee, expected_amount: Number(oqoodFee), notes: out.oqood_fee?.notes || "Expected: developer/company default"};
        return out;
      });
    })();
  }, [showStageGate]);
  useEffect(() => {
    if ((showStageGate !== "SPA Signed" && showStageGate !== "Closed Won") || !opp.id) return;
    (async () => {
      try {
        const { data: closure } = await supabase
          .from("pp_sales_closures")
          .select("pre_spa_payments, final_sale_price, spa_signed_date, spa_reference_number, notes, spa_document_path, spa_document_filename")
          .eq("opportunity_id", opp.id)
          .maybeSingle();
        if (closure?.pre_spa_payments) {
          setPrePaymentsState(closure.pre_spa_payments);
          setStageGateForm(f => ({
            ...f,
            final_price: closure.final_sale_price ? String(closure.final_sale_price) : f.final_price,
            spa_date: closure.spa_signed_date || f.spa_date,
            spa_reference_number: closure.spa_reference_number || f.spa_reference_number,
            notes: closure.notes || f.notes,
            spa_document_path: closure.spa_document_path || f.spa_document_path,
            spa_document_filename: closure.spa_document_filename || f.spa_document_filename,
          }));
        }
      } catch (e) {
        console.error("Bug A: load saved closure state exception:", e);
        // Fail-open - dialog still works with defaults
      }
    })();
  }, [showStageGate, opp.id]);

  // Issue 1 fix 11 May 2026 — also pre-fill reservation_fee from opp.reservation_amount
  // 14 May 2026 (Day 2 of Math Flow Sprint): current_agreed_price is PRIMARY source
  // current_agreed_price is the single source of truth, populated by stage cascade.
  // Legacy columns kept as fallbacks for edge cases.
  useEffect(() => {
    if (showStageGate === "SPA Signed" || showStageGate === "Closed Won") {
      const unitAskingPrice = (salePricing || []).find(s => s.unit_id === opp.unit_id)?.asking_price;
      const fallbackPrice = 
        opp.current_agreed_price ||  // PRIMARY: single source of truth from cascade
        opp.final_price ||            // legacy fallback
        opp.offer_price ||            // legacy fallback
        unitAskingPrice ||            // legacy fallback (unit list price)
        opp.budget;                   // last resort (buyer budget)
      if (fallbackPrice) {
        setStageGateForm(f => f.final_price ? f : ({...f, final_price: String(fallbackPrice)}));
      }
      // 18 May 2026 SPA Refactor: pre-fill DLD payer + split from current_dld_*
      // These are populated when proposal is saved (line 3853 area).
      // Pre-fill the SPA dialog so broker sees agreed proposal terms.
      if (opp.current_dld_payer && !dldPayer) {
        setDldPayer(opp.current_dld_payer);
      }
      if (opp.current_dld_split_pct && (!dldSplitPct || dldSplitPct === 50)) {
        setDldSplitPct(opp.current_dld_split_pct);
      }
      // 18 May 2026: Calculate initial_advance from payment plan preset
      // Founder principle: "calculated and shown, not entered"
      // Maps preset label to initial percentage (first number in label)
      const PLAN_INITIAL_PCT = {
        "10/90": 10,
        "20/80": 20,
        "50/50 PHP": 50,
        "40/60": 40,
        // "Custom" = null, broker enters manually
      };
      const planPct = PLAN_INITIAL_PCT[opp.current_payment_plan_preset] ?? null;
      if (planPct && fallbackPrice) {
        const expectedInitial = Math.round(fallbackPrice * planPct / 100);
        setPrePaymentsState(p => {
          // Only pre-fill if user hasn't already set this row
          if (p.initial_advance?.status === "pending" || (!p.initial_advance?.amount && !p.initial_advance?.expected_amount)) {
            return {
              ...p,
              initial_advance: {
                ...p.initial_advance,
                expected_amount: expectedInitial,
                expected_percent: planPct,
              }
            };
          }
          // Already set - just record the expected for display purposes
          return {
            ...p,
            initial_advance: {
              ...p.initial_advance,
              expected_amount: expectedInitial,
              expected_percent: planPct,
            }
          };
        });
      }
    }
    // Issue 1: pre-fill reservation_fee in 3-state pre-SPA payments when SPA dialog opens
    // Stage 5 v3 extension: also pre-fill the amount from opp.reservation_amount
    if (showStageGate === "SPA Signed" && opp.reservation_amount) {
      setPrePaymentsState(p => {
        // Only pre-fill if user hasn't already set this row (don't override their choice)
        if (p.reservation_fee?.status === "pending" && !p.reservation_fee?.date) {
          return {
            ...p,
            reservation_fee: {
              status: "received",
              amount: String(opp.reservation_amount),
              date: opp.reservation_date || new Date().toISOString().slice(0,10),
              notes: "Pre-filled from Reserved stage entry"
            }
          };
        }
        return p;
      });
    }
    // Stage 5 v3: pre-fill booking_fee.amount when SPA dialog opens (if captured upstream)
    if (showStageGate === "SPA Signed" && opp.booking_amount) {
      setPrePaymentsState(p => {
        if (p.booking_fee?.status === "pending" && !p.booking_fee?.amount) {
          return {
            ...p,
            booking_fee: {
              status: "received",
              amount: String(opp.booking_amount),
              date: opp.booking_date || new Date().toISOString().slice(0,10),
              notes: "Pre-filled from earlier flow"
            }
          };
        }
        return p;
      });
    }
    // Phase 3b: load default_dld_payer from master agreement if opp doesn't have one set
    if (showStageGate === "SPA Signed" && !opp.dld_payer && opp.master_agreement_id) {
      (async () => {
        const { data: ma } = await supabase
          .from("pp_master_agreements")
          .select("default_dld_payer")
          .eq("id", opp.master_agreement_id)
          .maybeSingle();
        if (ma?.default_dld_payer) setDldPayer(ma.default_dld_payer);
      })();
    }
  }, [showStageGate, opp.id, opp.current_agreed_price, opp.reservation_amount, opp.booking_amount, opp.reservation_date, opp.booking_date]);
  // v2 bill-first seed: ALL expected amounts computed on dialog open
  useEffect(() => {
    if (showStageGate !== "SPA Signed") return;
    const price = Number(stageGateForm.final_price || opp.current_agreed_price || 0);
    if (!price) return;
    const planStr = String(stageGateForm.payment_plan_preset || opp.current_payment_plan_preset || "");
    const pctMatch = planStr.match(/^(\d+)\s*\//);
    const planPct = pctMatch ? Number(pctMatch[1]) : 10;
    setPrePaymentsState(prev => {
      const next = { ...prev };
      const seedRow = (key, amt, pct) => {
        const row = next[key] || { status: "pending", amount: "", date: "", notes: "" };
        if (row.status !== "pending" || Number(row.amount)) return;
        const _ex = Math.round(amt * 100) / 100;
        next[key] = { ...row, expected_amount: _ex, ...(pct ? { expected_percent: pct } : {}) };
      };
      seedRow("initial_advance", price * planPct / 100, planPct);
      if (Number(opp.reservation_amount) > 0) {
        const rrow = next.reservation_fee || { status: "pending", amount: "", date: "", notes: "" };
        next.reservation_fee = { ...rrow, expected_amount: Number(opp.reservation_amount) };
      }
      // Day 78: the COMPANY'S POLICY seeds these, not a constant. companyFees is loaded by the
      // settings effect; the fallbacks apply only until it arrives (or if the company set nothing).
      seedRow("spa_fee", companyFees?.spaFee ?? FEE_FALLBACK.spaFee);
      seedRow("oqood_fee", companyFees?.oqoodFee ?? FEE_FALLBACK.oqoodFee);
      return next;
    });
  }, [showStageGate, stageGateForm.final_price, stageGateForm.payment_plan_preset, opp.id, companyFees]);

  // Phase 3b: auto-calc DLD fee row when final_price OR dldPayer changes
  useEffect(() => {
    if (showStageGate !== "SPA Signed") return;
    const price = Number(stageGateForm.final_price || 0);
    if (!price) return;
    const dldAmount = Math.round(price * 0.04 * 100) / 100;
    setPrePaymentsState(p => {
      const next = {...p};
      // Don't override if broker already manually set this row (no override of explicit user action)
      const existingNotes = next.dld_fee?.notes || "";
      const wasAutoFilled = existingNotes.includes("Auto from DLD payer");
      const isPristine = next.dld_fee?.status === "pending" || wasAutoFilled;
      if (!isPristine) return p; // user touched it, leave alone

      if (dldPayer === "buyer") {
        next.dld_fee = {
          status: "pending",
          amount: "",
          expected_amount: dldAmount,
          date: "",
          notes: "Expected from DLD payer: Buyer (4% of final price)"
        };
      } else if (dldPayer === "developer") {
        next.dld_fee = {
          status: "waived",
          amount: "",
          date: "",
          notes: "Auto from DLD payer: Developer absorbs"
        };
      } else if (dldPayer === "split") {
        // Split: buyer pays X%, developer pays (100-X)%
        const buyerPct = Number(dldSplitPct) || 50;
        const buyerPortion = Math.round(dldAmount * (buyerPct/100) * 100) / 100;
        const devPortion = Math.round((dldAmount - buyerPortion) * 100) / 100;
        next.dld_fee = {
          status: "pending",
          amount: "",
          expected_amount: buyerPortion,
          date: "",
          notes: `Auto from DLD payer: Split — Buyer ${buyerPct}% (AED ${buyerPortion.toLocaleString()}), Developer ${100-buyerPct}% (AED ${devPortion.toLocaleString()})`
        };
      } else {
        // negotiated - clear so broker enters manually
        next.dld_fee = {
          status: "pending",
          amount: "",
          date: "",
          notes: "Auto from DLD payer: Negotiated (manual entry required)"
        };
      }
      return next;
    });
  }, [stageGateForm.final_price, dldPayer, dldSplitPct, showStageGate]);

  // Stage 5 — Upload SPA document to private 'documents' bucket
  async function uploadSpaDocument(file) {
    if (!file) return null;
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      setSpaUploadError("Only PDF, JPG, or PNG accepted");
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSpaUploadError("File too large (max 10MB)");
      return null;
    }
    try {
      setSpaUploading(true);
      setSpaUploadError(null);
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const path = `sales-closures/${currentUser.company_id}/${opp.id}/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;
      setStageGateForm(f => ({
        ...f,
        spa_document_path: path,
        spa_document_filename: file.name
      }));
      showToast(`Uploaded: ${file.name}`, "success");
      return path;
    } catch (err) {
      console.error("SPA upload failed:", err);
      setSpaUploadError(err.message || "Upload failed");
      showToast(`Upload failed: ${err.message || "unknown"}`, "error");
      return null;
    } finally {
      setSpaUploading(false);
    }
  }

  // Stage 5 — Open uploaded SPA via signed URL
  async function viewSpaDocument(path) {
    if (!path) return;
    try {
      const { data, error: signErr } = await supabase.storage
        .from("documents")
        .createSignedUrl(path, 3600);
      if (signErr) throw signErr;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      showToast(`Could not open SPA: ${err.message || "unknown"}`, "error");
    }
  }

  const commitStageMove = async(toStage, extraData) => {
    // ISSUE D Phase 1+2 — Pre-flight guard: prevent unit double-booking
    // Block ANY forward stage advance if another opp on same unit_id is at Reserved+
    // Phase 3 TODO: per-master-agreement configurable timeout for auto-release
    if (toStage !== "Closed Lost" && toStage !== "On Hold" && opp.unit_id) {
      try {
        const { data: conflictOpps, error: conflictErr } = await supabase
          .from("opportunities")
          .select("id, title, stage, stage_updated_at")
          .eq("unit_id", opp.unit_id)
          .neq("id", opp.id)
          .in("stage", ["Reserved", "SPA Requirements", "SPA Signed", "Closed Won"]);

        if (!conflictErr && conflictOpps && conflictOpps.length > 0) {
          const conflict = conflictOpps[0];
          const daysAgo = conflict.stage_updated_at
            ? Math.floor((Date.now() - new Date(conflict.stage_updated_at).getTime()) / 86400000)
            : null;
          const ageStr = daysAgo !== null ? ` (${daysAgo} day${daysAgo === 1 ? "" : "s"} ago)` : "";
          showToast(
            `⛔ Unit reserved by "${conflict.title}" at ${conflict.stage}${ageStr}. Pick a different unit or wait.`,
            "error"
          );
          return; // Block transition - no DB writes
        }
      } catch (e) {
        console.error("Unit double-booking guard exception:", e);
        // Fail-open on exception
      }
    }

    // STAGE GATE 1 (11 May 2026): Unit must have asking_price before Site Visit / Proposal Sent
    // Per founder spec: "Unit selected and there is no price for some reason should not even move forward"
    if (["Site Visit", "Proposal Sent"].includes(toStage) && opp.unit_id) {
      try {
        const { data: unitData, error: unitErr } = await supabase
          .from("project_units")
          .select("id, unit_ref, original_price, current_price")
          .eq("id", opp.unit_id)
          .maybeSingle();
        if (!unitErr && unitData) {
          const askingPrice = Number(unitData.current_price || unitData.original_price || 0);
          if (askingPrice <= 0) {
            showToast(
              `⛔ Unit ${unitData.unit_ref || ""} has no asking price set. Contact your manager to set unit pricing before advancing.`,
              "error"
            );
            return; // Block transition
          }
        }
      } catch (e) {
        console.error("Stage Gate 1 (unit asking_price) exception:", e);
        // Fail-open on exception
      }
    }

    const newStatus = toStage==="Closed Won"?"Won":toStage==="Closed Lost"?"Lost":"Active";
    const extra = {
      ...(toStage==="Closed Won"?{won_at:new Date().toISOString(), expected_handover_date: stageGateForm.handover_date||null, close_notes: stageGateForm.notes||null}:{}),
      ...(toStage==="Closed Lost"?{lost_at:new Date().toISOString()}:{}),
      ...extraData,
    };
    const{error}=await supabase.from("opportunities").update({
      stage:toStage, status:newStatus,
      stage_updated_at:new Date().toISOString(),
      ...extra
    }).eq("id",opp.id);
    if(error){showToast(error.message,"error");return;}
    onUpdated({...opp,stage:toStage,status:newStatus,...extra});
    // Phase 2.4: Auto-transition lead lifecycle to "customer" on Closed Won
    if (toStage === "Closed Won" && lead && lead.lifecycle_stage !== "customer") {
      supabase.from("leads").update({lifecycle_stage: "customer"}).eq("id", lead.id).then(null, e => console.warn("Lifecycle update failed:", e));
    }

    // Stage 5 — Sync final_price onto opportunity record when SPA is signed
    // (so subsequent stage validations like Closed Won find it)
    if (toStage === "SPA Signed" && (stageGateForm.final_price || opp.current_agreed_price || opp.budget)) {
      try {
        await supabase.from("opportunities")
          .update({ final_price: Number(stageGateForm.final_price) || Number(opp.current_agreed_price) || Number(opp.budget) || 0 })
          .eq("id", opp.id);
        // Also reflect in local opp object for immediate validation
        opp.final_price = Number(stageGateForm.final_price);
      } catch (e) {
        console.error("Failed to sync final_price onto opportunity:", e);
      }
    }

    // Stage 5 — Create or UPDATE sales closure record when SPA is signed
    // Bug C fix (12 May 2026): use upsert so re-edits work (was silently failing on duplicate)
    if (toStage === "SPA Signed" && (stageGateForm.final_price || opp.current_agreed_price || opp.budget)) {
      try {
        const { error: closErr } = await supabase
          .from("pp_sales_closures")
          .upsert({
            company_id: currentUser.company_id,
            opportunity_id: opp.id,
            spa_signed_date: stageGateForm.spa_date || new Date().toISOString().slice(0,10),
            spa_reference_number: stageGateForm.spa_ref || null,
            final_sale_price: Number(stageGateForm.final_price),
            spa_document_path: stageGateForm.spa_document_path || null,
            spa_document_filename: stageGateForm.spa_document_filename || null,
            pre_spa_payments: prePaymentsState,
            notes: stageGateForm.notes || null,
            updated_by: currentUser.id,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'opportunity_id' });
        if (closErr) {
          console.error("Sales closure upsert failed:", closErr);
          showToast("SPA recorded but closure log failed - check console", "warning");
        }
      } catch (e) {
        console.error("Sales closure upsert exception:", e);
      }
    }

    // Stage 6 — Auto-create draft commission invoice when SPA is signed
    if (toStage === "SPA Signed" && (stageGateForm.final_price || opp.current_agreed_price || opp.budget)) {
      try {
        // GF-21 guard: one invoice per opportunity
        const { data: existingInv } = await supabase.from("pp_commission_invoices")
          .select("id").eq("opportunity_id", opp.id).limit(1);
        if (existingInv && existingInv.length > 0) {
          console.log("Commission invoice already exists - skipping create");
        } else {
        const salePrice = Number(stageGateForm.final_price) || Number(opp.current_agreed_price) || Number(opp.budget) || 0;
        // GF-14 fallback: pct from company default if opp arrived empty (any create door)
        let commissionPct = Number(opp.commission_pct || 0);
        if (!commissionPct) {
          const { data: co } = await supabase.from("companies").select("default_commission_pct").eq("id", currentUser.company_id).maybeSingle();
          commissionPct = Number(co?.default_commission_pct || 0);
        }
        const commissionGross = Math.round(salePrice * commissionPct / 100 * 100) / 100;
        const vatPct = 5.00;
        const vatAmount = Math.round(commissionGross * vatPct / 100 * 100) / 100;
        const commissionNet = Math.round((commissionGross + vatAmount) * 100) / 100;

        const { data: closure } = await supabase
          .from("pp_sales_closures")
          .select("id")
          .eq("opportunity_id", opp.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Look up developer_id via master agreement (opportunities table doesn't have developer_id)
        let lookedUpDeveloperId = null;
        if (opp.master_agreement_id) {
          const { data: ma } = await supabase
            .from("pp_master_agreements")
            .select("developer_id")
            .eq("id", opp.master_agreement_id)
            .maybeSingle();
          lookedUpDeveloperId = ma?.developer_id || null;
        }
        // GF-19: no MA (the NORMAL 4%-flat path per founder) -> derive developer via unit->project
        if (!lookedUpDeveloperId && opp.unit_id) {
          const { data: u } = await supabase.from("project_units").select("project_id").eq("id", opp.unit_id).maybeSingle();
          if (u?.project_id) {
            const { data: pr } = await supabase.from("projects").select("pp_developer_id").eq("id", u.project_id).maybeSingle();
            lookedUpDeveloperId = pr?.pp_developer_id || null;
          }
        }

        // Stage 6 — FREEZE the agent split onto the invoice at SPA-Signed (same resolution the SM saw).
        // Computed on the GROSS commission (pre-VAT) — the agent's cut is of earned commission, not VAT.
        const _frozen = resolveCommission(opp, agent, companyStd, commissionGross);
        const { error: invErr } = await supabase
          .from("pp_commission_invoices")
          .insert({
            company_id: currentUser.company_id,
            opportunity_id: opp.id,
            agent_id: opp.assigned_to || null,
            agent_split_mode: _frozen._splitMode,
            agent_split_value: _frozen._splitVal,
            agent_commission: _frozen.agentCommission,
            company_net: _frozen.companyNet,
            sales_closure_id: closure?.id || null,
            developer_id: lookedUpDeveloperId,
            master_agreement_id: opp.master_agreement_id || null,
            sale_price: salePrice,
            commission_pct: commissionPct,
            commission_gross: commissionGross,
            vat_pct: vatPct,
            vat_amount: vatAmount,
            commission_net: commissionNet,
            invoice_status: "draft",
            created_by: currentUser.id,
            updated_by: currentUser.id,
          });
        if (invErr) {
          console.error("Commission invoice insert failed:", invErr);
          showToast("SPA recorded but commission invoice creation failed - check console", "warning");
        }
        }
      } catch (e) {
        console.error("Commission invoice insert exception:", e);
      }
    }

    // ISSUE D Phase 1 SHIPPED 10 May 2026 — pre-flight guard at top of this function
    // Phase 2 TODO: visual warnings on opp detail when other opps lose their unit
    // Phase 3 TODO: auto-release with per-master-agreement timeout (mix of auto + manual)
    // Issue 1 fix 11 May 2026: capture reservation amount + date when advancing to Reserved
    // (will be pre-filled into SPA Signed dialog's pre-SPA payments later)
    if (toStage === "Offer Accepted") {
      try { await supabase.from("opportunities").update({ offer_accepted_at: new Date().toISOString(), offer_valid_until: stageGateForm.offer_valid_until || null, offer_notes: stageGateForm.notes || null }).eq("id", opp.id); onUpdated?.({ ...opp, stage: "Offer Accepted", status: "Active", offer_accepted_at: new Date().toISOString(), offer_valid_until: stageGateForm.offer_valid_until || null, offer_notes: stageGateForm.notes || null }); } catch (e) { console.error("offer stamp:", e); }
    }
    if (toStage === "Reserved" && stageGateForm.reservation_fee) {
      try {
        await supabase.from("opportunities").update({
          reservation_amount: Number(stageGateForm.reservation_fee),
          reservation_date: stageGateForm.reservation_date || new Date().toISOString().slice(0,10),
          reservation_method: stageGateForm.payment_method || "Cheque",
          reservation_cheque_no: stageGateForm.cheque_number || null,
          reservation_notes: stageGateForm.notes || null,
        }).eq("id", opp.id);
        onUpdated?.({ ...opp, stage: "Reserved", status: "Active", reservation_amount: Number(stageGateForm.reservation_fee), reservation_date: stageGateForm.reservation_date || new Date().toISOString().slice(0,10), reservation_method: stageGateForm.payment_method || "Cheque", reservation_cheque_no: stageGateForm.cheque_number || null, reservation_notes: stageGateForm.notes || null });
        // Day 79 (C0b-1): THE LEDGER IS BORN HERE, not at the SPA dialog.
        // Founder: the ledger is the collection instrument for the whole Reserved->SPA period.
        // The fee policy of THIS MOMENT is frozen into the row; price-derived amounts follow the
        // price later. Only creates the row if one does not exist - never overwrites collections.
        try {
          const { data: existing } = await supabase.from("pp_sales_closures")
            .select("id").eq("opportunity_id", opp.id).maybeSingle();
          if (!existing) {
            const fees = await getFees(currentUser.company_id);
            const resAmt = Number(stageGateForm.reservation_fee);
            const price = Number(opp.current_agreed_price || 0);
            const bill = dealBill({
              price,
              planPreset: opp.current_payment_plan_preset,
              reservationAmount: resAmt,
              spaFee: fees.spaFee,
              oqoodFee: fees.oqoodFee,
              dldPayer: opp.current_dld_payer || "buyer",
              dldSplitPct: opp.current_dld_split_pct || 50,
              dldPct: fees.dldPct,
            });
            const resDate = stageGateForm.reservation_date || new Date().toISOString().slice(0,10);
            const row = (k, expected, extra) => ({ status: "pending", amount: "", date: "", notes: "", method: "", expected_amount: expected, ...(extra || {}) });
            const { error: insErr } = await supabase.from("pp_sales_closures").insert({
              opportunity_id: opp.id,
              company_id: currentUser.company_id,
              final_sale_price: price,
              pre_spa_payments: {
                booking_fee:     row("booking_fee", null),
                reservation_fee: { status: "received", amount: String(resAmt), date: resDate,
                                   method: stageGateForm.payment_method || "", notes: "Recorded at reservation",
                                   expected_amount: resAmt },
                initial_advance: row("initial_advance", bill.initial_advance.expected, bill.initial_advance.pct ? { expected_percent: bill.initial_advance.pct } : null),
                spa_fee:         row("spa_fee", bill.spa_fee.expected),
                dld_fee:         bill.dld_fee.waived
                                   ? { status: "waived", amount: "", date: "", notes: bill.dld_fee.note, method: "" }
                                   : row("dld_fee", bill.dld_fee.expected, { notes: bill.dld_fee.note }),
                oqood_fee:       row("oqood_fee", bill.oqood_fee.expected),
                other_fees:      row("other_fees", null),
              },
              frozen_fee_policy: { spaFee: fees.spaFee, oqoodFee: fees.oqoodFee, dldPct: fees.dldPct, frozen_at: new Date().toISOString() },
              created_by: currentUser.id,
            }).select();
            if (insErr) console.error("LEDGER BIRTH FAILED:", insErr.message, insErr.details, insErr.hint);
          }
        } catch (e) { console.error("ledger birth:", e); }
      } catch (e) {
        console.error("Reservation capture exception:", e);
      }
    }

    if (toStage === "Closed Won" && opp.stage === "SPA Signed") {
      const _pp = opp.spa_prep || {};
      const _missing = [];
      if (!_pp.docs_complete) _missing.push("docs");
      if (!_pp.signature_ready) _missing.push("signature");
      if (!_pp.buyer_mode) _missing.push("buyer attend/remote");
      if (!_pp.spa_uploaded) _missing.push("SPA upload");
      if (_missing.length > 0) {
        const pr = window.prompt("SPA preparation incomplete: " + _missing.join(", ") + ".\n\nBest: complete the checklist on the deal first.\nTo close anyway: type the reason (audited):");
        if (pr === null || !pr.trim()) return;
        try { await supabase.from("activities").insert({ opportunity_id: opp.id, lead_id: opp.lead_id, company_id: opp.company_id || currentUser.company_id || null, type: "Note", status: "completed", user_id: currentUser.id, user_name: currentUser.full_name || null, stage_at_event: "Closed Won", activity_subtype: "prep_override", note: "PREP OVERRIDE at close: missing " + _missing.join(", ") + " - reason: " + pr.trim() }); } catch (e) { console.error("prep audit:", e); }
      }
    }
    if(toStage==="Closed Won"&&opp.unit_id)
      await supabase.from("project_units").update({status:"Sold"}).eq("id",opp.unit_id);
    if(toStage==="Reserved"&&opp.unit_id)
      await supabase.from("project_units").update({status:"Reserved"}).eq("id",opp.unit_id);
    showToast(`Moved to ${toStage}`,"success");
    setShowStageGate(null);
    setStageGateViewMode(false);
    // Stage 5 — reset transient stage-gate UI state
    setPrePaymentsState({
      booking_fee:     { status: "pending", amount: "", date: "", notes: "" },
      reservation_fee: { status: "pending", amount: "", date: "", notes: "" },
      initial_advance: { status: "pending", amount: "", date: "", notes: "" },
      spa_fee:         { status: "pending", amount: "", date: "", notes: "" },
      dld_fee:         { status: "pending", amount: "", date: "", notes: "" },
      oqood_fee:       { status: "pending", amount: "", date: "", notes: "" },
      other_fees:      { status: "pending", amount: "", date: "", notes: "" },
    });
    setClosedWonEditPrice(false);
    setSingleDateValue("");
  };

  const savePayment=async()=>{
    if(!payForm.amount){showToast("Amount required","error");return;}
    setSaving(true);
    try{
      const payload={
        opportunity_id:opp.id, lead_id:lead.id,
        ...payForm, amount:Number(payForm.amount),
        percentage:payForm.percentage?Number(payForm.percentage):null,
        company_id:currentUser.company_id||null,created_by:currentUser.id,
      };
      let data,error;
      if(editPayment){
        ({data,error}=await supabase.from("sales_payments").update(payload).eq("id",editPayment.id).select().single());
        setPayments(p=>p.map(x=>x.id===editPayment.id?data:x));
      }else{
        ({data,error}=await supabase.from("sales_payments").insert(payload).select().single());
        setPayments(p=>[...p,data]);
      }
      if(error)throw error;
      showToast("Payment saved","success");
      setShowPayment(false);setEditPayment(null);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const printReceipt=(pay)=>{
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>body{font-family:Arial,sans-serif;max-width:420px;margin:40px auto}
    .hdr{background:#1E3A5F;color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center}
    .logo{font-size:20px;font-weight:700;color:#C9A84C}.bdy{border:1px solid #E2E8F0;border-top:none;padding:20px;border-radius:0 0 8px 8px}
    .amt{font-size:30px;font-weight:700;color:#0F2540;text-align:center;padding:16px 0;border-bottom:2px solid #E2E8F0;margin-bottom:16px}
    .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #F0F2F5;font-size:13px}
    .stamp{border:3px solid #1A7F5A;color:#1A7F5A;padding:6px 16px;border-radius:6px;font-size:14px;font-weight:700;display:inline-block;margin:12px auto;transform:rotate(-5deg)}
    </style></head><body>
    <div class="hdr"><div class="logo">◆ PropCRM</div><div style="font-size:13px;opacity:.7">Payment Receipt</div></div>
    <div class="bdy">
      <div class="amt">AED ${Number(pay.amount).toLocaleString()}</div>
      ${[["Client",lead.name],["Opportunity",opp.title||unit?.unit_ref||"—"],["Milestone",pay.milestone],["Type",pay.payment_type],pay.cheque_number&&["Cheque No.",pay.cheque_number],pay.bank_name&&["Bank",pay.bank_name],["Status",pay.status],["Date",new Date().toLocaleDateString("en-AE",{day:"numeric",month:"long",year:"numeric"})]].filter(Boolean).map(([l,v])=>`<div class="row"><span style="color:#718096">${l}</span><span style="font-weight:600">${v}</span></div>`).join("")}
      ${pay.cheque_file_url?`<img src="${pay.cheque_file_url}" style="width:100%;margin-top:12px;border-radius:6px;border:1px solid #E2E8F0"/>`:""}
      <div style="text-align:center"><div class="stamp">${pay.status==="Cleared"?"✓ CLEARED":"✓ RECEIVED"}</div></div>
    </div></body></html>`;
    const w=window.open("","_blank","width=500,height=700");
    if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),500);}
  };

  const totalPaid = payments.filter(p=>["Cleared","Received","Deposited"].includes(p.status)).reduce((s,p)=>s+(p.amount||0),0);
  const totalDue  = payments.reduce((s,p)=>s+(p.amount||0),0);

  // Stage age in days (Phase E dense layout)
  const stageAgeDays = opp.stage_updated_at
    ? Math.max(0, Math.floor((new Date() - new Date(opp.stage_updated_at)) / 86400000))
    : null;

  {saturationWarning && (
    <UnitSaturationWarning
      saturation={saturationWarning.saturation}
      onContinue={() => {
        setEditOppForm(f => ({...f, unit_id: saturationWarning.unitId}));
        setSaturationWarning(null);
      }}
      onPickDifferent={() => {
        setEditOppForm(f => ({...f, unit_id: ""}));
        setSaturationWarning(null);
      }}
    />
  )}
  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Compact header — name + stage + meta in one row */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,flexWrap:"wrap",paddingBottom:10,borderBottom:"1px solid #EEF2F7"}}>
        <button onClick={onBack} style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>← Back</button>
        {canEdit&&!isWon&&<button onClick={()=>{
          setEditOppForm({
            title: opp.title || "",
            budget: opp.budget ? String(opp.budget) : "",
            unit_id: opp.unit_id || "",
            commission_pct: opp.commission_pct != null ? String(opp.commission_pct) : "",
            notes: opp.notes || "",
            assigned_to: opp.assigned_to || "",
            property_category: opp.property_category || "Off-Plan",
          });
          setShowEditOpp(true);
        }} style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>✏ Edit</button>}
        {opp?.unit_id&&<button onClick={()=>openPropertyPack(opp.unit_id)} style={{padding:"6px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>📦 Share Pack</button>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0F2540",letterSpacing:"-.3px"}}>{opp.title||`Opportunity — ${lead.name}`}</span>
            <span style={{padding:"2px 9px",borderRadius:14,background:sm.bg,color:sm.c,fontSize:10,fontWeight:700}}>▶ {opp.stage}</span>
            {opp.status==="On Hold"&&<span style={{padding:"2px 9px",borderRadius:14,background:"#F7F9FC",color:"#718096",fontSize:10,fontWeight:600}}>On Hold</span>}
            {stageAgeDays!==null&&<span style={{fontSize:10,color:"#94A3B8"}}>· {stageAgeDays===0?"today":stageAgeDays===1?"1d":`${stageAgeDays}d`} in stage</span>}
          </div>
          {/* Finding 2 fix (11 May 2026): show linked unit prominently on opp header */}
          {/* 16 May 2026: Added price for broker's at-a-glance budget context */}
          {opp.unit_id && (() => {
            const linkedUnit = (units || []).find(u => u.id === opp.unit_id);
            if (!linkedUnit) return null;
            const linkedProj = (projects || []).find(p => p.id === linkedUnit.project_id);
            const linkedSp = (salePricing || []).find(s => s.unit_id === linkedUnit.id);
            const linkedPrice = linkedSp?.asking_price;
            const bedLabel = linkedUnit.bedrooms === 0 ? "Studio" : (linkedUnit.bedrooms ? `${linkedUnit.bedrooms}BR` : "");
            const details = [bedLabel, linkedProj?.name, linkedUnit.size_sqft && `${linkedUnit.size_sqft} sqft`, linkedUnit.view].filter(Boolean).join(" · ");
            return (
              <div style={{fontSize:11,marginTop:3,display:"inline-flex",alignItems:"center",gap:6,padding:"2px 9px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:12,width:"fit-content"}}>
                <span>🏠</span>
                <strong style={{color:"#0C4A6E",fontWeight:700}}>{linkedUnit.unit_ref}</strong>
                {linkedPrice && <strong style={{color:"#1A5FA8",fontWeight:700,marginLeft:2}}>AED {Number(linkedPrice).toLocaleString()}</strong>}
                <span style={{color:"#0369A1"}}>· {details}</span>
                <button
                  onClick={() => { setSelectedUnitForPack(linkedUnit); setShowUnitPack(true); }}
                  style={{background:"#1A5FA8",color:"#fff",border:"none",padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:600,cursor:"pointer",marginLeft:4}}
                >
                  📦 Pack
                </button>
              </div>
            );
          })()}

          <div style={{fontSize:11,color:"#718096",marginTop:3,display:"flex",gap:8,flexWrap:"wrap"}}>
            <span>{lead.name}</span>
            {lead.phone&&<span>· {lead.phone}</span>}
            {agent&&<span>· Owner: <strong style={{color:"#0F2540",fontWeight:600}}>{agent.full_name}</strong></span>}
            {opp.budget&&<span>· Budget: <strong style={{color:"#0F2540",fontWeight:600}}>AED {Number(opp.budget).toLocaleString()}</strong></span>}
          </div>
        </div>
      </div>

      {/* Main content area — single unified scroll, no tabs */}
      <div style={{flex:1,overflowY:"auto"}}>

        {/* ── DEAL OVERVIEW: workflow band + property card + notes ── */}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {/* Ownership Notice */}
            {!isOwner&&canEdit&&(
              <div style={{background:canAction?"#E6F4EE":"#FFFBEB",border:`1px solid ${canAction?"#A8D5BE":"#FDE68A"}`,borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <div style={{flex:1}}>
                  <span style={{fontSize:12,fontWeight:600,color:canAction?"#1A7F5A":"#92400E"}}>
                    {canAction?"✓ You have taken ownership of this deal":"⚠ You are viewing this deal — assigned to "}<strong>{users?.find(u=>u.id===opp.assigned_to)?.full_name||"another agent"}</strong>
                  </span>
                  {!canAction&&<div style={{fontSize:11,color:"#92400E",marginTop:2}}>Stage actions are restricted to the assigned agent. Take ownership or reassign to make changes.</div>}
                </div>
                <div style={{display:"flex",gap:8}}>
                  {!canAction&&canReassign&&(
                    <button onClick={async()=>{
                      const confirm = window.confirm(`Take ownership of this deal?

This will be logged and the current agent (${users?.find(u=>u.id===opp.assigned_to)?.full_name||"unknown"}) will be notified.

You will become the assigned agent.`);
                      if(!confirm) return;
                      const{error}=await supabase.from("opportunities").update({assigned_to:currentUser.id,stage_updated_at:new Date().toISOString()}).eq("id",opp.id);
                      if(error){showToast(error.message,"error");return;}
                      setTookOwnership(true);
                      onUpdated({...opp,assigned_to:currentUser.id});
                      showToast("You have taken ownership of this deal","success");
                      // Log activity
                      await supabase.from("activities").insert({lead_id:opp.lead_id,company_id:currentUser.company_id||null,type:"Note",note:`Ownership transferred to ${currentUser.full_name}`,status:"completed",created_by:currentUser.id,opportunity_id:opp.id});
                    }}
                      style={{padding:"6px 14px",borderRadius:7,border:"none",background:"#0F2540",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                      Take Ownership
                    </button>
                  )}
                  {canReassign&&(
                    <button onClick={()=>{setReassignForm({assigned_to:"",reason:""});setShowReassign(true);}}
                      style={{padding:"6px 14px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",color:"#0F2540",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                      Reassign
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ISSUE D Phase 2 — Unit conflict banner */}
            {unitConflict && (
              <div style={{
                background:"linear-gradient(135deg,#FEF3C7,#FDE68A)",
                border:"1.5px solid #F59E0B",
                borderRadius:12,
                padding:"14px 18px",
                display:"flex",
                alignItems:"center",
                gap:14,
                boxShadow:"0 1px 3px rgba(245,158,11,.15)"
              }}>
                <div style={{fontSize:24}}>⚠️</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#78350F",marginBottom:3}}>
                    Unit is reserved by another deal
                  </div>
                  <div style={{fontSize:12,color:"#92400E",lineHeight:1.4}}>
                    "<strong>{unitConflict.title}</strong>" is at <strong>{unitConflict.stage}</strong>
                    {unitConflict.daysAgo !== null && ` (${unitConflict.daysAgo} day${unitConflict.daysAgo === 1 ? "" : "s"} ago)`}.
                    {" "}Pick a different unit, mark this opportunity as Lost, or wait if reservation expires.
                  </div>
                </div>
                <button
                  onClick={() => {
                    showToast(
                      "📞 Contact buyer first to discuss alternative options or mark Lost. " +
                      "Smart change-unit dialog with consent flow coming soon.",
                      "info"
                    );
                  }}
                  style={{
                    padding:"7px 14px",
                    background:"#92400E",
                    color:"#fff",
                    border:"none",
                    borderRadius:7,
                    fontSize:11,
                    fontWeight:700,
                    cursor:"pointer",
                    whiteSpace:"nowrap"
                  }}
                  title="Stage 7: Will open buyer consent dialog with alternatives + Lost option">
                  Discuss with Buyer
                </button>
              </div>
            )}

            {/* Workflow bar */}
            <div style={{background:"#fff",border:"1px solid #E8EDF4",borderRadius:12,padding:"8px 14px"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".6px",marginBottom:4,display:"flex",alignItems:"center",gap:8}}>
                <span>Deal Journey</span>
                {(()=>{ /* kycChip: nag while money moves without verified KYC (piece 4) */
                  const k = lead?.kyc_status || "not_started";
                  if (!["Reserved","SPA Requirements","SPA Signed"].includes(opp.stage) || k === "verified") return null;
                  return <span style={{fontSize:9,fontWeight:700,padding:"1px 8px",borderRadius:20,background:"#FDF3DC",color:"#8A6200",textTransform:"none",letterSpacing:0}}>{"\u26a0 KYC incomplete \u00b7 "}{k.replace("_"," ")}</span>;
                })()}
                {(()=>{ /* Terms Pending chip (Wilderness Part 2): money held without documented terms */
                  const termsCleared = !opp.current_agreed_price; if (!["Reserved","SPA Requirements","SPA Signed"].includes(opp.stage) || ((proposals || []).length > 0 && !termsCleared)) return null;
                  return opp.block_deal_id
                    ? <span style={{fontSize:9,fontWeight:700,padding:"1px 8px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A",textTransform:"none",letterSpacing:0,marginLeft:6}}>{"\u2713 Block terms \u00b7 D-locked"}</span>
                    : <span style={{fontSize:9,fontWeight:700,padding:"1px 8px",borderRadius:20,background:"#FEF2F2",color:"#B91C1C",textTransform:"none",letterSpacing:0,marginLeft:6}}>{"\u26a0 Terms pending \u00b7 no proposal sent"}</span>;
                })()}
              </div>
              
              {/* Stage pills */}
              <div style={{display:"flex",alignItems:"center",overflowX:"auto",gap:0,marginBottom:6,paddingBottom:2}}>
                {OPP_STAGES.filter(s=>s!=="Closed Lost").map((s,i,arr)=>{
                  const curIdx=OPP_STAGES.indexOf(opp.stage);
                  const thisIdx=OPP_STAGES.indexOf(s);
                  const isDone=curIdx>thisIdx;
                  const isCur=opp.stage===s;
                  const m=OPP_STAGE_META[s]||{c:"#718096",bg:"#F7F9FC"};
                  return (
                    <div key={s} style={{display:"flex",alignItems:"center",flexShrink:0}}>
                      <div onClick={()=>{
                          // 18 May 2026 UX-COMPLETED-STAGE-001:
                          // Completed stages can be REOPENED for view/edit (audit trail).
                          // GATED_STAGES have dialogs that load saved closure data automatically.
                          // Non-gated stages: show toast (details in activity log).
                          if (isDone || (isCur && GATED_STAGES.includes(s))) {
                            if (GATED_STAGES.includes(s)) {
                              // view-mode hydration: seed the dialog from the captured record
                              if (s === "Offer Accepted") {
                                setStageGateForm({
                                  final_price: opp.current_agreed_price || "",
                                  offer_valid_until: (opp.offer_valid_until || "").slice(0,10),
                                  notes: opp.offer_notes || "",
                                });
                              }
                              if (s === "Reserved") {
                                setStageGateForm({
                                  reservation_fee: opp.reservation_amount || "",
                                  reservation_date: (opp.reservation_date || "").slice(0,10),
                                  payment_method: opp.reservation_method || "Cheque",
                                  cheque_number: opp.reservation_cheque_no || "",
                                  notes: opp.reservation_notes || "",
                                });
                              }
                              setStageGateViewMode(true);
                              setShowStageGate(s);
                            } else {
if (s === "SPA Requirements") { setDashboardTab("financials"); showToast("The bill lives here - collect toward zero variance", "info"); } else {                               showToast(`${s} details are captured in the activity log below`, "info"); }
                            }
                          } else if (canAction) {
                            moveStage(s);
                          }
                        }}
                        title={isDone ? (GATED_STAGES.includes(s) ? `Click to view/edit ${s} details` : "Details in activity log") : (canAction?"Click to move to this stage":isOwner?"":"You are not the assigned agent — reassign first")}
                        style={{padding:"5px 14px",borderRadius:20,
                          background:isCur?m.c:isDone?"#E6F4EE":"#F7F9FC",
                          color:isCur?"#fff":isDone?"#1A7F5A":"#94A3B8",
                          border:`1.5px solid ${isCur?m.c:isDone?"#A8D5BE":"#E2E8F0"}`,
                          fontSize:11,fontWeight:isCur||isDone?700:400,
                          cursor:canEdit?"pointer":"default",whiteSpace:"nowrap",transition:"all .15s"}}>
                        {isDone?"✓ ":isCur?"▶ ":""}{s==="Proposal Sent" ? `Quoted${proposals.length>0?` (${proposals.length})`:""}` : s}
                      </div>
                      {i<arr.length-1&&(
                        <div style={{width:20,height:1,background:isDone?"#A8D5BE":"#E2E8F0",flexShrink:0,position:"relative"}}>
                          <div style={{position:"absolute",right:-4,top:-3,width:0,height:0,borderTop:"4px solid transparent",borderBottom:"4px solid transparent",borderLeft:`5px solid ${isDone?"#A8D5BE":"#E2E8F0"}`}}/>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Stage action buttons */}
              {canAction&&!isWon&&opp.stage!=="Closed Lost"&&(()=>{
                const m=OPP_STAGE_META[opp.stage]||{c:"#718096",bg:"#F7F9FC"};
                const stageIdx=OPP_STAGES.indexOf(opp.stage);
                const nextStageName=OPP_STAGES[stageIdx+1];
                // Stage-aware "next action" suggestion (the primary CTA for this stage)
                const NEXT_ACTION_BY_STAGE = {
                  "New":            "Make first contact",
                  "Contacted":      "Schedule a site visit",
                  "Site Visit":     "Follow up and send proposal when ready",
                  "Proposal Sent":  "Capture customer response",
                  "Negotiation":    "Lock in the offer",
                  "Offer Accepted": "Collect reservation fee",
                  "Reserved":       "Advance to SPA Requirements — collect payments",
                  "SPA Signed":     "SPA executed — close when handover terms settle",
                };
                const nextActionLabel = NEXT_ACTION_BY_STAGE[opp.stage] || "";
                // Phase E W3 — Send Proposal available from any active stage.
                // Agent decides when to send a proposal independent of stage progression.
                // Excluded only from terminal stages (Closed Won/Lost) where deal is done.
                const showSendProposal = canEdit && !["Closed Won","Closed Lost"].includes(opp.stage) && unit;
                return(
                  <div style={{paddingTop:6,borderTop:"1px solid #F1F5F9"}}>
                    {/* Next-action hint */}
                    {nextActionLabel&&(
                      <div style={{fontSize:11,color:"#475569",marginBottom:5,fontStyle:"italic"}}>
                        💡 What's next: <strong style={{color:"#0F2540",fontStyle:"normal"}}>{(["Reserved","SPA Requirements","SPA Signed"].includes(opp.stage) && (proposals||[]).length===0 && !opp.block_deal_id) ? "Send the proposal \u2014 money is held on unagreed terms" : nextActionLabel}</strong>
                      </div>
                    )}

                    {collectionState && collectionState.bill > 0 && (() => { const m = (n) => "AED " + Number(n||0).toLocaleString(); return (
                      <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:9,padding:"7px 13px",marginBottom:8,fontSize:12}}>
                        <span style={{fontWeight:700,color:"#92400E"}}>Collection</span>
                        <span style={{color:"#475569"}}>Bill <strong style={{color:"#0F2540"}}>{m(collectionState.bill)}</strong></span>
                        <span style={{color:"#475569"}}>Collected <strong style={{color:"#166534"}}>{m(collectionState.collected)}</strong></span>
                        <span style={{color:"#475569"}}>To collect <strong style={{color:collectionState.toCollect > 0 ? "#B91C1C" : "#166534"}}>{m(collectionState.toCollect)}</strong></span>
                        {collectionState.toCollect <= 0 && <span style={{fontSize:11,fontWeight:700,color:"#166534"}}>fully collected</span>}
                        {opp.reservation_amount > 0 && (
                          <button onClick={async ()=>{
                            const { data: cl } = await supabase.from("pp_sales_closures").select("pre_spa_payments").eq("opportunity_id", opp.id).maybeSingle();
                            const { data: co } = await supabase.from("companies").select("name, brand_color, brand_accent").eq("id", currentUser.company_id).maybeSingle();
                            const u = units?.find?.(x => x.id === opp.unit_id) || null;
                            generateReceiptPDF({ lead: lead, opp: opp, unit: u, project: null, company: co, currentUser: currentUser, ledger: cl?.pre_spa_payments, expiresOn: opp.reservation_expires_on });
                          }} style={{marginLeft:"auto",padding:"4px 12px",borderRadius:7,border:"1px solid #92400E",background:"#fff",color:"#92400E",fontSize:11,fontWeight:700,cursor:"pointer"}}>Receipt</button>
                        )}
                      </div>
                    ); })()}
                    {opp.stage === "SPA Signed" && (() => {
                      const prep = opp.spa_prep || {};
                      const togglePrep = async (k, v) => {
                        const next = { ...prep, [k]: v };
                        try { await supabase.from("opportunities").update({ spa_prep: next }).eq("id", opp.id); onUpdated?.({ ...opp, spa_prep: next }); } catch (e) { showToast("Prep save failed: " + e.message, "error"); }
                      };
                      const chip = (k, label) => { const on = !!prep[k]; return <button key={k} type="button" onClick={() => togglePrep(k, !on)} style={{padding:"4px 10px",borderRadius:14,border:"1.5px solid " + (on ? "#16A34A" : "#E2E8F0"),background:on ? "#DCFCE7" : "#fff",color:on ? "#166534" : "#94A3B8",fontSize:10,fontWeight:700,cursor:"pointer"}}>{(on ? "\u2713 " : "") + label}</button>; };
                      return (
                        <div style={{margin:"4px 0 8px",padding:"8px 10px",background:"#FAFBFE",border:"1px dashed #C7D2E5",borderRadius:10}}>
                          <div style={{fontSize:9,fontWeight:700,color:"#7C3AED",textTransform:"uppercase",letterSpacing:".6px",marginBottom:5}}>SPA preparation</div>
                          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                            {chip("docs_complete", "Docs complete")}
                            {chip("signature_ready", "Signature ready")}
                            <span style={{display:"inline-flex",gap:4,alignItems:"center"}}>
                              <span style={{fontSize:9,color:"#94A3B8",fontWeight:700}}>BUYER:</span>
                              <button type="button" onClick={() => togglePrep("buyer_mode", prep.buyer_mode === "attend" ? null : "attend")} style={{padding:"4px 10px",borderRadius:14,border:"1.5px solid " + (prep.buyer_mode === "attend" ? "#0F2540" : "#E2E8F0"),background:prep.buyer_mode === "attend" ? "#0F2540" : "#fff",color:prep.buyer_mode === "attend" ? "#fff" : "#94A3B8",fontSize:10,fontWeight:700,cursor:"pointer"}}>Attends</button>
                              <button type="button" onClick={() => togglePrep("buyer_mode", prep.buyer_mode === "remote" ? null : "remote")} style={{padding:"4px 10px",borderRadius:14,border:"1.5px solid " + (prep.buyer_mode === "remote" ? "#0F2540" : "#E2E8F0"),background:prep.buyer_mode === "remote" ? "#0F2540" : "#fff",color:prep.buyer_mode === "remote" ? "#fff" : "#94A3B8",fontSize:10,fontWeight:700,cursor:"pointer"}}>Signs remotely</button>
                            </span>
                            {chip("spa_uploaded", "SPA uploaded")}
                          </div>
                        </div>
                      );
                    })()}
                    {/* Two clearly separated zones: ACTIVITY (left) and STAGE (right) */}
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-start"}}>

                      {/* Activity zone — logging, doesn't change stage */}
                      <div style={{flex:"1 1 280px",minWidth:260,background:"#F8FAFC",border:"1px solid #E8EDF4",borderRadius:10,padding:"6px 10px"}}>
                        <div style={{fontSize:9,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".6px",marginBottom:4}}>Log activity</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          <button onClick={()=>{setFabLogType("Call");setShowFabLog(true);}}
                            style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540"}}>
                            📞 Log Call
                          </button>
                          <button onClick={()=>{setFabLogType("WhatsApp");setShowFabLog(true);}}
                            style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540"}}>
                            💬 WhatsApp
                          </button>
                          <button onClick={()=>{setFabLogType("Note");setShowFabLog(true);}}
                            style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540"}}>
                            📝 Add Note
                          </button>
                          {showSendProposal&&(
                            <button onClick={()=>requestProposalDialog()}
                              style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #BFDBFE",background:"#EFF6FF",fontSize:11,fontWeight:700,cursor:"pointer",color:"#1A5FA8"}}>
                              📤 Send Proposal
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Stage advancement zone — changes stage */}
                      <div style={{flex:"1 1 280px",minWidth:260,background:`${m.bg}`,border:`1px solid ${m.c}33`,borderRadius:10,padding:"6px 10px"}}>
                        <div style={{fontSize:9,fontWeight:700,color:m.c,textTransform:"uppercase",letterSpacing:".6px",marginBottom:4}}>Deal actions</div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                          {/* 17 May 2026 ARCH-SIMPLIFY-002: hide Move Stage button when next is Proposal Sent.
                              Path to Proposal Sent must be through "Send Proposal" in Log Activity zone,
                              which auto-advances stage. Prevents orphan "Quoted (0)" state where stage
                              advances without an actual proposal being created. */}
                          {nextStageName&&nextStageName!=="Closed Won"&&nextStageName!=="Proposal Sent"&&(
                            <button onClick={()=>moveStage(nextStageName)}
                              style={{padding:"7px 14px",borderRadius:7,border:"none",background:m.c,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5,boxShadow:"0 2px 6px rgba(0,0,0,.08)"}}>
                              {/* Day 79: name the ACT, not the destination. "Advance to SPA Signed"
                                  while 3.5M is outstanding invites an act the gate will refuse. */}
                              {(opp.stage === "SPA Requirements" && collectionState && collectionState.toCollect > 0)
                                ? "Collect payments" : "\u2713 Advance to " + nextStageName}
                            </button>
                          )}
                          {nextStageName==="Proposal Sent"&&(
                            <div style={{fontSize:11,color:"#64748B",fontStyle:"italic",padding:"7px 0"}}>
                              💡 To advance to Quoted, use <strong style={{color:"#0F2540",fontStyle:"normal"}}>📤 Send Proposal</strong> in Log Activity
                            </div>
                          )}
                          {(opp.stage==="Offer Accepted"||opp.stage==="Negotiation")&&(
                            <button onClick={()=>moveStage("Reserved")}
                              style={{padding:"6px 12px",borderRadius:7,border:"none",background:"#7C3AED",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                              🔒 Record Reservation
                            </button>
                          )}
                          {opp.stage==="SPA Signed"&&(
                            <button onClick={()=>moveStage("Closed Won")}
                              style={{padding:"7px 14px",borderRadius:7,border:"none",background:"#1A7F5A",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                              ✓ Close Won
                            </button>
                          )}
                          <button onClick={()=>moveStage("Closed Lost")}
                            style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #FECACA",background:"#FEF2F2",color:"#B83232",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                            ✗ Close as Lost
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {isWon&&<div style={{padding:"8px 12px",background:"#E6F4EE",borderRadius:8,fontSize:12,color:"#1A7F5A",fontWeight:600,border:"1px solid #A8D5BE"}}>🎉 Deal Won — Payments and Contract are unlocked</div>}
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* 19 May 2026 Phase 2a: DASHBOARD TAB STRIP                */}
            {/* Adds horizontal tab navigation + main panel above sections */}
            {/* Existing sections (Coach, Proposals, etc) still visible below */}
            {/* In Phase 2b+, sections will move INTO their respective tabs */}
            {/* ═══════════════════════════════════════════════════ */}
            <div style={{marginBottom:14}}>
              {/* Tab Strip - horizontal tabs like browser */}
              <div style={{display:"flex",gap:2,background:"#fff",border:"1px solid #E2E8F0",borderRadius:"10px 10px 0 0",padding:"6px 6px 0 6px",overflowX:"auto",whiteSpace:"nowrap"}}>
                {[
                  ["proposals", "📤 Proposals", proposals.length],
                  ["negotiations", "🤝 Negotiations", null],
                  ["financials", "💰 Money", null],
                  ["plan", "🏗️ Payment Plan", null],
                  ["next-steps", "⏰ Next Steps", reminders.filter(r=>r.status==="pending").length],
                  ["upfront", "📊 Upfront", null],
                  ["log-activity", "📋 Activity", activities.length],
                  ["coach", "✨ Coach", null],
                ].map(([tabId, label, count]) => {
                  const isActive = dashboardTab === tabId;
                  // 20 May 2026: AI visual emphasis for Coach tab (gradient + glow)
                  const isCoach = tabId === "coach";
                  const coachActiveBg = "linear-gradient(135deg, #6D28D9 0%, #0E7490 100%)";
                  const coachInactiveBg = "linear-gradient(135deg, #EDE9FE 0%, #CCFBF1 100%)";
                  return (
                    <div key={tabId}
                      onClick={() => setDashboardTab(isActive ? null : tabId)}
                      style={{
                        padding:"7px 14px",
                        borderRadius:"7px 7px 0 0",
                        border: isCoach
                          ? (isActive ? "1px solid #6D28D9" : "1px solid #A5F3FC")
                          : (isActive ? "1px solid #E2E8F0" : "1px solid transparent"),
                        borderBottom: isActive ? "1px solid #fff" : "none",
                        background: isCoach
                          ? (isActive ? coachActiveBg : coachInactiveBg)
                          : (isActive ? "#fff" : "#F8FAFC"),
                        color: isCoach
                          ? (isActive ? "#fff" : "#0E7490")
                          : (isActive ? "#1D4ED8" : "#64748B"),
                        boxShadow: isCoach ? (isActive ? "0 0 8px rgba(109, 40, 217, 0.3)" : "0 0 4px rgba(13, 116, 144, 0.15)") : "none",
                        cursor:"pointer",
                        fontSize:11,
                        fontWeight: isCoach ? 700 : 600,
                        display:"flex",
                        alignItems:"center",
                        gap:5,
                        flexShrink:0,
                        marginBottom: isActive ? -1 : 0,
                        position: isActive ? "relative" : "static",
                        zIndex: isActive ? 2 : 1,
                        transition:"all .15s"
                      }}>
                      {label}
                      {count != null && count > 0 && (
                        <span style={{
                          fontSize:9,
                          padding:"1px 5px",
                          borderRadius:6,
                          background: isActive ? "#1D4ED8" : "#DBEAFE",
                          color: isActive ? "#fff" : "#1D4ED8",
                          fontWeight:700
                        }}>{count}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Main Panel - shows welcome state or selected tab content */}
              <div style={{background:"#fff",border:"1px solid #E2E8F0",borderTop:"none",borderRadius:"0 0 10px 10px",minHeight:200,padding:"20px 22px"}}>
                {!dashboardTab ? (
                  <div style={{textAlign:"center",padding:"50px 30px",color:"#94A3B8"}}>
                    <div style={{fontSize:36,marginBottom:8}}>👋</div>
                    <div style={{fontSize:15,fontWeight:700,color:"#0F2540",marginBottom:4}}>Pick a section to explore</div>
                    <div style={{fontSize:12,color:"#64748B",maxWidth:380,margin:"0 auto 14px auto",lineHeight:1.5}}>
                      Each tab opens a full-width view with breathing room. Sections also remain visible below as we transition.
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>
                      <span onClick={()=>setDashboardTab("proposals")} style={{padding:"5px 11px",borderRadius:14,background:"#F1F5F9",color:"#475569",fontSize:11,fontWeight:600,cursor:"pointer"}}>📤 Proposals</span>
                      <span onClick={()=>setDashboardTab("financials")} style={{padding:"5px 11px",borderRadius:14,background:"#F1F5F9",color:"#475569",fontSize:11,fontWeight:600,cursor:"pointer"}}>💰 Money</span>
                      <span onClick={()=>setDashboardTab("negotiations")} style={{padding:"5px 11px",borderRadius:14,background:"#F1F5F9",color:"#475569",fontSize:11,fontWeight:600,cursor:"pointer"}}>🤝 Negotiations</span>
                    </div>
                  </div>
                ) : dashboardTab === "proposals" ? (
                  /* 20 May 2026 Phase 2b: PROPOSALS PANEL - Excel table + buyer outflow */
                  <div style={{padding:"4px 2px"}}>
                    {/* Header with action buttons */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:10,borderBottom:"2px solid #F1F5F9"}}>
                      <div style={{fontSize:16,fontWeight:700,color:"#0F2540",display:"flex",alignItems:"center",gap:8}}>
                        📤 Proposals
                        <span style={{fontSize:10,padding:"2px 7px",borderRadius:8,background:"#DBEAFE",color:"#1D4ED8",fontWeight:700}}>{proposals.length} total</span>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        {canEdit && !["Closed Won","Closed Lost"].includes(opp.stage) && (
                          <button onClick={()=>requestProposalDialog()} style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #1D4ED8",background:"#1D4ED8",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                            {proposals.length===0 ? "+ Build proposal" : "+ Send Revised"}
                          </button>
                        )}
                      </div>
                    </div>
                    {proposals.length === 0 ? (
                      <div style={{textAlign:"center",padding:"40px 20px",color:"#94A3B8",fontSize:12}}>
                        No proposals sent yet. Click "Build proposal" to create the first one.
                      </div>
                    ) : (
                      <>
                        {/* Excel-style version table */}
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:18}}>
                          <thead>
                            <tr style={{background:"#F8FAFC",borderBottom:"2px solid #E2E8F0"}}>
                              <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".4px",color:"#475569",fontWeight:700}}>V#</th>
                              <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".4px",color:"#475569",fontWeight:700}}>Sent</th>
                              <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".4px",color:"#475569",fontWeight:700}}>Discount</th>
                              <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".4px",color:"#475569",fontWeight:700}}>Net Price</th>
                              <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".4px",color:"#475569",fontWeight:700}}>Plan</th>
                              <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".4px",color:"#475569",fontWeight:700}}>DLD</th>
                              <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".4px",color:"#475569",fontWeight:700}}>Status</th>
                              <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".4px",color:"#475569",fontWeight:700}}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {proposals.map((p, idx) => {
                              const sm2 = PROPOSAL_STATUS_META[p.status] || PROPOSAL_STATUS_META.sent;
                              const sd = p.structured_data || {};
                              const isLatest = idx === 0;
                              const proposalNumber = proposals.length - idx;
                              const proposalUnits = (sd.proposal_units && sd.proposal_units.length>0) ? sd.proposal_units : [];
                              const firstUnit = proposalUnits[0] || {};
                              const discountPct = Number(firstUnit.discount_pct || sd.discount_pct || 0);
                              const netPrice = Number(sd.total_value || firstUnit.discounted_price || 0);
                              const dPlan = p.payment_plan || sd.payment_plan || "—";
                              const dldLabel2 = DLD_OPTIONS.find(o=>o.value===sd.dld_handling)?.label || "—";
                              const dldShort = dldLabel2.includes("Buyer") ? "Buyer" : dldLabel2.includes("Developer") ? "Dev" : dldLabel2.includes("Split") ? "Split" : dldLabel2.includes("Neg") ? "Neg" : dldLabel2;
                              const _prev = proposals[idx+1];
                              const _psd = _prev?.structured_data || {};
                              const _pU = (_psd.proposal_units && _psd.proposal_units.length>0) ? _psd.proposal_units : [];
                              const _pF = _pU[0] || {};
                              const _pDisc = Number(_pF.discount_pct || _psd.discount_pct || 0);
                              const _pNet  = Number(_psd.total_value || _pF.discounted_price || 0);
                              const _pPlan = _prev?.payment_plan || _psd.payment_plan || "—";
                              const _pDld  = _psd.dld_handling || "";
                              const _cDld  = sd.dld_handling || "";
                              const _chips = [];
                              if (_prev) {
                                if (_pDisc !== discountPct) _chips.push(`Discount ${_pDisc}% → ${discountPct}%`);
                                if (_pNet && netPrice && _pNet !== netPrice) _chips.push(`Price AED ${Number(_pNet).toLocaleString()} → AED ${Number(netPrice).toLocaleString()}`);
                                if (_pPlan !== dPlan && dPlan !== "—") _chips.push(`Plan ${_pPlan} → ${dPlan}`);
                                if (_pDld !== _cDld && _cDld) { const _l=DLD_OPTIONS.find(o=>o.value===_cDld)?.label||_cDld; const _pl=DLD_OPTIONS.find(o=>o.value===_pDld)?.label||_pDld||"—"; _chips.push(`DLD ${_pl} → ${_l}`); }
                              }
                              let _why = [];
                              if (_prev) {
                                const _winEnd = new Date(p.sent_at || p.created_at || 0).getTime();
                                const _winStart = new Date(_prev.sent_at || _prev.created_at || 0).getTime();
                                const _negs = (activities||[]).filter(a =>
                                  a.activity_subtype === "negotiation_round" &&
                                  a.opportunity_id === opp.id &&
                                  (() => { const t = new Date(a.created_at).getTime(); return t >= _winStart && t <= _winEnd + 60000; })()
                                );
                                const _askSet = new Set();
                                _negs.forEach(a => {
                                  const asks = a.structured_data?.asks || {};
                                  if (asks.discount?.enabled) _askSet.add(`${asks.discount.value}% discount`);
                                  if (asks.dld_waiver?.enabled) _askSet.add(`DLD ${asks.dld_waiver.value}`);
                                  if (asks.payment_plan?.enabled && asks.payment_plan.value) _askSet.add(`plan ${asks.payment_plan.value}`);
                                  if (asks.other?.enabled && asks.other.value) _askSet.add(asks.other.value);
                                });
                                _why = Array.from(_askSet);
                              }
                              return (
                                <Fragment key={p.id}>
                                <tr style={{background:isLatest?"#F0F9FF":"#fff",borderBottom:_chips.length?"none":"1px solid #F1F5F9"}}>
                                  <td style={{padding:"9px 10px",fontWeight:700,color:"#0F2540"}}>
                                    V{proposalNumber}
                                    {isLatest && <span style={{fontSize:8,padding:"1px 5px",background:"#ECFDF5",color:"#065F46",borderRadius:3,fontWeight:700,marginLeft:5}}>LATEST</span>}{p.structured_data?.post_reservation && <span title={(p.structured_data||{}).post_reservation_reason||""} style={{fontSize:8,padding:"1px 5px",background:"#FEF2F2",color:"#B91C1C",borderRadius:3,fontWeight:700,marginLeft:4}}>{"\u26a0 post-res"}</span>}
                                  </td>
                                  <td style={{padding:"9px 10px",color:"#64748B"}}>{p.sent_at ? new Date(p.sent_at).toLocaleDateString("en-AE",{day:"numeric",month:"short"}) : "—"}</td>
                                  <td style={{padding:"9px 10px",color:discountPct>0?"#A06810":"#94A3B8",fontWeight:600}}>{discountPct>0 ? `-${discountPct}%` : "0%"}</td>
                                  <td style={{padding:"9px 10px",fontWeight:700,color:"#1A5FA8"}}>{netPrice>0 ? `AED ${Number(netPrice).toLocaleString()}` : "—"}</td>
                                  <td style={{padding:"9px 10px",color:"#475569"}}>{dPlan}</td>
                                  <td style={{padding:"9px 10px",color:"#475569"}}>{dldShort}</td>
                                  <td style={{padding:"9px 10px"}}>
                                    <span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:sm2.bg,color:sm2.c,fontWeight:700}}>{sm2.label}</span>
                                  </td>
                                  <td style={{padding:"9px 10px",textAlign:"right",display:"flex",gap:6,justifyContent:"flex-end"}}>
                                    {p.pdf_url && (
                                      <a href={p.pdf_url} download target="_blank" rel="noopener noreferrer"
                                        title="Download proposal PDF"
                                        style={{padding:"3px 9px",borderRadius:5,border:"none",background:"#059669",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer",textDecoration:"none",display:"inline-block"}}>
                                        📥 PDF
                                      </a>
                                    )}
                                    {isLatest && canEdit && !["Closed Won","Closed Lost"].includes(opp.stage) && (
                                      <button onClick={()=>requestProposalDialog()} title="Edit latest as revision (saves as new version)"
                                        style={{padding:"3px 9px",borderRadius:5,border:"none",background:"#1D4ED8",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                                        ✏️ Edit
                                      </button>
                                    )}
                                  </td>
                                </tr>
                                {_chips.length>0 && (
                                  <tr style={{background:isLatest?"#F0F9FF":"#fff",borderBottom:"1px solid #F1F5F9"}}>
                                    <td></td>
                                    <td colSpan={7} style={{padding:"0 10px 8px",fontSize:10}}>
                                      <span style={{color:"#94A3B8",fontWeight:600,marginRight:6}}>↳ changed from V{proposalNumber-1}:</span>
                                      {_chips.map((c,i)=>(<span key={i} style={{display:"inline-block",background:"#F1F5F9",borderRadius:6,padding:"1px 7px",marginRight:5,marginBottom:2,color:"#475569"}}>{c}</span>))}
                                      {_why.length>0 && (
                                        <div style={{marginTop:3,color:"#94A3B8"}}>
                                          <span style={{fontWeight:600,marginRight:6}}>↳ because buyer asked:</span>
                                          {_why.map((w,i)=>(<span key={i} style={{display:"inline-block",background:"#FEF3C7",color:"#7A4F01",borderRadius:6,padding:"1px 7px",marginRight:5,marginBottom:2}}>{w}</span>))}
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Buyer Outflow + Broker Commission - LATEST proposal */}
                        {(() => {
                          const latest = proposals[0];
                          if (!latest) return null;
                          const sd = latest.structured_data || {};
                          const proposalUnits = (sd.proposal_units && sd.proposal_units.length>0) ? sd.proposal_units : [];
                          const firstUnit = proposalUnits[0] || {};
                          const netPrice = Number(sd.total_value || firstUnit.discounted_price || 0);
                          const dldPct = 4;
                          const dldFee = Math.round(netPrice * dldPct/100);
                          const dldPayer = sd.dld_handling;
                          const buyerDldShare = dldPayer === "buyer_pays" ? dldFee : dldPayer === "developer_pays" ? 0 : dldFee/2;
                          const oqoodFee = 4020;
                          const bookingFee = Math.round(netPrice * 0.10);
                          const linkedUnit2 = (units||[]).find(u => u.id === opp.unit_id);
                          const sqft = linkedUnit2?.size_sqft || 0;
                          const scPerSqft = linkedUnit2?.service_charge_per_sqft || 0;
                          const annualMaintenance = Math.round(sqft * scPerSqft);
                          const oneTimeTotal = netPrice + buyerDldShare + oqoodFee;
                          const commissionPct = Number(opp.commission_pct || 0);
                          const commission = Math.round(netPrice * commissionPct/100);
                          return (
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                              <div style={{padding:"14px 16px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:10}}>
                                <div style={{fontSize:11,fontWeight:700,color:"#0C4A6E",textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>
                                  💰 Buyer Outflow (Latest V{proposals.length})
                                </div>
                                <div style={{fontSize:10,color:"#0369A1",marginBottom:6,fontWeight:600,textTransform:"uppercase",letterSpacing:".4px"}}>One-time (at SPA / handover)</div>
                                <div style={{fontSize:12,lineHeight:1.8,color:"#0F2540"}}>
                                  <div style={{display:"flex",justifyContent:"space-between"}}><span>Net Price:</span><strong>AED {Number(netPrice).toLocaleString()}</strong></div>
                                  <div style={{display:"flex",justifyContent:"space-between",color:"#475569",fontSize:11}}><span>· Booking 10% (within net):</span><span>AED {Number(bookingFee).toLocaleString()}</span></div>
                                  <div style={{display:"flex",justifyContent:"space-between"}}><span>DLD Fee 4% ({dldPayer==="buyer_pays"?"buyer":dldPayer==="developer_pays"?"developer":"shared"}):</span><strong>AED {Number(buyerDldShare).toLocaleString()}</strong></div>
                                  <div style={{display:"flex",justifyContent:"space-between"}}><span>Oqood Fee:</span><strong>AED {Number(oqoodFee).toLocaleString()}</strong></div>
                                  <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #BAE6FD",paddingTop:6,marginTop:6,fontWeight:700,color:"#0C4A6E"}}><span>Total one-time:</span><span>AED {Number(oneTimeTotal).toLocaleString()}</span></div>
                                </div>
                                {annualMaintenance > 0 && (
                                  <>
                                    <div style={{fontSize:10,color:"#0369A1",margin:"12px 0 6px 0",fontWeight:600,textTransform:"uppercase",letterSpacing:".4px"}}>Recurring (annual, post-handover)</div>
                                    <div style={{fontSize:12,lineHeight:1.8,color:"#0F2540"}}>
                                      <div style={{display:"flex",justifyContent:"space-between"}}>
                                        <span>Maintenance ({sqft} sqft × AED {scPerSqft}/sqft):</span>
                                        <strong>AED {Number(annualMaintenance).toLocaleString()}/yr</strong>
                                      </div>
                                    </div>
                                  </>
                                )}
                                {annualMaintenance === 0 && (
                                  <div style={{marginTop:10,padding:"7px 10px",background:"#FEF9C3",borderRadius:6,fontSize:10,color:"#854D0E"}}>
                                    ⚠ Unit's service_charge_per_sqft not set. Annual maintenance can't be calculated.
                                  </div>
                                )}
                              </div>

                              {canSeeCommission && (
                              <div style={{padding:"14px 16px",background:"#FAFBFE",border:"1px solid #D1D9E6",borderRadius:10}}>
                                <div style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>
                                  💼 Broker Commission (Revenue)
                                </div>
                                <div style={{fontSize:10,color:"#64748B",marginBottom:8,lineHeight:1.5}}>
                                  This is your earnings on the deal. Paid by developer to brokerage, not by buyer.
                                </div>
                                {commission > 0 ? (
                                  <div style={{fontSize:12,lineHeight:1.8,color:"#0F2540"}}>
                                    <div style={{display:"flex",justifyContent:"space-between"}}><span>Commission Rate:</span><strong>{commissionPct.toFixed(2)}%</strong></div>
                                    <div style={{display:"flex",justifyContent:"space-between"}}><span>Based on Net Price:</span><span>AED {Number(netPrice).toLocaleString()}</span></div>
                                    <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #E2E8F0",paddingTop:6,marginTop:6,fontWeight:700,fontSize:14,color:"#1A7F5A"}}>
                                      <span>Your Commission:</span><span>AED {Number(commission).toLocaleString()}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{padding:"10px 12px",background:"#FEF9C3",borderRadius:6,fontSize:11,color:"#854D0E"}}>
                                    ⚠ commission_pct not set on this opportunity.
                                  </div>
                                )}
                                <div style={{marginTop:12,padding:"7px 10px",background:"#fff",borderRadius:6,fontSize:10,color:"#64748B",borderLeft:"3px solid #1D4ED8"}}>
                                  📋 Note: Buyer agency services + property management tracked separately (Phase 2 module).
                                </div>
                              </div>
                              )}
                            </div>
                          );
                        })()}

                        <div style={{marginTop:14,padding:"9px 12px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:7,fontSize:11,color:"#0C4A6E"}}>
                          💡 <strong>Tip:</strong> Click ✏️ Edit on the latest proposal to send a revised version. Older versions are kept as audit history (superseded).
                        </div>
                      </>
                    )}
                  </div>
                ) : dashboardTab === "negotiations" ? (
                  /* 20 May 2026 Phase 2c: NEGOTIATIONS PANEL - Excel table + proposal reference */
                  (() => {
                    // Compute negotiation rounds locally (rounds variable is local to old section's IIFE)
                    const negotiationRounds = activities.filter(a =>
                      (a.activity_subtype === "stage_advance" && a.to_stage === "Negotiation")
                      || a.activity_subtype === "negotiation_round"
                      || a.activity_subtype === "handover_meeting"
                    ).slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
                    const actorMetaLocal = {
                      buyer:     {label:"BUYER",     icon:"🟦", c:"#1A5FA8", bg:"#E6EFF8"},
                      developer: {label:"DEVELOPER", icon:"🟩", c:"#1A7F5A", bg:"#E6F4EE"},
                      broker:    {label:"BROKER",    icon:"🟧", c:"#A06810", bg:"#FDF3DC"},
                    };
                    const statusColorsLocal = {"Open":{c:"#1A5FA8",bg:"#E6EFF8"},"Accepted":{c:"#1A7F5A",bg:"#E6F4EE"},"Rejected":{c:"#C53030",bg:"#FEE2E2"},"Counter-pending":{c:"#D97706",bg:"#FEF3C7"}};
                    // Latest proposal for reference line
                    const latestProposal = proposals[0];
                    const lpSd = latestProposal?.structured_data || {};
                    const lpUnits = (lpSd.proposal_units && lpSd.proposal_units.length>0) ? lpSd.proposal_units : [];
                    const lpFirstUnit = lpUnits[0] || {};
                    const lpDiscount = Number(lpFirstUnit.discount_pct || lpSd.discount_pct || 0);
                    const lpNetPrice = Number(lpSd.total_value || lpFirstUnit.discounted_price || 0);
                    const lpPlan = latestProposal?.payment_plan || lpSd.payment_plan || "—";
                    const lpDldLabel = DLD_OPTIONS.find(o=>o.value===lpSd.dld_handling)?.label || "—";
                    return (
                      <div style={{padding:"4px 2px"}}>
                        {/* Header with actions */}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:10,borderBottom:"2px solid #F1F5F9"}}>
                          <div style={{fontSize:16,fontWeight:700,color:"#0F2540",display:"flex",alignItems:"center",gap:8}}>
                            🤝 Negotiation Rounds
                            <span style={{fontSize:10,padding:"2px 7px",borderRadius:8,background:"#FEE2E2",color:"#B83232",fontWeight:700}}>{negotiationRounds.length} round{negotiationRounds.length===1?"":"s"}</span>
                          </div>
                          {canEdit && (
                            <div style={{display:"flex",gap:6}}>
                              <button onClick={()=>setShowLogRound(true)} style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #B83232",background:"#fff",color:"#B83232",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                + Log Round
                              </button>
                              <button onClick={()=>setShowHandover(true)} style={{padding:"6px 12px",borderRadius:7,border:"none",background:"#7C3AED",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                📅 Schedule Handover
                              </button>
                            </div>
                          )}
                        </div>
                        {/* Reference line - latest proposal */}
                        {latestProposal && (
                          <div style={{padding:"10px 14px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:8,marginBottom:14,fontSize:12,color:"#0C4A6E"}}>
                            📋 <strong>Reference V{proposals.length} (latest proposal):</strong>{" "}
                            {lpDiscount > 0 && <><strong style={{color:"#A06810"}}>-{lpDiscount}%</strong> · </>}
                            <strong>{lpPlan}</strong> · {lpDldLabel} ·{" "}
                            <strong style={{color:"#1A5FA8"}}>AED {Number(lpNetPrice).toLocaleString()}</strong>
                          </div>
                        )}
                        {negotiationRounds.length === 0 ? (
                          <div style={{textAlign:"center",padding:"40px 20px",color:"#94A3B8",fontSize:12,border:"1px dashed #E2E8F0",borderRadius:10}}>
                            No rounds yet. Click "+ Log Round" when the buyer or developer responds.
                          </div>
                        ) : (
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginBottom:14}}>
                            <thead>
                              <tr style={{background:"#F8FAFC",borderBottom:"2px solid #E2E8F0"}}>
                                <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".4px",color:"#475569",fontWeight:700}}>R#</th>
                                <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".4px",color:"#475569",fontWeight:700}}>Date</th>
                                <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".4px",color:"#475569",fontWeight:700}}>Party</th>
                                <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".4px",color:"#475569",fontWeight:700}}>Topic / Asks</th>
                                <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".4px",color:"#475569",fontWeight:700}}>Status</th>
                                <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".4px",color:"#475569",fontWeight:700}}>Notes</th>
                                <th style={{padding:"7px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:".4px",color:"#475569",fontWeight:700}}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {negotiationRounds.map((r, idx) => {
                                const sd = r.structured_data || {};
                                const isHandover = r.activity_subtype === "handover_meeting";
                                const isOpening = r.activity_subtype === "stage_advance";
                                const actorKey = sd.actor || (isOpening ? "buyer" : "broker");
                                const am = actorMetaLocal[actorKey] || actorMetaLocal.broker;
                                const dateLabel = sd.round_at ? new Date(sd.round_at).toLocaleDateString("en-AE",{day:"numeric",month:"short"}) : new Date(r.created_at).toLocaleDateString("en-AE",{day:"numeric",month:"short"});
                                const status = sd.status || (isOpening ? "Open" : null);
                                const sc = status ? statusColorsLocal[status] || {} : {};
                                const isLatest = idx === 0;
                                const roundNumber = negotiationRounds.length - idx;
                                // Asks summary
                                const enabledAsks = sd.asks ? Object.keys(sd.asks).filter(k=>sd.asks[k]?.enabled) : [];
                                const asksSummary = isHandover ? "📅 Handover Meeting" :
                                                    enabledAsks.length > 0 ? enabledAsks.map(k => {
                                                      const def = ASKS_GRID_OPTIONS.find(o=>o.key===k);
                                                      if(!def) return null;
                                                      const val = sd.asks[k]?.value;
                                                      return def.label + (val ? `: ${val}` : "");
                                                    }).filter(Boolean).join(", ") : "—";
                                const notesShort = (sd.broker_notes || sd.notes || "").substring(0, 60);
                                const _isOpen = (status === "Open" || status === "Counter-pending" || (isOpening && !status));
                                const _roundTs = sd.round_at ? new Date(sd.round_at).getTime() : new Date(r.created_at).getTime();
                                const _ageDays = Math.floor((Date.now() - _roundTs) / 86400000);
                                const _nag = _isOpen && _ageDays >= 3
                                  ? (_ageDays >= 7
                                      ? {txt:`⚠️ open ${_ageDays}d — chase`, bg:"#FEE2E2", c:"#B83232"}
                                      : {txt:`open ${_ageDays}d`, bg:"#FEF3C7", c:"#7A4F01"})
                                  : null;
                                return (
                                  <tr key={r.id} style={{background:isLatest?"#FAFBFE":"#fff",borderBottom:"1px solid #F1F5F9"}}>
                                    <td style={{padding:"9px 10px",fontWeight:700,color:"#0F2540"}}>
                                      R{roundNumber}
                                      {isLatest && <span style={{fontSize:8,padding:"1px 5px",background:"#ECFDF5",color:"#065F46",borderRadius:3,fontWeight:700,marginLeft:5}}>LATEST</span>}{p.structured_data?.post_reservation && <span title={(p.structured_data||{}).post_reservation_reason||""} style={{fontSize:8,padding:"1px 5px",background:"#FEF2F2",color:"#B91C1C",borderRadius:3,fontWeight:700,marginLeft:4}}>{"\u26a0 post-res"}</span>}
                                    </td>
                                    <td style={{padding:"9px 10px",color:"#64748B"}}>{dateLabel}</td>
                                    <td style={{padding:"9px 10px"}}>
                                      <span style={{fontSize:10,padding:"2px 6px",borderRadius:8,background:am.bg,color:am.c,fontWeight:700}}>{am.icon} {am.label}</span>
                                    </td>
                                    <td style={{padding:"9px 10px",color:"#0F2540",fontSize:11}}>{asksSummary}</td>
                                    <td style={{padding:"9px 10px"}}>
                                      {status && <span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:sc.bg,color:sc.c,fontWeight:700}}>{status.toUpperCase()}</span>}
                                      {_nag && <div style={{marginTop:3}}><span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:_nag.bg,color:_nag.c,fontWeight:700,whiteSpace:"nowrap"}}>{_nag.txt}</span></div>}
                                    </td>
                                    <td style={{padding:"9px 10px",color:"#64748B",fontSize:11,fontStyle:"italic",maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={sd.broker_notes||sd.notes||""}>
                                      {notesShort}{notesShort.length === 60 ? "..." : ""}
                                    </td>
                                    <td style={{padding:"9px 10px",textAlign:"right"}}>
                                      {isLatest && canEdit && !isHandover && (
                                        <button onClick={()=>setShowLogRound(true)} title="Log next round" style={{padding:"3px 9px",borderRadius:5,border:"none",background:"#1D4ED8",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                                          + Round
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                        <div style={{padding:"9px 12px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:7,fontSize:11,color:"#0C4A6E"}}>
                          💡 <strong>Tip:</strong> Log each round when buyer/developer responds. Reference line above shows latest proposal terms for context.
                        </div>
                      </div>
                    );
                  })()
                ) : dashboardTab === "next-steps" ? (
                  /* 20 May 2026 Phase 2d: NEXT STEPS PANEL - reminders with action buttons */
                  (() => {
                    const nowNS = new Date();
                    const reminderIconsNS = {Call:"📞",WhatsApp:"💬",Email:"✉️",Meeting:"🤝","Site Visit":"🏠","Send proposal":"📄","Send brochure":"📋","Note to self":"📝",Other:"📌"};
                    const sortedNS = [...reminders].sort((a,b)=>new Date(a.trigger_at)-new Date(b.trigger_at));
                    const fmtDueNS = (iso)=>{
                      const d = new Date(iso);
                      const diffMs = d - nowNS;
                      const diffDays = Math.floor(diffMs / 86400000);
                      const dateStr = d.toLocaleDateString("en-AE",{day:"numeric",month:"short"});
                      if(diffMs < 0){
                        const overdueDays = Math.abs(Math.ceil(diffMs / 86400000));
                        return {label: overdueDays===0?"due today":overdueDays===1?"1 day overdue":`${overdueDays} days overdue`, color:"#C53030", bg:"#FEE2E2", date:dateStr};
                      }
                      if(diffDays===0) return {label:"due today", color:"#A06810", bg:"#FDF3DC", date:dateStr};
                      if(diffDays===1) return {label:"due tomorrow", color:"#1A5FA8", bg:"#E6EFF8", date:dateStr};
                      if(diffDays<=7) return {label:`in ${diffDays} days`, color:"#1A5FA8", bg:"#E6EFF8", date:dateStr};
                      return {label:dateStr, color:"#64748B", bg:"#F1F5F9", date:dateStr};
                    };
                    const markDoneNS = (rem)=>setRemAction({mode:"done", reminder:rem, note:"", date:""});
                    const snooze1DayNS = async(rem)=>{
                      const newDate = new Date(rem.trigger_at);
                      newDate.setDate(newDate.getDate()+1);
                      const ok = await updateReminderStatus(rem.id,"pending",{trigger_at:newDate.toISOString()});
                      if(ok) showToast("Snoozed 1 day","success");
                    };
                    const rescheduleNS = (rem)=>{
                      const currentDate = new Date(rem.trigger_at).toISOString().split("T")[0];
                      setRemAction({mode:"reschedule", reminder:rem, note:"", date:currentDate});
                    };
                    const cancelNS = (rem)=>setRemAction({mode:"cancel", reminder:rem, note:"", date:""});
                    // Categorize: overdue, today, future
                    const overdueCount = sortedNS.filter(r => new Date(r.trigger_at) < nowNS).length;
                    const todayCount = sortedNS.filter(r => {
                      const d = new Date(r.trigger_at);
                      return d >= nowNS && d.toDateString() === nowNS.toDateString();
                    }).length;
                    const futureCount = sortedNS.length - overdueCount - todayCount;
                    return (
                      <div style={{padding:"4px 2px"}}>
                        {/* Header with summary */}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:10,borderBottom:"2px solid #F1F5F9"}}>
                          <div style={{fontSize:16,fontWeight:700,color:"#0F2540",display:"flex",alignItems:"center",gap:8}}>
                            ⏰ Next Steps
                            <span style={{fontSize:10,padding:"2px 7px",borderRadius:8,background:"#FEF3C7",color:"#92400E",fontWeight:700}}>{sortedNS.length} pending</span>
                          </div>
                          <div style={{display:"flex",gap:8,fontSize:11,color:"#64748B"}}>
                            {overdueCount > 0 && <span><strong style={{color:"#C53030"}}>{overdueCount}</strong> overdue</span>}
                            {todayCount > 0 && <span><strong style={{color:"#A06810"}}>{todayCount}</strong> today</span>}
                            {futureCount > 0 && <span><strong style={{color:"#1A5FA8"}}>{futureCount}</strong> upcoming</span>}
                          </div>
                        </div>
                        {sortedNS.length === 0 ? (
                          <div style={{textAlign:"center",padding:"40px 20px",color:"#94A3B8",fontSize:12,border:"1px dashed #E2E8F0",borderRadius:10}}>
                            No pending reminders. You're all caught up! 🎉
                          </div>
                        ) : (
                          <div style={{display:"flex",flexDirection:"column",gap:8}}>
                            {sortedNS.map(rem=>{
                              const due = fmtDueNS(rem.trigger_at);
                              const actionFromTitle = (rem.title||"").split("—")[0].trim();
                              const icon = reminderIconsNS[actionFromTitle] || "📌";
                              const isAuto = rem.reason && rem.reason.startsWith("auto_");
                              return (
                                <div key={rem.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#F8FAFC",borderRadius:8,border:`1px solid ${due.color==="#C53030"?"#FECACA":"#E2E8F0"}`,flexWrap:"wrap"}}>
                                  <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
                                  <div style={{flex:1,minWidth:200}}>
                                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                                      <span style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{rem.title}</span>
                                      <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:due.bg,color:due.color}}>{due.label}</span>
                                      {isAuto && <span style={{fontSize:9,fontWeight:600,padding:"1px 6px",borderRadius:8,background:"#F1F5F9",color:"#64748B"}}>auto</span>}
                                      <span style={{fontSize:10,color:"#94A3B8"}}>{due.date}</span>
                                    </div>
                                    {rem.body && <div style={{fontSize:11,color:"#64748B",marginTop:3,fontStyle:"italic"}}>{rem.body}</div>}
                                  </div>
                                  {canEdit && (
                                    <div style={{display:"flex",gap:5,flexShrink:0,flexWrap:"wrap"}}>
                                      <button onClick={()=>markDoneNS(rem)} style={{padding:"5px 11px",borderRadius:6,border:"1px solid #1A7F5A",background:"#fff",color:"#1A7F5A",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                                        ✓ Done
                                      </button>
                                      <button onClick={()=>snooze1DayNS(rem)} title="Snooze 1 day" style={{padding:"5px 11px",borderRadius:6,border:"1px solid #D1D9E6",background:"#fff",color:"#64748B",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                                        💤 +1d
                                      </button>
                                      <button onClick={()=>rescheduleNS(rem)} style={{padding:"5px 11px",borderRadius:6,border:"1px solid #D1D9E6",background:"#fff",color:"#64748B",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                                        📅
                                      </button>
                                      <button onClick={()=>cancelNS(rem)} style={{padding:"5px 11px",borderRadius:6,border:"1px solid #FECACA",background:"#fff",color:"#C53030",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                                        ✕
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div style={{marginTop:14,padding:"9px 12px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:7,fontSize:11,color:"#0C4A6E"}}>
                          💡 <strong>Tip:</strong> Reminders are auto-created when you send proposals or advance stages. Mark done, snooze, or reschedule to keep your follow-ups on track.
                        </div>
                      </div>
                    );
                  })()
                ) : dashboardTab === "financials" ? (
                  /* 20 May 2026 Phase 2e: FINANCIALS PANEL - buyer details + commission (SEPARATE) */
                  (() => {
                    const unitAskingPriceFin = (salePricing||[]).find(s => s.unit_id === opp.unit_id)?.asking_price;
                    const discValueFin = opp.current_discount_value || opp.discount_pct;
                    const discTypeFin = opp.current_discount_type || (opp.discount_pct ? "percent" : null);
                    const discSourceFin = opp.current_discount_source || opp.discount_source;
                    const dldLabelFin = opp.current_dld_payer === "buyer" ? "Buyer pays" :
                                       opp.current_dld_payer === "developer" ? "Developer absorbs" :
                                       opp.current_dld_payer === "negotiated" ? "Negotiated" :
                                       opp.current_dld_payer === "split" ? `Split ${opp.current_dld_split_pct||50}/${100-(opp.current_dld_split_pct||50)}` :
                                       null;
                    const finalPrice = Number(opp.current_agreed_price || 0);
                    const planPreset = opp.current_payment_plan_preset;
                    // Initial advance calculation (20% standard for 20/80, etc.)
                    let initialPct = 0;
                    if (planPreset === "10/90") initialPct = 10;
                    else if (planPreset === "20/80") initialPct = 20;
                    else if (planPreset === "40/60") initialPct = 40;
                    else if (planPreset === "50/50 PHP") initialPct = 50;
                    const initialAdvance = Math.round(finalPrice * initialPct / 100);
                    const commissionPctFin = Number(opp.commission_pct || 0);
                    const commissionAmt = Math.round(finalPrice * commissionPctFin / 100);
                    // Stage 6 — resolution via shared helper (same math the invoice freeze uses)
                    const { _splitMode, _splitVal, _splitTier, _belowStandard, agentBase, _bonusMode, _bonusVal, appreciationBonus, _bonusConfigured, agentCommission, companyNet, _splitConfigured } = resolveCommission(opp, agent, companyStd, commissionAmt);
                    return (
                      <div style={{padding:"4px 2px"}}>
                        {/* Header */}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:10,borderBottom:"2px solid #F1F5F9"}}>
                          <div style={{fontSize:16,fontWeight:700,color:"#0F2540",display:"flex",alignItems:"center",gap:8}}>
                            💰 Financials
                          </div>
                          <span style={{fontSize:10,color:"#94A3B8"}}>{opp.block_deal_id ? "Sourced from block terms (locked distribution) + unit pricing" : "Sourced from latest proposal + unit pricing"}</span>
                        </div>
                        {/* Two-column layout: Buyer details + Broker commission */}
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                          {/* LEFT: Buyer-side details */}
                          <div style={{padding:"14px 16px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:10}}>
                            <div style={{fontSize:11,fontWeight:700,color:"#0C4A6E",textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>
                              📋 Deal Financials (Buyer side)
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                              {opp.budget && (
                                <div style={{padding:"8px 10px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0"}}>
                                  <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Buyer Budget</div>
                                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>AED {Number(opp.budget).toLocaleString()}</div>
                                </div>
                              )}
                              {!!opp.reservation_amount && (
                                <div style={{padding:"8px 10px",background:"#F0F9FF",borderRadius:7,border:"1px solid #BAE6FD"}}>
                                  <div style={{fontSize:9,color:"#0369A1",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>{"Reservation Paid"}{opp.reservation_date ? " \u00b7 " + new Date(opp.reservation_date).toLocaleDateString("en-AE",{day:"numeric",month:"short"}) : ""}</div>
                                  <div style={{fontSize:13,fontWeight:700,color:"#0369A1"}}>AED {Number(opp.reservation_amount).toLocaleString()}</div>
                                  <div style={{fontSize:9,color:"#64748B",marginTop:2}}>credits toward initial advance</div>
                                </div>
                              )}
                              {unitAskingPriceFin && (
                                <div style={{padding:"8px 10px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0"}}>
                                  <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Asking Price</div>
                                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>AED {Number(unitAskingPriceFin).toLocaleString()}</div>
                                </div>
                              )}
                              {finalPrice > 0 && (
                                <div style={{padding:"8px 10px",background:"#EFF6FF",borderRadius:7,border:"1px solid #BFDBFE",gridColumn:"span 2"}}>
                                  <div style={{fontSize:9,color:"#1D4ED8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Final Agreed Price</div>
                                  <div style={{fontSize:16,fontWeight:700,color:"#1D4ED8"}}>AED {Number(finalPrice).toLocaleString()}</div>
                                  {!!discValueFin && !!discTypeFin && (
                                    <div style={{fontSize:10,color:"#64748B",marginTop:3}}>
                                      Discount: <strong style={{color:"#A06810"}}>{discTypeFin === "percent" ? `${discValueFin}%` : `AED ${Number(discValueFin).toLocaleString()}`}</strong>
                                      {discSourceFin && <span style={{color:"#94A3B8"}}> (from {discSourceFin})</span>}
                                    </div>
                                  )}
                                </div>
                              )}
                              {dldLabelFin && (
                                <div style={{padding:"8px 10px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0"}}>
                                  <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>DLD Arrangement</div>
                                  <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{dldLabelFin}</div>
                                </div>
                              )}
                              {planPreset && (
                                <div style={{padding:"8px 10px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0"}}>
                                  <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Payment Plan</div>
                                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{planPreset}</div>
                                </div>
                              )}
                              {initialAdvance > 0 && (
                                <div style={{padding:"8px 10px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0",gridColumn:"span 2"}}>
                                  <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Initial Advance ({initialPct}%)</div>
                                  <div style={{fontSize:14,fontWeight:700,color:"#0F2540"}}>AED {Number(initialAdvance).toLocaleString()}</div>
                                  <div style={{fontSize:10,color:"#64748B",marginTop:2}}>Due at SPA signing</div>
                                  {["Reserved","SPA Requirements","SPA Signed","Closed Won"].includes(opp.stage) && finalPrice > 0 && (() => {
                                const dldAmt = (opp.current_dld_payer === "developer") ? 0 : Math.round(finalPrice * 0.04 * ((opp.current_dld_payer === "split") ? ((opp.current_dld_split_pct || 50) / 100) : 1));
                                const bill = (initialAdvance || 0) + dldAmt + 5250 + 4020;
                                const credits = (Number(opp.reservation_amount) || 0) + (Number(opp.booking_amount) || 0);
                                return (
                                  <div style={{padding:"10px 12px",background:"#FFFBEB",borderRadius:7,border:"1.5px solid #FCD34D",gridColumn:"span 2"}}>
                                    <div style={{fontSize:9,color:"#92400E",textTransform:"uppercase",letterSpacing:".4px",marginBottom:4}}>{"\ud83e\uddfe Buyers bill to SPA (est.)"}</div>
                                    <div style={{fontSize:10,color:"#78716C"}}>First instalment {initialAdvance ? "AED " + Number(initialAdvance).toLocaleString() : "\u2014"} + DLD {dldAmt ? "AED " + dldAmt.toLocaleString() : "\u2014"} + SPA fee AED 5,250 + Oqood AED 4,020</div>
                                    <div style={{fontSize:14,fontWeight:800,color:"#92400E",marginTop:3}}>AED {bill.toLocaleString()}{credits > 0 ? <span style={{fontSize:10,fontWeight:600,color:"#16A34A"}}>{" \u00b7 AED " + credits.toLocaleString() + " already credited"}</span> : null}</div>
                                  </div>
                                );
                              })()}
                            </div>
                              )}
                              
                            </div>
                          </div>
                          {/* RIGHT: Broker commission (SEPARATE per architectural law) */}
                          {canSeeCommission && (
                          <div style={{padding:"14px 16px",background:"#FAFBFE",border:"1px solid #D1D9E6",borderRadius:10}}>
                            <div style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>
                              💼 Broker Commission (Revenue)
                            </div>
                            <div style={{fontSize:10,color:"#64748B",marginBottom:10,lineHeight:1.5}}>
                              Your earnings on this deal. Paid by developer to brokerage, separate from buyer's outflow.
                            </div>
                            {commissionAmt > 0 ? (
                              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                                <div style={{padding:"8px 10px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0"}}>
                                  <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Commission Rate</div>
                                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{commissionPctFin.toFixed(2)}%</div>
                                </div>
                                <div style={{padding:"8px 10px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0"}}>
                                  <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Based on Final Price</div>
                                  <div style={{fontSize:12,fontWeight:600,color:"#475569"}}>AED {Number(finalPrice).toLocaleString()}</div>
                                </div>
                                {canSeeCompanyMargin && (
                                <div style={{padding:"10px 12px",background:"#ECFDF5",borderRadius:7,border:"1px solid #A8D5BE"}}>
                                  <div style={{fontSize:9,color:"#065F46",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Company Commission (Total)</div>
                                  <div style={{fontSize:16,fontWeight:700,color:"#1A7F5A"}}>AED {Number(commissionAmt).toLocaleString()}</div>
                                </div>
                                )}
                                {canSeeCompanyMargin && (
                                <button onClick={openBonusDialog} disabled={!canSeeCommission} style={{padding:"8px 10px",fontSize:11,fontWeight:600,borderRadius:7,border:"1px dashed #93C5FD",background:"#fff",color:"#1D4ED8",cursor:"pointer"}}>
                                  {_bonusConfigured ? "Edit performance bonus" : "+ Add performance bonus (this deal)"}
                                </button>
                                )}
                                {showBonusDialog && (
                                  <Modal title="Performance bonus - this deal" width={460} onClose={()=>{ if(!bonusSaving) setShowBonusDialog(false); }}>
                                    <div style={{fontSize:12,color:"#64748B",marginBottom:14,lineHeight:1.5}}>
                                      A one-off bonus for <strong>{agent?.full_name || "the assigned agent"}</strong> on this deal, on top of their base split. Company commission: <strong>AED {Number(commissionAmt).toLocaleString()}</strong>.
                                    </div>
                                    {dealHistory.length > 0 && (
                                      <div style={{marginBottom:16}}>
                                        <div style={{fontSize:11,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".4px",marginBottom:6}}>This deal's commission history</div>
                                        <div style={{border:"1px solid #E6EAF0",borderRadius:8,maxHeight:130,overflowY:"auto"}}>
                                          {dealHistory.map((h,i)=>(
                                            <div key={i} style={{padding:"7px 11px",borderTop:i===0?"none":"1px solid #F1F5F9",fontSize:12}}>
                                              <div style={{color:"#0F2540",fontWeight:600}}>{histLabel(h)}<span style={{float:"right",color:"#94A3B8",fontWeight:500}}>{fmtHistDate(h.created_at)}</span></div>
                                              {h.reason && <div style={{color:"#64748B",marginTop:1,fontStyle:"italic"}}>{h.reason}</div>}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <label style={{display:"block",fontSize:12,fontWeight:600,color:"#0F2540",marginBottom:6}}>Bonus type</label>
                                    <select value={bonusForm.mode} onChange={e=>setBonusForm(f=>({...f,mode:e.target.value}))} style={{width:"100%",fontSize:14,padding:"9px 10px",borderRadius:8,border:"1.5px solid #D1D9E6",marginBottom:14}}>
                                      <option value="fixed">Fixed amount (AED)</option>
                                      <option value="percentage">Percentage of company commission</option>
                                    </select>
                                    <label style={{display:"block",fontSize:12,fontWeight:600,color:"#0F2540",marginBottom:6}}>{bonusForm.mode==="percentage"?"Bonus (%)":"Bonus amount (AED)"}</label>
                                    <input type="number" min="0" step="0.01" value={bonusForm.value} onChange={e=>setBonusForm(f=>({...f,value:e.target.value}))} placeholder={bonusForm.mode==="percentage"?"e.g. 5":"e.g. 10000"} style={{width:"100%",fontSize:14,padding:"9px 10px",borderRadius:8,border:"1.5px solid #D1D9E6",marginBottom:14}}/>
                                    <label style={{display:"block",fontSize:12,fontWeight:600,color:"#0F2540",marginBottom:6}}>Reason <span style={{color:"#B42318"}}>*</span></label>
                                    <textarea value={bonusForm.reason} onChange={e=>setBonusForm(f=>({...f,reason:e.target.value}))} rows={2} placeholder="e.g. Closed above asking, exceptional effort" style={{width:"100%",fontSize:13,padding:"9px 10px",borderRadius:8,border:"1.5px solid #D1D9E6",marginBottom:4,resize:"vertical",fontFamily:"inherit"}}/>
                                    <p style={{fontSize:11,color:"#94A3B8",margin:"0 0 18px"}}>Required - recorded in the commission audit trail.</p>
                                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                                      <div>{_bonusConfigured && (<button onClick={()=>saveBonus({clear:true})} disabled={bonusSaving} style={{padding:"9px 14px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid #FCA5A5",background:"#fff",color:"#B42318",cursor:"pointer"}}>Remove bonus</button>)}</div>
                                      <div style={{display:"flex",gap:10}}>
                                        <button onClick={()=>{ if(!bonusSaving) setShowBonusDialog(false); }} disabled={bonusSaving} style={{padding:"9px 18px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",color:"#475569",cursor:"pointer"}}>Cancel</button>
                                        <button onClick={()=>saveBonus()} disabled={bonusSaving} style={{padding:"9px 20px",fontSize:13,fontWeight:600,borderRadius:8,border:"none",background:bonusSaving?"#CBD5E1":"#0F2540",color:"#fff",cursor:bonusSaving?"default":"pointer"}}>{bonusSaving?"Saving...":"Save bonus"}</button>
                                      </div>
                                    </div>
                                  </Modal>
                                )}
                                {canSeeCompanyMargin && (
                                <button onClick={openOverrideDialog} disabled={!canSeeCommission} style={{padding:"8px 10px",fontSize:11,fontWeight:600,borderRadius:7,border:"1px dashed #C4B5FD",background:"#fff",color:"#6D28D9",cursor:"pointer"}}>
                                  {opp.agent_split_mode ? "Edit deal split override" : "Override split (this deal)"}
                                </button>
                                )}
                                {showOverrideDialog && (() => {
                                  const stdSet = companyStd.mode && companyStd.value != null;
                                  const stdLabel = !stdSet ? "no company standard set" : companyStd.mode === "percentage" ? `${companyStd.value}%` : `AED ${Number(companyStd.value).toLocaleString()}`;
                                  const raw = String(overrideForm.value).trim();
                                  const nv = raw === "" ? null : Number(raw);
                                  const below = stdSet && nv != null && !Number.isNaN(nv) && nv < Number(companyStd.value);
                                  return (
                                  <Modal title="Override split - this deal" width={470} onClose={()=>{ if(!overrideSaving) setShowOverrideDialog(false); }}>
                                    <div style={{fontSize:12,color:"#64748B",marginBottom:14,lineHeight:1.5}}>
                                      A one-off split for <strong>{agent?.full_name || "the assigned agent"}</strong> on <strong>this deal only</strong> - overrides their standing bracket. Company commission: <strong>AED {Number(commissionAmt).toLocaleString()}</strong>.
                                    </div>
                                    <div style={{fontSize:12,fontWeight:600,color:"#6D28D9",background:"#F5F3FF",borderRadius:8,padding:"8px 12px",marginBottom:16}}>Company standard: {stdLabel}</div>
                                    {dealHistory.length > 0 && (
                                      <div style={{marginBottom:16}}>
                                        <div style={{fontSize:11,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".4px",marginBottom:6}}>This deal's commission history</div>
                                        <div style={{border:"1px solid #E6EAF0",borderRadius:8,maxHeight:130,overflowY:"auto"}}>
                                          {dealHistory.map((h,i)=>(
                                            <div key={i} style={{padding:"7px 11px",borderTop:i===0?"none":"1px solid #F1F5F9",fontSize:12}}>
                                              <div style={{color:"#0F2540",fontWeight:600}}>{histLabel(h)}<span style={{float:"right",color:"#94A3B8",fontWeight:500}}>{fmtHistDate(h.created_at)}</span></div>
                                              {h.reason && <div style={{color:"#64748B",marginTop:1,fontStyle:"italic"}}>{h.reason}</div>}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <label style={{display:"block",fontSize:12,fontWeight:600,color:"#0F2540",marginBottom:6}}>{companyStd.mode==="percentage"?"Override rate (%)":"Override amount (AED)"}</label>
                                    <input type="number" min="0" step="0.01" value={overrideForm.value} onChange={e=>{setOverrideForm(f=>({...f,value:e.target.value})); setOverrideConfirm(false);}} placeholder={companyStd.mode==="percentage"?"e.g. 40":"e.g. 40000"} style={{width:"100%",fontSize:14,padding:"9px 10px",borderRadius:8,border:`1.5px solid ${below?"#F59E0B":"#D1D9E6"}`,marginBottom:4}}/>
                                    <div style={{fontSize:11,minHeight:16,marginBottom:12,color:below?"#B45309":"#94A3B8"}}>{below?`⚠ Below the company standard of ${stdLabel} - allowed, but recorded.`:(nv!=null&&stdSet&&nv>=Number(companyStd.value)?"At or above standard.":"")}</div>
                                    <label style={{display:"block",fontSize:12,fontWeight:600,color:"#0F2540",marginBottom:6}}>Reason <span style={{color:"#B42318"}}>*</span></label>
                                    <textarea value={overrideForm.reason} onChange={e=>setOverrideForm(f=>({...f,reason:e.target.value}))} rows={2} placeholder="e.g. Special low-margin deal, agreed with agent" style={{width:"100%",fontSize:13,padding:"9px 10px",borderRadius:8,border:"1.5px solid #D1D9E6",marginBottom:4,resize:"vertical",fontFamily:"inherit"}}/>
                                    <p style={{fontSize:11,color:"#94A3B8",margin:"0 0 18px"}}>Required - recorded in the commission audit trail.</p>
                                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                                      <div>{opp.agent_split_mode && (<button onClick={()=>saveOverride({clear:true})} disabled={overrideSaving} style={{padding:"9px 14px",fontSize:12,fontWeight:600,borderRadius:8,border:"1px solid #FCA5A5",background:"#fff",color:"#B42318",cursor:"pointer"}}>Remove override</button>)}</div>
                                      <div style={{display:"flex",gap:10}}>
                                        <button onClick={()=>{ if(!overrideSaving) setShowOverrideDialog(false); }} disabled={overrideSaving} style={{padding:"9px 18px",fontSize:13,fontWeight:600,borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",color:"#475569",cursor:"pointer"}}>Cancel</button>
                                        {below ? (overrideConfirm ? (
                                          <button onClick={()=>saveOverride({confirm:true})} disabled={overrideSaving} style={{padding:"9px 16px",fontSize:13,fontWeight:700,borderRadius:8,border:"none",background:overrideSaving?"#CBD5E1":"#B42318",color:"#fff",cursor:overrideSaving?"default":"pointer"}}>{overrideSaving?"Saving...":"Confirm \u2014 save below standard"}</button>
                                        ) : (
                                          <button onClick={()=>{ if(!overrideForm.reason.trim()){ showToast?.("A reason is required before you can review (audit trail)","error"); return; } setOverrideConfirm(true); }} disabled={overrideSaving} style={{padding:"9px 16px",fontSize:13,fontWeight:700,borderRadius:8,border:"none",background:"#D97706",color:"#fff",cursor:"pointer"}}>Review \u2014 below standard</button>
                                        )) : (
                                          <button onClick={()=>saveOverride()} disabled={overrideSaving} style={{padding:"9px 20px",fontSize:13,fontWeight:600,borderRadius:8,border:"none",background:overrideSaving?"#CBD5E1":"#0F2540",color:"#fff",cursor:overrideSaving?"default":"pointer"}}>{overrideSaving?"Saving...":"Save override"}</button>
                                        )}
                                      </div>
                                    </div>
                                  </Modal>
                                  );
                                })()}
                                {_splitConfigured && (
                                  <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:2,padding:"10px 12px",background:_belowStandard?"#FFFBEB":"#F8FAFC",borderRadius:7,border:_belowStandard?"1px solid #F59E0B":"1px dashed #CBD5E1"}}>
                                    <div style={{fontSize:9,color:"#64748B",textTransform:"uppercase",letterSpacing:".4px"}}>Split breakdown{_splitTier !== "none" ? ` · from ${_splitTier === "deal" ? "this deal" : _splitTier === "broker" ? "broker bracket" : "company standard"}` : ""}</div>
                                    {canSeeCompanyMargin && _belowStandard && (<div style={{display:"inline-flex",alignItems:"center",gap:5,alignSelf:"flex-start",fontSize:10,fontWeight:700,color:"#92400E",background:"#FDE68A",border:"1px solid #F59E0B",borderRadius:20,padding:"2px 9px"}}>⚠ Below company standard ({companyStd.mode==="percentage"?`${companyStd.value}%`:`AED ${Number(companyStd.value).toLocaleString()}`})</div>)}
                                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#0F2540"}}>
                                      <span>Agent's base{_splitMode === "percentage" ? ` (${_splitVal}%)` : _splitMode === "fixed" ? " (fixed)" : ""}:</span>
                                      <strong>AED {Math.round(agentBase).toLocaleString()}</strong>
                                    </div>
                                    {_bonusConfigured && (
                                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#0369A1"}}>
                                        <span>Performance Bonus{_bonusMode === "percentage" ? ` (+${_bonusVal}%)` : " (+fixed)"}:</span>
                                        <strong style={{color:"#0369A1"}}>AED {Math.round(appreciationBonus).toLocaleString()}</strong>
                                      </div>
                                    )}
                                    {_bonusConfigured && (
                                      <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#0F2540",borderTop:"1px solid #E2E8F0",paddingTop:6,fontWeight:700}}>
                                        <span>Agent total:</span>
                                        <strong>AED {Math.round(agentCommission).toLocaleString()}</strong>
                                      </div>
                                    )}
                                    {!canSeeCompanyMargin && _bonusConfigured && opp.appreciation_bonus_reason && (
                                      <div style={{marginTop:2,padding:"7px 10px",background:"#EFF6FF",borderRadius:6,border:"1px solid #BFDBFE",fontSize:11,color:"#1E40AF"}}>
                                        Bonus awarded: <span style={{fontStyle:"italic"}}>{opp.appreciation_bonus_reason}</span>
                                      </div>
                                    )}
                                    {canSeeCompanyMargin && (
                                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#0F2540",borderTop:"1px solid #E2E8F0",paddingTop:6}}>
                                      <span>Company keeps:</span>
                                      <strong style={{color:"#1A7F5A"}}>AED {Math.round(companyNet).toLocaleString()}</strong>
                                    </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{padding:"10px 12px",background:"#FEF9C3",borderRadius:7,fontSize:11,color:"#854D0E"}}>
                                ⚠ commission_pct not set on this opportunity.
                              </div>
                            )}
                            <div style={{marginTop:12,padding:"8px 10px",background:"#fff",borderRadius:6,fontSize:10,color:"#64748B",borderLeft:"3px solid #1D4ED8"}}>
                              📋 Buyer agency services + property management tracked separately (Phase 2 module).
                            </div>
                          </div>
                          )}
                        </div>
                        {/* Day 18 — In-Opp Commission Invoice Visibility */}
                        {(() => {
                          const ci = commissionInvoice;
                          const INV_META = {
                            draft:          { bg:"#F3F4F6", fg:"#4B5563", label:"DRAFT" },
                            issued:         { bg:"#DBEAFE", fg:"#1E40AF", label:"ISSUED" },
                            partially_paid: { bg:"#FEF3C7", fg:"#92400E", label:"PARTIALLY PAID" },
                            paid:           { bg:"#DCFCE7", fg:"#166534", label:"PAID" },
                            disputed:       { bg:"#FEE2E2", fg:"#991B1B", label:"DISPUTED" },
                            written_off:    { bg:"#F3F4F6", fg:"#6B7280", label:"WRITTEN OFF" },
                          };
                          const fmtAED = (n) => `AED ${Number(n||0).toLocaleString()}`;
                          return (
                            <div style={{marginTop:14,padding:"14px 16px",background:"#FFFDF7",border:"1px solid #E8DCC0",borderRadius:10}}>
                              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                                <div style={{fontSize:11,fontWeight:700,color:"#7A5C16",textTransform:"uppercase",letterSpacing:".5px"}}>
                                  🧾 Commission Invoice
                                </div>
                                <span style={{fontSize:10,fontWeight:600,color:"#94A3B8"}}>
                                  Manage in 💰 Commission Outstanding
                                </span>
                              </div>
                              {ci ? (
                                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                                  <div style={{padding:"8px 10px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0"}}>
                                    <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Invoice</div>
                                    <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{ci.invoice_number || "—"}</div>
                                    <div style={{marginTop:4}}>
                                      <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:(INV_META[ci.invoice_status]||INV_META.draft).bg,color:(INV_META[ci.invoice_status]||INV_META.draft).fg}}>
                                        {(INV_META[ci.invoice_status]||INV_META.draft).label}
                                      </span>
                                    </div>
                                  </div>
                                  <div style={{padding:"8px 10px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0"}}>
                                    <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Net Commission</div>
                                    <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{fmtAED(ci.commission_net)}</div>
                                    <div style={{fontSize:10,color:"#16A34A",marginTop:3}}>Received: {fmtAED(ci.amount_received)}</div>
                                  </div>
                                  <div style={{padding:"8px 10px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0"}}>
                                    <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Outstanding</div>
                                    <div style={{fontSize:13,fontWeight:700,color:"#B45309"}}>{fmtAED(Number(ci.commission_net||0)-Number(ci.amount_received||0))}</div>
                                    {ci.invoice_date && <div style={{fontSize:10,color:"#64748B",marginTop:3}}>Raised {new Date(ci.invoice_date).toLocaleDateString("en-AE",{day:"numeric",month:"short"})}</div>}
                                  </div>
                                </div>
                              ) : (
                                <div style={{padding:"10px 12px",background:"#fff",borderRadius:7,border:"1px dashed #E2E8F0",fontSize:11,color:"#64748B"}}>
                                  No invoice raised yet. A draft commission invoice is auto-created when this deal reaches <strong>SPA Signed</strong>.
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <div style={{marginTop:14,padding:"9px 12px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:7,fontSize:11,color:"#0C4A6E"}}>
                          💡 <strong>Tip:</strong> All financial data sourced from latest proposal (V{proposals.length||"—"}). To change, send a revised proposal.
                        </div>
                      </div>
                    );
                  })()
                ) : dashboardTab === "upfront" ? (
                  /* 20 May 2026 Phase 2g: UPFRONT COSTS PANEL - pure buyer outflow (NO Agency Fee per architecture) */
                  (() => {
                    const latest = proposals[0];
                    const sd = latest?.structured_data || {};
                    const proposalUnits = (sd.proposal_units && sd.proposal_units.length>0) ? sd.proposal_units : [];
                    const firstUnit = proposalUnits[0] || {};
                    const netPrice = Number(sd.total_value || firstUnit.discounted_price || opp.current_agreed_price || 0);
                    const dldPct = 4;
                    const dldFee = Math.round(netPrice * dldPct/100);
                    const dldPayer = sd.dld_handling || (opp.current_dld_payer === "buyer" ? "buyer_pays" : opp.current_dld_payer === "developer" ? "developer_pays" : opp.current_dld_payer === "split" ? "split" : null);
                    const buyerDldShare = dldPayer === "buyer_pays" ? dldFee : dldPayer === "developer_pays" ? 0 : Math.round(dldFee/2);
                    const dldLabelUpf = dldPayer === "buyer_pays" ? "Buyer pays full" :
                                       dldPayer === "developer_pays" ? "Developer absorbs" :
                                       dldPayer === "split" ? "Split 50/50" :
                                       "Negotiated";
                    const oqoodFee = 4020;
                    // Booking 10% of net (typical for off-plan)
                    const bookingFee = Math.round(netPrice * 0.10);
                    // Initial advance from payment plan preset
                    const planPreset = opp.current_payment_plan_preset || sd.payment_plan_preset;
                    let initialPct = 0;
                    if (planPreset === "10/90") initialPct = 10;
                    else if (planPreset === "20/80") initialPct = 20;
                    else if (planPreset === "40/60") initialPct = 40;
                    else if (planPreset === "50/50 PHP") initialPct = 50;
                    const initialAdvance = Math.round(netPrice * initialPct / 100);
                    // Annual maintenance: unit.service_charge_per_sqft × unit.size_sqft
                    const linkedUnit3 = (units||[]).find(u => u.id === opp.unit_id);
                    const sqft = linkedUnit3?.size_sqft || 0;
                    const scPerSqft = linkedUnit3?.service_charge_per_sqft || 0;
                    const annualMaintenance = Math.round(sqft * scPerSqft);
                    // Total one-time
                    const oneTimeTotal = netPrice + buyerDldShare + oqoodFee;
                    // Broker commission (SEPARATE - shown as note, not in totals)
                    const commissionPctUpf = Number(opp.commission_pct || 0);
                    const commissionAmtUpf = Math.round(netPrice * commissionPctUpf / 100);
                    return (
                      <div style={{padding:"4px 2px"}}>
                        {/* Header */}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:10,borderBottom:"2px solid #F1F5F9"}}>
                          <div style={{fontSize:16,fontWeight:700,color:"#0F2540",display:"flex",alignItems:"center",gap:8}}>
                            📊 Upfront Costs
                            <span style={{fontSize:10,padding:"2px 7px",borderRadius:8,background:"#DBEAFE",color:"#1D4ED8",fontWeight:700}}>Buyer outflow</span>
                          </div>
                          <span style={{fontSize:10,color:"#94A3B8"}}>{latest ? `Sourced from V${proposals.length} + unit data` : "No proposal yet"}</span>
                        </div>
                        {!latest ? (
                          <div style={{textAlign:"center",padding:"40px 20px",color:"#94A3B8",fontSize:12,border:"1px dashed #E2E8F0",borderRadius:10}}>
                            No proposal sent yet. Upfront costs will calculate from the latest proposal.
                          </div>
                        ) : (
                          <>
                            {/* One-time payments */}
                            <div style={{padding:"16px 18px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:10,marginBottom:14}}>
                              <div style={{fontSize:11,fontWeight:700,color:"#0C4A6E",textTransform:"uppercase",letterSpacing:".5px",marginBottom:12}}>
                                💸 One-time payments (at SPA / handover)
                              </div>
                              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0"}}>
                                  <div>
                                    <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Net Price (from V{proposals.length})</div>
                                    <div style={{fontSize:11,color:"#64748B"}}>Total deal value after discount</div>
                                  </div>
                                  <div style={{fontSize:15,fontWeight:700,color:"#0F2540"}}>AED {Number(netPrice).toLocaleString()}</div>
                                </div>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0",marginLeft:20}}>
                                  <div>
                                    <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>· Booking 10% (within net)</div>
                                    <div style={{fontSize:11,color:"#64748B"}}>Standard off-plan booking</div>
                                  </div>
                                  <div style={{fontSize:13,fontWeight:600,color:"#475569"}}>AED {Number(bookingFee).toLocaleString()}</div>
                                </div>
                                {initialAdvance > 0 && (
                                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0",marginLeft:20}}>
                                    <div>
                                      <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>· Initial Advance ({initialPct}%, within net)</div>
                                      <div style={{fontSize:11,color:"#64748B"}}>Per payment plan {planPreset}</div>
                                    </div>
                                    <div style={{fontSize:13,fontWeight:600,color:"#475569"}}>AED {Number(initialAdvance).toLocaleString()}</div>
                                  </div>
                                )}
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0"}}>
                                  <div>
                                    <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>DLD Fee (4% of price)</div>
                                    <div style={{fontSize:11,color:"#64748B"}}>{dldLabelUpf}</div>
                                  </div>
                                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>AED {Number(buyerDldShare).toLocaleString()}</div>
                                </div>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0"}}>
                                  <div>
                                    <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Oqood Fee</div>
                                    <div style={{fontSize:11,color:"#64748B"}}>Government registration</div>
                                  </div>
                                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>AED {Number(oqoodFee).toLocaleString()}</div>
                                </div>
                                {/* Total */}
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:"#EFF6FF",borderRadius:7,border:"2px solid #BFDBFE",marginTop:4}}>
                                  <div style={{fontSize:11,fontWeight:700,color:"#1D4ED8",textTransform:"uppercase",letterSpacing:".5px"}}>Total one-time outflow</div>
                                  <div style={{fontSize:18,fontWeight:700,color:"#1D4ED8"}}>AED {Number(oneTimeTotal).toLocaleString()}</div>
                                </div>
                              </div>
                            </div>
                            {/* Recurring annual */}
                            {annualMaintenance > 0 ? (
                              <div style={{padding:"16px 18px",background:"#FDF3DC",border:"1px solid #F0D795",borderRadius:10,marginBottom:14}}>
                                <div style={{fontSize:11,fontWeight:700,color:"#854D0E",textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>
                                  🔁 Recurring (annual, post-handover)
                                </div>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:"#fff",borderRadius:7,border:"1px solid #E2E8F0"}}>
                                  <div>
                                    <div style={{fontSize:9,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Annual Maintenance</div>
                                    <div style={{fontSize:11,color:"#64748B"}}>{sqft.toLocaleString()} sqft × AED {scPerSqft}/sqft</div>
                                  </div>
                                  <div style={{fontSize:16,fontWeight:700,color:"#A06810"}}>AED {Number(annualMaintenance).toLocaleString()}/yr</div>
                                </div>
                              </div>
                            ) : (
                              <div style={{padding:"10px 14px",background:"#FEF9C3",border:"1px solid #FDE68A",borderRadius:8,marginBottom:14,fontSize:11,color:"#854D0E"}}>
                                ⚠ Unit's <code>service_charge_per_sqft</code> not set. Annual maintenance cannot be calculated.
                              </div>
                            )}
                            {/* Architectural notes */}
                            <div style={{padding:"10px 14px",background:"#FAFBFE",border:"1px solid #D1D9E6",borderRadius:8,marginBottom:8,fontSize:11,color:"#475569",borderLeft:"3px solid #1D4ED8"}}>
                              💼 <strong>Broker commission</strong> (AED {Number(commissionAmtUpf).toLocaleString()} at {commissionPctUpf.toFixed(2)}%) tracked separately as revenue - paid by developer, not buyer.
                            </div>
                            <div style={{padding:"10px 14px",background:"#FAFBFE",border:"1px solid #D1D9E6",borderRadius:8,fontSize:11,color:"#475569",borderLeft:"3px solid #7C3AED"}}>
                              📋 <strong>Phase 2 module:</strong> Buyer agency services (if any) + property management retainer tracked separately in future module.
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()
                ) : dashboardTab === "plan" ? (
                  /* 20 May 2026 Phase 2f: PAYMENT PLAN PANEL - schedule breakdown from proposal */
                  (() => {
                    const latest = proposals[0];
                    const sd = latest?.structured_data || {};
                    const proposalUnits = (sd.proposal_units && sd.proposal_units.length>0) ? sd.proposal_units : [];
                    const firstUnit = proposalUnits[0] || {};
                    const netPrice = Number(sd.total_value || firstUnit.discounted_price || opp.current_agreed_price || 0);
                    const planPreset = opp.current_payment_plan_preset || sd.payment_plan_preset;
                    // Parse preset label (e.g. "20/80") to extract initial/handover percentages
                    let initialPct = 0;
                    let constructionPct = 0;
                    let handoverPct = 0;
                    let isPHP = false;
                    if (planPreset) {
                      if (planPreset === "10/90") { initialPct = 10; handoverPct = 90; }
                      else if (planPreset === "20/80") { initialPct = 20; handoverPct = 80; }
                      else if (planPreset === "40/60") { initialPct = 40; handoverPct = 60; }
                      else if (planPreset === "50/50 PHP") { initialPct = 50; handoverPct = 50; isPHP = true; }
                    }
                    const initialAmt = Math.round(netPrice * initialPct / 100);
                    const constructionAmt = Math.round(netPrice * constructionPct / 100);
                    const handoverAmt = Math.round(netPrice * handoverPct / 100);
                    const totalAmt = initialAmt + constructionAmt + handoverAmt;
                    return (
                      <div style={{padding:"4px 2px"}}>
                        {/* Header */}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:10,borderBottom:"2px solid #F1F5F9"}}>
                          <div style={{fontSize:16,fontWeight:700,color:"#0F2540",display:"flex",alignItems:"center",gap:8}}>
                            🏗️ Payment Plan
                            {planPreset && <span style={{fontSize:10,padding:"2px 7px",borderRadius:8,background:"#ECFDF5",color:"#065F46",fontWeight:700}}>{planPreset} AGREED</span>}
                          </div>
                          <span style={{fontSize:10,color:"#94A3B8"}}>{latest ? `Locked in V${proposals.length}` : "No proposal yet"}</span>
                        </div>
                        {!latest || !planPreset ? (
                          <div style={{textAlign:"center",padding:"40px 20px",color:"#94A3B8",fontSize:12,border:"1px dashed #E2E8F0",borderRadius:10}}>
                            {!latest ? "No proposal sent yet. Payment plan will show after first proposal." : "Custom payment plan (no preset). Refer to proposal details."}
                          </div>
                        ) : (
                          <>
                            {/* Schedule breakdown */}
                            <div style={{display:"flex",flexDirection:"column",gap:10}}>
                              {/* Initial Advance - highlighted */}
                              <div style={{padding:"14px 18px",background:"#EFF6FF",border:"2px solid #BFDBFE",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                <div>
                                  <div style={{fontSize:11,fontWeight:700,color:"#1D4ED8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>Initial Advance ({initialPct}%)</div>
                                  <div style={{fontSize:11,color:"#64748B"}}>Due at SPA signing</div>
                                </div>
                                <div style={{fontSize:20,fontWeight:700,color:"#1D4ED8"}}>AED {Number(initialAmt).toLocaleString()}</div>
                              </div>
                              {/* During Construction */}
                              <div style={{padding:"12px 18px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                <div>
                                  <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>During Construction ({constructionPct}%)</div>
                                  <div style={{fontSize:11,color:"#64748B"}}>{constructionPct === 0 ? "No mid-payments for this plan" : "Spread across construction phases"}</div>
                                </div>
                                <div style={{fontSize:16,fontWeight:700,color:constructionPct === 0 ? "#94A3B8" : "#0F2540"}}>
                                  {constructionPct === 0 ? "—" : `AED ${Number(constructionAmt).toLocaleString()}`}
                                </div>
                              </div>
                              {/* On Handover - highlighted */}
                              <div style={{padding:"14px 18px",background:"#EFF6FF",border:"2px solid #BFDBFE",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                <div>
                                  <div style={{fontSize:11,fontWeight:700,color:"#1D4ED8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>On Handover ({handoverPct}%)</div>
                                  <div style={{fontSize:11,color:"#64748B"}}>Due at unit handover</div>
                                </div>
                                <div style={{fontSize:20,fontWeight:700,color:"#1D4ED8"}}>AED {Number(handoverAmt).toLocaleString()}</div>
                              </div>
                              {/* Total */}
                              <div style={{padding:"12px 18px",background:"#ECFDF5",border:"2px solid #A8D5BE",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:4}}>
                                <div style={{fontSize:12,fontWeight:700,color:"#065F46",textTransform:"uppercase",letterSpacing:".5px"}}>Total Agreed</div>
                                <div style={{fontSize:20,fontWeight:700,color:"#1A7F5A"}}>AED {Number(totalAmt).toLocaleString()}</div>
                              </div>
                            </div>
                            {/* PHP note */}
                            {isPHP && (
                              <div style={{marginTop:14,padding:"10px 14px",background:"#FDF3DC",border:"1px solid #F0D795",borderRadius:8,fontSize:11,color:"#854D0E"}}>
                                ℹ <strong>PHP Plan:</strong> Includes 30% post-handover spread over 2 years (not shown in handover total above).
                              </div>
                            )}
                            <div style={{marginTop:14,padding:"10px 14px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:8,fontSize:11,color:"#0C4A6E"}}>
                              ℹ Plan locked in Proposal V{proposals.length}. To change, send a revised proposal with new terms.
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()
                ) : dashboardTab === "log-activity" ? (
                  /* Log Activity Tab */
                  <div style={{padding:"4px 2px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:10,borderBottom:"2px solid #F1F5F9"}}>
                      <div style={{fontSize:16,fontWeight:700,color:"#0F2540",display:"flex",alignItems:"center",gap:8}}>
                        📋 Log Activity
                        <span style={{fontSize:10,padding:"2px 7px",borderRadius:8,background:"#DBEAFE",color:"#1D4ED8",fontWeight:700}}>{activities.length} total</span>
                      </div>
                    </div>
                    <div style={{marginBottom:14}}>
                      <button onClick={()=>setShowLog(true)} style={{padding:"8px 14px",borderRadius:7,border:"1.5px solid #0F2540",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Log Activity</button>
                    </div>
                    {activities.length===0?<div style={{textAlign:"center",padding:"40px 20px",color:"#A0AEC0",fontSize:12,border:"1px dashed #E2E8F0",borderRadius:10}}>No activity yet — log a call, meeting, or note. Stage advancements will also appear here.</div>:<ActivitiesList activities={activities} setActivities={setActivities} opp={opp} canEdit={canEdit} showToast={showToast} currentStage={opp.stage} units={units} currentUser={currentUser} onCaptureVisitOutcome={(act)=>setVisitOutcomeFor(act)}/>}
                  </div>
                ) : dashboardTab === "coach" ? (
                  /* 20 May 2026 Phase 2h-wire: COACH PANEL - full AI Coach UI */
                  (() => {
                    if (["Closed Won","Closed Lost"].includes(opp.stage)) {
                      return (
                        <div style={{padding:"40px 20px",textAlign:"center",color:"#94A3B8",fontSize:12}}>
                          Coach is not available for closed deals.
                        </div>
                      );
                    }
                    const dataPointsC = activities.length + proposals.length + reminders.filter(r=>r.status==="pending").length;
                    const analysedAgoC = coachResult?.analysed_at ? Math.round((new Date() - new Date(coachResult.analysed_at)) / 60000) : null;
                    return (
                      <div style={{padding:"4px 2px"}}>
                        {/* Header */}
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,paddingBottom:10,borderBottom:"2px solid #F1F5F9",flexWrap:"wrap",gap:8}}>
                          <div style={{fontSize:16,fontWeight:700,color:"#0F766E",display:"flex",alignItems:"center",gap:8}}>
                            ✨ 🤖 PropPulse Coach
                            <span style={{fontSize:9,padding:"2px 7px",borderRadius:8,background:"#ECFEFF",color:"#0E7490",fontWeight:700,border:"1px solid #CCFBF1"}}>BETA</span>
                            <button onClick={()=>setCoachInfoOpen(o=>!o)} title="How does this work?" style={{padding:"2px 7px",borderRadius:6,border:"1px solid #CCFBF1",background:"#fff",color:"#0E7490",fontSize:10,fontWeight:600,cursor:"pointer"}}>ⓘ</button>
                          </div>
                          {analysedAgoC !== null && (
                            <span style={{fontSize:11,color:"#64748B"}}>Analysed {analysedAgoC===0?"just now":`${analysedAgoC} min ago`}</span>
                          )}
                        </div>
                        {/* Info tooltip */}
                        {coachInfoOpen && (
                          <div style={{marginBottom:14,padding:"10px 14px",background:"#F0FDFA",border:"1px solid #CCFBF1",borderRadius:8,fontSize:12,color:"#475569",lineHeight:1.6}}>
                            <strong style={{color:"#0F766E"}}>How it works:</strong> When you click <em>Analyse</em>, PropPulse Coach reads this deal's history (activities, proposals, visits, reminders, lead profile) and recommends 1-3 next moves. We don't run it automatically — you stay in control of when AI is consulted, and it keeps your token usage predictable. Results stay until you click Refresh.
                          </div>
                        )}
                        {/* Initial state */}
                        {!coachResult && !coachLoading && !coachError && (
                          <div style={{padding:"24px 20px",background:"#F0FDFA",border:"1px solid #CCFBF1",borderRadius:10,textAlign:"center"}}>
                            <div style={{fontSize:36,marginBottom:10}}>✨</div>
                            <div style={{fontSize:14,fontWeight:700,color:"#0F766E",marginBottom:6}}>Ready to analyse this deal</div>
                            <div style={{fontSize:12,color:"#475569",marginBottom:14,lineHeight:1.5}}>
                              I can review this deal's history and recommend your next move.
                            </div>
                            <div style={{fontSize:11,color:"#64748B",marginBottom:14}}>
                              Based on: <strong>{activities.length}</strong> activit{activities.length===1?"y":"ies"} · <strong>{proposals.length}</strong> proposal{proposals.length===1?"":"s"} · <strong>{reminders.filter(r=>r.status==="pending").length}</strong> pending reminder{reminders.filter(r=>r.status==="pending").length===1?"":"s"}
                            </div>
                            <button onClick={runCoach} disabled={dataPointsC===0}
                              title={dataPointsC===0?"Add some activity first — there's nothing to analyse":"Analyse this deal with AI"}
                              style={{padding:"10px 22px",borderRadius:8,border:"none",background:dataPointsC===0?"#CBD5E1":"linear-gradient(135deg, #6D28D9 0%, #0E7490 100%)",color:"#fff",fontSize:13,fontWeight:700,cursor:dataPointsC===0?"not-allowed":"pointer",boxShadow:dataPointsC===0?"none":"0 4px 12px rgba(13, 116, 144, 0.3)"}}>
                              ✨ Analyse this deal →
                            </button>
                            {dataPointsC===0 && (
                              <div style={{marginTop:10,fontSize:11,color:"#A06810"}}>
                                ⚠ Add activity, send a proposal, or schedule a reminder first.
                              </div>
                            )}
                          </div>
                        )}
                        {/* Loading state */}
                        {coachLoading && (
                          <div style={{padding:"40px 20px",textAlign:"center",background:"#F0FDFA",border:"1px solid #CCFBF1",borderRadius:10}}>
                            <div style={{fontSize:36,marginBottom:10,display:"inline-block",animation:"spin 1.2s linear infinite"}}>⚙️</div>
                            <div style={{fontSize:13,fontWeight:700,color:"#0F766E",marginBottom:4}}>Analysing...</div>
                            <div style={{fontSize:11,color:"#64748B"}}>Reading the deal history and forming recommendations</div>
                          </div>
                        )}
                        {/* Error state */}
                        {coachError && !coachLoading && (
                          <div style={{padding:"12px 14px",background:"#FEE2E2",border:"1px solid #FCA5A5",borderRadius:8,fontSize:12,color:"#C53030",marginBottom:12,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                            <span style={{fontSize:18}}>⚠</span>
                            <span style={{flex:1,minWidth:200}}>{coachError}</span>
                            <button onClick={runCoach} style={{padding:"5px 12px",borderRadius:6,border:"1px solid #C53030",background:"#fff",color:"#C53030",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                              Retry
                            </button>
                          </div>
                        )}
                        {/* Results state */}
                        {coachResult && !coachLoading && (
                          <div>
                            {coachResult.summary && (
                              <div style={{fontSize:13,color:"#0F766E",marginBottom:14,padding:"12px 14px",background:"#F0FDFA",border:"1px solid #CCFBF1",borderRadius:8,fontStyle:"italic",lineHeight:1.5}}>
                                📊 {coachResult.summary}
                              </div>
                            )}
                            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
                              {coachResult.suggestions.map((s, idx) => {
                                const conf = s.confidence || "medium";
                                const confColor = conf==="high"?"#0F766E":conf==="medium"?"#A06810":"#64748B";
                                const confBg = conf==="high"?"#CCFBF1":conf==="medium"?"#FEF3C7":"#F1F5F9";
                                const actionLabel = ({
                                  build_proposal:"📤 Build proposal",
                                  schedule_followup:"📅 Schedule follow-up",
                                  mark_lost:"✗ Mark as lost",
                                  advance_stage: s.action_params?.suggested_stage ? `→ Move to ${s.action_params.suggested_stage}` : "→ Advance stage",
                                  note_only:null,
                                })[s.action_type] || null;
                                return (
                                  <div key={idx} style={{background:"#fff",border:"1px solid #CCFBF1",borderRadius:10,padding:"12px 14px"}}>
                                    <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:8,flexWrap:"wrap"}}>
                                      <span style={{fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:10,background:confBg,color:confColor,letterSpacing:".4px",textTransform:"uppercase"}}>
                                        {conf}
                                      </span>
                                      <span style={{fontSize:14,fontWeight:700,color:"#0F2540",flex:1,minWidth:200}}>{s.title}</span>
                                    </div>
                                    {s.reasoning && (
                                      <div style={{fontSize:12,color:"#475569",lineHeight:1.6,marginBottom:10,paddingLeft:4}}>
                                        💭 {s.reasoning}
                                      </div>
                                    )}
                                    {actionLabel && (
                                      <button onClick={()=>applyCoachAction(s)}
                                        style={{padding:"6px 14px",borderRadius:6,border:"1px solid #5EEAD4",background:"#ECFEFF",color:"#0F766E",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                        {actionLabel}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{display:"flex",gap:6,paddingTop:10,borderTop:"1px solid #F1F5F9"}}>
                              <button onClick={runCoach} disabled={coachLoading}
                                style={{padding:"6px 14px",borderRadius:6,border:"1px solid #CCFBF1",background:"#fff",color:"#0E7490",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                🔄 Refresh analysis
                              </button>
                              <button onClick={()=>{setCoachResult(null); setCoachError("");}}
                                style={{padding:"6px 14px",borderRadius:6,border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                                Dismiss
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div style={{padding:"20px 4px"}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#0F2540",marginBottom:8}}>
                      📋 Tab active: <span style={{color:"#1D4ED8"}}>{dashboardTab}</span>
                    </div>
                    <div style={{fontSize:12,color:"#64748B",lineHeight:1.6}}>
                      All 7 tabs wired! Dashboard refactor complete.
                    </div>
                    <button onClick={()=>setDashboardTab(null)} style={{marginTop:12,padding:"5px 12px",borderRadius:6,border:"1px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#475569"}}>← Back to dashboard</button>
                  </div>
                )}
              </div>
            </div>
            {/* ── 🤖 AI COACH — analyses deal data and recommends next moves (Phase F W4) ──
                 Pattern: visible always (so users know AI is here + demo punch),
                 runs on click (so users stay in control + token spend is opt-in),
                 caches in component state (so re-mounts don't re-bill).
            ── */}
            {!["Closed Won","Closed Lost"].includes(opp.stage) && (()=>{
              // 20 May 2026 Phase 2h-hide: Hide old Coach section
              // Content will be re-rendered inside dashboard Coach tab panel (Step 2)
              // Set HIDE_OLD_COACH_SECTION=false to re-enable for emergency revert
              const HIDE_OLD_COACH_SECTION = true;
              if (HIDE_OLD_COACH_SECTION) return null;

              const dataPoints = activities.length + proposals.length + reminders.filter(r=>r.status==="pending").length;
              const analysedAgo = coachResult?.analysed_at ? Math.round((new Date() - new Date(coachResult.analysed_at)) / 60000) : null;
              return (
                <div style={{background:"#F0FDFA",border:"1px solid #CCFBF1",borderRadius:10,padding:14,marginBottom:14}}>
                  {/* Header */}
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#0F766E",letterSpacing:"-.2px",display:"flex",alignItems:"center",gap:6}}>
                      🤖 PropPulse Coach
                      <span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:"#ECFEFF",color:"#0E7490",fontWeight:600,border:"1px solid #CCFBF1"}}>BETA</span>
                    </div>
                    <button onClick={()=>setCoachInfoOpen(o=>!o)} title="How does this work?"
                      style={{padding:"2px 7px",borderRadius:6,border:"1px solid #CCFBF1",background:"#fff",color:"#0E7490",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                      ⓘ
                    </button>
                    {analysedAgo !== null && (
                      <span style={{fontSize:10,color:"#64748B",marginLeft:"auto"}}>
                        Analysed {analysedAgo===0?"just now":`${analysedAgo} min ago`}
                      </span>
                    )}
                  </div>

                  {/* Info tooltip explanation (toggle) */}
                  {coachInfoOpen && (
                    <div style={{marginBottom:10,padding:"8px 10px",background:"#fff",border:"1px solid #CCFBF1",borderRadius:8,fontSize:11,color:"#475569",lineHeight:1.6}}>
                      <strong style={{color:"#0F766E"}}>How it works:</strong> When you click <em>Analyse</em>, PropPulse Coach reads this deal's history (activities, proposals, visits, reminders, lead profile) and recommends 1-3 next moves. We don't run it automatically — you stay in control of when AI is consulted, and it keeps your token usage predictable. Results stay until you click Refresh.
                    </div>
                  )}

                  {/* Initial state — no analysis yet */}
                  {!coachResult && !coachLoading && (
                    <div>
                      <div style={{fontSize:12,color:"#0F766E",marginBottom:8,lineHeight:1.5}}>
                        I can analyse this deal and recommend your next move.
                      </div>
                      <div style={{fontSize:11,color:"#64748B",marginBottom:10}}>
                        Based on: {activities.length} activit{activities.length===1?"y":"ies"} · {proposals.length} proposal{proposals.length===1?"":"s"} · {reminders.filter(r=>r.status==="pending").length} pending reminder{reminders.filter(r=>r.status==="pending").length===1?"":"s"}
                      </div>
                      <button onClick={runCoach} disabled={dataPoints===0}
                        title={dataPoints===0?"Add some activity first — there's nothing to analyse":"Analyse this deal with AI"}
                        style={{padding:"8px 16px",borderRadius:7,border:"1px solid #5EEAD4",background:dataPoints===0?"#F0FDFA":"#ECFEFF",color:"#0F766E",fontSize:12,fontWeight:700,cursor:dataPoints===0?"not-allowed":"pointer",opacity:dataPoints===0?0.5:1}}>
                        ✨ Analyse this deal →
                      </button>
                    </div>
                  )}

                  {/* Loading */}
                  {coachLoading && (
                    <div style={{padding:"12px 0",fontSize:12,color:"#0F766E",display:"flex",alignItems:"center",gap:8}}>
                      <span style={{display:"inline-block",animation:"spin 1.2s linear infinite"}}>⚙️</span>
                      Reading the deal history and forming recommendations…
                    </div>
                  )}

                  {/* Error */}
                  {coachError && !coachLoading && (
                    <div style={{padding:"8px 10px",background:"#FEE2E2",border:"1px solid #FCA5A5",borderRadius:6,fontSize:11,color:"#C53030",marginBottom:8}}>
                      {coachError}
                      <button onClick={runCoach} style={{marginLeft:10,padding:"3px 10px",borderRadius:5,border:"1px solid #C53030",background:"#fff",color:"#C53030",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Results */}
                  {coachResult && !coachLoading && (
                    <div>
                      {coachResult.summary && (
                        <div style={{fontSize:12,color:"#0F766E",marginBottom:10,padding:"8px 10px",background:"#fff",border:"1px solid #CCFBF1",borderRadius:6,fontStyle:"italic"}}>
                          📊 {coachResult.summary}
                        </div>
                      )}
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {coachResult.suggestions.map((s, idx) => {
                          const conf = s.confidence || "medium";
                          const confColor = conf==="high"?"#0F766E":conf==="medium"?"#A06810":"#64748B";
                          const confBg = conf==="high"?"#CCFBF1":conf==="medium"?"#FEF3C7":"#F1F5F9";
                          const actionLabel = ({
                            build_proposal:"📤 Build proposal",
                            schedule_followup:"📅 Schedule follow-up",
                            mark_lost:"✗ Mark as lost",
                            advance_stage: s.action_params?.suggested_stage ? `→ Move to ${s.action_params.suggested_stage}` : "→ Advance stage",
                            note_only:null,
                          })[s.action_type] || null;
                          return (
                            <div key={idx} style={{background:"#fff",border:"1px solid #CCFBF1",borderRadius:8,padding:"10px 12px"}}>
                              <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                                <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:confBg,color:confColor,letterSpacing:".4px",textTransform:"uppercase"}}>
                                  {conf}
                                </span>
                                <span style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{s.title}</span>
                              </div>
                              {s.reasoning && (
                                <div style={{fontSize:11,color:"#475569",lineHeight:1.5,marginBottom:8}}>
                                  💭 {s.reasoning}
                                </div>
                              )}
                              {actionLabel && (
                                <button onClick={()=>applyCoachAction(s)}
                                  style={{padding:"5px 12px",borderRadius:6,border:"1px solid #5EEAD4",background:"#ECFEFF",color:"#0F766E",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                  {actionLabel}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{marginTop:10,display:"flex",gap:6}}>
                        <button onClick={runCoach} disabled={coachLoading}
                          style={{padding:"5px 12px",borderRadius:6,border:"1px solid #CCFBF1",background:"#fff",color:"#0E7490",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                          🔄 Refresh
                        </button>
                        <button onClick={()=>{setCoachResult(null); setCoachError("");}}
                          style={{padding:"5px 12px",borderRadius:6,border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── NEXT STEPS — pending follow-ups for this opportunity (Phase E W3) ── */}
            {(()=>{
              // 20 May 2026 Phase 2d-hide: Hide old Next Steps section
              // Content moved to dashboard Next Steps tab.
              // Set HIDE_OLD_NEXT_STEPS_SECTION=false to re-enable for emergency revert.
              const HIDE_OLD_NEXT_STEPS_SECTION = true;
              if (HIDE_OLD_NEXT_STEPS_SECTION) return null;

              const now = new Date();
              const reminderTypeIcons = {Call:"📞",WhatsApp:"💬",Email:"✉️",Meeting:"🤝","Site Visit":"🏠","Send proposal":"📄","Send brochure":"📋","Note to self":"📝",Other:"📌"};
              // Sort: overdue first, then upcoming chronologically
              const sorted = [...reminders].sort((a,b)=>new Date(a.trigger_at)-new Date(b.trigger_at));
              if(sorted.length===0) return null;

              const fmtDue = (iso)=>{
                const d = new Date(iso);
                const diffMs = d - now;
                const diffDays = Math.floor(diffMs / 86400000);
                const dateStr = d.toLocaleDateString("en-AE",{day:"numeric",month:"short"});
                if(diffMs < 0){
                  const overdueDays = Math.abs(Math.ceil(diffMs / 86400000));
                  return {label: overdueDays===0?"due today":overdueDays===1?"1 day overdue":`${overdueDays} days overdue`, color:"#C53030", bg:"#FEE2E2", date:dateStr};
                }
                if(diffDays===0) return {label:"due today", color:"#A06810", bg:"#FDF3DC", date:dateStr};
                if(diffDays===1) return {label:"due tomorrow", color:"#1A5FA8", bg:"#E6EFF8", date:dateStr};
                if(diffDays<=7) return {label:`in ${diffDays} days`, color:"#1A5FA8", bg:"#E6EFF8", date:dateStr};
                return {label:dateStr, color:"#64748B", bg:"#F1F5F9", date:dateStr};
              };

              const markDone = (rem)=>{
                setRemAction({mode:"done", reminder:rem, note:"", date:""});
              };

              const snooze1Day = async(rem)=>{
                const newDate = new Date(rem.trigger_at);
                newDate.setDate(newDate.getDate()+1);
                const ok = await updateReminderStatus(rem.id,"pending",{trigger_at:newDate.toISOString()});
                if(ok) showToast("Snoozed 1 day","success");
              };

              const reschedule = (rem)=>{
                const currentDate = new Date(rem.trigger_at).toISOString().split("T")[0];
                setRemAction({mode:"reschedule", reminder:rem, note:"", date:currentDate});
              };

              const cancel = (rem)=>{
                setRemAction({mode:"cancel", reminder:rem, note:"", date:""});
              };

              return (
                <div style={{background:"#fff",border:"1px solid #E8EDF4",borderRadius:12,padding:"12px 16px",borderLeft:"3px solid #1A5FA8"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#1A5FA8",textTransform:"uppercase",letterSpacing:".6px"}}>
                      ⏰ Next Steps · what you owe this customer
                    </div>
                    <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,background:"#E6EFF8",color:"#1A5FA8"}}>{sorted.length} pending</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {sorted.map(rem=>{
                      const due = fmtDue(rem.trigger_at);
                      // Try to derive the action icon from the title prefix ("Call — name" → "Call")
                      const actionFromTitle = (rem.title||"").split("—")[0].trim();
                      const icon = reminderTypeIcons[actionFromTitle] || "📌";
                      const isAuto = rem.reason && rem.reason.startsWith("auto_");
                      return (
                        <div key={rem.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#F8FAFC",borderRadius:8,border:`1px solid ${due.color==="#C53030"?"#FECACA":"#E2E8F0"}`,flexWrap:"wrap"}}>
                          <span style={{fontSize:18,flexShrink:0}}>{icon}</span>
                          <div style={{flex:1,minWidth:200}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                              <span style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{rem.title}</span>
                              <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:due.bg,color:due.color}}>{due.label}</span>
                              {isAuto && <span style={{fontSize:9,fontWeight:600,padding:"1px 6px",borderRadius:8,background:"#F1F5F9",color:"#64748B"}}>auto</span>}
                              <span style={{fontSize:10,color:"#94A3B8"}}>{due.date}</span>
                            </div>
                            {rem.body && <div style={{fontSize:11,color:"#64748B",marginTop:3,fontStyle:"italic"}}>{rem.body}</div>}
                          </div>
                          {canEdit && (
                            <div style={{display:"flex",gap:5,flexShrink:0,flexWrap:"wrap"}}>
                              <button onClick={()=>markDone(rem)}
                                style={{padding:"5px 11px",borderRadius:6,border:"1px solid #1A7F5A",background:"#fff",color:"#1A7F5A",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                                ✓ Done
                              </button>
                              <button onClick={()=>snooze1Day(rem)}
                                style={{padding:"5px 11px",borderRadius:6,border:"1px solid #D1D9E6",background:"#fff",color:"#64748B",fontSize:11,fontWeight:600,cursor:"pointer"}}
                                title="Snooze 1 day">
                                💤 +1d
                              </button>
                              <button onClick={()=>reschedule(rem)}
                                style={{padding:"5px 11px",borderRadius:6,border:"1px solid #D1D9E6",background:"#fff",color:"#64748B",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                                📅
                              </button>
                              <button onClick={()=>cancel(rem)}
                                style={{padding:"5px 11px",borderRadius:6,border:"1px solid #FECACA",background:"#fff",color:"#C53030",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── PROPOSALS — visible whenever proposals exist OR the agent can edit
                 (so the empty-state "+ Build proposal" call-to-action shows from any stage).
                 Hidden only for terminal closed stages where deal is done. ── */}
            {(()=>{
              // 20 May 2026 Phase 3: Hide old Proposals section
              // Content moved to dashboard Proposals tab (see line ~6260 area).
              // Set HIDE_OLD_PROPOSALS_SECTION=false to re-enable for emergency revert.
              const HIDE_OLD_PROPOSALS_SECTION = true;
              if (HIDE_OLD_PROPOSALS_SECTION) return null;

              const isTerminal = ["Closed Won","Closed Lost"].includes(opp.stage);
              if (isTerminal && proposals.length === 0) return null;
              if (!canEdit && proposals.length === 0) return null;

              const fmtAed = (n) => `AED ${Number(n||0).toLocaleString()}`;
              // 20 May 2026 Phase 2b: Use module-level PROPOSAL_STATUS_META (was duplicated here)
              const STATUS_META = PROPOSAL_STATUS_META;

              const updateProposalStatus = async (propId, newStatus) => {
                const{error}=await supabase.from("proposals").update({status:newStatus}).eq("id",propId);
                if(error){
                  console.error("Proposal status update failed:", error);
                  showToast(`Failed: ${error.message}`,"error");
                  return;
                }
                setProposals(p => p.map(x => x.id===propId ? {...x, status:newStatus} : x));
                // Drop activity note for audit
                await supabase.from("activities").insert({
                  opportunity_id: opp.id, lead_id: lead.id, company_id: opp.company_id||currentUser.company_id||null,
                  type:"Note",
                  note:`📤 Proposal marked as ${newStatus.toUpperCase()}`,
                  status:"completed",
                  user_id: currentUser.id, user_name: currentUser.full_name, lead_name: lead.name,
                  stage_at_event: opp.stage, activity_subtype: "proposal_status_change",
                });
                // Refresh activities so the timeline shows it
                supabase.from("activities").select("*").eq("opportunity_id",opp.id).order("created_at",{ascending:false}).then(({data})=>setActivities(data||[]));
                showToast(`Marked as ${newStatus}`,"success");
              };

              // Compute status counts for the header summary
              const counts = proposals.reduce((acc,p)=>{
                const k = p.status === "sent" ? "active" : (p.status === "superseded" ? "superseded" : p.status);
                acc[k] = (acc[k]||0) + 1;
                return acc;
              }, {});
              const summaryBits = [];
              if (counts.active) summaryBits.push(`${counts.active} active`);
              if (counts.accepted) summaryBits.push(`${counts.accepted} accepted`);
              if (counts.rejected) summaryBits.push(`${counts.rejected} rejected`);
              if (counts.superseded) summaryBits.push(`${counts.superseded} superseded`);
              if (counts.expired) summaryBits.push(`${counts.expired} expired`);

              return (
                <div style={{background:"#fff",border:"1px solid #E8EDF4",borderRadius:12,padding:"12px 16px",borderLeft:"3px solid #1A5FA8"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:8}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:"#1A5FA8",textTransform:"uppercase",letterSpacing:".6px"}}>
                        📤 Proposals
                      </div>
                      <div style={{fontSize:11,color:"#94A3B8",marginTop:2}}>
                        {proposals.length===0
                          ? "No proposal sent yet"
                          : <>
                              <strong style={{color:"#0F2540"}}>{proposals.length}</strong> total
                              {summaryBits.length>0 && <> · {summaryBits.join(" · ")}</>}
                            </>
                        }
                      </div>
                    </div>
                    {canEdit && (
                      <button onClick={()=>requestProposalDialog()}
                        style={{padding:"6px 14px",borderRadius:7,border:"none",background:"#0F2540",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                        {proposals.length===0 ? "+ Build proposal" : "+ Send revised proposal"}
                      </button>
                    )}
                  </div>

                  {proposals.length===0 ? (
                    <div style={{textAlign:"center",padding:"1.25rem",color:"#A0AEC0",fontSize:12,border:"1px dashed #E2E8F0",borderRadius:10}}>
                      Build a proposal — multi-unit options, pricing, payment plan, DLD handling, validity.
                    </div>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {proposals.map((p, idx)=>{
                        const sm = STATUS_META[p.status] || STATUS_META.sent;
                        const sd = p.structured_data || {};
                        // Multi-source fallback for unit-level fields:
                        //   1. structured_data.proposal_units (multi-unit, the source of truth)
                        //   2. column values from p (legacy single-unit schema)
                        //   3. structured_data flat fields (defensive insert moved them here)
                        //   4. salePricing for asking_price (last resort)
                        const proposalUnits = (sd.proposal_units && sd.proposal_units.length>0)
                          ? sd.proposal_units.map(pu => {
                              const sp = (salePricing||[]).find(s => s.unit_id === pu.unit_id);
                              return {
                                ...pu,
                                asking_price: Number(pu.asking_price||0) || Number(sp?.asking_price||0),
                                discount_pct: Number(pu.discount_pct||0),
                                discounted_price: Number(pu.discounted_price||0) || Number(pu.asking_price||0) || Number(sp?.asking_price||0),
                              };
                            })
                          : [(()=>{
                              const sp = (salePricing||[]).find(s => s.unit_id === p.unit_id);
                              const asking = Number(p.asking_price||sd.asking_price||sp?.asking_price||0);
                              const discPct = Number(p.discount_pct||sd.discount_pct||0);
                              const discPrice = Number(p.discounted_price||sd.discounted_price||0) || asking;
                              return {
                                unit_id: p.unit_id,
                                asking_price: asking,
                                discount_pct: discPct,
                                discounted_price: discPrice,
                              };
                            })()];
                        const totalValue = Number(sd.total_value||0) || proposalUnits.reduce((s,pu)=>s+Number(pu.discounted_price||0),0);
                        // Display-time values for terms strip (with fallback)
                        const dPaymentPlan = p.payment_plan || sd.payment_plan;
                        const dDldHandling = sd.dld_handling;
                        const dServiceCharge = sd.service_charge_preset;
                        const expiry = (p.expiry_date||sd.expiry_date) ? new Date(p.expiry_date||sd.expiry_date) : null;
                        const isExpired = expiry && expiry < new Date() && p.status === "sent";
                        const dldLabel = DLD_OPTIONS.find(o=>o.value===dDldHandling)?.label;
                        const isLatest = idx === 0;
                        const proposalNumber = proposals.length - idx; // chronological #
                        // Hide terms strip entirely if there's nothing to show
                        const hasAnyTerms = dPaymentPlan || dldLabel || (dServiceCharge && dServiceCharge !== "none");

                        return (
                          <div key={p.id} style={{background: isLatest?"#FAFBFE":"#F8FAFC",border:`1px solid ${isLatest?"#B8D2EE":"#E2E8F0"}`,borderRadius:10,padding:"11px 13px",borderLeft:`3px solid ${sm.c}`,opacity: isLatest?1:0.85}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:7,flexWrap:"wrap"}}>
                              <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                                <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:"#0F2540",color:"#fff",letterSpacing:".4px"}}>
                                  PROPOSAL #{proposalNumber}
                                </span>
                                <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:sm.bg,color:sm.c,letterSpacing:".4px"}}>
                                  {sm.label}
                                </span>
                                {isExpired && <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:"#FEE2E2",color:"#C53030",letterSpacing:".4px"}}>⚠ EXPIRED</span>}
                                {isLatest && <span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:8,background:"#FEF3C7",color:"#7A4F01"}}>LATEST</span>}
                                <span style={{fontSize:11,color:"#64748B"}}>
                                  {proposalUnits.length} option{proposalUnits.length===1?"":"s"} · <strong style={{color:"#1A5FA8"}}>{fmtAed(totalValue)}</strong>
                                </span>
                              </div>
                              <span style={{fontSize:10,color:"#94A3B8"}}>
                                {p.sent_at ? `sent ${new Date(p.sent_at).toLocaleDateString("en-AE",{day:"numeric",month:"short"})}` : ""}
                                {expiry ? ` · expires ${expiry.toLocaleDateString("en-AE",{day:"numeric",month:"short"})}` : ""}
                              </span>
                            </div>

                            {/* Unit options summary */}
                            <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:7}}>
                              {proposalUnits.map((pu,puIdx) => {
                                const u = (units||[]).find(x => x.id === pu.unit_id);
                                const proj = u ? (projects||[]).find(pp => pp.id === u.project_id) : null;
                                const bedLabel = u?.bedrooms === 0 ? "Studio" : (u?.bedrooms ? `${u.bedrooms}BR` : "");
                                return (
                                  <div key={puIdx} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",background:"#fff",borderRadius:6,border:"1px solid #EEF2F7",fontSize:11,flexWrap:"wrap"}}>
                                    <span style={{fontWeight:700,color:"#0F2540"}}>{u?.unit_ref||"—"}</span>
                                    <span style={{color:"#64748B"}}>
                                      {[bedLabel, proj?.name].filter(Boolean).join(" · ")}
                                    </span>
                                    {Number(pu.discount_pct||0)>0 && (
                                      <span style={{color:"#A06810",fontWeight:600}}>−{pu.discount_pct}%</span>
                                    )}
                                    <span style={{marginLeft:"auto",fontWeight:700,color:"#1A5FA8"}}>{fmtAed(pu.discounted_price)}</span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Terms strip — only render if any term has data */}
                            {hasAnyTerms && (
                              <div style={{display:"flex",flexWrap:"wrap",gap:8,fontSize:11,color:"#475569",padding:"6px 8px",background:"#fff",borderRadius:6,border:"1px solid #EEF2F7",marginBottom:7}}>
                                {dPaymentPlan && <span>📅 <strong style={{color:"#0F2540"}}>{dPaymentPlan}</strong></span>}
                                {dldLabel && <span>🏛️ {dldLabel}</span>}
                                {dServiceCharge && dServiceCharge !== "none" && (
                                  <span>🧾 SC: {SERVICE_CHARGE_PRESETS.find(o=>o.value===dServiceCharge)?.label||dServiceCharge}</span>
                                )}
                              </div>
                            )}

                            {/* Cover notes preview */}
                            {(p.notes || sd.notes) && (
                              <details style={{marginBottom:7}}>
                                <summary style={{fontSize:10,color:"#94A3B8",fontWeight:600,cursor:"pointer",textTransform:"uppercase",letterSpacing:".4px"}}>Cover message</summary>
                                <div style={{fontSize:11,color:"#475569",marginTop:5,padding:"6px 8px",background:"#fff",borderRadius:6,border:"1px solid #EEF2F7",whiteSpace:"pre-wrap",lineHeight:1.5}}>
                                  {p.notes || sd.notes}
                                </div>
                              </details>
                            )}

                            {/* Actions: View always visible; lifecycle buttons only on latest sent */}
                            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:5}}>
                              <button onClick={()=>setViewingProposal(p)}
                                style={{padding:"5px 11px",borderRadius:6,border:"1px solid #1A5FA8",background:"#fff",color:"#1A5FA8",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                                👁 View
                              </button>
                              {isLatest && p.status === "sent" && canEdit && (
                                <>
                                  <button onClick={()=>updateProposalStatus(p.id,"viewed")}
                                    style={{padding:"5px 11px",borderRadius:6,border:"1px solid #A06810",background:"#fff",color:"#A06810",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                                    Customer viewed
                                  </button>
                                  <button onClick={()=>updateProposalStatus(p.id,"accepted")}
                                    style={{padding:"5px 11px",borderRadius:6,border:"1px solid #1A7F5A",background:"#fff",color:"#1A7F5A",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                                    ✓ Accepted
                                  </button>
                                  <button onClick={()=>updateProposalStatus(p.id,"rejected")}
                                    style={{padding:"5px 11px",borderRadius:6,border:"1px solid #C53030",background:"#fff",color:"#C53030",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                                    ✕ Rejected
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── NEGOTIATION ROUNDS — broker/buyer/developer thread (Phase E W2) ── */}
            {(()=>{
              // 20 May 2026 Phase 2c-hide: Hide old Negotiations section
              // Content moved to dashboard Negotiations tab.
              // Set HIDE_OLD_NEGOTIATIONS_SECTION=false to re-enable for emergency revert.
              const HIDE_OLD_NEGOTIATIONS_SECTION = true;
              if (HIDE_OLD_NEGOTIATIONS_SECTION) return null;

              // Show the rounds panel whenever we have negotiation activities OR the opp is in Negotiation+ stages
              const negStages = ["Negotiation","Offer Accepted","Reserved","SPA Signed","Closed Won"];
              const stageAllows = negStages.includes(opp.stage);
              const rounds = activities.filter(a =>
                (a.activity_subtype === "stage_advance" && a.to_stage === "Negotiation")
                || a.activity_subtype === "negotiation_round"
                || a.activity_subtype === "handover_meeting"
              ).slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));

              if(!stageAllows && rounds.length===0) return null;

              const actorMeta = {
                buyer:     {label:"Buyer",     icon:"🟦", c:"#1A5FA8", bg:"#E6EFF8", border:"#B8D2EE"},
                developer: {label:"Developer", icon:"🟩", c:"#1A7F5A", bg:"#E6F4EE", border:"#A8D5BE"},
                broker:    {label:"Broker",    icon:"🟧", c:"#A06810", bg:"#FDF3DC", border:"#F0D795"},
              };

              const fmtRoundDate = (iso) => new Date(iso).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"});

              return (
                <div style={{background:"#fff",border:"1px solid #E8EDF4",borderRadius:12,padding:"12px 16px",borderLeft:"3px solid #B83232"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:700,color:"#B83232",textTransform:"uppercase",letterSpacing:".6px"}}>
                        🤝 Negotiation Rounds · broker / buyer / developer
                      </div>
                      <div style={{fontSize:11,color:"#94A3B8",marginTop:2}}>
                        {rounds.length===0 ? "No rounds yet — log the first response from the developer." : `${rounds.length} round${rounds.length===1?"":"s"} on the table`}
                      </div>
                    </div>
                    {canEdit && (
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>setShowLogRound(true)}
                          style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #B83232",background:"#fff",color:"#B83232",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                          + Log Round
                        </button>
                        <button onClick={()=>setShowHandover(true)}
                          style={{padding:"6px 12px",borderRadius:7,border:"none",background:"#7C3AED",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                          📅 Schedule Handover
                        </button>
                      </div>
                    )}
                  </div>

                  {rounds.length===0 ? (
                    <div style={{textAlign:"center",padding:"1.25rem",color:"#A0AEC0",fontSize:12,border:"1px dashed #E2E8F0",borderRadius:10}}>
                      Once you've taken the buyer's asks to the developer, log their response here.
                    </div>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {rounds.map((r, idx) => {
                        const sd = r.structured_data || {};
                        const isHandover = r.activity_subtype === "handover_meeting";
                        const isOpening = r.activity_subtype === "stage_advance";
                        const actorKey = sd.actor || (isOpening ? "buyer" : "broker");
                        const am = actorMeta[actorKey] || actorMeta.broker;
                        const dateLabel = sd.round_at ? fmtRoundDate(sd.round_at) : fmtRoundDate(r.created_at);
                        const enabledAsks = sd.asks ? Object.keys(sd.asks).filter(k=>sd.asks[k]?.enabled) : [];
                        const status = sd.status || (isOpening ? "Open" : null);
                        const statusColors = {"Open":{c:"#1A5FA8",bg:"#E6EFF8"},"Accepted":{c:"#1A7F5A",bg:"#E6F4EE"},"Rejected":{c:"#C53030",bg:"#FEE2E2"},"Counter-pending":{c:"#D97706",bg:"#FEF3C7"}};
                        const sc = statusColors[status]||{};

                        return (
                          <div key={r.id} style={{display:"flex",gap:10,padding:"10px 12px",background:"#F8FAFC",borderRadius:8,border:`1px solid ${am.border}`,borderLeft:`3px solid ${am.c}`}}>
                            <div style={{flexShrink:0,fontSize:18,paddingTop:1}}>{isHandover?"📅":am.icon}</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                                <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:am.bg,color:am.c,letterSpacing:".4px"}}>
                                  {isHandover ? "HANDOVER MEETING" : `ROUND ${idx+1} · ${am.label.toUpperCase()}`}
                                </span>
                                {status && <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:sc.bg,color:sc.c}}>{status.toUpperCase()}</span>}
                                <span style={{fontSize:10,color:"#94A3B8"}}>{dateLabel}</span>
                              </div>

                              {/* Asks summary */}
                              {enabledAsks.length>0 && (
                                <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:5}}>
                                  {enabledAsks.map(k=>{
                                    const def = ASKS_GRID_OPTIONS.find(o=>o.key===k);
                                    if(!def) return null;
                                    const val = sd.asks[k]?.value;
                                    const valLabel = def.detail?.kind==="percent" && val ? `${val}%` : val;
                                    return (
                                      <span key={k} style={{fontSize:10,fontWeight:600,padding:"3px 8px",borderRadius:10,background:"#fff",border:"1px solid #E2E8F0",color:"#0F2540"}}>
                                        {def.icon} {def.label}{valLabel?<span style={{color:"#1A5FA8",marginLeft:4,fontWeight:700}}>{valLabel}</span>:""}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Handover meta */}
                              {isHandover && (
                                <div style={{display:"flex",flexWrap:"wrap",gap:10,fontSize:11,color:"#475569",marginBottom:5,padding:"6px 8px",background:"#fff",borderRadius:6,border:"1px solid #E2E8F0"}}>
                                  {sd.meeting_at && <span><strong style={{color:"#94A3B8",fontWeight:600}}>📅</strong> {new Date(sd.meeting_at).toLocaleString("en-AE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>}
                                  {sd.location && <span><strong style={{color:"#94A3B8",fontWeight:600}}>📍</strong> {sd.location}</span>}
                                  {sd.attendees && <span><strong style={{color:"#94A3B8",fontWeight:600}}>👥</strong> {sd.attendees}</span>}
                                </div>
                              )}

                              {/* Free text */}
                              {(sd.broker_notes || sd.notes) && (
                                <div style={{fontSize:12,color:"#475569",lineHeight:1.5,whiteSpace:"pre-wrap"}}>
                                  {sd.broker_notes || sd.notes}
                                </div>
                              )}
                              {sd.buyer_position && (
                                <div style={{fontSize:10,color:"#64748B",marginTop:4,fontStyle:"italic"}}>
                                  Buyer stance: {sd.buyer_position}
                                </div>
                              )}

                              <div style={{fontSize:10,color:"#A0AEC0",marginTop:5}}>
                                logged by {r.user_name||"—"}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── ACTIVITY TIMELINE — moved up for prominence (Phase E dense layout) ── */}
            <div style={{background:"#fff",border:"1px solid #E8EDF4",borderRadius:12,padding:"12px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".6px"}}>Activity</div>
                <button onClick={()=>setShowLog(true)} style={{padding:"5px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540"}}>+ Log Activity</button>
              </div>
              {activities.length===0&&<div style={{textAlign:"center",padding:"1.5rem 1rem",color:"#A0AEC0",fontSize:12,border:"1px dashed #E2E8F0",borderRadius:10}}>No activity yet — log a call, meeting, or note. Stage advancements will also appear here.</div>}
              {activities.length>0&&<ActivitiesList activities={activities} setActivities={setActivities} opp={opp} canEdit={canEdit} showToast={showToast} currentStage={opp.stage} units={units} currentUser={currentUser} onCaptureVisitOutcome={(act)=>setVisitOutcomeFor(act)}/>}
            </div>

            {/* Unit details */}
            {/* 20 May 2026: Hide Property card - founder requested Tuesday (duplicate of header info) */}
            {/* To re-enable: change 'false &&' below to 'true &&' or remove wrapper */}
            {false && (
            <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px",marginBottom:12}}>Property</div>
              {unit?(
                <div style={{display:"flex",gap:12,alignItems:"flex-start",flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:200}}>
                    <div style={{fontWeight:700,fontSize:15,color:"#0F2540",marginBottom:4}}>{unit.unit_ref} — {unit.sub_type}</div>
                    <div style={{fontSize:12,color:"#718096",marginBottom:6}}>{proj?.name||"—"} · Floor {unit.floor_number||"—"} · {unit.view||"—"} · {unit.size_sqft?`${Number(unit.size_sqft).toLocaleString()} sqft`:""}</div>
                    {sp&&<div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#1A5FA8"}}>AED {Number(sp.asking_price).toLocaleString()}</div>}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,minWidth:200}}>
                    {[["Beds",unit.bedrooms===0?"Studio":unit.bedrooms||"—"],["Baths",unit.bathrooms||"—"],["Sqft",unit.size_sqft?Number(unit.size_sqft).toLocaleString():"—"],["Status",unit.status]].map(([l,v])=>(
                      <div key={l} style={{background:"#FAFBFC",borderRadius:8,padding:"8px 10px"}}>
                        <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>{l}</div>
                        <div style={{fontSize:12,fontWeight:600,color:"#0F2540"}}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ):(
                <div style={{color:"#A0AEC0",fontSize:12,textAlign:"center",padding:"1rem"}}>No unit linked to this opportunity yet</div>
              )}
            </div>
            )}

            {/* Financials */}
            {/* 20 May 2026 Phase 2e-hide: Hide old Financials section (content lives in dashboard Financials tab) */}
            {/* To re-enable: change 'false &&' below to 'true &&' or remove the wrapper */}
            {false && (
            <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px"}}>Financials</div>
                {INTERNAL_APPROVAL_FEATURES_ENABLED && canAction&&canDo(currentUser,"request_discount")&&!isWon&&(
                  <button onClick={()=>{setDiscReqForm({type:"sale_price",discount_pct:"",reason:"",discount_source:"Developer",developer_auth_ref:""});setShowDiscReq(true);}}
                    style={{padding:"5px 12px",borderRadius:7,border:"1.5px solid #C9A84C",background:"#FDF3DC",color:"#8A6200",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    💰 Request Discount
                  </button>
                )}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
                {/* 19 May 2026 Issue C: Read from current_* columns (Math Flow Sprint) instead of legacy fields */}
                {(() => {
                  const unitAskingPrice = (salePricing||[]).find(s => s.unit_id === opp.unit_id)?.asking_price;
                  const discValue = opp.current_discount_value || opp.discount_pct;
                  const discType = opp.current_discount_type || (opp.discount_pct ? "percent" : null);
                  const discSource = opp.current_discount_source || opp.discount_source;
                  const dldLabel = opp.current_dld_payer === "buyer" ? "Buyer pays" :
                                   opp.current_dld_payer === "developer" ? "Developer absorbs" :
                                   opp.current_dld_payer === "negotiated" ? "Negotiated" :
                                   opp.current_dld_payer === "split" ? `Split ${opp.current_dld_split_pct||50}/${100-(opp.current_dld_split_pct||50)}` :
                                   null;
                  return [
                    ["Budget", opp.budget],
                    ["Asking Price", unitAskingPrice],
                    ["Final Price", opp.current_agreed_price],
                    ["Discount", discValue && discType ? (discType === "percent" ? `${discValue}%` : `AED ${Number(discValue).toLocaleString()}`) + (discSource ? ` (${discSource})` : "") : null],
                    ["DLD Arrangement", dldLabel],
                    ["Payment Plan", opp.current_payment_plan_preset],
                    ["Commission %", opp.commission_pct ? Number(opp.commission_pct).toFixed(2)+"%" : null],
                  ].filter(([,v]) => v).map(([l,v]) => (
                    <div key={l} style={{background:"#FAFBFC",borderRadius:8,padding:"10px 12px"}}>
                      <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>{l}</div>
                      <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{typeof v==="number" ? `AED ${Number(v).toLocaleString()}` : v}</div>
                    </div>
                  ));
                })()}
              </div>
            </div>
            )}

            {/* Payment Plan Card */}
            {/* 20 May 2026: Hide old Payment Plan + Upfront card */}
            {/* Reason: Card mixes Agency Fee into buyer outflow (Tuesday architectural law violation) */}
            {/* Plan + Upfront content will be wired into dashboard tabs from proposal data (no Agency Fee) */}
            {/* To re-enable: change 'false&&' to just '' or remove it */}
            {false&&unit&&sp&&(
              <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px"}}>
                    {isOffPlan?"🏗️ Off-Plan Payment Plan":isResale?"🔑 Ready / Resale":"🏢 Commercial"} 
                  </div>
                  <span style={{fontSize:11,color:"#718096",background:"#F7F9FC",padding:"3px 10px",borderRadius:10}}>
                    {opp.property_category||"Off-Plan"}
                  </span>
                </div>
                {/* Off-Plan breakdown */}
                {(isOffPlan||(!opp.property_category))&&(
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:12}}>
                      {[
                        ["Asking Price",sp.asking_price?`AED ${Number(sp.asking_price).toLocaleString()}`:"—"],
                        ["Booking",sp.booking_pct?sp.booking_pct+"%":"10%"],
                        ["During Construction",sp.during_construction_pct?sp.during_construction_pct+"%":"—"],
                        ["On Handover",sp.on_handover_pct?sp.on_handover_pct+"%":"—"],
                        ["Post Handover",sp.post_handover_pct>0?sp.post_handover_pct+"%":"—"],
                        ["DLD Fee",sp.dld_fee_pct?sp.dld_fee_pct+"%":"4%"],
                        ["Agency Fee",sp.agency_fee_pct?sp.agency_fee_pct+"%":"2%"],
                        ["OQOOD Fee","AED 4,020"],
                      ].filter(([,v])=>v&&v!=="—").map(([l,v])=>(
                        <div key={l} style={{background:"#F7F9FC",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>{l}</div>
                          <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {sp.asking_price&&(
                      <div style={{background:"#fff",borderRadius:10,padding:"12px 14px"}}>
                        <div style={{fontSize:10,color:"#64748B",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Client Upfront Costs</div>
                        <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                          {[
                            ["Booking Deposit",`AED ${Math.round(sp.asking_price*(sp.booking_pct||10)/100).toLocaleString()}`],
                            ["DLD Fee (4%)",`AED ${Math.round(sp.asking_price*(sp.dld_fee_pct||4)/100).toLocaleString()}`],
                            ["Agency Fee",`AED ${Math.round(sp.asking_price*(sp.agency_fee_pct||2)/100).toLocaleString()}`],
                            ["OQOOD","AED 4,020"],
                            ["Total Upfront",`AED ${(Math.round(sp.asking_price*((sp.booking_pct||10)+(sp.dld_fee_pct||4)+(sp.agency_fee_pct||2))/100)+4020).toLocaleString()}`],
                          ].map(([l,v])=>(
                            <div key={l}>
                              <div style={{fontSize:9,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:".5px"}}>{l}</div>
                              <div style={{fontSize:13,fontWeight:700,color:"#C9A84C"}}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {/* Ready/Resale breakdown */}
                {isResale&&(
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:8,marginBottom:12}}>
                      {[
                        ["Sale Price",sp.asking_price?`AED ${Number(sp.asking_price).toLocaleString()}`:"—"],
                        ["DLD Fee","4%"],
                        ["Agency Fee",sp.agency_fee_pct?sp.agency_fee_pct+"%":"2%"],
                        ["NOC Fee","AED 500–5,000"],
                        ["Trustee Fee","AED 4,200"],
                        ["Mortgage Reg.","0.25% (if financed)"],
                      ].filter(([,v])=>v&&v!=="—").map(([l,v])=>(
                        <div key={l} style={{background:"#F7F9FC",borderRadius:8,padding:"8px 10px"}}>
                          <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>{l}</div>
                          <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{v}</div>
                        </div>
                      ))}
                    </div>
                    {sp.asking_price&&(
                      <div style={{background:"#fff",borderRadius:10,padding:"12px 14px"}}>
                        <div style={{fontSize:10,color:"#64748B",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Client Transfer Costs</div>
                        <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                          {[
                            ["Sale Price",`AED ${Number(sp.asking_price).toLocaleString()}`],
                            ["DLD Fee (4%)",`AED ${Math.round(sp.asking_price*0.04).toLocaleString()}`],
                            ["Agency Fee (2%)",`AED ${Math.round(sp.asking_price*(sp.agency_fee_pct||2)/100).toLocaleString()}`],
                            ["Trustee + NOC","≈ AED 6,000"],
                            ["Total Cost",`AED ${(Math.round(sp.asking_price*1.06)+6000).toLocaleString()}`],
                          ].map(([l,v])=>(
                            <div key={l}>
                              <div style={{fontSize:9,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:".5px"}}>{l}</div>
                              <div style={{fontSize:13,fontWeight:700,color:"#C9A84C"}}>{v}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {/* Commercial */}
                {isCommercial&&(
                  <div style={{fontSize:12,color:"#718096",padding:"8px 0"}}>
                    Commercial transactions follow custom terms. Add notes in the opportunity and track payments in the Payments tab once closed.
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {opp.notes&&(
              <div style={{background:"#F7F9FC",borderRadius:12,padding:"14px 16px",fontSize:12,color:"#4A5568",lineHeight:1.7}}>
                <div style={{fontSize:10,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px",marginBottom:6}}>Notes</div>
                {opp.notes}
              </div>
            )}
          </div>

        {/* ── (Activity Timeline moved up — dense layout) ── */}

      </div>

      {/* Edit Opportunity modal v3 (12 May 2026): includes unit + commission */}
      {showEditOpp && (
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:560,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4"}}>
              <span style={{fontFamily:"'Inter',sans-serif",fontSize:16,fontWeight:700,color:"#0F2540"}}>✏ Edit Opportunity</span>
              <button onClick={()=>setShowEditOpp(false)} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Title</label>
                  <input value={editOppForm.title} onChange={e=>setEditOppForm(f=>({...f,title:e.target.value}))} placeholder="Opportunity title"/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Property Category</label>
                  <select value={editOppForm.property_category} onChange={e=>setEditOppForm(f=>({...f,property_category:e.target.value}))}>
                    <option value="Off-Plan">Off-Plan</option>
                    <option value="Ready / Resale">Ready / Resale</option>
                    <option value="Commercial">Commercial</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Budget (AED)</label>
                  <input type="number" value={editOppForm.budget} onChange={e=>setEditOppForm(f=>({...f,budget:e.target.value}))} placeholder="e.g. 2500000"/>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Linked Unit</label>
                  {/* Show current selection */}
                  {editOppForm.unit_id && (() => {
                    const sel = (units||[]).find(u => u.id === editOppForm.unit_id);
                    if (!sel) return null;
                    const selProj = (projects||[]).find(p => p.id === sel.project_id);
                    const bedLabel = sel.bedrooms === 0 ? "Studio" : (sel.bedrooms ? `${sel.bedrooms}BR` : "");
                    return (
                      <div style={{padding:"8px 12px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:7,marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div>
                          <strong style={{color:"#0C4A6E",fontSize:12}}>{sel.unit_ref}</strong>
                          <span style={{color:"#0369A1",fontSize:11,marginLeft:6}}>· {[bedLabel, selProj?.name, sel.view].filter(Boolean).join(" · ")}</span>
                        </div>
                        <button type="button" onClick={()=>setEditOppForm(f=>({...f,unit_id:""}))} style={{padding:"2px 8px",borderRadius:5,border:"none",background:"#E2E8F0",color:"#64748B",fontSize:10,fontWeight:700,cursor:"pointer"}}>✕ Clear</button>
                      </div>
                    );
                  })()}
                  {/* Search picker (UnitSearchPicker for consistency with proposal builder) */}
                  <UnitSearchPicker
                    units={units || []}
                    projects={projects || []}
                    salePricing={salePricing || []}
onSelect={(unitId) => {
                      setEditOppForm(f => ({...f, unit_id: unitId}));
                    }}
                    placeholder="🔍 Search to change unit — e.g. AGR, Sobha, 2BR, sea view…"
                    emptyMessage="No units available"
                    autoFocus={false}
                    maxHeight={160}
                  />

                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Commission %</label>
                  <input type="number" step="0.01" value={editOppForm.commission_pct} onChange={e=>setEditOppForm(f=>({...f,commission_pct:e.target.value}))} placeholder="e.g. 4"/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Assigned Agent</label>
                  <select value={editOppForm.assigned_to} onChange={e=>setEditOppForm(f=>({...f,assigned_to:e.target.value}))}>
                    <option value="">— Unassigned —</option>
                    {(users||[]).map(u => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                  </select>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label>
                  <textarea value={editOppForm.notes} onChange={e=>setEditOppForm(f=>({...f,notes:e.target.value}))} rows={3} placeholder="Any additional notes about this opportunity"/>
                </div>
              </div>
              <div style={{marginTop:10,padding:"8px 12px",background:"#F1F5F9",border:"1px solid #E2E8F0",borderRadius:8,fontSize:11,color:"#64748B"}}>
                💡 To change stage, use the Deal Journey workflow. Master agreement is auto-detected from the unit.
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0"}}>
              <button onClick={()=>setShowEditOpp(false)} disabled={saving} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>Cancel</button>
              <button onClick={async()=>{
                // Wilderness Part 4: unit switch ceremony (re-point, not clone)
                const unitChanged = editOppForm.unit_id && editOppForm.unit_id !== opp.unit_id;
                const unitCleared = !editOppForm.unit_id && opp.unit_id;
                if (unitCleared && ["Reserved","SPA Requirements","SPA Signed"].includes(opp.stage)) { showToast("⛔ A reserved deal must keep a linked unit - switch to another unit instead of clearing", "error"); return; }
                let switchReason = null;
                if (unitChanged && ["Reserved","SPA Requirements"].includes(opp.stage)) {
                  const clash = (opps||[]).find(o => o.id !== opp.id && o.unit_id === editOppForm.unit_id && o.status === "Active" && ["Reserved","SPA Requirements","SPA Signed"].includes(o.stage));
                  if (clash) { showToast("\u26d4 " + ((units||[]).find(u=>u.id===editOppForm.unit_id)?.unit_ref || "Unit") + " is already held by another active deal (" + (clash.title||"") + ")", "error"); return; }
                  const oldU = (units||[]).find(u=>u.id===opp.unit_id);
                  const newU = (units||[]).find(u=>u.id===editOppForm.unit_id);
                  switchReason = window.prompt("UNIT SWITCH on a reserved deal:\n" + (oldU?.unit_ref||"?") + " -> " + (newU?.unit_ref||"?") + "\n\nMoney collected stays on the deal. Terms will reset (Terms Pending until a new proposal is sent).\n\nReason for the switch (mandatory, audited):");
                  if (switchReason === null || !switchReason.trim()) { return; }
                  switchReason = switchReason.trim();
                }
                setSaving(true);
                try {
                  const _newRef = switchReason ? ((units||[]).find(u=>u.id===editOppForm.unit_id)?.unit_ref) : null;
                  const updates = {
                    title: (_newRef && editOppForm.title && opp.unit_id) ? (editOppForm.title.replace(((units||[]).find(u=>u.id===opp.unit_id)?.unit_ref)||"\u0000", _newRef)) : (editOppForm.title || null),
                    budget: editOppForm.budget ? Number(editOppForm.budget) : null,
                    unit_id: editOppForm.unit_id || null,
                    commission_pct: editOppForm.commission_pct ? Number(editOppForm.commission_pct) : null,
                    notes: editOppForm.notes || null,
                    assigned_to: editOppForm.assigned_to || null,
                    property_category: editOppForm.property_category,
                    updated_at: new Date().toISOString(),
                    ...(switchReason ? { current_agreed_price: null, current_payment_plan_preset: null, current_dld_payer: null, current_dld_split_pct: null } : {}),
                  };
                  const { data, error } = await supabase
                    .from("opportunities")
                    .update(updates)
                    .eq("id", opp.id)
                    .select()
                    .single();
                  if (error) throw error;
                  if (switchReason) {
                    try {
                      await supabase.from("project_units").update({ status: "Available" }).eq("id", opp.unit_id);
                      await supabase.from("project_units").update({ status: "Reserved" }).eq("id", editOppForm.unit_id);
                      const oldU = (units||[]).find(u=>u.id===opp.unit_id);
                      const newU = (units||[]).find(u=>u.id===editOppForm.unit_id);
                      await supabase.from("activities").insert({
                        opportunity_id: opp.id, lead_id: opp.lead_id, company_id: opp.company_id || currentUser.company_id || null,
                        type: "Note", status: "completed", user_id: currentUser.id, user_name: currentUser.full_name || null,
                        lead_name: lead?.name || null, stage_at_event: opp.stage, activity_subtype: "unit_switched",
                        note: "UNIT SWITCHED: " + (oldU?.unit_ref||"?") + " -> " + (newU?.unit_ref||"?") + " (money stays on deal; terms reset to pending) - reason: " + switchReason,
                      });
                    } catch (se) { console.error("switch extras failed:", se); }
                  }
                  if (onUpdated) onUpdated(data);
                  showToast(switchReason ? "Unit switched - terms reset, send a new proposal" : "Opportunity updated", "success");
                  setShowEditOpp(false);
                } catch (e) {
                  console.error("Edit opp save failed:", e);
                  showToast(e.message || "Update failed", "error");
                } finally {
                  setSaving(false);
                }
              }} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Activity Modal */}
      

      {/* Reassign Modal */}
      {showReassign&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1200,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:460,maxWidth:"100%",boxShadow:"0 20px 60px rgba(11,31,58,.25)"}}>
            <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #E8EDF4",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#0F2540",letterSpacing:"-.3px"}}>🔄 Reassign Opportunity</div>
                <div style={{fontSize:12,color:"#94A3B8",marginTop:2}}>This action will be logged in the activity trail</div>
              </div>
              <button onClick={()=>setShowReassign(false)} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.25rem 1.5rem",display:"flex",flexDirection:"column",gap:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Assign To *</label>
                <select value={reassignForm.assigned_to} onChange={e=>setReassignForm(f=>({...f,assigned_to:e.target.value}))}>
                  <option value="">Select agent…</option>
                  {users?.filter(u=>u.is_active&&u.id!==opp.assigned_to).map(u=>(
                    <option key={u.id} value={u.id}>{u.full_name} — {u.role?.replace("_"," ")}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Reason for Reassignment *</label>
                <textarea rows={3} placeholder="Why is this deal being reassigned? This will be logged for audit purposes." value={reassignForm.reason} onChange={e=>setReassignForm(f=>({...f,reason:e.target.value}))}/>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8,borderTop:"1px solid #F1F5F9"}}>
                <button onClick={()=>setShowReassign(false)} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>Cancel</button>
                <button onClick={async()=>{
                  if(!reassignForm.assigned_to){showToast("Please select an agent","error");return;}
                  if(!reassignForm.reason?.trim()){showToast("Please provide a reason","error");return;}
                  const prevAgent = users?.find(u=>u.id===opp.assigned_to)?.full_name||"unknown";
                  const newAgent = users?.find(u=>u.id===reassignForm.assigned_to)?.full_name||"unknown";
                  const{error}=await supabase.from("opportunities").update({assigned_to:reassignForm.assigned_to}).eq("id",opp.id);
                  if(error){showToast(error.message,"error");return;}
                  // Log the reassignment
                  await supabase.from("activities").insert({
                    lead_id:opp.lead_id, company_id:currentUser.company_id||null,
                    type:"Note", status:"completed",
                    note:`Deal reassigned from ${prevAgent} to ${newAgent}. Reason: ${reassignForm.reason}`,
                    created_by:currentUser.id, opportunity_id:opp.id,
                  });
                  onUpdated({...opp,assigned_to:reassignForm.assigned_to});
                  showToast(`Deal reassigned to ${newAgent}`,"success");
                  setShowReassign(false);
                  if(reassignForm.assigned_to===currentUser.id) setTookOwnership(true);
                }}
                  style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  Confirm Reassignment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase E W1 — Stage Capture Dialog (Contacted, Site Visit, Proposal Sent, Negotiation) */}
      <StageCaptureDialog
        open={!!showCaptureDialog}
        opp={opp}
        lead={lead}
        units={units}
        projects={projects}
        salePricing={salePricing}
        fromStage={opp.stage}
        toStage={showCaptureDialog}
        currentUser={currentUser}
        showToast={showToast}
        onCancel={()=>{setShowCaptureDialog(null); if(coachReturn){setDashboardTab("coach");setCoachReturn(false);}}}
        onSave={(result)=>{
          setShowCaptureDialog(null);
          // Refresh activities timeline
          supabase.from("activities").select("*").eq("opportunity_id",opp.id).order("created_at",{ascending:false}).then(({data})=>setActivities(data||[]));
          // Update parent opp state
          onUpdated({...opp, stage: result.stage, stage_updated_at: new Date().toISOString()});
          if(coachReturn){setDashboardTab("coach");setCoachReturn(false);}
        }}
      />

      {/* Phase E W2 — Visit Outcome Dialog */}
      {visitOutcomeFor && (
        <VisitOutcomeDialog
          visitActivity={visitOutcomeFor}
          opp={opp} lead={lead}
          units={units} projects={projects}
          currentUser={currentUser}
          onClose={()=>{
            setVisitOutcomeFor(null);
            // If user backed out of the outcome capture but came from the guard,
            // re-open the guard so the open item is still visible
            if (visitOutcomeReturnsToGuard) {
              setVisitOutcomeReturnsToGuard(false);
              setShowOpenItemsGuard(true);
            }
          }}
          onSaved={(updatedRow, reminder)=>{
            // Replace the upcoming activity with the completed version
            setActivities(p=>p.map(a => a.id===updatedRow.id ? updatedRow : a));
            if(reminder) setReminders(p=>[...p, reminder].sort((a,b)=>new Date(a.trigger_at)-new Date(b.trigger_at)));
            // Also remove any pending visit-imminent reminder from the panel state
            setReminders(p=>p.filter(r => !(r.related_activity_id===updatedRow.id && r.reason==="auto_visit_imminent")));
            showToast("Visit outcome captured","success");
            setVisitOutcomeFor(null);
            // If we came from the guard, re-open it. Its useEffect will detect
            // that there are no more open items and auto-trigger onAllClosed,
            // which opens the proposal builder.
            if (visitOutcomeReturnsToGuard) {
              setVisitOutcomeReturnsToGuard(false);
              setShowOpenItemsGuard(true);
            }
          }}
          showToast={showToast}
        />
      )}

      {/* Phase E W3 — Open Items Guard (must close pending Site Visits before sending proposal) */}
      {showOpenItemsGuard && (
        <OpenItemsGuard
          opp={opp} lead={lead}
          activities={activities}
          units={units} projects={projects}
          currentUser={currentUser}
          onCancel={()=>setShowOpenItemsGuard(false)}
          onAllClosed={()=>{
            setShowOpenItemsGuard(false);
            setShowProposalDialog(true);
          }}
          onCaptureVisit={(visitActivity)=>{
            // Hand off to the existing Visit Outcome dialog. When it saves,
            // activities refreshes and the guard auto-detects the loop is closed.
            setShowOpenItemsGuard(false);
            setVisitOutcomeReturnsToGuard(true);
            setVisitOutcomeFor(visitActivity);
          }}
          refreshActivities={()=>{
            supabase.from("activities").select("*").eq("opportunity_id",opp.id).order("created_at",{ascending:false}).then(({data})=>setActivities(data||[]));
          }}
          showToast={showToast}
        />
      )}

      {/* Phase E W3 — Proposal Viewer Dialog (read-only) */}
      {viewingProposal && (
        <ProposalViewerDialog
          proposal={viewingProposal}
          opp={opp} lead={lead}
          units={units} projects={projects}
          currentUser={currentUser}
          onClose={()=>setViewingProposal(null)}
          showToast={showToast}
        />
      )}

      {/* Phase E W3 — Proposal Builder Dialog */}
      {showProposalDialog && (
        <ProposalBuilderDialog
          opp={opp} lead={lead}
          units={units} projects={projects} salePricing={salePricing}
          currentUser={currentUser}
          lastProposal={proposals[0]}
          onClose={()=>{setShowProposalDialog(false); if(coachReturn){setDashboardTab("coach");setCoachReturn(false);}}}
          onSaved={(propRow, actRow)=>{
            // Mark previous "sent" proposals as "superseded" since this is a revision
            setProposals(prev => prev.some(r => r.id === propRow.id) ? prev.map(p => p.id === propRow.id ? propRow : (p.status==="sent" ? {...p, status:"superseded"} : p)) : [propRow, ...prev.map(p => p.status==="sent" ? {...p, status:"superseded"} : p)]);
            if(actRow) setActivities(p=> p.some(r=>r.id===actRow.id) ? p : [actRow, ...p]);
            // Refresh reminders so the new follow-up + expiry reminders show in the strip
            supabase.from("reminders").select("*").eq("related_opportunity_id",opp.id).eq("status","pending").order("trigger_at",{ascending:true}).then(({data})=>setReminders(data||[]));
            // Stamp proposal_sent_at locally (stage stays as-is — agent decides when to move)
            const _pterms = propRow?.structured_data || {};
            onUpdated({...opp, proposal_sent_at: new Date().toISOString(),
              current_agreed_price: _pterms.discounted_price || _pterms.asking_price || opp.current_agreed_price,
              current_dld_payer: _pterms.dld_handling === "split_5050" ? "split" : (_pterms.dld_handling === "developer_absorbs" ? "developer" : (_pterms.dld_handling ? "buyer" : opp.current_dld_payer)),
            });
            setShowProposalDialog(false);
            if(coachReturn){setDashboardTab("coach");setCoachReturn(false);}
          }}
          showToast={showToast}
        />
      )}

      {/* Phase E W2 — Log Negotiation Round Dialog */}
      {showLogRound && (()=>{
        const close = ()=>setShowLogRound(false);
        // 21 May 2026 Phase A: Find last negotiation round for pre-fill
        // Activities are sorted newest-first, so .find() returns the most recent.
        const lastRound = activities.find(a => a.activity_subtype === "negotiation_round");
        return (
          <NegotiationRoundDialog
            opp={opp} lead={lead} currentUser={currentUser}
            lastRound={lastRound}
            onClose={close}
            onSaved={(actRow)=>{
              setActivities(p=>[actRow, ...p]);
              showToast("Round logged","success");
              close();
            }}
            showToast={showToast}
          />
        );
      })()}

      {/* Phase E W2 — Schedule Handover Meeting Dialog */}
      {showHandover && (()=>{
        const close = ()=>setShowHandover(false);
        return (
          <HandoverMeetingDialog
            opp={opp} lead={lead} currentUser={currentUser}
            onClose={close}
            onSaved={(actRow, reminder)=>{
              setActivities(p=>[actRow, ...p]);
              if(reminder) setReminders(p=>[...p, reminder].sort((a,b)=>new Date(a.trigger_at)-new Date(b.trigger_at)));
              showToast("Handover meeting scheduled","success");
              close();
            }}
            showToast={showToast}
          />
        );
      })()}

      {/* Phase E W3 — Reminder Action Dialog (Done / Reschedule / Cancel) */}
      {remAction && (()=>{
        const meta = {
          done:      {title:"✓ Mark as Done",      subtitle:"Capture what actually happened.",        accent:"#1A7F5A", btn:"Mark Done",   noteLabel:"What happened?",          notePh:"e.g. Spoke to him, confirmed Sunday viewing at 11am",   noteRequired:true,  showDate:false},
          reschedule:{title:"📅 Reschedule",        subtitle:"Move this reminder to a new date.",      accent:"#1A5FA8", btn:"Reschedule",  noteLabel:"Reason (optional)",       notePh:"e.g. Customer is traveling until Tuesday",              noteRequired:false, showDate:true },
          cancel:    {title:"✕ Cancel Reminder",    subtitle:"This is recorded — no silent deletion.", accent:"#C53030", btn:"Cancel It",   noteLabel:"Why are you cancelling?", notePh:"e.g. Customer went silent after 3 attempts, dropping",  noteRequired:true,  showDate:false},
        }[remAction.mode];
        const close = ()=>setRemAction(null);
        const submit = async()=>{
          const noteTrim = (remAction.note||"").trim();
          if(meta.noteRequired && !noteTrim){
            showToast(`Please ${remAction.mode==="cancel"?"give a reason":"describe what happened"}`,"error");
            return;
          }
          if(meta.showDate){
            const newDate = new Date(remAction.date);
            if(isNaN(newDate.getTime())){showToast("Pick a valid date","error");return;}
          }
          setSaving(true);
          try{
            const rem = remAction.reminder;
            if(remAction.mode==="reschedule"){
              const newDate = new Date(remAction.date);
              newDate.setHours(9,0,0,0);
              const ok = await updateReminderStatus(rem.id,"pending",{trigger_at:newDate.toISOString()});
              if(!ok){setSaving(false);return;}
              // Drop a small activity note so the trail shows the move
              const{data:actRow}=await supabase.from("activities").insert({
                opportunity_id:opp.id, lead_id:lead.id, company_id:opp.company_id||currentUser.company_id||null,
                type:"Note",
                note:`📅 Rescheduled: "${rem.title}" → ${newDate.toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}${noteTrim?` — ${noteTrim}`:""}`,
                status:"completed", user_id:currentUser.id, user_name:currentUser.full_name, lead_name:lead.name,
                stage_at_event:opp.stage, activity_subtype:"reminder_rescheduled",
              }).select().single();
              if(actRow) setActivities(p=>[actRow,...p]);
              showToast("Reminder rescheduled","success");
            } else if(remAction.mode==="done"){
              const ok = await updateReminderStatus(rem.id,"completed");
              if(!ok){setSaving(false);return;}
              const{data:actRow}=await supabase.from("activities").insert({
                opportunity_id:opp.id, lead_id:lead.id, company_id:opp.company_id||currentUser.company_id||null,
                type:"Note",
                note:`✓ Completed: ${rem.title}\n\n${noteTrim}`,
                status:"completed", user_id:currentUser.id, user_name:currentUser.full_name, lead_name:lead.name,
                stage_at_event:opp.stage, activity_subtype:"reminder_completed",
              }).select().single();
              if(actRow) setActivities(p=>[actRow,...p]);
              showToast("Marked as done","success");
            } else if(remAction.mode==="cancel"){
              const ok = await updateReminderStatus(rem.id,"cancelled");
              if(!ok){setSaving(false);return;}
              const{data:actRow}=await supabase.from("activities").insert({
                opportunity_id:opp.id, lead_id:lead.id, company_id:opp.company_id||currentUser.company_id||null,
                type:"Note",
                note:`✕ Cancelled: ${rem.title}\nReason: ${noteTrim}`,
                status:"completed", user_id:currentUser.id, user_name:currentUser.full_name, lead_name:lead.name,
                stage_at_event:opp.stage, activity_subtype:"reminder_cancelled",
              }).select().single();
              if(actRow) setActivities(p=>[actRow,...p]);
              showToast("Reminder cancelled","success");
            }
            close();
          } catch(e){
            console.error("Reminder action failed:", e);
            showToast(`Failed: ${e.message||"unknown error"}`,"error");
          } finally {
            setSaving(false);
          }
        };
        return (
          <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
            <div style={{background:"#fff",borderRadius:16,width:520,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
              <div style={{padding:"1.1rem 1.4rem",borderBottom:"1px solid #E8EDF4",background:"#0F2540"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                  <div>
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#fff"}}>{meta.title}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.65)",marginTop:3}}>{meta.subtitle}</div>
                  </div>
                  <button onClick={close} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer",lineHeight:1}}>×</button>
                </div>
              </div>
              <div style={{padding:"1.1rem 1.4rem",flex:1,overflowY:"auto"}}>
                {/* Reminder context — read-only */}
                <div style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8,padding:"10px 12px",marginBottom:14}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>Reminder</div>
                  <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{remAction.reminder.title}</div>
                  {remAction.reminder.body && <div style={{fontSize:12,color:"#64748B",marginTop:3,fontStyle:"italic"}}>{remAction.reminder.body}</div>}
                  <div style={{fontSize:11,color:"#94A3B8",marginTop:4}}>
                    Originally due: {new Date(remAction.reminder.trigger_at).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}
                  </div>
                </div>

                {meta.showDate && (
                  <div style={{marginBottom:14}}>
                    <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>
                      New due date *
                    </label>
                    <input type="date" value={remAction.date}
                      onChange={e=>setRemAction(a=>({...a,date:e.target.value}))}
                      style={{padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",background:"#fff"}}/>
                  </div>
                )}

                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>
                    {meta.noteLabel}{meta.noteRequired&&<span style={{color:"#C53030"}}> *</span>}
                  </label>
                  <textarea value={remAction.note}
                    onChange={e=>setRemAction(a=>({...a,note:e.target.value}))}
                    placeholder={meta.notePh} rows={4}
                    style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
                  <div style={{fontSize:10,color:"#94A3B8",marginTop:4}}>
                    This will be saved permanently to the activity timeline.
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.4rem",borderTop:"1px solid #E8EDF4",background:"#F8FAFC"}}>
                <button onClick={close} disabled={saving}
                  style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
                  Back
                </button>
                <button onClick={submit} disabled={saving}
                  style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#94A3B8":meta.accent,color:"#fff",fontSize:13,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
                  {saving ? "Saving…" : meta.btn}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Stage Gate Modal */}
      {showStageGate&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1200,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:1080,maxWidth:"97vw",maxHeight:"96vh",overflow:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.25)"}}>
            <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #E8EDF4",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#0F2540",letterSpacing:"-.3px"}}>
                  {showStageGate==="Offer Accepted"&&"✅ Record Offer Accepted"}
                  {showStageGate==="Reserved"&&"🔒 Record Reservation"}
                  {showStageGate==="SPA Signed"&&"📄 Record SPA Signing"}
                  {showStageGate === "SPA Signed" && <span style={{marginLeft:10,display:"inline-flex",gap:4}}><button onClick={()=>setSpaMode("quick")} style={{fontSize:10,fontWeight:700,padding:"2px 10px",borderRadius:14,cursor:"pointer",border:"1.5px solid "+(spaMode==="quick"?"#0F2540":"#E2E8F0"),background:spaMode==="quick"?"#0F2540":"#fff",color:spaMode==="quick"?"#fff":"#64748B"}}>{"\u26a1 Quick"}</button><button onClick={()=>setSpaMode("detailed")} style={{fontSize:10,fontWeight:700,padding:"2px 10px",borderRadius:14,cursor:"pointer",border:"1.5px solid "+(spaMode==="detailed"?"#0F2540":"#E2E8F0"),background:spaMode==="detailed"?"#0F2540":"#fff",color:spaMode==="detailed"?"#fff":"#64748B"}}>{"\ud83d\udccb Detailed"}</button></span>}
                  {showStageGate==="Closed Won"&&"🏆 Close as Won"}
                  {showStageGate==="Closed Lost"&&"❌ Close as Lost"}
                </div>
                {/* Bug 2 fix (12 May 2026): show buyer + unit context for stage dialogs */}
                <div style={{fontSize:12,color:"#475569",marginTop:2,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  {lead?.name && <strong style={{color:"#0F2540"}}>{lead.name}</strong>}
                  {(() => {
                    const linkedUnit = (units||[]).find(u => u.id === opp.unit_id);
                    return linkedUnit?.unit_ref ? (
                      <span style={{padding:"2px 8px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:5,color:"#0C4A6E",fontSize:11,fontWeight:700}}>🏠 {linkedUnit.unit_ref}</span>
                    ) : null;
                  })()}
                  {opp.title && <span style={{fontSize:11,color:"#94A3B8"}}>· {opp.title}</span>}
                </div>
              </div>
              <button onClick={()=>setShowStageGate(null)} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>×</button>
            </div>

            <div style={{padding:"1.25rem 1.5rem",display:"flex",flexDirection:"column",gap:14}}>
              <fieldset disabled={stageGateViewMode} style={{border:"none",padding:0,margin:0,display:"flex",flexDirection:"column",gap:14,minWidth:0}}>

              {/* OFFER ACCEPTED fields */}
              {showStageGate==="Offer Accepted"&&(<>
                {/* Pricing breakdown - read only */}
                {/* 13 May 2026: Unit Asking Price now sources from salePricing (the unit's actual price), */}
                {/* not opp.budget (the buyer's budget - different concept). */}
                {(() => {
                  const unitPrice = (salePricing || []).find(s => s.unit_id === opp.unit_id)?.asking_price;
                  const basePrice = Number(unitPrice || opp.budget || 0);
                  return null;
                })()}
                <div style={{background:"#F7F9FC",border:"1px solid #E8EDF4",borderRadius:10,padding:"14px 16px"}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>Agreed Pricing</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                    <div>
                      <div style={{fontSize:10,color:"#94A3B8",marginBottom:3}}>Unit Asking Price</div>
                      <div style={{fontSize:14,fontWeight:700,color:"#0F2540"}}>AED {(() => { const up=(salePricing||[]).find(s=>s.unit_id===opp.unit_id)?.asking_price; const bp=Number(up||opp.budget||0); return bp > 0 ? bp.toLocaleString() : "—"; })()}</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:"#94A3B8",marginBottom:3}}>Approved Discount</div>
                      <div style={{fontSize:14,fontWeight:700,color:"#B83232"}}>{(() => {
                        // 15 May 2026: Read from current_* fields (single source of truth from proposal V3+)
                        const discType = opp.current_discount_type || (opp.discount_pct ? 'percent' : null);
                        const discValue = opp.current_discount_value || opp.discount_pct;
                        if (!discValue || discValue <= 0) return "None";
                        if (discType === 'percent') return `${discValue}%`;
                        if (discType === 'amount') return `AED ${Number(discValue).toLocaleString()}`;
                        return `${discValue}%`; // fallback
                      })()}</div>
                    </div>
                    <div>
                      <div style={{fontSize:10,color:"#94A3B8",marginBottom:3}}>Net Offer Price</div>
                      <div style={{fontSize:14,fontWeight:700,color:"#1A7F5A"}}>
                        AED {(() => {
                          // 15 May 2026: current_agreed_price is PRIMARY (already includes discount math)
                          // Fallback to old computation only if current_agreed_price not set
                          if (opp.current_agreed_price && Number(opp.current_agreed_price) > 0) {
                            return Number(opp.current_agreed_price).toLocaleString();
                          }
                          const up=(salePricing||[]).find(s=>s.unit_id===opp.unit_id)?.asking_price;
                          const bp=Number(up||opp.budget||0);
                          if(bp<=0) return "—";
                          const netP=opp.discount_pct?bp*(1-opp.discount_pct/100):bp;
                          return Number(netP).toLocaleString();
                        })()}
                      </div>
                    </div>
                  </div>
                  {(opp.current_discount_value||opp.discount_pct)&&<div style={{marginTop:8,fontSize:11,color:"#64748B"}}>Discount source: <strong>{opp.current_discount_source||opp.discount_source||"Not specified"}</strong></div>}

                  {/* STAGE GATE 4 (11 May 2026): Price override toggle + warning */}
                  {/* 13 May 2026: Base price now sources from salePricing (unit price) instead of opp.budget */}
                  {(() => {
                    // 15 May 2026: Use current_agreed_price as PRIMARY (already discounted)
                    const unitAskingPrice = (salePricing || []).find(s => s.unit_id === opp.unit_id)?.asking_price;
                    const basePrice = Number(unitAskingPrice || opp.budget || 0);
                    const calculatedPrice = Number(opp.current_agreed_price) > 0
                      ? Number(opp.current_agreed_price)
                      : (basePrice > 0 ? Number(opp.discount_pct ? basePrice*(1-opp.discount_pct/100) : basePrice) : 0);
                    const overridePrice = Number(stageGateForm.offer_price_override || 0);
                    const showOverride = stageGateForm.show_price_override;
                    const isChanged = showOverride && overridePrice > 0 && overridePrice !== calculatedPrice;
                    const commPct = Number(opp.commission_pct || 0);
                    const originalCommission = Math.round(calculatedPrice * commPct / 100);
                    const newCommission = Math.round(overridePrice * commPct / 100);
                    const commissionDiff = newCommission - originalCommission;
                    return (
                      <div style={{marginTop:12,paddingTop:12,borderTop:"1px dashed #E2E8F0"}}>
                        {!showOverride ? (
                          <button type="button"
                            onClick={()=>setStageGateForm(f=>({...f, show_price_override:true, offer_price_override:String(calculatedPrice)}))}
                            style={{padding:"5px 10px",borderRadius:5,border:"1px solid #F59E0B",background:"#FFFBEB",color:"#92400E",fontSize:10,fontWeight:700,cursor:"pointer",textTransform:"uppercase",letterSpacing:".4px"}}>
                            ⚠️ Override Price (negotiated separately)
                          </button>
                        ) : (
                          <div>
                            <div style={{fontSize:10,fontWeight:700,color:"#92400E",textTransform:"uppercase",letterSpacing:".4px",marginBottom:6}}>⚠️ Price Override Mode</div>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                              <label style={{fontSize:11,color:"#64748B",whiteSpace:"nowrap"}}>Override AED:</label>
                              <input type="number" min="0" step="1000"
                                value={stageGateForm.offer_price_override||""}
                                onChange={e=>setStageGateForm(f=>({...f, offer_price_override:e.target.value}))}
                                style={{padding:"4px 8px",borderRadius:5,border:"1.5px solid #F59E0B",fontSize:12,fontWeight:700,color:"#92400E",width:140}}/>
                              <button type="button"
                                onClick={()=>setStageGateForm(f=>({...f, show_price_override:false, offer_price_override:""}))}
                                style={{padding:"4px 10px",borderRadius:5,border:"1px solid #E2E8F0",background:"#fff",color:"#64748B",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                                Cancel
                              </button>
                            </div>
                            {isChanged && (
                              <div style={{padding:"10px 12px",background:"linear-gradient(135deg,#FEF3C7,#FDE68A)",border:"1px solid #F59E0B",borderRadius:8,fontSize:11,color:"#78350F"}}>
                                <div style={{fontWeight:700,marginBottom:4,fontSize:12}}>⚠️ Commission Impact Warning</div>
                                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4,fontSize:11}}>
                                  <div>Calculated: AED {calculatedPrice.toLocaleString()}</div>
                                  <div>Override: AED {overridePrice.toLocaleString()}</div>
                                  {commPct > 0 && (<>
                                    <div>Original comm @ {commPct}%: AED {originalCommission.toLocaleString()}</div>
                                    <div style={{fontWeight:700,color:commissionDiff<0?"#B83232":"#1A7F5A"}}>
                                      New comm: AED {newCommission.toLocaleString()} ({commissionDiff>=0?"+":""}{commissionDiff.toLocaleString()})
                                    </div>
                                  </>)}
                                </div>
                                <div style={{marginTop:6,fontWeight:600}}>
                                  Confirm this price matches developer's authorization. Your broker license depends on accurate price tracking.
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
                {INTERNAL_APPROVAL_FEATURES_ENABLED && (
                  <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#92400E"}}>
                    ℹ Price is based on approved inventory pricing. To request a discount, use the <strong>💰 Request Discount</strong> button in the Financials section first.
                  </div>
                )}
                {/* 19 May 2026 Issue 4: Show DLD + Payment Plan + Total Expected + Confirmation checkbox */}
                {/* Per founder: "very simple - 1 checkbox - all collected = ready to advance" */}
                {(opp.current_dld_payer || opp.current_payment_plan_preset) && (() => {
                  // Math reused from SPA dialog calculation logic
                  const PLAN_INITIAL_PCT = {
                    "10/90": 10, "20/80": 20, "50/50 PHP": 50, "40/60": 40,
                  };
                  const price = Number(opp.current_agreed_price || 0);
                  const planPct = PLAN_INITIAL_PCT[opp.current_payment_plan_preset] || null;
                  const initialAdvance = planPct ? Math.round(price * planPct / 100) : 0;
                  // DLD calculation - buyer's share
                  const dldTotal = Math.round(price * 0.04);
                  let buyerDldShare = 0;
                  if (opp.current_dld_payer === "buyer") {
                    buyerDldShare = dldTotal;
                  } else if (opp.current_dld_payer === "split" && opp.current_dld_split_pct) {
                    buyerDldShare = Math.round(dldTotal * Number(opp.current_dld_split_pct) / 100);
                  } else if (opp.current_dld_payer === "negotiated") {
                    buyerDldShare = 0; // Treated as TBD, shown for awareness
                  }
                  const totalExpected = initialAdvance + buyerDldShare;
                  return (
                    <div style={{background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:10,padding:"14px 16px"}}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"3px 9px",background:"#ECFDF5",border:"1px solid #6EE7B7",borderRadius:12,fontSize:10,color:"#065F46",fontWeight:600,marginBottom:10}}>
                        ✅ Pre-filled from Final Proposal
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                        {opp.current_dld_payer && (
                          <div>
                            <div style={{fontSize:10,color:"#64748B",marginBottom:3,textTransform:"uppercase",letterSpacing:".5px",fontWeight:700}}>DLD Fee Arrangement</div>
                            <div style={{fontSize:13,fontWeight:700,color:"#0C4A6E"}}>
                              {opp.current_dld_payer === "buyer" && "🟢 Buyer pays"}
                              {opp.current_dld_payer === "developer" && "🟣 Developer absorbs"}
                              {opp.current_dld_payer === "negotiated" && "🟡 Negotiated"}
                              {opp.current_dld_payer === "split" && (
                                <span>🔵 Split{opp.current_dld_split_pct ? ` ${opp.current_dld_split_pct}/${100-opp.current_dld_split_pct}` : ""}</span>
                              )}
                            </div>
                          </div>
                        )}
                        {opp.current_payment_plan_preset && (
                          <div>
                            <div style={{fontSize:10,color:"#64748B",marginBottom:3,textTransform:"uppercase",letterSpacing:".5px",fontWeight:700}}>Payment Plan</div>
                            <div style={{fontSize:13,fontWeight:700,color:"#0C4A6E"}}>
                              📅 {opp.current_payment_plan_preset}
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Total Expected calculation - the SPA math but BEFORE SPA */}
                      <div style={{background:"#fff",border:"1px solid #BAE6FD",borderRadius:8,padding:"10px 12px",marginBottom:10}}>
                        <div style={{fontSize:10,color:"#64748B",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px",fontWeight:700}}>
                          📊 Total Expected to be Collected (Pre-SPA)
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#475569",marginBottom:3}}>
                          <span>Initial Advance ({planPct || "—"}% per plan)</span>
                          <span style={{fontWeight:600}}>AED {initialAdvance.toLocaleString()}</span>
                        </div>
                        {opp.current_dld_payer === "buyer" && (
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#475569",marginBottom:3}}>
                            <span>Buyer DLD share (4% full)</span>
                            <span style={{fontWeight:600}}>AED {buyerDldShare.toLocaleString()}</span>
                          </div>
                        )}
                        {opp.current_dld_payer === "split" && (
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#475569",marginBottom:3}}>
                            <span>Buyer DLD share ({opp.current_dld_split_pct}% of 4%)</span>
                            <span style={{fontWeight:600}}>AED {buyerDldShare.toLocaleString()}</span>
                          </div>
                        )}
                        {opp.current_dld_payer === "developer" && (
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#7C3AED",marginBottom:3}}>
                            <span>Buyer DLD share</span>
                            <span style={{fontWeight:600}}>Developer absorbs (AED 0)</span>
                          </div>
                        )}
                        <div style={{borderTop:"1px solid #E2E8F0",marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between",fontSize:13,color:"#0F2540",fontWeight:700}}>
                          <span>Total Expected:</span>
                          <span>AED {totalExpected.toLocaleString()}</span>
                        </div>
                        <div style={{fontSize:9,color:"#94A3B8",marginTop:4,fontStyle:"italic"}}>
                          Note: Developer service charges, admin fees, and registration are collected separately by the developer
                        </div>
                      </div>
                      {/* The single confirmation checkbox - gates advance */}
                      <div style={{padding:"9px 12px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:8,fontSize:11,color:"#0C4A6E"}}>{"\u2139\ufe0f This records the buyer acceptance of the offer terms. Collections are tracked at SPA Requirements - no payment confirmation needed here."}</div>
                    </div>
                  );
                })()}
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Offer Valid Until</label>
                  <input type="date" value={stageGateForm.offer_valid_until||""} onChange={e=>setStageGateForm(f=>({...f,offer_valid_until:e.target.value}))}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label>
                  <textarea rows={2} placeholder="Any conditions or notes on the offer…" value={stageGateForm.notes||""} onChange={e=>setStageGateForm(f=>({...f,notes:e.target.value}))}/>
                </div>
              </>)}

              {/* RESERVED fields */}
              {showStageGate==="Reserved"&&(<>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Reservation Fee (AED) *</label>
                    <input type="number" placeholder="e.g. 10000" value={stageGateForm.reservation_fee||""} onChange={e=>setStageGateForm(f=>({...f,reservation_fee:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Payment Method *</label>
                    <select value={stageGateForm.payment_method||"Cheque"} onChange={e=>setStageGateForm(f=>({...f,payment_method:e.target.value}))}>
                      {["Cheque","Bank Transfer","Cash","Credit Card"].map(m=><option key={m}>{m}</option>)}
                    </select>
                  </div>
                  {(stageGateForm.payment_method==="Cheque"||!stageGateForm.payment_method)&&(
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Cheque Number</label>
                      <input placeholder="e.g. 001234" value={stageGateForm.cheque_number||""} onChange={e=>setStageGateForm(f=>({...f,cheque_number:e.target.value}))}/>
                    </div>
                  )}
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Reservation Date</label>
                    <input type="date" value={stageGateForm.reservation_date||new Date().toISOString().slice(0,10)} onChange={e=>setStageGateForm(f=>({...f,reservation_date:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Expires (5 working days)</label>
                    <input type="date" value={stageGateForm.expires_date||addWorkingDays(new Date(),5).toISOString().slice(0,10)} onChange={e=>setStageGateForm(f=>({...f,expires_date:e.target.value}))}/>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label>
                  <textarea rows={2} placeholder="Any conditions on the reservation…" value={stageGateForm.notes||""} onChange={e=>setStageGateForm(f=>({...f,notes:e.target.value}))}/>
                </div>
              </>)}

              {/* SPA SIGNED fields */}
              {showStageGate==="SPA Signed"&&(<>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Final Agreed Price (AED) *</label>
                    <input type="number" placeholder="e.g. 2450000" value={stageGateForm.final_price||""} onChange={e=>setStageGateForm(f=>({...f,final_price:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>SPA Signing Date *</label>
                    <input type="date" value={stageGateForm.spa_date||new Date().toISOString().slice(0,10)} onChange={e=>setStageGateForm(f=>({...f,spa_date:e.target.value}))}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>SPA / Oqood Reference</label>
                    <input type="text" placeholder="e.g. DLD-2026-12345" value={stageGateForm.spa_ref||""} onChange={e=>setStageGateForm(f=>({...f,spa_ref:e.target.value}))}/>
                  </div>
                  <div>
                    {/* 18 May 2026: Removed Down Payment input - same as Initial Advance.
                        Enter amount in initial_advance row of Pre-SPA Payments below. */}
                  </div>
                </div>

                {/* SPA Document upload */}
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>SPA Document (PDF/JPG/PNG)</label>
                  {stageGateForm.spa_document_path ? (
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#F0FDF4",border:"1px solid #86EFAC",borderRadius:8}}>
                      <span style={{fontSize:18}}>📄</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:"#166534",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{stageGateForm.spa_document_filename}</div>
                        <div style={{fontSize:10,color:"#16A34A"}}>✓ Uploaded</div>
                      </div>
                      <button type="button" onClick={()=>viewSpaDocument(stageGateForm.spa_document_path)} style={{padding:"4px 10px",background:"#fff",border:"1px solid #86EFAC",borderRadius:5,fontSize:11,fontWeight:600,color:"#166534",cursor:"pointer"}}>View</button>
                      <button type="button" onClick={()=>setStageGateForm(f=>({...f,spa_document_path:null,spa_document_filename:null}))} style={{padding:"4px 10px",background:"#fff",border:"1px solid #FCA5A5",borderRadius:5,fontSize:11,fontWeight:600,color:"#991B1B",cursor:"pointer"}}>Remove</button>
                    </div>
                  ) : (
                    <label style={{display:"block",padding:"14px",background:spaUploading?"#FEF6E0":"#FAFBFC",border:`1.5px dashed ${spaUploading?"#E5C870":"#CBD5E0"}`,borderRadius:8,textAlign:"center",cursor:spaUploading?"wait":"pointer"}}>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e=>{if(e.target.files?.[0])uploadSpaDocument(e.target.files[0]);e.target.value="";}} disabled={spaUploading} style={{display:"none"}}/>
                      {spaUploading ? (
                        <span style={{fontSize:12,color:"#7A5C0E",fontWeight:600}}>⏳ Uploading...</span>
                      ) : (
                        <span style={{fontSize:12,color:"#0F2540",fontWeight:600}}>📤 Click to upload SPA · Max 10MB</span>
                      )}
                    </label>
                  )}
                  {spaUploadError && (
                    <div style={{marginTop:6,fontSize:11,color:"#991B1B"}}>⚠️ {spaUploadError}</div>
                  )}
                </div>

                {spaMode === "detailed" && (<div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Initial Advance Method</label>
                  <select value={stageGateForm.down_payment_method||"Cheque"} onChange={e=>setStageGateForm(f=>({...f,down_payment_method:e.target.value}))}>
                    {["Cheque","Bank Transfer","Cash","Credit Card"].map(m=><option key={m}>{m}</option>)}
                  </select>
                  <div style={{fontSize:10,color:"#94A3B8",marginTop:3,fontStyle:"italic"}}>
                    💡 Enter the amount + date in "Initial advance" row of Pre-SPA Payments below
                  </div>
                </div>)}

                {/* Pre-SPA payment confirmations - 3-state model (pending / received / waived) */}
                {spaMode === "detailed" && (/* Pre-SPA gated */<div style={{padding:"12px 14px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>
                    ✅ Pre-SPA Payments Status
                  </div>
                  <div style={{fontSize:10,color:"#64748B",marginBottom:8,display:"flex",gap:14,flexWrap:"wrap"}}>
                    <span><span style={{color:"#16A34A",fontWeight:700}}>● Received</span> = paid by buyer</span>
                    <span><span style={{color:"#A0AEC0",fontWeight:700}}>● Pending</span> = not yet paid</span>
                    <span><span style={{color:"#7C3AED",fontWeight:700}}>● Waived</span> = not required</span>
                  </div>

                  {/* Phase 3b: DLD payer selector */}
                  {/* 18 May 2026 SPA Refactor: badge showing pre-fill from proposal */}
                  {opp.current_dld_payer && (
                    <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"3px 9px",background:"#ECFDF5",border:"1px solid #6EE7B7",borderRadius:12,fontSize:10,color:"#065F46",fontWeight:600,marginBottom:6}}>
                      ✅ DLD terms pre-filled from Final Proposal
                    </div>
                  )}
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:8,marginBottom:10}}>
                    <span style={{fontSize:11,fontWeight:700,color:"#0C4A6E",whiteSpace:"nowrap"}}>🏛️ DLD Fee (4%):</span>
                    <div style={{display:"flex",gap:4,flex:1}}>
                      {[
                        ["buyer", "Buyer pays", "#16A34A"],
                        ["developer", "Developer absorbs", "#7C3AED"],
                        ["negotiated", "Negotiated", "#F59E0B"],
                        ["split", "Split", "#3B82F6"]
                      ].map(([val, lbl, color]) => (
                        <button key={val} type="button"
                          onClick={async ()=>{
                            setDldPayer(val);
                            // Persist to opp
                            if (opp.id) {
                              await supabase.from("opportunities").update({dld_payer: val}).eq("id", opp.id);
                              onUpdated?.({...opp, dld_payer: val});
                            }
                          }}
                          style={{
                            flex:1,padding:"5px 10px",border:"none",borderRadius:5,fontSize:10,fontWeight:700,cursor:"pointer",
                            background: dldPayer===val ? color : "#fff",
                            color: dldPayer===val ? "#fff" : "#64748B",
                            textTransform: "uppercase",
                            letterSpacing: 0.4,
                            transition:"all .15s"
                          }}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Phase 3b Split: percentage input when Split is selected */}
                  {dldPayer === "split" && (() => {
                    const price = Number(stageGateForm.final_price || 0);
                    const dldTotal = price * 0.04;
                    const buyerPct = Number(dldSplitPct) || 50;
                    const buyerAmt = Math.round(dldTotal * (buyerPct/100) * 100) / 100;
                    const devAmt = Math.round((dldTotal - buyerAmt) * 100) / 100;
                    return (
                      <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"#EFF6FF",border:"1px solid #93C5FD",borderRadius:8,marginBottom:10}}>
                        <span style={{fontSize:11,fontWeight:700,color:"#1E40AF",whiteSpace:"nowrap"}}>📊 Split %:</span>
                        <input type="number" min="0" max="100" step="5"
                          value={dldSplitPct}
                          onChange={async (e)=>{
                            const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                            setDldSplitPct(v);
                            // Persist to opp
                            if (opp.id) {
                              await supabase.from("opportunities").update({dld_split_pct: v}).eq("id", opp.id);
                              onUpdated?.({...opp, dld_split_pct: v});
                            }
                          }}
                          style={{
                            padding:"4px 8px",borderRadius:5,border:"1px solid #93C5FD",
                            fontSize:12,fontWeight:700,color:"#1E40AF",width:60,textAlign:"center"
                          }}/>
                        <span style={{fontSize:11,color:"#1E40AF",fontWeight:600}}>%</span>
                        <div style={{flex:1,fontSize:11,color:"#1E40AF",textAlign:"right"}}>
                          <span style={{fontWeight:700}}>Buyer pays:</span> AED {buyerAmt.toLocaleString()}
                          <span style={{margin:"0 8px",opacity:0.5}}>|</span>
                          <span style={{fontWeight:700}}>Developer pays:</span> AED {devAmt.toLocaleString()}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Quick-fill: apply same date to all "received" items */}
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"#FFFAEB",border:"1px solid #FCD34D",borderRadius:6,marginBottom:8}}>
                    <span style={{fontSize:10,fontWeight:600,color:"#92400E"}}>⚡ Quick-fill date for all received items:</span>
                    <input type="date"
                      value={singleDateValue}
                      max={new Date().toISOString().slice(0,10)}
                      onChange={e=>{
                        const v = e.target.value;
                        if (v && v > new Date().toISOString().slice(0,10)) {
                          showToast("Payment date cannot be in the future", "error");
                          return;
                        }
                        setSingleDateValue(v);
                      }}
                      style={{padding:"3px 6px",border:"1px solid #FCD34D",borderRadius:4,fontSize:11,background:"#fff"}}/>
                    <button type="button"
                      disabled={!singleDateValue}
                      onClick={()=>{
                        setPrePaymentsState(p => {
                          const updated = {...p};
                          Object.keys(updated).forEach(k => {
                            if (updated[k].status === "received") {
                              updated[k] = {...updated[k], date: singleDateValue};
                            }
                          });
                          return updated;
                        });
                        showToast("Date applied to all received items - dates remain editable","success");
                      }}
                      style={{padding:"3px 10px",background:singleDateValue?"#92400E":"#D1D5DB",color:"#fff",border:"none",borderRadius:4,fontSize:10,fontWeight:700,cursor:singleDateValue?"pointer":"not-allowed"}}>
                      Apply
                    </button>
                  </div>

                  {/* LEDGER TABLE v2 (founder spec Day 69): Particulars | Expected | Received | Mode | Date | Diff */}
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                    <thead>
                      <tr style={{background:"#F1F5F9",color:"#475569",textAlign:"left"}}>
                        <th style={{padding:"6px 8px",fontWeight:700,width:"26%"}}>Particulars</th>
                        <th style={{padding:"6px 8px",fontWeight:700,textAlign:"right",width:"15%"}}>Expected</th>
                        <th style={{padding:"6px 8px",fontWeight:700,textAlign:"right",width:"15%"}}>Received</th>
                        <th style={{padding:"6px 8px",fontWeight:700}}>Mode</th>
                        <th style={{padding:"6px 8px",fontWeight:700}}>Date</th>
                        <th style={{padding:"6px 8px",fontWeight:700,textAlign:"right"}}>Variance</th>
                        <th style={{padding:"6px 8px"}}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["booking_fee", "Booking fee", true],
                        ["reservation_fee", "Reservation fee", true],
                        ["initial_advance", "First instalment (per plan)", false],
                        ["spa_fee", "SPA fee", false],
                        ["dld_fee", "DLD fee (4%)", false],
                        ["oqood_fee", "Oqood fee", false],
                        ["other_fees", "Other developer fees", false]
                      ].map(([key, label, isCreditFee]) => {
                        const item = prePaymentsState[key] || { status:"pending", amount:"", date:"", notes:"" };
                        const status = item.status || "pending";
                        const expected = Number(item.expected_amount) || 0;
                        const received = Number(item.amount) || 0;
                        const diff = (expected && received) ? received - expected : 0;
                        const fmt2 = (n) => "AED " + Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
                        const upd = (patch) => setPrePaymentsState(pp => ({ ...pp, [key]: { ...(pp[key]||{}), ...patch } }));
                        const waived = status === "waived";
                        return (
                          <tr key={key} style={{borderBottom:"1px dashed #E2E8F0",opacity:waived?0.5:1}}>
                            <td style={{padding:"6px 8px",fontWeight:600,color:"#0F2540"}}>{label}{isCreditFee && <div style={{fontSize:9,color:"#0369A1",fontWeight:500}}>credits toward initial advance</div>}{waived && <div style={{fontSize:9,color:"#7C3AED",fontWeight:700}}>WAIVED</div>}</td>
                            <td style={{padding:"6px 8px",textAlign:"right",color:"#065F46",fontWeight:600}}>{expected ? fmt2(expected) : "—"}</td>
                            <td style={{padding:"6px 8px",textAlign:"right"}}><input type="number" disabled={waived || stageGateViewMode} value={item.amount||""} onChange={e=>upd({amount:e.target.value, status: Number(e.target.value)>0?"received":"pending", date: (Number(e.target.value)>0 && !item.date) ? new Date().toISOString().slice(0,10) : item.date})} placeholder="0" style={{width:100,padding:"4px 6px",border:"1px solid #D1D5DB",borderRadius:5,fontSize:11,textAlign:"right"}}/></td>
                            <td style={{padding:"6px 8px"}}><select disabled={waived || stageGateViewMode} value={item.method||""} onChange={e=>upd({method:e.target.value})} style={{padding:"4px 4px",border:"1px solid #D1D5DB",borderRadius:5,fontSize:10}}><option value="">{"—"}</option><option>Cheque</option><option>Bank Transfer</option><option>Cash</option><option>Credit Card</option></select></td>
                            <td style={{padding:"6px 8px"}}><input type="date" disabled={waived || stageGateViewMode} value={item.date||""} onChange={e=>upd({date:e.target.value})} style={{padding:"4px 4px",border:"1px solid #D1D5DB",borderRadius:5,fontSize:10}}/></td>
                            <td style={{padding:"6px 8px",textAlign:"right",fontWeight:700,color:diff>0?"#B45309":diff<0?"#B91C1C":"#94A3B8"}}>{diff ? ((diff>0?"+":"")+fmt2(Math.abs(diff)).replace("AED ","")+(diff<0?" short":" over")) : "—"}</td>
                            <td style={{padding:"6px 8px"}}><button type="button" disabled={stageGateViewMode} onClick={()=>{ if(stageGateViewMode) return; upd({status:waived?"pending":"waived"}); }} style={{fontSize:9,padding:"2px 8px",borderRadius:10,border:"1px solid #D1D5DB",background:waived?"#EDE9FE":"#fff",color:waived?"#7C3AED":"#94A3B8",cursor:"pointer",fontWeight:700}}>{waived?"unwaive":"waive"}</button></td>
                          </tr>
                        );
                      })}
                      {(() => {
                        const keys=["booking_fee","reservation_fee","initial_advance","spa_fee","dld_fee","oqood_fee","other_fees"];
                        let expT=0, recT=0;
                        keys.forEach(k=>{ const it=prePaymentsState[k]||{}; if(it.status!=="waived"){ expT+=Number(it.expected_amount)||0; recT+=Number(it.amount)||0; } });
                        const varT=recT-expT;
                        return (
                          <tr style={{background:"#F8FAFC",borderTop:"2px solid #CBD5E1",fontWeight:800}}>
                            <td style={{padding:"7px 8px",color:"#0F2540"}}>TOTALS</td>
                            <td style={{padding:"7px 8px",textAlign:"right",color:"#065F46"}}>AED {expT.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                            <td style={{padding:"7px 8px",textAlign:"right",color:"#16A34A"}}>AED {recT.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                            <td colSpan={2}></td>
                            <td style={{padding:"7px 8px",textAlign:"right",color:varT<0?"#B91C1C":varT>0?"#B45309":"#16A34A"}}>{varT ? ((varT>0?"+":"")+varT.toLocaleString()) : "✓"}</td>
                            <td></td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>

                  {/* Phase C / Gate 7 (11 May 2026): Initial advance credit calculation note */}
                  {(() => {
                    const ia = prePaymentsState?.initial_advance || {};
                    const bf = prePaymentsState?.booking_fee || {};
                    const rf = prePaymentsState?.reservation_fee || {};
                    const iaReceived = ia.status === "received" && Number(ia.amount) > 0;
                    const bfAmt = bf.status === "received" ? Number(bf.amount) || 0 : 0;
                    const rfAmt = rf.status === "received" ? Number(rf.amount) || 0 : 0;
                    const totalCredits = bfAmt + rfAmt;
                    if (!iaReceived || totalCredits <= 0) return null;
                    const iaAmt = Number(ia.amount) || 0;
                    const netDueAfterCredits = Math.max(0, iaAmt - totalCredits);
                    return (
                      <div style={{marginTop:8,padding:"10px 12px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:8,fontSize:11,color:"#1E3A8A"}}>
                        <div style={{fontWeight:700,marginBottom:4,fontSize:11}}>💳 Initial Advance Credit Note</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                          <div>Recorded as Received:</div>
                          <div style={{fontWeight:700,textAlign:"right"}}>AED {iaAmt.toLocaleString()}</div>
                          {bfAmt > 0 && (<>
                            <div>Less Booking fee credit:</div>
                            <div style={{textAlign:"right",color:"#7C2D12"}}>(AED {bfAmt.toLocaleString()})</div>
                          </>)}
                          {rfAmt > 0 && (<>
                            <div>Less Reservation fee credit:</div>
                            <div style={{textAlign:"right",color:"#7C2D12"}}>(AED {rfAmt.toLocaleString()})</div>
                          </>)}
                          <div style={{fontWeight:700,paddingTop:4,borderTop:"1px dashed #93C5FD"}}>Actual buyer paid this stage:</div>
                          <div style={{fontWeight:700,textAlign:"right",paddingTop:4,borderTop:"1px dashed #93C5FD"}}>AED {netDueAfterCredits.toLocaleString()}</div>
                        </div>
                        <div style={{marginTop:5,fontSize:10,color:"#1E3A8A",fontStyle:"italic"}}>
                          Booking + Reservation paid at earlier stage credit toward Initial advance.
                        </div>
                      </div>
                    );
                  })()}

                  {/* Phase 3c: Payment Summary Card */}
                  {(() => {
                    const items = Object.values(prePaymentsState || {});
                    const totalReceived = items.filter(i => i.status === "received").reduce((s, i) => s + (Number(i.amount) || 0), 0);
                    const totalWaived = items.filter(i => i.status === "waived").reduce((s, i) => s + (Number(i.amount) || 0), 0);
                    const totalPending = items.filter(i => i.status === "pending").length;
                    const price = Number(stageGateForm.final_price || 0);
                    const outstanding = price - totalReceived;
                    const receivedPct = price > 0 ? Math.round((totalReceived / price) * 1000) / 10 : 0;
                    const billTotal = items.filter(i => i.status !== "waived").reduce((s, i) => s + (Number(i.expected_amount) || Number(i.amount) || 0), 0);
                    const toCollect = Math.max(billTotal - totalReceived, 0);
                    return (
                      <div style={{marginTop:14,padding:"12px 14px",background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:10}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",marginBottom:8}}>📊 Payment Summary</div>
                        <div style={{display:"flex",justifyContent:"space-between",gap:8,padding:"8px 10px",marginBottom:8,background:"#FFFBEB",border:"1px solid #FCD34D",borderRadius:8}}>
                          <div style={{textAlign:"center",flex:1}}><div style={{fontSize:9,color:"#92400E",textTransform:"uppercase"}}>Bill (this stage)</div><div style={{fontSize:14,fontWeight:800,color:"#92400E"}}>AED {billTotal.toLocaleString()}</div></div>
                          <div style={{textAlign:"center",flex:1,borderLeft:"1px solid #FDE68A"}}><div style={{fontSize:9,color:"#166534",textTransform:"uppercase"}}>Collected</div><div style={{fontSize:14,fontWeight:800,color:"#16A34A"}}>AED {totalReceived.toLocaleString()}</div></div>
                          <div style={{textAlign:"center",flex:1,borderLeft:"1px solid #FDE68A"}}><div style={{fontSize:9,color:"#991B1B",textTransform:"uppercase"}}>To Collect</div><div style={{fontSize:14,fontWeight:800,color:toCollect > 0 ? "#B91C1C" : "#16A34A"}}>{toCollect > 0 ? "AED " + toCollect.toLocaleString() : "\u2713 Complete"}</div></div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,fontSize:12}}>
                          <div style={{display:"flex",justifyContent:"space-between",color:"#16A34A"}}>
                            <span>Total Received:</span>
                            <span style={{fontWeight:700}}>AED {totalReceived.toLocaleString()}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",color:"#7C3AED"}}>
                            <span>Total Waived:</span>
                            <span style={{fontWeight:700}}>AED {totalWaived.toLocaleString()}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",color:"#A0AEC0"}}>
                            <span>Pending items:</span>
                            <span style={{fontWeight:700}}>{totalPending}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",color:"#94A3B8"}}>
                            <span>Buyer paid %:</span>
                            <span style={{fontWeight:700}}>{receivedPct}%</span>
                          </div>
                        </div>
                        {price > 0 && (
                          <div style={{marginTop:8,paddingTop:8,borderTop:"1px dashed #CBD5E0",display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,color:outstanding > 0 ? "#B83232" : "#16A34A"}}>
                            <span>{outstanding > 0 ? "Outstanding to developer:" : "Fully paid ✓"}</span>
                            {outstanding > 0 && <span>AED {outstanding.toLocaleString()}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Phase 3c: Commission Preview Card */}
                  {(() => {
                    const price = Number(stageGateForm.final_price || 0);
                    const commPct = Number(opp.commission_pct || 0);
                    if (!price || !commPct) return null;
                    const gross = Math.round(price * commPct / 100 * 100) / 100;
                    const vat = Math.round(gross * 0.05 * 100) / 100;
                    const net = gross + vat;
                    return (
                      <div style={{marginTop:10,padding:"12px 14px",background:"linear-gradient(135deg,#FEF3C7,#FDE68A)",border:"1px solid #F59E0B",borderRadius:10}}>
                        <div style={{fontSize:11,fontWeight:700,color:"#78350F",textTransform:"uppercase",letterSpacing:".4px",marginBottom:8}}>💰 Your Commission Preview</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr",gap:5,fontSize:12,color:"#92400E"}}>
                          <div style={{display:"flex",justifyContent:"space-between"}}>
                            <span>Sale price × {commPct}%:</span>
                            <span style={{fontWeight:700}}>AED {gross.toLocaleString()}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between"}}>
                            <span>VAT 5%:</span>
                            <span style={{fontWeight:700}}>AED {vat.toLocaleString()}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",paddingTop:6,borderTop:"1px dashed #D97706",fontWeight:800,fontSize:13}}>
                            <span>Net commission:</span>
                            <span>AED {net.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>)}

                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label>
                  <textarea rows={2} placeholder="Any conditions or notes on the SPA…" value={stageGateForm.notes||""} onChange={e=>setStageGateForm(f=>({...f,notes:e.target.value}))}/>
                </div>
              </>)}

              {/* CLOSED WON fields */}
              {showStageGate==="Closed Won"&&(<>
                <div style={{background:"#E6F4EE",border:"1px solid #A8D5BE",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#1A7F5A",fontWeight:500}}>
                  {stageGateViewMode && opp.won_at ? ("🏆 Closed Won on " + new Date(opp.won_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})) : "🎉 Congratulations! Confirm the final details to close this deal."}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Final Sale Price (AED) *</label>
                    {/* Fix 2 (12 May 2026): Read-only price at Closed Won - SPA signed = legally locked */}
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"#F0FDF4",border:"1px solid #86EFAC",borderRadius:8}}>
                      <span style={{fontSize:13,fontWeight:700,color:"#166534"}}>
                        AED {Number(stageGateForm.final_price||opp.final_price||opp.offer_price||0).toLocaleString()}
                      </span>
                      <span style={{fontSize:10,color:"#16A34A",flex:1}}>
                        🔒 Locked from SPA Signed
                      </span>
                    </div>
                  </div>
                  {!stageGateViewMode && (<div>
                    <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Expected Handover Date</label>
                    <input type="date" value={stageGateForm.handover_date||""} onChange={e=>setStageGateForm(f=>({...f,handover_date:e.target.value}))}/>
                  </div>)}
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label>
                  <textarea rows={2} placeholder="Any final notes…" value={stageGateForm.notes||""} onChange={e=>setStageGateForm(f=>({...f,notes:e.target.value}))}/>
                </div>
              </>)}

              {/* CLOSED LOST fields */}
              {showStageGate==="Closed Lost"&&(<>
                <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#B83232",fontWeight:500}}>
                  Please record why this deal was lost — this helps improve future performance.
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Lost Reason *</label>
                  <select value={stageGateForm.lost_reason||""} onChange={e=>setStageGateForm(f=>({...f,lost_reason:e.target.value}))}>
                    <option value="">Select reason…</option>
                    {["Price too high","Bought elsewhere","No longer interested","Budget constraints","Project not suitable","No response","Other"].map(r=><option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Additional Notes</label>
                  <textarea rows={3} placeholder="Any additional context on why the deal was lost…" value={stageGateForm.notes||""} onChange={e=>setStageGateForm(f=>({...f,notes:e.target.value}))}/>
                </div>
              </>)}

              </fieldset>
              {/* HANDOVER-LIVE: future-fact stays editable on Won deals (founder doctrine 23 Jul) */}
              {stageGateViewMode && showStageGate==="Closed Won" && (
                <div style={{display:"flex",gap:10,alignItems:"flex-end",background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:8,padding:"10px 14px"}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#166534",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Won / Close Date</label>
                    <div style={{padding:"8px 12px",background:"#fff",border:"1px solid #86EFAC",borderRadius:7,fontSize:13,fontWeight:700,color:"#166534",whiteSpace:"nowrap"}}>{opp.won_at ? new Date(opp.won_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}) : "-"}</div>
                  </div>
                  <div style={{flex:1}}>
                    <label style={{fontSize:11,fontWeight:600,color:"#166534",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Expected Handover Date (editable - delays happen)</label>
                    <input type="date" value={stageGateForm.handover_date||""} onChange={e=>setStageGateForm(f=>({...f,handover_date:e.target.value}))}/>
                  </div>
                  <button type="button" onClick={async()=>{
                    const d = stageGateForm.handover_date || null;
                    const { error } = await supabase.from("opportunities").update({ expected_handover_date: d }).eq("id", opp.id);
                    if (error) { showToast(error.message, "error"); return; }
                    onUpdated?.({ ...opp, expected_handover_date: d });
                    supabase.from("activities").insert({ company_id: currentUser.company_id, opportunity_id: opp.id, lead_id: lead?.id || null, type: "note", note: "Expected handover date updated to " + (d || "(cleared)"), created_by: currentUser.id }).then(null, e=>console.warn("handover note:", e));
                    showToast("Handover date saved", "success");
                  }} style={{fontSize:11,fontWeight:700,padding:"8px 14px",borderRadius:7,border:"1px solid #86EFAC",background:"#fff",color:"#166534",cursor:"pointer",whiteSpace:"nowrap"}}>💾 Save date</button>
                </div>
              )}
              {/* Action buttons */}
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8,borderTop:"1px solid #F1F5F9"}}>
                <button onClick={()=>setShowStageGate(null)}
                  style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>
                  Cancel
                </button>
                <button onClick={(stageGateViewMode && (opp.stage === "Closed Won" || opp.stage === "Closed Lost")) ? () => showToast("🔒 This deal is closed - records are view-only", "info") : stageGateViewMode ? () => setStageGateViewMode(false) : async()=>{
                  // Validation
                  // Offer Accepted - validate confirmation checkbox before advancing
                  // 19 May 2026 Issue 4: Gate advance on "all amounts collected" checkbox
                  // Offer Accepted - no required fields, price comes from inventory
                  if(showStageGate==="Reserved"&&!stageGateForm.reservation_fee){showToast("Reservation fee is required","error");return;}
                  if(showStageGate==="SPA Signed"&&!stageGateForm.final_price){showToast("Final price is required","error");return;}
                  // STAGE GATE 5 (11 May 2026): Reserved -> SPA Signed requires booking + reservation
                  // Per founder spec: "If not collected together 1&2, cannot proceed further"
                  if(showStageGate==="SPA Signed"){
                    const bookingFee = prePaymentsState?.booking_fee || {};
                    const reservationFee = prePaymentsState?.reservation_fee || {};
                    // Jul 17: waived satisfies (booking/reservation are optional PRODUCTS per redesign; SPA-form doctrine = record, not police)
                    const bookingOK = bookingFee.status === "waived" || (bookingFee.status === "received" && Number(bookingFee.amount) > 0);
                    const reservationOK = reservationFee.status === "waived" || (reservationFee.status === "received" && Number(reservationFee.amount) > 0);
                    const anyCommitment = bookingOK || reservationOK || (Number(opp.reservation_amount) > 0) || (Number(opp.booking_amount) > 0); if (!anyCommitment) {
                      const missing = [];
                      if (!bookingOK) missing.push("Booking fee");
                      if (!reservationOK) missing.push("Reservation fee");
                      showToast(
                        `⛔ ${missing.join(" + ")} must be Received with amount before SPA Signed. These are mandatory commitment payments.`,
                        "error"
                      );
                      return;
                    }
                  }
                  // Stage 5 v2 — validate all "received" pre-SPA items have dates
                  // Stage 5 v3 Phase 3c — also validate amounts + sanity check totals
                  if(showStageGate==="SPA Signed"){
                    const missingDate = Object.entries(prePaymentsState||{}).filter(([k,v])=>v.status==="received" && !v.date && (Number(v.amount)||0) > 0).map(([k])=>k.replace(/_/g," "));
                    if(missingDate.length>0){
                      showToast(`Date required for received items: ${missingDate.join(", ")}`,"error");
                      return;
                    }
                    // Variance gate (founder close-discipline Day 70): nonzero variance needs a stated reason - soft, audited
                    const _vk = ["booking_fee","reservation_fee","initial_advance","spa_fee","dld_fee","oqood_fee","other_fees"];
                    let _exp = 0, _rec = 0, _pend = 0;
                    _vk.forEach(k => { const it = prePaymentsState[k] || {}; if (it.status !== "waived") { _exp += Number(it.expected_amount) || 0; _rec += Number(it.amount) || 0; if (it.status === "pending" && (Number(it.expected_amount) || 0) > 0) _pend++; } });
                    const _var = Math.round((_rec - _exp) * 100) / 100;
                    // Rebalance Day 71 (primary checkpoint): materiality logic at Requirements->Signed, company tolerance
                    let _tolA2 = 500, _tolP2 = 1;
                    try { const { data: _co2 } = await supabase.from("companies").select("close_variance_tolerance_aed, close_variance_tolerance_pct").eq("id", currentUser.company_id).maybeSingle(); if (_co2) { _tolA2 = Number(_co2.close_variance_tolerance_aed) || 500; _tolP2 = Number(_co2.close_variance_tolerance_pct) || 1; } } catch (e) {}
                    const _tol2 = Math.max(_tolA2, _exp * _tolP2 / 100);
                    if (_var < 0 && Math.abs(_var) > _tol2) {
                      const vr = window.prompt("Variance at signing: AED " + Math.abs(_var).toLocaleString() + " short (tolerance AED " + Math.round(_tol2).toLocaleString() + ", " + _pend + " pending).\n\nBest: collect or waive the rows first.\nTo record the SPA anyway: enter approval / follow-up note (who approved, what is the plan):");
                      if (vr === null || !vr.trim()) return;
                      try { await supabase.from("activities").insert({ opportunity_id: opp.id, lead_id: opp.lead_id, company_id: opp.company_id || currentUser.company_id || null, type: "Note", status: "completed", user_id: currentUser.id, user_name: currentUser.full_name || null, lead_name: lead?.name || null, stage_at_event: "SPA Signed", activity_subtype: "variance_override", note: "VARIANCE OVERRIDE at SPA signing: AED " + Math.abs(_var).toLocaleString() + " uncollected across " + _pend + " pending rows - reason: " + vr.trim() }); } catch (e) { console.error("variance audit:", e); }
                    }
                    const missingAmount = Object.entries(prePaymentsState||{}).filter(([k,v])=>v.status==="received" && (!v.amount || Number(v.amount) <= 0)).map(([k])=>k.replace(/_/g," "));
                    if(missingAmount.length>0){
                      showToast(`Amount required for received items: ${missingAmount.join(", ")}`,"error");
                      return;
                    }
                    const totalReceivedCheck = Object.values(prePaymentsState||{}).filter(v=>v.status==="received").reduce((s,v)=>s+(Number(v.amount)||0),0);
                    const fpCheck = Number(stageGateForm.final_price||0);
                    if(fpCheck > 0 && totalReceivedCheck > fpCheck * 1.5){
                      showToast(`Warning: Total received (AED ${totalReceivedCheck.toLocaleString()}) exceeds 150% of sale price. Please verify amounts.`,"error");
                      return;
                    }
                  }
                  if(showStageGate==="Closed Won"&&!(stageGateForm.final_price||opp.final_price||opp.offer_price)){showToast("Final sale price is required","error");return;}
                  // STAGE GATE 6 (11 May 2026): SPA Signed -> Closed Won = signature event
                  // Per founder spec: "No signature till all the money collected"
                  // Required: all 7 fees Received/Waived (no Pending) + SPA document uploaded
                  if(showStageGate==="Closed Won"){
                    // Softened Day 71: only rows with a real expectation block; reason-path per soft-gate doctrine (supersedes 11-May hard stop)
                    const pendingItems = Object.entries(prePaymentsState||{}).filter(([k,v])=>(v.status==="pending" || !v.status) && (Number(v.expected_amount)||0) > 0).map(([k])=>k.replace(/_/g," "));
                    if(pendingItems.length>0){
                      setShowStageGate(null); setStageGateViewMode(false); setDashboardTab("financials");
                      showToast("⛔ Close blocked - " + pendingItems.join(", ") + " still expected. Open the SPA record: mark each Received (developer confirmed) or Waived with a follow-up note.", "error"); return;
                      
                      try { await supabase.from("activities").insert({ opportunity_id: opp.id, lead_id: opp.lead_id, company_id: opp.company_id || currentUser.company_id || null, type: "Note", status: "completed", user_id: currentUser.id, user_name: currentUser.full_name || null, stage_at_event: "Closed Won", activity_subtype: "close_payment_override", note: "CLOSE W/ PENDING PAYMENTS: " + pendingItems.join(", ") + " - reason: " + cpr.trim() }); } catch (e) { console.error("close audit:", e); }
                    }
                    // Close-gate v2 (Day 71 founder-ratified): ONE materiality question at the bottom line, company-set tolerance
                    {
                      const _ck = ["booking_fee","reservation_fee","initial_advance","spa_fee","dld_fee","oqood_fee","other_fees"];
                      let _e = 0, _r = 0;
                      _ck.forEach(k => { const it = prePaymentsState[k] || {}; if (it.status !== "waived") { _e += Number(it.expected_amount) || 0; _r += Number(it.amount) || 0; } });
                      const _v = Math.round((_r - _e) * 100) / 100;
                      let _tolA = 500, _tolP = 1;
                      try { const { data: _co } = await supabase.from("companies").select("close_variance_tolerance_aed, close_variance_tolerance_pct").eq("id", currentUser.company_id).maybeSingle(); if (_co) { _tolA = Number(_co.close_variance_tolerance_aed) || 500; _tolP = Number(_co.close_variance_tolerance_pct) || 1; } } catch (e) {}
                      const _tol = Math.max(_tolA, _e * _tolP / 100);
                      if (_v < 0 && Math.abs(_v) > _tol) {
                        const _cn = window.prompt("Net variance at signing: AED " + Math.abs(_v).toLocaleString() + " short (tolerance AED " + Math.round(_tol).toLocaleString() + ").\n\nEnter approval / follow-up note (who approved, what is the plan):");
                        if (_cn === null || !_cn.trim()) return;
                        try { await supabase.from("activities").insert({ opportunity_id: opp.id, lead_id: opp.lead_id, company_id: opp.company_id || currentUser.company_id || null, type: "Note", status: "completed", user_id: currentUser.id, user_name: currentUser.full_name || null, stage_at_event: "Closed Won", activity_subtype: "variance_closure_note", note: "CLOSE VARIANCE APPROVAL: AED " + Math.abs(_v).toLocaleString() + " short - " + _cn.trim() }); } catch (e) { console.error("closure note:", e); }
                      }
                    }
                    // SPA document required (uploaded path or filename)
                    const hasSpaDoc = stageGateForm.spa_document_path || stageGateForm.spa_document_filename || opp.spa_document_path;
                    if (!hasSpaDoc) {
                      showToast(
                        "⛔ SPA document (signed) must be uploaded before closing as Won.",
                        "error"
                      );
                      return;
                    }
                  }
                  if(showStageGate==="Closed Lost"&&!stageGateForm.lost_reason){showToast("Please select a lost reason","error");return;}
                  // Build extra data for DB
                  // STAGE GATE 4 (11 May 2026): if override active and changed, use override price + log
                  // 15 May 2026 Day 3: Use current_agreed_price as PRIMARY (single source of truth from proposals)
                  // Legacy: opp.discount_pct + opp.budget fallback only if current_agreed_price not set
                  const _calculatedOfferPrice = Number(opp.current_agreed_price) > 0
                    ? Number(opp.current_agreed_price)
                    : (opp.discount_pct ? opp.budget*(1-opp.discount_pct/100) : opp.budget);
                  const _overrideActive = stageGateForm.show_price_override && Number(stageGateForm.offer_price_override||0) > 0;
                  const _finalOfferPrice = _overrideActive ? Number(stageGateForm.offer_price_override) : _calculatedOfferPrice;
                  const extraData = {
                    offer_price: _finalOfferPrice || opp.current_agreed_price || opp.budget || null,
                    ...(stageGateForm.final_price?{final_price:Number(stageGateForm.final_price)}:{}),
                    ...(stageGateForm.lost_reason?{lost_reason:stageGateForm.lost_reason}:{}),
                    ...(stageGateForm.notes?{notes:stageGateForm.notes}:{}),
                  };
                  // Log price override to activities for audit trail
                  if (_overrideActive && Number(stageGateForm.offer_price_override) !== Number(_calculatedOfferPrice)) {
                    try {
                      await supabase.from("activities").insert({
                        lead_id: opp.lead_id,
                        opportunity_id: opp.id,
                        company_id: currentUser.company_id || null,
                        type: "Note",
                        note: `Price override at ${showStageGate}: Calculated AED ${Number(_calculatedOfferPrice).toLocaleString()} → Override AED ${Number(stageGateForm.offer_price_override).toLocaleString()}. Broker accepted commission impact.`,
                        status: "completed",
                        created_by: currentUser.id
                      });
                    } catch (e) {
                      console.error("Price override audit log exception:", e);
                    }
                  }
                  await commitStageMove(showStageGate, extraData);
                }}
                  style={{padding:"8px 20px",borderRadius:8,border:"none",
                    background:showStageGate==="Closed Lost"?"#B83232":showStageGate==="Closed Won"?"#1A7F5A":"#0F2540",
                    color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>
                  {stageGateViewMode ? ((opp.stage === "Closed Won" || opp.stage === "Closed Lost") ? "🔒 View only" : "\u270f Amend") : showStageGate==="Closed Lost"?"✗ Close as Lost":showStageGate==="Closed Won"?"🏆 Close as Won":showStageGate==="Reserved"?"🔒 Confirm Reservation":showStageGate==="SPA Signed"?"📄 Record SPA":"✅ Record Offer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discount Request Modal - HIDDEN per founder decision 19 May 2026 */}
      {INTERNAL_APPROVAL_FEATURES_ENABLED && showDiscReq&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1200,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:520,maxWidth:"100%",maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.25)"}}>
            <div style={{padding:"1.25rem 1.5rem",borderBottom:"1px solid #E8EDF4",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#0F2540",letterSpacing:"-.3px"}}>💰 Request Discount</div>
                <div style={{fontSize:12,color:"#94A3B8",marginTop:2}}>{opp.title||lead?.name} — requires manager approval</div>
              </div>
              <button onClick={()=>setShowDiscReq(false)} style={{background:"none",border:"none",fontSize:22,color:"#94A3B8",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.25rem 1.5rem",display:"flex",flexDirection:"column",gap:14}}>

              {/* Info banner */}
              <div style={{background:"#FDF3DC",border:"1px solid #E8C97A",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#8A6200"}}>
                ℹ Discounts up to <strong>5%</strong> go to your Sales Manager for approval. Above 5% are escalated to Admin.
              </div>

              {/* Discount Type */}
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Discount Type</label>
                <select value={discReqForm.type} onChange={e=>setDiscReqForm(f=>({...f,type:e.target.value}))}>
                  <option value="sale_price">Sale Price Reduction</option>
                  <option value="payment_plan">Payment Plan Change</option>
                  <option value="agency_fee">Agency Fee Waiver</option>
                </select>
              </div>

              {/* Discount Source — KEY NEW FIELD */}
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>Discount Source *</label>
                <div style={{display:"flex",gap:8}}>
                  {[["Developer","🏗 Developer","Developer is offering the discount"],["Our Company","🏢 Our Company","We absorb the discount from our margin"]].map(([v,l,desc])=>(
                    <div key={v} onClick={()=>setDiscReqForm(f=>({...f,discount_source:v}))}
                      style={{flex:1,padding:"10px 14px",borderRadius:10,border:`2px solid ${discReqForm.discount_source===v?"#7C3AED":"#E2E8F0"}`,
                        background:discReqForm.discount_source===v?"#CCFBF1":"#fff",cursor:"pointer",transition:"all .15s"}}>
                      <div style={{fontSize:13,fontWeight:700,color:discReqForm.discount_source===v?"#7C3AED":"#0F2540",marginBottom:3}}>{l}</div>
                      <div style={{fontSize:11,color:"#94A3B8"}}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Developer auth ref — only if Developer */}
              {discReqForm.discount_source==="Developer"&&(
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Developer Authorization Reference</label>
                  <input placeholder="e.g. Email ref, approval code, document number…" value={discReqForm.developer_auth_ref||""} onChange={e=>setDiscReqForm(f=>({...f,developer_auth_ref:e.target.value}))}/>
                  <div style={{fontSize:11,color:"#94A3B8",marginTop:4}}>Attach proof of developer authorization (email, letter, etc.)</div>
                </div>
              )}

              {/* Discount % and values */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Original Price (AED)</label>
                  <input type="number" value={discReqForm.original_value||opp.budget||""} readOnly style={{background:"#F7F9FC",color:"#94A3B8"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Discount % *</label>
                  <input type="number" min="0" max="50" step="0.5" placeholder="e.g. 5" value={discReqForm.discount_pct||""} onChange={e=>setDiscReqForm(f=>({...f,discount_pct:e.target.value,requested_value:Math.round((discReqForm.original_value||opp.budget||0)*(1-Number(e.target.value)/100))}))}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Discounted Price</label>
                  <input type="number" value={discReqForm.requested_value||""} onChange={e=>setDiscReqForm(f=>({...f,requested_value:e.target.value,discount_pct:discReqForm.original_value||(opp.budget||0)?Math.round((1-Number(e.target.value)/(discReqForm.original_value||opp.budget||1))*1000)/10:""}))} placeholder="Auto-calculated"/>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label style={{fontSize:11,fontWeight:600,color:"#64748B",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Reason for Discount *</label>
                <textarea rows={3} placeholder="Explain why this discount is needed — client objection, competitor pricing, budget constraint…" value={discReqForm.reason||""} onChange={e=>setDiscReqForm(f=>({...f,reason:e.target.value}))}/>
              </div>

              {/* Approval notice */}
              {discReqForm.discount_pct&&(
                <div style={{padding:"8px 12px",borderRadius:8,fontSize:12,fontWeight:600,
                  background:Number(discReqForm.discount_pct)>5?"#EEE8F9":"#E6EFF9",
                  color:Number(discReqForm.discount_pct)>5?"#5B3FAA":"#1A5FA8",
                  border:`1px solid ${Number(discReqForm.discount_pct)>5?"#5EEAD4":"#BFDBFE"}`}}>
                  {Number(discReqForm.discount_pct)>5?"⚡ This request will be escalated to Admin for approval":"✓ This request will go to your Sales Manager for approval"}
                </div>
              )}

              <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8,borderTop:"1px solid #F1F5F9"}}>
                <button onClick={()=>setShowDiscReq(false)} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>Cancel</button>
                <button onClick={async()=>{
                  if(!discReqForm.discount_pct){showToast("Discount % is required","error");return;}
                  if(!discReqForm.reason?.trim()){showToast("Please provide a reason","error");return;}
                  const payload = {
                    lead_id: lead?.id||null,
                    lead_name: lead?.name||opp.title||"",
                    unit_id: opp.unit_id||null,
                    opportunity_id: opp.id,
                    company_id: currentUser.company_id||null,
                    type: discReqForm.type,
                    discount_pct: Number(discReqForm.discount_pct),
                    original_value: Number(discReqForm.original_value||opp.budget||0),
                    requested_value: Number(discReqForm.requested_value||0),
                    reason: discReqForm.reason,
                    discount_source: discReqForm.discount_source,
                    developer_auth_ref: discReqForm.developer_auth_ref||null,
                    requested_by: currentUser.id,
                    requested_by_name: currentUser.full_name||currentUser.email,
                    status: "Pending",
                  };
                  const{error}=await supabase.from("discount_requests").insert(payload);
                  if(error){showToast(error.message,"error");return;}
                  showToast("Discount request submitted — pending manager approval","success");
                  setShowDiscReq(false);
                }}>
                  Submit for Approval
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Proposal Email Modal */}
      {showEmail&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:540,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
            <div style={{background:"#fff",padding:"1rem 1.5rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#fff"}}>📤 Send Proposal</div>
                <div style={{fontSize:11,color:"#64748B",marginTop:2}}>Stage moves to Proposal Sent after sending</div>
              </div>
              <button onClick={()=>setShowEmail(false)} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem",flex:1,display:"flex",flexDirection:"column",gap:12}}>
              <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>To *</label><input value={emailForm.to} onChange={e=>setEmailForm(f=>({...f,to:e.target.value}))}/></div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Subject</label><input value={emailForm.subject} onChange={e=>setEmailForm(f=>({...f,subject:e.target.value}))}/></div>
              <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Message</label><textarea value={emailForm.body} onChange={e=>setEmailForm(f=>({...f,body:e.target.value}))} rows={8} style={{fontFamily:"inherit",lineHeight:1.6}}/></div>
              <div style={{background:"#E6EFF9",borderRadius:8,padding:"10px 12px",fontSize:12,color:"#1A5FA8"}}>💡 Proposal PDF will download automatically. Attach it to the email.</div>
            </div>
            <div style={{padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0",display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowEmail(false)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={async()=>{
                if(!emailForm.to){showToast("Enter recipient email","error");return;}
                const mailtoUrl=`mailto:${emailForm.to}?subject=${encodeURIComponent(emailForm.subject)}&body=${encodeURIComponent(emailForm.body)}`;
                window.open(mailtoUrl);
                await supabase.from("activities").insert({opportunity_id:opp.id,lead_id:lead.id,type:"Email",note:`Proposal sent to ${emailForm.to}`,user_id:currentUser.id,user_name:currentUser.full_name,lead_name:lead.name,company_id:currentUser.company_id||null});
                const{error}=await supabase.from("opportunities").update({stage:"Proposal Sent",proposal_sent_at:new Date().toISOString(),stage_updated_at:new Date().toISOString(),status:"Active"}).eq("id",opp.id);
                if(!error){onUpdated({...opp,stage:"Proposal Sent",proposal_sent_at:new Date().toISOString()});showToast("Proposal sent — stage updated","success");}
                setShowEmail(false);
              }} style={{padding:"9px 24px",borderRadius:8,border:"none",background:"#1A5FA8",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>📤 Send & Move Stage</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Payment Modal */}
      {showPayment&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:500,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#0F2540"}}>💰 {editPayment?"Edit":"Add"} Payment</span>
              <button onClick={()=>{setShowPayment(false);setEditPayment(null);}} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem",flex:1}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Milestone *</label>
                  <select value={payForm.milestone} onChange={e=>setPayForm(f=>({...f,milestone:e.target.value}))}>
                    {["Booking Deposit","SPA Signing","1st Installment","2nd Installment","3rd Installment","4th Installment","On Handover","Post Handover 1","Post Handover 2","Other"].map(m=><option key={m}>{m}</option>)}
                  </select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>% of Deal Value</label>
                  <input type="number" value={payForm.percentage} placeholder="e.g. 10" onChange={e=>{
                    const pct=Number(e.target.value)||0;
                    const base=opp.final_price||opp.budget||0;
                    setPayForm(f=>({...f,percentage:e.target.value,amount:pct>0&&base>0?Math.round(base*(pct/100)):f.amount}));
                  }}/>
                  {payForm.percentage>0&&(opp.final_price||opp.budget)&&<div style={{fontSize:11,color:"#1A7F5A",marginTop:3,fontWeight:600}}>= AED {Math.round((opp.final_price||opp.budget)*(Number(payForm.percentage)/100)).toLocaleString()}</div>}
                </div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Amount (AED) *</label>
                  <input type="number" value={payForm.amount} placeholder="e.g. 250000" style={{fontWeight:700}} onChange={e=>{
                    const amt=Number(e.target.value)||0;
                    const base=opp.final_price||opp.budget||0;
                    setPayForm(f=>({...f,amount:e.target.value,percentage:amt>0&&base>0?Math.round(amt/base*1000)/10:f.percentage}));
                  }}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Due Date</label><input type="date" value={payForm.due_date} onChange={e=>setPayForm(f=>({...f,due_date:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Payment Type</label>
                  <select value={payForm.payment_type} onChange={e=>setPayForm(f=>({...f,payment_type:e.target.value}))}>
                    {["Cheque","Cash","Bank Transfer","Credit Card"].map(t=><option key={t}>{t}</option>)}
                  </select></div>
                {payForm.payment_type==="Cheque"&&<>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Cheque Number</label><input value={payForm.cheque_number} onChange={e=>setPayForm(f=>({...f,cheque_number:e.target.value}))}/></div>
                  <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Cheque Date</label><input type="date" value={payForm.cheque_date} onChange={e=>setPayForm(f=>({...f,cheque_date:e.target.value}))}/></div>
                  <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Bank Name</label><input value={payForm.bank_name} onChange={e=>setPayForm(f=>({...f,bank_name:e.target.value}))} placeholder="Emirates NBD, ADCB…"/></div>
                  <div style={{gridColumn:"1/-1"}}>
                    <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Cheque Image</label>
                    {payForm.cheque_file_url?(
                      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"#E6F4EE",borderRadius:8,border:"1px solid #A8D5BE"}}>
                        <span style={{fontSize:12,color:"#1A7F5A",fontWeight:600}}>✓ Uploaded</span>
                        <a href={payForm.cheque_file_url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#1A5FA8"}}>View →</a>
                        <button onClick={()=>setPayForm(f=>({...f,cheque_file_url:""}))} style={{marginLeft:"auto",fontSize:11,color:"#B83232",background:"none",border:"none",cursor:"pointer"}}>× Remove</button>
                      </div>
                    ):(
                      <label style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:8,border:"1.5px dashed #D1D9E6",cursor:"pointer",background:"#FAFBFC",fontSize:12,color:"#4A5568"}}>
                        <input type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={async e=>{
                          const file=e.target.files[0];if(!file)return;
                          setSaving(true);
                          try{
                            const path=`payments/${opp.id}/${Date.now()}_${file.name}`;
                            await supabase.storage.from("propcrm-files").upload(path,file,{upsert:true});
                            const{data:{publicUrl}}=supabase.storage.from("propcrm-files").getPublicUrl(path);
                            setPayForm(f=>({...f,cheque_file_url:publicUrl}));
                            showToast("Cheque uploaded","success");
                          }catch(err){showToast(err.message,"error");}
                          setSaving(false);
                        }}/>
                        📷 Upload cheque photo or scan
                      </label>
                    )}
                  </div>
                </>}
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Status</label>
                  <select value={payForm.status} onChange={e=>setPayForm(f=>({...f,status:e.target.value}))}>
                    {Object.keys(PAYMENT_STATUS_META).map(s=><option key={s}>{s}</option>)}
                  </select></div>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label><textarea value={payForm.notes} onChange={e=>setPayForm(f=>({...f,notes:e.target.value}))} rows={2}/></div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0"}}>
              <button onClick={()=>{setShowPayment(false);setEditPayment(null);}} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={savePayment} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":editPayment?"Save Changes":"Add Payment"}</button>
            </div>
          </div>
        </div>
      )}
      {/* Phase 2.1 — Floating Action Button for activity logging */}
      <button
        onClick={()=>setShowFabLog(true)}
        title="Log activity"
        style={{
          position:"fixed",
          bottom:96,
          right:24,
          width:56,
          height:56,
          borderRadius:"50%",
          border:"none",
          background:"#0F2540",
          color:"#fff",
          fontSize:24,
          fontWeight:700,
          cursor:"pointer",
          boxShadow:"0 6px 20px rgba(11,31,58,.35)",
          zIndex:900,
          display:"flex",
          alignItems:"center",
          justifyContent:"center"
        }}
      >+</button>
      {showFabLog && (
        <LogActivityModal
          lead={lead}
          opp={opp}
          defaultType={fabLogType}
          currentUser={currentUser}
          showToast={showToast}
          onClose={()=>setShowFabLog(false)}
          onSaved={(saved)=>{
            setActivities(a=>[saved,...a]);
            setShowFabLog(false);
            showToast("Activity logged","success");
            autoAdvanceOnActivity({ opp, lead, savedActivity: saved, supabase, showToast, onStageChanged: (s)=>onUpdated({...opp, stage: s}) });
          }}
        />
      )}
      {showLog && (
        <LogActivityModal
          lead={lead}
          opp={opp}
          defaultType={"Call"}
          currentUser={currentUser}
          showToast={showToast}
          onClose={()=>setShowLog(false)}
          onSaved={(saved)=>{
            setActivities(a=>[saved,...a]);
            setShowLog(false);
            showToast("Activity logged","success");
            autoAdvanceOnActivity({ opp, lead, savedActivity: saved, supabase, showToast, onStageChanged: (s)=>onUpdated({...opp, stage: s}) });
          }}
        />
      )}
      {showUnitPack && selectedUnitForPack && (
        <UnitDetailPanel
          unit={selectedUnitForPack}
          project={projects?.find(p => p.id === selectedUnitForPack.project_id)}
          onClose={() => { setShowUnitPack(false); setSelectedUnitForPack(null); }}
        />
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// LEADS — Contact list with opportunities per lead
// ══════════════════════════════════════════════════════════════════
/* ═══════════════════════════════════════════════════════════════
   Phase F — AI plumbing (Module-level helper)
   Lets any component call Claude via the existing /api/ai endpoint
   (ANTHROPIC_API_KEY lives in Vercel env, never in the browser).
═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   Phase 2.1 — writeBrokerCreatedLog (audit helper)
   Writes a lead_assignment_log row when a broker creates a lead.
   Fail-safe: errors are logged but NOT thrown, so a failed log
   write never breaks the lead-creation flow itself.
═══════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════
   Phase F — Opportunities Tab (information architecture restructure)
   This is Step 1: a placeholder so the tab is wired into nav.
   Subsequent commits will replace this with the full module.
═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   Phase F W6 — CreateOpportunityDialog (Layer 3 dedup + Layer 1 awareness)
   Two-step flow: (1) lookup-or-create lead by phone/email, (2) opp details.

   Layer 3 — DATA HYGIENE:
     - Email-first dedup (email match = strong signal, hard warn)
     - Phone normalisation before compare (strip spaces/dashes/+/leading 0)
     - Server-side check on save (catches race conditions)
     - V2-quality form: country code dropdown, structured nationality

   Layer 1 — CONFLICT AWARENESS:
     - When existing lead found, surface owner + last contact + stage + units
     - AI summary of the situation
     - Block-and-coordinate flow (no transfer/co-broker — that's Layer 2,
       deferred until Al Mansoori defines lead-ownership policy)
═══════════════════════════════════════════════════════════════ */

// Normalise phone for fuzzy comparison: strip everything that isn't a digit,
// then drop leading "971" or "0" so "+9715012345" / "9715012345" / "0501-2345"
// all become "5012345" (the "interesting" part of the number).

export default OpportunityDetail;

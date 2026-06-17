import React, { useState, useRef, useEffect } from 'react';
import { supabase } from "../../lib/supabase.js";
import { Modal } from "../../modules/shared/Modal.jsx";
import UnitSearchPicker from "../UnitSearchPicker.jsx";
import { Btn } from "../../modules/shared/Btn.jsx";
import { FF } from "../../modules/shared/FormComponents.jsx";
import { PAYMENT_PLAN_PRESETS, DLD_OPTIONS, SERVICE_CHARGE_PRESETS, VALIDITY_PRESETS } from "../../modules/constants.js";
import { useDraggable } from "../../lib/useDraggable.js";
import { aiInvoke } from '../../lib/aiInvoke.js';
import { generateProposalPDF } from "../../lib/generateProposalPDF.js";
import { uploadProposalPDF } from "../../lib/uploadProposalPDF.js";

function ProposalBuilderDialog({ opp, lead, units, projects, salePricing, currentUser, lastProposal, onClose, onSaved, showToast }) {
  /* draggable-sendproposal */ const { ref: dragRef, posStyle, handleProps } = useDraggable({ open: true });
  // 21 May 2026 Phase B: Pre-fill from V_latest when broker clicks Edit
  // Pre-fill: discount, plan, DLD, service charge, proposal units
  // Keep fresh: validity days (new expiry), cover notes (fresh story)
  const lastSd = lastProposal?.structured_data || {};
  const isRevision = !!lastProposal;
  // Multi-unit proposal: each unit has its own pricing block
  // Pre-seed with the opp's linked unit if available
  const linkedUnit = units.find(x => x.id === opp.unit_id);
  const buildLinkedUnitRow = () => {
    if (!linkedUnit) return null;
    const sp = (salePricing||[]).find(s => s.unit_id === linkedUnit.id);
    const askingPrice = sp?.asking_price || opp.budget || 0;
    return {
      unit_id: linkedUnit.id,
      asking_price: askingPrice,
      discount_pct: 0,
      discounted_price: askingPrice,
    };
  };

  // Toggle: should the opp's linked unit pre-load as the starting point?
  // Default: true (most common — broker is proposing the unit they qualified the buyer for)
  // Flip OFF: agent wants a totally different proposal (e.g. buyer changed their mind on size)
  const [useLinkedUnit, setUseLinkedUnit] = useState(true); // 21 May 2026 Phase B fix: keep ON for revisions too (useEffect adds linked unit idempotently)
  const [proposalUnits, setProposalUnits] = useState(() => {
    // 21 May 2026 Phase B: For revisions, pre-fill from V_latest's units (preserves discounts)
    if (isRevision && lastSd.proposal_units && lastSd.proposal_units.length > 0) {
      return lastSd.proposal_units.map(pu => ({
        unit_id: pu.unit_id,
        asking_price: Number(pu.asking_price || 0),
        discount_pct: Number(pu.discount_pct || 0),
        discounted_price: Number(pu.discounted_price || 0),
      }));
    }
    const row = buildLinkedUnitRow();
    return row ? [row] : [];
  });
  const [paymentPlanPreset, setPaymentPlanPreset] = useState(isRevision && lastSd.payment_plan_preset ? lastSd.payment_plan_preset : "10/90");
  const [paymentPlan, setPaymentPlan] = useState(isRevision && (lastProposal?.payment_plan || lastSd.payment_plan) ? (lastProposal?.payment_plan || lastSd.payment_plan) : "10% on booking · 90% on handover");
  const [dldHandling, setDldHandling] = useState(isRevision && lastSd.dld_handling ? lastSd.dld_handling : "buyer_pays");
  const [dldCustomAmount, setDldCustomAmount] = useState("");
  const [serviceChargePreset, setServiceChargePreset] = useState(isRevision && lastSd.service_charge_preset ? lastSd.service_charge_preset : "none");
  const [serviceChargeCustom, setServiceChargeCustom] = useState("");
  const [validityDays, setValidityDays] = useState(10);
  const [coverNotes, setCoverNotes] = useState("");
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [unitPickerQuery, setUnitPickerQuery] = useState(""); // search filter for the manual unit picker
  const [saving, setSaving] = useState(false);

  // Phase F — AI Match state
  const [showAiMatch, setShowAiMatch] = useState(false);
  const [aiMatchPrompt, setAiMatchPrompt] = useState("");
  const [aiMatching, setAiMatching] = useState(false);
  const [aiMatches, setAiMatches] = useState([]); // [{unit_id, score, reason}]
  const [aiMatchError, setAiMatchError] = useState("");

  // Phase F — AI Compose state (cover message + smart terms suggestion)
  const [aiComposing, setAiComposing] = useState(false);
  const [aiComposeError, setAiComposeError] = useState("");
  const [aiSuggestingTerms, setAiSuggestingTerms] = useState(false);
  const [aiTermsSuggestion, setAiTermsSuggestion] = useState(null); // {payment_plan, dld_handling, service_charge_preset, validity_days, reasoning}
  const [aiTermsError, setAiTermsError] = useState("");

  // React to the toggle: when flipped on, add linked unit if not present;
  // when flipped off, remove it (only if it's the linked unit and unmodified).
  useEffect(() => {
    if (useLinkedUnit) {
      setProposalUnits(prev => {
        if (!linkedUnit) return prev;
        if (prev.find(u => u.unit_id === linkedUnit.id)) return prev;
        const row = buildLinkedUnitRow();
        return row ? [row, ...prev] : prev;
      });
    } else {
      setProposalUnits(prev => prev.filter(u => u.unit_id !== opp.unit_id));
    }
    // eslint-disable-next-line
  }, [useLinkedUnit]);

  // Compute expiry date
  const expiryDate = (()=>{
    const d = new Date(); d.setDate(d.getDate() + Number(validityDays||0)); d.setHours(23,59,59,0);
    return d;
  })();

  const fmtAed = (n) => `AED ${Number(n||0).toLocaleString()}`;

  // Default cover note template — generated from current state
  useEffect(() => {
    if (coverNotes) return; // don't overwrite user edits
    if (!lead) return;
    const greeting = lead.name ? `Dear ${lead.name},` : `Dear Sir/Madam,`;
    const closing = `Looking forward to your response. The terms above are valid until ${expiryDate.toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}.\n\nBest regards,\n${currentUser.full_name||"PropCRM"}`;
    setCoverNotes(`${greeting}\n\nThank you for your interest. Please find below our proposal for your consideration.\n\n${closing}`);
    // eslint-disable-next-line
  }, [lead?.name]);

  // Seed AI Match prompt from lead requirements / opp budget
  useEffect(() => {
    if (aiMatchPrompt) return;
    const bits = [];
    if (lead?.budget) bits.push(`Budget around AED ${Number(lead.budget).toLocaleString()}`);
    else if (opp?.budget) bits.push(`Budget around AED ${Number(opp.budget).toLocaleString()}`);
    if (lead?.property_type) bits.push(lead.property_type);
    if (lead?.notes) bits.push(lead.notes);
    setAiMatchPrompt(bits.join(". "));
    // eslint-disable-next-line
  }, [lead?.id]);

  // Update a unit row
  const updateUnit = (idx, patch) => {
    setProposalUnits(prev => prev.map((u, i) => {
      if (i !== idx) return u;
      const next = {...u, ...patch};
      // Recompute discounted_price when discount_pct changes
      if ("discount_pct" in patch && !("discounted_price" in patch)) {
        const pct = Number(patch.discount_pct||0);
        next.discounted_price = Math.round(Number(u.asking_price||0) * (1 - pct/100));
      }
      // If discounted_price changes directly, recompute discount_pct
      if ("discounted_price" in patch && !("discount_pct" in patch)) {
        const ask = Number(u.asking_price||0);
        const disc = Number(patch.discounted_price||0);
        next.discount_pct = ask > 0 ? Number((((ask - disc) / ask) * 100).toFixed(2)) : 0;
      }
      return next;
    }));
  };

  const addUnit = (unitId) => {
    if (proposalUnits.find(u => u.unit_id === unitId)) {
      showToast("Unit already in proposal","error");
      return;
    }
    const u = units.find(x => x.id === unitId);
    if (!u) return;
    const sp = (salePricing||[]).find(s => s.unit_id === u.id);
    const askingPrice = sp?.asking_price || 0;
    setProposalUnits(prev => [...prev, {
      unit_id: u.id,
      asking_price: askingPrice,
      discount_pct: 0,
      discounted_price: askingPrice,
    }]);
    setShowAddUnit(false);
  };

  const removeUnit = (idx) => {
    setProposalUnits(prev => prev.filter((_,i)=>i!==idx));
  };

  // Picker for the "Add another unit" sub-flow — same rich-row approach as Site Visit picker
  const availableUnits = units.filter(u => !proposalUnits.find(p => p.unit_id === u.id));

  // Phase F — AI Match: send buyer requirements + inventory snapshot to Claude,
  // get back ranked unit IDs with reasons. Filters to units not already in proposal.
  const runAiMatch = async () => {
    if (!aiMatchPrompt.trim()) {
      setAiMatchError("Please describe what the buyer is looking for.");
      return;
    }
    if (availableUnits.length === 0) {
      setAiMatchError("No more units in inventory to match against.");
      return;
    }
    setAiMatching(true);
    setAiMatchError("");
    setAiMatches([]);
    try {
      // Compact, structured snapshot of inventory for the model
      const inventory = availableUnits.slice(0, 80).map(u => {
        const proj = projects.find(p => p.id === u.project_id);
        const sp = (salePricing||[]).find(s => s.unit_id === u.id);
        return {
          id: u.id,
          ref: u.unit_ref,
          project: proj?.name || null,
          bedrooms: u.bedrooms,
          sub_type: u.sub_type,
          size_sqft: u.size_sqft,
          floor: u.floor_number,
          view: u.view,
          status: u.status,
          asking_price: sp?.asking_price || null,
        };
      });
      const system = `You are PropPulse AI, an expert UAE real-estate broker assistant. Match available property units to a buyer's requirements with precision. UAE market context: AED prices, Dubai/Sharjah/Abu Dhabi markets, off-plan vs ready, 4% DLD fees, common payment plans (10/90, 20/80, 50/50). Always respond with valid JSON only — no prose, no markdown fences.`;
      const userPrompt = `BUYER REQUIREMENTS:
${aiMatchPrompt}

LEAD CONTEXT:
- Name: ${lead?.name || "—"}
- Nationality: ${lead?.nationality || "—"}
- Source: ${lead?.source || "—"}
- Property type interest: ${lead?.property_type || "—"}
- Stated budget: ${lead?.budget ? `AED ${Number(lead.budget).toLocaleString()}` : opp?.budget ? `AED ${Number(opp.budget).toLocaleString()}` : "—"}
- Notes: ${lead?.notes || "—"}

AVAILABLE UNITS:
${JSON.stringify(inventory, null, 2)}

TASK: Pick the TOP 5 best matches (or fewer if fewer good fits). For each, give a one-sentence reason mentioning SPECIFIC features matching the requirements (price, bedroom count, view, project, etc.). Do not invent fields. Score 0-100.

RESPOND WITH VALID JSON ONLY in this exact shape:
{"matches":[{"unit_id":"<id from list>","score":<0-100>,"reason":"<one-sentence reason>"}]}`;
      const reply = await aiInvoke({ system, prompt: userPrompt, max_tokens: 3000 });
      const cleaned = reply.replace(/```json\s*/g,"").replace(/```\s*$/g,"").trim();
      let parsed;
      try { parsed = JSON.parse(cleaned); }
      catch (e) {
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (!m) throw new Error("AI response was not valid JSON");
        parsed = JSON.parse(m[0]);
      }
      const matches = Array.isArray(parsed.matches) ? parsed.matches : [];
      const available_ids = new Set(availableUnits.map(u=>u.id));
      const filtered = matches.filter(m => available_ids.has(m.unit_id)).slice(0, 5);
      if (filtered.length === 0) {
        setAiMatchError("AI didn't find good matches. Try giving more detail in the requirements.");
      } else {
        setAiMatches(filtered);
      }
    } catch (e) {
      console.error("AI Match failed:", e);
      setAiMatchError(`AI Match failed: ${e.message || "unknown error"}`);
    } finally {
      setAiMatching(false);
    }
  };

  // Phase F — AI Compose: generate a UAE business-tone cover message that references
  // the buyer's specific situation (units in proposal, terms set, prior conversations).
  const runAiCompose = async () => {
    if (proposalUnits.length === 0) {
      setAiComposeError("Add at least one unit before generating the cover message.");
      return;
    }
    setAiComposing(true);
    setAiComposeError("");
    try {
      // Build unit summary for the prompt
      const unitsContext = proposalUnits.map(pu => {
        const u = units.find(x => x.id === pu.unit_id);
        const proj = u ? projects.find(p => p.id === u.project_id) : null;
        const bedLabel = u?.bedrooms === 0 ? "Studio" : (u?.bedrooms ? `${u.bedrooms} BR` : "");
        return {
          ref: u?.unit_ref,
          project: proj?.name,
          type: u?.sub_type,
          beds: bedLabel,
          size_sqft: u?.size_sqft,
          view: u?.view,
          asking_price_aed: pu.asking_price,
          discount_pct: pu.discount_pct,
          final_price_aed: pu.discounted_price,
        };
      });
      const dldLabel = DLD_OPTIONS.find(o=>o.value===dldHandling)?.label || dldHandling;
      const scLabel = SERVICE_CHARGE_PRESETS.find(o=>o.value===serviceChargePreset)?.label || "None";
      // Determine language hint from lead nationality
      const arabicLeaning = ["UAE","Emirati","Saudi","Egyptian","Lebanese","Jordanian","Syrian","Iraqi","Kuwaiti","Qatari","Bahraini","Omani"].includes(lead?.nationality || "");
      const system = `You are PropPulse AI, drafting professional UAE real-estate proposal cover messages on behalf of a real estate broker. Tone: respectful, professional, warm but not over-friendly. UAE business style. Short and clear. Address the buyer by name. Reference SPECIFIC units in the proposal and SPECIFIC terms (payment plan, DLD handling). Mention validity. Sign off with the broker's name. Do NOT invent facts — only use what's provided. Output ONLY the cover message text — no preamble, no commentary, no markdown.`;
      const userPrompt = `Draft a cover message for this property proposal.

BUYER:
- Name: ${lead?.name || "—"}
- Nationality: ${lead?.nationality || "—"}
- Source: ${lead?.source || "—"}
- Stated requirements: ${lead?.notes || "—"}
- Budget: ${lead?.budget ? `AED ${Number(lead.budget).toLocaleString()}` : "—"}

UNITS IN THIS PROPOSAL:
${JSON.stringify(unitsContext, null, 2)}

TERMS:
- Payment plan: ${paymentPlan}
- DLD fee: ${dldLabel}${dldHandling==="specific_amount" && dldCustomAmount ? ` (AED ${Number(dldCustomAmount).toLocaleString()} waived)` : ""}
- Service charge waiver: ${scLabel}
- Validity: ${validityDays} days (until ${expiryDate.toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})})

BROKER:
- Name: ${currentUser.full_name || "PropCRM"}

LANGUAGE: English${arabicLeaning ? " (the buyer is from an Arabic-speaking region — feel free to add a brief Arabic greeting like 'السلام عليكم' if culturally appropriate, but keep the body in English unless instructed otherwise)" : ""}

Write the cover message now. Keep it under 200 words.`;
      const reply = await aiInvoke({ system, prompt: userPrompt, max_tokens: 3000 });
      // Strip any accidental markdown fences
      const cleaned = reply.replace(/^```[a-z]*\s*/i,"").replace(/```\s*$/,"").trim();
      setCoverNotes(cleaned);
      showToast("✨ Cover message generated","success");
    } catch (e) {
      console.error("AI Compose failed:", e);
      setAiComposeError(`Couldn't generate: ${e.message || "unknown error"}`);
      showToast("AI Compose failed — see proposal builder","error");
    } finally {
      setAiComposing(false);
    }
  };

  // Phase F — AI Suggest Terms: recommend payment plan, DLD handling, service charge,
  // validity based on unit type/price/buyer profile and UAE market norms.
  const runAiSuggestTerms = async () => {
    if (proposalUnits.length === 0) {
      setAiTermsError("Add at least one unit first.");
      return;
    }
    setAiSuggestingTerms(true);
    setAiTermsError("");
    setAiTermsSuggestion(null);
    try {
      const unitsContext = proposalUnits.map(pu => {
        const u = units.find(x => x.id === pu.unit_id);
        const proj = u ? projects.find(p => p.id === u.project_id) : null;
        return {
          ref: u?.unit_ref,
          project: proj?.name,
          handover: proj?.handover_date || null, // off-plan signal
          type: u?.sub_type,
          beds: u?.bedrooms,
          size_sqft: u?.size_sqft,
          asking_price_aed: pu.asking_price,
          final_price_aed: pu.discounted_price,
        };
      });
      const totalValue = proposalUnits.reduce((s,p)=>s+Number(p.discounted_price||0),0);
      const system = `You are PropPulse AI, an expert UAE real-estate broker advisor. Recommend optimal proposal terms based on UAE market norms. Consider:
- OFF-PLAN units: payment plan should typically be 10/90, 20/80, 40/60, or 50/50 with post-handover. Service-charge waivers (1-2 years) are common as developer concessions.
- READY units: payment plan is usually a single payment or short installments. Service-charge waivers less common.
- DLD fee (4% of property value) handling: typically buyer pays; 50/50 split is a common concession in slow markets; full developer absorption is for premium/distress sales.
- Validity: 7-14 days standard for off-plan (default 10), 3-7 days for resale.
- Higher-budget buyers may benefit from more flexible payment plans to ease cashflow.

Always respond with valid JSON only — no prose, no markdown fences.`;
      const userPrompt = `Recommend the BEST proposal terms for this deal.

BUYER:
- Name: ${lead?.name || "—"}
- Nationality: ${lead?.nationality || "—"}
- Stated requirements: ${lead?.notes || "—"}
- Budget: ${lead?.budget ? `AED ${Number(lead.budget).toLocaleString()}` : "—"}

UNITS (${proposalUnits.length} total, AED ${totalValue.toLocaleString()}):
${JSON.stringify(unitsContext, null, 2)}

CURRENT (agent's draft) terms:
- Payment plan: ${paymentPlan}
- DLD: ${dldHandling}
- Service charge: ${serviceChargePreset}
- Validity: ${validityDays} days

TASK: Recommend the optimal terms. Give a one-sentence reason for each choice.

RESPOND WITH VALID JSON ONLY in this exact shape:
{
  "payment_plan_preset": "<one of: 10/90 | 20/80 | 50/50 PHP | 40/60 | Custom>",
  "payment_plan_text": "<full payment plan description if Custom, else copy the standard text for the preset>",
  "dld_handling": "<one of: buyer_pays | split_5050 | developer_pays | specific_amount>",
  "service_charge_preset": "<one of: none | 6_months | 1_year | 2_years | custom>",
  "validity_days": <one of: 7 | 10 | 14 | 21>,
  "reasoning": "<2-3 short sentences explaining the recommendations>"
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
      setAiTermsSuggestion(parsed);
    } catch (e) {
      console.error("AI Suggest Terms failed:", e);
      setAiTermsError(`Couldn't suggest: ${e.message || "unknown error"}`);
    } finally {
      setAiSuggestingTerms(false);
    }
  };

  // Apply AI's term suggestion to the form (one-click accept)
  const applyAiTerms = () => {
    if (!aiTermsSuggestion) return;
    const s = aiTermsSuggestion;
    if (s.payment_plan_preset) {
      const preset = PAYMENT_PLAN_PRESETS.find(p => p.label === s.payment_plan_preset);
      if (preset) {
        setPaymentPlanPreset(preset.label);
        setPaymentPlan(s.payment_plan_text || preset.value || s.payment_plan_preset);
      } else if (s.payment_plan_text) {
        setPaymentPlanPreset("Custom");
        setPaymentPlan(s.payment_plan_text);
      }
    }
    if (s.dld_handling && DLD_OPTIONS.find(o=>o.value===s.dld_handling)) {
      setDldHandling(s.dld_handling);
    }
    if (s.service_charge_preset && SERVICE_CHARGE_PRESETS.find(o=>o.value===s.service_charge_preset)) {
      setServiceChargePreset(s.service_charge_preset);
    }
    if (s.validity_days && VALIDITY_PRESETS.includes(Number(s.validity_days))) {
      setValidityDays(Number(s.validity_days));
    }
    showToast("✓ AI suggestions applied — review before sending","success");
    setAiTermsSuggestion(null); // collapse the suggestion card after apply
  };

  // Build a human-readable summary for email body / activity note
  const buildSummaryText = () => {
    const lines = [];
    lines.push("PROPOSAL SUMMARY");
    lines.push("─".repeat(40));
    proposalUnits.forEach((pu, i) => {
      const u = units.find(x => x.id === pu.unit_id);
      const proj = u ? projects.find(p => p.id === u.project_id) : null;
      lines.push(`Option ${i+1}: ${u?.unit_ref||"—"}${proj?.name?` · ${proj.name}`:""}`);
      const bedLabel = u?.bedrooms === 0 ? "Studio" : (u?.bedrooms ? `${u.bedrooms} BR` : "");
      lines.push(`  ${[bedLabel, u?.size_sqft?`${u.size_sqft} sqft`:null, u?.view].filter(Boolean).join(" · ")}`);
      lines.push(`  Asking price: ${fmtAed(pu.asking_price)}`);
      if (Number(pu.discount_pct||0) > 0) {
        lines.push(`  Discount: ${pu.discount_pct}%`);
        lines.push(`  Final price: ${fmtAed(pu.discounted_price)}`);
      }
      lines.push("");
    });
    lines.push(`Payment plan: ${paymentPlan}`);
    const dldLabel = DLD_OPTIONS.find(o=>o.value===dldHandling)?.label || dldHandling;
    lines.push(`DLD fee: ${dldLabel}${dldHandling==="specific_amount" && dldCustomAmount ? ` — ${fmtAed(dldCustomAmount)} waived` : ""}`);
    if (serviceChargePreset !== "none") {
      const scLabel = SERVICE_CHARGE_PRESETS.find(o=>o.value===serviceChargePreset)?.label || serviceChargePreset;
      lines.push(`Service charge waiver: ${scLabel}${serviceChargePreset==="custom" && serviceChargeCustom ? ` (${serviceChargeCustom})` : ""}`);
    }
    lines.push(`Valid until: ${expiryDate.toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}`);
    return lines.join("\n");
  };

  const submit = async (sendEmail) => {
    if (proposalUnits.length === 0) {
      showToast("Add at least one unit to the proposal","error");
      return;
    }
    if (!paymentPlan.trim()) {
      showToast("Set a payment plan","error");
      return;
    }
    setSaving(true);
    try {
      const company_id = opp.company_id || currentUser.company_id || null;
      // Coerce all numeric fields to numbers (input values come back as strings)
      const cleanProposalUnits = proposalUnits.map(pu => ({
        unit_id: pu.unit_id,
        asking_price: Number(pu.asking_price||0),
        discount_pct: Number(pu.discount_pct||0),
        discounted_price: Number(pu.discounted_price||0),
      }));
      const primaryUnit = cleanProposalUnits[0];
      // Sum total proposal value (sum of discounted prices)
      const totalValue = cleanProposalUnits.reduce((sum, pu) => sum + pu.discounted_price, 0);

      // 15 May 2026 fix: Compute next version number from existing proposals
      // (Bug: all proposals were saving with version=1 because DB default fired)
      const { data: existingProps } = await supabase
        .from("proposals")
        .select("version")
        .eq("opportunity_id", opp.id)
        .order("version", { ascending: false })
        .limit(1);
      const nextVersion = existingProps && existingProps.length > 0
        ? (existingProps[0].version || 0) + 1
        : 1;

      // Build the FULL desired payload. We then attempt the insert and, if Supabase
      // complains about missing columns, retry with a minimal payload that puts
      // everything into structured_data. This lets the dialog work whether or not
      // migration 06 has been applied.
      const fullPayload = {
        opportunity_id: opp.id,
        lead_id: lead.id,
        company_id,
        version: nextVersion,  // 15 May 2026: explicit version (was relying on DB default which always returned 1)
        unit_id: primaryUnit.unit_id,
        asking_price: primaryUnit.asking_price,
        discount_pct: primaryUnit.discount_pct,
        discounted_price: primaryUnit.discounted_price,
        payment_plan: paymentPlan,
        expiry_date: expiryDate.toISOString().split("T")[0],
        notes: coverNotes,
        status: "sent",
        sent_at: new Date().toISOString(),
        created_by: currentUser.id,
        structured_data: {
          proposal_units: cleanProposalUnits,
          payment_plan_preset: paymentPlanPreset,
          payment_plan: paymentPlan,
          dld_handling: dldHandling,
          dld_custom_amount: dldHandling==="specific_amount" ? Number(dldCustomAmount||0) : null,
          service_charge_preset: serviceChargePreset,
          service_charge_custom: serviceChargePreset==="custom" ? serviceChargeCustom : null,
          validity_days: validityDays,
          total_value: totalValue,
          discounted_price: primaryUnit.discounted_price,
          asking_price: primaryUnit.asking_price,
          discount_pct: primaryUnit.discount_pct,
          notes: coverNotes,
          expiry_date: expiryDate.toISOString().split("T")[0],
        },
      };

      // STAGE GATE 2 (11 May 2026): Proposal value must be > 0
      // Per founder spec: "Proposal of 0 value not be sent"
      const askingPriceCheck = Number(fullPayload.asking_price || 0);
      const finalPriceCheck = Number(fullPayload.final_price || fullPayload.asking_price || 0);
      if (askingPriceCheck <= 0 || finalPriceCheck <= 0) {
        showToast(
          "⛔ Cannot send proposal at AED 0. Enter valid asking price first.",
          "error"
        );
        setSaving(false);
        return;
      }

      // 1. Insert proposal — defensive against missing schema columns
      const tryInsert = async (payload) => {
        return await supabase.from("proposals").insert(payload).select().single();
      };

      // Issue 3 polish 11 May 2026: preemptively route fields not in proposals schema
      // into structured_data, eliminating 3 failed HTTP calls per save attempt.
      // Schema drift refactor (proper column alignment) deferred to post-demo.
      const KNOWN_JSONB_FIELDS = ['discounted_price', 'lead_id', 'payment_plan'];
      const _preRoutedPayload = {...fullPayload};
      const _preRoutedSd = {...(fullPayload.structured_data || {})};
      KNOWN_JSONB_FIELDS.forEach(f => {
        if (_preRoutedPayload[f] !== undefined) {
          _preRoutedSd[f] = _preRoutedPayload[f];
          delete _preRoutedPayload[f];
        }
      });
      _preRoutedPayload.structured_data = _preRoutedSd;
      // 0. Fetch company data for branding
      let companyData = null;
      try {
        const { data } = await supabase
          .from("companies")
          .select("*")
          .eq("id", currentUser.company_id)
          .single();
        companyData = data;
      } catch (e) {
        console.warn("Company fetch failed (non-fatal):", e);
      }

      // 1. Generate + upload PDF before saving proposal
      try {
        const firstPropUnit = proposalUnits[0];
        const contextUnit = units.find(u => u.id === firstPropUnit.unit_id);
        const contextProject = projects.find(p => p.id === contextUnit?.project_id);
        
        const pdfBlob = await generateProposalPDF({
          lead,
          coverNotes,
          proposalUnits,
          selectedPaymentPlan: paymentPlanPreset,
          validityDays: validityDays,
          unit: contextUnit,
          project: contextProject,
          currentUser,
          company: companyData,
        });
        
        const pdfUrl = await uploadProposalPDF(
          pdfBlob,
          `proposal-${(lead.name||"buyer").replace(/\s+/g,"_")}.pdf`,
          currentUser.company_id
        );
        
        _preRoutedPayload.pdf_url = pdfUrl;
      } catch (e) {
        console.warn("PDF generation/upload failed (non-fatal):", e);
        showToast("Proposal saved, but PDF generation failed","warning");
      }
      


      let { data: propData, error: propErr } = await tryInsert(_preRoutedPayload);
      if (propErr && /Could not find the '(.+?)' column/.test(propErr.message||"")) {
        // Strip every missing column the error mentions, retry repeatedly until success
        // (Supabase only reports one column at a time)
        let payload = {...fullPayload};
        let attempts = 0;
        while (propErr && /Could not find the '(.+?)' column/.test(propErr.message||"") && attempts < 12) {
          const missing = propErr.message.match(/Could not find the '(.+?)' column/)[1];
          // Issue 3 fix 11 May 2026: structured_data column created in proposals table
          // Retry-and-recover still happens for fields not yet promoted to direct columns
          // (no console.warn - recovery is silent and successful)
          // TODO post-demo: schema drift refactor to eliminate trial-and-error retries
          // Move it into structured_data so we don't lose the value
          if (payload[missing] !== undefined) {
            payload.structured_data = {...(payload.structured_data||{}), [missing]: payload[missing]};
            delete payload[missing];
          } else {
            // Unknown source — just stop
            break;
          }
          attempts++;
          ({ data: propData, error: propErr } = await tryInsert(payload));
        }
      }
      if (propErr) {
        console.error("Proposal insert failed:", propErr);
        showToast(`Failed to save proposal: ${propErr.message}`,"error");
        setSaving(false);
        return;
      }

      // 2. Stamp proposal_sent_at on opportunity (do NOT auto-advance stage —
      //    agent owns stage progression. Sending a proposal is just an event
      //    in the timeline; stage moves are deliberate, separate decisions.)
      // 14 May 2026 Day 2 Math Flow: ALSO sync current_* fields from proposal
      // so downstream stages (Negotiation, Acceptance, SPA) read the proposal terms.
      let _dldPayer = null, _dldSplitPct = null, _dldAmount = null;
      if (dldHandling === 'buyer_pays') {
        _dldPayer = 'buyer';
      } else if (dldHandling === 'split_5050') {
        _dldPayer = 'split';
        _dldSplitPct = 50;
      } else if (dldHandling === 'developer_absorbs') {
        _dldPayer = 'developer';
      } else if (dldHandling === 'specific_amount_waived' || dldHandling === 'specific_amount') {
        _dldPayer = 'negotiated';
      }
      const _agreedPrice = Number(primaryUnit.discounted_price || primaryUnit.asking_price || 0);
      if (_dldPayer === 'buyer') {
        _dldAmount = Math.round(_agreedPrice * 0.04 * 100) / 100;
      } else if (_dldPayer === 'split') {
        _dldAmount = Math.round(_agreedPrice * 0.04 * 0.5 * 100) / 100;
      } else if (_dldPayer === 'developer') {
        _dldAmount = 0;
      } else if (_dldPayer === 'negotiated' && dldCustomAmount) {
        _dldAmount = Number(dldCustomAmount);
      }
      const _discountPct = Number(primaryUnit.discount_pct || 0);
      const { error: oppErr } = await supabase.from("opportunities").update({
        proposal_sent_at: new Date().toISOString(),
        // Math flow current_* sync from proposal
        current_agreed_price: _agreedPrice,
        current_discount_type: _discountPct > 0 ? 'percent' : null,
        current_discount_value: _discountPct > 0 ? _discountPct : null,
        current_discount_source: `proposal_v${propData?.version || 1}`,
        current_dld_payer: _dldPayer,
        current_dld_split_pct: _dldSplitPct,
        current_dld_amount: _dldAmount,
        // 18 May 2026: Persist payment plan preset for SPA initial advance calculation
        current_payment_plan_preset: paymentPlanPreset || null,
        current_values_updated_at: new Date().toISOString(),
        current_values_updated_by: currentUser.id,
      }).eq("id", opp.id);
      if (oppErr) {
        console.warn("proposal_sent_at + current_* sync failed (non-fatal):", oppErr);
      }

      // 3. Insert activity — stage_at_event reflects current stage, not "Proposal Sent"
      const { data: actRow } = await supabase.from("activities").insert({
        opportunity_id: opp.id, lead_id: lead.id, company_id,
        type: "Proposal",
        note: `📤 Proposal sent — ${proposalUnits.length} unit${proposalUnits.length===1?"":"s"} · Total ${fmtAed(totalValue)}`,
        status: "completed",
        user_id: currentUser.id, user_name: currentUser.full_name, lead_name: lead.name,
        stage_at_event: opp.stage,
        from_stage: null,
        to_stage: null,
        triggered_stage_change: false,
        activity_subtype: "proposal_sent",
        structured_data: {proposal_id: propData.id, ...fullPayload.structured_data},
      }).select().single();

      // 4. Auto-reminders: follow-up in 3 days, expiry warning on validity day
      const followUp = new Date(); followUp.setDate(followUp.getDate()+3); followUp.setHours(9,0,0,0);
      const expiryRemind = new Date(expiryDate); expiryRemind.setHours(9,0,0,0);

      const reminderRows = [
        {
          company_id, user_id: currentUser.id,
          related_opportunity_id: opp.id, related_lead_id: lead.id, related_activity_id: actRow?.id,
          trigger_at: followUp.toISOString(),
          title: `Follow up on proposal — ${lead.name}`,
          body: `${proposalUnits.length} unit${proposalUnits.length===1?"":"s"} · Total ${fmtAed(totalValue)}. Has the buyer responded?`,
          reason: "auto_proposal_followup",
          status: "pending",
          created_by: currentUser.id,
        },
      ];
      // Only add expiry reminder if it's after the follow-up (otherwise it's redundant)
      if (expiryRemind > followUp && expiryRemind > new Date()) {
        reminderRows.push({
          company_id, user_id: currentUser.id,
          related_opportunity_id: opp.id, related_lead_id: lead.id, related_activity_id: actRow?.id,
          trigger_at: expiryRemind.toISOString(),
          title: `Proposal expires today — ${lead.name}`,
          body: `Proposal validity ends today. Chase or extend.`,
          reason: "auto_proposal_expiring",
          status: "pending",
          created_by: currentUser.id,
        });
      }
      // Dedup: clear existing PENDING auto reminders for this opp before inserting fresh ones
      // (prevents stacking near-identical "Follow up on proposal" reminders on each save)
      await supabase.from("reminders")
        .delete()
        .eq("related_opportunity_id", opp.id)
        .eq("status", "pending")
        .in("reason", ["auto_proposal_followup","auto_proposal_expiring"]);
      await supabase.from("reminders").insert(reminderRows);

      // 5. If sendEmail, generate PDF + open mailto:
      if (sendEmail) {
        try {
          const subject = `Property Proposal — ${proposalUnits.length} Option${proposalUnits.length===1?"":"s"} for ${lead.name}`;
          
          // Get the first proposed unit for context
          const firstPropUnit = proposalUnits[0];
          const contextUnit = units.find(u => u.id === firstPropUnit.unit_id);
          const contextProject = projects.find(p => p.id === contextUnit?.project_id);
          
          // Generate PDF blob
          const pdfBlob = await generateProposalPDF({
            lead,
            coverNotes,
            proposalUnits,
            selectedPaymentPlan: paymentPlanPreset,
            validityDays: validityDays,
            unit: contextUnit,
            project: contextProject,
            currentUser,
          });
          
          const url = URL.createObjectURL(pdfBlob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `proposal-${(lead.name||"buyer").replace(/\s+/g,"_")}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(()=>URL.revokeObjectURL(url), 1000);
          
          // Open mail client
          const mailto = `mailto:${encodeURIComponent(lead.email||"")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent("Please see attached proposal.")}`;
          setTimeout(()=>{ window.location.href = mailto; }, 300);
        } catch (e) {
          console.warn("Send email step failed (non-fatal):", e);
          showToast("Proposal saved, but email step failed","error");
        }
      }

      showToast(sendEmail ? "✓ Proposal sent" : "✓ Proposal saved","success");
      onSaved(propData, actRow);
    } catch (e) {
      console.error("Proposal save error:", e);
      showToast(`Save failed: ${e.message||"unknown"}`,"error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
      <div ref={dragRef} style={{background:"#fff",borderRadius:16,width:680,maxWidth:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)",...posStyle}}>
        <div {...handleProps} style={{padding:"1.1rem 1.4rem",borderBottom:"1px solid #E8EDF4",background:"#0F2540",cursor:"move",userSelect:"none"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,color:"#fff"}}>📤 Send Proposal</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.65)",marginTop:3}}>
                Site Visit → <strong style={{color:"#C9A84C"}}>Proposal Sent</strong> · {lead?.name || "Buyer"}
              </div>
            </div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer",lineHeight:1}}>×</button>
          </div>
        </div>

        <div style={{padding:"1.1rem 1.4rem",flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:18}}>

          {/* Linked-unit toggle: opt-in to pre-seeding the opp's linked unit */}
          {linkedUnit && (
            <label style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",background:useLinkedUnit?"#FFFBEA":"#F8FAFC",border:`1px solid ${useLinkedUnit?"#FCD34D":"#E2E8F0"}`,borderRadius:8,cursor:"pointer",transition:"all .15s"}}>
              <input type="checkbox" checked={useLinkedUnit} onChange={e=>setUseLinkedUnit(e.target.checked)}
                style={{width:14,height:14,cursor:"pointer",accentColor:"#0F2540",flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>
                  Use linked unit (📍 {linkedUnit.unit_ref}) as starting point
                </div>
                <div style={{fontSize:10,color:"#94A3B8",marginTop:2}}>
                  {useLinkedUnit
                    ? "The opportunity's unit is pre-loaded as Option 1. You can still add more or remove it."
                    : "Starting fresh — pick whichever units suit this proposal. Use this when the buyer wants something different."}
                </div>
              </div>
            </label>
          )}

          {/* Units */}
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,gap:8,flexWrap:"wrap"}}>
              <label style={{fontSize:12,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px"}}>
                Units in this proposal *
              </label>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>{setShowAiMatch(s=>!s); if(!showAiMatch)setShowAddUnit(false);}}
                  style={{padding:"6px 12px",borderRadius:7,border:`1.5px solid ${showAiMatch?"#2DD4BF":"#5EEAD4"}`,background:showAiMatch?"#CCFBF1":"#FAF5FF",color:"#0F766E",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  {showAiMatch?"Cancel":"🪄 AI Match"}
                </button>
                <button onClick={()=>{setShowAddUnit(s=>!s); if(!showAddUnit)setShowAiMatch(false);}}
                  style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #1A5FA8",background:showAddUnit?"#1A5FA8":"#fff",color:showAddUnit?"#fff":"#1A5FA8",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  {showAddUnit?"Cancel":"+ Add another unit"}
                </button>
              </div>
            </div>

            {/* AI Match panel */}
            {showAiMatch && (
              <div style={{marginBottom:10,background:"#F0FDFA",border:"1px solid #CCFBF1",borderRadius:10,padding:12}}>
                <div style={{fontSize:11,fontWeight:700,color:"#0F766E",textTransform:"uppercase",letterSpacing:".5px",marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
                  <span>🪄 PropPulse AI · Smart Match</span>
                  <span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:"#ECFEFF",color:"#0E7490",fontWeight:600,border:"1px solid #CCFBF1"}}>BETA</span>
                </div>
                <div style={{fontSize:11,color:"#64748B",marginBottom:8}}>
                  Describe what the buyer is looking for. AI will rank the top matches from your inventory with reasons.
                </div>
                <textarea value={aiMatchPrompt} onChange={e=>setAiMatchPrompt(e.target.value)} rows={3}
                  placeholder="e.g. 2BR around AED 1.5-2M, sea or pool view, prefers Sobha or Damac, willing to wait for off-plan handover, payment plan flexibility important"
                  style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #CCFBF1",fontSize:12,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",background:"#fff"}}/>
                <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8,flexWrap:"wrap"}}>
                  <button onClick={runAiMatch} disabled={aiMatching}
                    style={{padding:"7px 16px",borderRadius:7,border:"1px solid #5EEAD4",background:aiMatching?"#CCFBF1":"#ECFEFF",color:"#0F766E",fontSize:12,fontWeight:700,cursor:aiMatching?"wait":"pointer",display:"flex",alignItems:"center",gap:6}}>
                    {aiMatching?<>🪄 Matching…</>:<>🪄 Find best matches</>}
                  </button>
                  <span style={{fontSize:10,color:"#94A3B8"}}>
                    Searching {availableUnits.length} available unit{availableUnits.length===1?"":"s"}
                  </span>
                </div>
                {aiMatchError && (
                  <div style={{marginTop:8,padding:"8px 10px",background:"#FEE2E2",border:"1px solid #FCA5A5",borderRadius:6,fontSize:11,color:"#C53030"}}>
                    {aiMatchError}
                  </div>
                )}
                {aiMatches.length > 0 && (
                  <div style={{marginTop:10,display:"flex",flexDirection:"column",gap:6}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#0F766E",textTransform:"uppercase",letterSpacing:".5px"}}>
                      ✨ Top {aiMatches.length} Match{aiMatches.length===1?"":"es"}
                    </div>
                    {aiMatches.map((m,idx) => {
                      const u = units.find(x => x.id === m.unit_id);
                      if (!u) return null;
                      const proj = projects.find(p => p.id === u.project_id);
                      const sp = (salePricing||[]).find(s => s.unit_id === u.id);
                      const bedLabel = u.bedrooms === 0 ? "Studio" : (u.bedrooms ? `${u.bedrooms}BR` : "");
                      const scoreColor = m.score >= 85 ? "#1A7F5A" : m.score >= 65 ? "#A06810" : "#64748B";
                      const scoreBg = m.score >= 85 ? "#D1FAE5" : m.score >= 65 ? "#FEF3C7" : "#F1F5F9";
                      return (
                        <div key={m.unit_id} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:8,padding:"10px 12px"}}>
                          <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                            <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:scoreBg,color:scoreColor,letterSpacing:".4px"}}>
                              {m.score}% MATCH
                            </span>
                            <span style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{u.unit_ref}</span>
                            <span style={{fontSize:11,color:"#64748B"}}>
                              {[bedLabel, proj?.name, u.size_sqft?`${u.size_sqft} sqft`:null, u.view, sp?.asking_price?fmtAed(sp.asking_price):null].filter(Boolean).join(" · ")}
                            </span>
                          </div>
                          <div style={{fontSize:11,color:"#475569",fontStyle:"italic",marginBottom:8,lineHeight:1.5}}>
                            💡 {m.reason}
                          </div>
                          <button onClick={()=>{addUnit(m.unit_id); setAiMatches(prev=>prev.filter(x=>x.unit_id!==m.unit_id));}}
                            style={{padding:"5px 12px",borderRadius:6,border:"none",background:"#0F2540",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                            + Add to proposal
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Add-unit picker - now uses reusable UnitSearchPicker component (12 May 2026 refactor) */}
            {showAddUnit && (
              <div style={{marginBottom:10,background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8,padding:8}}>
                <UnitSearchPicker
                  units={availableUnits}
                  projects={projects}
                  salePricing={salePricing}
                  onSelect={(unitId) => addUnit(unitId)}
                  emptyMessage="No more units available to add"
                />
              </div>
            )}

            {/* Unit rows */}
            {proposalUnits.length === 0 ? (
              <div style={{padding:"1.5rem",textAlign:"center",color:"#94A3B8",border:"1px dashed #D1D9E6",borderRadius:8,fontSize:12}}>
                No units yet — click "Add another unit" above to start
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {proposalUnits.map((pu, idx) => {
                  const u = units.find(x => x.id === pu.unit_id);
                  const proj = u ? projects.find(p=>p.id===u.project_id) : null;
                  const bedLabel = u?.bedrooms === 0 ? "Studio" : (u?.bedrooms ? `${u.bedrooms}BR` : "");
                  const isPrimary = u?.id === opp.unit_id;
                  const discountPct = Number(pu.discount_pct||0);
                  const showApprovalBadge = discountPct >= 5;

                  return (
                    <div key={pu.unit_id} style={{background:"#FAFBFE",border:`1.5px solid ${isPrimary?"#C9A84C":"#E2E8F0"}`,borderRadius:10,padding:"12px 14px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,gap:8}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:3}}>
                            <span style={{fontSize:11,fontWeight:700,color:"#94A3B8"}}>OPTION {idx+1}</span>
                            {/* Phase 2.2b — Property Pack trigger */}
                            <button onClick={e=>{e.stopPropagation();openPropertyPack(pu.unit_id);}} title="View Property Pack" style={{padding:"2px 8px",borderRadius:5,border:"none",background:"#0F2540",color:"#fff",fontSize:9,fontWeight:700,cursor:"pointer"}}>📸 Pack</button>
                            <span style={{fontSize:14,fontWeight:700,color:"#0F2540"}}>{u?.unit_ref||"—"}</span>
                            {isPrimary && <span style={{fontSize:9,fontWeight:700,padding:"2px 7px",borderRadius:10,background:"#FEF3C7",color:"#7A4F01"}}>📍 LINKED UNIT</span>}
                          </div>
                          <div style={{fontSize:11,color:"#64748B"}}>
                            {[bedLabel, u?.size_sqft?`${u.size_sqft} sqft`:null, u?.view, proj?.name].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        {proposalUnits.length > 1 && (
                          <button onClick={()=>removeUnit(idx)}
                            style={{padding:"4px 10px",borderRadius:6,border:"1px solid #FCA5A5",background:"#fff",color:"#C53030",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                            Remove
                          </button>
                        )}
                      </div>

                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                        <div>
                          <label style={{fontSize:10,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".4px"}}>Asking price</label>
                          <div style={{position:"relative"}}>
                            <input type="number" value={pu.asking_price ?? 0}
                              onChange={e=>updateUnit(idx,{asking_price:e.target.value, discounted_price: Math.round(Number(e.target.value||0)*(1-Number(pu.discount_pct||0)/100))})}
                              style={{width:"100%",padding:"7px 10px",border:"1.5px solid #E2E8F0",borderRadius:7,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",background:"#fff"}}/>
                          </div>
                        </div>
                        <div>
                          <label style={{fontSize:10,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".4px"}}>
                            Discount % {showApprovalBadge && <span style={{color:"#C53030",fontWeight:700}}>· approval needed</span>}
                          </label>
                          <input type="number" min="0" max="50" step="0.1" value={pu.discount_pct ?? 0}
                            onChange={e=>updateUnit(idx,{discount_pct:e.target.value})}
                            style={{width:"100%",padding:"7px 10px",border:`1.5px solid ${showApprovalBadge?"#FCA5A5":"#E2E8F0"}`,borderRadius:7,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",background:"#fff"}}/>
                        </div>
                        <div>
                          <label style={{fontSize:10,fontWeight:600,color:"#64748B",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".4px"}}>Discounted price</label>
                          <input type="number" value={pu.discounted_price ?? 0}
                            onChange={e=>updateUnit(idx,{discounted_price:e.target.value})}
                            style={{width:"100%",padding:"7px 10px",border:"1.5px solid #E2E8F0",borderRadius:7,fontSize:12,fontFamily:"inherit",boxSizing:"border-box",background:"#fff",fontWeight:700,color:"#1A5FA8"}}/>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Suggest Terms — recommend payment plan / DLD / SC / validity */}
          <div style={{background:"#F0FDFA",border:"1px solid #CCFBF1",borderRadius:10,padding:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#0F766E",textTransform:"uppercase",letterSpacing:".5px",display:"flex",alignItems:"center",gap:6}}>
                  <span>💡 PropPulse AI · Suggest Terms</span>
                  <span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:"#ECFEFF",color:"#0E7490",fontWeight:600,border:"1px solid #CCFBF1"}}>BETA</span>
                </div>
                <div style={{fontSize:11,color:"#64748B",marginTop:3}}>
                  AI recommends payment plan, DLD handling, service charge, and validity based on UAE market norms and the buyer's profile.
                </div>
              </div>
              <button onClick={runAiSuggestTerms} disabled={aiSuggestingTerms || proposalUnits.length===0}
                title={proposalUnits.length===0?"Add at least one unit first":"Get AI's recommendation"}
                style={{padding:"7px 14px",borderRadius:7,border:"1px solid #5EEAD4",background:aiSuggestingTerms?"#CCFBF1":"#ECFEFF",color:"#0F766E",fontSize:11,fontWeight:700,cursor:(aiSuggestingTerms||proposalUnits.length===0)?"not-allowed":"pointer",opacity:proposalUnits.length===0?0.5:1,whiteSpace:"nowrap"}}>
                {aiSuggestingTerms?"💡 Thinking…":"💡 Suggest"}
              </button>
            </div>
            {aiTermsError && (
              <div style={{marginTop:8,padding:"8px 10px",background:"#FEE2E2",border:"1px solid #FCA5A5",borderRadius:6,fontSize:11,color:"#C53030"}}>
                {aiTermsError}
              </div>
            )}
            {aiTermsSuggestion && (
              <div style={{marginTop:10,background:"#fff",border:"1px solid #CCFBF1",borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontSize:10,fontWeight:700,color:"#0F766E",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>
                  ✨ AI Recommendation
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                  <div style={{background:"#F8FAFC",borderRadius:6,padding:"7px 10px"}}>
                    <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Payment plan</div>
                    <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{aiTermsSuggestion.payment_plan_preset||"—"}</div>
                    {aiTermsSuggestion.payment_plan_text && aiTermsSuggestion.payment_plan_text !== aiTermsSuggestion.payment_plan_preset && (
                      <div style={{fontSize:10,color:"#64748B",marginTop:2}}>{aiTermsSuggestion.payment_plan_text}</div>
                    )}
                  </div>
                  <div style={{background:"#F8FAFC",borderRadius:6,padding:"7px 10px"}}>
                    <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>DLD fee</div>
                    <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{DLD_OPTIONS.find(o=>o.value===aiTermsSuggestion.dld_handling)?.label||aiTermsSuggestion.dld_handling||"—"}</div>
                  </div>
                  <div style={{background:"#F8FAFC",borderRadius:6,padding:"7px 10px"}}>
                    <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Service charge</div>
                    <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{SERVICE_CHARGE_PRESETS.find(o=>o.value===aiTermsSuggestion.service_charge_preset)?.label||"None"}</div>
                  </div>
                  <div style={{background:"#F8FAFC",borderRadius:6,padding:"7px 10px"}}>
                    <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,textTransform:"uppercase",letterSpacing:".4px",marginBottom:2}}>Validity</div>
                    <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{aiTermsSuggestion.validity_days?`${aiTermsSuggestion.validity_days} days`:"—"}</div>
                  </div>
                </div>
                {aiTermsSuggestion.reasoning && (
                  <div style={{fontSize:11,color:"#475569",fontStyle:"italic",lineHeight:1.5,padding:"6px 8px",background:"#F8FAFC",borderRadius:6,marginBottom:8}}>
                    💡 {aiTermsSuggestion.reasoning}
                  </div>
                )}
                <div style={{display:"flex",gap:6}}>
                  <button onClick={applyAiTerms}
                    style={{padding:"6px 14px",borderRadius:6,border:"1px solid #2DD4BF",background:"#ECFEFF",color:"#0F766E",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                    ✓ Apply suggestions
                  </button>
                  <button onClick={()=>setAiTermsSuggestion(null)}
                    style={{padding:"6px 14px",borderRadius:6,border:"1.5px solid #D1D9E6",background:"#fff",color:"#64748B",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Payment plan */}
          <div>
            <label style={{fontSize:12,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Payment plan *</label>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:7}}>
              {PAYMENT_PLAN_PRESETS.map(p => {
                const sel = paymentPlanPreset === p.label;
                return (
                  <button key={p.label} onClick={()=>{setPaymentPlanPreset(p.label); if(p.value)setPaymentPlan(p.value);}}
                    style={{padding:"5px 12px",borderRadius:16,border:`1.5px solid ${sel?"#0F2540":"#D1D9E6"}`,background:sel?"#0F2540":"#fff",color:sel?"#fff":"#4A5568",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            <input type="text" value={paymentPlan} onChange={e=>{setPaymentPlan(e.target.value); setPaymentPlanPreset("Custom");}}
              placeholder="e.g. 20% on booking, 30% during construction, 50% on handover"
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>

          {/* DLD fee handling */}
          <div>
            <label style={{fontSize:12,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>DLD fee handling *</label>
            <div style={{fontSize:10,color:"#94A3B8",marginBottom:6}}>UAE standard: Dubai Land Department charges 4% of property value + AED 580 admin + AED 4,200 trustee for off-plan.</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {DLD_OPTIONS.map(o => {
                const sel = dldHandling === o.value;
                return (
                  <button key={o.value} onClick={()=>setDldHandling(o.value)}
                    style={{display:"flex",alignItems:"center",gap:8,padding:"8px 11px",borderRadius:7,border:`1.5px solid ${sel?o.color:"#E2E8F0"}`,background:sel?o.bg:"#fff",cursor:"pointer",textAlign:"left"}}>
                    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:16,height:16,borderRadius:"50%",border:`1.5px solid ${sel?o.color:"#CBD5E1"}`,background:sel?o.color:"#fff",flexShrink:0}}>
                      {sel && <span style={{width:6,height:6,borderRadius:"50%",background:"#fff"}}></span>}
                    </span>
                    <span style={{fontSize:12,color:sel?o.color:"#0F2540",fontWeight:sel?700:600}}>{o.label}</span>
                  </button>
                );
              })}
            </div>
            {dldHandling==="specific_amount" && (
              <input type="number" value={dldCustomAmount} onChange={e=>setDldCustomAmount(e.target.value)}
                placeholder="Amount waived in AED (e.g. 50000)"
                style={{marginTop:6,width:"100%",padding:"7px 10px",border:"1.5px solid #D1D9E6",borderRadius:7,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
            )}
          </div>

          {/* Service charge waiver */}
          <div>
            <label style={{fontSize:12,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Service charge waiver</label>
            <div style={{fontSize:10,color:"#94A3B8",marginBottom:6}}>Service charges = annual maintenance fees. Common developer concession: 1 year (max 2 in premium projects).</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {SERVICE_CHARGE_PRESETS.map(p => {
                const sel = serviceChargePreset === p.value;
                return (
                  <button key={p.value} onClick={()=>setServiceChargePreset(p.value)}
                    style={{padding:"5px 12px",borderRadius:16,border:`1.5px solid ${sel?"#1A7F5A":"#D1D9E6"}`,background:sel?"#E6F4EE":"#fff",color:sel?"#1A7F5A":"#4A5568",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    {p.label}
                  </button>
                );
              })}
            </div>
            {serviceChargePreset === "custom" && (
              <input type="text" value={serviceChargeCustom} onChange={e=>setServiceChargeCustom(e.target.value)}
                placeholder="e.g. 18 months waived, AED-capped at 50k"
                style={{marginTop:6,width:"100%",padding:"7px 10px",border:"1.5px solid #D1D9E6",borderRadius:7,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
            )}
          </div>

          {/* Validity */}
          <div>
            <label style={{fontSize:12,fontWeight:700,color:"#0F2540",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".4px"}}>Validity *</label>
            <div style={{fontSize:10,color:"#94A3B8",marginBottom:6}}>UAE off-plan standard: 7-14 days. Default 10 days.</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
              {VALIDITY_PRESETS.map(d => {
                const sel = validityDays === d;
                return (
                  <button key={d} onClick={()=>setValidityDays(d)}
                    style={{padding:"5px 12px",borderRadius:16,border:`1.5px solid ${sel?"#0F2540":"#D1D9E6"}`,background:sel?"#0F2540":"#fff",color:sel?"#fff":"#4A5568",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                    {d} days
                  </button>
                );
              })}
              <span style={{fontSize:11,color:"#64748B",marginLeft:6}}>→ expires <strong style={{color:"#0F2540"}}>{expiryDate.toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}</strong></span>
            </div>
          </div>

          {/* Cover notes */}
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:8,flexWrap:"wrap"}}>
              <label style={{fontSize:12,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px"}}>Cover message *</label>
              <button onClick={runAiCompose} disabled={aiComposing || proposalUnits.length===0}
                title={proposalUnits.length===0 ? "Add at least one unit first" : "Let AI draft this for you"}
                style={{padding:"5px 12px",borderRadius:6,border:"1px solid #5EEAD4",background:aiComposing?"#CCFBF1":"#ECFEFF",color:"#0F766E",fontSize:11,fontWeight:700,cursor:(aiComposing||proposalUnits.length===0)?"not-allowed":"pointer",opacity:proposalUnits.length===0?0.5:1}}>
                {aiComposing?"✨ Generating…":"✨ Generate with AI"}
              </button>
            </div>
            <textarea value={coverNotes} onChange={e=>setCoverNotes(e.target.value)} rows={5}
              placeholder="Personal note to the customer — gets included in the email body"
              style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box"}}/>
            {aiComposeError && (
              <div style={{marginTop:6,padding:"7px 10px",background:"#FEE2E2",border:"1px solid #FCA5A5",borderRadius:6,fontSize:11,color:"#C53030"}}>
                {aiComposeError}
              </div>
            )}
          </div>

          {/* Summary preview */}
          {proposalUnits.length>0 && (
            <details style={{background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:8}}>
              <summary style={{padding:"10px 14px",fontSize:11,fontWeight:700,color:"#0F2540",cursor:"pointer",textTransform:"uppercase",letterSpacing:".4px"}}>
                👀 Preview email body
              </summary>
              <pre style={{padding:"10px 14px",fontSize:11,color:"#475569",fontFamily:"'Inter',monospace",whiteSpace:"pre-wrap",margin:0,borderTop:"1px solid #E2E8F0",lineHeight:1.5}}>
                {coverNotes}{"\n\n"}{buildSummaryText()}
              </pre>
            </details>
          )}
        </div>

        <div style={{display:"flex",gap:10,justifyContent:"space-between",alignItems:"center",padding:"1rem 1.4rem",borderTop:"1px solid #E8EDF4",background:"#F8FAFC"}}>
          <div style={{fontSize:11,color:"#64748B"}}>
            {proposalUnits.length>0 && <>Total proposal value: <strong style={{color:"#0F2540"}}>{fmtAed(proposalUnits.reduce((s,p)=>s+Number(p.discounted_price||0),0))}</strong></>}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} disabled={saving}
              style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
              Cancel
            </button>
            <button onClick={()=>submit(false)} disabled={saving}
              style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #1A5FA8",background:"#fff",color:"#1A5FA8",fontSize:13,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
              {saving?"Saving…":"Save"}
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}


export default ProposalBuilderDialog;

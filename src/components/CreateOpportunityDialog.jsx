// CreateOpportunityDialog — extracted from App.jsx (MAP A2, ~1060 lines). Shared into LeadDetail + Opportunities via prop.
import UnitSaturationInline from "./opportunities/UnitSaturationInline.jsx";
import { analyzeUnitSaturation } from "../lib/unitSaturationAnalyzer.js";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { aiInvoke } from "../lib/aiInvoke.js";
import { COUNTRY_CODES, NATIONALITIES } from "../lib/refData.js";
import { openPropertyPack } from "./property/propertyPackBus.js";

import { canDo } from "../lib/permissions.js";

export default function CreateOpportunityDialog({ leads, setLeads, units, projects, salePricing, users, currentUser, showToast, onClose, onCreated, prefilledLead = null, prefilledUnit = null, opps = [] }) {
  // Step state - if lead is pre-selected (from Leads tab), skip Step 1
  const [step, setStep] = useState(prefilledLead ? 2 : 1);
  const [saving, setSaving] = useState(false);

  // Step 1: lead lookup
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState([]);
  const [selectedLead, setSelectedLead] = useState(prefilledLead);
  const [showCreateLeadForm, setShowCreateLeadForm] = useState(false);

  // Phase F W6 ext — AI conflict context for the chosen match (Layer 1)
  const [conflictContext, setConflictContext] = useState(null); // {ownerName, daysSinceContact, stage, unitRefs, recentProposals, aiSummary}
  const [loadingContext, setLoadingContext] = useState(false);

  // V2-style new lead form — split phone into country code + number,
  // structured nationality dropdown, named source list
  const [newLeadForm, setNewLeadForm] = useState({
    name: "",
    countryCode: "+971",
    phone: "",       // local part only (the number AFTER the country code)
    email: "",
    source: "Walk-in",
    nationality: "",
    budget: "",
    notes: "",
  });
  const [serverDupeBlock, setServerDupeBlock] = useState(null); // {kind, existingLead}

  // Step 2: opp form (pre-filled from selectedLead where possible)
  const [oppForm, setOppForm] = useState({
    title: "", unit_id: "", budget: "", assigned_to: currentUser?.id || "",
    notes: "", property_category: "Off-Plan",
    commission_pct: "", master_agreement_id: null,
  });

  // Stage 2 integration: auto-populate commission from master agreement
  const [masterAgreement, setMasterAgreement] = useState(null);
  const [agreementLoading, setAgreementLoading] = useState(false);
  const [commissionUserOverride, setCommissionUserOverride] = useState(false);

  // When unit changes, look up master agreement for that project's developer
  useEffect(() => {
    let cancelled = false;
    async function loadAgreement() {
      if (!oppForm.unit_id) {
        setMasterAgreement(null);
        if (!commissionUserOverride) {
          setOppForm(f => ({ ...f, commission_pct: "", master_agreement_id: null }));
        }
        return;
      }

      const unit = (units || []).find(u => u.id === oppForm.unit_id);
      if (!unit?.project_id) return;
      const project = (projects || []).find(p => p.id === unit.project_id);
      if (!project?.pp_developer_id) {
        setMasterAgreement(null);
        return;
      }

      try {
        setAgreementLoading(true);
        const { data, error } = await supabase
          .from("pp_master_agreements")
          .select("id, agreement_title, default_commission_pct, developer_name")
          .eq("company_id", currentUser.company_id)
          .eq("developer_id", project.pp_developer_id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1);

        if (cancelled) return;
        if (error) throw error;

        if (data && data.length > 0) {
          const ag = data[0];
          setMasterAgreement(ag);
          if (!commissionUserOverride) {
            setOppForm(f => ({
              ...f,
              commission_pct: String(ag.default_commission_pct ?? ""),
              master_agreement_id: ag.id
            }));
          }
        } else {
          // No Master Agreement — fall back to company default commission % (Layer A tier 3)
          setMasterAgreement(null);
          if (!commissionUserOverride) {
            let companyDefault = "";
            try {
              const { data: co } = await supabase
                .from("companies")
                .select("default_commission_pct")
                .eq("id", currentUser.company_id)
                .maybeSingle();
              if (!cancelled && co?.default_commission_pct != null) {
                companyDefault = String(co.default_commission_pct);
              }
            } catch (e) { /* fallback stays blank, broker can enter manually */ }
            if (!cancelled) {
              setOppForm(f => ({ ...f, commission_pct: companyDefault, master_agreement_id: null }));
            }
          }
        }
      } catch (err) {
        console.error("Master agreement lookup failed:", err);
        if (!cancelled) setMasterAgreement(null);
      } finally {
        if (!cancelled) setAgreementLoading(false);
      }
    }
    loadAgreement();
    return () => { cancelled = true; };
  }, [oppForm.unit_id, currentUser?.company_id]);

  // Auto-populate oppForm when prefilledUnit is provided (Phase 2.4 conversion)
  useEffect(() => {
    if (prefilledUnit) {
      setOppForm(f => ({
        ...f,
        unit_id: prefilledUnit.unit_id,
        budget: prefilledUnit.final_price ? String(prefilledUnit.final_price) : "",
        title: prefilledUnit.unit_ref && selectedLead ? `${prefilledUnit.unit_ref} — ${selectedLead.name}` : "",
      }));
    }
  }, [prefilledUnit, selectedLead]);


  // Step 2: unit picker state (Phase F W6.2 — searchable)
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState("");
  const [saturation, setSaturation] = useState(null);
  const [dupWarning, setDupWarning] = useState(false);
  const [agentSplit, setAgentSplit] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      if (!currentUser?.company_id) return;
      const { data } = await supabase.from("companies")
        .select("default_agent_split_mode, default_agent_split_value")
        .eq("id", currentUser.company_id).single();
      if (live && data) setAgentSplit(data);
    })();
    return () => { live = false; };
  }, [currentUser?.company_id]);
  useEffect(() => {
    let live = true;
    (async () => {
      if (!oppForm.unit_id) { setSaturation(null); return; }
      try {
        const sat = await analyzeUnitSaturation(oppForm.unit_id, currentUser?.id, supabase);
        if (live) setSaturation(sat);
        if (selectedLead?.id) {
          const { data: dups } = await supabase.from("opportunities")
            .select("id").eq("lead_id", selectedLead.id).eq("unit_id", oppForm.unit_id)
            .eq("status", "Active").limit(1);
          if (live) setDupWarning((dups || []).length > 0);
        }
      } catch (e) { if (live) setSaturation(null); }
    })();
    return () => { live = false; };
  }, [oppForm.unit_id, selectedLead?.id]);
  const [unitProjFilter, setUnitProjFilter] = useState("All"); // project_id or "All"
  const [unitBedFilter, setUnitBedFilter] = useState("All");   // "All" | "Studio" | "1" | "2" | "3" | "4+"
  const [unitShowReserved, setUnitShowReserved] = useState(false);

  // Detect what kind of input the agent typed (email / phone / name)
  const detectKind = (s) => {
    const trimmed = s.trim();
    if (trimmed.includes("@")) return "email";
    if (/^[+\d\s()-]+$/.test(trimmed) && trimmed.replace(/\D/g,"").length >= 4) return "phone";
    return "name";
  };

  // Debounced lead search by phone OR email — Layer 3 dedup detection.
  // Uses normalised phone matching: agent might type "0501234" or "+97150 1234"
  // and we still find the existing "+971 50 1234" lead.
  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) {
      setMatches([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const q = query.trim();
        const kind = detectKind(q);
        let rows = [];

        if (kind === "email") {
          // Email match — very strong dedup signal. Use ILIKE (case-insensitive).
          const { data, error } = await supabase
            .from("leads")
            .select("id, name, phone, email, source, nationality, budget, notes, created_at, assigned_to")
            .ilike("email", `%${q}%`)
            .eq("company_id", currentUser.company_id)
            .limit(8);
          if (error) throw error;
          rows = (data || []).map(r => ({...r, _matchType: "email"}));
        } else if (kind === "phone") {
          // Phone match — pull all leads with phones in this company, then
          // filter by normalised phone in JS. Avoids needing a stored
          // normalised column.
          const queryNorm = normalisePhone(q);
          if (!queryNorm) { setMatches([]); return; }
          const { data, error } = await supabase
            .from("leads")
            .select("id, name, phone, email, source, nationality, budget, notes, created_at, assigned_to")
            .not("phone", "is", null)
            .eq("company_id", currentUser.company_id)
            .limit(200); // generous so we don't miss matches
          if (error) throw error;
          rows = (data || [])
            .filter(r => {
              const rn = normalisePhone(r.phone);
              if (!rn) return false;
              // Match if either contains the other (handles partial typing)
              return rn.includes(queryNorm) || queryNorm.includes(rn);
            })
            .slice(0, 8)
            .map(r => ({...r, _matchType: "phone"}));
        } else {
          // Name fallback — least useful for dedup, but help the agent
          const { data, error } = await supabase
            .from("leads")
            .select("id, name, phone, email, source, nationality, budget, notes, created_at, assigned_to")
            .ilike("name", `%${q}%`)
            .eq("company_id", currentUser.company_id)
            .limit(8);
          if (error) throw error;
          rows = (data || []).map(r => ({...r, _matchType: "name"}));
        }
        setMatches(rows);
      } catch (e) {
        // Defensive: scan in-memory leads if DB query fails
        const ql = query.trim().toLowerCase();
        const qn = normalisePhone(query);
        const fallback = (leads || []).filter(l => {
          if ((l.email || "").toLowerCase().includes(ql)) return true;
          if (l.phone && qn && (normalisePhone(l.phone).includes(qn) || qn.includes(normalisePhone(l.phone)))) return true;
          if ((l.name || "").toLowerCase().includes(ql)) return true;
          return false;
        }).slice(0, 8);
        setMatches(fallback);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, currentUser.company_id]);

  // Phase F W6 ext — when a match is HOVERED or selected, fetch its conflict
  // context (current owner, recent activity, in-flight opps). Run once per
  // selected lead, cached locally on conflictContext.
  const loadConflictContext = async (lead) => {
    setLoadingContext(true);
    setConflictContext(null);
    try {
      const owner = (users || []).find(u => u.id === lead.assigned_to);

      // Fetch active opps for this lead
      const { data: leadOpps } = await supabase
        .from("opportunities")
        .select("id, stage, status, budget, unit_id, stage_updated_at, created_at, assigned_to")
        .eq("lead_id", lead.id)
        .neq("stage", "Closed Won")
        .neq("stage", "Closed Lost")
        .limit(10);

      // Fetch recent activities on this lead
      const { data: recentActs } = await supabase
        .from("activities")
        .select("type, note, created_at, user_name")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(5);

      const lastActAt = recentActs?.[0]?.created_at || lead.created_at;
      const daysSinceContact = lastActAt ? Math.round((new Date() - new Date(lastActAt)) / (1000*60*60*24)) : null;

      const oppDetails = (leadOpps || []).map(o => {
        const u = (units || []).find(x => x.id === o.unit_id);
        return {
          stage: o.stage,
          unit_ref: u?.unit_ref || null,
          owner_id: o.assigned_to,
          ownerName: (users || []).find(uu => uu.id === o.assigned_to)?.full_name || null,
        };
      });

      // Quick AI summary of the situation
      let aiSummary = "";
      try {
        const system = `You are a UAE real-estate brokerage advisor. A second agent is about to create a new opportunity for a buyer who already exists in the company's database. Summarise the situation in ONE sentence — what the second agent should know and what the recommended next step is. Be diplomatic, professional, brief. Do not assume bad intent. Output only the sentence, no preamble.`;
        const userPrompt = `Existing lead: ${lead.name || "Unknown"} (owned by ${owner?.full_name || "another agent"}).
Last contact: ${daysSinceContact === 0 ? "today" : daysSinceContact === 1 ? "yesterday" : daysSinceContact != null ? daysSinceContact + " days ago" : "unknown"}.
Active opportunities: ${oppDetails.length} (stages: ${oppDetails.map(o=>o.stage).join(", ") || "none"}).
${oppDetails.length > 0 ? `Units in flight: ${oppDetails.map(o=>o.unit_ref).filter(Boolean).join(", ")}.` : ""}
The agent attempting creation is ${currentUser.full_name || "another agent"}.
What should the second agent know?`;
        aiSummary = await aiInvoke({ system, prompt: userPrompt });
        aiSummary = (aiSummary || "").trim().replace(/^["']|["']$/g, "");
      } catch (e) {
        aiSummary = "";
      }

      setConflictContext({
        owner,
        daysSinceContact,
        opps: oppDetails,
        recentActs: recentActs || [],
        aiSummary,
      });
    } catch (e) {
      setConflictContext({ owner: null, daysSinceContact: null, opps: [], recentActs: [], aiSummary: "" });
    } finally {
      setLoadingContext(false);
    }
  };

  const startCreateLead = () => {
    const kind = detectKind(query);
    if (kind === "email") {
      setNewLeadForm(prev => ({ ...prev, email: query.trim() }));
    } else if (kind === "phone") {
      // Strip the country code from query if present
      let raw = query.trim();
      let cc = "+971";
      const matchCC = COUNTRY_CODES.find(c => raw.startsWith(c.code));
      if (matchCC) {
        cc = matchCC.code;
        raw = raw.slice(matchCC.code.length).trim();
      }
      const localPart = raw.replace(/\D/g, "").replace(/^0/, "");
      setNewLeadForm(prev => ({ ...prev, countryCode: cc, phone: localPart }));
    } else {
      setNewLeadForm(prev => ({ ...prev, name: query.trim() }));
    }
    setShowCreateLeadForm(true);
    setServerDupeBlock(null);
  };

  const useExistingLead = (lead) => {
    setSelectedLead(lead);
    setOppForm(prev => ({
      ...prev,
      title: `Inquiry from ${lead.name || "buyer"}`,
      budget: lead.budget ? String(lead.budget) : "",
    }));
    loadConflictContext(lead);
    // Don't auto-advance to step 2 — let the agent see context first and decide
  };

  // Final Layer 3 check — runs RIGHT BEFORE inserting a new lead. Catches:
  // (1) agent skipped search and typed dup details, (2) race condition where
  // another agent created the same lead between search and save.
  const finalDupeCheck = async (form) => {
    const fullPhone = (form.countryCode || "") + form.phone.replace(/\D/g, "");
    const phoneNorm = normalisePhone(fullPhone);
    const emailLower = (form.email || "").trim().toLowerCase();

    if (!emailLower && !phoneNorm) return null;

    // Check email first (stronger signal)
    if (emailLower) {
      const { data } = await supabase
        .from("leads")
        .select("id, name, phone, email, assigned_to")
        .ilike("email", emailLower)
        .eq("company_id", currentUser.company_id)
        .limit(1);
      if (data && data.length > 0) return { kind: "email", existingLead: data[0] };
    }

    // Then phone (weaker but still meaningful)
    if (phoneNorm && phoneNorm.length >= 5) {
      const { data } = await supabase
        .from("leads")
        .select("id, name, phone, email, assigned_to")
        .not("phone", "is", null)
        .eq("company_id", currentUser.company_id)
        .limit(200);
      if (data) {
        const dupe = data.find(r => {
          const rn = normalisePhone(r.phone);
          return rn && (rn === phoneNorm || rn.includes(phoneNorm) || phoneNorm.includes(rn));
        });
        if (dupe) return { kind: "phone", existingLead: dupe };
      }
    }

    return null;
  };

  const createLeadAndContinue = async () => {
    if (!newLeadForm.name.trim()) {
      showToast("Name is required", "error");
      return;
    }
    if (!newLeadForm.phone.trim() && !newLeadForm.email.trim()) {
      showToast("Phone or email is required", "error");
      return;
    }
    setSaving(true);
    setServerDupeBlock(null);
    try {
      // Layer 3 final check
      const dupe = await finalDupeCheck(newLeadForm);
      if (dupe) {
        setServerDupeBlock(dupe);
        setSaving(false);
        return;
      }

      const fullPhone = newLeadForm.phone
        ? `${newLeadForm.countryCode}${newLeadForm.phone.replace(/\D/g, "")}`
        : null;

      const payload = {
        name: newLeadForm.name.trim(),
        phone: fullPhone,
        email: newLeadForm.email.trim() || null,
        source: newLeadForm.source || null,
        nationality: newLeadForm.nationality || null,
        budget: newLeadForm.budget ? Number(newLeadForm.budget) : null,
        notes: newLeadForm.notes || null,
        company_id: currentUser.company_id || null,
        assigned_to: currentUser.id,
        created_by: currentUser.id,
      };
      // Some installations have a country_code column; include if not null
      if (newLeadForm.countryCode) payload.country_code = newLeadForm.countryCode;

      const { data, error } = await supabase
        .from("leads")
        .insert(payload)
        .select()
        .single();
      if (error) {
        // Defensive: column country_code might not exist — retry without it
        if (error.message && error.message.toLowerCase().includes("country_code")) {
          delete payload.country_code;
          const retry = await supabase.from("leads").insert(payload).select().single();
          if (retry.error) throw retry.error;
          setSelectedLead(retry.data);
          writeBrokerCreatedLog(retry.data, currentUser);
          setOppForm(prev => ({
            ...prev,
            title: `Inquiry from ${retry.data.name}`,
            budget: retry.data.budget ? String(retry.data.budget) : "",
          }));
          setStep(2);
          showToast("Lead created", "success");
          return;
        }
        throw error;
      }
      setSelectedLead(data);
      writeBrokerCreatedLog(data, currentUser);
      setOppForm(prev => ({
        ...prev,
        title: `Inquiry from ${data.name}`,
        budget: data.budget ? String(data.budget) : "",
      }));
      setStep(2);
      showToast("Lead created", "success");
    } catch (e) {
      showToast(`Couldn't create lead: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveOpp = async () => {
    if (!selectedLead?.id) {
      showToast("No lead selected", "error");
      return;
    }
    setSaving(true);
    try {
      const unit = units.find(u => u.id === oppForm.unit_id);
      // 14 May 2026 Day 2 Math Flow: set current_* from salePricing at creation
      // (single source of truth, unit price is reality - broker adjusts later stages)
      const unitPrice = (salePricing || []).find(s => s.unit_id === oppForm.unit_id)?.asking_price;
      const isOffPlan = (oppForm.property_category || "Off-Plan") === "Off-Plan";
      const payload = {
        lead_id: selectedLead.id,
        company_id: currentUser.company_id || null,
        title: oppForm.title || (unit ? `${unit.unit_ref} — ${selectedLead.name}` : `Opportunity — ${selectedLead.name}`),
        unit_id: oppForm.unit_id || null,
        budget: oppForm.budget ? Number(oppForm.budget) : null,
        assigned_to: oppForm.assigned_to || currentUser.id,
        notes: oppForm.notes || null,
        property_category: oppForm.property_category || "Off-Plan",
        commission_pct: oppForm.commission_pct ? Number(oppForm.commission_pct) : null,
        master_agreement_id: oppForm.master_agreement_id || null,
        stage: "New",
        status: "Active",
        created_by: currentUser.id,
        // Math flow current_* fields (set at creation)
        current_agreed_price: unitPrice || null,
        current_admin_fee: 580,
        current_trustee_fee: isOffPlan ? 4200 : null,
        current_values_updated_at: new Date().toISOString(),
        current_values_updated_by: currentUser.id,
      };
      const { data, error } = await supabase.from("opportunities").insert(payload).select().single();
      if (error) throw error;
      showToast("Opportunity created", "success");
      const wasNewLead = !(leads || []).find(l => l.id === selectedLead.id);
      onCreated(data, wasNewLead ? selectedLead : null);
    } catch (e) {
      showToast(`Couldn't create opportunity: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  // Has the selected lead got an active conflict (i.e. owned by someone other
  // than the current user, or has active opps owned by another agent)?
  const hasConflict = selectedLead && conflictContext && (
    (selectedLead.assigned_to && selectedLead.assigned_to !== currentUser.id) ||
    conflictContext.opps.some(o => o.owner_id && o.owner_id !== currentUser.id)
  );

  // ─── RENDER ────────────────────────────────────────────────
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,37,64,.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem"}}>
      <div style={{background:"#fff",borderRadius:14,padding:0,maxWidth:640,width:"100%",maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 56px rgba(15,37,64,.18)"}}>

        {/* Header */}
        <div style={{padding:"18px 22px",borderBottom:"1px solid #E2E8F0",background:"#0F2540",color:"#fff",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,letterSpacing:"-.3px"}}>
              {step === 1 ? "🎯 New Opportunity — Step 1: Find or create buyer" : "🎯 New Opportunity — Step 2: Deal details"}
            </div>
            {selectedLead && step === 2 && (
              <div style={{fontSize:11,color:"rgba(255,255,255,.7)",marginTop:3}}>
                For: <strong>{selectedLead.name}</strong> · {selectedLead.phone || selectedLead.email}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#C9A84C",fontSize:24,cursor:"pointer",lineHeight:1}}>×</button>
        </div>

        {/* Body */}
        <div style={{padding:"20px 22px",overflowY:"auto",flex:1}}>

          {/* ─── STEP 1: lead lookup-or-create ─── */}
          {step === 1 && !showCreateLeadForm && !selectedLead && (
            <div>
              <div style={{fontSize:12,color:"#64748B",marginBottom:10,lineHeight:1.5}}>
                Type the buyer's <strong>email</strong> (most reliable) or <strong>phone</strong>. If they're already in our database, you'll see them — pick to continue. Otherwise, create a new contact.
              </div>

              <div style={{position:"relative",marginBottom:14}}>
                <input type="text" autoFocus
                  value={query}
                  onChange={e=>setQuery(e.target.value)}
                  placeholder="🔍 buyer@email.com or +9715... or name"
                  style={{width:"100%",padding:"11px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",outline:"none"}}/>
                {searching && (
                  <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#64748B"}}>
                    Searching…
                  </span>
                )}
              </div>

              {query.trim().length >= 3 && !searching && matches.length === 0 && (
                <div style={{padding:"12px 14px",background:"#FFFBEA",border:"1px solid #FCD34D",borderRadius:8,fontSize:12,color:"#7A4F01",marginBottom:10}}>
                  No matching contacts found. <button onClick={startCreateLead} style={{marginLeft:6,padding:"3px 10px",borderRadius:5,border:"1px solid #7A4F01",background:"#fff",color:"#7A4F01",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Create new contact</button>
                </div>
              )}

              {matches.length > 0 && (
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".5px",marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
                    {matches.length} matching contact{matches.length===1?"":"s"} found
                    {matches[0]?._matchType === "email" && (
                      <span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:"#FEE2E2",color:"#C53030",fontWeight:700,letterSpacing:".4px"}}>EMAIL MATCH</span>
                    )}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {matches.map(l => {
                      const owner = users?.find(u => u.id === l.assigned_to);
                      const isMine = l.assigned_to === currentUser.id;
                      const cardBg = l._matchType === "email" ? "#FEF2F2" : "#FFFBEA";
                      const cardBd = l._matchType === "email" ? "#FCA5A5" : "#FCD34D";
                      return (
                        <div key={l.id} style={{padding:"10px 12px",background:cardBg,border:`1px solid ${cardBd}`,borderRadius:8}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#0F2540",marginBottom:3,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                            📇 {l.name || "Unnamed contact"}
                            {!isMine && owner && (
                              <span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:"#FEE2E2",color:"#C53030",fontWeight:700,letterSpacing:".4px"}}>
                                OWNED BY {owner.full_name?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div style={{fontSize:11,color:"#64748B",marginBottom:7}}>
                            {[l.phone, l.email, l.source && `Source: ${l.source}`, l.nationality].filter(Boolean).join(" · ")}
                          </div>
                          <button onClick={()=>useExistingLead(l)}
                            style={{padding:"5px 12px",borderRadius:6,border:"none",background:"#0F2540",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                            ✓ Use this contact
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{textAlign:"center",marginTop:10}}>
                    <button onClick={startCreateLead}
                      style={{padding:"6px 14px",borderRadius:6,border:"1.5px solid #D1D9E6",background:"#fff",color:"#475569",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                      None of these — create new contact instead
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── STEP 1.5: lead picked, show conflict context (if any) ─── */}
          {step === 1 && !showCreateLeadForm && selectedLead && (
            <div>
              <div style={{padding:"10px 12px",background:"#F0FDFA",border:"1px solid #CCFBF1",borderRadius:8,marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,color:"#0F2540",marginBottom:3}}>
                  ✓ Selected: {selectedLead.name}
                </div>
                <div style={{fontSize:11,color:"#64748B"}}>
                  {[selectedLead.phone, selectedLead.email].filter(Boolean).join(" · ")}
                </div>
              </div>

              {loadingContext && (
                <div style={{fontSize:12,color:"#64748B",padding:"10px 0"}}>
                  Loading deal context…
                </div>
              )}

              {!loadingContext && hasConflict && conflictContext && (
                <div style={{padding:"12px 14px",background:"#FEF2F2",border:"1.5px solid #FCA5A5",borderRadius:10,marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#C53030",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                    ⚠ Heads up — this lead has activity with another agent
                  </div>
                  {conflictContext.aiSummary && (
                    <div style={{fontSize:12,color:"#7B1F1F",marginBottom:10,fontStyle:"italic",lineHeight:1.5,padding:"8px 10px",background:"#fff",borderRadius:6,border:"1px solid #FCA5A5"}}>
                      🤖 {conflictContext.aiSummary}
                    </div>
                  )}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                    {conflictContext.owner && (
                      <div style={{background:"#fff",border:"1px solid #FCA5A5",borderRadius:6,padding:"6px 9px"}}>
                        <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,textTransform:"uppercase"}}>Lead owner</div>
                        <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{conflictContext.owner.full_name}</div>
                      </div>
                    )}
                    {conflictContext.daysSinceContact !== null && (
                      <div style={{background:"#fff",border:"1px solid #FCA5A5",borderRadius:6,padding:"6px 9px"}}>
                        <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,textTransform:"uppercase"}}>Last contact</div>
                        <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>
                          {conflictContext.daysSinceContact === 0 ? "Today" : conflictContext.daysSinceContact === 1 ? "Yesterday" : conflictContext.daysSinceContact + " days ago"}
                        </div>
                      </div>
                    )}
                  </div>
                  {conflictContext.opps.length > 0 && (
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,textTransform:"uppercase",marginBottom:4}}>
                        Active opportunities ({conflictContext.opps.length})
                      </div>
                      {conflictContext.opps.map((o, idx) => (
                        <div key={idx} style={{fontSize:11,color:"#475569",padding:"3px 0"}}>
                          · {o.unit_ref || "no unit"} — {o.stage}{o.ownerName && ` (${o.ownerName})`}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{fontSize:11,color:"#64748B",lineHeight:1.5,padding:"6px 8px",background:"#FFF8E1",borderRadius:5,border:"1px solid #FCD34D"}}>
                    💡 Recommended: contact <strong>{conflictContext.owner?.full_name || "the lead owner"}</strong> or your manager before creating a parallel opportunity. Inter-agent coordination prevents customer confusion and team disputes.
                  </div>
                </div>
              )}

              <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center",flexWrap:"wrap"}}>
                <button onClick={()=>{setSelectedLead(null);setConflictContext(null);}}
                  style={{padding:"6px 14px",borderRadius:6,border:"1.5px solid #D1D9E6",background:"#fff",color:"#475569",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                  ← Pick a different contact
                </button>
                <button onClick={()=>setStep(2)}
                  disabled={loadingContext}
                  style={{padding:"8px 18px",borderRadius:7,border:"none",background:hasConflict?"#A06810":"#0F2540",color:"#fff",fontSize:12,fontWeight:700,cursor:loadingContext?"not-allowed":"pointer"}}>
                  {hasConflict ? "Proceed anyway →" : "Continue to deal details →"}
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 1: create new lead form (V2-quality) ─── */}
          {step === 1 && showCreateLeadForm && (
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <button onClick={()=>{setShowCreateLeadForm(false);setServerDupeBlock(null);}} style={{background:"none",border:"none",color:"#64748B",fontSize:13,cursor:"pointer"}}>← Back to search</button>
                <span style={{fontSize:12,color:"#64748B"}}>Creating new contact</span>
              </div>

              {serverDupeBlock && (
                <div style={{padding:"12px 14px",background:"#FEF2F2",border:"1.5px solid #FCA5A5",borderRadius:10,marginBottom:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#C53030",textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>
                    ⚠ Duplicate detected — {serverDupeBlock.kind} match
                  </div>
                  <div style={{fontSize:12,color:"#7B1F1F",marginBottom:10,lineHeight:1.5}}>
                    A contact with this {serverDupeBlock.kind} already exists: <strong>{serverDupeBlock.existingLead.name}</strong>
                    {" "}({serverDupeBlock.existingLead.phone || serverDupeBlock.existingLead.email}).
                    {serverDupeBlock.kind === "email"
                      ? " Email is a strong duplicate signal — please use the existing contact unless this is a confirmed different person."
                      : " Phone numbers can change — please verify whether this is the same person before creating a duplicate."}
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <button onClick={()=>{useExistingLead(serverDupeBlock.existingLead); setShowCreateLeadForm(false); setServerDupeBlock(null);}}
                      style={{padding:"6px 12px",borderRadius:6,border:"none",background:"#0F2540",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                      ✓ Use existing contact
                    </button>
                    {serverDupeBlock.kind === "phone" && (
                      <button onClick={()=>setServerDupeBlock(null)}
                        style={{padding:"6px 12px",borderRadius:6,border:"1.5px solid #C53030",background:"#fff",color:"#C53030",fontSize:11,fontWeight:600,cursor:"pointer"}}>
                        Different person — create anyway
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{gridColumn:"1 / -1"}}>
                  <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Name *</label>
                  <input value={newLeadForm.name} onChange={e=>setNewLeadForm(f=>({...f,name:e.target.value}))} placeholder="Mr. Khan" autoFocus
                    style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Phone</label>
                  <div style={{display:"flex",gap:5}}>
                    <select value={newLeadForm.countryCode} onChange={e=>setNewLeadForm(f=>({...f,countryCode:e.target.value}))}
                      style={{flex:"0 0 auto",minWidth:90,padding:"8px 6px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:12,background:"#fff",cursor:"pointer"}}>
                      {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.code} {c.country}</option>)}
                    </select>
                    <input value={newLeadForm.phone} onChange={e=>setNewLeadForm(f=>({...f,phone:e.target.value.replace(/\D/g,"")}))} placeholder="50 1234 567"
                      style={{flex:1,padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",minWidth:0}}/>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Email</label>
                  <input type="email" value={newLeadForm.email} onChange={e=>setNewLeadForm(f=>({...f,email:e.target.value}))} placeholder="buyer@email.com"
                    style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Source</label>
                  <select value={newLeadForm.source} onChange={e=>setNewLeadForm(f=>({...f,source:e.target.value}))}
                    style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",background:"#fff"}}>
                    <option>Walk-in</option>
                    <option>Bayut</option>
                    <option>PropertyFinder</option>
                    <option>Dubizzle</option>
                    <option>Referral</option>
                    <option>Repeat customer</option>
                    <option>Cold call</option>
                    <option>Social media</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Nationality</label>
                  <select value={newLeadForm.nationality} onChange={e=>setNewLeadForm(f=>({...f,nationality:e.target.value}))}
                    style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",background:"#fff"}}>
                    <option value="">— Select —</option>
                    {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Stated budget (AED)</label>
                  <input type="number" value={newLeadForm.budget} onChange={e=>setNewLeadForm(f=>({...f,budget:e.target.value}))} placeholder="2000000"
                    style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box"}}/>
                </div>
                <div style={{gridColumn:"1 / -1"}}>
                  <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Notes</label>
                  <textarea value={newLeadForm.notes} onChange={e=>setNewLeadForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Initial requirements, preferences, anything notable…"
                    style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",fontFamily:"inherit",resize:"vertical"}}/>
                </div>
              </div>
            </div>
          )}

          {/* ─── STEP 2: opp details ─── */}
          {step === 2 && selectedLead && (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{gridColumn:"1 / -1"}}>
                <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Title</label>
                <input value={oppForm.title} onChange={e=>setOppForm(f=>({...f,title:e.target.value}))} placeholder="auto-generated if blank"
                  style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Property category</label>
                <select value={oppForm.property_category} onChange={e=>setOppForm(f=>({...f,property_category:e.target.value}))}
                  style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",background:"#fff"}}>
                  <option>Off-Plan</option>
                  <option>Ready</option>
                  <option>Resale</option>
                </select>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Budget (AED)</label>
                <input type="number" value={oppForm.budget} onChange={e=>setOppForm(f=>({...f,budget:e.target.value}))} placeholder="2000000"
                  style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box"}}/>
              </div>
              <div style={{gridColumn:"1 / -1"}}>
                <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Linked unit (optional)</label>
                {/* Phase F W6.2 — searchable unit picker. Plain <select> doesn't
                    scale: at 84 units it's painful, at 8000+ it's unusable. */}
                {(() => {
                  const selectedUnit = (units||[]).find(u => u.id === oppForm.unit_id);
                  const selectedProj = selectedUnit ? (projects||[]).find(p => p.id === selectedUnit.project_id) : null;

                  // Build filtered list
                  const projectOptions = Array.from(new Set((units||[]).map(u => u.project_id).filter(Boolean)))
                    .map(pid => (projects||[]).find(p => p.id === pid))
                    .filter(Boolean);

                  // 19 May 2026 Issue 1: Filter out zero-value inventory
                  // (Matches UnitPickerRich v2 data integrity behavior)
                  // Prevents creating opportunities for unpriced units
                  const _priceById = {};
                  (salePricing||[]).forEach(sp => {
                    if (sp.unit_id && Number(sp.asking_price) > 0) {
                      _priceById[sp.unit_id] = Number(sp.asking_price);
                    }
                  });
                  let pool = (units||[]).filter(u => _priceById[u.id] > 0);
                  if (!unitShowReserved) pool = pool.filter(u => u.status !== "Reserved" && u.status !== "Sold");
                  if (unitProjFilter !== "All") pool = pool.filter(u => u.project_id === unitProjFilter);
                  if (unitBedFilter !== "All") {
                    if (unitBedFilter === "Studio") pool = pool.filter(u => u.bedrooms === 0);
                    else if (unitBedFilter === "4+") pool = pool.filter(u => u.bedrooms >= 4);
                    else pool = pool.filter(u => String(u.bedrooms) === unitBedFilter);
                  }
                  if (unitSearch.trim()) {
                    const q = unitSearch.trim().toLowerCase();
                    pool = pool.filter(u => {
                      const proj = (projects||[]).find(p => p.id === u.project_id);
                      const haystack = [u.unit_ref, u.sub_type, u.view, proj?.name, u.bedrooms===0?"studio":`${u.bedrooms}br`].filter(Boolean).join(" ").toLowerCase();
                      return haystack.includes(q);
                    });
                  }
                  // Sort by project name then unit_ref
                  pool = pool.sort((a,b)=>{
                    const pa = (projects||[]).find(p=>p.id===a.project_id)?.name || "";
                    const pb = (projects||[]).find(p=>p.id===b.project_id)?.name || "";
                    if (pa !== pb) return pa.localeCompare(pb);
                    return (a.unit_ref||"").localeCompare(b.unit_ref||"");
                  });
                  const visible = pool.slice(0, 200);

                  return (
                    <div style={{position:"relative"}}>
                      {/* Display field — shows selection or placeholder */}
                      <div onClick={()=>setUnitPickerOpen(o=>!o)}
                        style={{padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,background:"#fff",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                        {selectedUnit ? (
                          <div style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontWeight:700,color:"#0F2540"}}>{selectedUnit.unit_ref}</span>
                            {/* Phase 2.2b — open Property Pack for this unit */}
                            <button onClick={e=>{e.stopPropagation();openPropertyPack(selectedUnit.id);}} title="View Property Pack" style={{padding:"2px 8px",borderRadius:5,border:"none",background:"#0F2540",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer"}}>📸 Pack</button>
                            {(() => {
                              // 16 May 2026: Show price for broker's quick budget match
                              const sp = (salePricing||[]).find(s => s.unit_id === selectedUnit.id);
                              const price = sp?.asking_price;
                              return price ? (
                                <span style={{fontWeight:700,color:"#1A5FA8",fontSize:12}}>AED {Number(price).toLocaleString()}</span>
                              ) : null;
                            })()}
                            <span style={{fontSize:11,color:"#64748B",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                              {[
                                selectedUnit.bedrooms===0?"Studio":selectedUnit.bedrooms?`${selectedUnit.bedrooms}BR`:null,
                                selectedUnit.sub_type,
                                selectedProj?.name,
                                selectedUnit.size_sqft && `${selectedUnit.size_sqft} sqft`,
                              ].filter(Boolean).join(" · ")}
                            </span>
                          </div>
                        ) : (
                          <span style={{color:"#94A3B8"}}>— No unit linked yet — click to search 🔍</span>
                        )}
                        <div style={{display:"flex",gap:4,alignItems:"center"}}>
                          {selectedUnit && (
                            <button onClick={e=>{e.stopPropagation();setOppForm(f=>({...f,unit_id:""}));setUnitPickerOpen(false);}}
                              style={{padding:"2px 7px",borderRadius:5,border:"none",background:"#E2E8F0",color:"#64748B",fontSize:10,fontWeight:700,cursor:"pointer"}}>
                              ✕
                            </button>
                          )}
                          <span style={{color:"#94A3B8",fontSize:11}}>{unitPickerOpen ? "▲" : "▼"}</span>
                        </div>
                      </div>

                      {/* Picker panel */}
                      {unitPickerOpen && (
                        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#fff",border:"1.5px solid #D1D9E6",borderRadius:8,boxShadow:"0 14px 32px rgba(15,37,64,.15)",zIndex:50,maxHeight:380,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                          {/* Search box */}
                          <div style={{padding:"10px 12px",borderBottom:"1px solid #E2E8F0"}}>
                            <input type="text" autoFocus value={unitSearch} onChange={e=>setUnitSearch(e.target.value)}
                              placeholder="🔍 Search by ref, project, BR, view (e.g. 'DAM 2BR' or 'villa')"
                              style={{width:"100%",padding:"7px 10px",borderRadius:6,border:"1.5px solid #E2E8F0",fontSize:12,boxSizing:"border-box",outline:"none"}}/>
                            {/* Filter row 1: project pills */}
                            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8,alignItems:"center"}}>
                              <button onClick={()=>setUnitProjFilter("All")}
                                style={{padding:"3px 9px",borderRadius:11,border:`1px solid ${unitProjFilter==="All"?"#0F2540":"#E2E8F0"}`,background:unitProjFilter==="All"?"#0F2540":"#fff",color:unitProjFilter==="All"?"#fff":"#64748B",fontSize:10,fontWeight:600,cursor:"pointer"}}>All projects</button>
                              {projectOptions.map(p => (
                                <button key={p.id} onClick={()=>setUnitProjFilter(p.id)}
                                  style={{padding:"3px 9px",borderRadius:11,border:`1px solid ${unitProjFilter===p.id?"#0F2540":"#E2E8F0"}`,background:unitProjFilter===p.id?"#0F2540":"#fff",color:unitProjFilter===p.id?"#fff":"#64748B",fontSize:10,fontWeight:600,cursor:"pointer"}}>
                                  {p.name}
                                </button>
                              ))}
                            </div>
                            {/* Filter row 2: bedroom pills + show reserved */}
                            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6,alignItems:"center"}}>
                              {["All","Studio","1","2","3","4+"].map(b => {
                                const sel = unitBedFilter === b;
                                const label = b==="All"?"All sizes":b==="Studio"?"Studio":b==="4+"?"4BR+":`${b}BR`;
                                return (
                                  <button key={b} onClick={()=>setUnitBedFilter(b)}
                                    style={{padding:"3px 9px",borderRadius:11,border:`1px solid ${sel?"#0F2540":"#E2E8F0"}`,background:sel?"#0F2540":"#fff",color:sel?"#fff":"#64748B",fontSize:10,fontWeight:600,cursor:"pointer"}}>{label}</button>
                                );
                              })}
                              <label style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:"#64748B",cursor:"pointer",marginLeft:"auto"}}>
                                <input type="checkbox" checked={unitShowReserved} onChange={e=>setUnitShowReserved(e.target.checked)}/>
                                Show Reserved/Sold
                              </label>
                            </div>
                          </div>

                          {/* Result count */}
                          <div style={{padding:"6px 12px",fontSize:10,color:"#94A3B8",fontWeight:600,letterSpacing:".4px",textTransform:"uppercase",borderBottom:"1px solid #F1F5F9"}}>
                            {pool.length} unit{pool.length===1?"":"s"}{visible.length < pool.length && ` (showing first ${visible.length})`}
                          </div>

                          {/* Results */}
                          <div style={{flex:1,overflowY:"auto",maxHeight:280}}>
                            {visible.length === 0 ? (
                              <div style={{padding:"22px 12px",textAlign:"center",color:"#94A3B8",fontSize:12}}>
                                No units match. Try a different filter or search term.
                              </div>
                            ) : (
                              visible.map(u => {
                                const proj = (projects||[]).find(p => p.id === u.project_id);
                                const bedLabel = u.bedrooms===0?"Studio":(u.bedrooms?`${u.bedrooms}BR`:"");
                                const isReserved = u.status === "Reserved" || u.status === "Sold";
                                return (
                                  <div key={u.id}
                                    onClick={()=>{
                                      // Finding 1 fix (11 May 2026): confirm before selecting Reserved/Sold unit
                                      if (isReserved) {
                                        const ok = window.confirm(
                                          `⚠️ Unit ${u.unit_ref} is currently ${u.status}.\n\n` +
                                          `This unit may conflict with another active deal. ` +
                                          `Selecting it could cause double-booking issues.\n\n` +
                                          `Click OK to proceed anyway, or Cancel to pick a different unit.`
                                        );
                                        if (!ok) return;
                                      }
                                      setOppForm(f=>({...f,unit_id:u.id}));
                                      setUnitPickerOpen(false);
                                      setUnitSearch("");
                                    }}
                                    onMouseOver={e=>e.currentTarget.style.background="#F8FAFC"}
                                    onMouseOut={e=>e.currentTarget.style.background="#fff"}
                                    style={{padding:"8px 12px",borderBottom:"1px solid #F1F5F9",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,opacity:isReserved?0.6:1}}>
                                    <div style={{minWidth:0,flex:1}}>
                                      <div style={{fontSize:12,fontWeight:700,color:"#0F2540",display:"flex",alignItems:"center",gap:6}}>
                                        {u.unit_ref}
                                        {isReserved && <span style={{fontSize:9,padding:"1px 5px",borderRadius:7,background:"#FEE2E2",color:"#C53030",fontWeight:700}}>{u.status?.toUpperCase()}</span>}
                                      </div>
                                      <div style={{fontSize:10,color:"#64748B",marginTop:1}}>
                                        {[bedLabel, u.sub_type, proj?.name, u.size_sqft && `${u.size_sqft} sqft`, u.view].filter(Boolean).join(" · ")}
                                      </div>
                                    </div>
                                    {(() => {
                                      // 16 May 2026: Show price on each unit row for budget match
                                      const sp = (salePricing||[]).find(s => s.unit_id === u.id);
                                      const price = sp?.asking_price;
                                      return price ? (
                                        <div style={{textAlign:"right",whiteSpace:"nowrap"}}>
                                          <div style={{fontSize:12,fontWeight:700,color:"#1A5FA8"}}>AED {Number(price).toLocaleString()}</div>
                                        </div>
                                      ) : (
                                        <div style={{fontSize:10,color:"#94A3B8",fontStyle:"italic"}}>No price</div>
                                      );
                                    })()}
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Footer */}
                          <div style={{padding:"6px 12px",borderTop:"1px solid #E2E8F0",background:"#F8FAFC",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span style={{fontSize:10,color:"#94A3B8"}}>Click a unit to select. Esc or click outside to close.</span>
                            <button onClick={()=>setUnitPickerOpen(false)}
                              style={{padding:"3px 10px",borderRadius:5,border:"1px solid #D1D9E6",background:"#fff",color:"#64748B",fontSize:10,fontWeight:600,cursor:"pointer"}}>Close</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div style={{fontSize:10,color:"#94A3B8",marginTop:3}}>
                  💡 Don't worry if you don't have a unit yet. AI Match in the proposal builder will help you pick one later.
                </div>

              </div>
              {saturation && <UnitSaturationInline saturation={saturation} />}
              {(() => {
                const isAgent = !["super_admin","admin","sales_manager","leasing_manager"].includes(currentUser?.role) && currentUser?.is_super_admin !== true;
                const pct = Number(oppForm.commission_pct);
                const selUnit = (units||[]).find(u => u.id === oppForm.unit_id);
                const price = Number((salePricing||[]).find(s => s.unit_id === oppForm.unit_id)?.asking_price) || Number(selUnit?.base_price) || Number(oppForm.budget) || 0;
                if (!isAgent || !pct || !price || !agentSplit?.default_agent_split_value) return null;
                const gross = price * pct / 100;
                const mine = agentSplit.default_agent_split_mode === "percentage" ? gross * Number(agentSplit.default_agent_split_value) / 100 : Number(agentSplit.default_agent_split_value);
                if (!mine) return null;
                return <div style={{marginTop:6,padding:"8px 12px",background:"#ECFDF5",borderLeft:"3px solid #10B981",borderRadius:4,fontSize:12,color:"#065F46",fontWeight:700}}>💰 Your estimated earning on this deal: AED {Math.round(mine).toLocaleString()}</div>;
              })()}
              {dupWarning && <div style={{marginTop:6,padding:"8px 12px",background:"#FEF3C7",borderLeft:"3px solid #D97706",borderRadius:4,fontSize:11,color:"#92400E",fontWeight:600}}>⚠️ This buyer already has an active opportunity on this unit — consider opening the existing deal instead of creating a duplicate.</div>}
              {/* Commission auto-populate from master agreement */}
              {canDo(currentUser, "see_brokerage_commission") && (
              <div style={{gridColumn:"1 / -1", padding:"12px 14px", background: masterAgreement ? "#F0F9FF" : "#F9FAFB", border:`1px solid ${masterAgreement ? "#BAE6FD" : "#E5E7EB"}`, borderRadius:8, marginBottom:8}}>
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8}}>
                  <div style={{fontSize:12, fontWeight:600, color:"#0F2540", display:"flex", alignItems:"center", gap:6}}>
                                    
                
                💼 Commission
                    {agreementLoading && <span style={{fontSize:10, color:"#6B7280", fontWeight:500}}>· checking master agreement...</span>}
                  </div>
                  {masterAgreement && (
                    <div style={{fontSize:10, color:"#0369A1", background:"#DBEAFE", padding:"3px 8px", borderRadius:10, fontWeight:600}}>
                      💡 Auto-populated from {masterAgreement.developer_name} master agreement
                    </div>
                  )}
                </div>
                <div style={{display:"flex", alignItems:"center", gap:10}}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={oppForm.commission_pct}
                    onChange={e => {
                      setCommissionUserOverride(true);
                      setOppForm(f => ({...f, commission_pct: e.target.value}));
                    }}
                    placeholder={masterAgreement ? "Auto-populated" : oppForm.unit_id ? "No active master agreement found" : "Select a unit first"}
                    disabled={!oppForm.unit_id}
                    style={{width:140, padding:"7px 10px", border:"1px solid #D1D5DB", borderRadius:6, fontSize:13, fontFamily:"'Inter', sans-serif", background:"#fff"}}
                  />
                  <span style={{fontSize:13, color:"#374151"}}>%</span>
                  {oppForm.commission_pct && (oppForm.budget || (units||[]).find(u=>u.id===oppForm.unit_id)?.base_price) && (
                    <span style={{fontSize:11, color:"#6B7280", marginLeft:8}}>
                      ≈ AED {Math.round(((Number(oppForm.budget) || (units||[]).find(u=>u.id===oppForm.unit_id)?.base_price || 0) * Number(oppForm.commission_pct) / 100)).toLocaleString()}
                    </span>
                  )}
                  {commissionUserOverride && masterAgreement && (
                    <button
                      type="button"
                      onClick={() => {
                        setCommissionUserOverride(false);
                        setOppForm(f => ({...f, commission_pct: String(masterAgreement.default_commission_pct ?? "")}));
                      }}
                      style={{padding:"5px 10px", background:"#fff", border:"1px solid #BAE6FD", borderRadius:6, fontSize:11, fontWeight:600, color:"#0369A1", cursor:"pointer"}}
                    >Reset to master</button>
                  )}
                </div>
                {oppForm.unit_id && !masterAgreement && !agreementLoading && (
                  <div style={{fontSize:11, color:"#92400E", marginTop:6}}>
                    ⚠️ No active master agreement found for this developer. Add one in Master Agreements menu, or enter rate manually.
                  </div>
                )}
              </div>
              )}

              <div>
                <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Owner</label>
                <select value={oppForm.assigned_to} onChange={e=>setOppForm(f=>({...f,assigned_to:e.target.value}))}
                  style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",background:"#fff"}}>
                  {(users||[]).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div style={{gridColumn:"1 / -1"}}>
                <label style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".4px",display:"block",marginBottom:5}}>Notes</label>
                <textarea value={oppForm.notes} onChange={e=>setOppForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Specific requirements, context for this deal…"
                  style={{width:"100%",padding:"8px 12px",borderRadius:7,border:"1.5px solid #D1D9E6",fontSize:13,boxSizing:"border-box",fontFamily:"inherit",resize:"vertical"}}/>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:"14px 22px",borderTop:"1px solid #E2E8F0",background:"#F8FAFC",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
          <div style={{fontSize:11,color:"#94A3B8"}}>
            Step {step} of 2
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onClose} disabled={saving}
              style={{padding:"9px 16px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",color:"#475569",fontSize:12,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
              Cancel
            </button>
            {step === 1 && showCreateLeadForm && (
              <button onClick={createLeadAndContinue} disabled={saving}
                style={{padding:"9px 18px",borderRadius:8,border:"none",background:saving?"#94A3B8":"#0F2540",color:"#fff",fontSize:12,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
                {saving ? "Creating…" : "Create contact & continue →"}
              </button>
            )}
            {step === 2 && (
              <>
                <button onClick={()=>setStep(1)} disabled={saving}
                  style={{padding:"9px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",color:"#475569",fontSize:12,fontWeight:600,cursor:"pointer"}}>
                  ← Back
                </button>
                <button onClick={saveOpp} disabled={saving}
                  style={{padding:"9px 18px",borderRadius:8,border:"none",background:saving?"#94A3B8":"#0F2540",color:"#fff",fontSize:12,fontWeight:700,cursor:saving?"not-allowed":"pointer"}}>
                  {saving ? "Creating…" : "Create opportunity"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

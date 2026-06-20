import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { supabase } from "../../lib/supabase";
import { can, canWithPS, roleTeam } from "../../lib/permissions.js";
import { STAGE_CAPTURE_CONFIGS, PAYMENT_PLAN_PRESETS, DLD_OPTIONS, SERVICE_CHARGE_PRESETS, PROPOSAL_STATUS_META, VALIDITY_PRESETS, OPP_STAGES, OPP_STAGE_META, STAGE_META, ACT_META } from "../../modules/constants.js";
import { fmtM, fmtAED, fmtDate, fmtDT, uid, getStrength, ini } from "../../modules/utils.js";
import ActivitiesList from "../opportunities/ActivitiesList.jsx";
import QuickProposalsPanel from "../leads/QuickProposalsPanel";
import LeadPeopleSection from "../LeadPeopleSection.jsx";
import PropertyPackModal from "../property/PropertyPackModal.jsx";
import RemindersBell from "../RemindersBell.jsx";
import LeadCreationFormV2 from "../LeadCreationFormV2.jsx";

function Leads({ Av, Badge, Empty, Modal, Spinner, CreateOpportunityDialog, LogActivityModal,leads,setLeads,opps:globalOppsFromParent=[],setOpps:setGlobalOpps=()=>{},properties,activities,setActivities,discounts,setDiscounts,currentUser,users,showToast,initialFilter=null,onNavigateToOpp=null,refCountries=[],refRules={}}){
  const [search,   setSearch]   = useState("");
  const [fStage,   setFStage]   = useState("All");
  const [fType,    setFType]    = useState("All");
  const [view,     setView]     = useState("list");   // list | lead | opportunity
  const [selLeadId,setSelLeadId]= useState(null);
  const [selOpp,   setSelOpp]   = useState(null);
  const [saving,   setSaving]   = useState(false);
  // 23 May 2026: Restore Lead Detail activity logging (lost during April Lead/Opp split rewrite)
  // Full feature parity with Opp Detail saveLog - scheduling, duration, next-step reminders
  // Separate state from opp-side to avoid coupling risk.
  const [showLeadLog,   setShowLeadLog]   = useState(false);
  const [leadLogForm,   setLeadLogForm]   = useState({type:"Call",note:"",scheduled_at:"",duration_mins:"",ns_enabled:false,ns_type:"Call",ns_due:"",ns_note:""});
  // Phase A.3 — Sprint 1 form (side-by-side feature flag)
  const [showAddV2, setShowAddV2] = useState(false);
  const [editLeadForV2, setEditLeadForV2] = useState(null); // Phase 2.2A — V2 dual-mode: null = Add, row = Edit
  const [editFormVersion, setEditFormVersion] = useState(0); // Phase 2.2A — bump on every Edit click to force V2 remount
  const [showReleaseDialog, setShowReleaseDialog] = useState(false); // Phase 2.1 Day 22 — broker release workflow
  const [opps,     setOpps]     = useState(globalOppsFromParent); // sync with global
  const [units,    setUnits]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [salePricing,setSalePricing]=useState([]);
  const [showAddOpp, setShowAddOpp]=useState(false);
  const [oppForm,  setOppForm]  = useState({title:"",unit_id:"",budget:"",assigned_to:"",notes:"",property_category:"Off-Plan"});
  // 16 May 2026: Consolidation - canonical opportunity dialog from Leads tab
  const [showCanonicalOppDialog, setShowCanonicalOppDialog] = useState(false);
  const [prefilledUnit, setPrefilledUnit] = useState(null);
  // Phase E dense layout: activities for ALL of this lead's opportunities (used to enrich opp rows)
  const [leadActivities, setLeadActivities] = useState([]);
  const canEdit = can(currentUser.role,"write");
  const canDel  = can(currentUser.role,"delete_leads");


  // ── Browser history sync ────────────────────────────────────────
  // Push state changes into browser history so the browser back button
  // navigates within the app (list ← lead ← opportunity) instead of
  // exiting the app entirely. Uses a ref to distinguish user-driven
  // back navigation from programmatic state changes.
  const skipPushRef = useRef(false);

  useEffect(()=>{
    // On mount: replace current entry with our initial state so popstate has something to roll back to
    window.history.replaceState({view:"list",selLeadId:null,selOppId:null}, "", window.location.pathname);

    const onPopState = (e)=>{
      const s = e.state;
      if(!s){
        // User went back past our entries — keep them on the list view
        skipPushRef.current = true;
        setView("list");
        setSelLeadId(null);
        setSelOpp(null);
        return;
      }
      skipPushRef.current = true;
      setView(s.view||"list");
      setSelLeadId(s.selLeadId||null);
      if(s.selOppId){
        // Find the opp in current state and restore it
        const found = opps.find(o=>o.id===s.selOppId) || globalOppsFromParent.find(o=>o.id===s.selOppId);
        setSelOpp(found||null);
      } else {
        setSelOpp(null);
      }
    };

    window.addEventListener("popstate", onPopState);
    return ()=>window.removeEventListener("popstate", onPopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Phase E W4 — deep-link handler: legacy code paths might pass opp filter.
  // Phase F W5 cut-over: redirect to Opportunities tab where opps live now.
  // Falls back to in-Leads view only if onNavigateToOpp is not wired.
  useEffect(()=>{
    if(!initialFilter || initialFilter.type !== "opp" || !initialFilter.oppId) return;
    if (onNavigateToOpp) {
      onNavigateToOpp(initialFilter.oppId);
      return;
    }
    // Defensive fallback (should rarely fire now)
    const opp = (opps||[]).find(o => o.id === initialFilter.oppId)
             || (globalOppsFromParent||[]).find(o => o.id === initialFilter.oppId);
    if(!opp) return;
    setSelOpp(opp);
    setSelLeadId(opp.lead_id);
    setView("opportunity");
  }, [initialFilter?.type, initialFilter?.oppId, opps.length, globalOppsFromParent.length, onNavigateToOpp]);

  // Phase F W4 ext — deep-link handler for leads (e.g. AI briefing surfaces a raw lead)
  useEffect(()=>{
    if(!initialFilter || initialFilter.type !== "lead" || !initialFilter.leadId) return;
    const lead = (leads||[]).find(l => l.id === initialFilter.leadId);
    if(!lead) return; // wait for leads to load
    setSelLeadId(lead.id);
    setView("lead");
  }, [initialFilter?.type, initialFilter?.leadId, leads.length]);

  useEffect(()=>{
    // After every view/selection change, push to history — unless the change came from popstate
    if(skipPushRef.current){
      skipPushRef.current = false;
      return;
    }
    const state = {view, selLeadId, selOppId: selOpp?.id || null};
    window.history.pushState(state, "", window.location.pathname);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[view, selLeadId, selOpp?.id]);
  // ────────────────────────────────────────────────────────────────

  // Load data
  useEffect(()=>{
    // Fix 12 May 2026: also propagate fetched opps to global state so Opportunities tab sees same data
    supabase.from("opportunities").select("*").eq("company_id", currentUser.company_id).order("created_at",{ascending:false}).then(({data})=>{
      const arr = data || [];
      setOpps(arr);
      setGlobalOpps(arr);
    });
    // 16 May 2026: Multi-tenant data isolation - filter by company_id
    // Prevents brokers from seeing/selecting units belonging to other companies
    // (Without this filter, opp creation could save cross-company unit_id refs)
    const _coId = currentUser?.company_id || null;
    if (_coId) {
      supabase.from("project_units").select("id,unit_ref,sub_type,project_id,status,purpose,floor_number,view,size_sqft,bedrooms").eq("company_id", _coId).then(({data})=>setUnits(data||[]));
      supabase.from("projects").select("id,name").eq("company_id", _coId).then(({data})=>setProjects(data||[]));
    } else {
      // No company context - load all (fallback for legacy/admin scenarios)
      supabase.from("project_units").select("id,unit_ref,sub_type,project_id,status,purpose,floor_number,view,size_sqft,bedrooms").then(({data})=>setUnits(data||[]));
      supabase.from("projects").select("id,name").then(({data})=>setProjects(data||[]));
    }
    // salePricing doesn't have company_id column directly - left as-is
    // (it joins via unit_id which is already filtered above)
    supabase.from("unit_sale_pricing").select("unit_id,asking_price").eq("company_id", currentUser.company_id).then(({data})=>setSalePricing(data||[]));
  },[]);

  // Phase E dense layout: when a lead is selected, fetch all activities for all its opportunities
  // so the opportunities list rows can show "last activity" preview inline.
  useEffect(()=>{
    if(!selLeadId){ setLeadActivities([]); return; }
    supabase
      .from("activities")
      .select("id,opportunity_id,type,note,created_at,stage_at_event,activity_subtype,structured_data,user_name")
      .eq("lead_id", selLeadId)
      .order("created_at",{ascending:false})
      .then(({data})=>setLeadActivities(data||[]));
  },[selLeadId]);

  if(!currentUser) return null;
  const selLead = leads.find(l=>l&&l.id===selLeadId);
  const leadOpps = selLeadId ? opps.filter(o=>o.lead_id===selLeadId) : [];

  // Filter leads — exclude pure lease leads from Sales CRM
  const visible = (can(currentUser.role,"see_all")?leads:leads.filter(l=>l&&l.assigned_to===currentUser.id))
    .filter(l=>l&&l.property_type!=="Lease");

  // Aggregated stage from opportunities
  const leadBestStage = (leadId)=>{
    const lo=opps.filter(o=>o.lead_id===leadId&&o.status==="Active");
    if(lo.length===0) return opps.find(o=>o.lead_id===leadId)?.stage||"New";
    const order=["Negotiation","Proposal Sent","Site Visit","Contacted","New"];
    for(const s of order){ if(lo.find(o=>o.stage===s)) return s; }
    return lo[0]?.stage||"New";
  };

  const filtered = visible.filter(l=>{
    const q=search.toLowerCase();
    const stage = leadBestStage(l.id);
    return(!q||l.name?.toLowerCase().includes(q)||l.email?.toLowerCase().includes(q)||l.phone?.includes(q)||l.source?.toLowerCase().includes(q))
      &&(fType==="All"||l.property_type===fType)
      &&(fStage==="All"||stage===fStage);
  });


  const saveOpp = async()=>{
    if(!selLeadId){return;}
    setSaving(true);
    try{
      const unit=units.find(u=>u.id===oppForm.unit_id);
      // 14 May 2026 Day 2 Math Flow: set current_* from salePricing at creation
      const unitPriceShowAddOpp = (salePricing || []).find(s => s.unit_id === oppForm.unit_id)?.asking_price;
      const isOffPlanShowAddOpp = (oppForm.property_category || "Off-Plan") === "Off-Plan";
      const payload={
        lead_id:selLeadId,
        company_id:currentUser.company_id||null,
        title:oppForm.title||(unit?`${unit.unit_ref} — ${selLead?.name}`:`Opportunity — ${selLead?.name}`),
        unit_id:oppForm.unit_id||null,
        budget:oppForm.budget?Number(oppForm.budget):null,
        assigned_to:oppForm.assigned_to||currentUser.id,
        notes:oppForm.notes||null,
        property_category:oppForm.property_category||"Off-Plan",
        stage:"New",status:"Active",
        created_by:currentUser.id,
        // Math flow current_* fields (set at creation)
        current_agreed_price: unitPriceShowAddOpp || null,
        current_admin_fee: 580,
        current_trustee_fee: isOffPlanShowAddOpp ? 4200 : null,
        current_values_updated_at: new Date().toISOString(),
        current_values_updated_by: currentUser.id,
      };
      const{data,error}=await supabase.from("opportunities").insert(payload).select().single();
      if(error)throw error;
      setOpps(p=>{const n=[data,...p];setGlobalOpps(n);return n;});
      showToast("Opportunity created","success");
      setShowAddOpp(false);
      setOppForm({title:"",unit_id:"",budget:"",assigned_to:"",notes:"",property_category:"Off-Plan"});
      // Phase F W5 cut-over: navigate to Opportunities tab instead of opening
      // OpportunityDetail inside Leads. Falls back to old in-place open if the
      // navigation prop wasn't passed (defensive).
      if (onNavigateToOpp) {
        onNavigateToOpp(data.id);
      } else {
        setSelOpp(data);
        setView("opportunity");
      }
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  // ── LIST VIEW ──────────────────────────────────────────────────
  if(view==="list") return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Toolbar */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{position:"relative",flex:1,minWidth:160}}>
          <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:14}}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, email…" style={{paddingLeft:32,width:"100%"}}/>
        </div>
        <select value={fType} onChange={e=>setFType(e.target.value)} style={{width:"auto"}}>
          <option value="All">All Types</option>
          <option value="Sale">Sale</option>
          <option value="Both">Both</option>
        </select>
        <select value={fStage} onChange={e=>setFStage(e.target.value)} style={{width:"auto"}}>
          <option value="All">All Stages</option>
          {["Walk-In","Referral","Online","Social Media","Cold Call","Exhibition","Portal","Other"].map(s=><option key={s}>{s}</option>)}
        </select>
        <span style={{fontSize:12,color:"#A0AEC0",whiteSpace:"nowrap"}}>{filtered.length}/{visible.length}</span>
        {canEdit&&(
          <button onClick={()=>{setEditFormVersion(v=>v+1);setShowAddV2(true);}} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>+ Add Lead</button>
        )}
      </div>

      {/* Lead summary strip */}
      <div style={{display:"flex",gap:8,marginBottom:12,flexShrink:0,flexWrap:"wrap"}}>
        <div style={{padding:"6px 14px",borderRadius:8,background:"#fff",border:"1px solid #E8EDF4",fontSize:12,color:"#0F2540",fontWeight:600}}>{visible.length} total contacts</div>
        <div style={{padding:"6px 14px",borderRadius:8,background:"#EFF6FF",border:"1px solid #BFDBFE",fontSize:12,color:"#1A5FA8",fontWeight:600}}>{opps.filter(o=>o.status==="Active").length} active opportunities</div>
        <div style={{padding:"6px 14px",borderRadius:8,background:"#E6F4EE",border:"1px solid #A8D5BE",fontSize:12,color:"#1A7F5A",fontWeight:600}}>{opps.filter(o=>o.stage==="Closed Won").length} won deals</div>
      </div>

      {/* Lead cards */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
        {filtered.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}>No contacts found</div>}
        {filtered.map(l=>{
          const lo=opps.filter(o=>o.lead_id===l.id);
          const activeOpps=lo.filter(o=>o.status==="Active");
          const wonOpps=lo.filter(o=>o.status==="Won");
          const bestStage=leadBestStage(l.id);
          const sm2=OPP_STAGE_META[bestStage]||{c:"#718096",bg:"#F7F9FC"};
          const assignedUser=users.find(u=>u.id===l.assigned_to);
          const totalVal=lo.reduce((s,o)=>s+(o.budget||0),0);
          if(fStage!=="All"&&bestStage!==fStage)return null;
          return (
            <div key={l.id} onClick={()=>{setSelLeadId(l.id);setView("lead");}}
              style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:8,padding:"10px 14px",cursor:"pointer",borderLeft:"3px solid #E2E8F0",transition:"all .12s"}}
              onMouseOver={e=>{e.currentTarget.style.background="#F7F9FC";e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,.06)";}}
              onMouseOut={e=>{e.currentTarget.style.background="#fff";e.currentTarget.style.boxShadow="none";}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <Av name={l.name} size={32}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={{fontWeight:700,fontSize:13,color:"#0F2540"}}>{l.name}</span>
                    {activeOpps.length>0&&<span style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:20,background:"#EFF6FF",color:"#1A5FA8"}}>{activeOpps.length} active opp{activeOpps.length!==1?"s":""}</span>}
                    {wonOpps.length>0&&<span style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A"}}>✓ {wonOpps.length} Won</span>}
                    {activeOpps.length===0&&wonOpps.length===0&&<span style={{fontSize:10,fontWeight:500,padding:"1px 7px",borderRadius:20,background:"#F7F9FC",color:"#94A3B8"}}>No opportunities</span>}
                    {(()=>{const IM={investor:{l:"Investor",c:"#1A7F5A",bg:"#E6F4EE"},owner_occupier:{l:"Owner-Occupier",c:"#1A5FA8",bg:"#E6EFF9"},hybrid:{l:"Hybrid",c:"#8A6200",bg:"#FDF3DC"},corporate:{l:"Corporate",c:"#5B21B6",bg:"#EDE9FE"},reseller:{l:"Reseller",c:"#B83232",bg:"#FCE8E8"}};const im=IM[l.buyer_intent];return im?<span style={{fontSize:10,fontWeight:600,padding:"1px 7px",borderRadius:20,background:im.bg,color:im.c}}>{im.l}</span>:null;})()}
                    {(()=>{const SM={customer:{l:"Customer",c:"#1A7F5A",bg:"#E6F4EE"},portfolio_customer:{l:"Portfolio",c:"#5B21B6",bg:"#EDE9FE"}};const sm=SM[l.lifecycle_stage];return sm?<span style={{fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:20,background:sm.bg,color:sm.c}}>{sm.l}</span>:null;})()}
                  </div>
                  <div style={{display:"flex",gap:10,fontSize:11,color:"#718096",marginTop:2,flexWrap:"wrap"}}>
                    {l.phone&&<span>{l.phone}</span>}
                    {l.email&&<span>{l.email}</span>}
                    {l.nationality&&<span>🌍 {l.nationality}</span>}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>{activeOpps.length} active opp{activeOpps.length!==1?"s":""}</div>
                  {totalVal>0&&<div style={{fontSize:11,color:"#718096"}}>{fmtM(totalVal)}</div>}
                  <div style={{fontSize:10,color:"#A0AEC0"}}>{assignedUser?.full_name||"Unassigned"}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Contact Modal */}
      {/* Phase A.3 — new buyer-type-aware lead form (side-by-side with existing modal) */}
      {showAddV2&&(
        <LeadCreationFormV2
          key={`${editLeadForV2?.id || "new"}-${editFormVersion}`}
          companyId={currentUser?.company_id}
          countries={refCountries}
          rules={refRules}
          currentUserId={currentUser?.id}
          editLead={editLeadForV2}
          onSubmit={async(payload)=>{
            if(editLeadForV2){
              // EDIT mode: UPDATE the existing lead
              const {data,error}=await supabase.from("leads").update(payload).eq("id",editLeadForV2.id).select().single();
              if(error) throw new Error(error.message||"Failed to update contact");
              return data;
            } else {
              // CREATE mode: INSERT new lead
              const {data,error}=await supabase.from("leads").insert(payload).select().single();
              if(error) throw new Error(error.message||"Failed to create contact");
              return data;
            }
          }}
          onCancel={()=>{setShowAddV2(false);setEditLeadForV2(null);}}
          onCreated={(savedLead)=>{
            setShowAddV2(false);
            if(editLeadForV2){
              // Update existing in state
              setLeads(p=>p.map(l=>l.id===savedLead.id?savedLead:l));
              showToast("Contact updated","success");
            } else {
              // Prepend new to state
              setLeads(p=>[savedLead,...p]);
              writeBrokerCreatedLog(savedLead, currentUser);
              showToast("Contact added","success");
            }
            setEditLeadForV2(null);
          }}
        />
      )}
    </div>

  );

  // ── LEAD DETAIL VIEW (contact + opportunities) ─────────────────
  if(view==="lead"&&selLead) return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* ── Helpers (inline, used only in this view) ── */}
      {(()=>{ /* no-op IIFE just to scope helpers via closures below */ })()}
      {/* Header — redesigned */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={()=>setView("list")} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>← Leads</button>
        <Av name={selLead.name} size={40}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:"'Inter',sans-serif",fontSize:16,fontWeight:700,color:"#0F2540",letterSpacing:"-.4px"}}>{selLead.name}</div>
          <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
            {(()=>{
              const BT_LABEL = {local_national:"Local national",gcc_resident_expat:"GCC resident expat",international_non_resident:"International (non-resident)",corporate:"Corporate"};
              const bt = selLead.buyer_type;
              return bt ? <span style={{fontSize:10,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#E8EDF4",color:"#0F2540"}}>{BT_LABEL[bt]||bt}</span> : null;
            })()}
            {(()=>{
              const KYC_META = {not_started:{c:"#8A6200",bg:"#FDF3DC",l:"KYC: Not started"},in_progress:{c:"#1A5FA8",bg:"#E6EFF8",l:"KYC: In progress"},verified:{c:"#1A7F5A",bg:"#E6F4EE",l:"KYC: Verified"},expired:{c:"#C53030",bg:"#FED7D7",l:"KYC: Expired"}};
              const k = selLead.kyc_status||"not_started";
              const m = KYC_META[k]||KYC_META.not_started;
              return <span style={{fontSize:10,fontWeight:600,padding:"2px 9px",borderRadius:20,background:m.bg,color:m.c}}>{m.l}</span>;
            })()}
            {(()=>{
              // Phase 2.2A — Lifecycle stage badge
              const LC_META = {
                raw:                {c:"#475569", bg:"#F1F5F9", l:"Raw"},
                qualified:          {c:"#1A5FA8", bg:"#E6EFF8", l:"Qualified"},
                active_prospect:    {c:"#8A6200", bg:"#FDF3DC", l:"Active Prospect"},
                customer:           {c:"#1A7F5A", bg:"#E6F4EE", l:"Customer"},
                portfolio_customer: {c:"#5B21B6", bg:"#EDE9FE", l:"Portfolio Customer"},
              };
              const ls = selLead.lifecycle_stage || "raw";
              const m = LC_META[ls] || LC_META.raw;
              return <span style={{fontSize:10,fontWeight:600,padding:"2px 9px",borderRadius:20,background:m.bg,color:m.c}}>{m.l}</span>;
            })()}
            {(()=>{
              // Phase 2.2A — Buyer intent badge (only shown if set)
              const BI_LABEL = {
                investor: "Investor",
                owner_occupier: "Owner-Occupier",
                hybrid: "Hybrid",
                corporate: "Corporate buyer",
                reseller: "Reseller",
              };
              const bi = selLead.buyer_intent;
              return bi ? <span style={{fontSize:10,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#FFF7E6",color:"#9C6500",border:"1px solid #F5D78F"}}>{BI_LABEL[bi]||bi}</span> : null;
            })()}
            {selLead.pep_flag&&<span style={{fontSize:10,fontWeight:600,padding:"2px 9px",borderRadius:20,background:"#FDF3DC",color:"#8A6200"}}>⚠ PEP</span>}
          </div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {canEdit&&<button onClick={()=>{setEditLeadForV2(selLead);setEditFormVersion(v=>v+1);setShowAddV2(true);}} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>✏ Edit</button>}
          {canEdit&&<button onClick={()=>setShowCanonicalOppDialog(true)} style={{padding:"6px 14px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ New Opportunity</button>}
        </div>
      </div>

      {/* ── 2-Column: Assigned + Quick Proposals ─────────────────── */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div>
      {/* ── Phase 2.1 Day 22: Assignment section ─────────────────── */}
      {(()=>{
        const assignedUser = users.find(u => u.id === selLead.assigned_to);
        const isOwner = selLead.assigned_to === currentUser?.id;
        const assignedDate = selLead.last_assigned_at ? new Date(selLead.last_assigned_at) : null;
        const lastActivity = selLead.last_broker_activity_at ? new Date(selLead.last_broker_activity_at) : null;
        const daysSince = (d) => {
          if (!d) return null;
          const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
          if (days === 0) return "today";
          if (days === 1) return "1 day ago";
          return `${days} days ago`;
        };
        const STATUS_META = {
          assigned:      { c: "#1A7F5A", bg: "#E6F4EE", l: "Assigned" },
          unassigned:    { c: "#B45309", bg: "#FEF3C7", l: "Unassigned" },
          released:      { c: "#C53030", bg: "#FED7D7", l: "Released" },
          stale_flagged: { c: "#8A6200", bg: "#FDF3DC", l: "Stale" },
        };
        const sm = STATUS_META[selLead.assignment_status] || STATUS_META.assigned;
        return (
          <div style={{
            marginBottom: 14,
            padding: "12px 16px",
            background: "#fff",
            border: "1px solid #E5E9EF",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(15, 37, 64, 0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0,
            }}>
              👤
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7785", letterSpacing: "0.4px", textTransform: "uppercase" }}>
                  Assigned to
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F2540" }}>
                  {assignedUser?.full_name || "Unassigned"}
                </span>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                  background: sm.bg, color: sm.c, textTransform: "uppercase", letterSpacing: "0.4px",
                }}>
                  {sm.l}
                </span>
                {selLead.origin === "pool_sourced" && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                    background: "#E6EFF8", color: "#1A5FA8", textTransform: "uppercase", letterSpacing: "0.4px",
                  }}>
                    Pool-sourced
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#6B7785" }}>
                {assignedDate && <>Assigned {daysSince(assignedDate)} · </>}
                {lastActivity ? <>Last activity {daysSince(lastActivity)}</> : <>No activity recorded</>}
              </div>
            </div>
            {isOwner && selLead.assigned_to && (
              <button
                onClick={() => setShowReleaseDialog(true)}
                style={{
                  padding: "7px 14px",
                  background: "#fff",
                  color: "#B42318",
                  border: "1.5px solid #FECDCA",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Release Lead
              </button>
            )}
          </div>
        );
      })()}
        </div>
        <div style={{display:"flex", flexDirection:"row", alignItems:"center", flexWrap:"wrap", padding:"12px 16px", background:"#fff", border:"1px solid #E5E9EF", borderRadius:12, gap:16}}>
      {/* Quick Proposals Panel — Phase 2.3 */}
      <QuickProposalsPanel leadId={selLead.id} leadEmail={selLead.email} leadName={selLead.name} leadPhone={selLead.phone} company={currentUser.company || {}} currentUser={currentUser} onConvertUnit={(unitData) => { setPrefilledUnit(unitData); setShowCanonicalOppDialog(true); }} />
        </div>
      </div>

      {/* Release Dialog (Phase 2.1 Day 22) */}
      {showReleaseDialog && (
        <ReleaseDialog
          lead={selLead}
          currentUser={currentUser}
          users={users}
          onClose={() => setShowReleaseDialog(false)}
          onReleased={(result) => {
            setShowReleaseDialog(false);
            // Refresh lead state from DB
            // selLead is derived from leads.find(); updating leads triggers re-derivation
            supabase.from("leads").select("*").eq("id", selLead.id).single().then(({data}) => {
              if (data) setLeads(p => p.map(l => l.id === data.id ? data : l));
            });
          }}
          showToast={showToast}
        />
      )}


      {/* Identity + Notes — dense single-card layout */}
      {(()=>{
        const iso2ToFlag = (iso2)=>{ if(!iso2||iso2.length!==2)return ""; const c=iso2.toUpperCase(); return String.fromCodePoint(0x1F1E6+(c.charCodeAt(0)-65))+String.fromCodePoint(0x1F1E6+(c.charCodeAt(1)-65)); };
        const SOF_LABEL = {salary:"Salary",business:"Business income",investments:"Investments",inheritance:"Inheritance",sale_of_property:"Sale of property",savings:"Savings",gift:"Gift",other:"Other"};
        const items = [];
        if(selLead.phone_e164||selLead.phone) {
          const ph = selLead.phone_e164||selLead.phone;
          items.push({icon:"📞", label:"Phone", val:<a href={`tel:${ph}`} style={{color:"#1A5FA8",textDecoration:"none",fontWeight:600}}>{ph}</a>});
        }
        if(selLead.email) items.push({icon:"✉️", label:"Email", val:<a href={`mailto:${selLead.email}`} style={{color:"#1A5FA8",textDecoration:"none",fontWeight:600}}>{selLead.email}</a>});
        if(selLead.nationality_iso2) items.push({icon:"🌍", label:"Nationality", val:`${iso2ToFlag(selLead.nationality_iso2)} ${refCountries.find(c=>c.iso2===selLead.nationality_iso2)?.name_en || selLead.nationality_iso2}`});
        else if(selLead.nationality) items.push({icon:"🌍", label:"Nationality", val:selLead.nationality});
        if(selLead.residence_iso2) items.push({icon:"🏠", label:"Residence", val:`${iso2ToFlag(selLead.residence_iso2)} ${refCountries.find(c=>c.iso2===selLead.residence_iso2)?.name_en || selLead.residence_iso2}`});
        if(selLead.tax_residency_iso2 && selLead.tax_residency_iso2!==selLead.residence_iso2) items.push({icon:"💼", label:"Tax residency", val:`${iso2ToFlag(selLead.tax_residency_iso2)} ${refCountries.find(c=>c.iso2===selLead.tax_residency_iso2)?.name_en || selLead.tax_residency_iso2}`});
        if(selLead.source_of_funds) items.push({icon:"💰", label:"Source of funds", val:SOF_LABEL[selLead.source_of_funds]||selLead.source_of_funds});
        if(selLead.source) items.push({icon:"📍", label:"Lead source", val:selLead.source});
        if(selLead.property_type) items.push({icon:"🔍", label:"Looking for", val:selLead.property_type});
        if(selLead.budget&&Number(selLead.budget)>0) items.push({icon:"💵", label:"Budget", val:`AED ${Number(selLead.budget).toLocaleString()}`});
        if(selLead.legal_name_en && selLead.legal_name_en!==selLead.name) items.push({icon:"📛", label:"Legal name", val:selLead.legal_name_en});
        if(selLead.legal_name_ar) items.push({icon:"📛", label:"Legal (Arabic)", val:<span style={{direction:"rtl",unicodeBidi:"bidi-override",fontFamily:"'Noto Sans Arabic','Inter',sans-serif"}}>{selLead.legal_name_ar}</span>});
        if(items.length===0 && !selLead.notes) return null;
        return (
          <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"12px 16px",marginBottom:14}}>
            {items.length>0 && (
              <div style={{display:"flex",flexWrap:"wrap",gap:"8px 22px",alignItems:"center"}}>
                {items.map((it,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:7,fontSize:12,minWidth:0}}>
                    <span style={{fontSize:13,opacity:.85}}>{it.icon}</span>
                    <span style={{color:"#94A3B8",fontWeight:500}}>{it.label}:</span>
                    <span style={{color:"#0F2540",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:240}}>{it.val}</span>
                  </div>
                ))}
              </div>
            )}
            {selLead.notes && (
              <div style={{marginTop:items.length>0?10:0,paddingTop:items.length>0?10:0,borderTop:items.length>0?"1px dashed #EEF2F7":"none",display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontSize:10,color:"#8A6200",textTransform:"uppercase",letterSpacing:".5px",fontWeight:700,minWidth:50,paddingTop:1}}>Notes</span>
                <div style={{fontSize:12,color:"#3A3A2E",whiteSpace:"pre-wrap",lineHeight:1.5,flex:1}}>{selLead.notes}</div>
              </div>
            )}
          </div>
        );
      })()}
      {/* Phase 2.2B — People section (Contacts Subsystem, read-only) */}
      <LeadPeopleSection leadId={selLead.id} companyId={currentUser?.company_id} currentUserId={currentUser?.id} countries={refCountries} />

      {/* 23 May 2026: Lead-stage Activities section (restored from April original design) */}
      {(()=>{
        const leadActs = activities.filter(a=>a.lead_id===selLead.id);
        const upcomingCount = leadActs.filter(a=>a.status==="upcoming"||(a.scheduled_at&&new Date(a.scheduled_at)>new Date()&&a.status!=="completed"&&a.status!=="no_show"&&a.status!=="cancelled")).length;
        return (
          <div style={{marginBottom:14}}>
            {/* Log Activity action row */}
            <div style={{background:"#F8FAFC",border:"1px solid #E8EDF4",borderRadius:10,padding:"10px 14px",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                <div style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".6px"}}>Log activity</div>
                {leadActs.length>0&&(
                  <div style={{fontSize:10,color:"#64748B"}}>
                    {leadActs.length} total{upcomingCount>0?(" · "+upcomingCount+" upcoming"):""}
                  </div>
                )}
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <button onClick={()=>{setLeadLogForm({type:"Call",note:"",scheduled_at:"",duration_mins:"",ns_enabled:false,ns_type:"Call",ns_due:"",ns_note:""});setShowLeadLog(true);}}
                  style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540"}}>
                  📞 Log Call
                </button>
                <button onClick={()=>{setLeadLogForm({type:"WhatsApp",note:"",scheduled_at:"",duration_mins:"",ns_enabled:false,ns_type:"WhatsApp",ns_due:"",ns_note:""});setShowLeadLog(true);}}
                  style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540"}}>
                  💬 WhatsApp
                </button>
                <button onClick={()=>{setLeadLogForm({type:"Meeting",note:"",scheduled_at:"",duration_mins:"",ns_enabled:false,ns_type:"Call",ns_due:"",ns_note:""});setShowLeadLog(true);}}
                  style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540"}}>
                  🤝 Meeting
                </button>
                <button onClick={()=>{setLeadLogForm({type:"Email",note:"",scheduled_at:"",duration_mins:"",ns_enabled:false,ns_type:"Email",ns_due:"",ns_note:""});setShowLeadLog(true);}}
                  style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540"}}>
                  ✉️ Email
                </button>
                <button onClick={()=>{setLeadLogForm({type:"Note",note:"",scheduled_at:"",duration_mins:"",ns_enabled:false,ns_type:"Call",ns_due:"",ns_note:""});setShowLeadLog(true);}}
                  style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",color:"#0F2540"}}>
                  📝 Add Note
                </button>
              </div>
            </div>
            {/* ActivitiesList - render full lifecycle (upcoming/past, outcomes, etc.) for this lead */}
            {leadActs.length>0&&(
              <ActivitiesList activities={leadActs} setActivities={setActivities} opp={null} canEdit={canEdit} showToast={showToast} currentStage={null} units={units}/>
            )}
          </div>
        );
      })()}

      {/* Opportunities — dense table layout */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0F2540"}}>
          Opportunities ({leadOpps.length})
        </div>
        {leadOpps.length>0&&(
          <div style={{fontSize:11,color:"#94A3B8"}}>
            Click any row to open the opportunity
          </div>
        )}
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {leadOpps.length===0&&(
          <div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0",background:"#fff",border:"1px dashed #E2E8F0",borderRadius:12}}>
            <div style={{fontSize:36,marginBottom:10}}>🎯</div>
            <div style={{fontSize:14,fontWeight:600,color:"#0F2540",marginBottom:6}}>No opportunities yet</div>
            <div style={{fontSize:12,marginBottom:16}}>Add an opportunity for each property this contact is interested in</div>
            {canEdit&&<button onClick={()=>setShowCanonicalOppDialog(true)} style={{padding:"10px 24px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Add First Opportunity</button>}
          </div>
        )}
        {/* 23 May 2026: Lead-stage Activity Log Dialog - full feature parity with Opp Detail */}
        {showLeadLog && (
          <LogActivityModal
            lead={selLead}
            opp={null}
            currentUser={currentUser}
            showToast={showToast}
            defaultType={leadLogForm.type||"Call"}
            onClose={()=>setShowLeadLog(false)}
            onSaved={async(data, nextStepIntent)=>{
              setActivities(p=>[data,...p]);
              if(nextStepIntent && nextStepIntent.due){
                const triggerAt = new Date(nextStepIntent.due);
                triggerAt.setHours(9,0,0,0);
                const{error:remErr}=await supabase.from("reminders").insert({
                  company_id: currentUser.company_id || null,
                  user_id: currentUser.id,
                  related_lead_id: selLead.id,
                  related_activity_id: data.id,
                  trigger_at: triggerAt.toISOString(),
                  title: `${nextStepIntent.type} — ${selLead.name}`,
                  body: nextStepIntent.note || "",
                  reason: "lead_followup",
                  status: "pending",
                });
                if(remErr) console.warn("Reminder create failed:", remErr.message);
              }
              setShowLeadLog(false);
            }}
          />
        )}

        {leadOpps.length>0&&(
          <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden"}}>
            {/* Header row */}
            <div style={{
              display:"grid",
              gridTemplateColumns:"110px minmax(220px,1.7fr) 130px 110px minmax(180px,1.4fr) 70px 28px",
              gap:12,padding:"9px 14px",
              background:"#F8FAFC",borderBottom:"1px solid #E2E8F0",
              fontSize:10,fontWeight:700,color:"#64748B",textTransform:"uppercase",letterSpacing:".5px",
            }}>
              <div>Stage</div>
              <div>Title · Unit</div>
              <div style={{textAlign:"right"}}>Value</div>
              <div>In stage</div>
              <div>Last activity</div>
              <div>Owner</div>
              <div></div>
            </div>

            {/* Data rows */}
            {leadOpps.map((opp,idx)=>{
              const unit=units.find(u=>u.id===opp.unit_id);
              const proj=unit?projects.find(p=>p.id===unit.project_id):null;
              const sp=unit?salePricing.find(s=>s.unit_id===unit.id):null;
              const sm3=OPP_STAGE_META[opp.stage]||{c:"#718096",bg:"#F7F9FC"};
              const agent=users.find(u=>u.id===opp.assigned_to);
              const oppActivities = leadActivities.filter(a=>a.opportunity_id===opp.id);
              const lastAct = oppActivities[0];
              const fmtRelative = (d)=>{
                const diff = (new Date() - new Date(d)) / 1000;
                if(diff<60) return "just now";
                if(diff<3600) return `${Math.floor(diff/60)}m ago`;
                if(diff<86400) return `${Math.floor(diff/3600)}h ago`;
                const days = Math.floor(diff/86400);
                return days===1?"1d ago":`${days}d ago`;
              };
              const actIcons = {Call:"📞",Email:"✉️",Meeting:"🤝",Visit:"🏠","Site Visit":"🏠",WhatsApp:"💬",Note:"📝","Stage Change":"🎯",Proposal:"📄"};
              const lastActText = lastAct ? (lastAct.structured_data?.discussion || lastAct.structured_data?.feedback || lastAct.note || "") : "";
              const lastActPreview = lastActText.slice(0,55) + (lastActText.length>55?"…":"");
              const stageAge = opp.stage_updated_at?Math.floor((new Date()-new Date(opp.stage_updated_at))/864e5):null;
              const isStale = stageAge!==null && stageAge>=7 && opp.status==="Active";
              const stageAgeLabel = stageAge===null?"—":stageAge===0?"today":stageAge===1?"1 day":`${stageAge} days`;
              const initials = (agent?.full_name||"?").split(" ").map(w=>w[0]).filter(Boolean).slice(0,2).join("").toUpperCase();
              const value = sp?.asking_price || opp.budget || null;

              return (
                <div key={opp.id}
                  onClick={()=>{
                    // Phase F W5 cut-over — navigate to Opportunities tab.
                    // Falls back to in-Leads view if prop wasn't passed.
                    if (onNavigateToOpp) onNavigateToOpp(opp.id);
                    else { setSelOpp(opp); setView("opportunity"); }
                  }}
                  onMouseOver={e=>{e.currentTarget.style.background="#F8FAFC";}}
                  onMouseOut={e=>{e.currentTarget.style.background="#fff";}}
                  style={{
                    display:"grid",
                    gridTemplateColumns:"110px minmax(220px,1.7fr) 130px 110px minmax(180px,1.4fr) 70px 28px",
                    gap:12,padding:"11px 14px",
                    borderTop: idx===0?"none":"1px solid #EEF2F7",
                    borderLeft:`3px solid ${sm3.c}`,
                    cursor:"pointer",transition:"background .12s",
                    alignItems:"center",
                    background:"#fff",
                  }}>

                  {/* Stage */}
                  <div style={{minWidth:0}}>
                    <span style={{
                      display:"inline-block",fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:20,
                      background:sm3.bg,color:sm3.c,whiteSpace:"nowrap",
                    }}>{opp.stage}</span>
                    {opp.status==="Won"&&<div style={{fontSize:9,fontWeight:700,color:"#1A7F5A",marginTop:3}}>✓ WON</div>}
                    {opp.status==="Lost"&&<div style={{fontSize:9,fontWeight:700,color:"#718096",marginTop:3}}>LOST</div>}
                    {opp.status==="On Hold"&&<div style={{fontSize:9,fontWeight:700,color:"#8A6200",marginTop:3}}>ON HOLD</div>}
                  </div>

                  {/* Title + Unit/Project */}
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#0F2540",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {opp.title||"Opportunity"}
                    </div>
                    <div style={{fontSize:11,color:"#64748B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:2}}>
                      {unit ? `🏠 ${unit.unit_ref}${unit.sub_type?` · ${unit.sub_type}`:""}${proj?` · ${proj.name}`:""}` : <span style={{color:"#94A3B8",fontStyle:"italic"}}>No unit linked</span>}
                    </div>
                  </div>

                  {/* Value */}
                  <div style={{textAlign:"right",minWidth:0}}>
                    {value ? (
                      <>
                        <div style={{fontSize:13,fontWeight:700,color:"#1A5FA8"}}>AED {Number(value).toLocaleString()}</div>
                        {sp ? null : <div style={{fontSize:9,color:"#94A3B8",fontWeight:600,marginTop:1}}>budget</div>}
                      </>
                    ) : (
                      <span style={{fontSize:11,color:"#CBD5E1"}}>—</span>
                    )}
                  </div>

                  {/* In stage */}
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:12,color:isStale?"#C53030":"#475569",fontWeight:isStale?700:500}}>
                      {stageAgeLabel}
                    </div>
                    {isStale&&<div style={{fontSize:9,fontWeight:700,color:"#C53030",marginTop:1}}>⚠ STALE</div>}
                    {opp.proposal_sent_at&&<div style={{fontSize:9,color:"#A06810",marginTop:1}}>📤 sent {fmtDate(opp.proposal_sent_at)}</div>}
                  </div>

                  {/* Last activity */}
                  <div style={{minWidth:0,fontSize:11,color:"#475569",overflow:"hidden"}}>
                    {lastAct ? (
                      <>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:1}}>
                          <span style={{fontSize:12}}>{actIcons[lastAct.type]||"📋"}</span>
                          <span style={{color:"#94A3B8",fontWeight:600,fontSize:10}}>{fmtRelative(lastAct.created_at)}</span>
                          {lastAct.stage_at_event&&<span style={{fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:6,background:"#F1F5F9",color:"#64748B"}}>{lastAct.stage_at_event}</span>}
                        </div>
                        {lastActPreview&&<div style={{fontSize:11,color:"#64748B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontStyle:"italic"}}>"{lastActPreview}"</div>}
                      </>
                    ) : (
                      <span style={{fontSize:11,color:"#94A3B8",fontStyle:"italic"}}>No activity yet</span>
                    )}
                  </div>

                  {/* Owner */}
                  <div style={{minWidth:0}} title={agent?.full_name||"Unassigned"}>
                    {agent ? (
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:24,height:24,borderRadius:"50%",background:"#0F2540",color:"#C9A84C",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,flexShrink:0}}>
                          {initials}
                        </div>
                      </div>
                    ) : (
                      <span style={{fontSize:11,color:"#CBD5E1"}}>—</span>
                    )}
                  </div>

                  {/* Chevron */}
                  <div style={{textAlign:"right",color:"#CBD5E1",fontSize:14}}>›</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Opportunity Modal */}
      {/* 16 May 2026: Canonical opportunity dialog (consolidation) */}
      {showCanonicalOppDialog && (
        <CreateOpportunityDialog
          leads={leads}
          setLeads={setLeads}
          units={units}
          projects={projects}
          salePricing={salePricing}
          users={users}
          currentUser={currentUser}
          showToast={showToast}
          prefilledLead={selLead}
          prefilledUnit={prefilledUnit}
          onClose={() => setShowCanonicalOppDialog(false)}
          onCreated={(newOpp, newLead) => {
            // Update LOCAL opps (what leadOpps filters on) so the new opp appears
            // on this lead's Opportunities list immediately — broker stays in
            // context and can add more for the same buyer. Also sync global list.
            setOpps(prev => prev.find(o=>o.id===newOpp.id) ? prev : [newOpp, ...prev]);
            if (setGlobalOpps) setGlobalOpps(prev => prev.find(o=>o.id===newOpp.id) ? prev : [newOpp, ...prev]);
            setShowCanonicalOppDialog(false);
          }}
        />
      )}
      {showAddOpp&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1100,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:500,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(11,31,58,.4)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
              <div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#0F2540"}}>🎯 New Opportunity</div>
                <div style={{fontSize:11,color:"#64748B",marginTop:2}}>for {selLead.name}</div>
              </div>
              <button onClick={()=>setShowAddOpp(false)} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem",flex:1}}>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Opportunity Title</label>
                  <input value={oppForm.title} onChange={e=>setOppForm(f=>({...f,title:e.target.value}))} placeholder="e.g. 2BR Palm Jumeirah (auto-filled if unit selected)"/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Property Category *</label>
                  <div style={{display:"flex",gap:8}}>
                    {[["Off-Plan","🏗️"],["Ready / Resale","🔑"],["Commercial","🏢"]].map(([cat,icon])=>(
                      <button key={cat} onClick={()=>setOppForm(f=>({...f,property_category:cat}))}
                        style={{flex:1,padding:"8px",borderRadius:8,border:`1.5px solid ${oppForm.property_category===cat?"#0F2540":"#E2E8F0"}`,background:oppForm.property_category===cat?"#0F2540":"#fff",color:oppForm.property_category===cat?"#fff":"#4A5568",fontSize:12,cursor:"pointer",fontWeight:oppForm.property_category===cat?600:400}}>
                        {icon} {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Linked Unit *</label>
                  {/* 13 May 2026: Replaced plain <select> with rich UnitPickerRich for demo consistency */}
                  {/* Preserves: title auto-fill on selection. Filters: Available + Sale/Both purpose. */}
                  <UnitPickerRich
                    value={oppForm.unit_id}
                    onSelect={(unitId) => {
                      const u = units.find(x => x.id === unitId);
                      setOppForm(f => ({
                        ...f,
                        unit_id: unitId,
                        title: u && !f.title ? `${u.unit_ref} — ${selLead?.name || ""}` : f.title
                      }));
                    }}
                    units={units.filter(u => u.status === "Available" && (u.purpose === "Sale" || u.purpose === "Both"))}
                    projects={projects}
                    salePricing={salePricing}
                  />
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Budget (AED)</label>
                  <input type="number" value={oppForm.budget} onChange={e=>setOppForm(f=>({...f,budget:e.target.value}))} placeholder="Client's budget"/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Assign To</label>
                  <select value={oppForm.assigned_to} onChange={e=>setOppForm(f=>({...f,assigned_to:e.target.value}))}>
                    {users.filter(u=>u.is_active).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label>
                  <textarea value={oppForm.notes} onChange={e=>setOppForm(f=>({...f,notes:e.target.value}))} rows={3} placeholder="Any initial notes…"/>
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0"}}>
              <button onClick={()=>setShowAddOpp(false)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={saveOpp} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>{saving?"Saving…":"Create Opportunity"}</button>
            </div>
          </div>
        </div>
      )}
      {/* Phase 2.1 — Floating Action Button for activity logging */}
      <button
        onClick={()=>{
          setLeadLogForm({type:"Call",note:"",scheduled_at:"",duration_mins:"",ns_enabled:false,ns_type:"Call",ns_due:"",ns_note:""});
          setShowLeadLog(true);
        }}
        title="Log activity"
        style={{
          position:"fixed",
          bottom:24,
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
      {/* Phase 2.2A — V2 dual-mode form for Edit Contact from Lead Detail */}
      {showAddV2&&(
        <LeadCreationFormV2
          key={`${editLeadForV2?.id || "new"}-${editFormVersion}`}
          companyId={currentUser?.company_id}
          countries={refCountries}
          rules={refRules}
          currentUserId={currentUser?.id}
          editLead={editLeadForV2}
          onSubmit={async(payload)=>{
            if(editLeadForV2){
              const {data,error}=await supabase.from("leads").update(payload).eq("id",editLeadForV2.id).select().single();
              if(error) throw new Error(error.message||"Failed to update contact");
              return data;
            } else {
              const {data,error}=await supabase.from("leads").insert(payload).select().single();
              if(error) throw new Error(error.message||"Failed to create contact");
              return data;
            }
          }}
          onCancel={()=>{setShowAddV2(false);setEditLeadForV2(null);}}
          onCreated={(savedLead)=>{
            setShowAddV2(false);
            if(editLeadForV2){
              setLeads(p=>p.map(l=>l.id===savedLead.id?savedLead:l));
              showToast("Contact updated","success");
            } else {
              setLeads(p=>[savedLead,...p]);
              writeBrokerCreatedLog(savedLead, currentUser);
              showToast("Contact added","success");
            }
            setEditLeadForV2(null);
          }}
        />
      )}
    </div>
  );

  // ── OPPORTUNITY DETAIL VIEW ────────────────────────────────────
  if(view==="opportunity"&&selOpp) return (
    <OpportunityDetail
      key={selOpp.id}
      opp={selOpp}
      lead={selLead||leads.find(l=>l.id===selOpp.lead_id)||{}}
      units={units}
      projects={projects}
      salePricing={salePricing}
      users={users}
      currentUser={currentUser}
      showToast={showToast}
      onBack={()=>{setView("lead");setSelOpp(null);}}
      onUpdated={(updated)=>{
        setSelOpp(updated);
        setOpps(p=>{const n=p.map(o=>o.id===updated.id?updated:o);setGlobalOpps(n);return n;});
      }}
      onActivityLog={(type)=>{setShowActivityModal({lead: selLead || leads.find(l=>l.id===selOpp.lead_id) || {}}); }}
    />
  );

  return null;
}


export default Leads;
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = "https://ysceukgpimzfqixtnbnp.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzY2V1a2dwaW16ZnFpeHRuYm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDI5OTQsImV4cCI6MjA4OTkxODk5NH0.WZSyGeOEbiRo1wt13syheTOyiAToMWXInxIaBgaqq8k";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

function LeaseOpportunityDetail({ opp, tenant, units, projects, leasePricing, users, currentUser, showToast, onBack, onUpdated }) {
  const [activeTab,  setActiveTab]  = useState("details");
  const [activities, setActivities] = useState([]);
  const [payments,   setPayments]   = useState([]);
  const [contract,   setContract]   = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [showLog,    setShowLog]    = useState(false);
  const [showPayment,setShowPayment]= useState(false);
  const [editPayment,setEditPayment]= useState(null);
  const [logForm,    setLogForm]    = useState({type:"Call",note:"",scheduled_at:"",next_steps:"",duration_mins:""});
  const [payForm,    setPayForm]    = useState({payment_type:"Security Deposit",amount:"",cheque_number:"",bank_name:"",due_date:"",status:"Pending",notes:""});
  const [showPDC,    setShowPDC]    = useState(false);
  const [pdcForm,    setPdcForm]    = useState({num_cheques:"1",annual_rent:"",start_date:"",bank_name:"",notes:"",start_cheque_num:""});
  const [pdcChequeNums, setPdcChequeNums] = useState({});
  const canEdit = can(currentUser.role,"write");
  const [tookOwnership, setTookOwnership] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [reassignForm, setReassignForm] = useState({assigned_to:"", reason:""});
  const [showStageGate, setShowStageGate] = useState(null);
  const [stageGateForm, setStageGateForm] = useState({});
  const isOwner = opp.assigned_to === currentUser.id;
  const isAdmin = ["super_admin","admin"].includes(currentUser.role);
  const isManager = ["leasing_manager","sales_manager"].includes(currentUser.role);
  const canAction = isOwner || tookOwnership;
  const canReassign = isAdmin || isManager;
  const isSigned = opp.stage==="Lease Signed";
  const isReserved = ["Reserved","Lease Signed"].includes(opp.stage);
  const hasPayments = payments.length>0;
  const allPaymentsCleared = hasPayments && payments.every(p=>["Cleared","Received"].includes(p.status));
  const canAccessAgreement = isReserved && hasPayments;

  const unit  = units.find(u=>u.id===opp.unit_id);
  const proj  = unit ? projects.find(p=>p.id===unit.project_id) : null;
  const lp    = unit ? leasePricing.find(l=>l.unit_id===unit.id) : null;
  const agent = users.find(u=>u.id===opp.assigned_to);
  const sm    = LEASE_STAGE_META[opp.stage]||LEASE_STAGE_META["New Enquiry"];

  useEffect(()=>{
    supabase.from("activities").select("*").eq("lease_opportunity_id",opp.id).order("created_at",{ascending:false}).then(({data})=>setActivities(data||[]));
    supabase.from("lease_payments").select("*").eq("lease_opportunity_id",opp.id).order("created_at").then(({data})=>setPayments(data||[]));
    supabase.from("lease_contracts").select("*").eq("lease_opportunity_id",opp.id).limit(1).then(({data})=>setContract(data?.[0]||null));
  },[opp.id]);

  const LEASE_GATED = ["Offer Made","Reserved","Lease Signed","Lost"];

  const moveStage = async(toStage) => {
    if(!canAction){showToast("You are not the assigned agent — take ownership first","error");return;}
    if(LEASE_GATED.includes(toStage)){
      setStageGateForm({});
      setShowStageGate(toStage);
      return;
    }
    await commitLeaseStageMove(toStage, {});
  };

  const commitLeaseStageMove = async(toStage, extraData) => {
    // Gate: Lease Signed requires signed agreement
    if(toStage==="Lease Signed"){
      if(!contract){showToast("Create a rental agreement before marking as Lease Signed","error");return;}
      if(contract.status!=="Signed"){showToast("Agreement must be signed before marking as Lease Signed","error");return;}
      if(!hasPayments){showToast("Add payments before marking as Lease Signed","error");return;}
    }
    const{error}=await supabase.from("lease_opportunities").update({
      stage:toStage, stage_updated_at:new Date().toISOString(), ...extraData
    }).eq("id",opp.id);
    if(!error){
      if(toStage==="Lease Signed"&&opp.unit_id)
        await supabase.from("project_units").update({status:"Leased"}).eq("id",opp.unit_id);
      if(toStage==="Reserved"&&opp.unit_id)
        await supabase.from("project_units").update({status:"Reserved"}).eq("id",opp.unit_id);
      showToast(`Moved to ${toStage}`,"success");
      if(onUpdated)onUpdated({...opp,stage:toStage,...extraData});
      setShowStageGate(null);
    } else showToast(error.message,"error");
  };

  const saveLog = async()=>{
    if(!logForm.note.trim()&&!logForm.next_steps.trim()){showToast("Add notes or next steps","error");return;}
    setSaving(true);
    const isScheduled = logForm.scheduled_at && new Date(logForm.scheduled_at) > new Date();
    const noteText = [
      logForm.note,
      logForm.next_steps?("\n\n✅ Next Steps: "+logForm.next_steps):"",
      logForm.scheduled_at?("\n📅 Scheduled: "+new Date(logForm.scheduled_at).toLocaleString("en-AE",{dateStyle:"medium",timeStyle:"short"})):"",
      logForm.duration_mins?("\n⏱ Duration: "+logForm.duration_mins+" mins"):"",
    ].filter(Boolean).join("");
    const{data,error}=await supabase.from("activities").insert({
      opportunity_id:null, lease_opportunity_id:opp.id, lead_id:null,
      type:logForm.type, note:noteText,
      scheduled_at:logForm.scheduled_at||null,
      status:isScheduled?"upcoming":"completed",
      user_id:currentUser.id, user_name:currentUser.full_name,
      lead_name:tenant?.full_name||"", company_id:currentUser.company_id||null,
    }).select().single();
    if(!error){setActivities(p=>[data,...p]);showToast("Task logged","success");setShowLog(false);setLogForm({type:"Call",note:"",scheduled_at:"",next_steps:"",duration_mins:""});}
    setSaving(false);
  };

  const savePayment = async()=>{
    if(!payForm.amount){showToast("Amount required","error");return;}
    setSaving(true);
    try{
      // Check duplicate cheque number
      if(payForm.cheque_number&&!editPayment){
        const dup = payments.find(p=>p.cheque_number===payForm.cheque_number&&p.id!==editPayment?.id);
        if(dup){showToast("Cheque number "+payForm.cheque_number+" already exists","error");setSaving(false);return;}
      }
      const payload={...payForm,amount:Number(payForm.amount),opportunity_id:null,lease_opportunity_id:opp.id,
        tenant_id:opp.tenant_id||null,company_id:currentUser.company_id||null,created_by:currentUser.id};
      let data,error;
      if(editPayment){
        ({data,error}=await supabase.from("lease_payments").update(payload).eq("id",editPayment.id).select().single());
        if(!error)setPayments(p=>p.map(x=>x.id===editPayment.id?data:x));
      } else {
        ({data,error}=await supabase.from("lease_payments").insert(payload).select().single());
        if(!error)setPayments(p=>[...p,data]);
      }
      if(error)throw error;
      showToast(editPayment?"Payment updated":"Payment added","success");
      setShowPayment(false);setEditPayment(null);setPayForm({payment_type:"Security Deposit",amount:"",cheque_number:"",bank_name:"",due_date:"",status:"Pending",notes:""});
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const printReceipt = (p)=>{
    const w = window.open("","_blank","width=800,height=600");
    const companyName = (()=>{try{const c=JSON.parse(localStorage.getItem("propccrm_company_cache")||"null");return c?.name||"PropCRM";}catch{return "PropCRM";}})();
    const html = `<!DOCTYPE html><html><head><title>Payment Receipt</title>
    <style>
      body{font-family:'Arial',sans-serif;margin:0;padding:40px;color:#0B1F3A;}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #E2E8F0;}
      .company{font-size:22px;font-weight:700;color:#0B1F3A;}
      .receipt-title{font-size:28px;font-weight:700;color:#5B3FAA;text-align:right;}
      .receipt-num{font-size:13px;color:#718096;text-align:right;margin-top:4px;}
      .section{margin-bottom:20px;}
      .section-title{font-size:11px;font-weight:700;color:#A0AEC0;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #E2E8F0;}
      .label{color:#718096;font-size:13px;}
      .value{font-weight:600;font-size:13px;color:#0B1F3A;}
      .amount-box{background:#0B1F3A;color:#C9A84C;padding:20px;border-radius:12px;text-align:center;margin:24px 0;}
      .amount-label{font-size:12px;opacity:.7;margin-bottom:4px;}
      .amount-value{font-size:32px;font-weight:700;}
      .status-badge{display:inline-block;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;background:${p.status==="Cleared"||p.status==="Received"?"#E6F4EE":"#FFF9E6"};color:${p.status==="Cleared"||p.status==="Received"?"#1A7F5A":"#C9A84C"};}
      .footer{margin-top:40px;padding-top:20px;border-top:1px solid #E2E8F0;text-align:center;font-size:11px;color:#A0AEC0;}
      @media print{body{padding:20px;}}
    </style></head><body>
    <div class="header">
      <div>
        <div class="company">${companyName}</div>
        <div style="font-size:12px;color:#718096;margin-top:4px;">Payment Receipt</div>
      </div>
      <div>
        <div class="receipt-title">RECEIPT</div>
        <div class="receipt-num">Date: ${new Date().toLocaleDateString("en-AE",{day:"numeric",month:"long",year:"numeric"})}</div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">Tenant Details</div>
      <div class="row"><span class="label">Tenant Name</span><span class="value">${tenant?.full_name||"—"}</span></div>
      <div class="row"><span class="label">Phone</span><span class="value">${tenant?.phone||"—"}</span></div>
      <div class="row"><span class="label">Unit</span><span class="value">${unit?.unit_ref||"—"} — ${unit?.sub_type||""}</span></div>
      <div class="row"><span class="label">Property</span><span class="value">${proj?.name||"—"}</span></div>
    </div>
    <div class="amount-box">
      <div class="amount-label">Amount ${p.status==="Cleared"||p.status==="Received"?"Received":"Due"}</div>
      <div class="amount-value">AED ${Number(p.amount).toLocaleString()}</div>
    </div>
    <div class="section">
      <div class="section-title">Payment Details</div>
      <div class="row"><span class="label">Payment Type</span><span class="value">${p.payment_type}</span></div>
      <div class="row"><span class="label">Status</span><span class="value"><span class="status-badge">${p.status}</span></span></div>
      ${p.cheque_number?`<div class="row"><span class="label">Cheque Number</span><span class="value">${p.cheque_number}</span></div>`:""}
      ${p.bank_name?`<div class="row"><span class="label">Bank</span><span class="value">${p.bank_name}</span></div>`:""}
      ${p.due_date?`<div class="row"><span class="label">Cheque Date</span><span class="value">${new Date(p.due_date).toLocaleDateString("en-AE",{day:"numeric",month:"long",year:"numeric"})}</span></div>`:""}
      ${p.notes?`<div class="row"><span class="label">Notes</span><span class="value">${p.notes}</span></div>`:""}
    </div>
    <div class="section">
      <div class="section-title">Received By</div>
      <div class="row"><span class="label">Agent</span><span class="value">${agent?.full_name||currentUser.full_name}</span></div>
      <div class="row"><span class="label">Date Issued</span><span class="value">${new Date().toLocaleDateString("en-AE",{day:"numeric",month:"long",year:"numeric"})}</span></div>
    </div>
    <div class="footer">
      <div>This is a computer-generated receipt and is valid without a signature.</div>
      <div style="margin-top:4px;">${companyName} · Powered by PropCRM</div>
    </div>
    <script>window.onload=()=>window.print();</script>
    </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  const printAgencyReceipt = ()=>{
    const w = window.open("","_blank","width=800,height=600");
    const companyName = (()=>{try{const c=JSON.parse(localStorage.getItem("propccrm_company_cache")||"null");return c?.name||"PropCRM";}catch{return "PropCRM";}})();
    const agencyFees = payments.filter(p=>p.payment_type==="Agency Fee");
    const totalFee = agencyFees.reduce((s,p)=>s+(p.amount||0),0);
    const html = `<!DOCTYPE html><html><head><title>Agency Fee Receipt</title>
    <style>
      body{font-family:Arial,sans-serif;margin:0;padding:40px;color:#0B1F3A;}
      .header{display:flex;justify-content:space-between;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #C9A84C;}
      .company{font-size:22px;font-weight:700;}.receipt-title{font-size:24px;font-weight:700;color:#C9A84C;text-align:right;}
      .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #E2E8F0;}
      .label{color:#718096;font-size:13px;}.value{font-weight:600;font-size:13px;}
      .total-box{background:#0B1F3A;color:#C9A84C;padding:20px;border-radius:12px;text-align:center;margin:24px 0;}
      .watermark{text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #E2E8F0;font-size:11px;color:#A0AEC0;}
      @media print{body{padding:20px;}}
    </style></head><body>
    <div class="header">
      <div>
        <div class="company">${companyName}</div>
        <div style="font-size:12px;color:#718096;margin-top:2px;">Real Estate Agency</div>
        <div style="font-size:11px;color:#A0AEC0;margin-top:2px;">RERA Registered</div>
      </div>
      <div style="text-align:right;">
        <div class="receipt-title">AGENCY FEE RECEIPT</div>
        <div style="font-size:12px;color:#718096;margin-top:4px;">Date: ${new Date().toLocaleDateString("en-AE",{day:"numeric",month:"long",year:"numeric"})}</div>
      </div>
    </div>
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:#A0AEC0;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Tenant Details</div>
      <div class="row"><span class="label">Tenant Name</span><span class="value">${tenant?.full_name||"—"}</span></div>
      <div class="row"><span class="label">Phone</span><span class="value">${tenant?.phone||"—"}</span></div>
      <div class="row"><span class="label">Unit</span><span class="value">${unit?.unit_ref||"—"} — ${unit?.sub_type||""}</span></div>
      <div class="row"><span class="label">Annual Rent</span><span class="value">AED ${Number(opp.budget||0).toLocaleString()}</span></div>
      <div class="row"><span class="label">Lease Period</span><span class="value">1 Year</span></div>
    </div>
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:#A0AEC0;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Agency Services</div>
      <div class="row"><span class="label">Property Search & Viewing</span><span class="value">✓ Included</span></div>
      <div class="row"><span class="label">Lease Negotiation</span><span class="value">✓ Included</span></div>
      <div class="row"><span class="label">Contract Preparation</span><span class="value">✓ Included</span></div>
      <div class="row"><span class="label">Tenancy Registration</span><span class="value">✓ Included</span></div>
    </div>
    <div class="total-box">
      <div style="font-size:12px;opacity:.7;margin-bottom:4px;">Agency Fee Received</div>
      <div style="font-size:36px;font-weight:700;">AED ${totalFee>0?totalFee.toLocaleString():Number(opp.budget||0)*0.05|0}</div>
      <div style="font-size:11px;opacity:.6;margin-top:4px;">${totalFee===0?"(Estimated 5% of annual rent)":""}</div>
    </div>
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-weight:700;color:#A0AEC0;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Received By</div>
      <div class="row"><span class="label">Agent</span><span class="value">${agent?.full_name||currentUser.full_name}</span></div>
      <div class="row"><span class="label">Date</span><span class="value">${new Date().toLocaleDateString("en-AE",{day:"numeric",month:"long",year:"numeric"})}</span></div>
    </div>
    <div style="background:#FFF9E6;border:1px solid #C9A84C;border-radius:8px;padding:12px 16px;font-size:12px;color:#8A6200;margin-bottom:20px;">
      ⚠️ This receipt is issued by ${companyName} for agency services only. This amount is separate from rent payments made to the landlord.
    </div>
    <div class="watermark">
      <div>This is a computer-generated receipt · ${companyName} · Powered by PropCRM</div>
    </div>
    <script>window.onload=()=>window.print();</script>
    </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  const printAllPayments = ()=>{
    const w = window.open("","_blank","width=800,height=600");
    const companyName = (()=>{try{const c=JSON.parse(localStorage.getItem("propccrm_company_cache")||"null");return c?.name||"PropCRM";}catch{return "PropCRM";}})();
    const totalPaidAmt = payments.filter(p=>["Cleared","Received"].includes(p.status)).reduce((s,p)=>s+(p.amount||0),0);
    const totalDueAmt = payments.reduce((s,p)=>s+(p.amount||0),0);
    const rows = payments.map((p,i)=>`
      <tr style="background:${i%2===0?"#F7F9FC":"#fff"}">
        <td style="padding:8px 12px;font-size:12px;">${p.payment_type}</td>
        <td style="padding:8px 12px;font-size:12px;">${p.cheque_number||"—"}</td>
        <td style="padding:8px 12px;font-size:12px;">${p.bank_name||"—"}</td>
        <td style="padding:8px 12px;font-size:12px;">${p.due_date?new Date(p.due_date).toLocaleDateString("en-AE"):"—"}</td>
        <td style="padding:8px 12px;font-size:12px;font-weight:700;text-align:right;">AED ${Number(p.amount).toLocaleString()}</td>
        <td style="padding:8px 12px;font-size:12px;"><span style="padding:2px 10px;border-radius:10px;font-weight:700;background:${["Cleared","Received"].includes(p.status)?"#E6F4EE":"#FFF9E6"};color:${["Cleared","Received"].includes(p.status)?"#1A7F5A":"#C9A84C"};">${p.status}</span></td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html><head><title>Payment Schedule</title>
    <style>body{font-family:Arial,sans-serif;margin:0;padding:40px;color:#0B1F3A;}table{width:100%;border-collapse:collapse;}th{background:#0B1F3A;color:#fff;padding:10px 12px;font-size:11px;text-align:left;text-transform:uppercase;letter-spacing:.5px;}@media print{body{padding:20px;}}</style>
    </head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #E2E8F0;">
      <div><div style="font-size:20px;font-weight:700;">${companyName}</div><div style="font-size:13px;color:#718096;margin-top:2px;">Payment Schedule</div></div>
      <div style="text-align:right;"><div style="font-size:11px;color:#718096;">Date: ${new Date().toLocaleDateString("en-AE",{day:"numeric",month:"long",year:"numeric"})}</div></div>
    </div>
    <div style="margin-bottom:16px;">
      <div style="font-size:13px;"><strong>Tenant:</strong> ${tenant?.full_name||"—"} &nbsp;|&nbsp; <strong>Unit:</strong> ${unit?.unit_ref||"—"} &nbsp;|&nbsp; <strong>Annual Rent:</strong> AED ${Number(opp.budget||0).toLocaleString()}</div>
    </div>
    <table><thead><tr><th>Type</th><th>Cheque #</th><th>Bank</th><th>Due Date</th><th style="text-align:right;">Amount</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div style="margin-top:20px;display:flex;gap:30px;justify-content:flex-end;">
      <div style="text-align:right;"><div style="font-size:11px;color:#718096;">TOTAL DUE</div><div style="font-size:18px;font-weight:700;">AED ${totalDueAmt.toLocaleString()}</div></div>
      <div style="text-align:right;"><div style="font-size:11px;color:#718096;">COLLECTED</div><div style="font-size:18px;font-weight:700;color:#1A7F5A;">AED ${totalPaidAmt.toLocaleString()}</div></div>
      <div style="text-align:right;"><div style="font-size:11px;color:#718096;">OUTSTANDING</div><div style="font-size:18px;font-weight:700;color:#E53E3E;">AED ${(totalDueAmt-totalPaidAmt).toLocaleString()}</div></div>
    </div>
    <div style="margin-top:30px;padding-top:16px;border-top:1px solid #E2E8F0;text-align:center;font-size:11px;color:#A0AEC0;">${companyName} · Powered by PropCRM</div>
    <script>window.onload=()=>window.print();</script>
    </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  const printAgreement = ()=>{
    const w = window.open("","_blank","width=900,height=700");
    const companyName = (()=>{try{const c=JSON.parse(localStorage.getItem("propccrm_company_cache")||"null");return c?.name||"PropCRM";}catch{return "PropCRM";}})();
    const today = new Date().toLocaleDateString("en-AE",{day:"numeric",month:"long",year:"numeric"});
    const endDate = contract?.start_date ? new Date(new Date(contract.start_date).setFullYear(new Date(contract.start_date).getFullYear()+1)).toLocaleDateString("en-AE",{day:"numeric",month:"long",year:"numeric"}) : "—";
    const html = `<!DOCTYPE html><html><head><title>Rental Agreement</title>
    <style>
      body{font-family:'Georgia',serif;margin:0;padding:50px;color:#0B1F3A;line-height:1.8;}
      .header{text-align:center;margin-bottom:40px;padding-bottom:20px;border-bottom:3px double #0B1F3A;}
      .company-name{font-size:24px;font-weight:700;color:#0B1F3A;letter-spacing:1px;}
      .doc-title{font-size:20px;font-weight:700;margin:10px 0;color:#5B3FAA;}
      .doc-ref{font-size:12px;color:#718096;}
      .section{margin:24px 0;}
      .section-title{font-size:14px;font-weight:700;color:#0B1F3A;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #E2E8F0;padding-bottom:6px;margin-bottom:12px;}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
      .field{margin-bottom:12px;}
      .field-label{font-size:11px;color:#718096;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;}
      .field-value{font-size:14px;font-weight:600;color:#0B1F3A;border-bottom:1px solid #E2E8F0;padding-bottom:4px;}
      .clause{margin-bottom:16px;font-size:13px;text-align:justify;}
      .clause-num{font-weight:700;color:#5B3FAA;}
      .signature-section{margin-top:60px;display:grid;grid-template-columns:1fr 1fr;gap:40px;}
      .sig-box{border-top:1px solid #0B1F3A;padding-top:10px;}
      .sig-label{font-size:11px;color:#718096;text-transform:uppercase;letter-spacing:.5px;}
      .sig-name{font-size:13px;font-weight:700;margin-top:4px;}
      .footer{margin-top:40px;padding-top:16px;border-top:1px solid #E2E8F0;text-align:center;font-size:10px;color:#A0AEC0;}
      .stamp{display:inline-block;border:3px solid ${contract?.status==="Signed"?"#1A7F5A":"#C9A84C"};border-radius:50%;width:100px;height:100px;line-height:100px;text-align:center;font-size:14px;font-weight:700;color:${contract?.status==="Signed"?"#1A7F5A":"#C9A84C"};transform:rotate(-15deg);margin-top:10px;}
      @media print{body{padding:30px;}}
    </style></head><body>
    <div class="header">
      <div class="company-name">${companyName}</div>
      <div class="doc-title">TENANCY AGREEMENT</div>
      <div class="doc-ref">Ref: TA-${opp.id.slice(0,8).toUpperCase()} &nbsp;|&nbsp; Date: ${today} &nbsp;|&nbsp; Status: <strong>${contract?.status||"Draft"}</strong></div>
    </div>

    <div class="section">
      <div class="section-title">Parties to the Agreement</div>
      <div class="grid">
        <div>
          <div class="field"><div class="field-label">Landlord / Agent</div><div class="field-value">${companyName}</div></div>
        </div>
        <div>
          <div class="field"><div class="field-label">Tenant Name</div><div class="field-value">${tenant?.full_name||"—"}</div></div>
          <div class="field"><div class="field-label">Tenant Phone</div><div class="field-value">${tenant?.phone||"—"}</div></div>
          <div class="field"><div class="field-label">Tenant Email</div><div class="field-value">${tenant?.email||"—"}</div></div>
          <div class="field"><div class="field-label">ID / Passport</div><div class="field-value">${tenant?.id_type||""} ${tenant?.id_number||"—"}</div></div>
          <div class="field"><div class="field-label">Nationality</div><div class="field-value">${tenant?.nationality||"—"}</div></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Property Details</div>
      <div class="grid">
        <div>
          <div class="field"><div class="field-label">Unit Reference</div><div class="field-value">${unit?.unit_ref||"—"}</div></div>
          <div class="field"><div class="field-label">Property / Project</div><div class="field-value">${proj?.name||"—"}</div></div>
          <div class="field"><div class="field-label">Type</div><div class="field-value">${unit?.sub_type||unit?.unit_type||"—"}</div></div>
        </div>
        <div>
          <div class="field"><div class="field-label">Floor</div><div class="field-value">${unit?.floor_number||"—"}</div></div>
          <div class="field"><div class="field-label">View</div><div class="field-value">${unit?.view||"—"}</div></div>
          <div class="field"><div class="field-label">Size</div><div class="field-value">${unit?.size_sqft||"—"} sqft</div></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Financial Terms</div>
      <div class="grid">
        <div>
          <div class="field"><div class="field-label">Annual Rent</div><div class="field-value">AED ${Number(contract?.annual_rent||opp.budget||0).toLocaleString()}</div></div>
          <div class="field"><div class="field-label">Monthly Equivalent</div><div class="field-value">AED ${Math.round(Number(contract?.annual_rent||opp.budget||0)/12).toLocaleString()}</div></div>
        </div>
        <div>
          <div class="field"><div class="field-label">Lease Start Date</div><div class="field-value">${contract?.start_date?new Date(contract.start_date).toLocaleDateString("en-AE",{day:"numeric",month:"long",year:"numeric"}):"—"}</div></div>
          <div class="field"><div class="field-label">Lease End Date</div><div class="field-value">${endDate}</div></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Terms & Conditions</div>
      ${contract?.terms?`<div class="clause">${contract.terms}</div>`:""}
      <div class="clause"><span class="clause-num">1.</span> The tenant agrees to pay the rent in full as per the agreed payment schedule.</div>
      <div class="clause"><span class="clause-num">2.</span> The security deposit shall be refunded within 30 days of vacating the property, subject to deductions for any damages.</div>
      <div class="clause"><span class="clause-num">3.</span> The tenant shall not sublet the property without prior written consent from the landlord.</div>
      <div class="clause"><span class="clause-num">4.</span> The tenant shall maintain the property in good condition and report any maintenance issues promptly.</div>
      <div class="clause"><span class="clause-num">5.</span> This agreement is governed by the laws of the UAE and the relevant emirate regulations.</div>
      <div class="clause"><span class="clause-num">6.</span> Post-dated cheques once handed over shall not be returned and will be presented on their respective dates.</div>
    </div>

    <div class="signature-section">
      <div>
        <div class="sig-box">
          <div class="sig-label">Landlord / Agent Signature</div>
          <div class="sig-name">${companyName}</div>
          <div style="margin-top:8px;"><div class="stamp">${contract?.status==="Signed"?"SIGNED":"DRAFT"}</div></div>
        </div>
      </div>
      <div>
        <div class="sig-box">
          <div class="sig-label">Tenant Signature</div>
          <div class="sig-name">${tenant?.full_name||"—"}</div>
          ${contract?.status==="Signed"?`<div style="margin-top:8px;font-size:12px;color:#1A7F5A;">✅ Signed on ${contract.signed_at?new Date(contract.signed_at).toLocaleDateString("en-AE",{day:"numeric",month:"long",year:"numeric"}):today}</div>`:"<div style='margin-top:40px;border-top:1px solid #0B1F3A;font-size:11px;color:#718096;padding-top:4px;'>Signature & Date</div>"}
        </div>
      </div>
    </div>

    <div class="footer">
      <div>This document is generated by ${companyName} using PropCRM.</div>
      <div style="margin-top:4px;">For queries contact: ${companyName}</div>
    </div>
    <script>window.onload=()=>window.print();</script>
    </body></html>`;
    w.document.write(html);
    w.document.close();
  };

  const totalPaid = payments.filter(p=>["Cleared","Received"].includes(p.status)).reduce((s,p)=>s+(p.amount||0),0);
  const totalDue  = payments.reduce((s,p)=>s+(p.amount||0),0);

  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <button onClick={onBack} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,cursor:"pointer",flexShrink:0}}>← Back</button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0F2540"}}>{opp.title||"Lease Enquiry"}</span>
            <span style={{padding:"3px 10px",borderRadius:20,background:sm.bg,color:sm.c,fontSize:11,fontWeight:700}}>{opp.stage}</span>
          </div>
          <div style={{fontSize:12,color:"#718096",marginTop:2}}>{tenant?.full_name||""} · {tenant?.phone||""}{unit?` · ${unit.unit_ref}`:""}</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          {canEdit&&<button onClick={()=>setShowLog(true)} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",color:"#0F2540",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Task</button>}
        </div>
      </div>

      {/* Summary strip */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        {[
          ["💰 Budget",opp.budget?`AED ${Number(opp.budget).toLocaleString()}/yr`:"—","#0F2540","#C9A84C"],
          ["🏠 Unit",unit?`${unit.unit_ref} — ${unit.sub_type}`:"Not linked","#F7F9FC","#4A5568"],
          ["👤 Agent",agent?.full_name||"Unassigned","#F7F9FC","#4A5568"],
          ["💳 Payments",totalDue>0?`${(totalPaid/totalDue*100)|0}% collected`:"No payments","#F7F9FC","#4A5568"],
        ].map(([l,v,bg,col])=>(
          <div key={l} style={{background:bg,borderRadius:8,padding:"8px 14px",flex:1,minWidth:120}}>
            <div style={{fontSize:9,color:bg==="#0F2540"?"rgba(255,255,255,.5)":"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:3}}>{l}</div>
            <div style={{fontSize:13,fontWeight:700,color:col,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:14,borderBottom:"1px solid #E2E8F0"}}>
        {[
          {id:"details",  label:"Details"},
          {id:"tasks",    label:`Tasks${activities.length>0?` (${activities.length})`:""}`},
          {id:"payments", label:`Payments${payments.length>0?` (${payments.length})`:""}`, locked:!isReserved, lockMsg:"Move to Reserved to unlock payments"},
          {id:"agreement",label:`Agreement${contract?" ✓":""}`, locked:!canAccessAgreement, lockMsg:hasPayments?"Move to Reserved first":"Add payments before creating agreement"},
        ].map(({id,label,locked,lockMsg})=>(
          <button key={id} onClick={()=>{if(locked){showToast(lockMsg||"Locked","error");return;}setActiveTab(id);}}
            style={{padding:"8px 16px",borderRadius:"8px 8px 0 0",border:"none",
              borderBottom:activeTab===id?"2.5px solid #5B3FAA":"2.5px solid transparent",
              background:"transparent",fontSize:13,fontWeight:activeTab===id?600:400,
              color:locked?"#A0AEC0":activeTab===id?"#5B3FAA":"#4A5568",cursor:locked?"not-allowed":"pointer"}}>
            {locked&&"🔒 "}{label}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto"}}>

        {/* DETAILS TAB */}
        {activeTab==="details"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {/* Workflow */}
            <div style={{background:"linear-gradient(135deg,#1A0B3A,#2D1558)",borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:"1px",marginBottom:10}}>Lease Workflow</div>
              <div style={{display:"flex",alignItems:"center",overflowX:"auto",gap:0}}>
                {/* Ownership Notice */}
                {!isOwner&&canEdit&&(
                  <div style={{background:canAction?"#E6F4EE":"#FFFBEB",border:`1px solid ${canAction?"#A8D5BE":"#FDE68A"}`,borderRadius:10,padding:"10px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:12}}>
                    <div style={{flex:1}}>
                      <span style={{fontSize:12,fontWeight:600,color:canAction?"#1A7F5A":"#92400E"}}>
                        {canAction?"✓ You have taken ownership":"⚠ Assigned to "}<strong>{users?.find(u=>u.id===opp.assigned_to)?.full_name||"another agent"}</strong>
                      </span>
                      {!canAction&&<div style={{fontSize:11,color:"#92400E",marginTop:2}}>Stage actions restricted to assigned agent.</div>}
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      {!canAction&&canReassign&&(
                        <button onClick={async()=>{
                          if(!window.confirm(`Take ownership of this lease deal?`)) return;
                          const{error}=await supabase.from("lease_opportunities").update({assigned_to:currentUser.id}).eq("id",opp.id);
                          if(error){showToast(error.message,"error");return;}
                          setTookOwnership(true);
                          onUpdated({...opp,assigned_to:currentUser.id});
                          await supabase.from("activities").insert({lead_id:opp.lead_id||null,company_id:currentUser.company_id||null,type:"Note",note:`Ownership transferred to ${currentUser.full_name}`,status:"completed",created_by:currentUser.id,lease_opportunity_id:opp.id});
                          showToast("You have taken ownership","success");
                        }} style={{padding:"6px 14px",borderRadius:7,border:"none",background:"#5B3FAA",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>
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
                {LEASE_STAGES.filter(s=>s!=="Lost").map((s,i,arr)=>{
                  const curIdx=LEASE_STAGES.indexOf(opp.stage);
                  const sIdx=LEASE_STAGES.indexOf(s);
                  const done=sIdx<curIdx; const active=sIdx===curIdx;
                  return(
                    <div key={s} style={{display:"flex",alignItems:"center",flexShrink:0}}>
                      <button onClick={()=>canEdit&&moveStage(s)} disabled={!canEdit}
                        style={{padding:"6px 12px",borderRadius:20,border:"none",fontSize:11,fontWeight:active?700:400,cursor:canEdit?"pointer":"default",
                          background:active?"#9B7FD4":done?"rgba(155,127,212,.3)":"rgba(255,255,255,.1)",
                          color:active?"#fff":done?"rgba(255,255,255,.7)":"rgba(255,255,255,.4)"}}>
                        {done?"✓ ":""}{s}
                      </button>
                      {i<arr.length-1&&<div style={{width:20,height:1,background:"rgba(255,255,255,.2)",flexShrink:0}}/>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Property & Pricing */}
            {unit&&(
              <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>🏠 Property</div>
                <div style={{fontWeight:700,color:"#0F2540",fontSize:14,marginBottom:4}}>{unit.unit_ref} — {unit.sub_type||unit.unit_type}</div>
                <div style={{fontSize:12,color:"#718096",marginBottom:10}}>{proj?.name||""} · Floor {unit.floor_number} · {unit.view} · {unit.size_sqft} sqft</div>
                {lp&&(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8}}>
                    {[["Annual Rent",`AED ${Number(lp.annual_rent||0).toLocaleString()}`],
                      ["Monthly",`AED ${Number((lp.annual_rent||0)/12).toLocaleString()}`],
                      ["Security Dep.",lp.security_deposit_months?lp.security_deposit_months+" months rent":"—"],
                      ["Municipality",lp.municipality_tax_pct?lp.municipality_tax_pct+"%":"—"],
                    ].map(([k,v])=>(
                      <div key={k} style={{background:"#F7F9FC",borderRadius:8,padding:"8px 10px"}}>
                        <div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px",marginBottom:2}}>{k}</div>
                        <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tenant Info */}
            {tenant&&(
              <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"14px 16px"}}>
                <div style={{fontSize:11,fontWeight:700,color:"#0F2540",textTransform:"uppercase",letterSpacing:".5px",marginBottom:10}}>👤 Tenant</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[["Name",tenant.full_name],["Phone",tenant.phone],["Email",tenant.email],["Nationality",tenant.nationality],["ID Type",tenant.id_type],["ID Number",tenant.id_number]].map(([k,v])=>v&&(
                    <div key={k}>
                      <div style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px"}}>{k}</div>
                      <div style={{fontSize:13,fontWeight:500,color:"#0F2540"}}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TASKS TAB */}
        {activeTab==="tasks"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={()=>setShowLog(true)} style={{alignSelf:"flex-end",padding:"7px 16px",borderRadius:8,border:"none",background:"#5B3FAA",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Log Task</button>
            {activities.length===0&&<div style={{textAlign:"center",padding:"2.5rem",color:"#A0AEC0"}}>No tasks yet — log a call, meeting, site visit or note</div>}
            {activities.length>0&&<ActivitiesList activities={activities} setActivities={setActivities} opp={opp} canEdit={canEdit} showToast={showToast} isLeasing={true}/>}
          </div>
        )}

        {/* PAYMENTS TAB */}
        {activeTab==="payments"&&(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",gap:8,alignSelf:"flex-end",flexWrap:"wrap"}}>
              {payments.length>0&&<button onClick={printAllPayments} style={{padding:"7px 16px",borderRadius:8,border:"1.5px solid #718096",background:"transparent",color:"#718096",fontSize:12,fontWeight:600,cursor:"pointer"}}>🖨 Print Schedule</button>}
              {payments.some(p=>p.payment_type==="Agency Fee")&&<button onClick={printAgencyReceipt} style={{padding:"7px 16px",borderRadius:8,border:"1.5px solid #C9A84C",background:"rgba(201,168,76,.08)",color:"#8A6200",fontSize:12,fontWeight:600,cursor:"pointer"}}>🏷 Agency Receipt</button>}
              {canEdit&&<button onClick={()=>setShowPDC(true)} style={{padding:"7px 16px",borderRadius:8,border:"1.5px solid #5B3FAA",background:"rgba(91,63,170,.08)",color:"#5B3FAA",fontSize:12,fontWeight:600,cursor:"pointer"}}>🏦 Generate PDC</button>}
              {canEdit&&<button onClick={()=>{setEditPayment(null);setShowPayment(true);}} style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>+ Add Payment</button>}
            </div>
            {/* Summary */}
            {payments.length>0&&(
              <div style={{background:"#fff",borderRadius:12,padding:"14px 16px",display:"flex",gap:16,flexWrap:"wrap"}}>
                {[["Total Due",`AED ${totalDue.toLocaleString()}`],["Collected",`AED ${totalPaid.toLocaleString()}`],["Outstanding",`AED ${(totalDue-totalPaid).toLocaleString()}`]].map(([k,v])=>(
                  <div key={k}>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.5)",textTransform:"uppercase",letterSpacing:".5px"}}>{k}</div>
                    <div style={{fontSize:15,fontWeight:700,color:"#C9A84C"}}>{v}</div>
                  </div>
                ))}
              </div>
            )}
            {payments.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}><div style={{fontSize:40,marginBottom:10}}>🔒</div><div style={{fontSize:14,fontWeight:600,color:"#0F2540",marginBottom:6}}>No payments yet</div><div style={{fontSize:12}}>Add security deposit, advance rent and PDC cheques</div></div>}
            {payments.map(p=>(
              <div key={p.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,padding:"12px 14px",display:"flex",gap:10,alignItems:"center"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{p.payment_type}</span>
                    <span style={{fontSize:12,fontWeight:700,color:p.status==="Cleared"?"#1A7F5A":p.status==="Pending"?"#C9A84C":"#E53E3E"}}>
                      {p.status==="Cleared"?"✅":"⏳"} {p.status}
                    </span>
                  </div>
                  <div style={{fontSize:14,fontWeight:700,color:"#0F2540",marginBottom:4}}>AED {Number(p.amount).toLocaleString()}</div>
                  <div style={{fontSize:11,color:"#718096",display:"flex",gap:12,flexWrap:"wrap"}}>
                    {p.cheque_number&&<span>Cheque #{p.cheque_number}</span>}
                    {p.bank_name&&<span>🏦 {p.bank_name}</span>}
                    {p.due_date&&<span>📅 Due: {new Date(p.due_date).toLocaleDateString("en-AE")}</span>}
                  </div>
                  {p.notes&&<div style={{fontSize:11,color:"#A0AEC0",marginTop:4}}>{p.notes}</div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                    <button onClick={()=>printReceipt(p)} style={{padding:"4px 10px",borderRadius:6,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,cursor:"pointer"}}>🖨 Receipt</button>
                    {canEdit&&<button onClick={()=>{setEditPayment(p);setPayForm({...p});setShowPayment(true);}} style={{padding:"4px 10px",borderRadius:6,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:11,cursor:"pointer"}}>Edit</button>}
                    {canEdit&&p.status==="Pending"&&<button onClick={async()=>{await supabase.from("lease_payments").update({status:"Cleared"}).eq("id",p.id);setPayments(px=>px.map(x=>x.id===p.id?{...x,status:"Cleared"}:x));showToast("Marked cleared","success");}} style={{padding:"4px 10px",borderRadius:6,border:"1.5px solid #A8D5BE",background:"#E6F4EE",color:"#1A7F5A",fontSize:11,cursor:"pointer"}}>✅ Clear</button>}
                  </div>
              </div>
            ))}
          </div>
        )}

        {/* AGREEMENT TAB */}
        {activeTab==="agreement"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {!contract?(
              <div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}>
                <div style={{fontSize:40,marginBottom:10}}>📄</div>
                <div style={{fontSize:14,fontWeight:600,color:"#0F2540",marginBottom:6}}>No rental agreement yet</div>
                {canEdit&&canAccessAgreement&&(
                  <button onClick={async()=>{
                    const terms = prompt("Lease terms / notes (optional):");
                    const{data,error}=await supabase.from("lease_contracts").insert({
                      opportunity_id:null, lease_opportunity_id:opp.id, tenant_id:opp.tenant_id||null,
                      unit_id:opp.unit_id||null, annual_rent:opp.budget||null,
                      start_date:opp.move_in_date||null, terms:terms||"",
                      status:"Draft", company_id:currentUser.company_id||null,
                      created_by:currentUser.id,
                    }).select().single();
                    if(!error){setContract(data);showToast("Agreement created","success");}
                    else showToast(error.message,"error");
                  }} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#5B3FAA",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                    📄 Create Rental Agreement
                  </button>
                )}
              </div>
            ):(
              <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#0F2540"}}>📄 Rental Agreement</div>
                  <button onClick={printAgreement} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #718096",background:"transparent",color:"#718096",fontSize:12,fontWeight:600,cursor:"pointer"}}>🖨 Print Agreement</button>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{padding:"4px 12px",borderRadius:20,background:contract.status==="Signed"?"#E6F4EE":"#FFF9E6",color:contract.status==="Signed"?"#1A7F5A":"#C9A84C",fontSize:11,fontWeight:700}}>{contract.status}</span>
                    <button onClick={()=>{
                      const w=window.open("","_blank","width=900,height=700");
                      const companyName=localStorage.getItem("propccrm_company_name")||"PropCRM";
                      const html=`<!DOCTYPE html><html><head><title>Rental Agreement</title>
                      <style>body{font-family:Arial,sans-serif;margin:0;padding:50px;color:#0B1F3A;line-height:1.8;}
                      h1{font-size:24px;text-align:center;margin-bottom:4px;}
                      .subtitle{text-align:center;color:#718096;font-size:13px;margin-bottom:30px;}
                      .section{margin-bottom:24px;}.section-title{font-size:14px;font-weight:700;border-bottom:2px solid #E2E8F0;padding-bottom:4px;margin-bottom:12px;}
                      .row{display:flex;gap:20px;margin-bottom:8px;}.label{color:#718096;min-width:160px;font-size:13px;}.value{font-weight:600;font-size:13px;}
                      .clause{font-size:13px;margin-bottom:10px;text-align:justify;}
                      .sign-box{display:flex;justify-content:space-between;margin-top:60px;}
                      .sign-line{border-top:1px solid #0B1F3A;padding-top:8px;width:200px;text-align:center;font-size:12px;}
                      @media print{body{padding:30px;}}</style></head><body>
                      <h1>TENANCY AGREEMENT</h1>
                      <div class="subtitle">${companyName}</div>
                      <div class="section">
                        <div class="section-title">1. PARTIES</div>
                        <div class="row"><span class="label">Tenant Name</span><span class="value">${tenant?.full_name||"—"}</span></div>
                        <div class="row"><span class="label">Tenant Phone</span><span class="value">${tenant?.phone||"—"}</span></div>
                        <div class="row"><span class="label">Tenant Email</span><span class="value">${tenant?.email||"—"}</span></div>
                        <div class="row"><span class="label">ID Number</span><span class="value">${tenant?.id_number||"—"}</span></div>
                      </div>
                      <div class="section">
                        <div class="section-title">2. PROPERTY DETAILS</div>
                        <div class="row"><span class="label">Unit Reference</span><span class="value">${unit?.unit_ref||"—"}</span></div>
                        <div class="row"><span class="label">Property</span><span class="value">${proj?.name||"—"}</span></div>
                        <div class="row"><span class="label">Type</span><span class="value">${unit?.sub_type||"—"}</span></div>
                        <div class="row"><span class="label">Floor</span><span class="value">${unit?.floor_number||"—"}</span></div>
                        <div class="row"><span class="label">Size</span><span class="value">${unit?.size_sqft||"—"} sqft</span></div>
                      </div>
                      <div class="section">
                        <div class="section-title">3. LEASE TERMS</div>
                        <div class="row"><span class="label">Annual Rent</span><span class="value">AED ${Number(contract.annual_rent||opp.budget||0).toLocaleString()}</span></div>
                        <div class="row"><span class="label">Start Date</span><span class="value">${contract.start_date?new Date(contract.start_date).toLocaleDateString("en-AE",{day:"numeric",month:"long",year:"numeric"}):"—"}</span></div>
                        <div class="row"><span class="label">End Date</span><span class="value">${contract.start_date?new Date(new Date(contract.start_date).setFullYear(new Date(contract.start_date).getFullYear()+1)).toLocaleDateString("en-AE",{day:"numeric",month:"long",year:"numeric"}):"—"}</span></div>
                        <div class="row"><span class="label">Payment Terms</span><span class="value">${payments.filter(p=>p.payment_type==="PDC Cheque").length} cheque(s)</span></div>
                      </div>
                      <div class="section">
                        <div class="section-title">4. SPECIAL CONDITIONS</div>
                        <div class="clause">${contract.terms||"No special conditions."}</div>
                      </div>
                      <div class="section">
                        <div class="section-title">5. SIGNATURES</div>
                        <div class="sign-box">
                          <div class="sign-line">Tenant Signature<br/>${tenant?.full_name||""}</div>
                          <div class="sign-line">Landlord / Agent<br/>${agent?.full_name||""}</div>
                        </div>
                      </div>
                      <div style="text-align:center;margin-top:40px;font-size:11px;color:#A0AEC0;">Generated by ${companyName} · PropCRM · ${new Date().toLocaleDateString("en-AE")}</div>
                      <script>window.onload=()=>window.print();</script>
                      </body></html>`;
                      w.document.write(html);w.document.close();
                    }} style={{padding:"6px 14px",borderRadius:8,border:"1.5px solid #1E3A5F",background:"transparent",color:"#0F2540",fontSize:12,fontWeight:600,cursor:"pointer"}}>🖨 Print Agreement</button>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                  {[["Tenant",tenant?.full_name||"—"],["Unit",unit?.unit_ref||"—"],["Annual Rent",contract.annual_rent?`AED ${Number(contract.annual_rent).toLocaleString()}`:"—"],["Start Date",contract.start_date?new Date(contract.start_date).toLocaleDateString("en-AE"):"—"]].map(([k,v])=>(
                    <div key={k}><div style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px"}}>{k}</div><div style={{fontSize:13,fontWeight:600,color:"#0F2540"}}>{v}</div></div>
                  ))}
                </div>
                {contract.terms&&<div style={{fontSize:12,color:"#4A5568",background:"#F7F9FC",borderRadius:8,padding:"10px 12px",marginBottom:12}}>{contract.terms}</div>}
                {canEdit&&contract.status==="Draft"&&(
                  <button onClick={async()=>{
                    await supabase.from("lease_contracts").update({status:"Signed",signed_at:new Date().toISOString()}).eq("id",contract.id);
                    setContract(c=>({...c,status:"Signed"}));
                    // Auto-move to Lease Signed
                    await supabase.from("lease_opportunities").update({stage:"Lease Signed",stage_updated_at:new Date().toISOString()}).eq("id",opp.id);
                    if(opp.unit_id) await supabase.from("project_units").update({status:"Leased"}).eq("id",opp.unit_id);
                    if(onUpdated)onUpdated({...opp,stage:"Lease Signed"});
                    showToast("✅ Agreement signed! Lease is now active. Unit marked as Leased.","success");
                  }} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#1A7F5A",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                    ✍️ Sign Agreement & Complete Lease
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Log Task Modal */}
      {showLog&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:500,maxWidth:"100%",maxHeight:"92vh",overflow:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E2E8F0",background:"linear-gradient(135deg,#1A0B3A,#2D1558)"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#fff"}}>Log Task</span>
              <button onClick={()=>setShowLog(false)} style={{background:"none",border:"none",fontSize:20,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.25rem 1.5rem"}}>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".5px"}}>Activity Type</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {[["Call","📞"],["Email","✉️"],["Meeting","🤝"],["Visit","🏠"],["WhatsApp","💬"],["Note","📝"]].map(([t,icon])=>(
                    <button key={t} onClick={()=>setLogForm(f=>({...f,type:t}))}
                      style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${logForm.type===t?"#5B3FAA":"#E2E8F0"}`,background:logForm.type===t?"#5B3FAA":"#fff",color:logForm.type===t?"#fff":"#4A5568",fontSize:12,cursor:"pointer",fontWeight:logForm.type===t?600:400,display:"flex",alignItems:"center",gap:4}}>
                      <span>{icon}</span>{t}
                    </button>
                  ))}
                </div>
              </div>
              {["Call","Meeting","Visit"].includes(logForm.type)&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>📅 Date & Time</label>
                    <input type="datetime-local" value={logForm.scheduled_at} onChange={e=>setLogForm(f=>({...f,scheduled_at:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>⏱ Duration</label>
                    <select value={logForm.duration_mins} onChange={e=>setLogForm(f=>({...f,duration_mins:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}>
                      <option value="">Select…</option>
                      {["15","30","45","60","90","120"].map(m=><option key={m} value={m}>{m} mins</option>)}
                    </select>
                  </div>
                </div>
              )}
              <div style={{marginBottom:12}}>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>💬 Discussion / Key Details</label>
                <textarea value={logForm.note} onChange={e=>setLogForm(f=>({...f,note:e.target.value}))} rows={3} placeholder="What was discussed?" style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div style={{marginBottom:12}}>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>✅ Next Steps</label>
                <textarea value={logForm.next_steps} onChange={e=>setLogForm(f=>({...f,next_steps:e.target.value}))} rows={2} placeholder="Follow-up action, who's responsible, by when?" style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                <button onClick={()=>setShowLog(false)} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveLog} disabled={saving} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#5B3FAA",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Save Task"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showPayment&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:480,maxWidth:"100%",maxHeight:"92vh",overflow:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#fff"}}>💳 {editPayment?"Edit":"Add"} Payment</span>
              <button onClick={()=>{setShowPayment(false);setEditPayment(null);}} style={{background:"none",border:"none",fontSize:20,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.25rem 1.5rem"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Payment Type *</label>
                  <select value={payForm.payment_type} onChange={e=>setPayForm(f=>({...f,payment_type:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}>
                    {["Security Deposit","Agency Fee","Municipality Fee","DEWA Deposit","PDC Cheque","Cash","Bank Transfer","Other"].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Amount (AED) *</label>
                  <input type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))} placeholder="e.g. 50000" style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Status</label>
                  <select value={payForm.status} onChange={e=>setPayForm(f=>({...f,status:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}>
                    {["Pending","Received","Cleared","Bounced","Cancelled"].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Cheque / Ref Number</label>
                  <input value={payForm.cheque_number||""} onChange={e=>setPayForm(f=>({...f,cheque_number:e.target.value}))} placeholder="Optional" style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Bank Name</label>
                  <input value={payForm.bank_name||""} onChange={e=>setPayForm(f=>({...f,bank_name:e.target.value}))} placeholder="Optional" style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Due / Cheque Date</label>
                  <input type="date" value={payForm.due_date||""} onChange={e=>setPayForm(f=>({...f,due_date:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Notes</label>
                  <textarea value={payForm.notes||""} onChange={e=>setPayForm(f=>({...f,notes:e.target.value}))} rows={2} style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
                </div>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16}}>
                <button onClick={()=>{setShowPayment(false);setEditPayment(null);}} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                <button onClick={savePayment} disabled={saving} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Save Payment"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDC Cheques Generator Modal */}
      {showPDC&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:520,maxWidth:"100%",maxHeight:"92vh",overflow:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E2E8F0",background:"linear-gradient(135deg,#1A0B3A,#2D1558)"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#fff"}}>🏦 Generate Rent Cheques (PDC)</span>
              <button onClick={()=>setShowPDC(false)} style={{background:"none",border:"none",fontSize:20,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{padding:"1.25rem 1.5rem"}}>
              <div style={{background:"rgba(91,63,170,.06)",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#5B3FAA"}}>
                📋 Post-dated cheques (PDC) are the standard rent payment method in UAE. Generate all rent cheques at once based on annual rent and number of cheques.
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Annual Rent (AED) *</label>
                  <input type="number" value={pdcForm.annual_rent} onChange={e=>setPdcForm(f=>({...f,annual_rent:e.target.value}))}
                    placeholder={opp.budget?`Suggested: AED ${Number(opp.budget).toLocaleString()}`:"Enter annual rent"}
                    style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  {opp.budget&&!pdcForm.annual_rent&&<div style={{fontSize:11,color:"#9B7FD4",marginTop:4,cursor:"pointer"}} onClick={()=>setPdcForm(f=>({...f,annual_rent:String(opp.budget)}))}>→ Use budget: AED {Number(opp.budget).toLocaleString()}</div>}
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Number of Cheques *</label>
                  <select value={pdcForm.num_cheques} onChange={e=>setPdcForm(f=>({...f,num_cheques:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}>
                    {[["1","1 cheque — Full year upfront"],["2","2 cheques — Every 6 months"],["3","3 cheques — Every 4 months"],["4","4 cheques — Quarterly"],["6","6 cheques — Every 2 months"],["12","12 cheques — Monthly"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Lease Start Date *</label>
                  <input type="date" value={pdcForm.start_date} onChange={e=>setPdcForm(f=>({...f,start_date:e.target.value}))} style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:4,textTransform:"uppercase",letterSpacing:".5px"}}>Bank Name</label>
                  <input value={pdcForm.bank_name} onChange={e=>setPdcForm(f=>({...f,bank_name:e.target.value}))} placeholder="e.g. Emirates NBD" style={{width:"100%",padding:"8px 10px",border:"1.5px solid #E2E8F0",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>
              </div>
              {/* Preview */}
              {pdcForm.annual_rent&&pdcForm.start_date&&(()=>{
                const rent=Number(pdcForm.annual_rent);
                const n=Number(pdcForm.num_cheques);
                const amt=Math.round(rent/n);
                const start=new Date(pdcForm.start_date);
                const monthsGap=12/n;
                const cheques=Array.from({length:n},(_,i)=>{
                  const d=new Date(start);
                  d.setMonth(d.getMonth()+Math.round(i*monthsGap));
                  return{num:i+1,amount:i===n-1?rent-(amt*(n-1)):amt,date:d.toISOString().split("T")[0]};
                });
                return(
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#4A5568",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>📋 Preview — {n} cheque{n>1?"s":""} of AED {amt.toLocaleString()} each</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {cheques.map(c=>(
                        <div key={c.num} style={{background:"#F7F9FC",borderRadius:8,padding:"8px 12px",marginBottom:4}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                            <span style={{fontSize:12,fontWeight:600,color:"#4A5568"}}>Cheque {c.num}/{n}</span>
                            <span style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>AED {c.amount.toLocaleString()}</span>
                            <span style={{fontSize:12,color:"#718096"}}>📅 {new Date(c.date).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}</span>
                          </div>
                          <input value={pdcChequeNums[c.num]||""} onChange={e=>setPdcChequeNums(p=>({...p,[c.num]:e.target.value}))}
                            placeholder={"Cheque number (optional)"}
                            style={{width:"100%",padding:"6px 10px",border:"1.5px solid #E2E8F0",borderRadius:6,fontSize:12,outline:"none",boxSizing:"border-box",background:"#fff"}}/>
                        </div>
                      ))}
                    </div>
                    <div style={{marginTop:16,display:"flex",gap:10,justifyContent:"flex-end"}}>
                      <button onClick={()=>setShowPDC(false)} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                      <button disabled={saving} onClick={async()=>{
                        setSaving(true);
                        const rows=cheques.map(c=>({
                          payment_type:"PDC Cheque",
                          amount:c.amount,
                          due_date:c.date,
                          cheque_number:pdcChequeNums[c.num]||null,
                          bank_name:pdcForm.bank_name||null,
                          status:"Pending",
                          notes:`Cheque ${c.num} of ${n}`,
                          lease_opportunity_id:opp.id,
                          opportunity_id:null,
                          tenant_id:opp.tenant_id||null,
                          company_id:currentUser.company_id||null,
                          created_by:currentUser.id,
                        }));
                        // Check for duplicate cheque numbers
                        const enteredNums = Object.values(pdcChequeNums).filter(Boolean);
                        if(enteredNums.length!==new Set(enteredNums).size){
                          showToast("Duplicate cheque numbers found — please check","error");
                          setSaving(false);return;
                        }
                        // Check against existing payments
                        if(enteredNums.length>0){
                          const existing = payments.filter(p=>p.cheque_number&&enteredNums.includes(p.cheque_number));
                          if(existing.length>0){showToast("Cheque number "+existing[0].cheque_number+" already exists","error");setSaving(false);return;}
                        }
                        const{data,error}=await supabase.from("lease_payments").insert(rows).select();
                        if(!error){setPayments(p=>[...p,...data]);showToast(`✅ ${n} PDC cheques generated`,"success");setShowPDC(false);setPdcForm({num_cheques:"1",annual_rent:"",start_date:"",bank_name:"",notes:"",start_cheque_num:""});setPdcChequeNums({});}
                        else showToast(error.message,"error");
                        setSaving(false);
                      }} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#5B3FAA",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Generate All Cheques →"}</button>
                    </div>
                  </div>
                );
              })()}
              {(!pdcForm.annual_rent||!pdcForm.start_date)&&(
                <div style={{textAlign:"center",padding:"1rem",color:"#A0AEC0",fontSize:13}}>Enter annual rent and start date to preview cheques</div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}



export default LeaseOpportunityDetail;

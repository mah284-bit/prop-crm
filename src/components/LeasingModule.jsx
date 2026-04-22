import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = "https://ysceukgpimzfqixtnbnp.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzY2V1a2dwaW16ZnFpeHRuYm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDI5OTQsImV4cCI6MjA4OTkxODk5NH0.WZSyGeOEbiRo1wt13syheTOyiAToMWXInxIaBgaqq8k";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

function LeasingModule({currentUser,showToast,leasingData=null,setLeasingData=null,initialFilter=null}) {
  const [tab,setTab]               = useState(initialFilter?.type==="tab"&&initialFilter?.value ? initialFilter.value : "dashboard");
  const [tenants,setTenants]       = useState([]);
  const [leases,setLeases]         = useState([]);
  const [payments,setPayments]     = useState([]);
  const [maintenance,setMaintenance]=useState([]);
  const [units,setUnits]           = useState([]);
  const [loading,setLoading]       = useState(true);
  const canEdit = can(currentUser.role,"write");
  const canDel  = can(currentUser.role,"delete");
  const [showAddTenant,setShowAddTenant]=useState(false);
  const [showAddLease,setShowAddLease]  =useState(false);
  const [showAddPmt,setShowAddPmt]      =useState(false);
  const [showAddMaint,setShowAddMaint]  =useState(false);
  const [showLeaseUpload,setShowLeaseUpload]=useState(false);
  const [saving,setSaving]=useState(false);

  const tBlank={full_name:"",nationality:"",id_type:"Emirates ID",id_number:"",id_expiry:"",passport_number:"",passport_expiry:"",email:"",phone:"",whatsapp:"",tenant_type:"Individual",company_name:"",trade_license:"",notes:""};
  const lBlank={unit_id:"",tenant_id:"",start_date:"",end_date:"",annual_rent:"",security_deposit:"",agency_fee:"",payment_frequency:"Annual",number_of_cheques:"1",ejari_number:"",contract_number:"",status:"Active",notes:""};
  const pBlank={lease_id:"",amount:"",due_date:"",payment_method:"Cheque",cheque_number:"",status:"Pending",payment_type:"Rent",notes:""};
  const mBlank={unit_id:"",title:"",category:"General",priority:"Normal",description:"",assigned_to:"",cost_estimate:"",status:"Open",charged_to:"Landlord",notes:""};
  const [tForm,setTForm]=useState(tBlank);
  const [lForm,setLForm]=useState(lBlank);
  const [pForm,setPForm]=useState(pBlank);
  const [mForm,setMForm]=useState(mBlank);

  const load=useCallback(async(force=false)=>{
    // Use pre-loaded central data if available
    if(!force && leasingData?.loaded){
      setTenants(leasingData.tenants);
      setLeases(leasingData.leases);
      setPayments(leasingData.payments);
      setMaintenance(leasingData.maintenance);
      const u=await supabase.from("project_units").select("id,unit_ref,sub_type");
      setUnits(u.data||[]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [t,l,p,m,u]=await Promise.all([
      safe(supabase.from("tenants").select("*").order("full_name")),
      safe(supabase.from("leases").select("*").order("end_date")),
      safe(supabase.from("rent_payments").select("*").order("due_date")),
      safe(supabase.from("maintenance").select("*").order("created_at",{ascending:false})),
      safe(supabase.from("project_units").select("id,unit_ref,sub_type")),
    ]);
    const updated={tenants:t.data||[],leases:l.data||[],payments:p.data||[],maintenance:m.data||[],loaded:true};
    setTenants(updated.tenants);setLeases(updated.leases);setPayments(updated.payments);setMaintenance(updated.maintenance);setUnits(u.data||[]);
    if(setLeasingData)setLeasingData(updated);
    setLoading(false);
  },[leasingData]);
  useEffect(()=>{load();},[load]);

  const today=new Date();
  const activeLeases=leases.filter(l=>l.status==="Active");
  const expiring30=activeLeases.filter(l=>{const d=new Date(l.end_date);return d>=today&&(d-today)/(1000*60*60*24)<=30;});
  const overduePmts=payments.filter(p=>p.status==="Pending"&&new Date(p.due_date)<today);
  const openMaint=maintenance.filter(m=>m.status==="Open"||m.status==="In Progress");
  const totalRent=activeLeases.reduce((s,l)=>s+(l.annual_rent||0),0);

  const tenantName=id=>tenants.find(t=>t.id===id)?.full_name||"—";
  const unitLabel=id=>units.find(u=>u.id===id)?.unit_ref||"—";

  const saveTenant=async()=>{
    if(!tForm.full_name.trim()){showToast("Name required","error");return;}
    if(tForm.email&&validateEmail(tForm.email)){showToast(validateEmail(tForm.email),"error");return;}
    if(tForm.phone&&validatePhone(tForm.phone,tForm.nationality)){showToast(validatePhone(tForm.phone,tForm.nationality),"error");return;}
    if(tForm.id_type==="Emirates ID"&&tForm.id_number&&validateEmiratesID(tForm.id_number)){showToast(validateEmiratesID(tForm.id_number),"error");return;}
    if(tForm.passport_number&&validatePassport(tForm.passport_number)){showToast(validatePassport(tForm.passport_number),"error");return;}
    setSaving(true);
    try{
      const {data,error}=await supabase.from("tenants").insert({...tForm,id_expiry:tForm.id_expiry||null,passport_expiry:tForm.passport_expiry||null,created_by:currentUser.id}).select().single();
      if(error)throw error;
      setTenants(p=>[data,...p]);showToast("Tenant added","success");setShowAddTenant(false);setTForm(tBlank);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const saveLease=async()=>{
    if(!lForm.unit_id||!lForm.tenant_id||!lForm.annual_rent){showToast("Unit, tenant and rent required","error");return;}
    setSaving(true);
    try{
      const ar=Number(lForm.annual_rent);
      const {data,error}=await supabase.from("leases").insert({...lForm,annual_rent:ar,monthly_rent:Math.round(ar/12),security_deposit:lForm.security_deposit?Number(lForm.security_deposit):null,agency_fee:lForm.agency_fee?Number(lForm.agency_fee):null,number_of_cheques:Number(lForm.number_of_cheques)||1,created_by:currentUser.id}).select().single();
      if(error)throw error;
      setLeases(p=>[data,...p]);
      await supabase.from("project_units").update({status:"Leased"}).eq("id",lForm.unit_id);
      showToast("Lease created","success");setShowAddLease(false);setLForm(lBlank);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const savePmt=async()=>{
    if(!pForm.lease_id||!pForm.amount||!pForm.due_date){showToast("Lease, amount and due date required","error");return;}
    setSaving(true);
    try{
      const lease=leases.find(l=>l.id===pForm.lease_id);
      const {data,error}=await supabase.from("rent_payments").insert({...pForm,amount:Number(pForm.amount),unit_id:lease?.unit_id||null,tenant_id:lease?.tenant_id||null,created_by:currentUser.id}).select().single();
      if(error)throw error;
      setPayments(p=>[data,...p]);showToast("Payment logged","success");setShowAddPmt(false);setPForm(pBlank);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const saveMaint=async()=>{
    if(!mForm.unit_id||!mForm.title.trim()){showToast("Unit and title required","error");return;}
    setSaving(true);
    try{
      const {data,error}=await supabase.from("maintenance").insert({...mForm,cost_estimate:mForm.cost_estimate?Number(mForm.cost_estimate):null,reported_date:today.toISOString().slice(0,10),created_by:currentUser.id}).select().single();
      if(error)throw error;
      setMaintenance(p=>[data,...p]);showToast("Request logged","success");setShowAddMaint(false);setMForm(mBlank);
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const markPaid=async(id)=>{
    await supabase.from("rent_payments").update({status:"Paid",paid_date:today.toISOString().slice(0,10)}).eq("id",id);
    setPayments(p=>p.map(x=>x.id===id?{...x,status:"Paid"}:x));showToast("Marked paid","success");
  };

  const renewLease=async(lease)=>{
    const newEnd=new Date(lease.end_date);newEnd.setFullYear(newEnd.getFullYear()+1);
    await supabase.from("leases").update({status:"Renewed",end_date:newEnd.toISOString().slice(0,10)}).eq("id",lease.id);
    setLeases(p=>p.map(l=>l.id===lease.id?{...l,status:"Renewed",end_date:newEnd.toISOString().slice(0,10)}:l));
    showToast("Lease renewed +1 year","success");
  };

  if(loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#A0AEC0",fontSize:14}}>Loading Leasing…</div>;

  const TABS_L=[["dashboard","📊 Dashboard"],["tenants",`👤 Tenants (${tenants.length})`],["leases",`📄 Leases (${activeLeases.length})`],["payments",`💰 Payments (${overduePmts.length} overdue)`],["maintenance",`🔧 Maintenance (${openMaint.length})`]];

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{display:"flex",gap:5,marginBottom:14,flexWrap:"wrap"}}>
        {TABS_L.map(([id,l])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"6px 14px",borderRadius:8,border:`1.5px solid ${tab===id?"#0F2540":"#E2E8F0"}`,background:tab===id?"#0F2540":"#fff",color:tab===id?"#fff":"#4A5568",fontSize:12,fontWeight:tab===id?600:400,cursor:"pointer"}}>{l}</button>
        ))}
      </div>

      {/* Dashboard */}
      {tab==="dashboard"&&(
        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {[["Active Leases",activeLeases.length,"#0F2540","📄"],["Annual Rent",`AED ${(totalRent/1e6).toFixed(1)}M`,"#1A7F5A","💰"],["Overdue Payments",overduePmts.length,"#B83232","⚠"],["Open Maintenance",openMaint.length,"#5B3FAA","🔧"]].map(([l,v,c,icon])=>(
              <div key={l} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"1rem 1.25rem",borderTop:`3px solid ${c}`}}>
                <div style={{fontSize:10,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".7px",fontWeight:600,marginBottom:6}}>{icon} {l}</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:"#0F2540"}}>{v}</div>
              </div>
            ))}
          </div>
          {expiring30.length>0&&(
            <div style={{background:"#FDF3DC",border:"1.5px solid #E8C97A",borderRadius:12,padding:"1rem 1.25rem"}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#8A6200",marginBottom:10}}>⏰ Leases Expiring in 30 Days ({expiring30.length})</div>
              {expiring30.map(l=>{
                const days=Math.ceil((new Date(l.end_date)-today)/(1000*60*60*24));
                return (
                  <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #F0E8C8"}}>
                    <div><div style={{fontSize:13,fontWeight:600,color:"#0F2540"}}>{tenantName(l.tenant_id)}</div><div style={{fontSize:11,color:"#A0AEC0"}}>Unit {unitLabel(l.unit_id)} · Expires {new Date(l.end_date).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}</div></div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:12,fontWeight:700,color:"#B83232"}}>{days}d left</span>{canEdit&&<button onClick={()=>renewLease(l)} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"#1A7F5A",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer"}}>Renew</button>}</div>
                  </div>
                );
              })}
            </div>
          )}
          {overduePmts.length>0&&(
            <div style={{background:"#FAEAEA",border:"1.5px solid #F0BCBC",borderRadius:12,padding:"1rem 1.25rem"}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#B83232",marginBottom:10}}>💳 Overdue Payments ({overduePmts.length})</div>
              {overduePmts.slice(0,5).map(p=>{
                const lease=leases.find(l=>l.id===p.lease_id);
                return (
                  <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(184,50,50,.1)"}}>
                    <div><div style={{fontSize:13,fontWeight:600,color:"#0F2540"}}>{tenantName(lease?.tenant_id)}</div><div style={{fontSize:11,color:"#B83232"}}>Due {new Date(p.due_date).toLocaleDateString("en-AE",{day:"numeric",month:"short"})} · AED {Number(p.amount).toLocaleString()}</div></div>
                    {canEdit&&<button onClick={()=>markPaid(p.id)} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"#1A7F5A",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer"}}>Mark Paid</button>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tenants */}
      {tab==="tenants"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:12,color:"#A0AEC0"}}>{tenants.length} tenants</span>
            {canEdit&&<button onClick={()=>{setTForm(tBlank);setShowAddTenant(true);}} style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Add Tenant</button>}
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            {tenants.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}><div style={{fontSize:36,marginBottom:8}}>👤</div><div>No tenants yet</div></div>}
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead style={{position:"sticky",top:0}}><tr style={{background:"#0F2540"}}>{["Name","Type","Nationality","Phone","Email","ID Number","ID Expiry"].map(h=><th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:600,color:"#C9A84C",textTransform:"uppercase",letterSpacing:".4px",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>
                {tenants.map((t,i)=>(
                  <tr key={t.id} style={{background:i%2===0?"#fff":"#FAFBFC",borderBottom:"1px solid #F0F2F5"}}>
                    <td style={{padding:"10px 12px",fontWeight:600,fontSize:13,color:"#0F2540"}}>{t.full_name}</td>
                    <td style={{padding:"10px 12px"}}><span style={{fontSize:11,fontWeight:600,padding:"2px 7px",borderRadius:20,background:t.tenant_type==="Company"?"#E6EFF9":"#E6F4EE",color:t.tenant_type==="Company"?"#1A5FA8":"#1A7F5A"}}>{t.tenant_type}</span></td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}}>{t.nationality||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}}>{t.phone||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}}>{t.email||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"#4A5568"}}>{t.id_number||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:t.id_expiry&&new Date(t.id_expiry)<today?"#B83232":"#4A5568",fontWeight:t.id_expiry&&new Date(t.id_expiry)<today?700:400}}>{t.id_expiry?new Date(t.id_expiry).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"}):"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {showAddTenant&&(
            <Modal title="Add Tenant" onClose={()=>setShowAddTenant(false)} width={520}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>FULL NAME *</label><input value={tForm.full_name} onChange={e=>setTForm(f=>({...f,full_name:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>TYPE</label><select value={tForm.tenant_type} onChange={e=>setTForm(f=>({...f,tenant_type:e.target.value}))}><option>Individual</option><option>Company</option></select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>NATIONALITY</label><select value={tForm.nationality} onChange={e=>setTForm(f=>({...f,nationality:e.target.value}))}><option value="">Select…</option>{["UAE","Saudi Arabia","India","UK","Pakistan","Egypt","Jordan","USA","Russia","China","Other"].map(n=><option key={n}>{n}</option>)}</select></div>
                <div>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>PHONE</label>
                <VInput value={tForm.phone} onChange={e=>setTForm(f=>({...f,phone:e.target.value}))} placeholder="+971 50 000 0000" validate={v=>validatePhone(v,tForm.nationality)}/>
                <PhoneHint nationality={tForm.nationality}/>
              </div>
                <div>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>EMAIL</label>
                <VInput value={tForm.email} onChange={e=>setTForm(f=>({...f,email:e.target.value}))} placeholder="tenant@email.com" validate={validateEmail}/>
              </div>
                <div>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>WHATSAPP</label>
                <VInput value={tForm.whatsapp} onChange={e=>setTForm(f=>({...f,whatsapp:e.target.value}))} placeholder="+971 50 000 0000" validate={v=>v?validatePhone(v,tForm.nationality):null}/>
              </div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>ID TYPE</label><select value={tForm.id_type} onChange={e=>setTForm(f=>({...f,id_type:e.target.value}))}><option>Emirates ID</option><option>Passport</option><option>Residency Visa</option></select></div>
                <div>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>ID NUMBER</label>
                <VInput value={tForm.id_number} onChange={e=>setTForm(f=>({...f,id_number:e.target.value}))} placeholder={tForm.id_type==="Emirates ID"?"784-XXXX-XXXXXXX-X":""} validate={v=>tForm.id_type==="Emirates ID"?validateEmiratesID(v):null}/>
              </div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>ID EXPIRY</label><input type="date" value={tForm.id_expiry} onChange={e=>setTForm(f=>({...f,id_expiry:e.target.value}))}/></div>
                <div>
                <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>PASSPORT NO.</label>
                <VInput value={tForm.passport_number} onChange={e=>setTForm(f=>({...f,passport_number:e.target.value}))} placeholder="e.g. AB1234567" validate={validatePassport}/>
              </div>
              </div>
              {tForm.tenant_type==="Company"&&<div style={{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}><div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>COMPANY NAME</label><input value={tForm.company_name} onChange={e=>setTForm(f=>({...f,company_name:e.target.value}))}/></div><div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>TRADE LICENSE</label><input value={tForm.trade_license} onChange={e=>setTForm(f=>({...f,trade_license:e.target.value}))}/></div></div>}
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}>
                <button onClick={()=>setShowAddTenant(false)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveTenant} disabled={saving} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Add Tenant"}</button>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* Leases */}
      {tab==="leases"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:12,color:"#A0AEC0",flex:1}}>{leases.length} leases</span>
            {canEdit&&<button onClick={()=>setShowLeaseUpload(true)}
              style={{padding:"7px 16px",borderRadius:8,border:"1.5px solid #1A7F5A",background:"#E6F4EE",color:"#1A7F5A",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
              📋 Download Template / Upload Data
            </button>}
            {canEdit&&<button onClick={()=>{setLForm(lBlank);setShowAddLease(true);}} style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ New Lease</button>}
          </div>
          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
            {leases.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}><div style={{fontSize:36,marginBottom:8}}>📄</div><div>No leases yet</div></div>}
            {leases.map(l=>{
              const daysLeft=Math.ceil((new Date(l.end_date)-today)/(1000*60*60*24));
              const isExpiring=daysLeft<=30&&daysLeft>=0&&l.status==="Active";
              const SC_L={Active:{c:"#1A7F5A",bg:"#E6F4EE"},Expired:{c:"#B83232",bg:"#FAEAEA"},Terminated:{c:"#718096",bg:"#F7F9FC"},Pending:{c:"#A06810",bg:"#FDF3DC"},Renewed:{c:"#1A5FA8",bg:"#E6EFF9"}};
              const sc=SC_L[l.status]||{c:"#718096",bg:"#F7F9FC"};
              return (
                <div key={l.id} style={{background:"#fff",border:`1px solid ${isExpiring?"#E8C97A":"#E2E8F0"}`,borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#0F2540",marginBottom:2}}>{tenantName(l.tenant_id)}</div>
                      <div style={{fontSize:12,color:"#A0AEC0"}}>Unit {unitLabel(l.unit_id)}{l.ejari_number?` · Ejari: ${l.ejari_number}`:""}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:20,background:sc.bg,color:sc.c}}>{l.status}</span>
                      {isExpiring&&<div style={{fontSize:11,color:"#B83232",fontWeight:700,marginTop:3}}>⏰ {daysLeft}d left</div>}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,background:"#FAFBFC",borderRadius:8,padding:"8px 10px",marginBottom:8}}>
                    {[["Start",new Date(l.start_date).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})],["End",new Date(l.end_date).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})],["Annual Rent",`AED ${Number(l.annual_rent).toLocaleString()}`],["Cheques",l.number_of_cheques]].map(([k,v])=>(
                      <div key={k}><div style={{fontSize:9,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".5px"}}>{k}</div><div style={{fontSize:12,fontWeight:600,color:"#0F2540"}}>{v}</div></div>
                    ))}
                  </div>
                  {canEdit&&(
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>{setPForm({...pBlank,lease_id:l.id});setShowAddPmt(true);}} style={{padding:"5px 12px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:11,fontWeight:600,cursor:"pointer"}}>Log Payment</button>
                      {l.status==="Active"&&<button onClick={()=>renewLease(l)} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"#E6F4EE",color:"#1A7F5A",fontSize:11,fontWeight:600,cursor:"pointer"}}>Renew</button>}
                      {l.status==="Active"&&<button onClick={async()=>{if(!window.confirm("Terminate?"))return;await supabase.from("leases").update({status:"Terminated",termination_date:today.toISOString().slice(0,10)}).eq("id",l.id);setLeases(p=>p.map(x=>x.id===l.id?{...x,status:"Terminated"}:x));showToast("Terminated","info");}} style={{padding:"5px 12px",borderRadius:8,border:"1.5px solid #F0BCBC",background:"#FAEAEA",color:"#B83232",fontSize:11,fontWeight:600,cursor:"pointer"}}>Terminate</button>}
                    </div>
                  )}
                  {/* PDC Cheque Manager */}
                  <LeasingChequeManager
                    lease={l}
                    tenantName={tenantName(l.tenant_id)}
                    unitLabel={unitLabel(l.unit_id)}
                    currentUser={currentUser}
                    showToast={showToast}
                  />
                </div>
              );
            })}
          </div>
          {/* Lease Upload Modal */}
          {showLeaseUpload&&(()=>{
            const cid = currentUser.company_id || localStorage.getItem("propccrm_company_id") || null;
            return (
            <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
              <div style={{background:"#fff",borderRadius:16,width:600,maxWidth:"100%",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
                  <span style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#fff"}}>📋 Leases — Download Template / Upload Data</span>
                  <button onClick={()=>setShowLeaseUpload(false)} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
                </div>
                <div style={{padding:"1.5rem"}}>
                  {/* Export */}
                  {leases.length>0&&(
                    <div style={{background:"#F7F9FC",borderRadius:10,padding:"12px 14px",marginBottom:14,border:"1px solid #E2E8F0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div><div style={{fontSize:12,fontWeight:700,color:"#0F2540"}}>Export Current Leases</div><div style={{fontSize:11,color:"#718096"}}>{leases.length} records</div></div>
                      <button onClick={()=>{
                        const headers="tenant_id,unit_id,start_date,end_date,annual_rent,security_deposit,agency_fee,number_of_cheques,ejari_number,status,notes";
                        const rows=leases.map(l=>[l.tenant_id||"",l.unit_id||"",l.start_date||"",l.end_date||"",l.annual_rent||"",l.security_deposit||"",l.agency_fee||"",l.number_of_cheques||"",l.ejari_number||"",l.status||"",l.notes||""].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(","));
                        const csv=[headers,...rows].join("\n");
                        const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);a.download=`leases_export_${new Date().toISOString().split("T")[0]}.csv`;a.click();
                        showToast(`Exported ${leases.length} leases`,"success");
                      }} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#1A7F5A",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>⬇ Export Current</button>
                    </div>
                  )}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                    <div style={{background:"#F7F9FC",borderRadius:10,padding:"16px",border:"1px solid #E2E8F0",display:"flex",flexDirection:"column",gap:10}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>📥 Step 1 — Download Template</div>
                      <div style={{fontSize:11,color:"#4A5568",lineHeight:1.7}}>
                        <strong>Columns:</strong> tenant_id · unit_id · start_date · end_date · annual_rent · security_deposit · number_of_cheques · ejari_number · status · notes<br/>
                        <strong>status:</strong> Active | Expired | Terminated | Renewed | Pending<br/>
                        <strong>Dates:</strong> YYYY-MM-DD format
                      </div>
                      <button onClick={()=>{
                        const headers="tenant_id,unit_id,start_date,end_date,annual_rent,security_deposit,agency_fee,number_of_cheques,ejari_number,status,notes";
                        const samples='"TENANT_ID_HERE","UNIT_ID_HERE","2025-01-01","2026-01-01","120000","10000","5000","4","EJARI-12345","Active","Sample lease"';
                        const note="\n\nGet tenant_id from Enquiries tab export\nGet unit_id from Inventory tab export\nstatus values: Active | Expired | Terminated | Renewed | Pending";
                        const csv=headers+"\n"+samples+note;
                        const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);a.download="propcrm_leases_template.csv";a.click();
                      }} style={{padding:"10px 0",borderRadius:8,border:"none",background:"#0F2540",color:"#C9A84C",fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"center"}}>
                        ⬇ Download Template
                      </button>
                    </div>
                    <div style={{background:"#E6F4EE",borderRadius:10,padding:"16px",border:"2px dashed #1A7F5A",display:"flex",flexDirection:"column",gap:10,alignItems:"center",justifyContent:"center"}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>📤 Step 2 — Upload Your File</div>
                      <div style={{fontSize:28}}>📂</div>
                      <label style={{padding:"12px 24px",borderRadius:8,border:"none",background:"#1A7F5A",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",textAlign:"center",width:"100%",boxSizing:"border-box"}}>
                        📤 Select CSV & Upload
                        <input type="file" accept=".csv" style={{display:"none"}} onChange={async(e)=>{
                          const file=e.target.files[0]; if(!file) return;
                          const text=await file.text();
                          const rows=text.trim().split("\n");
                          const headers=rows[0].split(",").map(h=>h.trim().replace(/"/g,"").toLowerCase());
                          const records=rows.slice(1).filter(r=>r.trim()&&!r.startsWith('"Get')).map(row=>{
                            const vals=row.split(",").map(v=>v.trim().replace(/"/g,""));
                            const rec={}; headers.forEach((h,i)=>{rec[h]=vals[i]||null;}); return rec;
                          });
                          if(!records.length){showToast("No data rows found","error");return;}
                          const payload=records.map(r=>({
                            tenant_id:r.tenant_id||null, unit_id:r.unit_id||null,
                            start_date:r.start_date||null, end_date:r.end_date||null,
                            annual_rent:r.annual_rent?parseFloat(r.annual_rent):null,
                            security_deposit:r.security_deposit?parseFloat(r.security_deposit):null,
                            agency_fee:r.agency_fee?parseFloat(r.agency_fee):null,
                            number_of_cheques:r.number_of_cheques?parseInt(r.number_of_cheques):1,
                            ejari_number:r.ejari_number||null, status:r.status||"Active",
                            notes:r.notes||null, company_id:cid, created_by:currentUser.id
                          }));
                          const{data:newL,error}=await supabase.from("leases").insert(payload).select();
                          if(error){showToast(error.message,"error");return;}
                          setLeases(p=>[...(newL||[]),...p]);
                          showToast(`✓ ${newL?.length||0} leases uploaded`,"success");
                          setShowLeaseUpload(false);
                        }}/>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {showAddLease&&(
            <Modal title="New Lease Contract" onClose={()=>setShowAddLease(false)} width={520}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>UNIT *</label><select value={lForm.unit_id} onChange={e=>setLForm(f=>({...f,unit_id:e.target.value}))}><option value="">Select…</option>{units.map(u=><option key={u.id} value={u.id}>#{u.unit_ref} — {u.sub_type}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>TENANT *</label><select value={lForm.tenant_id} onChange={e=>setLForm(f=>({...f,tenant_id:e.target.value}))}><option value="">Select…</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>START DATE *</label><input type="date" value={lForm.start_date} onChange={e=>setLForm(f=>({...f,start_date:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>END DATE *</label><input type="date" value={lForm.end_date} onChange={e=>setLForm(f=>({...f,end_date:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>ANNUAL RENT (AED) *</label><input type="number" value={lForm.annual_rent} onChange={e=>setLForm(f=>({...f,annual_rent:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>SECURITY DEPOSIT</label><input type="number" value={lForm.security_deposit} onChange={e=>setLForm(f=>({...f,security_deposit:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>PAYMENT FREQUENCY</label><select value={lForm.payment_frequency} onChange={e=>setLForm(f=>({...f,payment_frequency:e.target.value}))}>{["Monthly","Quarterly","Bi-Annual","Annual"].map(x=><option key={x}>{x}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>CHEQUES</label><input type="number" value={lForm.number_of_cheques} onChange={e=>setLForm(f=>({...f,number_of_cheques:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>EJARI NO.</label><input value={lForm.ejari_number} onChange={e=>setLForm(f=>({...f,ejari_number:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>CONTRACT NO.</label><input value={lForm.contract_number} onChange={e=>setLForm(f=>({...f,contract_number:e.target.value}))}/></div>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}>
                <button onClick={()=>setShowAddLease(false)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveLease} disabled={saving} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Create Lease"}</button>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* Payments */}
      {tab==="payments"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <div style={{display:"flex",gap:12}}><span style={{fontSize:12,color:"#B83232",fontWeight:600}}>Overdue: {overduePmts.length}</span><span style={{fontSize:12,color:"#A0AEC0"}}>Total: {payments.length}</span></div>
            {canEdit&&<button onClick={()=>{setPForm(pBlank);setShowAddPmt(true);}} style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Log Payment</button>}
          </div>
          <div style={{flex:1,overflowY:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead style={{position:"sticky",top:0}}><tr style={{background:"#0F2540"}}>{["Tenant","Unit","Type","Amount","Due Date","Paid","Method","Status",""].map(h=><th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:600,color:"#C9A84C",textTransform:"uppercase",letterSpacing:".4px",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
              <tbody>
                {payments.sort((a,b)=>new Date(a.due_date)-new Date(b.due_date)).map((p,i)=>{
                  const lease=leases.find(l=>l.id===p.lease_id);
                  const isOD=p.status==="Pending"&&new Date(p.due_date)<today;
                  const SC_P={Paid:{c:"#1A7F5A",bg:"#E6F4EE"},Pending:{c:"#A06810",bg:"#FDF3DC"},Bounced:{c:"#B83232",bg:"#FAEAEA"}};
                  const sc=SC_P[p.status]||{c:"#718096",bg:"#F7F9FC"};
                  return (
                    <tr key={p.id} style={{background:isOD?"#FFF5F5":i%2===0?"#fff":"#FAFBFC",borderBottom:"1px solid #F0F2F5"}}>
                      <td style={{padding:"9px 12px",fontSize:13,fontWeight:600,color:"#0F2540"}}>{tenantName(lease?.tenant_id)}</td>
                      <td style={{padding:"9px 12px",fontSize:12,color:"#4A5568"}}>{unitLabel(p.unit_id||lease?.unit_id)}</td>
                      <td style={{padding:"9px 12px",fontSize:11,color:"#4A5568"}}>{p.payment_type}</td>
                      <td style={{padding:"9px 12px",fontSize:13,fontWeight:700,color:"#0F2540",whiteSpace:"nowrap"}}>AED {Number(p.amount).toLocaleString()}</td>
                      <td style={{padding:"9px 12px",fontSize:12,color:isOD?"#B83232":"#4A5568",fontWeight:isOD?700:400}}>{new Date(p.due_date).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"})}</td>
                      <td style={{padding:"9px 12px",fontSize:12,color:"#1A7F5A"}}>{p.paid_date?new Date(p.paid_date).toLocaleDateString("en-AE",{day:"numeric",month:"short"}):"—"}</td>
                      <td style={{padding:"9px 12px",fontSize:12,color:"#4A5568"}}>{p.payment_method}</td>
                      <td style={{padding:"9px 12px"}}><span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:20,background:sc.bg,color:sc.c}}>{p.status}</span></td>
                      <td style={{padding:"9px 12px"}}>{p.status==="Pending"&&canEdit&&<button onClick={()=>markPaid(p.id)} style={{padding:"4px 10px",borderRadius:8,border:"none",background:"#E6F4EE",color:"#1A7F5A",fontSize:11,fontWeight:600,cursor:"pointer"}}>Paid</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {payments.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}><div style={{fontSize:36,marginBottom:8}}>💰</div><div>No payments logged</div></div>}
          </div>
          {showAddPmt&&(
            <Modal title="Log Payment" onClose={()=>setShowAddPmt(false)} width={440}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>LEASE *</label><select value={pForm.lease_id} onChange={e=>setPForm(f=>({...f,lease_id:e.target.value}))}><option value="">Select…</option>{leases.filter(l=>l.status==="Active").map(l=><option key={l.id} value={l.id}>{tenantName(l.tenant_id)} · Unit {unitLabel(l.unit_id)}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>TYPE</label><select value={pForm.payment_type} onChange={e=>setPForm(f=>({...f,payment_type:e.target.value}))}>{["Rent","Security Deposit","Agency Fee","Maintenance","Other"].map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>AMOUNT (AED) *</label><input type="number" value={pForm.amount} onChange={e=>setPForm(f=>({...f,amount:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>DUE DATE *</label><input type="date" value={pForm.due_date} onChange={e=>setPForm(f=>({...f,due_date:e.target.value}))}/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>METHOD</label><select value={pForm.payment_method} onChange={e=>setPForm(f=>({...f,payment_method:e.target.value}))}>{["Cheque","Bank Transfer","Cash","Online"].map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>STATUS</label><select value={pForm.status} onChange={e=>setPForm(f=>({...f,status:e.target.value}))}>{["Pending","Paid","Bounced","Waived"].map(s=><option key={s}>{s}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>CHEQUE/REF</label><input value={pForm.cheque_number} onChange={e=>setPForm(f=>({...f,cheque_number:e.target.value}))}/></div>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}>
                <button onClick={()=>setShowAddPmt(false)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                <button onClick={savePmt} disabled={saving} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Log Payment"}</button>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* Maintenance */}
      {tab==="maintenance"&&(
        <div style={{flex:1,display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <span style={{fontSize:12,color:"#A0AEC0"}}>{openMaint.length} open · {maintenance.length} total</span>
            {canEdit&&<button onClick={()=>{setMForm(mBlank);setShowAddMaint(true);}} style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>+ Log Request</button>}
          </div>
          <div style={{flex:1,overflowY:"auto",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10,alignContent:"start"}}>
            {maintenance.map(m=>{
              const PC={Urgent:{c:"#B83232",bg:"#FAEAEA"},High:{c:"#B85C10",bg:"#FDF0E6"},Normal:{c:"#1A5FA8",bg:"#E6EFF9"},Low:{c:"#718096",bg:"#F7F9FC"}};
              const SC_M={Open:{c:"#B83232",bg:"#FAEAEA"},"In Progress":{c:"#A06810",bg:"#FDF3DC"},Completed:{c:"#1A7F5A",bg:"#E6F4EE"}};
              const pc=PC[m.priority]||{c:"#718096",bg:"#F7F9FC"};
              const sc=SC_M[m.status]||{c:"#718096",bg:"#F7F9FC"};
              return (
                <div key={m.id} style={{background:"#fff",border:`1px solid ${m.priority==="Urgent"?"#F0BCBC":"#E2E8F0"}`,borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",gap:6,marginBottom:8}}>
                    <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:pc.bg,color:pc.c}}>{m.priority}</span>
                    <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:sc.bg,color:sc.c}}>{m.status}</span>
                    <span style={{fontSize:10,color:"#A0AEC0",marginLeft:"auto"}}>{m.category}</span>
                  </div>
                  <div style={{fontWeight:700,fontSize:13,color:"#0F2540",marginBottom:4}}>{m.title}</div>
                  <div style={{fontSize:11,color:"#A0AEC0",marginBottom:6}}>Unit {unitLabel(m.unit_id)} · {m.charged_to} responsibility</div>
                  {m.description&&<div style={{fontSize:12,color:"#4A5568",lineHeight:1.5,marginBottom:6}}>{m.description}</div>}
                  {m.assigned_to&&<div style={{fontSize:11,color:"#4A5568"}}>👷 {m.assigned_to}</div>}
                  {m.cost_estimate&&<div style={{fontSize:11,color:"#A06810"}}>Est: AED {Number(m.cost_estimate).toLocaleString()}</div>}
                  {canEdit&&m.status!=="Completed"&&(
                    <button onClick={async()=>{await supabase.from("maintenance").update({status:"Completed",completed_date:today.toISOString().slice(0,10)}).eq("id",m.id);setMaintenance(p=>p.map(x=>x.id===m.id?{...x,status:"Completed"}:x));showToast("Marked complete","success");}} style={{marginTop:8,padding:"5px 12px",borderRadius:8,border:"none",background:"#E6F4EE",color:"#1A7F5A",fontSize:11,fontWeight:600,cursor:"pointer"}}>Mark Complete</button>
                  )}
                </div>
              );
            })}
            {maintenance.length===0&&<div style={{textAlign:"center",padding:"3rem",color:"#A0AEC0"}}><div style={{fontSize:36,marginBottom:8}}>🔧</div><div>No maintenance requests</div></div>}
          </div>
          {showAddMaint&&(
            <Modal title="Log Maintenance Request" onClose={()=>setShowAddMaint(false)} width={480}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>UNIT *</label><select value={mForm.unit_id} onChange={e=>setMForm(f=>({...f,unit_id:e.target.value}))}><option value="">Select…</option>{units.map(u=><option key={u.id} value={u.id}>#{u.unit_ref}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>PRIORITY</label><select value={mForm.priority} onChange={e=>setMForm(f=>({...f,priority:e.target.value}))}>{["Urgent","High","Normal","Low"].map(p=><option key={p}>{p}</option>)}</select></div>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>TITLE *</label><input value={mForm.title} onChange={e=>setMForm(f=>({...f,title:e.target.value}))} placeholder="e.g. AC not working"/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>CATEGORY</label><select value={mForm.category} onChange={e=>setMForm(f=>({...f,category:e.target.value}))}>{["Plumbing","Electrical","AC/HVAC","Painting","Carpentry","Appliances","Pest Control","Cleaning","General","Other"].map(c=><option key={c}>{c}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>CHARGED TO</label><select value={mForm.charged_to} onChange={e=>setMForm(f=>({...f,charged_to:e.target.value}))}>{["Landlord","Tenant","Shared"].map(c=><option key={c}>{c}</option>)}</select></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>ASSIGNED TO</label><input value={mForm.assigned_to} onChange={e=>setMForm(f=>({...f,assigned_to:e.target.value}))} placeholder="Contractor name"/></div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>COST ESTIMATE (AED)</label><input type="number" value={mForm.cost_estimate} onChange={e=>setMForm(f=>({...f,cost_estimate:e.target.value}))}/></div>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5}}>DESCRIPTION</label><textarea value={mForm.description} onChange={e=>setMForm(f=>({...f,description:e.target.value}))} rows={2}/></div>
              </div>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:14}}>
                <button onClick={()=>setShowAddMaint(false)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
                <button onClick={saveMaint} disabled={saving} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Log Request"}</button>
              </div>
            </Modal>
          )}
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// AI ASSISTANT — Multi-provider with fallback
// Groq (free) → Gemini (free) → Claude (paid)
// ══════════════════════════════════════════════════════════════════

// ── Provider definitions ──────────────────────────────────────────
const AI_PROVIDERS = [
  {
    id:"groq", name:"Groq", label:"Groq (Free · Llama 3.1)", badge:"FREE",
    badgeColor:"#1A7F5A", badgeBg:"#E6F4EE",
    placeholder:"Get free key at console.groq.com",
    link:"https://console.groq.com",
    model:"llama-3.1-70b-versatile",
    call: async (key, systemPrompt, messages) => {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},
        body:JSON.stringify({
          model:"llama-3.1-70b-versatile",
          messages:[{role:"system",content:systemPrompt},...messages.map(m=>({role:m.role,content:m.content}))],
          max_tokens:1024,temperature:0.7
        })
      });
      if(!res.ok){const e=await res.json();throw new Error(e.error?.message||"Groq error");}
      const d=await res.json();
      return d.choices[0]?.message?.content||"";
    }
  },
  {
    id:"gemini", name:"Gemini", label:"Google Gemini (Free · 1500/day)", badge:"FREE",
    badgeColor:"#1A5FA8", badgeBg:"#E6EFF9",
    placeholder:"Get free key at aistudio.google.com",
    link:"https://aistudio.google.com",
    model:"gemini-1.5-flash",
    call: async (key, systemPrompt, messages) => {
      const contents = messages.map(m=>({
        role: m.role==="assistant"?"model":"user",
        parts:[{text:m.content}]
      }));
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system_instruction:{parts:[{text:systemPrompt}]},
          contents,
          generationConfig:{maxOutputTokens:1024,temperature:0.7}
        })
      });
      if(!res.ok){const e=await res.json();throw new Error(e.error?.message||"Gemini error");}
      const d=await res.json();
      return d.candidates[0]?.content?.parts[0]?.text||"";
    }
  },
  {
    id:"claude", name:"Claude", label:"Claude by Anthropic (~$0.003/msg)", badge:"PAID",
    badgeColor:"#8A6200", badgeBg:"#FDF3DC",
    placeholder:"Get key at console.anthropic.com",
    link:"https://console.anthropic.com",
    model:"claude-sonnet-4-20250514",
    call: async (key, systemPrompt, messages) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1024,system:systemPrompt,messages:messages.map(m=>({role:m.role,content:m.content}))})
      });
      if(!res.ok){const e=await res.json();throw new Error(e.error?.message||"Claude error");}
      const d=await res.json();
      return d.content[0]?.text||"";
    }
  }
];

// ── Context builder ───────────────────────────────────────────────

export default LeasingModule;

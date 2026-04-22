import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = "https://ysceukgpimzfqixtnbnp.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzY2V1a2dwaW16ZnFpeHRuYm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDI5OTQsImV4cCI6MjA4OTkxODk5NH0.WZSyGeOEbiRo1wt13syheTOyiAToMWXInxIaBgaqq8k";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

function ReportsModule({ currentUser, showToast, globalOpps=[], leads=[], activities=[], leasingData=null, initialFilter=null, crmContext="sales", preloadedUnits=[], preloadedProjects=[], preloadedSalePricing=[], preloadedLeasePricing=[], preloadedUsers=[] }) {
  const [activeReport, setActiveReport] = useState(initialFilter?.value||( crmContext==="leasing"?"rent_roll":"pipeline"));
  const [loading,      setLoading]      = useState(false);
  const [data,         setData]         = useState({
    units: preloadedUnits||[], projects: preloadedProjects||[],
    salePricing: preloadedSalePricing||[], leasePricing: preloadedLeasePricing||[],
    leases: leasingData?.leases||[], tenants: leasingData?.tenants||[],
    payments: leasingData?.payments||[], users: preloadedUsers||[],
  });
  const [filters,      setFilters]      = useState({ dateFrom:"", dateTo:"", status:"All", agent:"All" });

  // Load all data needed for reports
  const loadData = useCallback(async () => {
    // If leasing context and data already loaded, use it
    if(crmContext==="leasing" && leasingData?.loaded){
      setData(d=>({...d,
        leases:leasingData.leases||[],
        tenants:leasingData.tenants||[],
        payments:leasingData.payments||[],
      }));
      // Still load other data
    }
    setLoading(true);
    try {
      const safe = q => q.catch(()=>({data:[]}));
      const cid = currentUser.company_id || localStorage.getItem("propccrm_company_id") || null;
      const byco = (tbl, extra="") => {
        let q = supabase.from(tbl).select(extra||"*");
        if(cid) q = q.eq("company_id", cid);
        return q;
      };
      const [leads,acts,users,units,projs,sp,lp,leases,tenants,payments,leaseOpps,leasePay] = await Promise.all([
        safe(byco("leads").order("created_at",{ascending:false})),
        safe(byco("activities")),
        safe(cid ? supabase.from("profiles").select("id,full_name,role,email").eq("company_id",cid) : supabase.from("profiles").select("id,full_name,role,email")),
        safe(byco("project_units")),
        safe(byco("projects")),
        safe(byco("unit_sale_pricing")),
        safe(byco("unit_lease_pricing")),
        safe(byco("leases").order("end_date")),
        safe(byco("tenants")),
        safe(byco("rent_payments").order("due_date")),
        safe(byco("lease_opportunities")),
        safe(supabase.from("lease_payments").select("*").eq("company_id",cid||"").order("due_date")),
      ]);
      setData({
        leads:   leads.data||[],   activities: acts.data||[],
        users:   users.data||[],
        users:   (users.data||[]).length>0 ? users.data : (preloadedUsers||[]),
        units:   (units.data||[]).length>0 ? units.data : (preloadedUnits||[]),
        leaseOpps: leaseOpps.data||[], leasePay: leasePay?.data||[],
        projects:(projs.data||[]).length>0 ? projs.data : (preloadedProjects||[]),
        salePricing:(sp.data||[]).length>0 ? sp.data : (preloadedSalePricing||[]),
        leasePricing:(lp.data||[]).length>0 ? lp.data : (preloadedLeasePricing||[]),
        leases:  (leases.data||[]).length>0 ? leases.data : (leasingData?.leases||[]),
        tenants: (tenants.data||[]).length>0 ? tenants.data : (leasingData?.tenants||[]),
        payments:(payments.data||[]).length>0 ? payments.data : (leasingData?.payments||[]),
        cheques: cheques.data||[],
      });
    } catch(e) { showToast("Error loading report data","error"); }
    setLoading(false);
  },[]);

  useEffect(()=>{ loadData(); },[loadData]);

  const fmt = n => n ? `AED ${Number(n).toLocaleString()}` : "—";
  const fmtD = d => d ? new Date(d).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"}) : "—";
  const today = new Date();

  // ── Report definitions ──────────────────────────────────────────
  const REPORTS = {

    // 1. PIPELINE — uses opportunities
    pipeline: {
      label:"Pipeline Report", icon:"📊",
      description:"All opportunities by stage with values and conversion rates",
      generate: () => {
        const { leads=[], users=[] } = data;
        const oppsData = globalOpps.length>0 ? globalOpps : (data.opps||[]);
        const userName = id => users.find(u=>u.id===id)?.full_name||"Unassigned";
        const leadName = id => leads.find(l=>l.id===id)?.name||"—";
        const rows = oppsData.map(o=>([
          o.title||"—", leadName(o.lead_id),
          o.stage, o.status,
          o.budget ? `AED ${Number(o.budget).toLocaleString()}` : "—",
          o.final_price ? `AED ${Number(o.final_price).toLocaleString()}` : "—",
          userName(o.assigned_to),
          fmtD(o.created_at),
          o.stage_updated_at ? Math.floor((today-new Date(o.stage_updated_at))/864e5)+"d" : "—",
          o.proposal_sent_at ? fmtD(o.proposal_sent_at) : "—",
        ]));
        const headers = ["Opportunity","Contact","Stage","Status","Budget","Final Price","Agent","Created","Days in Stage","Proposal Sent"];
        const summary = OPP_STAGES.map(s=>{
          const sl=oppsData.filter(o=>o.stage===s);
          const val=sl.reduce((a,o)=>a+(o.budget||0),0);
          return [s, sl.length, `AED ${(val/1e6).toFixed(2)}M`, oppsData.length?Math.round(sl.length/oppsData.length*100)+"%":"0%"];
        });
        return { rows, headers, summary, summaryHeaders:["Stage","Count","Value","% of Total"] };
      }
    },

    // 2. SALES PAYMENTS
    sales_payments: {
      label:"Sales Payments Report", icon:"💰",
      description:"Payment collections vs outstanding per lead/contract",
      generate: () => {
        const { payments=[], leads=[] } = data;
        const leadName = id => leads.find(l=>l.id===id)?.name||"—";
        const rows = payments.map(p=>([
          leadName(p.lead_id), p.milestone,
          fmt(p.amount), p.percentage?p.percentage+"%":"—",
          p.payment_type||"—", p.cheque_number||"—", p.bank_name||"—",
          fmtD(p.due_date), fmtD(p.received_date||p.cleared_date),
          p.status,
          p.status==="Bounced" ? (p.bounce_reason||"—") : "—",
        ]));
        const headers = ["Lead","Milestone","Amount","%","Type","Cheque No.","Bank","Due Date","Received","Status","Bounce Reason"];
        const cleared  = payments.filter(p=>p.status==="Cleared").reduce((s,p)=>s+(p.amount||0),0);
        const pending  = payments.filter(p=>["Pending","Received","Deposited"].includes(p.status)).reduce((s,p)=>s+(p.amount||0),0);
        const bounced  = payments.filter(p=>p.status==="Bounced").reduce((s,p)=>s+(p.amount||0),0);
        const summary  = [["Cleared",payments.filter(p=>p.status==="Cleared").length,fmt(cleared)],["Pending",payments.filter(p=>p.status==="Pending").length,fmt(pending)],["Bounced",payments.filter(p=>p.status==="Bounced").length,fmt(bounced)]];
        return { rows, headers, summary, summaryHeaders:["Status","Count","Value"] };
      }
    },

    // 3. RENT ROLL
    rent_roll: {
      label:"Rent Roll", icon:"🔑",
      description:"All active leases with annual value and expiry",
      generate: () => {
        const { leases=[], tenants=[], units=[] } = data;
        const tenantName = id => tenants.find(t=>t.id===id)?.full_name||"—";
        const unitRef    = id => units.find(u=>u.id===id)?.unit_ref||"—";
        const active     = leases.filter(l=>l.status==="Active");
        const rows       = active.map(l=>{
          const daysToExp = Math.ceil((new Date(l.end_date)-today)/864e5);
          return [
            tenantName(l.tenant_id), unitRef(l.unit_id),
            fmt(l.annual_rent), fmt(l.annual_rent?Math.round(l.annual_rent/12):0),
            fmt(l.security_deposit), l.number_of_cheques||"—",
            fmtD(l.start_date), fmtD(l.end_date),
            daysToExp>0 ? daysToExp+"d" : "EXPIRED",
            daysToExp<=30&&daysToExp>0 ? "⚠ Expiring Soon" : daysToExp<=0 ? "⚠ Expired" : "Active",
            l.ejari_number||"—", l.contract_number||"—",
          ];
        });
        const headers = ["Tenant","Unit","Annual Rent","Monthly","Deposit","Cheques","Start","End","Days Left","Status","Ejari","Contract"];
        const totalRent = active.reduce((s,l)=>s+(l.annual_rent||0),0);
        const expiring  = active.filter(l=>Math.ceil((new Date(l.end_date)-today)/864e5)<=30).length;
        const summary   = [["Total Active Leases",active.length,""],["Total Annual Rent Roll",fmt(totalRent),""],["Expiring in 30 days",expiring,"⚠ Action needed"]];
        return { rows, headers, summary, summaryHeaders:["Metric","Value","Note"] };
      }
    },

    // 4. PDC SCHEDULE
    pdc_schedule: {
      label:"PDC Cheque Schedule", icon:"📋",
      description:"All post-dated cheques sorted by deposit date",
      generate: () => {
        const { leasePay=[], leases=[], tenants=[], units=[], leaseOpps=[] } = data;
        const cheques = leasePay.filter(p=>p.payment_type==="PDC Cheque"||p.payment_type==="Cheque");
        const lease    = id => leases.find(l=>l.id===id);
        const tenant   = id => tenants.find(t=>t.id===id)?.full_name||"—";
        const unitRef  = id => units.find(u=>u.id===id)?.unit_ref||"—";
        const upcoming = [...cheques].sort((a,b)=>new Date(a.cheque_date)-new Date(b.cheque_date));
        const rows = upcoming.map(c=>{
          const l = lease(c.lease_id);
          const isOverdue = c.status==="Pending"&&new Date(c.cheque_date)<today;
          return [
            l ? tenant(l.tenant_id) : "—",
            c.unit_id ? unitRef(c.unit_id) : "—",
            fmt(c.amount), c.cheque_number||"—", c.bank_name||"—",
            fmtD(c.cheque_date), `${c.cheque_sequence}/${c.total_cheques}`,
            c.status, isOverdue?"⚠ OVERDUE":"",
            fmtD(c.deposit_date), fmtD(c.cleared_date),
          ];
        });
        const headers = ["Tenant","Unit","Amount","Cheque No.","Bank","Date","Seq","Status","Alert","Deposited","Cleared"];
        const pending  = cheques.filter(c=>c.status==="Pending");
        const overdue  = pending.filter(c=>new Date(c.cheque_date)<today);
        const summary  = [
          ["Total Cheques",cheques.length,""],
          ["Pending",pending.length, fmt(pending.reduce((s,c)=>s+(c.amount||0),0))],
          ["Overdue",overdue.length, overdue.length>0?"⚠ Immediate action":""],
          ["Cleared",cheques.filter(c=>c.status==="Cleared").length,""],
          ["Bounced",cheques.filter(c=>c.status==="Bounced").length,""],
        ];
        return { rows, headers, summary, summaryHeaders:["Status","Count","Value"] };
      }
    },

    // 5. INVENTORY
    inventory: {
      label:"Inventory Availability", icon:"🏠",
      description:"All units by project with status and pricing",
      generate: () => {
        const { units=[], projects=[], salePricing=[], leasePricing=[] } = data;
        const proj = id => projects.find(p=>p.id===id)?.name||"—";
        const sp   = id => salePricing.find(s=>s.unit_id===id);
        const lp   = id => leasePricing.find(l=>l.unit_id===id);
        const rows = units.map(u=>([
          proj(u.project_id), u.unit_ref, u.unit_type, u.sub_type,
          u.purpose||"—", u.bedrooms===0?"Studio":u.bedrooms||"—",
          u.size_sqft?Number(u.size_sqft).toLocaleString():"—",
          u.floor_number||"—", u.view||"—",
          sp(u.id)?.asking_price ? fmt(sp(u.id).asking_price) : "—",
          sp(u.id)?.price_per_sqft ? `AED ${Number(sp(u.id).price_per_sqft).toLocaleString()}` : "—",
          lp(u.id)?.annual_rent ? fmt(lp(u.id).annual_rent) : "—",
          u.status, u.handover_date ? fmtD(u.handover_date) : "—",
        ]));
        const headers = ["Project","Ref","Type","Category","Purpose","Beds","Sqft","Floor","View","Sale Price","AED/sqft","Annual Rent","Status","Handover"];
        const byStatus = ["Available","Reserved","Under Offer","Sold","Leased","Cancelled"].map(s=>([s, units.filter(u=>u.status===s).length, ""]));
        return { rows, headers, summary:byStatus, summaryHeaders:["Status","Count",""] };
      }
    },

    // 5. AGENT PERFORMANCE
    agent_performance: {
      label:"Agent Performance", icon:"👤",
      description:"Tasks, deals and conversion rates per agent",
      generate: () => {
        const { users=[], activities=[] } = data;
        const oppsData = globalOpps.length>0 ? globalOpps : (data.opps||[]);
        const activeUsers = users.filter(u=>u.is_active&&u.role!=="super_admin");
        const rows = activeUsers.map(u=>{
          const myOpps = oppsData.filter(o=>o.assigned_to===u.id);
          const myActs = activities.filter(a=>a.user_id===u.id);
          const won = myOpps.filter(o=>o.stage==="Closed Won");
          const lost = myOpps.filter(o=>o.stage==="Closed Lost");
          const active = myOpps.filter(o=>!["Closed Won","Closed Lost"].includes(o.stage));
          const pipeline = active.reduce((s,o)=>s+(o.budget||0),0);
          const wonVal = won.reduce((s,o)=>s+(o.final_price||o.budget||0),0);
          const conv = myOpps.length>0?Math.round(won.length/myOpps.length*100):0;
          return [u.full_name,u.role,myActs.length,myOpps.length,active.length,won.length,lost.length,
            conv+"%",`AED ${(pipeline/1e6).toFixed(2)}M`,`AED ${(wonVal/1e6).toFixed(2)}M`];
        });
        return {
          headers:["Agent","Role","Tasks","Total Deals","Active","Won","Lost","Conv %","Pipeline","Won Value"],
          rows, summary:[], summaryHeaders:[],
          title:"Agent Performance Report",
        };
      }
    },

    // 6. LEAD CONVERSION
    lead_conversion: {
      label:"Lead Conversion", icon:"🎯",
      description:"Lead sources and conversion funnel",
      generate: () => {
        const { leads=[] } = data;
        const oppsData = globalOpps.length>0 ? globalOpps : (data.opps||[]);
        const sources = [...new Set(leads.map(l=>l.source||"Unknown"))];
        const summaryRows = sources.map(s=>{
          const sl=leads.filter(l=>(l.source||"Unknown")===s);
          const won=sl.filter(l=>oppsData.some(o=>o.lead_id===l.id&&o.stage==="Closed Won"));
          const withOpps=sl.filter(l=>oppsData.some(o=>o.lead_id===l.id));
          return [s,sl.length,withOpps.length,won.length,sl.length>0?Math.round(won.length/sl.length*100)+"%":"0%"];
        });
        const rows = leads.map(l=>{
          const lo=oppsData.filter(o=>o.lead_id===l.id);
          const best=lo.find(o=>o.stage==="Closed Won")?"Closed Won":lo[0]?.stage||"No Opp";
          return [l.name,l.phone||"—",l.source||"—",l.property_type||"—",l.stage||"New",best,lo.length,fmtD(l.created_at)];
        });
        return {
          headers:["Contact","Phone","Source","Type","Lead Stage","Best Opp","Opps","Created"],
          rows, summary:summaryRows,
          summaryHeaders:["Source","Total Leads","With Opps","Won","Conversion"],
          title:"Lead Conversion Report",
        };
      }
    },

    // 7. TASKS REPORT
    tasks_report: {
      label:"Tasks Report", icon:"✅",
      description:"All tasks by type, status and agent",
      generate: () => {
        const { activities=[] } = data;
        const upcoming=activities.filter(a=>a.status==="upcoming");
        const completed=activities.filter(a=>a.status==="completed"||(!a.status&&!a.scheduled_at));
        const noShow=activities.filter(a=>a.status==="no_show");
        const rescheduled=activities.filter(a=>a.status==="rescheduled");
        const cancelled=activities.filter(a=>a.status==="cancelled");
        const rows=activities.map(a=>[
          a.type,a.lead_name||"—",a.user_name||"—",
          a.status||"completed",
          a.scheduled_at?fmtD(a.scheduled_at):"—",
          fmtD(a.created_at),
          (a.note||"").slice(0,60)+(a.note&&a.note.length>60?"…":""),
        ]);
        const summary=[
          ["⏰ Upcoming",upcoming.length],
          ["✅ Completed",completed.length],
          ["📵 No Show",noShow.length],
          ["🔄 Rescheduled",rescheduled.length],
          ["❌ Cancelled",cancelled.length],
          ["📊 Total",activities.length],
        ];
        return {
          headers:["Type","Contact","Agent","Status","Scheduled","Created","Notes"],
          rows, summary, summaryHeaders:["Status","Count"],
          title:"Tasks & Activities Report",
        };
      }
    },
  };

  const currentReport = REPORTS[activeReport];
  const reportData    = !loading && Object.keys(data).length > 0 ? currentReport?.generate() : null;

  const handleExportExcel = () => {
    if(!reportData) return;
    exportToExcel(reportData.rows, reportData.headers, currentReport.label.replace(/\s+/g,"_")+"_"+new Date().toISOString().slice(0,10));
    showToast("Excel exported — check your Downloads","success");
  };

  const handleExportPDF = () => {
    if(!reportData) return;
    exportToPDF(currentReport.label, currentReport.description, reportData.headers, reportData.rows, currentReport.label.replace(/\s+/g,"_"));
    showToast("PDF opening — use Print to save as PDF","success");
  };

  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>

      {/* Report selector */}
      <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap",overflowX:"auto",paddingBottom:4}}>
        {Object.entries(REPORTS).filter(([key])=>crmContext==="leasing"?["rent_roll","pdc_schedule","tasks_report","agent_performance"].includes(key):["pipeline","sales_payments","agent_performance","lead_conversion","tasks_report"].includes(key)).map(([key,r])=>(
          <button key={key} onClick={()=>setActiveReport(key)}
            style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid ${activeReport===key?"#0F2540":"#E2E8F0"}`,background:activeReport===key?"#0F2540":"#fff",color:activeReport===key?"#fff":"#4A5568",fontSize:11,fontWeight:activeReport===key,whiteSpace:"nowrap"?700:400,cursor:"pointer",display:"flex",alignItems:"center",gap:5,transition:"all .15s"}}>
            <span>{r.icon}</span> {r.label}
          </button>
        ))}
      </div>

      {/* Report header */}
      <div style={{background:"#0F2540",borderRadius:12,padding:"14px 18px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#fff"}}>{currentReport?.icon} {currentReport?.label}</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,.5)",marginTop:2}}>{currentReport?.description}</div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={handleExportExcel} disabled={loading||!reportData}
            style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#1A7F5A",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,opacity:loading||!reportData?.rows?.length?.toString()?0.5:1}}>
            📊 Export Excel
          </button>
          <button onClick={handleExportPDF} disabled={loading||!reportData}
            style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#C9A84C",color:"#0F2540",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,opacity:loading||!reportData?.rows?.length?.toString()?0.5:1}}>
            📄 Export PDF
          </button>
          <button onClick={loadData}
            style={{padding:"8px 12px",borderRadius:8,border:"1.5px solid rgba(255,255,255,.2)",background:"transparent",color:"rgba(255,255,255,.6)",fontSize:12,cursor:"pointer"}}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {loading && <Spinner msg="Loading report data…"/>}

      {!loading && reportData && (
        <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",gap:12}}>

          {/* Summary cards */}
          {reportData.summary?.length>0&&(
            <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px",marginBottom:10}}>Summary</div>
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",fontSize:12,width:"100%"}}>
                  <thead>
                    <tr style={{background:"#F7F9FC"}}>
                      {reportData.summaryHeaders.map(h=><th key={h} style={{padding:"6px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:"#4A5568",textTransform:"uppercase",letterSpacing:".4px",whiteSpace:"nowrap"}}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.summary.map((row,i)=>(
                      <tr key={i} style={{borderBottom:"1px solid #F0F2F5"}}>
                        {row.map((cell,j)=><td key={j} style={{padding:"7px 12px",fontSize:12,color:String(cell).includes("⚠")?"#B83232":"#0F2540",fontWeight:j===0?600:400}}>{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Data table */}
          <div style={{flex:1,overflowY:"auto",overflowX:"auto",background:"#fff",border:"1px solid #E2E8F0",borderRadius:12}}>
            <div style={{padding:"10px 16px",borderBottom:"1px solid #F0F2F5",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,fontWeight:600,color:"#0F2540"}}>{reportData.rows.length} records</span>
              <span style={{fontSize:11,color:"#A0AEC0"}}>Generated {new Date().toLocaleString("en-AE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead style={{position:"sticky",top:0,zIndex:1}}>
                <tr style={{background:"#0F2540"}}>
                  <th style={{padding:"8px 10px",textAlign:"left",fontSize:9,fontWeight:600,color:"#C9A84C",textTransform:"uppercase",letterSpacing:".4px",whiteSpace:"nowrap"}}>#</th>
                  {reportData.headers.map(h=>(
                    <th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:9,fontWeight:600,color:"#C9A84C",textTransform:"uppercase",letterSpacing:".4px",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.rows.length===0&&(
                  <tr><td colSpan={reportData.headers.length+1} style={{padding:"2rem",textAlign:"center",color:"#A0AEC0"}}>No data for this report</td></tr>
                )}
                {reportData.rows.map((row,i)=>(
                  <tr key={i} style={{background:i%2===0?"#fff":"#FAFBFC",borderBottom:"1px solid #F0F2F5"}}
                    onMouseOver={e=>e.currentTarget.style.background="#F0F7FF"}
                    onMouseOut={e=>e.currentTarget.style.background=i%2===0?"#fff":"#FAFBFC"}>
                    <td style={{padding:"5px 10px",fontSize:10,color:"#A0AEC0",fontWeight:600}}>{i+1}</td>
                    {row.map((cell,j)=>(
                      <td key={j} style={{padding:"5px 10px",color:String(cell||"").includes("⚠")?"#B83232":String(cell||"").includes("AED")?"#0F2540":"#4A5568",fontWeight:String(cell||"").includes("AED")?700:400,whiteSpace:"nowrap",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis"}}>
                        {cell===null||cell===undefined?"—":cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


export default ReportsModule;

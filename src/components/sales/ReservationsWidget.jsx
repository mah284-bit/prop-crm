import React, { useState, useEffect } from 'react';
import { supabase } from "../../lib/supabase.js";
import { Btn } from "../../modules/shared/Btn.jsx";
import { Badge } from "../../modules/shared/Badge.jsx";
import { Spinner } from "../../modules/shared/Spinner.jsx";

function ReservationsWidget({ currentUser, units=[], onManage }) {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.from("reservations")
        .select("*").in("status", ["Active","Extended"]).order("expires_at");
      setReservations(data || []);
    } catch(e) { setReservations([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  const expiredCount  = reservations.filter(r => hoursLeft(r.expires_at, r.extended_until) <= 0).length;
  const criticalCount = reservations.filter(r => { const h=hoursLeft(r.expires_at,r.extended_until); return h>0&&h<=12; }).length;
  const activeCount   = reservations.filter(r => hoursLeft(r.expires_at, r.extended_until) > 12).length;

  if (loading) return null;
  if (reservations.length === 0) return (
    <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
      <div style={{fontSize:11,fontWeight:700,color:"#A0AEC0",textTransform:"uppercase",letterSpacing:".6px",marginBottom:8}}>🔒 Active Reservations</div>
      <div style={{textAlign:"center",padding:"12px",color:"#A0AEC0",fontSize:12}}>No active reservations</div>
    </div>
  );

  return (
    <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,overflow:"hidden"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderBottom:"1px solid #F0F2F5"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>🔒 Active Reservations</span>
          <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:"#E6F4EE",color:"#1A7F5A"}}>{reservations.length}</span>
        </div>
        <div style={{display:"flex",gap:6}}>
          {expiredCount>0&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"#FAEAEA",color:"#B83232"}}>⚠ {expiredCount} expired</span>}
          {criticalCount>0&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,background:"#FDF3DC",color:"#A06810"}}>🔴 {criticalCount} critical</span>}
        </div>
      </div>
      {/* List */}
      {reservations.map(res => {
        const unit = units.find(u => u.id === res.unit_id);
        const urg  = reservationUrgency(res);
        const col  = RES_COLORS[urg];
        const hrs  = hoursLeft(res.expires_at, res.extended_until);
        return (
          <div key={res.id}
            onClick={() => onManage && onManage(res, unit)}
            style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:"1px solid #F7F9FC",cursor:"pointer",borderLeft:`3px solid ${col.c}`,transition:"background .1s"}}
            onMouseOver={e=>e.currentTarget.style.background="#F7F9FC"}
            onMouseOut={e=>e.currentTarget.style.background="#fff"}>
            {/* Timer */}
            <div style={{textAlign:"center",flexShrink:0,width:44}}>
              <div style={{fontSize:18,fontWeight:700,color:col.c,lineHeight:1}}>{hrs <= 0 ? "!" : hrs < 100 ? hrs : "48+"}</div>
              <div style={{fontSize:8,color:col.c,fontWeight:600,textTransform:"uppercase"}}>{hrs<=0?"EXPIRED":"HRS"}</div>
            </div>
            {/* Info */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:12,color:"#0F2540",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{res.client_name}</div>
              <div style={{fontSize:11,color:"#718096"}}>{unit?.unit_ref||"Unit"} · {res.reservation_type} · AED {Number(res.reservation_fee).toLocaleString()}</div>
            </div>
            {/* Payment method */}
            <div style={{flexShrink:0,textAlign:"right"}}>
              <div style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:20,background:col.bg,color:col.c}}>{res.fee_payment_method}</div>
              <div style={{fontSize:10,color:"#A0AEC0",marginTop:2}}>{new Date(res.extended_until||res.expires_at).toLocaleDateString("en-AE",{day:"numeric",month:"short"})}</div>
            </div>
          </div>
        );
      })}
      {/* Footer */}
      <div style={{padding:"8px 16px",background:"#FAFBFC",fontSize:11,color:"#A0AEC0",textAlign:"center"}}>
        Click any reservation to confirm or release
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════
// INVENTORY MODULE — Flat unit list with top filters
// No left panel. Compact rows. Full unit detail modal.
// ══════════════════════════════════════════════════════════════════

const UNIT_STATUS_COLORS = {
  Available:  {c:"#1A7F5A", bg:"#E6F4EE"},
  Reserved:   {c:"#A06810", bg:"#FDF3DC"},
  "Under Offer":{c:"#5B3FAA",bg:"#EEE8F9"},
  Sold:       {c:"#1A5FA8", bg:"#E6EFF9"},
  Leased:     {c:"#1A5FA8", bg:"#E6EFF9"},
  Cancelled:  {c:"#718096", bg:"#F7F9FC"},
};


// ── SPLIT COMPONENTS ──────────────────────────────────────────
import InventoryModule from "./components/InventoryModule.jsx";
import LeasingModule from "./components/LeasingModule.jsx";
import ReportsModule from "./components/ReportsModule.jsx";
import MasterAgreements from "./components/MasterAgreements.jsx";
import CommissionOutstanding from "./components/CommissionOutstanding.jsx";
import LeaseOpportunityDetail from "./components/LeaseOpportunityDetail.jsx";
import LeasingLeads from "./components/LeasingLeads.jsx";
import UnitSearchPicker from "./components/UnitSearchPicker.jsx";
import UnitPickerRich from "./components/UnitPickerRich.jsx";
import PropPulse from "./components/PropPulse.jsx";
import PropertyPackModal from "./components/property/PropertyPackModal.jsx";
import { openPropertyPack } from "./components/property/propertyPackBus";
import LeadCreationFormV2 from "./components/LeadCreationFormV2.jsx";  // Phase A.3 — new buyer-type-aware form (side-by-side with old form)
import LeadPeopleSection from "./components/LeadPeopleSection.jsx";  // Phase 2.2B — Contacts Subsystem read-only display
import { useLeadPersons, ROLE_LABELS } from "./lib/useLeadPersons.js";  // Day 18 — person-tagged activity logging
import { rulesFromRows } from "./lib/contactValidation.js";  // Phase 2.2A — convert ref_buyer_type_rules rows to {type: {field: req}}
// ──────────────────────────────────────────────────────────────




export default ReservationsWidget;

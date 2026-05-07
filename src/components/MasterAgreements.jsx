import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

/**
 * Master Developer Agreements Module - Stage 1 of 6-stage broker workflow.
 *
 * v1.0 (Day 2 skeleton): Placeholder page only.
 * v1.1 (Day 3): List view with filters and search.
 * v1.2 (Day 4): Create/Edit form with all sections.
 * v1.3 (Day 5): Document upload via Supabase Storage.
 * v1.4 (Day 6): Detail view + audit trail.
 * v1.5 (Day 7): Stage 2 integration - auto-populate commission on Opportunity create.
 *
 * Spec: docs/Stage_1_Master_Agreement_Build_Spec.md
 */
export default function MasterAgreements({ currentUser, showToast }) {
  const [view, setView] = useState("list");
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(false);

  const isAdmin = currentUser?.role === "super_admin" || currentUser?.role === "admin";

  if (!isAdmin) {
    return (
      <div style={{padding:"40px 24px", textAlign:"center"}}>
        <div style={{fontSize:48, marginBottom:16}}>{"\ud83d\udd12"}</div>
        <h2 style={{color:"#1E2D3F", marginBottom:8}}>Admin Access Required</h2>
        <p style={{color:"#6B7280"}}>Master Developer Agreements are managed by admin users only.</p>
      </div>
    );
  }

  return (
    <div style={{padding:"24px"}}>
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24}}>
        <div>
          <h1 style={{margin:0, color:"#0F2540", fontSize:28, fontWeight:700}}>
            Master Developer Agreements
          </h1>
          <p style={{margin:"4px 0 0 0", color:"#6B7280", fontSize:14}}>
            Stage 1 - Foundation for every broker-developer relationship
          </p>
        </div>
        <button
          style={{
            padding:"10px 20px",
            borderRadius:8,
            border:"none",
            background:"#B8924A",
            color:"#fff",
            fontSize:14,
            fontWeight:600,
            cursor:"pointer"
          }}
          onClick={() => showToast?.("New Agreement form coming on Day 4", "info")}
        >
          + New Agreement
        </button>
      </div>

      <div style={{
        background:"#FAFAFA",
        border:"2px dashed #E5E7EB",
        borderRadius:12,
        padding:"60px 24px",
        textAlign:"center"
      }}>
        <div style={{fontSize:64, marginBottom:16, opacity:0.5}}>{"\ud83d\udccb"}</div>
        <h3 style={{color:"#1E2D3F", marginBottom:8}}>Module Under Construction</h3>
        <p style={{color:"#6B7280", maxWidth:520, margin:"0 auto", lineHeight:1.6}}>
          This is the Master Agreements module skeleton (Day 2 of 10).
          List view with filters ships Day 3.
          Create/Edit form ships Day 4.
          Document upload ships Day 5.
          Stage 2 integration (auto-populate commission on Opportunity creation) ships Day 7.
        </p>
        <div style={{
          display:"inline-block",
          marginTop:24,
          padding:"8px 16px",
          background:"#16A34A",
          color:"#fff",
          borderRadius:20,
          fontSize:12,
          fontWeight:600,
          letterSpacing:1
        }}>
          DATABASE FOUNDATION DEPLOYED
        </div>
      </div>

      <div style={{
        marginTop:24,
        padding:"16px 20px",
        background:"#F0F4FA",
        borderRadius:8,
        border:"1px solid #DBE4F0",
        fontSize:13,
        color:"#1E2D3F"
      }}>
        <strong>For investors:</strong> Schema deployed to production at commit c538210 (09 May 2026).
        Table: pp_master_agreements (27 columns, multi-tenant via RLS, foreign keys to companies + pp_developers).
        Linked to pp_commissions via master_agreement_id for project-level overrides.
      </div>
    </div>
  );
}

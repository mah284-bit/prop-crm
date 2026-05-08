import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";

/**
 * Master Developer Agreements Module - Stage 1 of 6-stage broker workflow.
 *
 * v1.0 (Day 2): Skeleton placeholder.
 * v1.1 (Day 3): List view with filters and search.   <-- CURRENT VERSION
 * v1.2 (Day 4): Create/Edit form with all sections.
 * v1.3 (Day 5): Document upload via Supabase Storage.
 * v1.4 (Day 6): Detail view + audit trail.
 * v1.5 (Day 7): Stage 2 integration - auto-populate commission on Opportunity create.
 *
 * Spec: docs/Stage_1_Master_Agreement_Build_Spec.md
 */
export default function MasterAgreements({ currentUser, showToast }) {
  // Permission gate
  const isAdmin = currentUser?.role === "super_admin" || currentUser?.role === "admin";

  // Data state
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [developerFilter, setDeveloperFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Load agreements on mount
  useEffect(() => {
    if (!isAdmin) return;
    loadAgreements();
  }, [isAdmin, currentUser?.company_id]);

  async function loadAgreements() {
    try {
      setLoading(true);
      setError(null);
      const { data, error: dbError } = await supabase
        .from("pp_master_agreements")
        .select("*")
        .eq("company_id", currentUser.company_id)
        .order("created_at", { ascending: false });

      if (dbError) throw dbError;
      setAgreements(data || []);
    } catch (err) {
      console.error("Failed to load master agreements:", err);
      setError(err.message || "Failed to load agreements");
    } finally {
      setLoading(false);
    }
  }

  // Get unique developers for filter dropdown
  const uniqueDevelopers = useMemo(() => {
    const set = new Set(agreements.map(a => a.developer_name).filter(Boolean));
    return Array.from(set).sort();
  }, [agreements]);

  // Apply all filters
  const filteredAgreements = useMemo(() => {
    return agreements.filter(a => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (a.agreement_title || "").toLowerCase().includes(q);
        const matchDev = (a.developer_name || "").toLowerCase().includes(q);
        const matchRef = (a.agreement_reference || "").toLowerCase().includes(q);
        if (!matchTitle && !matchDev && !matchRef) return false;
      }

      // Developer filter
      if (developerFilter !== "all" && a.developer_name !== developerFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== "all" && a.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [agreements, searchQuery, developerFilter, statusFilter]);

  // Helpers
  const fmtDate = (dateStr) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
    } catch { return dateStr; }
  };

  const fmtPct = (pct) => {
    if (pct == null) return "-";
    return `${Number(pct).toFixed(2)}%`;
  };

  const statusBadge = (status) => {
    const colors = {
      active:     { bg:"#DCFCE7", fg:"#166534", border:"#86EFAC" },
      draft:      { bg:"#FEF3C7", fg:"#92400E", border:"#FCD34D" },
      expired:    { bg:"#FEE2E2", fg:"#991B1B", border:"#FCA5A5" },
      terminated: { bg:"#F3F4F6", fg:"#4B5563", border:"#D1D5DB" }
    };
    const c = colors[status] || colors.draft;
    return (
      <span style={{
        display:"inline-block",
        padding:"3px 10px",
        background:c.bg,
        color:c.fg,
        border:`1px solid ${c.border}`,
        borderRadius:12,
        fontSize:11,
        fontWeight:600,
        textTransform:"uppercase",
        letterSpacing:0.3
      }}>{status}</span>
    );
  };

  // Permission gate UI
  if (!isAdmin) {
    return (
      <div style={{padding:"40px 24px", textAlign:"center"}}>
        <div style={{fontSize:48, marginBottom:16}}>🔒</div>
        <h2 style={{color:"#1E2D3F", marginBottom:8, fontFamily:"'Inter', sans-serif"}}>Admin Access Required</h2>
        <p style={{color:"#6B7280", fontFamily:"'Inter', sans-serif"}}>Master Developer Agreements are managed by admin users only.</p>
      </div>
    );
  }

  return (
    <div style={{padding:"24px", fontFamily:"'Inter', sans-serif"}}>
      {/* Header */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20}}>
        <div>
          <div style={{display:"flex", alignItems:"center", gap:12, marginBottom:4}}>
            <h1 style={{margin:0, color:"#0F2540", fontSize:26, fontWeight:700, letterSpacing:"-0.3px"}}>
              Master Developer Agreements
            </h1>
            {!loading && (
              <span style={{
                background:"#F0F4FA",
                color:"#1E2D3F",
                padding:"4px 12px",
                borderRadius:14,
                fontSize:13,
                fontWeight:600
              }}>{agreements.length}</span>
            )}
          </div>
          <p style={{margin:0, color:"#6B7280", fontSize:13}}>
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
            fontSize:13,
            fontWeight:600,
            cursor:"pointer",
            letterSpacing:0.2
          }}
          onClick={() => showToast?.("New Agreement form ships Day 4 — coming next!", "info")}
        >
          + New Agreement
        </button>
      </div>

      {/* Filter bar */}
      <div style={{
        display:"flex",
        gap:12,
        marginBottom:16,
        padding:"12px 16px",
        background:"#FAFBFC",
        border:"1px solid #E5E7EB",
        borderRadius:8
      }}>
        {/* Search */}
        <div style={{flex:1, minWidth:200}}>
          <input
            type="text"
            placeholder="🔍 Search by developer, title, or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width:"100%",
              padding:"8px 12px",
              border:"1px solid #D1D5DB",
              borderRadius:6,
              fontSize:13,
              fontFamily:"'Inter', sans-serif",
              outline:"none",
              background:"#fff"
            }}
          />
        </div>

        {/* Developer filter */}
        <select
          value={developerFilter}
          onChange={(e) => setDeveloperFilter(e.target.value)}
          style={{
            padding:"8px 12px",
            border:"1px solid #D1D5DB",
            borderRadius:6,
            fontSize:13,
            fontFamily:"'Inter', sans-serif",
            outline:"none",
            background:"#fff",
            cursor:"pointer",
            minWidth:160
          }}
        >
          <option value="all">All Developers</option>
          {uniqueDevelopers.map(dev => (
            <option key={dev} value={dev}>{dev}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding:"8px 12px",
            border:"1px solid #D1D5DB",
            borderRadius:6,
            fontSize:13,
            fontFamily:"'Inter', sans-serif",
            outline:"none",
            background:"#fff",
            cursor:"pointer",
            minWidth:140
          }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="expired">Expired</option>
          <option value="terminated">Terminated</option>
        </select>

        {/* Filter result count */}
        {!loading && (searchQuery || developerFilter !== "all" || statusFilter !== "all") && (
          <div style={{
            display:"flex",
            alignItems:"center",
            padding:"0 12px",
            color:"#6B7280",
            fontSize:12,
            whiteSpace:"nowrap"
          }}>
            {filteredAgreements.length} of {agreements.length}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{
          padding:"60px 24px",
          textAlign:"center",
          color:"#6B7280",
          background:"#FAFAFA",
          border:"1px solid #E5E7EB",
          borderRadius:8
        }}>
          <div style={{fontSize:32, marginBottom:12, opacity:0.5}}>⏳</div>
          <p>Loading agreements...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div style={{
          padding:"24px",
          background:"#FEE2E2",
          border:"1px solid #FCA5A5",
          borderRadius:8,
          color:"#991B1B"
        }}>
          <strong>Error loading agreements:</strong> {error}
          <div style={{marginTop:8}}>
            <button
              onClick={loadAgreements}
              style={{
                padding:"6px 14px",
                background:"#fff",
                border:"1px solid #FCA5A5",
                borderRadius:6,
                color:"#991B1B",
                fontSize:12,
                fontWeight:600,
                cursor:"pointer"
              }}
            >Retry</button>
          </div>
        </div>
      )}

      {/* Empty state - no agreements at all */}
      {!loading && !error && agreements.length === 0 && (
        <div style={{
          background:"#FAFAFA",
          border:"2px dashed #E5E7EB",
          borderRadius:12,
          padding:"60px 24px",
          textAlign:"center"
        }}>
          <div style={{fontSize:64, marginBottom:16, opacity:0.5}}>📋</div>
          <h3 style={{color:"#1E2D3F", marginBottom:8, fontWeight:600}}>No master agreements yet</h3>
          <p style={{color:"#6B7280", maxWidth:480, margin:"0 auto 24px auto", lineHeight:1.6}}>
            Add your first developer agreement to begin tracking commercial relationships.
            This becomes the default reference for every deal you handle with that developer.
          </p>
          <button
            style={{
              padding:"10px 24px",
              borderRadius:8,
              border:"none",
              background:"#B8924A",
              color:"#fff",
              fontSize:13,
              fontWeight:600,
              cursor:"pointer"
            }}
            onClick={() => showToast?.("New Agreement form ships Day 4 — coming next!", "info")}
          >
            + Add Your First Agreement
          </button>
        </div>
      )}

      {/* Empty filter results */}
      {!loading && !error && agreements.length > 0 && filteredAgreements.length === 0 && (
        <div style={{
          background:"#FAFAFA",
          border:"1px solid #E5E7EB",
          borderRadius:8,
          padding:"40px 24px",
          textAlign:"center",
          color:"#6B7280"
        }}>
          <div style={{fontSize:32, marginBottom:8, opacity:0.5}}>🔍</div>
          <p style={{marginBottom:12}}>No agreements match your filters.</p>
          <button
            onClick={() => { setSearchQuery(""); setDeveloperFilter("all"); setStatusFilter("all"); }}
            style={{
              padding:"6px 14px",
              background:"#fff",
              border:"1px solid #D1D5DB",
              borderRadius:6,
              fontSize:12,
              fontWeight:600,
              cursor:"pointer",
              color:"#1E2D3F"
            }}
          >Clear Filters</button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && filteredAgreements.length > 0 && (
        <div style={{
          background:"#fff",
          border:"1px solid #E5E7EB",
          borderRadius:8,
          overflow:"hidden"
        }}>
          <table style={{width:"100%", borderCollapse:"collapse", fontSize:13}}>
            <thead>
              <tr style={{background:"#F9FAFB", borderBottom:"1px solid #E5E7EB"}}>
                <th style={thStyle}>Developer</th>
                <th style={thStyle}>Agreement Title</th>
                <th style={{...thStyle, textAlign:"right"}}>Default %</th>
                <th style={thStyle}>Validity</th>
                <th style={thStyle}>Status</th>
                <th style={{...thStyle, textAlign:"center", width:80}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgreements.map(a => (
                <tr
                  key={a.id}
                  style={{
                    borderBottom:"1px solid #F3F4F6",
                    cursor:"pointer",
                    transition:"background 0.1s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#FAFBFC"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
                  onClick={() => showToast?.("Detail view ships Day 6 — coming next!", "info")}
                >
                  <td style={tdStyle}>
                    <div style={{fontWeight:600, color:"#0F2540"}}>{a.developer_name || "-"}</div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{fontWeight:500}}>{a.agreement_title || "-"}</div>
                    {a.agreement_reference && (
                      <div style={{fontSize:11, color:"#9CA3AF", marginTop:2}}>{a.agreement_reference}</div>
                    )}
                  </td>
                  <td style={{...tdStyle, textAlign:"right", fontVariantNumeric:"tabular-nums"}}>
                    <div style={{fontWeight:600, color:"#0F2540"}}>{fmtPct(a.default_commission_pct)}</div>
                    {a.bonus_commission_pct && (
                      <div style={{fontSize:11, color:"#16A34A", marginTop:2}}>+{fmtPct(a.bonus_commission_pct)} bonus</div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{fontSize:12, color:"#4B5563"}}>
                      {fmtDate(a.valid_from)} → {fmtDate(a.valid_until)}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    {statusBadge(a.status)}
                  </td>
                  <td style={{...tdStyle, textAlign:"center"}}>
                    <button
                      style={{
                        padding:"4px 10px",
                        background:"transparent",
                        border:"1px solid #D1D5DB",
                        borderRadius:6,
                        fontSize:11,
                        fontWeight:600,
                        cursor:"pointer",
                        color:"#1E2D3F"
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        showToast?.("Edit form ships Day 4 — coming next!", "info");
                      }}
                    >View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer info */}
      {!loading && (
        <div style={{
          marginTop:16,
          padding:"12px 16px",
          background:"#F0F4FA",
          borderRadius:6,
          border:"1px solid #DBE4F0",
          fontSize:12,
          color:"#1E2D3F",
          display:"flex",
          alignItems:"center",
          gap:8
        }}>
          <span style={{
            background:"#16A34A",
            color:"#fff",
            padding:"2px 8px",
            borderRadius:10,
            fontSize:10,
            fontWeight:700,
            letterSpacing:0.5
          }}>DAY 3 OF 10</span>
          <span style={{color:"#6B7280"}}>
            List view shipped. Day 4: Create/Edit form. Day 5: Document upload. Day 7: Auto-populate commission on new Opportunities.
          </span>
        </div>
      )}
    </div>
  );
}

// Reusable cell styles
const thStyle = {
  padding:"10px 16px",
  textAlign:"left",
  fontSize:11,
  fontWeight:600,
  color:"#6B7280",
  textTransform:"uppercase",
  letterSpacing:0.4,
  borderBottom:"1px solid #E5E7EB"
};

const tdStyle = {
  padding:"12px 16px",
  color:"#1E2D3F",
  verticalAlign:"middle"
};

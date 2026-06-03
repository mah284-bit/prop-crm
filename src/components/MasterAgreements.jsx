import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase";

/**
 * Master Developer Agreements Module - Stage 1 of 6-stage broker workflow.
 *
 * v1.0 (Day 2): Skeleton placeholder.
 * v1.1 (Day 3): List view with filters and search.
 * v1.2 (Day 4): Create/Edit form with all 6 sections + validation + save logic.   <-- CURRENT VERSION
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
  const [developers, setDevelopers] = useState([]);
  const [usageCounts, setUsageCounts] = useState({}); // { agreement_id: count }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [developerFilter, setDeveloperFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Form modal state
  const [showForm, setShowForm] = useState(false);
  const [editingAgreement, setEditingAgreement] = useState(null);

  useEffect(() => {
    if (!isAdmin) return;
    loadAgreements();
    loadDevelopers();
    loadUsageCounts();
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

  async function loadDevelopers() {
    try {
      const { data, error: dbError } = await supabase
        .from("pp_developers")
        .select("id, name")
        .order("name", { ascending: true });
      if (dbError) throw dbError;
      setDevelopers(data || []);
    } catch (err) {
      console.error("Failed to load developers:", err);
    }
  }

  // Count how many opportunities reference each master agreement
  async function loadUsageCounts() {
    try {
      const { data, error: dbError } = await supabase
        .from("opportunities")
        .select("master_agreement_id")
        .eq("company_id", currentUser.company_id)
        .not("master_agreement_id", "is", null);
      if (dbError) throw dbError;
      const counts = {};
      (data || []).forEach(row => {
        if (row.master_agreement_id) {
          counts[row.master_agreement_id] = (counts[row.master_agreement_id] || 0) + 1;
        }
      });
      setUsageCounts(counts);
    } catch (err) {
      console.error("Failed to load usage counts:", err);
    }
  }

  function openCreateForm() {
    setEditingAgreement(null);
    setShowForm(true);
  }

  function openEditForm(agreement) {
    setEditingAgreement(agreement);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingAgreement(null);
  }

  function handleSaved() {
    closeForm();
    loadAgreements();
  }

  const uniqueDevelopers = useMemo(() => {
    const set = new Set(agreements.map(a => a.developer_name).filter(Boolean));
    return Array.from(set).sort();
  }, [agreements]);

  const filteredAgreements = useMemo(() => {
    return agreements.filter(a => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (a.agreement_title || "").toLowerCase().includes(q);
        const matchDev = (a.developer_name || "").toLowerCase().includes(q);
        const matchRef = (a.agreement_reference || "").toLowerCase().includes(q);
        if (!matchTitle && !matchDev && !matchRef) return false;
      }
      if (developerFilter !== "all" && a.developer_name !== developerFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    });
  }, [agreements, searchQuery, developerFilter, statusFilter]);

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
          onClick={openCreateForm}
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
            onClick={openCreateForm}
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
                <th style={{...thStyle, textAlign:"center", width:80}}>Used In</th>
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
                  onClick={() => openEditForm(a)}
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
                    {(usageCounts[a.id] || 0) > 0 ? (
                      <span style={{
                        display:"inline-block",
                        padding:"3px 10px",
                        background:"#DBEAFE",
                        color:"#0369A1",
                        border:"1px solid #BAE6FD",
                        borderRadius:12,
                        fontSize:11,
                        fontWeight:700
                      }}>{usageCounts[a.id]}</span>
                    ) : (
                      <span style={{color:"#9CA3AF", fontSize:11}}>—</span>
                    )}
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
                        openEditForm(a);
                      }}
                    >Edit</button>
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
          {/* DAY 8 OF 10 sprint badge removed for demo (internal scaffolding) */}
          <span style={{color:"#6B7280"}}>
            AI document validation LIVE. Click "Validate with AI" on any uploaded agreement.
          </span>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <AgreementFormModal
          agreement={editingAgreement}
          developers={developers}
          currentUser={currentUser}
          agreementUsageCount={editingAgreement ? (usageCounts[editingAgreement.id] || 0) : 0}
          onClose={closeForm}
          onSaved={handleSaved}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// =============================================================================
// FORM MODAL
// =============================================================================

function AgreementFormModal({ agreement, developers, currentUser, agreementUsageCount = 0, onClose, onSaved, showToast }) {
  const isEdit = !!agreement;

  // Helper: format date with relative time hint (e.g. "15 Jan 2026 (3 days ago)")
  function fmtDateLong(dateStr) {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      const datePart = d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
      const ms = Date.now() - d.getTime();
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      let rel;
      if (days === 0) rel = "today";
      else if (days === 1) rel = "1 day ago";
      else if (days < 30) rel = `${days} days ago`;
      else if (days < 365) rel = `${Math.floor(days / 30)} mo ago`;
      else rel = `${Math.floor(days / 365)}y ago`;
      return `${datePart} (${rel})`;
    } catch { return dateStr; }
  }

  const [form, setForm] = useState({
    developer_id: agreement?.developer_id || "",
    developer_name: agreement?.developer_name || "",
    agreement_title: agreement?.agreement_title || "",
    agreement_reference: agreement?.agreement_reference || "",
    default_commission_pct: agreement?.default_commission_pct != null ? String(agreement.default_commission_pct) : "",
    bonus_commission_pct: agreement?.bonus_commission_pct != null ? String(agreement.bonus_commission_pct) : "",
    bonus_threshold: agreement?.bonus_threshold || "",
    payment_terms: agreement?.payment_terms || "",
    payment_trigger: agreement?.payment_trigger || "",
    payment_days: agreement?.payment_days != null ? String(agreement.payment_days) : "",
    discount_authority_pct: agreement?.discount_authority_pct != null ? String(agreement.discount_authority_pct) : "",
    discount_requires_approval_above: agreement?.discount_requires_approval_above != null ? String(agreement.discount_requires_approval_above) : "",
    valid_from: agreement?.valid_from || "",
    valid_until: agreement?.valid_until || "",
    signed_by: agreement?.signed_by || "",
    signed_date: agreement?.signed_date || "",
    signed_on_behalf_of: agreement?.signed_on_behalf_of || "",
    status: agreement?.status || "draft",
    notes: agreement?.notes || "",
    agreement_document_path: agreement?.agreement_document_path || null,
    agreement_document_filename: agreement?.agreement_document_filename || null,
    validation_result: agreement?.validation_result || null
  });

  // AI validation state
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Upload handler
  async function handleFileUpload(file) {
    if (!file) return;

    setUploadError(null);

    // Validate file type
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      setUploadError("Only PDF, JPG, or PNG files allowed");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File too large (max 10MB)");
      return;
    }

    try {
      setUploading(true);
      const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      // Use existing agreement ID if editing, or 'new' placeholder for create
      const folder = agreement?.id || "new";
      const path = `master-agreements/${currentUser.company_id}/${folder}/${Date.now()}_${safeName}`;

      // Upload to private 'documents' bucket
      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      // Store the storage PATH (not a URL).
      // Signed URLs are generated on-demand when user clicks View.
      setForm(prev => ({
        ...prev,
        agreement_document_path: path,
        agreement_document_filename: file.name
      }));
      showToast?.(`Uploaded: ${file.name}`, "success");
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadError(err.message || "Upload failed");
      showToast?.(`Upload failed: ${err.message || "unknown"}`, "error");
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveDocument() {
    setForm(prev => ({
      ...prev,
      agreement_document_path: null,
      agreement_document_filename: null
    }));
    setUploadError(null);
    showToast?.("Document removed - save to confirm", "info");
  }

  // Generate a fresh signed URL and open the document
  async function handleViewDocument() {
    if (!form.agreement_document_path) return;
    try {
      const { data, error: signErr } = await supabase.storage
        .from("documents")
        .createSignedUrl(form.agreement_document_path, 3600);
      if (signErr) throw signErr;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error("Failed to generate signed URL:", err);
      showToast?.(`Could not open document: ${err.message || "unknown"}`, "error");
    }
  }

  // AI validation: send document to Claude, get severity-graded analysis
  async function handleValidateWithAI() {
    if (!form.agreement_document_path) {
      showToast?.("Please upload a document first", "error");
      return;
    }
    setValidating(true);
    setValidationError(null);
    try {
      // Get fresh signed URL for the document
      const { data: urlData, error: urlErr } = await supabase.storage
        .from("documents")
        .createSignedUrl(form.agreement_document_path, 600);
      if (urlErr) throw urlErr;
      if (!urlData?.signedUrl) throw new Error("Could not generate document URL");

      // Call our Vercel API
      const response = await fetch("/api/validate-agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentUrl: urlData.signedUrl,
          formData: form
        })
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Validation failed (${response.status})`);
      }

      // Save the result into form state
      setForm(prev => ({ ...prev, validation_result: result }));

      // Save to DB immediately (cache the result)
      if (isEdit) {
        await supabase
          .from("pp_master_agreements")
          .update({ validation_result: result })
          .eq("id", agreement.id);
      }

      // Show severity-appropriate toast
      const severityMsg = {
        info: "✅ Document verified",
        warning: "⚠️ Mismatches detected - please review",
        critical: "🛑 Critical mismatches - please review"
      }[result.severity] || "Validation complete";
      showToast?.(severityMsg, result.severity === "info" ? "success" : "warning");
    } catch (err) {
      console.error("Validation failed:", err);
      setValidationError(err.message || "Validation failed");
      showToast?.(`Validation failed: ${err.message || "unknown"}`, "error");
    } finally {
      setValidating(false);
    }
  }

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function handleDeveloperChange(devId) {
    const dev = developers.find(d => d.id === devId);
    setForm(prev => ({
      ...prev,
      developer_id: devId,
      developer_name: dev ? dev.name : ""
    }));
    if (errors.developer_id) {
      setErrors(prev => {
        const next = { ...prev };
        delete next.developer_id;
        return next;
      });
    }
  }

  function validate() {
    const e = {};
    if (!form.developer_id) e.developer_id = "Developer is required";
    if (!form.agreement_title?.trim()) e.agreement_title = "Agreement title is required";
    if (form.agreement_title && form.agreement_title.length > 200) e.agreement_title = "Title too long (max 200 chars)";

    // Numeric validation - trim string, then test as Number
    const defaultPctStr = String(form.default_commission_pct ?? "").trim();
    if (defaultPctStr === "") {
      e.default_commission_pct = "Default commission % is required";
    } else {
      const pct = Number(defaultPctStr);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        e.default_commission_pct = "Must be 0-100";
      }
    }

    const bonusPctStr = String(form.bonus_commission_pct ?? "").trim();
    if (bonusPctStr !== "") {
      const bp = Number(bonusPctStr);
      if (!Number.isFinite(bp) || bp < 0 || bp > 100) {
        e.bonus_commission_pct = "Must be 0-100";
      }
    }

    const discAuthStr = String(form.discount_authority_pct ?? "").trim();
    if (discAuthStr !== "") {
      const dp = Number(discAuthStr);
      if (!Number.isFinite(dp) || dp < 0 || dp > 100) {
        e.discount_authority_pct = "Must be 0-100";
      }
    }

    const discApprStr = String(form.discount_requires_approval_above ?? "").trim();
    if (discApprStr !== "") {
      const dp = Number(discApprStr);
      if (!Number.isFinite(dp) || dp < 0 || dp > 100) {
        e.discount_requires_approval_above = "Must be 0-100";
      }
    }

    const payDaysStr = String(form.payment_days ?? "").trim();
    if (payDaysStr !== "") {
      const pd = Number(payDaysStr);
      if (!Number.isFinite(pd) || pd < 0) {
        e.payment_days = "Must be 0 or greater";
      }
    }
    if (form.valid_from && form.valid_until) {
      if (new Date(form.valid_until) < new Date(form.valid_from)) {
        e.valid_until = "Must be on or after Valid From";
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) {
      showToast?.("Please fix the errors before saving", "error");
      return;
    }

    try {
      setSaving(true);

      const data = {
        company_id: currentUser.company_id,
        developer_id: form.developer_id,
        developer_name: form.developer_name,
        agreement_title: form.agreement_title.trim(),
        agreement_reference: form.agreement_reference?.trim() || null,
        default_commission_pct: Number(form.default_commission_pct),
        bonus_commission_pct: form.bonus_commission_pct === "" ? null : Number(form.bonus_commission_pct),
        bonus_threshold: form.bonus_threshold?.trim() || null,
        payment_terms: form.payment_terms?.trim() || null,
        payment_trigger: form.payment_trigger || null,
        payment_days: form.payment_days === "" ? null : Number(form.payment_days),
        discount_authority_pct: form.discount_authority_pct === "" ? null : Number(form.discount_authority_pct),
        discount_requires_approval_above: form.discount_requires_approval_above === "" ? null : Number(form.discount_requires_approval_above),
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        signed_by: form.signed_by?.trim() || null,
        signed_date: form.signed_date || null,
        signed_on_behalf_of: form.signed_on_behalf_of?.trim() || null,
        status: form.status,
        notes: form.notes?.trim() || null,
        agreement_document_path: form.agreement_document_path || null,
        agreement_document_filename: form.agreement_document_filename || null,
        updated_by: currentUser.id,
        updated_at: new Date().toISOString()
      };

      if (isEdit) {
        const { error: updateError } = await supabase
          .from("pp_master_agreements")
          .update(data)
          .eq("id", agreement.id);
        if (updateError) throw updateError;
        showToast?.(`Agreement updated: ${form.agreement_title}`, "success");
      } else {
        data.created_by = currentUser.id;
        const { error: insertError } = await supabase
          .from("pp_master_agreements")
          .insert(data);
        if (insertError) throw insertError;
        showToast?.(`Agreement created: ${form.agreement_title}`, "success");
      }

      onSaved();
    } catch (err) {
      console.error("Save failed:", err);
      showToast?.(`Save failed: ${err.message || "Unknown error"}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position:"fixed",
        inset:0,
        background:"rgba(11,31,58,0.6)",
        display:"flex",
        alignItems:"flex-start",
        justifyContent:"center",
        zIndex:1000,
        padding:"40px 16px",
        overflowY:"auto",
        fontFamily:"'Inter', sans-serif"
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background:"#fff",
        borderRadius:12,
        width:"100%",
        maxWidth:760,
        boxShadow:"0 20px 60px rgba(0,0,0,0.25)",
        overflow:"hidden"
      }}>
        {/* Header */}
        <div style={{
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center",
          padding:"18px 24px",
          borderBottom:"1px solid #E5E7EB",
          background:"#FAFBFC"
        }}>
          <div>
            <h2 style={{margin:0, fontSize:18, fontWeight:700, color:"#0F2540"}}>
              {isEdit ? "Edit Master Agreement" : "New Master Agreement"}
            </h2>
            <p style={{margin:"2px 0 0 0", fontSize:12, color:"#6B7280"}}>
              {isEdit ? `Reference: ${agreement.agreement_reference || agreement.id.slice(0,8)}` : "Stage 1 - Foundation for the developer relationship"}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background:"transparent",
              border:"none",
              fontSize:20,
              cursor:"pointer",
              color:"#6B7280",
              padding:"4px 12px",
              borderRadius:6
            }}
            aria-label="Close"
          >×</button>
        </div>

        {/* Audit strip - only shown in Edit mode */}
        {isEdit && (
          <div style={{
            padding:"10px 24px",
            background:"#F0F4FA",
            borderBottom:"1px solid #DBE4F0",
            display:"flex",
            justifyContent:"space-between",
            alignItems:"center",
            fontSize:11,
            color:"#1E2D3F"
          }}>
            <div style={{display:"flex", gap:18}}>
              {agreement?.created_at && (
                <span>
                  <strong style={{color:"#6B7280"}}>Created:</strong> {fmtDateLong(agreement.created_at)}
                </span>
              )}
              {agreement?.updated_at && agreement.updated_at !== agreement.created_at && (
                <span>
                  <strong style={{color:"#6B7280"}}>Last updated:</strong> {fmtDateLong(agreement.updated_at)}
                </span>
              )}
            </div>
            <div style={{
              padding:"3px 10px",
              background:"#FFF",
              border:"1px solid #DBE4F0",
              borderRadius:12,
              fontSize:11,
              fontWeight:600,
              color:"#1E2D3F"
            }}>
              📊 Used in <span style={{color:"#0369A1", fontWeight:700}}>{agreementUsageCount} {agreementUsageCount === 1 ? "opportunity" : "opportunities"}</span>
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{padding:"20px 24px", maxHeight:"calc(100vh - 240px)", overflowY:"auto"}}>

          <Section title="1. The Relationship" subtitle="Which developer is this agreement with?">
            <Row>
              <Field label="Developer" required error={errors.developer_id}>
                <select
                  value={form.developer_id}
                  onChange={(e) => handleDeveloperChange(e.target.value)}
                  style={selectStyle(errors.developer_id)}
                >
                  <option value="">Select a developer...</option>
                  {developers.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                  style={selectStyle()}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="terminated">Terminated</option>
                </select>
              </Field>
            </Row>
            <Row>
              <Field label="Agreement Title" required error={errors.agreement_title}>
                <input
                  type="text"
                  value={form.agreement_title}
                  onChange={(e) => updateField("agreement_title", e.target.value)}
                  placeholder="e.g. Emaar 2026 Annual Master Agreement"
                  style={inputStyle(errors.agreement_title)}
                />
              </Field>
              <Field label="Internal Reference" hint="Your firm's internal reference number">
                <input
                  type="text"
                  value={form.agreement_reference}
                  onChange={(e) => updateField("agreement_reference", e.target.value)}
                  placeholder="e.g. EMR-2026-001"
                  style={inputStyle()}
                />
              </Field>
            </Row>
          </Section>

          <Section title="2. Commercial Terms" subtitle="Default rates that apply unless overridden by project">
            <Row>
              <Field label="Default Commission %" required error={errors.default_commission_pct}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.default_commission_pct}
                  onChange={(e) => updateField("default_commission_pct", e.target.value)}
                  placeholder="4.00"
                  style={inputStyle(errors.default_commission_pct)}
                />
              </Field>
              <Field label="Bonus Commission %" hint="Optional - additional rate for hitting targets" error={errors.bonus_commission_pct}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.bonus_commission_pct}
                  onChange={(e) => updateField("bonus_commission_pct", e.target.value)}
                  placeholder="0.50"
                  style={inputStyle(errors.bonus_commission_pct)}
                />
              </Field>
            </Row>
            <Row>
              <Field label="Bonus Threshold" hint="When does the bonus kick in?" full>
                <input
                  type="text"
                  value={form.bonus_threshold}
                  onChange={(e) => updateField("bonus_threshold", e.target.value)}
                  placeholder="e.g. 10+ closures per quarter"
                  style={inputStyle()}
                />
              </Field>
            </Row>
          </Section>

          <Section title="3. Payment Terms" subtitle="When does the broker get paid?">
            <Row>
              <Field label="Payment Trigger">
                <select
                  value={form.payment_trigger}
                  onChange={(e) => updateField("payment_trigger", e.target.value)}
                  style={selectStyle()}
                >
                  <option value="">Select trigger...</option>
                  <option value="spa_executed">SPA Executed</option>
                  <option value="first_payment">First Payment Received</option>
                  <option value="full_payment">Full Payment Received</option>
                  <option value="custom">Custom (see notes)</option>
                </select>
              </Field>
              <Field label="Payment Days" hint="Days from trigger to payment" error={errors.payment_days}>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.payment_days}
                  onChange={(e) => updateField("payment_days", e.target.value)}
                  placeholder="14"
                  style={inputStyle(errors.payment_days)}
                />
              </Field>
            </Row>
            <Row>
              <Field label="Payment Terms (free text)" hint="Override or supplement the trigger/days" full>
                <input
                  type="text"
                  value={form.payment_terms}
                  onChange={(e) => updateField("payment_terms", e.target.value)}
                  placeholder="e.g. 14 days post-SPA execution; held in escrow until handover"
                  style={inputStyle()}
                />
              </Field>
            </Row>
          </Section>

          <Section title="4. Discount Authority" subtitle="What discounts can the broker offer without escalating?">
            <Row>
              <Field label="Discount Authority %" hint="Max discount we can offer without approval" error={errors.discount_authority_pct}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.discount_authority_pct}
                  onChange={(e) => updateField("discount_authority_pct", e.target.value)}
                  placeholder="5.00"
                  style={inputStyle(errors.discount_authority_pct)}
                />
              </Field>
              <Field label="Approval Threshold %" hint="Above this, requires developer sign-off" error={errors.discount_requires_approval_above}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.discount_requires_approval_above}
                  onChange={(e) => updateField("discount_requires_approval_above", e.target.value)}
                  placeholder="10.00"
                  style={inputStyle(errors.discount_requires_approval_above)}
                />
              </Field>
            </Row>
          </Section>

          <Section title="5. Validity & Audit" subtitle="Period covered and signing details">
            <Row>
              <Field label="Valid From">
                <input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => updateField("valid_from", e.target.value)}
                  style={inputStyle()}
                />
              </Field>
              <Field label="Valid Until" error={errors.valid_until}>
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => updateField("valid_until", e.target.value)}
                  style={inputStyle(errors.valid_until)}
                />
              </Field>
            </Row>
            <Row>
              <Field label="Signed By" hint="Person who signed on developer's side">
                <input
                  type="text"
                  value={form.signed_by}
                  onChange={(e) => updateField("signed_by", e.target.value)}
                  placeholder="e.g. Mohammed Al Mansoori"
                  style={inputStyle()}
                />
              </Field>
              <Field label="Signed Date">
                <input
                  type="date"
                  value={form.signed_date}
                  onChange={(e) => updateField("signed_date", e.target.value)}
                  style={inputStyle()}
                />
              </Field>
            </Row>
            <Row>
              <Field label="Signed on Behalf of (your side)" full>
                <input
                  type="text"
                  value={form.signed_on_behalf_of}
                  onChange={(e) => updateField("signed_on_behalf_of", e.target.value)}
                  placeholder="e.g. Al Mansoori Properties LLC"
                  style={inputStyle()}
                />
              </Field>
            </Row>
            {/* Document upload zone */}
            <div style={{marginTop:12}}>
              <label style={{
                fontSize:11,
                fontWeight:600,
                color:"#374151",
                letterSpacing:0.2,
                display:"block",
                marginBottom:6
              }}>
                📎 Signed Agreement Document
              </label>

              {/* If document already uploaded, show it */}
              {form.agreement_document_path && form.agreement_document_filename && (
                <div style={{
                  padding:"12px 14px",
                  background:"#F0FDF4",
                  border:"1px solid #86EFAC",
                  borderRadius:6,
                  display:"flex",
                  alignItems:"center",
                  gap:10
                }}>
                  <span style={{fontSize:24}}>📄</span>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:600, color:"#166534", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                      {form.agreement_document_filename}
                    </div>
                    <div style={{fontSize:11, color:"#16A34A", marginTop:2}}>✓ Uploaded</div>
                  </div>
                  <button
                    type="button"
                    onClick={handleViewDocument}
                    style={{
                      padding:"5px 12px",
                      background:"#fff",
                      border:"1px solid #86EFAC",
                      borderRadius:6,
                      fontSize:11,
                      fontWeight:600,
                      color:"#166534",
                      cursor:"pointer"
                    }}
                  >View</button>
                  <button
                    type="button"
                    onClick={handleValidateWithAI}
                    disabled={validating}
                    style={{
                      padding:"5px 12px",
                      background: validating ? "#FEF6E0" : "#FFF7ED",
                      border:"1px solid #FB923C",
                      borderRadius:6,
                      fontSize:11,
                      fontWeight:600,
                      color:"#9A3412",
                      cursor:validating ? "wait" : "pointer"
                    }}
                  >{validating ? "🤖 Validating..." : (form.validation_result ? "🔄 Re-validate" : "🤖 Validate with AI")}</button>
                  <label style={{
                    padding:"5px 12px",
                    background:"#fff",
                    border:"1px solid #86EFAC",
                    borderRadius:6,
                    fontSize:11,
                    fontWeight:600,
                    color:"#166534",
                    cursor:"pointer"
                  }}>
                    Replace
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); e.target.value = ""; }}
                      disabled={uploading}
                      style={{display:"none"}}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveDocument}
                    style={{
                      padding:"5px 10px",
                      background:"#fff",
                      border:"1px solid #FCA5A5",
                      borderRadius:6,
                      fontSize:11,
                      fontWeight:600,
                      color:"#991B1B",
                      cursor:"pointer"
                    }}
                  >Remove</button>
                </div>
              )}

              {/* If no document, show drop zone */}
              {!form.agreement_document_path && (
                <label
                  style={{
                    display:"block",
                    padding:"24px 16px",
                    background:uploading ? "#FEF6E0" : "#FAFBFC",
                    border:`2px dashed ${uploading ? "#E5C870" : "#D1D5DB"}`,
                    borderRadius:8,
                    textAlign:"center",
                    cursor: uploading ? "wait" : "pointer",
                    transition:"all 0.15s"
                  }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (uploading) return;
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                >
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); e.target.value = ""; }}
                    disabled={uploading}
                    style={{display:"none"}}
                  />
                  {uploading ? (
                    <>
                      <div style={{fontSize:32, marginBottom:8}}>⏳</div>
                      <div style={{fontSize:13, fontWeight:600, color:"#7A5C0E"}}>Uploading...</div>
                    </>
                  ) : (
                    <>
                      <div style={{fontSize:32, marginBottom:8, opacity:0.6}}>📤</div>
                      <div style={{fontSize:13, fontWeight:600, color:"#1E2D3F"}}>
                        Drop signed PDF here or click to browse
                      </div>
                      <div style={{fontSize:11, color:"#9CA3AF", marginTop:4}}>
                        Max 10MB · PDF, JPG, or PNG accepted
                      </div>
                    </>
                  )}
                </label>
              )}

              {uploadError && (
                <div style={{
                  marginTop:8,
                  padding:"8px 12px",
                  background:"#FEE2E2",
                  border:"1px solid #FCA5A5",
                  borderRadius:6,
                  fontSize:12,
                  color:"#991B1B"
                }}>
                  ⚠️ {uploadError}
                </div>
              )}

              {/* AI Validation result display */}
              {form.validation_result && (
                <ValidationResultPanel result={form.validation_result} />
              )}

              {validationError && (
                <div style={{
                  marginTop:8,
                  padding:"8px 12px",
                  background:"#FEE2E2",
                  border:"1px solid #FCA5A5",
                  borderRadius:6,
                  fontSize:12,
                  color:"#991B1B"
                }}>
                  ⚠️ AI Validation error: {validationError}
                </div>
              )}
            </div>
          </Section>

          <Section title="6. Notes" subtitle="Anything else worth recording about this relationship">
            <Field label="" full>
              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Optional notes, special terms, contacts, escalation paths..."
                rows={4}
                style={{
                  ...inputStyle(),
                  resize:"vertical",
                  minHeight:80,
                  fontFamily:"'Inter', sans-serif"
                }}
              />
            </Field>
          </Section>
        </div>

        {/* Footer */}
        <div style={{
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center",
          padding:"14px 24px",
          borderTop:"1px solid #E5E7EB",
          background:"#FAFBFC"
        }}>
          <div style={{fontSize:11, color:"#9CA3AF"}}>
            {isEdit ? "Updating existing agreement" : "Creating new agreement"} · Required: Developer, Title, Default %
          </div>
          <div style={{display:"flex", gap:10}}>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                padding:"9px 18px",
                background:"#fff",
                border:"1px solid #D1D5DB",
                borderRadius:7,
                fontSize:13,
                fontWeight:600,
                cursor:saving ? "not-allowed" : "pointer",
                color:"#1E2D3F",
                opacity:saving ? 0.6 : 1
              }}
            >Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding:"9px 22px",
                background:saving ? "#9CA3AF" : "#0F2540",
                border:"none",
                borderRadius:7,
                fontSize:13,
                fontWeight:600,
                cursor:saving ? "not-allowed" : "pointer",
                color:"#fff"
              }}
            >{saving ? "Saving..." : (isEdit ? "Save Changes" : "Create Agreement")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// AI VALIDATION RESULT PANEL
// =============================================================================

function ValidationResultPanel({ result }) {
  const severityConfig = {
    info: {
      bg: "#F0FDF4",
      border: "#86EFAC",
      iconBg: "#16A34A",
      label: "✅ Verified",
      labelColor: "#166534"
    },
    warning: {
      bg: "#FEF6E0",
      border: "#FBBF24",
      iconBg: "#D97706",
      label: "⚠️ Mismatches Detected",
      labelColor: "#92400E"
    },
    critical: {
      bg: "#FEE2E2",
      border: "#FCA5A5",
      iconBg: "#DC2626",
      label: "🛑 Critical Issues",
      labelColor: "#991B1B"
    }
  };

  const cfg = severityConfig[result.severity] || severityConfig.warning;
  const validatedAt = result.validated_at
    ? new Date(result.validated_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
    : "";

  return (
    <div style={{
      marginTop: 12,
      padding: "12px 14px",
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 8,
      fontSize: 12
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 8
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: cfg.labelColor }}>
            {cfg.label}
          </div>
          {result.summary && (
            <div style={{ fontSize: 11, color: "#4B5563", marginTop: 4, fontStyle: "italic" }}>
              {result.summary}
            </div>
          )}
        </div>
        {validatedAt && (
          <div style={{ fontSize: 10, color: "#9CA3AF" }}>
            🤖 {validatedAt}
          </div>
        )}
      </div>

      {/* Field-level matches */}
      {result.matches && result.matches.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
            Field Comparison
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {result.matches.map((m, idx) => (
              <div
                key={idx}
                style={{
                  padding: "6px 10px",
                  background: m.match ? "#fff" : "#FFF7ED",
                  border: `1px solid ${m.match ? "#E5E7EB" : "#FED7AA"}`,
                  borderRadius: 6,
                  fontSize: 11
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "#0F2540" }}>
                    {m.match ? "✓" : "✗"} {prettifyFieldName(m.field)}
                  </span>
                  {!m.match && (
                    <span style={{ fontSize: 10, color: "#9A3412", fontStyle: "italic" }}>
                      {m.reason}
                    </span>
                  )}
                </div>
                {(m.form_value || m.doc_value) && (
                  <div style={{ marginTop: 3, fontSize: 10, color: "#6B7280", display: "flex", gap: 12 }}>
                    <span>Form: <strong style={{color:"#374151"}}>{String(m.form_value ?? "—")}</strong></span>
                    <span>Document: <strong style={{color:"#374151"}}>{String(m.doc_value ?? "—")}</strong></span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function prettifyFieldName(field) {
  if (!field) return "";
  return field.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// =============================================================================
// SMALL FORM HELPERS
// =============================================================================

function Section({ title, subtitle, children }) {
  return (
    <div style={{marginBottom:20, paddingBottom:18, borderBottom:"1px solid #F3F4F6"}}>
      <div style={{marginBottom:12}}>
        <h3 style={{margin:0, fontSize:14, fontWeight:700, color:"#0F2540", letterSpacing:"-0.1px"}}>{title}</h3>
        {subtitle && (
          <p style={{margin:"2px 0 0 0", fontSize:11, color:"#6B7280"}}>{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function Row({ children }) {
  return (
    <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:10}}>
      {children}
    </div>
  );
}

function Field({ label, hint, error, required, full, children }) {
  return (
    <div style={{
      gridColumn: full ? "1 / -1" : undefined,
      display:"flex",
      flexDirection:"column",
      gap:4
    }}>
      {label && (
        <label style={{
          fontSize:11,
          fontWeight:600,
          color:"#374151",
          letterSpacing:0.2
        }}>
          {label}{required && <span style={{color:"#DC2626", marginLeft:3}}>*</span>}
        </label>
      )}
      {children}
      {error && (
        <div style={{fontSize:11, color:"#DC2626", marginTop:2}}>{error}</div>
      )}
      {hint && !error && (
        <div style={{fontSize:11, color:"#9CA3AF", marginTop:2}}>{hint}</div>
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

// Reusable input styles
function inputStyle(error) {
  return {
    width:"100%",
    padding:"7px 10px",
    border:`1px solid ${error ? "#DC2626" : "#D1D5DB"}`,
    borderRadius:6,
    fontSize:13,
    fontFamily:"'Inter', sans-serif",
    outline:"none",
    background:"#fff",
    boxSizing:"border-box"
  };
}

function selectStyle(error) {
  return {
    width:"100%",
    padding:"7px 10px",
    border:`1px solid ${error ? "#DC2626" : "#D1D5DB"}`,
    borderRadius:6,
    fontSize:13,
    fontFamily:"'Inter', sans-serif",
    outline:"none",
    background:"#fff",
    cursor:"pointer",
    boxSizing:"border-box"
  };
}

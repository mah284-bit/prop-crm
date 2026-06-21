// PaymentPlanTemplates — milestone payment-plan templates, extracted from App.jsx.
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { can } from "../../lib/permissions.js";

const Spinner = ({ msg = "Loading…" }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, color: "#A0AEC0" }}>
    <div style={{ width: 36, height: 36, border: "3px solid #E2E8F0", borderTop: "3px solid #C9A84C", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    {msg && <div style={{ fontSize: 14 }}>{msg}</div>}
  </div>
);

export default function PaymentPlanTemplates({ currentUser, showToast, projects = [], onSelectPlan }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editTpl, setEditTpl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selProject, setSelProject] = useState("all");
  const canEdit = can(currentUser.role, "write");

  const blankTpl = {
    name: "", project_id: "", description: "", requires_approval: false,
    milestones: [
      { label: "Booking Deposit", pct: 10, days_from_signing: 0 },
      { label: "On Construction", pct: 40, days_from_signing: 90 },
      { label: "On Handover", pct: 50, days_from_signing: 365 },
    ]
  };
  const [form, setForm] = useState(blankTpl);

  const load = useCallback(async () => {
    setLoading(true);
    let data = [];
    try { const r = await supabase.from("payment_plan_templates").select("*").order("project_id").order("name"); data = r.data || []; } catch (e) {}
    setTemplates(data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const totalPct = form.milestones.reduce((s, m) => s + (Number(m.pct) || 0), 0);

  const addMilestone = () => setForm(f => ({ ...f, milestones: [...f.milestones, { label: "", pct: 0, days_from_signing: 0 }] }));
  const removeMilestone = i => setForm(f => ({ ...f, milestones: f.milestones.filter((_, j) => j !== i) }));
  const updateMilestone = (i, k, v) => setForm(f => ({ ...f, milestones: f.milestones.map((m, j) => j === i ? { ...m, [k]: v } : m) }));

  const save = async () => {
    if (!form.name.trim()) { showToast("Template name required", "error"); return; }
    if (Math.abs(totalPct - 100) > 0.1) { showToast(`Total must be 100% — currently ${totalPct}%`, "error"); return; }
    if (form.milestones.some(m => !m.label.trim())) { showToast("All milestones need a label", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name, project_id: form.project_id || null, description: form.description || null,
        requires_approval: form.requires_approval,
        milestones: form.milestones.map((m, i) => ({ ...m, pct: Number(m.pct), order: i + 1 })),
        company_id: currentUser.company_id || null, created_by: currentUser.id,
      };
      let data, error;
      if (editTpl) {
        ({ data, error } = await supabase.from("payment_plan_templates").update(payload).eq("id", editTpl.id).select().single());
        setTemplates(p => p.map(t => t.id === editTpl.id ? data : t));
      } else {
        ({ data, error } = await supabase.from("payment_plan_templates").insert(payload).select().single());
        setTemplates(p => [...p, data]);
      }
      if (error) throw error;
      showToast(editTpl ? "Template updated" : "Template created", "success");
      setShowAdd(false); setEditTpl(null); setForm(blankTpl);
    } catch (e) { showToast(e.message, "error"); }
    setSaving(false);
  };

  const filtered = selProject === "all" ? templates : templates.filter(t => t.project_id === selProject || (!t.project_id && selProject === "global"));

  if (loading) return <Spinner msg="Loading payment plans…" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={selProject} onChange={e => setSelProject(e.target.value)} style={{ fontSize: 12, padding: "6px 10px" }}>
            <option value="all">All Projects</option>
            <option value="global">Global Templates</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "#A0AEC0" }}>{filtered.length} templates</span>
        </div>
        {canEdit && <button onClick={() => { setForm(blankTpl); setEditTpl(null); setShowAdd(true); }}
          style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0F2540", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + New Template
        </button>}
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: "3rem", color: "#A0AEC0" }}>No payment plan templates yet — click + New Template to create one</div>}
        {filtered.map(tpl => {
          const proj = projects.find(p => p.id === tpl.project_id);
          const ms = tpl.milestones || [];
          return (
            <div key={tpl.id} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, color: "#0F2540" }}>{tpl.name}</span>
                    {tpl.requires_approval && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: "#FDF3DC", color: "#8A6200", fontWeight: 600 }}>⚠ Requires Approval</span>}
                    {proj ? <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: "#E6EFF9", color: "#1A5FA8", fontWeight: 600 }}>{proj.name}</span>
                      : <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: "#F7F9FC", color: "#718096", fontWeight: 600 }}>Global</span>}
                  </div>
                  {tpl.description && <div style={{ fontSize: 12, color: "#718096" }}>{tpl.description}</div>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {onSelectPlan && <button onClick={() => onSelectPlan(tpl)}
                    style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: "#1A7F5A", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    Use Plan
                  </button>}
                  {canEdit && <button onClick={() => { setForm({ ...blankTpl, ...tpl, milestones: tpl.milestones || blankTpl.milestones }); setEditTpl(tpl); setShowAdd(true); }}
                    style={{ padding: "6px 12px", borderRadius: 7, border: "1.5px solid #E2E8F0", background: "#fff", fontSize: 12, cursor: "pointer" }}>
                    Edit
                  </button>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 3, height: 28, borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
                {ms.map((m, i) => {
                  const colors = ["#0F2540", "#1A5FA8", "#1A7F5A", "#5B3FAA", "#A06810", "#B83232", "#718096"];
                  return (
                    <div key={i} title={`${m.label}: ${m.pct}%`}
                      style={{ flex: m.pct, background: colors[i % colors.length], display: "flex", alignItems: "center", justifyContent: "center", minWidth: 30 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}>{m.pct}%</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ms.map((m, i) => {
                  const colors = ["#0F2540", "#1A5FA8", "#1A7F5A", "#5B3FAA", "#A06810", "#B83232", "#718096"];
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#4A5568" }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length], flexShrink: 0 }} />
                      {m.label} ({m.pct}%)
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(11,31,58,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: "1rem" }}>
          <div style={{ background: "#fff", borderRadius: 16, width: 580, maxWidth: "100%", maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(11,31,58,.4)" }}>
            <div style={{ background: "#fff", padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, color: "#fff" }}>{editTpl ? "Edit" : "New"} Payment Plan Template</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Define milestone installments — must total 100%</div>
              </div>
              <button onClick={() => { setShowAdd(false); setEditTpl(null); }} style={{ background: "none", border: "none", fontSize: 22, color: "#C9A84C", cursor: "pointer" }}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "1.25rem 1.5rem", flex: 1 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#4A5568", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".5px" }}>Template Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. 40/60 Off-Plan, 20/80 Post-Handover" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#4A5568", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".5px" }}>Project (optional)</label>
                  <select value={form.project_id || ""} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                    <option value="">Global (all projects)</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 22 }}>
                  <input type="checkbox" id="req_approval" checked={form.requires_approval} onChange={e => setForm(f => ({ ...f, requires_approval: e.target.checked }))} style={{ width: 16, height: 16 }} />
                  <label htmlFor="req_approval" style={{ fontSize: 12, fontWeight: 600, color: "#4A5568", cursor: "pointer" }}>Requires management approval when used</label>
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#4A5568", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".5px" }}>Description</label>
                  <input value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description of when to use this plan" />
                </div>
              </div>

              <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#4A5568", textTransform: "uppercase", letterSpacing: ".5px" }}>Milestones *</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: Math.abs(totalPct - 100) < 0.1 ? "#1A7F5A" : "#B83232" }}>
                    Total: {totalPct}% {Math.abs(totalPct - 100) < 0.1 ? "✓" : "(must be 100%)"}
                  </span>
                  <button onClick={addMilestone} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "#0F2540", color: "#fff", cursor: "pointer" }}>+ Add Row</button>
                </div>
              </div>
              {form.milestones.length > 0 && (
                <div style={{ display: "flex", gap: 2, height: 20, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
                  {form.milestones.map((m, i) => {
                    const colors = ["#0F2540", "#1A5FA8", "#1A7F5A", "#5B3FAA", "#A06810", "#B83232", "#718096"];
                    return <div key={i} style={{ flex: Math.max(Number(m.pct) || 0, 0.5), background: colors[i % colors.length], transition: "flex .2s" }} />;
                  })}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {form.milestones.map((m, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 100px 32px", gap: 6, alignItems: "center" }}>
                    <input value={m.label} onChange={e => updateMilestone(i, "label", e.target.value)} placeholder={`Milestone ${i + 1} label`} style={{ fontSize: 12 }} />
                    <div style={{ position: "relative" }}>
                      <input type="number" value={m.pct} onChange={e => updateMilestone(i, "pct", e.target.value)} style={{ paddingRight: 18, fontSize: 12 }} min={0} max={100} />
                      <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#A0AEC0" }}>%</span>
                    </div>
                    <input type="number" value={m.days_from_signing} onChange={e => updateMilestone(i, "days_from_signing", e.target.value)} placeholder="Days" style={{ fontSize: 12 }} min={0} />
                    <button onClick={() => removeMilestone(i)} style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #F0BCBC", background: "#FAEAEA", color: "#B83232", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                ))}
                <div style={{ fontSize: 10, color: "#A0AEC0", marginTop: 4 }}>Label · % · Days from signing date</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "1rem 1.5rem", borderTop: "1px solid #E2E8F0" }}>
              <button onClick={() => { setShowAdd(false); setEditTpl(null); }} style={{ padding: "9px 20px", borderRadius: 8, border: "1.5px solid #D1D9E6", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={save} disabled={saving || Math.abs(totalPct - 100) > 0.1}
                style={{ padding: "9px 24px", borderRadius: 8, border: "none", background: saving || Math.abs(totalPct - 100) > 0.1 ? "#A0AEC0" : "#0F2540", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "Saving…" : editTpl ? "Save Changes" : "Create Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

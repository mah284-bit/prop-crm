import React, { useState } from "react";
import { supabase } from "../../lib/supabase";

const STATES = [
  { v: "not_started",  l: "Not Started",   c: "#8A6200", bg: "#FDF3DC" },
  { v: "in_progress",  l: "Docs Collected", c: "#1A5FA8", bg: "#E6EFF8" },
  { v: "verified",     l: "Verified",       c: "#1A7F5A", bg: "#E6F4EE" },
  { v: "expired",      l: "Expired",        c: "#C53030", bg: "#FED7D7" },
];
const DOCS = [
  { k: "passport",       l: "Passport copy" },
  { k: "eid_visa",       l: "Emirates ID / Visa" },
  { k: "proof_of_funds", l: "Proof of funds / source" },
];

const isExpired = (d) => (d?.path || d?.url) && d?.expiry && new Date(d.expiry) < new Date(new Date().toDateString());

export default function KYCDialog({ lead, currentUser, showToast, onClose, onSaved }) {
  const [status, setStatus] = useState(lead?.kyc_status || "not_started");
  const [docs, setDocs] = useState(lead?.kyc_docs || {});
  const [note, setNote] = useState(lead?.kyc_note || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const uploadDoc = async (k, file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast?.("Max 10MB", "error"); return; }
    setUploading(k);
    try {
      const path = "kyc/" + (lead.company_id || "c") + "/" + lead.id + "/" + k + "_" + Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      // Day 82 SECURITY: identity documents go to the PRIVATE bucket. They were being written to
      // propcrm-files, which is PUBLIC - the same bucket as brochures and unit images - and served
      // by getPublicUrl. Passports and Emirates IDs were readable by anyone holding the link.
      // The bucket cannot simply be flipped: brochures and images are MEANT to be public. So
      // identity documents move to the private "documents" bucket and are signed on demand.
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      // Store the PATH, not a URL. A signed URL expires, so a stored one would rot; the path is
      // permanent and is signed at view time. `url` is kept null so any old public URL still
      // renders for documents uploaded before this change.
      const nextDocs = { ...docs, [k]: { path: path, uploaded_at: new Date().toISOString() } };
      setDocs(nextDocs);
      const bump = status === "not_started";
      if (bump) setStatus("in_progress");
      await supabase.from("leads").update(bump ? { kyc_docs: nextDocs, kyc_status: "in_progress" } : { kyc_docs: nextDocs }).eq("id", lead.id);
      onSaved?.(bump ? { kyc_docs: nextDocs, kyc_status: "in_progress" } : { kyc_docs: nextDocs });
    } catch (e) { showToast?.("Upload failed: " + (e.message || e), "error"); }
    setUploading(null);
  };
  // Day 82: a document is present if it has EITHER a path (private bucket, signed on demand)
  // or a legacy url (uploaded before the move off the public bucket).
  const has = (d0) => !!(d0 && (d0.path || d0.url));
  const missing = DOCS.filter(d => !has(docs[d.k])).map(d => d.l);
  const expired = DOCS.filter(d => isExpired(docs[d.k])).map(d => d.l);
  const save = async () => {
    if (status === "verified" && (!docs.passport?.url || !docs.eid_visa?.url)) {
      showToast?.("Verified requires Passport + Emirates ID/Visa uploaded", "error"); return;
    }
    if (status === "verified" && (isExpired(docs.passport) || isExpired(docs.eid_visa))) {
      showToast?.("Verified blocked: an identity document is EXPIRED - collect a renewed copy", "error"); return;
    }
    setSaving(true);
    let effStatus = status;
    if (status !== "verified") {
      if (isExpired(docs.passport) || isExpired(docs.eid_visa)) effStatus = "expired";
      else if (Object.values(docs).some(d => d?.url) && status === "not_started") effStatus = "in_progress";
    }
    const payload = { kyc_status: effStatus, kyc_docs: docs, kyc_note: note || null };
    if (status === "verified" && lead?.kyc_status !== "verified") {
      payload.kyc_verified_at = new Date().toISOString();
      payload.kyc_verified_by_user_id = currentUser?.id || null;
    }
    const { error } = await supabase.from("leads").update(payload).eq("id", lead.id);
    setSaving(false);
    if (error) { showToast?.("KYC update failed: " + error.message, "error"); return; }
    await supabase.from("activities").insert({
      lead_id: lead.id, company_id: lead.company_id || currentUser?.company_id || null,
      type: "Note", status: "completed",
      note: "KYC updated to " + (STATES.find(s => s.v === status)?.l || status) + (missing.length && status !== "verified" ? " - missing: " + missing.join(", ") : "") + (note ? " - " + note : ""),
      user_id: currentUser?.id || null, user_name: currentUser?.full_name || null,
      lead_name: lead?.name || null, activity_subtype: "kyc_update",
    });
    showToast?.("KYC updated", "success");
    onSaved?.({ kyc_status: status, kyc_docs: docs, kyc_note: note });
    onClose?.();
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,37,64,.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:12,padding:24,width:"94%",maxWidth:460}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:700,color:"#0F2540",marginBottom:2}}>KYC Status</div>
        <div style={{fontSize:12,color:"#64748B",marginBottom:14}}>{lead?.name}</div>
        <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
          {STATES.map(s => (
            <button key={s.v} onClick={()=>setStatus(s.v)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border: status===s.v ? ("2px solid "+s.c) : "1.5px solid #E2E8F0",background: status===s.v ? s.bg : "#fff",color: status===s.v ? s.c : "#64748B"}}>{s.l}</button>
          ))}
        </div>
        <div style={{fontSize:11,fontWeight:600,color:"#64748B",textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>Documents collected</div>
        <div style={{display:"grid",gap:8,marginBottom:14}}>
          {DOCS.map(d => (
            <div key={d.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"8px 10px",border:"1px solid #E8EDF4",borderRadius:8,background: has(docs[d.k]) ? "#F0FDF4" : "#fff"}}>
              <div style={{fontSize:13,color:"#0F2540",fontWeight:600,whiteSpace:"nowrap",textAlign:"left",flex:"1 1 auto"}}>{d.l}</div>
              {has(docs[d.k]) ? (
                <div style={{display:"flex",alignItems:"center",gap:8,flex:"0 0 auto"}}>
                  <input type="date" title="Document expiry" value={docs[d.k].expiry || ""}
                    onChange={(e)=>{ const v=e.target.value; setDocs(x=>({ ...x, [d.k]: { ...x[d.k], expiry: v || undefined } })); }}
                    style={{fontSize:11,padding:"2px 6px",border: isExpired(docs[d.k]) ? "1.5px solid #C53030" : "1px solid #E2E8F0", borderRadius:6}} />
                  <button type="button" onClick={async ()=>{
                    const d0 = docs[d.k];
                    if (d0.path) {
                      const { data, error } = await supabase.storage.from("documents").createSignedUrl(d0.path, 3600);
                      if (error) { showToast?.("Could not open: " + error.message, "error"); return; }
                      window.open(data.signedUrl, "_blank", "noreferrer");
                    } else if (d0.url) { window.open(d0.url, "_blank", "noreferrer"); }
                  }} style={{fontSize:12,color:"#1A5FA8",fontWeight:600,background:"none",border:"none",cursor:"pointer",padding:0}}>View</button>
                  <button onClick={()=>setDocs(x=>{const y={...x}; delete y[d.k]; return y;})} style={{fontSize:11,color:"#B83232",border:"none",background:"none",cursor:"pointer",fontWeight:600}}>remove</button>
                </div>
              ) : (
                <label style={{fontSize:12,color:"#0F2540",fontWeight:600,border:"1.5px solid #E2E8F0",borderRadius:7,padding:"4px 12px",cursor:"pointer",flex:"0 0 auto"}}>
                  {uploading===d.k ? "Uploading\u2026" : "\u2b06 Upload"}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:"none"}} disabled={!!uploading}
                    onChange={(e)=>uploadDoc(d.k, e.target.files?.[0])} />
                </label>
              )}
            </div>
          ))}
        </div>
        {expired.length > 0 && (
          <div style={{fontSize:11,color:"#C53030",background:"#FED7D7",borderRadius:6,padding:"6px 10px",marginBottom:8,fontWeight:600}}>Expired: {expired.join(", ")} - renewed copies required</div>
        )}
        {missing.length > 0 && status !== "verified" && (
          <div style={{fontSize:11,color:"#8A6200",background:"#FDF3DC",borderRadius:6,padding:"6px 10px",marginBottom:12}}>Missing: {missing.join(", ")}</div>
        )}
        <div style={{fontSize:11,fontWeight:600,color:"#64748B",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>Note (optional)</div>
        <input type="text" value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. awaiting bank letter" style={{width:"100%",marginBottom:16}} />
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",color:"#475569"}}>Cancel</button>
          <button onClick={save} disabled={saving} style={{padding:"8px 20px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>{saving ? "Saving\u2026" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

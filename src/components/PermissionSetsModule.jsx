function PermissionSetsModule({ currentUser, showToast }) {
  const [sets,      setSets]      = useState([]);
  const [templates, setTemplates] = useState([]);
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [view,      setView]      = useState("list"); // list | edit
  const [editing,   setEditing]   = useState(null);
  const [saving,    setSaving]    = useState(false);

  const emptySet = {
    name:"", description:"", based_on:"", color:"#1A5FA8",
    ...Object.fromEntries(ALL_PERM_KEYS.map(k=>[k,false])),
    p_view_dashboard: true,
  };
  const [form, setForm] = useState(emptySet);

  const load = useCallback(async () => {
    setLoading(true);
    const safe = q => q.catch(()=>({data:[]}));
    const [s, t, u] = await Promise.all([
      safe(supabase.from("permission_sets").select("*").eq("company_id", currentUser.company_id||"").order("name")),
      safe(supabase.from("permission_sets").select("*").is("company_id", null).order("name")),
      safe(supabase.from("profiles").select("id,full_name,permission_set_id").eq("company_id", currentUser.company_id||"")),
    ]);
    setSets(s.data||[]);
    setTemplates(t.data||[]);
    setUsers(u.data||[]);
    setLoading(false);
  }, [currentUser.company_id]);

  useEffect(() => { load(); }, [load]);

  const countUsers = (setId) => users.filter(u => u.permission_set_id === setId).length;

  const openNew = (templateId=null) => {
    if (templateId) {
      const tmpl = templates.find(t => t.id === templateId);
      if (tmpl) {
        setForm({ ...emptySet, ...tmpl, id:undefined, company_id:undefined, is_template:false, name:`${tmpl.name} (Custom)`, based_on:tmpl.name });
      }
    } else {
      setForm(emptySet);
    }
    setEditing(null);
    setView("edit");
  };

  const openEdit = (set) => {
    setForm({ ...emptySet, ...set });
    setEditing(set);
    setView("edit");
  };

  const cloneSet = (set) => {
    setForm({ ...emptySet, ...set, id:undefined, name:`${set.name} (Copy)`, based_on:set.name, is_template:false });
    setEditing(null);
    setView("edit");
  };

  const save = async () => {
    if (!form.name.trim()) { showToast("Name required","error"); return; }
    setSaving(true);
    try {
      const payload = { ...form, company_id:currentUser.company_id, is_template:false, updated_at:new Date().toISOString() };
      delete payload.id;
      if (editing) {
        const { error } = await supabase.from("permission_sets").update(payload).eq("id", editing.id);
        if (error) throw error;
        showToast("Permission set updated","success");
      } else {
        const { error } = await supabase.from("permission_sets").insert(payload);
        if (error) throw error;
        showToast("Permission set created","success");
      }
      setView("list"); load();
    } catch(e) { showToast(e.message,"error"); }
    setSaving(false);
  };

  const deleteSet = async (set) => {
    if (countUsers(set.id) > 0) { showToast(`Cannot delete — ${countUsers(set.id)} user(s) assigned to this set`,"error"); return; }
    if (!window.confirm(`Delete "${set.name}"?`)) return;
    await supabase.from("permission_sets").delete().eq("id", set.id);
    showToast("Deleted","info"); load();
  };

  const togglePerm = (key) => setForm(f => ({ ...f, [key]: !f[key] }));

  const setAllInGroup = (group, value) => {
    const keys = PERMISSION_DEFS.find(g=>g.group===group)?.perms.map(p=>p.key)||[];
    setForm(f => ({ ...f, ...Object.fromEntries(keys.map(k=>[k,value])) }));
  };

  if (loading) return <Spinner msg="Loading permission sets…"/>;

  // ── LIST VIEW ─────────────────────────────────────────────────
  if (view === "list") return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>

      {/* Instructions banner */}
      <div style={{background:"#E6EFF9",border:"1px solid #B5D4F4",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13,color:"#1A5FA8",lineHeight:1.7}}>
        <strong>How permission sets work:</strong> Create named sets of permissions, then assign them to users.
        Each user gets exactly one permission set. Start from a built-in template or create from scratch.
        Built-in templates cannot be deleted — clone them to customise.
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,flex:1,overflow:"hidden"}}>

        {/* Left: Built-in templates */}
        <div style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0F2540",marginBottom:10}}>
            Built-in Templates
            <span style={{fontSize:11,fontWeight:400,color:"#A0AEC0",marginLeft:8}}>Clone to customise</span>
          </div>
          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
            {templates.map(t => (
              <div key={t.id} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:t.color,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13,color:"#0F2540"}}>{t.name}</div>
                  <div style={{fontSize:11,color:"#A0AEC0"}}>{t.description}</div>
                  <div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>
                    {PERMISSION_DEFS.flatMap(g=>g.perms).filter(p=>t[p.key]).map(p=>(
                      <span key={p.key} style={{fontSize:9,fontWeight:600,padding:"1px 6px",borderRadius:20,background:"#F7F9FC",color:"#4A5568"}}>{p.label}</span>
                    ))}
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  <button onClick={()=>openNew(t.id)}
                    style={{padding:"5px 12px",borderRadius:7,border:"1.5px solid #C9A84C",background:"#FDF3DC",color:"#8A6200",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                    Clone & Edit
                  </button>
                  <button onClick={()=>{ setForm({...emptySet,...t}); setEditing({...t,_readOnly:true}); setView("edit"); }}
                    style={{padding:"5px 12px",borderRadius:7,border:"1.5px solid #E2E8F0",background:"#fff",color:"#4A5568",fontSize:11,cursor:"pointer"}}>
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Custom sets */}
        <div style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#0F2540"}}>
              Custom Sets
              <span style={{fontSize:11,fontWeight:400,color:"#A0AEC0",marginLeft:8}}>{sets.length} created</span>
            </div>
            <button onClick={()=>openNew()}
              style={{padding:"7px 16px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>
              + New Set
            </button>
          </div>
          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
            {sets.length===0&&(
              <div style={{textAlign:"center",padding:"3rem 1rem",color:"#A0AEC0"}}>
                <div style={{fontSize:36,marginBottom:8}}>🔐</div>
                <div style={{fontSize:13,marginBottom:4}}>No custom permission sets yet</div>
                <div style={{fontSize:12}}>Clone a template or create from scratch</div>
              </div>
            )}
            {sets.map(s => {
              const uc = countUsers(s.id);
              const enabledCount = ALL_PERM_KEYS.filter(k=>s[k]).length;
              return (
                <div key={s.id} style={{background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:10,padding:"12px 14px"}}>
                  <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:8}}>
                    <div style={{width:12,height:12,borderRadius:"50%",background:s.color,flexShrink:0,marginTop:2}}/>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:13,color:"#0F2540"}}>{s.name}</div>
                      {s.description&&<div style={{fontSize:11,color:"#A0AEC0"}}>{s.description}</div>}
                      {s.based_on&&<div style={{fontSize:11,color:"#C9A84C"}}>Based on: {s.based_on}</div>}
                    </div>
                    <div style={{display:"flex",gap:5,alignItems:"center"}}>
                      <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:"#E6EFF9",color:"#1A5FA8"}}>{uc} user{uc!==1?"s":""}</span>
                      <span style={{fontSize:11,color:"#A0AEC0"}}>{enabledCount}/13</span>
                    </div>
                  </div>
                  {/* Permission pills */}
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
                    {PERMISSION_DEFS.flatMap(g=>g.perms).filter(p=>s[p.key]).map(p=>(
                      <span key={p.key} style={{fontSize:9,fontWeight:600,padding:"2px 7px",borderRadius:20,background:"#F7F9FC",color:"#4A5568"}}>{p.label}</span>
                    ))}
                    {enabledCount===0&&<span style={{fontSize:11,color:"#A0AEC0",fontStyle:"italic"}}>No permissions enabled</span>}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>openEdit(s)}
                      style={{flex:1,padding:"6px",borderRadius:7,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>Edit</button>
                    <button onClick={()=>cloneSet(s)}
                      style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #C9A84C",background:"#FDF3DC",color:"#8A6200",fontSize:12,fontWeight:600,cursor:"pointer"}}>Clone</button>
                    <button onClick={()=>deleteSet(s)}
                      style={{padding:"6px 12px",borderRadius:7,border:"1.5px solid #F0BCBC",background:"#FAEAEA",color:"#B83232",fontSize:12,fontWeight:600,cursor:"pointer"}}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // ── EDIT VIEW ─────────────────────────────────────────────────
  const isReadOnly = editing?._readOnly;
  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      {/* Edit header */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button onClick={()=>setView("list")}
          style={{padding:"7px 14px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
          ← Back
        </button>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#0F2540"}}>
          {isReadOnly?"View Template":editing?"Edit Permission Set":"New Permission Set"}
        </div>
        {isReadOnly&&(
          <button onClick={()=>cloneSet(editing)}
            style={{marginLeft:"auto",padding:"7px 16px",borderRadius:8,border:"1.5px solid #C9A84C",background:"#FDF3DC",color:"#8A6200",fontSize:13,fontWeight:600,cursor:"pointer"}}>
            Clone & Customise →
          </button>
        )}
      </div>

      <div style={{flex:1,overflowY:"auto",display:"grid",gridTemplateColumns:"300px 1fr",gap:16}}>

        {/* Left: Name + colour */}
        <div>
          <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px",marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:"#0F2540",marginBottom:12,textTransform:"uppercase",letterSpacing:".5px"}}>Set Details</div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Name *</label>
              <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Senior Sales Agent" disabled={isReadOnly}/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Description</label>
              <textarea value={form.description||""} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2} placeholder="What does this role do?" disabled={isReadOnly}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:".5px"}}>Colour</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {COLORS.map(c=>(
                  <button key={c} onClick={()=>!isReadOnly&&setForm(f=>({...f,color:c}))}
                    style={{width:28,height:28,borderRadius:"50%",background:c,border:`3px solid ${form.color===c?"#0F2540":"transparent"}`,cursor:isReadOnly?"default":"pointer",transition:".15s"}}/>
                ))}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"#0F2540",marginBottom:12,textTransform:"uppercase",letterSpacing:".5px"}}>Summary</div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div style={{width:40,height:40,borderRadius:10,background:form.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:16}}>
                {form.name?form.name[0].toUpperCase():"?"}
              </div>
              <div>
                <div style={{fontWeight:700,fontSize:14,color:"#0F2540"}}>{form.name||"Unnamed"}</div>
                <div style={{fontSize:12,color:"#A0AEC0"}}>{ALL_PERM_KEYS.filter(k=>form[k]).length} of 13 permissions</div>
              </div>
            </div>
            {PERMISSION_DEFS.map(g=>{
              const enabled = g.perms.filter(p=>form[p.key]);
              if (!enabled.length) return null;
              return (
                <div key={g.group} style={{marginBottom:8}}>
                  <div style={{fontSize:10,fontWeight:700,color:g.color,textTransform:"uppercase",letterSpacing:".5px",marginBottom:3}}>{g.icon} {g.group}</div>
                  {enabled.map(p=><div key={p.key} style={{fontSize:11,color:"#4A5568",paddingLeft:8}}>✓ {p.label}</div>)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Permission toggles */}
        <div>
          {PERMISSION_DEFS.map(g=>(
            <div key={g.group} style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:12,padding:"16px",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:18}}>{g.icon}</span>
                  <span style={{fontWeight:700,fontSize:14,color:"#0F2540"}}>{g.group}</span>
                  <span style={{fontSize:11,color:"#A0AEC0"}}>{g.perms.filter(p=>form[p.key]).length}/{g.perms.length} enabled</span>
                </div>
                {!isReadOnly&&(
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setAllInGroup(g.group,true)}
                      style={{padding:"3px 10px",borderRadius:6,border:"1.5px solid #A8D5BE",background:"#E6F4EE",color:"#1A7F5A",fontSize:11,fontWeight:600,cursor:"pointer"}}>All on</button>
                    <button onClick={()=>setAllInGroup(g.group,false)}
                      style={{padding:"3px 10px",borderRadius:6,border:"1.5px solid #F0BCBC",background:"#FAEAEA",color:"#B83232",fontSize:11,fontWeight:600,cursor:"pointer"}}>All off</button>
                  </div>
                )}
              </div>
              {g.perms.map(p=>(
                <div key={p.key} onClick={()=>!isReadOnly&&togglePerm(p.key)}
                  style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:8,marginBottom:6,background:form[p.key]?g.bg:"#FAFBFC",border:`1.5px solid ${form[p.key]?g.color+"33":"#E2E8F0"}`,cursor:isReadOnly?"default":"pointer",transition:"all .15s"}}>
                  {/* Toggle */}
                  <div style={{width:40,height:22,borderRadius:11,background:form[p.key]?g.color:"#E2E8F0",position:"relative",flexShrink:0,transition:"background .2s"}}>
                    <div style={{position:"absolute",top:3,left:form[p.key]?20:3,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:form[p.key]?g.color:"#4A5568"}}>{p.label}</div>
                    <div style={{fontSize:11,color:"#A0AEC0"}}>{p.desc}</div>
                  </div>
                  {form[p.key]&&<span style={{fontSize:11,fontWeight:700,color:g.color}}>✓</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Save bar */}
      {!isReadOnly&&(
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:14,marginTop:8,borderTop:"1px solid #E2E8F0"}}>
          <button onClick={()=>setView("list")}
            style={{padding:"9px 22px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            style={{padding:"9px 28px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>
            {saving?"Saving…":editing?"Save Changes":"Create Permission Set"}
          </button>
        </div>
      )}
    </div>
  );
}



// ══════════════════════════════════════════════════════════════════
// LEASING ENQUIRIES — Tenant lead tracking for Leasing CRM
// Uses same leads table, filtered by property_type = "Lease"
// Stages: New Enquiry → Contacted → Viewing Scheduled → Offer Made → Lease Signed → Lost
// ══════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════
// LEASING ENQUIRIES — Tenant contacts + Lease Opportunities
// Same architecture as Sales Leads + Opportunities
// ══════════════════════════════════════════════════════════════════

const LEASE_STAGES = ["New Enquiry","Contacted","Viewing","Offer Made","Reserved","Lease Signed","Lost"];
const LEASE_STAGE_META = {
  "New Enquiry":   {c:"#1A5FA8", bg:"#E6EFF9"},
  "Contacted":     {c:"#5B3FAA", bg:"#EEE8F9"},
  "Viewing":       {c:"#A06810", bg:"#FDF3DC"},
  "Offer Made":    {c:"#B83232", bg:"#FAEAEA"},
  "Reserved":      {c:"#1A7F5A", bg:"#E6F4EE"},
  "Lease Signed":  {c:"#0F2540", bg:"#E2E8F0"},
  "Lost":          {c:"#718096", bg:"#F7F9FC"},
};

// ── Lease Opportunity Detail ──────────────────────────────────────

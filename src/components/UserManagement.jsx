function UserManagement({currentUser, leads=[], activities=[], showToast, appConfig={}, onConfigChange=()=>{}}) {
  const [subTab, setSubTab] = useState("users");
  return (
    <div className="fade-in" style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{display:"flex",gap:4,marginBottom:14}}>
        {[["users","👥 Users"],["settings","⚙ Settings"]].map(([id,l])=>(
          <button key={id} onClick={()=>setSubTab(id)}
            style={{padding:"7px 16px",borderRadius:8,border:`1.5px solid ${subTab===id?"#0F2540":"#E2E8F0"}`,background:subTab===id?"#0F2540":"#fff",color:subTab===id?"#fff":"#4A5568",fontSize:13,fontWeight:subTab===id?600:400,cursor:"pointer"}}>
            {l}
          </button>
        ))}
      </div>
      {subTab==="users"  && <UsersTab currentUser={currentUser} showToast={showToast}/>}
      {subTab==="settings" && <SettingsTab appConfig={appConfig} onConfigChange={onConfigChange} currentUser={currentUser} showToast={showToast}/>}
    </div>
  );
}

function UsersTab({currentUser, showToast}) {
  const [users,     setUsers]     = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [editUser,  setEditUser]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const isSuperAdmin = currentUser.is_super_admin || currentUser.role === "super_admin";
  const blank = {full_name:"",email:"",role:"sales_agent",is_active:true,company_id:currentUser.company_id||"",password:""};
  const [form, setForm] = useState(blank);
  const sf = k => e => setForm(f=>({...f,[k]:e.target?.value??e}));

  const loadUsers = useCallback(async()=>{
    setLoading(true);
    const cid = currentUser.company_id || localStorage.getItem("propccrm_company_id") || null;
    // Super admin sees all users (can filter by company via selector)
    // All other roles only see users from their own company
    const userQuery = isSuperAdmin
      ? supabase.from("profiles").select("*").order("created_at",{ascending:false})
      : supabase.from("profiles").select("*").eq("company_id", cid).order("created_at",{ascending:false});
    const queries = [userQuery];
    if(isSuperAdmin) queries.push(supabase.from("companies").select("id,name,business_type").order("name"));
    const [u, co] = await Promise.all(queries);
    setUsers(u.data||[]);
    if(co) setCompanies(co.data||[]);
    setLoading(false);
  },[isSuperAdmin]);
  useEffect(()=>{loadUsers();},[loadUsers]);

  const saveUser=async()=>{
    if(!form.full_name.trim()||!form.email.trim()){showToast("Name and email required","error");return;}
    if(!form.company_id&&!currentUser.company_id){showToast("Please select a company","error");return;}
    setSaving(true);
    try{
      if(editUser){
        const{error}=await supabase.from("profiles").update({
          full_name:form.full_name,role:form.role,is_active:form.is_active,
          company_id:form.company_id||currentUser.company_id||null,
        }).eq("id",editUser.id);
        if(error)throw error;
        showToast("User updated","success");
      } else {
        // Secure user creation via serverless API route
        const tempPw = form.password || Math.random().toString(36).slice(-8)+"A1!";
        const activeCompanyId = form.company_id || currentUser.company_id || localStorage.getItem("propccrm_company_id") || null;
        const res = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            password: tempPw,
            full_name: form.full_name,
            role: form.role,
            company_id: activeCompanyId,
          })
        });
        const result = await res.json();
        if(!res.ok){ showToast(result.error||"Failed to create user","error"); setSaving(false); return; }

        // Update profile with role, company, active status
        await new Promise(r=>setTimeout(r,1000));
        const{error:pErr}=await supabase.from("profiles").update({
          full_name:form.full_name,
          role:form.role,
          is_active:true,
          company_id:activeCompanyId,
        }).eq("id",result.user.id);
        if(pErr) showToast("User created but profile update failed: "+pErr.message,"error");
        else {
          showToast(`✓ User created: ${form.email}  |  Temp password: ${tempPw}  |  Share this with them securely`,"success");
          navigator.clipboard?.writeText(`Email: ${form.email}\nTemp Password: ${tempPw}`).catch(()=>{});
        }
      }
      setShowAdd(false);setEditUser(null);setForm(blank);loadUsers();
    }catch(e){showToast(e.message,"error");}
    setSaving(false);
  };

  const toggleActive=async(user)=>{
    await supabase.from("profiles").update({is_active:!user.is_active}).eq("id",user.id);
    setUsers(p=>p.map(u=>u.id===user.id?{...u,is_active:!u.is_active}:u));
    showToast(user.is_active?"User deactivated":"User activated","success");
  };

  const resetPassword=async(user)=>{
    const newPw=prompt("Set new password for "+user.full_name+"\n(minimum 8 characters):");
    if(!newPw||newPw.length<8){if(newPw!==null)showToast("Password must be at least 8 characters","error");return;}
    try{
      const res=await fetch("/api/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:user.id,password:newPw})});
      if(!res.ok){const e=await res.json();showToast(e.message||"Failed","error");return;}
      showToast("✓ Password reset for "+user.full_name,"success");
      navigator.clipboard?.writeText("Email: "+user.email+"\nPassword: "+newPw).catch(()=>{});
    }catch(e){showToast(e.message,"error");}
  };

  if(loading)return <Spinner msg="Loading users…"/>;

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontSize:13,color:"#718096"}}>{users.length} users · {users.filter(u=>u.is_active).length} active</span>
        <button onClick={()=>{setForm(blank);setEditUser(null);setShowAdd(true);}}
          style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>
          + Add User
        </button>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead style={{position:"sticky",top:0}}>
            <tr style={{background:"#0F2540"}}>
              {["Name","Email","Role","Company","Status","Actions"].map(h=>(
                <th key={h} style={{padding:"9px 12px",textAlign:"left",fontSize:10,fontWeight:600,color:"#C9A84C",textTransform:"uppercase",letterSpacing:".5px"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u,i)=>(
              <tr key={u.id} style={{background:i%2===0?"#fff":"#FAFBFC",borderBottom:"1px solid #F0F2F5"}}>
                <td style={{padding:"9px 12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <Av name={u.full_name||u.email} size={28}/>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:"#0F2540"}}>{u.full_name||"—"}</div>
                      {u.is_super_admin&&<span style={{fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:20,background:"#FDF3DC",color:"#8A6200"}}>Super Admin</span>}
                    </div>
                  </div>
                </td>
                <td style={{padding:"9px 12px",fontSize:12,color:"#4A5568"}}>{u.email}</td>
                <td style={{padding:"9px 12px"}}><RoleBadge role={u.role}/></td>
                <td style={{padding:"9px 12px",fontSize:12,color:"#4A5568",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {companies.find(c=>c.id===u.company_id)?.name||<span style={{color:"#A0AEC0"}}>—</span>}
                </td>
                <td style={{padding:"9px 12px"}}>
                  <span style={{fontSize:11,fontWeight:600,padding:"2px 8px",borderRadius:20,background:u.is_active?"#E6F4EE":"#F7F9FC",color:u.is_active?"#1A7F5A":"#718096"}}>
                    {u.is_active?"Active":"Inactive"}
                  </span>
                </td>
                <td style={{padding:"9px 12px"}}>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>{setForm({...blank,...u});setEditUser(u);setShowAdd(true);}}
                      style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:"1.5px solid #E2E8F0",background:"#fff",cursor:"pointer"}}>Edit</button>
                    {!u.is_super_admin&&u.id!==currentUser.id&&(
                      <button onClick={()=>toggleActive(u)}
                        style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:`1.5px solid ${u.is_active?"#F0BCBC":"#A8D5BE"}`,background:u.is_active?"#FAEAEA":"#E6F4EE",color:u.is_active?"#B83232":"#1A7F5A",cursor:"pointer"}}>
                        {u.is_active?"Deactivate":"Activate"}
                      </button>
                    )}
                    {(currentUser.role==="super_admin"||currentUser.role==="admin")&&!u.is_super_admin&&(
                      <button onClick={()=>resetPassword(u)}
                        style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:"1.5px solid rgba(201,168,76,.5)",background:"rgba(201,168,76,.08)",color:"#8A6200",cursor:"pointer"}}>
                        🔑 Reset PW
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAdd&&(
        <div style={{position:"fixed",inset:0,background:"rgba(11,31,58,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"1rem"}}>
          <div style={{background:"#fff",borderRadius:16,width:480,maxWidth:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 20px 60px rgba(11,31,58,.35)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.5rem",borderBottom:"1px solid #E8EDF4",background:"#fff"}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#fff"}}>{editUser?"Edit User":"Add New User"}</span>
              <button onClick={()=>{setShowAdd(false);setEditUser(null);}} style={{background:"none",border:"none",fontSize:22,color:"#C9A84C",cursor:"pointer"}}>×</button>
            </div>
            <div style={{overflowY:"auto",padding:"1.25rem 1.5rem"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Full Name *</label><input value={form.full_name} onChange={sf("full_name")}/></div>
                <div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Email *</label><input type="email" value={form.email} onChange={sf("email")} disabled={!!editUser}/></div>
                {!editUser&&<div style={{gridColumn:"1/-1"}}><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Temporary Password</label><input type="password" value={form.password} onChange={sf("password")} placeholder="Leave blank to auto-generate"/></div>}
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Role</label>
                  <select value={form.role} onChange={sf("role")}>
                    {["super_admin","admin","sales_manager","sales_agent","leasing_manager","leasing_agent","viewer"].map(r=><option key={r} value={r}>{r.replace(/_/g," ")}</option>)}
                  </select>
                </div>
                <div><label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Status</label>
                  <select value={form.is_active?"active":"inactive"} onChange={e=>setForm(f=>({...f,is_active:e.target.value==="active"}))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                {/* Company selector — super admin sees all companies, others see their own */}
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#4A5568",display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:".5px"}}>Company *</label>
                  {isSuperAdmin && companies.length > 0 ? (
                    <select value={form.company_id} onChange={sf("company_id")} style={{border: !form.company_id?"1.5px solid #B83232":undefined}}>
                      <option value="">— Select Company —</option>
                      {companies.map(c=><option key={c.id} value={c.id}>{c.name} ({c.business_type})</option>)}
                    </select>
                  ) : (
                    <input value={companies.find(c=>c.id===currentUser.company_id)?.name || currentUser.company_id || "Your Company"} disabled style={{background:"#F7F9FC",color:"#718096"}}/>
                  )}
                  {!form.company_id && <div style={{fontSize:10,color:"#B83232",marginTop:3}}>⚠ Company is required</div>}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",padding:"1rem 1.5rem",borderTop:"1px solid #E2E8F0"}}>
              <button onClick={()=>{setShowAdd(false);setEditUser(null);}} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
              <button onClick={saveUser} disabled={saving} style={{padding:"9px 24px",borderRadius:8,border:"none",background:saving?"#A0AEC0":"#0F2540",color:"#fff",fontSize:13,fontWeight:600,cursor:saving?"not-allowed":"pointer"}}>{saving?"Saving…":editUser?"Save Changes":"Add User"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


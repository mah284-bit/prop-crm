/* =====================================================================
 * Commission Invoice DOCUMENT — complete, payable invoice with particulars.
 * Adds to CommissionOutstanding.jsx (clean component, no duplication risk):
 *   - "📄 View Invoice" button on each row
 *   - a fetch that pulls deal particulars via opportunity_id
 *     (buyer via lead, property via unit->project, agreed price, agreement)
 *   - a branded invoice-document modal: payee header + TRN, billed-to developer,
 *     RE particulars (project/unit/buyer/SPA), commission basis, calc table
 *     (gross + VAT + net), bank details, due date, terms
 *   - "📤 Issue & Send to Developer" (reuses issue logic) + Print
 * Demo-safe: on-screen document (real PDF + email = Phase 2.3). No schema change.
 * Safe: .bak, idempotent, anchored on unique strings.
 * Run from repo root:  node patch_commission_invoice_doc.cjs
 * ===================================================================== */
const fs = require("fs");
const path = "src/components/CommissionOutstanding.jsx";
if (!fs.existsSync(path)) { console.error("ERROR: run from repo root."); process.exit(1); }
let src = fs.readFileSync(path, "utf8");
const nl = src.includes("\r\n") ? "\r\n" : "\n";

if (src.includes("/* invoice-document */")) {
  console.log("Already patched (invoice document) — no changes made.");
  process.exit(0);
}

// --- 1) add modal state next to issueModal/paymentModal ---
const stateAnchor = '  const [paymentModal, setPaymentModal] = useState(null); // {invoice, amount, date, action}';
if (!src.includes(stateAnchor)) { console.error("ERROR: state anchor not found. Aborting."); process.exit(1); }
src = src.replace(stateAnchor, stateAnchor + nl +
  '  /* invoice-document */ const [docModal, setDocModal] = useState(null); // {invoice, particulars|null, loading}');

// --- 2) add the particulars fetch + openInvoiceDoc, placed right before loadInvoices ---
const fnAnchor = '  async function loadInvoices() {';
if (!src.includes(fnAnchor)) { console.error("ERROR: loadInvoices anchor not found. Aborting."); process.exit(1); }
const fetchFn = [
'  // invoice-document — fetch deal particulars via opportunity_id, then open the document',
'  async function openInvoiceDoc(inv) {',
'    setDocModal({ invoice: inv, particulars: null, loading: true });',
'    try {',
'      let particulars = {};',
'      if (inv.opportunity_id) {',
'        const { data: opp } = await supabase.from("opportunities")',
'          .select("id, title, lead_id, unit_id, final_price, budget, commission_pct, master_agreement_id, won_at, stage_updated_at")',
'          .eq("id", inv.opportunity_id).single();',
'        if (opp) {',
'          particulars.opp = opp;',
'          if (opp.lead_id) {',
'            const { data: lead } = await supabase.from("leads").select("name, email, phone").eq("id", opp.lead_id).single();',
'            particulars.buyer = lead || null;',
'          }',
'          if (opp.unit_id) {',
'            const { data: unit } = await supabase.from("project_units")',
'              .select("unit_ref, sub_type, bedrooms, size_sqft, view, project_id").eq("id", opp.unit_id).single();',
'            particulars.unit = unit || null;',
'            if (unit && unit.project_id) {',
'              const { data: proj } = await supabase.from("projects").select("name, developer, community, emirate").eq("id", unit.project_id).single();',
'              particulars.project = proj || null;',
'            }',
'          }',
'          if (opp.master_agreement_id) {',
'            const { data: ma } = await supabase.from("master_agreements").select("title, agreement_number, default_commission_pct").eq("id", opp.master_agreement_id).single();',
'            particulars.agreement = ma || null;',
'          }',
'        }',
'      }',
'      setDocModal({ invoice: inv, particulars, loading: false });',
'    } catch (err) {',
'      console.error("Invoice particulars fetch failed:", err);',
'      setDocModal({ invoice: inv, particulars: {}, loading: false });',
'    }',
'  }',
'',
].join(nl);
src = src.replace(fnAnchor, fetchFn + fnAnchor);

// --- 3) add the "View Invoice" button into the row action cell ---
const rowBtnAnchor = '                      <button onClick={act.action} style={{padding:"4px 10px", background:"#0F2540", color:"#fff", border:"none", borderRadius:5, fontSize:10, fontWeight:600, cursor:"pointer"}}>{act.label}</button>';
if (!src.includes(rowBtnAnchor)) { console.error("ERROR: row action button anchor not found. Aborting."); process.exit(1); }
src = src.replace(rowBtnAnchor,
'                      <button onClick={()=>openInvoiceDoc(inv)} style={{padding:"4px 10px", background:"#fff", color:"#0F2540", border:"1px solid #0F2540", borderRadius:5, fontSize:10, fontWeight:600, cursor:"pointer", marginRight:6}}>📄 View</button>' + nl +
rowBtnAnchor);

// --- 4) inject the invoice-document modal before the closing of the issue modal block.
// Anchor: the STAGE 6 COMPLETE footer strip (unique), inject modal right before its wrapper close.
const footAnchor = '          <div style={{marginTop:14, padding:"10px 14px", background:"#F0F4FA", borderRadius:8, border:"1px solid #DBE4F0", fontSize:11, color:"#1E2D3F", display:"flex", alignItems:"center", gap:10}}>';
if (!src.includes(footAnchor)) { console.error("ERROR: footer anchor not found. Aborting."); process.exit(1); }

const docModal = [
'          {/* invoice-document modal */}',
'          {docModal && (()=>{',
'            const inv = docModal.invoice; const p = docModal.particulars || {};',
'            const due = inv.invoice_date ? new Date(new Date(inv.invoice_date).getTime()+60*864e5).toISOString().slice(0,10) : "On issue + 60 days";',
'            const devName = developerName(inv.developer_id);',
'            const propLine = [p.project?.name, p.unit?.unit_ref, p.unit?.sub_type, p.unit?.size_sqft?`${p.unit.size_sqft} sqft`:null].filter(Boolean).join(" · ");',
'            return (',
'              <div onClick={()=>setDocModal(null)} style={{position:"fixed",inset:0,background:"rgba(11,31,58,.55)",display:"flex",alignItems:"flex-start",justifyContent:"center",zIndex:1000,padding:"24px",overflowY:"auto"}}>',
'                <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,maxWidth:680,width:"100%",boxShadow:"0 24px 70px rgba(11,31,58,.35)",overflow:"hidden"}}>',
'                  {/* doc header */}',
'                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"20px 26px",borderBottom:"2px solid #0F2540"}}>',
'                    <div>',
'                      <div style={{fontFamily:"\'Playfair Display\',serif",fontSize:20,fontWeight:800,color:"#0F2540"}}>{currentUser?.company_name||"Al Mansoori Properties"}</div>',
'                      <div style={{fontSize:11,color:"#64748B",marginTop:2}}>UAE Real Estate Brokerage · TRN: 100xxxxxxxxxxxx3</div>',
'                      <div style={{fontSize:11,color:"#64748B"}}>Dubai, United Arab Emirates</div>',
'                    </div>',
'                    <div style={{textAlign:"right"}}>',
'                      <div style={{fontFamily:"\'Playfair Display\',serif",fontSize:18,fontWeight:800,color:"#C9A84C"}}>COMMISSION INVOICE</div>',
'                      <div style={{fontSize:12,color:"#0F2540",fontWeight:700,marginTop:2}}>{inv.invoice_number||"(draft — number on issue)"}</div>',
'                      <div style={{fontSize:11,color:"#64748B"}}>Date: {inv.invoice_date||"—"}</div>',
'                      <div style={{fontSize:11,color:"#64748B"}}>Due: {due}</div>',
'                    </div>',
'                  </div>',
'                  {docModal.loading ? (',
'                    <div style={{padding:"40px",textAlign:"center",color:"#64748B",fontSize:13}}>Loading deal particulars…</div>',
'                  ) : (',
'                  <div style={{padding:"20px 26px"}}>',
'                    {/* billed to */}',
'                    <div style={{display:"flex",justifyContent:"space-between",gap:20,marginBottom:18}}>',
'                      <div>',
'                        <div style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>Billed To</div>',
'                        <div style={{fontSize:14,fontWeight:700,color:"#0F2540"}}>{devName}</div>',
'                        <div style={{fontSize:11,color:"#64748B"}}>Accounts Payable Dept.</div>',
'                      </div>',
'                      <div style={{textAlign:"right"}}>',
'                        <div style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:4}}>Status</div>',
'                        <div style={{fontSize:13,fontWeight:700,color:"#0F2540"}}>{(inv.invoice_status||"draft").toUpperCase()}</div>',
'                      </div>',
'                    </div>',
'                    {/* RE particulars */}',
'                    <div style={{background:"#F7F9FC",borderRadius:8,padding:"12px 14px",marginBottom:16}}>',
'                      <div style={{fontSize:10,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px",marginBottom:6}}>Re: Commission for Property Transaction</div>',
'                      <table style={{width:"100%",fontSize:12,color:"#0F2540",borderCollapse:"collapse"}}>',
'                        <tbody>',
'                          <tr><td style={{padding:"3px 0",color:"#64748B",width:"40%"}}>Property</td><td style={{padding:"3px 0",fontWeight:600}}>{propLine||p.opp?.title||"—"}</td></tr>',
'                          {p.project?.community && <tr><td style={{padding:"3px 0",color:"#64748B"}}>Community</td><td style={{padding:"3px 0"}}>{p.project.community}{p.project.emirate?`, ${p.project.emirate}`:""}</td></tr>}',
'                          <tr><td style={{padding:"3px 0",color:"#64748B"}}>Buyer</td><td style={{padding:"3px 0",fontWeight:600}}>{p.buyer?.name||"—"}</td></tr>',
'                          <tr><td style={{padding:"3px 0",color:"#64748B"}}>Developer</td><td style={{padding:"3px 0"}}>{devName}</td></tr>',
'                          <tr><td style={{padding:"3px 0",color:"#64748B"}}>SPA / Closing date</td><td style={{padding:"3px 0"}}>{(p.opp?.won_at||p.opp?.stage_updated_at||"").slice(0,10)||"—"}</td></tr>',
'                          <tr><td style={{padding:"3px 0",color:"#64748B"}}>Agreement</td><td style={{padding:"3px 0"}}>{p.agreement?.title||p.agreement?.agreement_number||`Master Agreement with ${devName}`}</td></tr>',
'                        </tbody>',
'                      </table>',
'                    </div>',
'                    {/* calculation */}',
'                    <table style={{width:"100%",fontSize:13,borderCollapse:"collapse",marginBottom:16}}>',
'                      <thead><tr style={{borderBottom:"1px solid #E2E8F0"}}>',
'                        <th style={{textAlign:"left",padding:"8px 0",fontSize:10,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px"}}>Description</th>',
'                        <th style={{textAlign:"right",padding:"8px 0",fontSize:10,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".5px"}}>Amount (AED)</th>',
'                      </tr></thead>',
'                      <tbody>',
'                        <tr><td style={{padding:"7px 0",color:"#0F2540"}}>Sales commission @ {Number(inv.commission_pct).toFixed(2)}% of agreed sale price {fmtAED(inv.sale_price)}</td><td style={{textAlign:"right",padding:"7px 0",color:"#0F2540"}}>{fmtAED(inv.commission_gross)}</td></tr>',
'                        <tr><td style={{padding:"7px 0",color:"#64748B"}}>VAT @ {Number(inv.vat_pct).toFixed(0)}%</td><td style={{textAlign:"right",padding:"7px 0",color:"#64748B"}}>{fmtAED(inv.vat_amount)}</td></tr>',
'                        <tr style={{borderTop:"2px solid #0F2540"}}><td style={{padding:"9px 0",fontWeight:800,color:"#0F2540",fontSize:14}}>Total Payable</td><td style={{textAlign:"right",padding:"9px 0",fontWeight:800,color:"#0F2540",fontSize:14}}>{fmtAED(inv.commission_net)}</td></tr>',
'                        {Number(inv.amount_received)>0 && <tr><td style={{padding:"5px 0",color:"#16A34A"}}>Received</td><td style={{textAlign:"right",padding:"5px 0",color:"#16A34A"}}>{fmtAED(inv.amount_received)}</td></tr>}',
'                      </tbody>',
'                    </table>',
'                    {/* bank + terms */}',
'                    <div style={{background:"#F7F9FC",borderRadius:8,padding:"12px 14px",fontSize:11,color:"#64748B",marginBottom:8}}>',
'                      <div style={{fontWeight:700,color:"#0F2540",marginBottom:4}}>Payment Details</div>',
'                      <div>Bank: Emirates NBD · A/C Name: {currentUser?.company_name||"Al Mansoori Properties"} · IBAN: AE00 0000 0000 0000 0000 000</div>',
'                      <div style={{marginTop:4}}>Terms: Net commission due within 60 days of SPA signing. Please quote the invoice number with payment.</div>',
'                    </div>',
'                  </div>',
'                  )}',
'                  {/* actions */}',
'                  <div style={{display:"flex",justifyContent:"flex-end",gap:8,padding:"14px 26px",borderTop:"1px solid #E8EDF4",background:"#FAFBFE"}}>',
'                    <button onClick={()=>window.print()} style={{padding:"8px 16px",borderRadius:8,border:"1.5px solid #D1D9E6",background:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",color:"#475569"}}>🖨 Print</button>',
'                    {inv.invoice_status==="draft" && <button onClick={()=>{setDocModal(null);setIssueModal({invoice:inv,number:"",date:new Date().toISOString().slice(0,10)});}} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>📤 Issue & Send to Developer</button>}',
'                    {inv.invoice_status!=="draft" && <button onClick={()=>setDocModal(null)} style={{padding:"8px 16px",borderRadius:8,border:"none",background:"#0F2540",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Close</button>}',
'                  </div>',
'                </div>',
'              </div>',
'            );',
'          })()}',
'',
].join(nl);
src = src.replace(footAnchor, docModal + footAnchor);

fs.writeFileSync(path + ".bak", fs.readFileSync(path, "utf8"));
fs.writeFileSync(path, src);
console.log("OK: Commission invoice document added (View Invoice button + particulars fetch + branded doc modal + Issue&Send).");
console.log("    Backup: " + path + ".bak");
console.log("    Next: npm run build");

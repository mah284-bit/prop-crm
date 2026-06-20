import { useState, useRef, useEffect } from "react";

export default function UnitPickerMulti({
  initialBedrooms = null,
  onSelect,
  onClose,
  units = [],
  projects = [],
  salePricing = [],
}) {
  const [search, setSearch] = useState("");
  const [projFilter, setProjFilter] = useState("All");
  const [bedFilter, setBedFilter] = useState(initialBedrooms !== null ? String(initialBedrooms) : "All");
  const [showReserved, setShowReserved] = useState(false);
  const [selectedUnitIds, setSelectedUnitIds] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose && onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const pricingMap = (salePricing || []).reduce((acc, sp) => {
    if (sp.unit_id && Number(sp.asking_price) > 0) {
      acc[sp.unit_id] = Number(sp.asking_price);
    }
    return acc;
  }, {});

  const unitsWithoutPrice = (units || []).filter(u => !pricingMap[u.id]).length;
  const projectOptions = Array.from(new Set((units || []).filter(u => pricingMap[u.id]).map((u) => u.project_id).filter(Boolean))).map((pid) => (projects || []).find((p) => p.id === pid)).filter(Boolean);

  let pool = (units || []).filter(u => pricingMap[u.id]);
  if (!showReserved) pool = pool.filter((u) => u.status !== "Reserved" && u.status !== "Sold");
  if (projFilter !== "All") pool = pool.filter((u) => u.project_id === projFilter);
  if (bedFilter !== "All") {
    if (bedFilter === "Studio") pool = pool.filter((u) => u.bedrooms === 0);
    else if (bedFilter === "4+") pool = pool.filter((u) => u.bedrooms >= 4);
    else pool = pool.filter((u) => String(u.bedrooms) === bedFilter);
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    pool = pool.filter((u) => {
      const proj = (projects || []).find((p) => p.id === u.project_id);
      const haystack = [u.unit_ref, u.sub_type, u.view, proj?.name, u.bedrooms === 0 ? "studio" : `${u.bedrooms}br`].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }
  pool = pool.sort((a, b) => {
    const pa = (projects || []).find((p) => p.id === a.project_id)?.name || "";
    const pb = (projects || []).find((p) => p.id === b.project_id)?.name || "";
    if (pa !== pb) return pa.localeCompare(pb);
    return (a.unit_ref || "").localeCompare(b.unit_ref || "");
  });

  const visible = pool.slice(0, 200);
  const toggleUnit = (unitId) => {
    setSelectedUnitIds(prev => prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]);
  };

  const handleDone = () => {
    const selectedObjects = selectedUnitIds.map(id => units.find(u => u.id === id)).filter(Boolean);
    if (onSelect) onSelect(selectedObjects);
  };

  const fmtAed = (n) => `AED ${Math.round(Number(n) || 0).toLocaleString()}`;

  return (
    <div ref={containerRef} style={{ background: "#fff", border: "1.5px solid #D1D9E6", borderRadius: 8, boxShadow: "0 14px 32px rgba(15,37,64,.15)", zIndex: 50, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 400 }}>
      <div style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0" }}>
        <input type="text" autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ref, project, BR, view" style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", fontSize: 12, boxSizing: "border-box", outline: "none" }} />
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
          <button type="button" onClick={() => setProjFilter("All")} style={{ padding: "3px 9px", borderRadius: 11, border: `1px solid ${projFilter === "All" ? "#0F2540" : "#E2E8F0"}`, background: projFilter === "All" ? "#0F2540" : "#fff", color: projFilter === "All" ? "#fff" : "#64748B", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>All projects</button>
          {projectOptions.map((p) => <button type="button" key={p.id} onClick={() => setProjFilter(p.id)} style={{ padding: "3px 9px", borderRadius: 11, border: `1px solid ${projFilter === p.id ? "#0F2540" : "#E2E8F0"}`, background: projFilter === p.id ? "#0F2540" : "#fff", color: projFilter === p.id ? "#fff" : "#64748B", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>{p.name}</button>)}
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
          {["All", "Studio", "1", "2", "3", "4+"].map((b) => { const sel = bedFilter === b; const label = b === "All" ? "All sizes" : b === "Studio" ? "Studio" : b === "4+" ? "4BR+" : `${b}BR`; return <button type="button" key={b} onClick={() => setBedFilter(b)} style={{ padding: "3px 9px", borderRadius: 11, border: `1px solid ${sel ? "#0F2540" : "#E2E8F0"}`, background: sel ? "#0F2540" : "#fff", color: sel ? "#fff" : "#64748B", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>{label}</button>; })}
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#64748B", cursor: "pointer", marginLeft: "auto" }}><input type="checkbox" checked={showReserved} onChange={(e) => setShowReserved(e.target.checked)} /> Show Reserved/Sold</label>
        </div>
      </div>
      <div style={{ padding: "6px 12px", fontSize: 10, color: "#94A3B8", fontWeight: 600, borderBottom: "1px solid #F1F5F9" }}>{pool.length} unit{pool.length === 1 ? "" : "s"} {visible.length < pool.length && `(showing first ${visible.length})`}</div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {visible.length === 0 ? <div style={{ padding: "22px 12px", textAlign: "center", color: "#94A3B8" }}>No units match</div> : visible.map((u) => { const proj = (projects || []).find((p) => p.id === u.project_id); const bedLabel = u.bedrooms === 0 ? "Studio" : u.bedrooms ? `${u.bedrooms}BR` : ""; const isReserved = u.status === "Reserved" || u.status === "Sold"; const price = pricingMap[u.id]; const isSelected = selectedUnitIds.includes(u.id); return <div key={u.id} onClick={() => toggleUnit(u.id)} style={{ padding: "8px 12px", borderBottom: "1px solid #F1F5F9", display: "flex", gap: 10, alignItems: "center", opacity: isReserved ? 0.6 : 1, background: isSelected ? "#EFF6FF" : "#fff", cursor: "pointer" }}><input type="checkbox" checked={isSelected} onChange={() => toggleUnit(u.id)} disabled={isReserved} style={{ cursor: isReserved ? "not-allowed" : "pointer", flexShrink: 0, width: 16, height: 16 }} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 700, color: "#0F2540" }}>{u.unit_ref} {isReserved && <span style={{ fontSize: 9, marginLeft: 6, padding: "1px 5px", borderRadius: 7, background: "#FEE2E2", color: "#C53030" }}>{u.status}</span>}</div><div style={{ fontSize: 10, color: "#64748B", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[bedLabel, u.view, proj?.name, u.size_sqft && `${u.size_sqft} sqft`].filter(Boolean).join(" · ")}</div><div style={{ fontSize: 9, color: "#94A3B8", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[u.floor_number && `Floor ${u.floor_number}`, u.bathrooms && `${u.bathrooms} bath`, u.furnishing, u.condition].filter(Boolean).join(" · ")}</div></div>{price && <div style={{ fontSize: 11, fontWeight: 700, color: "#1A5FA8", whiteSpace: "nowrap", flexShrink: 0 }}>{fmtAed(price)}</div>}</div>; })}
      </div>
      <div style={{ padding: "6px 12px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC", display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ fontSize: 10, color: "#94A3B8" }}>{selectedUnitIds.length > 0 && `${selectedUnitIds.length} selected`}</span><div style={{ display: "flex", gap: 6 }}><button onClick={() => onClose && onClose()} style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #D1D9E6", background: "#fff", cursor: "pointer" }}>Cancel</button><button onClick={handleDone} disabled={selectedUnitIds.length === 0} style={{ padding: "3px 10px", borderRadius: 5, border: "none", background: selectedUnitIds.length > 0 ? "#0F2540" : "#CBD5E1", color: "#fff", cursor: selectedUnitIds.length > 0 ? "pointer" : "not-allowed" }}>Done ({selectedUnitIds.length})</button></div></div>
    </div>
  );
}

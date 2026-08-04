import { useState, useEffect, useRef } from "react";

// Day 84: THE SHARED UNIT PICKER.
//
// This was inlined in CreateOpportunityDialog while block creation and the distribution calculator
// used a plain <select> - unusable past about twenty units, and every brokerage has hundreds.
// Extracted rather than duplicated, for one reason above all: THIS PICKER CARRIES DOCTRINE.
// A unit BOOKED BY A CONFIRMED BLOCK is hard-refused with an explanation of when it releases; a
// RESERVED or SOLD unit warns about double-booking before it can be chosen. Those are the Day-74
// claim rules. Doctrine in two places drifts - Day 84 alone found DLD carrying two vocabularies
// (one wrong for six days) and fee constants copied to ten sites. A second picker would have been
// the third instance of the same failure.
//
// THE CALLER PRE-FILTERS. Founder's design: the picker does not need to understand blocks or
// developers - it receives the units it is allowed to show and does the rest. So block creation
// passes units already narrowed to the selected developer, and the project pills inside then show
// only that developer's projects. One developer, any number of projects, any number of units -
// which is how an investor actually buys: two from one tower, four from another.
//
// PROPS
//   units        - the units this caller permits (already filtered)
//   projects     - for names and the project pills
//   salePricing  - for the price on each row; units with no price are excluded entirely
//   value        - selected unit_id, or "" for none
//   onChange     - (unitId) => void
//   onOpenPack   - optional (unitId) => void, shows the Property Pack button when supplied
//   allowIds     - optional Set of unit ids exempt from the Booked hard-refusal. Used when adding
//                  to an EXISTING block: a unit this block already holds is not a conflict.
export default function UnitPicker({
  units,
  projects,
  salePricing,
  value,
  onChange,
  onOpenPack,
  allowIds,
  placeholder = "\u2014 No unit linked yet \u2014 click to search \ud83d\udd0d",
}) {
  const [open, setOpen] = useState(false);
  // Day 84: the panel opens BELOW the field, and inside an already-scrolled modal it can fall off
  // the bottom - the broker has to scroll to find what he just opened. Bring it into view.
  const rootRef = useRef(null);
  useEffect(() => {
    if (!open || !rootRef.current) return;
    const t = setTimeout(() => {
      try { const panel = rootRef.current.querySelector("[data-picker-panel]");
        (panel || rootRef.current).scrollIntoView({ behavior: "smooth", block: "end" }); } catch (e) {}
    }, 30);
    return () => clearTimeout(t);
  }, [open]);
  const [search, setSearch] = useState("");
  const [projFilter, setProjFilter] = useState("All");
  const [bedFilter, setBedFilter] = useState("All");
  const [showReserved, setShowReserved] = useState(false);

  const selectedUnit = (units || []).find((u) => u.id === value);
  const selectedProj = selectedUnit
    ? (projects || []).find((p) => p.id === selectedUnit.project_id)
    : null;

  const projectOptions = Array.from(
    new Set((units || []).map((u) => u.project_id).filter(Boolean))
  )
    .map((pid) => (projects || []).find((p) => p.id === pid))
    .filter(Boolean);

  // 19 May 2026: filter out zero-value inventory. Prevents creating a deal on an unpriced unit.
  const priceById = {};
  (salePricing || []).forEach((sp) => {
    if (sp.unit_id && Number(sp.asking_price) > 0) priceById[sp.unit_id] = Number(sp.asking_price);
  });

  let pool = (units || []).filter((u) => priceById[u.id] > 0);
  if (!showReserved) {
    pool = pool.filter(
      (u) => u.status !== "Reserved" && u.status !== "Sold" && u.status !== "Booked"
    );
  }
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
      const hay = [
        u.unit_ref,
        u.sub_type,
        u.view,
        proj?.name,
        u.bedrooms === 0 ? "studio" : `${u.bedrooms}br`,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }
  pool = pool.sort((a, b) => {
    const pa = (projects || []).find((p) => p.id === a.project_id)?.name || "";
    const pb = (projects || []).find((p) => p.id === b.project_id)?.name || "";
    if (pa !== pb) return pa.localeCompare(pb);
    return (a.unit_ref || "").localeCompare(b.unit_ref || "");
  });
  const visible = pool.slice(0, 200);

  const pill = (active) => ({
    padding: "3px 9px",
    borderRadius: 11,
    border: `1px solid ${active ? "#0F2540" : "#E2E8F0"}`,
    background: active ? "#0F2540" : "#fff",
    color: active ? "#fff" : "#64748B",
    fontSize: 10,
    fontWeight: 600,
    cursor: "pointer",
  });

  const choose = (u) => {
    const exempt = allowIds && allowIds.has && allowIds.has(u.id);
    const isBooked = u.status === "Booked";
    const isReserved = u.status === "Reserved" || u.status === "Sold";
    // THE CLAIM LADDER, unchanged from the 1-to-1 door (Day 74 founder ruling).
    if (isBooked && !exempt) {
      alert(
        u.unit_ref +
          " is held by a confirmed block deal - committed inventory cannot be taken by a new deal. It releases only if the block drops it or the booking clock expires."
      );
      return;
    }
    if (isReserved && !exempt) {
      const ok = window.confirm(
        `\u26a0\ufe0f Unit ${u.unit_ref} is currently ${u.status}.\n\n` +
          `This unit may conflict with another active deal. Selecting it could cause double-booking issues.\n\n` +
          `Click OK to proceed anyway, or Cancel to pick a different unit.`
      );
      if (!ok) return;
    }
    onChange(u.id);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: "8px 12px",
          borderRadius: 7,
          border: "1.5px solid #D1D9E6",
          fontSize: 13,
          background: "#fff",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        {selectedUnit ? (
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, color: "#0F2540" }}>{selectedUnit.unit_ref}</span>
            {onOpenPack && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPack(selectedUnit.id);
                }}
                title="View Property Pack"
                style={{
                  padding: "2px 8px",
                  borderRadius: 5,
                  border: "none",
                  background: "#0F2540",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                📸 Pack
              </button>
            )}
            {priceById[selectedUnit.id] ? (
              <span style={{ fontWeight: 700, color: "#1A5FA8", fontSize: 12 }}>
                AED {Number(priceById[selectedUnit.id]).toLocaleString()}
              </span>
            ) : null}
            <span
              style={{
                fontSize: 11,
                color: "#64748B",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {[
                selectedUnit.bedrooms === 0
                  ? "Studio"
                  : selectedUnit.bedrooms
                  ? `${selectedUnit.bedrooms}BR`
                  : null,
                selectedUnit.sub_type,
                selectedProj?.name,
                selectedUnit.size_sqft && `${selectedUnit.size_sqft} sqft`,
              ]
                .filter(Boolean)
                .join(" \u00b7 ")}
            </span>
          </div>
        ) : (
          <span style={{ color: "#94A3B8" }}>{placeholder}</span>
        )}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {selectedUnit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setOpen(false);
              }}
              style={{
                padding: "2px 7px",
                borderRadius: 5,
                border: "none",
                background: "#E2E8F0",
                color: "#64748B",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          )}
          <span style={{ color: "#94A3B8", fontSize: 11 }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div
          data-picker-panel
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1.5px solid #D1D9E6",
            borderRadius: 8,
            boxShadow: "0 14px 32px rgba(15,37,64,.15)",
            zIndex: 50,
            maxHeight: 380,
            // marker so the open panel can be scrolled fully into view, not just the field
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #E2E8F0" }}>
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Search by ref, project, BR, view (e.g. 'DAM 2BR' or 'villa')"
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: 6,
                border: "1.5px solid #E2E8F0",
                fontSize: 12,
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            <div
              style={{
                display: "flex",
                gap: 5,
                flexWrap: "wrap",
                marginTop: 8,
                alignItems: "center",
              }}
            >
              <button onClick={() => setProjFilter("All")} style={pill(projFilter === "All")}>
                All projects
              </button>
              {projectOptions.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProjFilter(p.id)}
                  style={pill(projFilter === p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                gap: 5,
                flexWrap: "wrap",
                marginTop: 6,
                alignItems: "center",
              }}
            >
              {["All", "Studio", "1", "2", "3", "4+"].map((b) => (
                <button key={b} onClick={() => setBedFilter(b)} style={pill(bedFilter === b)}>
                  {b === "All"
                    ? "All sizes"
                    : b === "Studio"
                    ? "Studio"
                    : b === "4+"
                    ? "4BR+"
                    : `${b}BR`}
                </button>
              ))}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  color: "#64748B",
                  cursor: "pointer",
                  marginLeft: "auto",
                }}
              >
                <input
                  type="checkbox"
                  checked={showReserved}
                  onChange={(e) => setShowReserved(e.target.checked)}
                />
                Show Reserved/Sold
              </label>
            </div>
          </div>

          <div
            style={{
              padding: "6px 12px",
              fontSize: 10,
              color: "#94A3B8",
              fontWeight: 600,
              letterSpacing: ".4px",
              textTransform: "uppercase",
              borderBottom: "1px solid #F1F5F9",
            }}
          >
            {pool.length} unit{pool.length === 1 ? "" : "s"}
            {visible.length < pool.length && ` (showing first ${visible.length})`}
          </div>

          <div style={{ flex: 1, overflowY: "auto", maxHeight: 280 }}>
            {visible.length === 0 ? (
              <div style={{ padding: "22px 12px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>
                No units match. Try a different filter or search term.
              </div>
            ) : (
              visible.map((u) => {
                const proj = (projects || []).find((p) => p.id === u.project_id);
                const bedLabel = u.bedrooms === 0 ? "Studio" : u.bedrooms ? `${u.bedrooms}BR` : "";
                const isReserved = u.status === "Reserved" || u.status === "Sold";
                const isBooked = u.status === "Booked";
                return (
                  <div
                    key={u.id}
                    onClick={() => choose(u)}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "#fff")}
                    style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid #F1F5F9",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      opacity: isReserved ? 0.6 : 1,
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#0F2540",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {u.unit_ref}
                        {isBooked && (
                          <span
                            style={{
                              fontSize: 9,
                              padding: "1px 5px",
                              borderRadius: 7,
                              background: "#FDE68A",
                              color: "#92400E",
                              fontWeight: 700,
                            }}
                          >
                            BOOKED-BLOCK
                          </span>
                        )}
                        {isReserved && (
                          <span
                            style={{
                              fontSize: 9,
                              padding: "1px 5px",
                              borderRadius: 7,
                              background: "#FEE2E2",
                              color: "#C53030",
                              fontWeight: 700,
                            }}
                          >
                            {u.status?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748B", marginTop: 1 }}>
                        {[bedLabel, u.sub_type, proj?.name, u.size_sqft && `${u.size_sqft} sqft`, u.view]
                          .filter(Boolean)
                          .join(" \u00b7 ")}
                      </div>
                    </div>
                    {priceById[u.id] ? (
                      <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#1A5FA8" }}>
                          AED {Number(priceById[u.id]).toLocaleString()}
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: "#94A3B8", fontStyle: "italic" }}>
                        No price
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div
            style={{
              padding: "6px 12px",
              borderTop: "1px solid #E2E8F0",
              background: "#F8FAFC",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 10, color: "#94A3B8" }}>
              Click a unit to select. Esc or click outside to close.
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{
                padding: "3px 10px",
                borderRadius: 5,
                border: "1px solid #D1D9E6",
                background: "#fff",
                color: "#64748B",
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

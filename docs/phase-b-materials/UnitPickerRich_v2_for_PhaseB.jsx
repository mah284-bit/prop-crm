import { useState, useRef, useEffect } from "react";

/**
 * UnitPickerRich — Rich dropdown unit picker (extracted from CreateOpportunityDialog W6.2)
 *
 * v2 (13 May 2026): Added data integrity price filter
 *
 * Pattern: Click-to-open dropdown
 * - Closed state: shows current selection
 * - Click → opens panel with search + filter pills + result list
 * - Click outside or close button → closes
 *
 * Features:
 * - Text search (unit_ref, sub_type, view, project name, bedrooms)
 * - Project filter pills
 * - Bedroom filter pills (All, Studio, 1BR, 2BR, 3BR, 4BR+)
 * - Show Reserved/Sold toggle (default OFF = hide reserved)
 * - Reserved unit confirmation dialog
 * - Result count display
 * - First-200 limit with "showing first 200" notice
 * - Data integrity: units WITHOUT price are NEVER shown (per Data_Integrity_Spec)
 *
 * Props:
 *   value          (string)    Currently selected unit_id (controlled)
 *   onSelect       (function)  Callback(unitId | "") when user picks/clears
 *   units          (array)     Full units array
 *   projects       (array)     Projects for displaying names
 *   salePricing    (array)     REQUIRED - for data integrity filter (units without price excluded)
 *   excludeReserved (boolean)  If true, ALWAYS exclude reserved (no toggle). Default false.
 *   disabled       (boolean)   Disable the picker entirely
 *   placeholder    (string)    Optional - placeholder when no selection
 *
 * Data Integrity Rule (13 May 2026):
 * Units without a price entry in salePricing OR with asking_price <= 0 are
 * automatically filtered OUT. This prevents creating opportunities for unpriceable
 * units (which corrupted downstream PropPulse + commission calculations).
 * See: docs/Data_Integrity_Spec.md
 *
 * The inventory dashboard surfaces units-without-prices as a separate widget
 * so admins can address them. Brokers see only valid (priced) units.
 */
export default function UnitPickerRich({
  value = "",
  onSelect,
  units = [],
  projects = [],
  salePricing = [],
  excludeReserved = false,
  disabled = false,
  placeholder = "— No unit linked yet — click to search 🔍",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [projFilter, setProjFilter] = useState("All");
  const [bedFilter, setBedFilter] = useState("All");
  const [showReserved, setShowReserved] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Pricing lookup map for fast filtering (Data Integrity)
  const pricingMap = (salePricing || []).reduce((acc, sp) => {
    if (sp.unit_id && Number(sp.asking_price) > 0) {
      acc[sp.unit_id] = Number(sp.asking_price);
    }
    return acc;
  }, {});

  // Total units without price (for "transparency" message in panel)
  const unitsWithoutPrice = (units || []).filter(u => !pricingMap[u.id]).length;

  // Selected unit details
  const selectedUnit = (units || []).find((u) => u.id === value);
  const selectedProj = selectedUnit
    ? (projects || []).find((p) => p.id === selectedUnit.project_id)
    : null;
  const selectedPrice = selectedUnit ? pricingMap[selectedUnit.id] : null;

  // Project options for filter pills (only projects that have PRICED units)
  const projectOptions = Array.from(
    new Set(
      (units || [])
        .filter(u => pricingMap[u.id])  // Data integrity: only priced units
        .map((u) => u.project_id)
        .filter(Boolean)
    )
  )
    .map((pid) => (projects || []).find((p) => p.id === pid))
    .filter(Boolean);

  // Build filtered pool — DATA INTEGRITY FILTER FIRST
  let pool = (units || []).filter(u => pricingMap[u.id]);  // Must have price > 0

  // Reserved/Sold filter
  if (excludeReserved || !showReserved) {
    pool = pool.filter((u) => u.status !== "Reserved" && u.status !== "Sold");
  }

  // Project filter
  if (projFilter !== "All") {
    pool = pool.filter((u) => u.project_id === projFilter);
  }

  // Bedroom filter
  if (bedFilter !== "All") {
    if (bedFilter === "Studio") pool = pool.filter((u) => u.bedrooms === 0);
    else if (bedFilter === "4+") pool = pool.filter((u) => u.bedrooms >= 4);
    else pool = pool.filter((u) => String(u.bedrooms) === bedFilter);
  }

  // Text search
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    pool = pool.filter((u) => {
      const proj = (projects || []).find((p) => p.id === u.project_id);
      const haystack = [
        u.unit_ref,
        u.sub_type,
        u.view,
        proj?.name,
        u.bedrooms === 0 ? "studio" : `${u.bedrooms}br`,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  // Sort by project name then unit_ref
  pool = pool.sort((a, b) => {
    const pa = (projects || []).find((p) => p.id === a.project_id)?.name || "";
    const pb = (projects || []).find((p) => p.id === b.project_id)?.name || "";
    if (pa !== pb) return pa.localeCompare(pb);
    return (a.unit_ref || "").localeCompare(b.unit_ref || "");
  });

  const visible = pool.slice(0, 200);

  // AED formatter
  const fmtAed = (n) => `AED ${Math.round(Number(n) || 0).toLocaleString()}`;

  // Click handler for unit selection
  const handleSelect = (u) => {
    const isReserved = u.status === "Reserved" || u.status === "Sold";
    if (isReserved && !excludeReserved) {
      const ok = window.confirm(
        `⚠️ Unit ${u.unit_ref} is currently ${u.status}.\n\n` +
          `This unit may conflict with another active deal. ` +
          `Selecting it could cause double-booking issues.\n\n` +
          `Click OK to proceed anyway, or Cancel to pick a different unit.`
      );
      if (!ok) return;
    }
    if (onSelect) onSelect(u.id);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Display field */}
      <div
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          padding: "8px 12px",
          borderRadius: 7,
          border: "1.5px solid #D1D9E6",
          fontSize: 13,
          background: disabled ? "#F7F9FC" : "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {selectedUnit ? (
          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 700, color: "#0F2540" }}>{selectedUnit.unit_ref}</span>
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
                selectedPrice && fmtAed(selectedPrice),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        ) : (
          <span style={{ color: "#94A3B8" }}>{placeholder}</span>
        )}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {selectedUnit && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onSelect) onSelect("");
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

      {/* Picker panel */}
      {open && !disabled && (
        <div
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
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Search + filters */}
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

            {/* Project pills */}
            <div
              style={{
                display: "flex",
                gap: 5,
                flexWrap: "wrap",
                marginTop: 8,
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={() => setProjFilter("All")}
                style={{
                  padding: "3px 9px",
                  borderRadius: 11,
                  border: `1px solid ${projFilter === "All" ? "#0F2540" : "#E2E8F0"}`,
                  background: projFilter === "All" ? "#0F2540" : "#fff",
                  color: projFilter === "All" ? "#fff" : "#64748B",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                All projects
              </button>
              {projectOptions.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setProjFilter(p.id)}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 11,
                    border: `1px solid ${projFilter === p.id ? "#0F2540" : "#E2E8F0"}`,
                    background: projFilter === p.id ? "#0F2540" : "#fff",
                    color: projFilter === p.id ? "#fff" : "#64748B",
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>

            {/* Bedroom pills + reserved toggle */}
            <div
              style={{
                display: "flex",
                gap: 5,
                flexWrap: "wrap",
                marginTop: 6,
                alignItems: "center",
              }}
            >
              {["All", "Studio", "1", "2", "3", "4+"].map((b) => {
                const sel = bedFilter === b;
                const label =
                  b === "All"
                    ? "All sizes"
                    : b === "Studio"
                      ? "Studio"
                      : b === "4+"
                        ? "4BR+"
                        : `${b}BR`;
                return (
                  <button
                    type="button"
                    key={b}
                    onClick={() => setBedFilter(b)}
                    style={{
                      padding: "3px 9px",
                      borderRadius: 11,
                      border: `1px solid ${sel ? "#0F2540" : "#E2E8F0"}`,
                      background: sel ? "#0F2540" : "#fff",
                      color: sel ? "#fff" : "#64748B",
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
              {!excludeReserved && (
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
              )}
            </div>
          </div>

          {/* Result count + data integrity notice */}
          <div
            style={{
              padding: "6px 12px",
              fontSize: 10,
              color: "#94A3B8",
              fontWeight: 600,
              letterSpacing: ".4px",
              textTransform: "uppercase",
              borderBottom: "1px solid #F1F5F9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>
              {pool.length} unit{pool.length === 1 ? "" : "s"}
              {visible.length < pool.length && ` (showing first ${visible.length})`}
            </span>
            {unitsWithoutPrice > 0 && (
              <span
                title={`${unitsWithoutPrice} units are hidden because they have no price set. Admins can fix in Inventory.`}
                style={{
                  fontSize: 9,
                  color: "#A06810",
                  background: "#FDF3DC",
                  padding: "1px 6px",
                  borderRadius: 4,
                  textTransform: "none",
                  letterSpacing: "normal",
                  fontWeight: 600,
                  cursor: "help",
                }}
              >
                ⚠ {unitsWithoutPrice} unpriced (hidden)
              </span>
            )}
          </div>

          {/* Results */}
          <div style={{ flex: 1, overflowY: "auto", maxHeight: 280 }}>
            {visible.length === 0 ? (
              <div
                style={{
                  padding: "22px 12px",
                  textAlign: "center",
                  color: "#94A3B8",
                  fontSize: 12,
                }}
              >
                No units match. Try a different filter or search term.
              </div>
            ) : (
              visible.map((u) => {
                const proj = (projects || []).find((p) => p.id === u.project_id);
                const bedLabel =
                  u.bedrooms === 0 ? "Studio" : u.bedrooms ? `${u.bedrooms}BR` : "";
                const isReserved = u.status === "Reserved" || u.status === "Sold";
                const price = pricingMap[u.id];
                return (
                  <div
                    key={u.id}
                    onClick={() => handleSelect(u)}
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
                        {[
                          bedLabel,
                          u.sub_type,
                          proj?.name,
                          u.size_sqft && `${u.size_sqft} sqft`,
                          u.view,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    {price && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#1A5FA8", whiteSpace: "nowrap" }}>
                        {fmtAed(price)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
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
              Click a unit to select. Click outside to close.
            </span>
            <button
              type="button"
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

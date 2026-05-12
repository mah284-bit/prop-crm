import { useState } from "react";

/**
 * UnitSearchPicker — Reusable unit search/picker component
 *
 * Used across the app wherever users need to find and select a unit.
 * Searches across: unit_ref, project name, sub_type, view, bedrooms, size, floor.
 *
 * Props:
 *   units         (array)    Units to display (parent should pre-filter for availability)
 *   projects      (array)    Projects array for displaying project names
 *   salePricing   (array)    Sale pricing data for displaying AED prices
 *   onSelect      (function) Callback(unitId) when user picks a unit
 *   placeholder   (string)   Optional - search box placeholder text
 *   emptyMessage  (string)   Optional - shown when units array is empty
 *   autoFocus     (boolean)  Whether to auto-focus the search input (default true)
 *   maxHeight     (number)   Max height of results list in px (default 180)
 *
 * Example:
 *   <UnitSearchPicker
 *     units={availableUnits}
 *     projects={projects}
 *     salePricing={salePricing}
 *     onSelect={(unitId) => addUnit(unitId)}
 *   />
 *
 * Future: this component is the single integration point for AI-powered
 * unit search. When AI search ships, only this file changes - all callers
 * get the upgrade automatically.
 */
export default function UnitSearchPicker({
  units = [],
  projects = [],
  salePricing = [],
  onSelect,
  placeholder = "🔍 Search units — e.g. AGR, Sobha, 2BR, sea view, villa…",
  emptyMessage = "No units available",
  autoFocus = true,
  maxHeight = 180,
}) {
  const [query, setQuery] = useState("");

  // Format AED helper (matches app convention)
  const fmtAed = (n) => `AED ${Math.round(Number(n) || 0).toLocaleString()}`;

  // Filter logic
  const q = query.trim().toLowerCase();
  const filtered = !q ? units : units.filter((u) => {
    const proj = projects.find((p) => p.id === u.project_id);
    const bedLabel =
      u.bedrooms === 0
        ? "studio"
        : u.bedrooms
          ? `${u.bedrooms}br ${u.bedrooms} bed ${u.bedrooms} bedroom`
          : "";
    const haystack = [
      u.unit_ref,
      proj?.name,
      u.sub_type,
      u.view,
      bedLabel,
      u.size_sqft ? String(u.size_sqft) : null,
      u.floor_number ? `floor ${u.floor_number}` : null,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  // Empty states
  if (units.length === 0) {
    return (
      <div style={{ fontSize: 11, color: "#94A3B8", fontStyle: "italic", padding: "10px" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      {/* Search input */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <input
          type="text"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: "7px 10px 7px 10px",
            borderRadius: 6,
            border: "1.5px solid #E2E8F0",
            fontSize: 12,
            boxSizing: "border-box",
            outline: "none",
          }}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            title="Clear"
            type="button"
            style={{
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
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
      </div>

      {/* No matches message */}
      {filtered.length === 0 && (
        <div style={{ fontSize: 11, color: "#94A3B8", fontStyle: "italic", padding: "10px" }}>
          No units match "{query}"
        </div>
      )}

      {/* Results */}
      {filtered.length > 0 && (
        <div style={{ maxHeight, overflowY: "auto" }}>
          {filtered.map((u) => {
            const proj = projects.find((p) => p.id === u.project_id);
            const sp = (salePricing || []).find((s) => s.unit_id === u.id);
            const bedLabel =
              u.bedrooms === 0 ? "Studio" : u.bedrooms ? `${u.bedrooms}BR` : "";
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  if (onSelect) onSelect(u.id);
                  setQuery("");
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "7px 10px",
                  border: "none",
                  background: "transparent",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "#fff")}
                onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0F2540" }}>
                  {u.unit_ref} · {bedLabel}
                  {u.size_sqft ? ` · ${u.size_sqft} sqft` : ""}
                  {u.view ? ` · ${u.view}` : ""}
                </div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>
                  {[
                    proj?.name,
                    u.floor_number ? `Floor ${u.floor_number}` : null,
                    sp?.asking_price ? fmtAed(sp.asking_price) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

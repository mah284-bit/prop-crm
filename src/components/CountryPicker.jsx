// src/components/CountryPicker.jsx
//
// Phase 2.2A — Searchable country picker.
// Used for nationality, residence, and phone country code selection.
//
// Pattern modeled on UnitSearchPicker.jsx — type-to-filter, flag + name + code.
// Reads from a `countries` array (loaded once in App from reference_countries table)
// and is fully storage-agnostic (parent passes data + callback).
//
// Props:
//   countries  (array)    Array of {iso2, name_en, name_ar, calling_code, flag_emoji, priority}
//   value      (string)   Selected ISO2 code (e.g. "AE"), or "" for none
//   onChange   (function) Called with new ISO2 string when user picks a country
//   placeholder(string)   Optional - text shown when no selection
//   variant    (string)   "full" (default, shows name) or "phone" (shows just flag + code)
//   showFlag   (boolean)  Default true. Set false to omit emoji.
//
// Behavior:
//   - Click to open dropdown
//   - Type to filter (matches name_en, iso2, calling_code)
//   - Priority countries appear first when no search
//   - Click outside or press Escape to close
//   - Selecting an item triggers onChange + closes the dropdown

import { useState, useRef, useEffect } from "react";

export default function CountryPicker({
  countries = [],
  value = "",
  onChange,
  placeholder = "Select country…",
  variant = "full",
  showFlag = true,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // Find currently selected country
  const selected = countries.find((c) => c.iso2 === value) || null;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Auto-focus search input when opening
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Sort: priority first (when no query), then alphabetical
  const q = query.trim().toLowerCase();
  let filtered;
  if (!q) {
    const priority = countries.filter((c) => c.priority).sort((a, b) => a.name_en.localeCompare(b.name_en));
    const rest = countries.filter((c) => !c.priority).sort((a, b) => a.name_en.localeCompare(b.name_en));
    filtered = [...priority, ...rest];
  } else {
    filtered = countries.filter((c) =>
      c.name_en.toLowerCase().includes(q) ||
      c.iso2.toLowerCase().includes(q) ||
      (c.calling_code && c.calling_code.includes(q))
    );
  }

  // Display label for selected
  const renderSelected = () => {
    if (!selected) return <span style={{ color: "#94A3B8" }}>{placeholder}</span>;
    if (variant === "phone") {
      return (
        <span style={{ fontSize: 13, fontWeight: 600, color: "#0F2540" }}>
          {showFlag && <span style={{ marginRight: 6 }}>{selected.flag_emoji}</span>}
          {selected.iso2} +{selected.calling_code}
        </span>
      );
    }
    return (
      <span style={{ fontSize: 13, color: "#0F2540" }}>
        {showFlag && <span style={{ marginRight: 8 }}>{selected.flag_emoji}</span>}
        {selected.name_en}
      </span>
    );
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: "10px 12px",
          background: "#fff",
          border: "1px solid #D1D9E6",
          borderRadius: 8,
          textAlign: "left",
          cursor: "pointer",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {renderSelected()}
        <span style={{ color: "#94A3B8", fontSize: 10, marginLeft: 8 }}>▼</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #D1D9E6",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(11,31,58,0.15)",
            zIndex: 1100,
            maxHeight: 320,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            style={{
              padding: "10px 12px",
              border: "none",
              borderBottom: "1px solid #E8EDF4",
              fontSize: 13,
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                setQuery("");
              }
            }}
          />
          <div style={{ overflowY: "auto", maxHeight: 280 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "12px", fontSize: 12, color: "#94A3B8", textAlign: "center" }}>
                No match
              </div>
            ) : (
              filtered.map((c) => (
                <div
                  key={c.iso2}
                  onClick={() => {
                    onChange?.(c.iso2);
                    setOpen(false);
                    setQuery("");
                  }}
                  style={{
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontSize: 13,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: c.iso2 === value ? "#F1F5F9" : "transparent",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = c.iso2 === value ? "#F1F5F9" : "transparent")}
                >
                  {showFlag && <span>{c.flag_emoji}</span>}
                  <span style={{ flex: 1, color: "#0F2540" }}>{c.name_en}</span>
                  <span style={{ color: "#94A3B8", fontSize: 11, fontWeight: 600 }}>+{c.calling_code}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

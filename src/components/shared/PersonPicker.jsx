import { useState, useMemo, useEffect, useRef } from "react";

// Day 98: PICKING A PERSON FROM A LIST OF SIX HUNDRED.
//
// Founder: "if the list is big, finding would be difficult - the issue is spelling. If misspelt it
// will be difficult to find one. Also phone numbers, email, anything can be used to search."
//
// A plain <select> is fine with six leads and unusable at scale, and a filter box that matches only
// exact substrings is barely better: a broker who types "Mazher" for a lead recorded as "Mazhar"
// finds nothing and concludes the buyer is not in the system.
//
// So this matches three ways, in order of confidence:
//   1. the typed text appears in the name, phone or email  (an ordinary search)
//   2. every WORD typed appears somewhere            ("wei chen" finds "Chen Wei")
//   3. the name SOUNDS like what was typed           ("Mazher" finds "Mazhar", "Fatema" finds "Fatima")
//
// The third is what makes it forgiving. Digits are compared with the formatting stripped, so
// "501234501" finds "+971 50 123 4501".

// A deliberately loose phonetic key. Vowels carry almost no information in transliterated Arabic
// and Indian names - Mazhar/Mazher, Fatima/Fatema, Mohamed/Muhammad - so they are dropped after the
// first letter, and letters that sound alike are folded together.
function soundKey(s) {
  let t = String(s || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!t) return "";
  const first = t[0];
  t = t
    .replace(/ph/g, "f")
    .replace(/[kq]/g, "c")
    .replace(/[yj]/g, "i")
    .replace(/z/g, "s")
    .replace(/v/g, "w")
    .replace(/th/g, "t")
    .replace(/kh/g, "c")
    .replace(/gh/g, "g")
    .replace(/[aeiou]/g, "")
    .replace(/(.)\1+/g, "$1");
  return first + t;
}

const digits = (s) => String(s || "").replace(/\D/g, "");

export default function PersonPicker({
  people = [],
  value = "",
  onChange,
  placeholder = "Select a person\u2026",
  emptyLabel = "\u2014 nobody selected \u2014",
  label,
  disabled = false,
  autoOpenThreshold = 5,   // below this, no search box - it would only be clutter
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  const selected = people.find((p) => p.id === value) || null;

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Close when the click lands outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return people;
    const tDigits = digits(t);
    const words = t.split(/\s+/).filter(Boolean);
    const tKey = soundKey(t);

    const scored = [];
    people.forEach((p) => {
      const name = String(p.name || p.full_name || "").toLowerCase();
      const phone = digits(p.phone);
      const email = String(p.email || "").toLowerCase();
      const hay = name + " " + email;

      // 1. plain substring, on any field
      if (hay.includes(t)) { scored.push([0, p]); return; }
      if (tDigits.length >= 3 && phone.includes(tDigits)) { scored.push([0, p]); return; }

      // 2. every word present, in any order
      if (words.length > 1 && words.every((w) => hay.includes(w))) { scored.push([1, p]); return; }

      // 3. it SOUNDS right - the forgiving pass
      if (tKey.length >= 2) {
        const nameWords = name.split(/\s+/).filter(Boolean);
        if (nameWords.some((w) => soundKey(w).startsWith(tKey) || tKey.startsWith(soundKey(w)))) {
          scored.push([2, p]);
        }
      }
    });
    return scored.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  }, [people, q]);

  const pick = (p) => { onChange?.(p ? p.id : ""); setOpen(false); setQ(""); };

  const L = { fontSize: 11, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 4 };
  const BOX = {
    width: "100%", padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 7,
    fontSize: 13, background: disabled ? "#F8FAFC" : "#fff", textAlign: "left",
    cursor: disabled ? "not-allowed" : "pointer", color: selected ? "#0F2540" : "#94A3B8",
    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      {label && <label style={L}>{label}</label>}

      <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} style={BOX}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? (selected.name || selected.full_name) : (people.length ? placeholder : emptyLabel)}
          {selected?.phone && <span style={{ color: "#94A3B8", fontSize: 11 }}>{"  \u00b7  " + selected.phone}</span>}
        </span>
        <span style={{ color: "#94A3B8", fontSize: 11 }}>{open ? "\u25b2" : "\u25bc"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", zIndex: 50, top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff", border: "1px solid #D1D5DB", borderRadius: 9,
          boxShadow: "0 10px 26px rgba(15,37,64,.14)", overflow: "hidden",
        }}>
          {people.length >= autoOpenThreshold && (
            <div style={{ padding: 8, borderBottom: "1px solid #F1F5F9" }}>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={"\ud83d\udd0d Name, phone or email \u00b7 " + people.length + " on file"}
                style={{ width: "100%", padding: "7px 9px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 12.5, boxSizing: "border-box" }}
              />
            </div>
          )}

          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {value && (
              <button type="button" onClick={() => pick(null)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 12px", border: "none", background: "#fff", color: "#94A3B8", fontSize: 12, cursor: "pointer", borderBottom: "1px solid #F1F5F9" }}>
                Clear selection
              </button>
            )}

            {matches.map((p) => (
              <button key={p.id} type="button" onClick={() => pick(p)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", borderBottom: "1px solid #F8FAFC", background: p.id === value ? "#F0F5FF" : "#fff", cursor: "pointer" }}>
                <div style={{ fontSize: 13, color: "#0F2540", fontWeight: p.id === value ? 700 : 500 }}>
                  {p.name || p.full_name}
                </div>
                {(p.phone || p.email) && (
                  <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 1 }}>
                    {[p.phone, p.email].filter(Boolean).join("  \u00b7  ")}
                  </div>
                )}
              </button>
            ))}

            {matches.length === 0 && (
              <div style={{ padding: "14px 12px", fontSize: 12, color: "#94A3B8" }}>
                Nobody matches that. Try part of a phone number, or fewer letters.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

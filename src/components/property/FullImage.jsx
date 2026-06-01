// =====================================================================
// Phase 2.2 — Property Detail Pack  (inline-style, matches PropPulse)
// FullImage — one full-width image, click to fullscreen. Used for hero
//             banner and master plan. Self-contained fullscreen state.
// =====================================================================
// Props:
//   src       : string  — image URL
//   title     : string? — optional section heading (omit for hero banner)
//   maxHeight : number? — px cap on inline height (e.g. 240 for hero)
//   objectFit : string  — "cover" (hero) | "contain" (plans). default "cover"
//
// Renders nothing when src is empty (section self-hides).
// =====================================================================

import { useState, useEffect } from "react";

const LABEL = {
  fontSize: 11, fontWeight: 700, color: "#94A3B8",
  textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8,
};

export default function FullImage({ src, title, maxHeight, objectFit = "cover" }) {
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!full) return;
    const onKey = (e) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  if (!src) return null;

  return (
    <div>
      {title && <div style={LABEL}>{title}</div>}
      <img
        src={src}
        alt={title || "image"}
        loading="lazy"
        onClick={() => setFull(true)}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
        style={{
          display: "block", width: "100%",
          maxHeight: maxHeight ? `${maxHeight}px` : undefined,
          objectFit, borderRadius: 10, border: "1px solid #E8EDF4",
          background: "#F7F9FC", cursor: "zoom-in",
        }}
      />

      {full && (
        <div
          onClick={() => setFull(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(11,31,58,.88)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1300, padding: "1rem",
          }}
          role="dialog" aria-modal="true"
        >
          <button
            onClick={() => setFull(false)}
            aria-label="Close"
            style={{
              position: "absolute", top: 16, right: 20, background: "none",
              border: "none", fontSize: 30, color: "rgba(255,255,255,.85)", cursor: "pointer",
            }}
          >×</button>
          <img
            src={src}
            alt={title || "image"}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxHeight: "90vh", maxWidth: "95vw", objectFit: "contain",
              borderRadius: 10, boxShadow: "0 20px 60px rgba(0,0,0,.5)",
            }}
          />
        </div>
      )}
    </div>
  );
}

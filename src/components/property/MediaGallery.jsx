// =====================================================================
// Phase 2.2 — Property Detail Pack  (inline-style, matches PropPulse)
// MediaGallery — horizontal thumbnail carousel + fullscreen lightbox
// =====================================================================
// Props:
//   photos : string[]  — image URLs (default [])
//   title  : string    — section heading (default "Gallery")
//
// Renders nothing when photos is empty. Lightbox: prev/next + ESC + counter.
// =====================================================================

import { useState, useEffect, useCallback } from "react";

const LABEL = {
  fontSize: 11, fontWeight: 700, color: "#94A3B8",
  textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8,
};

export default function MediaGallery({ photos = [], title = "Gallery" }) {
  const [idx, setIdx] = useState(null);
  const open = idx !== null;
  const n = Array.isArray(photos) ? photos.length : 0;

  const close = useCallback(() => setIdx(null), []);
  const next = useCallback(() => setIdx((i) => (i === null ? null : (i + 1) % n)), [n]);
  const prev = useCallback(() => setIdx((i) => (i === null ? null : (i - 1 + n) % n)), [n]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, next, prev]);

  if (n === 0) return null;

  return (
    <div>
      <div style={LABEL}>{title}</div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {photos.map((url, i) => (
          <img
            key={`${url}-${i}`}
            src={url}
            alt={`Photo ${i + 1}`}
            loading="lazy"
            onClick={() => setIdx(i)}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            style={{
              flex: "0 0 auto", height: 90, width: 140, objectFit: "cover",
              borderRadius: 8, border: "1px solid #E8EDF4", cursor: "pointer",
            }}
          />
        ))}
      </div>

      {open && (
        <div
          onClick={close}
          style={{
            position: "fixed", inset: 0, background: "rgba(11,31,58,.88)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1300, padding: "1rem",
          }}
          role="dialog" aria-modal="true"
        >
          <button onClick={close} aria-label="Close"
            style={{ position: "absolute", top: 16, right: 20, background: "none", border: "none", fontSize: 30, color: "rgba(255,255,255,.85)", cursor: "pointer" }}>&times;</button>

          {n > 1 && (
            <button onClick={(e) => { e.stopPropagation(); prev(); }} aria-label="Previous"
              style={{ position: "absolute", left: 16, background: "none", border: "none", fontSize: 40, color: "rgba(255,255,255,.85)", cursor: "pointer", padding: "0 12px" }}>&#8249;</button>
          )}

          <img
            src={photos[idx]}
            alt={`Photo ${idx + 1}`}
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "85vh", maxWidth: "90vw", objectFit: "contain", borderRadius: 10, boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}
          />

          {n > 1 && (
            <button onClick={(e) => { e.stopPropagation(); next(); }} aria-label="Next"
              style={{ position: "absolute", right: 16, background: "none", border: "none", fontSize: 40, color: "rgba(255,255,255,.85)", cursor: "pointer", padding: "0 12px" }}>&#8250;</button>
          )}

          <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,.7)", fontSize: 13 }}>
            {idx + 1} / {n}
          </div>
        </div>
      )}
    </div>
  );
}

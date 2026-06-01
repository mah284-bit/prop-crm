// =====================================================================
// Phase 2.2b — Property Pack Viewer
// PropertyPackModal — mounted ONCE at app root; opens from anywhere
// =====================================================================
// Listens for the propertyPackBus event, resolves the pack via the single
// resolver, and renders it reusing the 5 leaf components. Light theme.
//
// Mount once (in App.jsx root return):   <PropertyPackModal />
// Open from anywhere:                    openPropertyPack(unitId)
//
// The greyed "Share Pack" button is the SEAM for Phase 2.3 Send — enable it
// + add an asset-picker that reads the resolver's typed assets[]. Display
// code here stays untouched when Send is built (the anti-rework contract).
// =====================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { PROPERTY_PACK_EVENT } from "./propertyPackBus";
import { getPropertyPackAssets } from "./getPropertyPackAssets";
import FullImage from "./FullImage";
import MediaGallery from "./MediaGallery";
import PdfPreview from "./PdfPreview";
import VideoEmbed from "./VideoEmbed";
import AmenityGrid from "./AmenityGrid";

const LABEL = {
  fontSize: 11, fontWeight: 700, color: "#94A3B8",
  textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8,
};

function Spec({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div style={{ background: "#F7F9FC", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F2540" }}>{value}</div>
    </div>
  );
}

export default function PropertyPackModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pack, setPack] = useState(null);
  /* draggable-pack — position + drag handlers */
  const [pos, setPos] = useState(null); // {x,y} top-left; null = default (top-right)
  const dragRef = useRef(null);
  const PANEL_W = 680;
  const onDragStart = useCallback((clientX, clientY) => {
    const node = dragRef.current;
    const rect = node ? node.getBoundingClientRect() : { left: clientX, top: clientY };
    const offX = clientX - rect.left;
    const offY = clientY - rect.top;
    const move = (cx, cy) => {
      const w = node ? node.offsetWidth : PANEL_W;
      const h = node ? node.offsetHeight : 400;
      let nx = cx - offX, ny = cy - offY;
      nx = Math.max(8, Math.min(nx, window.innerWidth - w - 8));
      ny = Math.max(8, Math.min(ny, window.innerHeight - 48));
      setPos({ x: nx, y: ny });
    };
    const mm = (e) => move(e.clientX, e.clientY);
    const tm = (e) => { const t = e.touches[0]; if (t) move(t.clientX, t.clientY); };
    const up = () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", tm);
      window.removeEventListener("touchend", up);
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", tm, { passive: false });
    window.addEventListener("touchend", up);
  }, []);
  // reset to default position each time the modal opens
  useEffect(() => { if (open) setPos(null); }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setPack(null);
    setError(null);
  }, []);

  // Listen for open events from anywhere in the app
  useEffect(() => {
    const handler = async (e) => {
      const unitId = e?.detail?.unitId;
      if (!unitId) return;
      setOpen(true);
      setLoading(true);
      setError(null);
      setPack(null);
      try {
        const data = await getPropertyPackAssets(unitId);
        setPack(data);
      } catch (err) {
        setError(err?.message || "Could not load property pack");
      } finally {
        setLoading(false);
      }
    };
    window.addEventListener(PROPERTY_PACK_EVENT, handler);
    return () => window.removeEventListener(PROPERTY_PACK_EVENT, handler);
  }, []);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const unit = pack?.unit;
  const project = pack?.project;
  const beds = unit?.bedrooms === 0 ? "Studio" : unit?.bedrooms || null;
  const size = unit?.size_sqft ? `${Number(unit.size_sqft).toLocaleString()} sqft` : null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "transparent",
        zIndex: 1400, pointerEvents: "none",
      }}
      role="dialog" aria-modal="false"
    >
      <div
        ref={dragRef}
        style={{
          position: "absolute",
          top: pos ? pos.y : 24,
          left: pos ? pos.x : (typeof window !== "undefined" ? Math.max(8, window.innerWidth - 680 - 32) : 40),
          background: "#fff", borderRadius: 16, width: 680, maxWidth: "calc(100vw - 16px)",
          maxHeight: "88vh", overflow: "auto", boxShadow: "0 24px 70px rgba(11,31,58,.35)",
          border: "1px solid #E2E8F0", pointerEvents: "auto",
        }}
      >
        {/* Header */}
        <div
          onMouseDown={(e) => { if (e.target.closest("button")) return; e.preventDefault(); onDragStart(e.clientX, e.clientY); }}
          onTouchStart={(e) => { if (e.target.closest("button")) return; const t = e.touches[0]; if (t) onDragStart(t.clientX, t.clientY); }}
          title="Drag to move"
          style={{ padding: "1.1rem 1.4rem", borderBottom: "1px solid #E8EDF4", display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "sticky", top: 0, background: "#fff", zIndex: 2, cursor: "move", userSelect: "none" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".5px" }}>Property Pack</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#0F2540", marginTop: 2 }}>
              {unit?.unit_ref || "Unit"}{project?.name ? ` · ${project.name}` : ""}
            </div>
            {pack?.developerName && (
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 1 }}>{pack.developerName}</div>
            )}
          </div>
          <button onClick={close} aria-label="Close" style={{ background: "none", border: "none", fontSize: 22, color: "#94A3B8", cursor: "pointer", lineHeight: 1 }}>&times;</button>
        </div>

        {/* Body */}
        <div style={{ padding: "1.1rem 1.4rem", display: "flex", flexDirection: "column", gap: 16 }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "2.5rem", color: "#64748B", fontSize: 14 }}>Loading property pack…</div>
          )}
          {error && !loading && (
            <div style={{ textAlign: "center", padding: "2rem", color: "#C53030", fontSize: 13 }}>{error}</div>
          )}

          {!loading && !error && pack && (
            <>
              {/* Unit quick specs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
                <Spec label="Type" value={unit?.unit_type} />
                <Spec label="Category" value={unit?.sub_type} />
                <Spec label="Bedrooms" value={beds} />
                <Spec label="Size" value={size} />
                <Spec label="View" value={unit?.view} />
                <Spec label="Status" value={unit?.status} />
              </div>

              {/* PROJECT section */}
              {project && (
                <>
                  <FullImage src={project.hero_image_url} maxHeight={240} objectFit="cover" />
                  <MediaGallery photos={project.photo_gallery_urls} title="Community Photos" />
                  <FullImage src={project.master_plan_url} title="Master Plan" objectFit="contain" />
                  <VideoEmbed url={project.video_url} />
                  <AmenityGrid amenities={pack.amenities} />
                </>
              )}

              {/* UNIT section */}
              <FullImage src={unit?.floor_plan_url} title="Floor Plan" objectFit="contain" />
              <MediaGallery photos={unit?.photo_urls} title="Unit Photos" />
              <PdfPreview fileUrl={null} externalUrl={unit?.brochure_url} title="Unit Brochure" />

              {/* SEAM: Phase 2.3 Send plugs in here (enable + asset picker) */}
              <button
                disabled
                title="Phase 2 — Communications Overhaul, Q3 2026"
                style={{ alignSelf: "flex-start", padding: "8px 16px", borderRadius: 8, border: "1px dashed #CBD5E1", background: "#F8FAFC", color: "#94A3B8", fontSize: 12, fontWeight: 600, cursor: "not-allowed" }}
              >
                📤 Share / Attach Pack — coming Q3 2026
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

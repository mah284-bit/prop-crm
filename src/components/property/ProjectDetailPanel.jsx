// =====================================================================
// Phase 2.2 — Property Detail Pack
// ProjectDetailPanel — right slide-out, full project intelligence view
// =====================================================================
// Architect-locked: right slide-out (not modal), composes the 4 leaf
// components, native iframe brochure, emoji amenities, CSS lightbox.
//
// Props:
//   project     : object   — the project row (PropPulse)
//   onClose     : fn()      — close the panel
//   onViewUnits : fn(project)? — optional: navigate to Inventory filtered
//
// Behavior:
//   - Slides in from right (~480px desktop, full-width mobile)
//   - Backdrop click or ESC closes
//   - Every media section self-hides when its data is absent
//   - "Share Pack" footer button is greyed/disabled (Phase 2 — Q3 2026)
//
// ---------------------------------------------------------------------
// FIELD MAP  (edit here if a quick-fact shows blank in the demo)
// Each fact reads the FIRST present key from its candidate list, so the
// panel works regardless of your exact column naming. Add/replace keys
// as needed — this is the ONLY place to touch for field-name fixes.
// ---------------------------------------------------------------------
const FIELD_MAP = {
  name:        ["name", "project_name", "title"],
  developer:   ["developer_name", "developer", "developers_name"],
  status:      ["status", "construction_status", "project_status"],
  type:        ["type", "project_type", "property_type"],
  community:   ["community", "community_name", "location_community"],
  emirate:     ["emirate", "city", "location_emirate"],
  units:       ["total_units", "units", "unit_count"],
  startPrice:  ["starting_price", "price_from", "start_price", "min_price"],
  completion:  ["completion_year", "handover", "handover_date", "completion"],
  serviceChg:  ["service_charge", "service_charge_per_sqft", "service_charge_text"],
  website:     ["website_url", "website", "url"],
  hero:        ["hero_image_url"],
  brochureFile:["brochure_file_url"],
  brochureUrl: ["brochure_url"],
  masterPlan:  ["master_plan_url", "masterplan_url"],
  gallery:     ["photo_gallery_urls", "gallery_urls", "photos"],
  video:       ["video_url", "walkthrough_url"],
  amenities:   ["amenities", "amenity_list"],
};
// =====================================================================

import { useState, useEffect } from "react";
import MediaGallery from "./MediaGallery";
import AmenityGrid from "./AmenityGrid";
import PdfPreview from "./PdfPreview";
import VideoEmbed from "./VideoEmbed";

// Read the first present, non-empty key from a candidate list
function pick(obj, keys) {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

// Format a number-ish price into "AED 1.20M" style if it's numeric;
// otherwise pass through whatever string was stored.
function formatPrice(v) {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v); // already a formatted string
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `AED ${(n / 1_000).toFixed(0)}K`;
  return `AED ${n}`;
}

function Fact({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="text-sm font-medium text-slate-700">{value}</span>
    </div>
  );
}

export default function ProjectDetailPanel({ project, onClose, onViewUnits }) {
  const [planFullscreen, setPlanFullscreen] = useState(false);

  // ESC closes the panel (unless the master-plan overlay is open)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (planFullscreen) setPlanFullscreen(false);
      else onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [planFullscreen, onClose]);

  if (!project) return null;

  const name = pick(project, FIELD_MAP.name) || "Untitled Project";
  const developer = pick(project, FIELD_MAP.developer);
  const status = pick(project, FIELD_MAP.status);
  const type = pick(project, FIELD_MAP.type);
  const community = pick(project, FIELD_MAP.community);
  const emirate = pick(project, FIELD_MAP.emirate);
  const units = pick(project, FIELD_MAP.units);
  const startPrice = formatPrice(pick(project, FIELD_MAP.startPrice));
  const completion = pick(project, FIELD_MAP.completion);
  const serviceChg = pick(project, FIELD_MAP.serviceChg);
  const website = pick(project, FIELD_MAP.website);
  const hero = pick(project, FIELD_MAP.hero);
  const brochureFile = pick(project, FIELD_MAP.brochureFile);
  const brochureUrl = pick(project, FIELD_MAP.brochureUrl);
  const masterPlan = pick(project, FIELD_MAP.masterPlan);
  const gallery = pick(project, FIELD_MAP.gallery) || [];
  const video = pick(project, FIELD_MAP.video);
  const amenities = pick(project, FIELD_MAP.amenities) || [];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[90] bg-slate-900/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out panel */}
      <aside
        className="fixed right-0 top-0 z-[95] h-full w-full sm:w-[480px] bg-white shadow-2xl flex flex-col animate-[slidein_0.2s_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-label={`${name} details`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Property Pack
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Close panel"
          >
            &times;
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* 1. Hero */}
          <div className="relative bg-slate-100">
            {hero ? (
              <img
                src={hero}
                alt={name}
                className="w-full h-52 object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : (
              <div className="w-full h-52 flex items-center justify-center text-slate-300 text-sm">
                No hero image
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="flex items-center gap-2 mb-1">
                {status && (
                  <span className="inline-block rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {status}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white leading-tight">{name}</h2>
              {developer && (
                <p className="text-sm text-white/80">{developer}</p>
              )}
            </div>
          </div>

          {/* Website CTA */}
          {website && (
            <div className="px-5 pt-4">
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                🌐 View Website ↗
              </a>
            </div>
          )}

          {/* 2. Quick facts ribbon */}
          <div className="px-5 py-4 grid grid-cols-2 gap-3 border-b border-slate-100">
            <Fact label="Developer" value={developer} />
            <Fact label="Status" value={status} />
            <Fact label="Type" value={type} />
            <Fact label="Community" value={community} />
            <Fact label="Emirate" value={emirate} />
            <Fact label="Total Units" value={units} />
            <Fact label="Starting Price" value={startPrice} />
            <Fact label="Completion" value={completion} />
            <Fact label="Service Charge" value={serviceChg} />
          </div>

          {/* 3-7. Media sections (each self-hides when empty) */}
          <div className="px-5 pt-5">
            <PdfPreview fileUrl={brochureFile} externalUrl={brochureUrl} />

            {/* Master plan — full width, click to fullscreen */}
            {masterPlan && (
              <section className="mb-6">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
                  Master Plan
                </h3>
                <button
                  type="button"
                  onClick={() => setPlanFullscreen(true)}
                  className="block w-full rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-blue-400 transition"
                  aria-label="Open master plan fullscreen"
                >
                  <img
                    src={masterPlan}
                    alt="Master plan"
                    className="w-full object-contain bg-slate-50"
                  />
                </button>
              </section>
            )}

            <MediaGallery photos={gallery} title="Community Photos" />
            <VideoEmbed url={video} />
            <AmenityGrid amenities={amenities} />
          </div>
        </div>

        {/* 8. Footer actions */}
        <div className="shrink-0 border-t border-slate-200 px-5 py-3 flex items-center gap-3">
          <button
            type="button"
            disabled
            title="Phase 2 — coming Q3 2026"
            className="flex-1 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-400 cursor-not-allowed"
          >
            📤 Share Pack
          </button>
          {onViewUnits && (
            <button
              type="button"
              onClick={() => onViewUnits(project)}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              View Units →
            </button>
          )}
        </div>
      </aside>

      {/* Master-plan fullscreen overlay */}
      {planFullscreen && masterPlan && (
        <div
          className="fixed inset-0 z-[110] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setPlanFullscreen(false)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setPlanFullscreen(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none"
            aria-label="Close master plan"
          >
            &times;
          </button>
          <img
            src={masterPlan}
            alt="Master plan"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[95vw] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}

      {/* Slide-in keyframe (scoped, no external CSS needed) */}
      <style>{`
        @keyframes slidein {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

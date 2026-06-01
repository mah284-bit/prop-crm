// =====================================================================
// Phase 2.2 — Property Detail Pack
// MediaGallery — horizontal photo carousel + fullscreen lightbox
// =====================================================================
// Zero external dependencies. Pure React + Tailwind.
// Used by: ProjectDetailPanel (community photos) and UnitDetailPanel (unit photos)
//
// Props:
//   photos   : string[]  — array of image URLs (defaults to [])
//   title    : string    — optional section heading (default "Gallery")
//
// Behavior:
//   - Renders nothing if photos is empty/undefined (section hidden per spec)
//   - Horizontal scroll carousel of thumbnails
//   - Click any photo -> fullscreen lightbox with prev/next + ESC to close
//   - Graceful broken-image handling (onError hides the broken tile)
// =====================================================================

import { useState, useEffect, useCallback } from "react";

export default function MediaGallery({ photos = [], title = "Gallery" }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const isOpen = lightboxIndex !== null;

  const close = useCallback(() => setLightboxIndex(null), []);
  const next = useCallback(
    () => setLightboxIndex((i) => (i === null ? null : (i + 1) % photos.length)),
    [photos.length]
  );
  const prev = useCallback(
    () =>
      setLightboxIndex((i) =>
        i === null ? null : (i - 1 + photos.length) % photos.length
      ),
    [photos.length]
  );

  // Keyboard controls for the lightbox
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close, next, prev]);

  // Spec: hide the whole section when there is nothing to show
  if (!Array.isArray(photos) || photos.length === 0) return null;

  return (
    <section className="mb-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
        {title}
      </h3>

      {/* Carousel */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {photos.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => setLightboxIndex(i)}
            className="shrink-0 snap-start rounded-lg overflow-hidden ring-1 ring-slate-200 hover:ring-blue-400 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Open photo ${i + 1} of ${photos.length}`}
          >
            <img
              src={url}
              alt={`Photo ${i + 1}`}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.parentElement.style.display = "none";
              }}
              className="h-28 w-44 object-cover"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          {/* Close */}
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>

          {/* Prev */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-4 text-white/80 hover:text-white text-4xl px-3"
              aria-label="Previous photo"
            >
              &#8249;
            </button>
          )}

          {/* Image */}
          <img
            src={photos[lightboxIndex]}
            alt={`Photo ${lightboxIndex + 1}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
          />

          {/* Next */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-4 text-white/80 hover:text-white text-4xl px-3"
              aria-label="Next photo"
            >
              &#8250;
            </button>
          )}

          {/* Counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {lightboxIndex + 1} / {photos.length}
          </div>
        </div>
      )}
    </section>
  );
}

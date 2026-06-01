// =====================================================================
// Phase 2.2 — Property Detail Pack
// AmenityGrid — 3-column grid of amenities with emoji icons
// =====================================================================
// Zero dependencies. Hard-coded emoji map per architect-locked Decision 3.
// (Library swap is post-demo polish if ever needed.)
//
// Props:
//   amenities : string[]  — array of amenity names (defaults to [])
//   title     : string    — optional heading (default "Amenities")
//
// Behavior:
//   - Renders nothing if amenities is empty (section hidden per spec)
//   - Matches amenity name to an emoji via a forgiving lookup
//     (case-insensitive, substring match), falls back to a neutral pin
// =====================================================================

// Order matters: more specific keys first so "beach access" hits 🏖️
// before a generic match, etc.
const AMENITY_ICONS = [
  ["beach", "🏖️"],
  ["pool", "🏊"],
  ["gym", "💪"],
  ["fitness", "💪"],
  ["concierge", "🛎️"],
  ["security", "🛡️"],
  ["24/7", "🛡️"],
  ["co-working", "💼"],
  ["coworking", "💼"],
  ["business", "💼"],
  ["park", "🌳"],
  ["garden", "🌳"],
  ["green", "🌳"],
  ["kids", "🧸"],
  ["children", "🧸"],
  ["playground", "🧸"],
  ["retail", "🛍️"],
  ["shop", "🛍️"],
  ["mall", "🛍️"],
  ["restaurant", "🍽️"],
  ["dining", "🍽️"],
  ["cafe", "☕"],
  ["spa", "💆"],
  ["sauna", "🧖"],
  ["parking", "🅿️"],
  ["garage", "🅿️"],
  ["pet", "🐾"],
  ["marina", "⛵"],
  ["yacht", "⛵"],
  ["golf", "⛳"],
  ["tennis", "🎾"],
  ["court", "🎾"],
  ["cinema", "🎬"],
  ["theatre", "🎬"],
  ["lounge", "🛋️"],
  ["bbq", "🍖"],
  ["barbecue", "🍖"],
  ["smart", "📱"],
  ["wifi", "📶"],
  ["ev", "🔌"],
  ["charging", "🔌"],
  ["view", "🌆"],
  ["balcony", "🌆"],
  ["elevator", "🛗"],
  ["lift", "🛗"],
];

function iconFor(name) {
  const n = String(name || "").toLowerCase();
  for (const [key, emoji] of AMENITY_ICONS) {
    if (n.includes(key)) return emoji;
  }
  return "📍"; // neutral fallback
}

export default function AmenityGrid({ amenities = [], title = "Amenities" }) {
  if (!Array.isArray(amenities) || amenities.length === 0) return null;

  return (
    <section className="mb-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
        {title}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {amenities.map((name, i) => (
          <div
            key={`${name}-${i}`}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <span className="text-lg leading-none" aria-hidden="true">
              {iconFor(name)}
            </span>
            <span className="text-sm text-slate-700 truncate">{name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// =====================================================================
// Phase 2.2 — Property Detail Pack  (inline-style, matches PropPulse)
// AmenityGrid — responsive grid of amenities with emoji icons
// =====================================================================
// Hard-coded emoji map per architect-locked Decision 3 (zero deps).
//
// Props:
//   amenities : string[]  — amenity names (default [])
//   title     : string    — heading (default "Amenities")
//
// Renders nothing when amenities is empty.
// =====================================================================

const LABEL = {
  fontSize: 11, fontWeight: 700, color: "#94A3B8",
  textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8,
};

// More specific keys first (substring, case-insensitive match).
const AMENITY_ICONS = [
  ["beach", "🏖️"], ["pool", "🏊"], ["gym", "💪"], ["fitness", "💪"],
  ["concierge", "🛎️"], ["security", "🛡️"], ["24/7", "🛡️"],
  ["co-working", "💼"], ["coworking", "💼"], ["business", "💼"],
  ["park", "🌳"], ["garden", "🌳"], ["green", "🌳"],
  ["kids", "🧸"], ["children", "🧸"], ["playground", "🧸"],
  ["retail", "🛍️"], ["shop", "🛍️"], ["mall", "🛍️"],
  ["restaurant", "🍽️"], ["dining", "🍽️"], ["cafe", "☕"],
  ["spa", "💆"], ["sauna", "🧖"], ["parking", "🅿️"], ["garage", "🅿️"],
  ["pet", "🐾"], ["marina", "⛵"], ["yacht", "⛵"], ["golf", "⛳"],
  ["tennis", "🎾"], ["court", "🎾"], ["cinema", "🎬"], ["theatre", "🎬"],
  ["lounge", "🛋️"], ["bbq", "🍖"], ["barbecue", "🍖"],
  ["smart", "📱"], ["wifi", "📶"], ["ev", "🔌"], ["charging", "🔌"],
  ["view", "🌆"], ["balcony", "🌆"], ["elevator", "🛗"], ["lift", "🛗"],
];

function iconFor(name) {
  const s = String(name || "").toLowerCase();
  for (const [key, emoji] of AMENITY_ICONS) if (s.includes(key)) return emoji;
  return "📍";
}

export default function AmenityGrid({ amenities = [], title = "Amenities" }) {
  if (!Array.isArray(amenities) || amenities.length === 0) return null;

  return (
    <div>
      <div style={LABEL}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8 }}>
        {amenities.map((name, i) => (
          <div key={`${name}-${i}`}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "#F7F9FC", border: "1px solid #E8EDF4", borderRadius: 8, padding: "8px 10px" }}>
            <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden="true">{iconFor(name)}</span>
            <span style={{ fontSize: 13, color: "#4A5568", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

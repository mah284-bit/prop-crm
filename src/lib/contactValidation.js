// src/lib/contactValidation.js
// Phase 2.2A — Contact validation logic for the canonical lead/contact form (V2).
//
// Reference data (countries, buyer-type rules) lives in Supabase tables:
//   - reference_countries
//   - reference_buyer_type_rules
//
// This module provides pure JS helpers for validation, identity-doc lookup,
// and humanization — no fetching, no API calls. Reference data is passed
// in by the caller, which loads it from Supabase once on form mount.
//
// Moved here from api/_data/reference.js (Master Spec §2.3) to break
// the dependency on broken Vercel serverless routes in dev mode.

// ─── GCC classification (static constant — never changes) ──────────
export const GCC_COUNTRIES = ["AE", "SA", "QA", "KW", "BH", "OM"];

export function isGccCountry(iso2) {
  if (!iso2) return false;
  return GCC_COUNTRIES.includes(iso2.toUpperCase());
}

// ─── Buyer-type list (in display order) ────────────────────────────
// Source of truth is reference_buyer_type_rules.buyer_type column, but
// we keep the canonical order here for UI rendering.
export const BUYER_TYPES = [
  "local_national",
  "gcc_resident_expat",
  "international_non_resident",
  "corporate",
];

// ─── Humanize a snake_case field name into "Title Case" label ──────
// Strips trailing _country_code and _e164 suffixes for cleaner display.
export function humanize(field) {
  return field
    .replace(/_country_code/g, "")
    .replace(/_e164/g, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── Build a rules-by-buyer-type map from flat DB rows ─────────────
// Input:  [{buyer_type, field_name, requirement}, ...]
// Output: { local_national: {display_name: 'required', ...}, ... }
//
// Call this once after loading rows from reference_buyer_type_rules.
export function rulesFromRows(rows) {
  const out = {};
  for (const row of rows || []) {
    if (!out[row.buyer_type]) out[row.buyer_type] = {};
    out[row.buyer_type][row.field_name] = row.requirement;
  }
  return out;
}

// ─── Validate a contact payload against the rules ──────────────────
// `rules` is the output of rulesFromRows() — pass the loaded ruleset.
// Returns array of {field, message} errors. Empty array = valid.
export function validateContactPayload(input, rules) {
  const errors = [];

  // Display name always required
  if (!input.display_name || String(input.display_name).trim().length === 0) {
    errors.push({ field: "display_name", message: "Display name is required" });
  }

  // Buyer type must be classified
  if (!input.buyer_type) {
    errors.push({
      field: "buyer_type",
      message: "Buyer type must be classified before saving",
    });
    return errors;
  }

  const typeRules = rules?.[input.buyer_type];
  if (!typeRules) {
    errors.push({
      field: "buyer_type",
      message: `Unknown buyer type: ${input.buyer_type}`,
    });
    return errors;
  }

  // Identity-doc fields are presence-checked at later stage gates, not here.
  const docFields = ["emirates_id", "national_id", "passport", "residence_visa", "address_proof"];

  for (const [field, req] of Object.entries(typeRules)) {
    if (req !== "required") continue;
    if (docFields.includes(field)) continue;
    const value = input[field];
    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim().length === 0)
    ) {
      errors.push({
        field,
        message: `${humanize(field)} is required for ${humanize(input.buyer_type)}`,
      });
    }
  }

  return errors;
}

// ─── Identity documents required by buyer type (for UI hints) ──────
// Returns humanized labels: ["Emirates Id", "Passport", ...]
export function getRequiredIdentityDocuments(buyerType, rules) {
  const typeRules = rules?.[buyerType];
  if (!typeRules) return [];
  const docFields = ["emirates_id", "national_id", "passport", "residence_visa", "address_proof"];
  return docFields
    .filter((f) => typeRules[f] === "required")
    .map(humanize);
}

// ─── Calling-code lookup (lightweight in-memory map after countries load) ──
// `countries` is the array loaded from reference_countries.
// Returns the calling code string (without '+') or undefined.
export function getCallingCode(iso2, countries) {
  if (!iso2 || !Array.isArray(countries)) return undefined;
  const match = countries.find((c) => c.iso2 === iso2.toUpperCase());
  return match?.calling_code;
}

// ─── Sort countries: priority alphabetical, then rest alphabetical ──
// Mirrors the legacy getDropdownCountries() behavior.
// Pass the array straight from supabase.from('reference_countries').select('*')
// — sorting is done client-side after load for offline-friendliness.
export function sortCountriesForDropdown(countries) {
  if (!Array.isArray(countries)) return [];
  const priority = countries
    .filter((c) => c.priority)
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
  const rest = countries
    .filter((c) => !c.priority)
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
  return [...priority, ...rest];
}

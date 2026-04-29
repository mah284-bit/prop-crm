// api/reference/countries.js
// Vercel serverless function — returns ISO 3166-1 country list with calling codes.
//
// GET /api/reference/countries
//   → { countries: Country[] }
//
// Country shape:
//   { iso2, name_en, name_ar?, calling_code, flag_emoji, priority? }
//
// Used by:
//   - Lead/contact creation form: nationality + residence dropdowns
//   - Phone-input component: country-code prefix
//
// No auth check (this is static reference data, no PII). If you want to
// require auth later, validate the Supabase JWT in the Authorization header.

import { getDropdownCountries } from "../_data/reference.js";

export default async function handler(req, res) {
  // CORS — same-origin Vercel deploy is fine, but include for safety
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  try {
    const countries = getDropdownCountries();
    // Cache aggressively — country data is effectively static.
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    return res.status(200).json({ countries });
  } catch (err) {
    console.error("[/api/reference/countries] error:", err);
    return res.status(500).json({ error: "Failed to load country reference data." });
  }
}

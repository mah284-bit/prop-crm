// api/_data/leads-helpers.js
// Shared helpers used by both api/leads/index.js (POST /api/leads, list/create)
// and api/leads/[id].js (GET/PATCH /api/leads/:id).
//
// Anything in api/_data is NOT exposed as a URL — it's a private library
// imported by the real endpoints.

import { createClient } from "@supabase/supabase-js";
import { COUNTRIES_BY_ISO2 } from "./reference.js";

// ---------------------------------------------------------------------------
// Auth — user-scoped Supabase client (RLS-aware, NOT service_role)
// ---------------------------------------------------------------------------

/**
 * Build a Supabase client that runs as the calling user.
 * RLS therefore stays in force; user can only read/write rows their
 * profile gives them access to.
 *
 * Returns null if no Authorization header was provided.
 */
export function userScopedClient(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.substring("Bearer ".length);
  if (!token) return null;

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ---------------------------------------------------------------------------
// Field whitelist — defends against payload injection
// ---------------------------------------------------------------------------

/**
 * Whitelist of fields callers may write to leads.
 * Anything outside this list is silently ignored.
 *
 * NOTE: company_id is included because the form may pass it. RLS still
 * enforces that a user can only insert rows where company_id matches
 * their own company; the whitelist only controls what columns can be
 * touched, not what values are accepted.
 */
export const WRITABLE_FIELDS = [
  // Core identity
  "name",
  "display_name",
  "email",
  "phone",
  "whatsapp",
  // Sprint 1 additions (migration 04)
  "buyer_type",
  "legal_name_en",
  "legal_name_ar",
  "nationality_iso2",
  "residence_iso2",
  "phone_e164",
  "phone_country_code",
  "tax_residency_iso2",
  "kyc_status",
  "kyc_verified_at",
  "kyc_verified_by_user_id",
  "pep_flag",
  "source_of_funds",
  "photo_document_id",
  // Standard CRM fields
  "stage",
  "source",
  "notes",
  "assigned_to",
  "company_id",
  // C4: property reference attached after creation
  "interested_unit_id",
  "interested_project_id",
  // Legacy free-text — kept for backward compat (deprecated per D2)
  "nationality",
];

export function pickWritable(input) {
  const out = {};
  for (const k of WRITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, k)) {
      out[k] = input[k];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Map our incoming payload to the shape validateContactPayload() expects.
 * (validateContactPayload uses generic field names like nationality_country_code;
 * the leads table uses nationality_iso2.)
 */
export function buildValidationInput(body) {
  return {
    display_name: body.display_name || body.name,
    legal_name_en: body.legal_name_en,
    legal_name_ar: body.legal_name_ar,
    buyer_type: body.buyer_type,
    nationality_country_code: body.nationality_iso2,
    residence_country_code: body.residence_iso2,
    phone_e164: body.phone_e164,
    email: body.email,
  };
}

/** ISO2 sanity check on any country-code field present */
export function validateIso2Codes(body) {
  const errors = [];
  const isoFields = [
    "nationality_iso2",
    "residence_iso2",
    "tax_residency_iso2",
    "phone_country_code",
  ];
  for (const f of isoFields) {
    const v = body[f];
    if (v == null || v === "") continue;
    if (typeof v !== "string" || !/^[A-Z]{2}$/.test(v)) {
      errors.push({ field: f, message: `${f} must be a 2-letter uppercase ISO code` });
      continue;
    }
    if (!COUNTRIES_BY_ISO2[v]) {
      errors.push({ field: f, message: `${f}=${v} is not a known country code` });
    }
  }
  return errors;
}

/** E.164 phone format check */
export function validatePhoneE164(body) {
  if (!body.phone_e164) return [];
  if (typeof body.phone_e164 !== "string" || !/^\+[1-9][0-9]{1,14}$/.test(body.phone_e164)) {
    return [{
      field: "phone_e164",
      message: "phone_e164 must be E.164 format, e.g. +971501234567",
    }];
  }
  return [];
}

/** Normalize ISO2 codes in-place to uppercase */
export function normalizeIsoCodes(payload) {
  for (const f of ["nationality_iso2", "residence_iso2", "tax_residency_iso2", "phone_country_code"]) {
    if (payload[f]) payload[f] = String(payload[f]).toUpperCase();
  }
}

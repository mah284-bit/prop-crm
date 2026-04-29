// api/leads/[id].js
// Vercel serverless function — operations on a single lead by ID.
// Vercel automatically routes /api/leads/<anything> to this file and
// supplies req.query.id with the path parameter.
//
// Handles:
//   GET   /api/leads/:id   →  fetch one lead
//   PATCH /api/leads/:id   →  partial update (used by C4 to attach property
//                             to a lead after creation)
//
// Phase A.2 — Sprint 1 wiring + C4 fix.

import {
  userScopedClient,
  setCors,
  pickWritable,
  validateIso2Codes,
  validatePhoneE164,
  normalizeIsoCodes,
} from "../_data/leads-helpers.js";

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const supabase = userScopedClient(req);
  if (!supabase) {
    return res.status(401).json({
      error: "Authentication required. Send the user's Supabase JWT in the Authorization: Bearer header.",
    });
  }

  const id = req.query?.id;
  if (!id) {
    return res.status(400).json({ error: "Lead id is required in the URL path." });
  }

  try {
    if (req.method === "GET") {
      return await handleGet(res, supabase, id);
    }
    if (req.method === "PATCH") {
      return await handlePatch(req, res, supabase, id);
    }
    return res.status(405).json({ error: `Method ${req.method} not allowed on /api/leads/:id.` });
  } catch (err) {
    console.error("[/api/leads/:id] unhandled:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

// ---------------------------------------------------------------------------
// GET /api/leads/:id
// ---------------------------------------------------------------------------

async function handleGet(res, supabase, id) {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return res.status(400).json({ error: error.message });
  }
  if (!data) {
    return res.status(404).json({ error: "Lead not found or not accessible." });
  }

  return res.status(200).json({ lead: data });
}

// ---------------------------------------------------------------------------
// PATCH /api/leads/:id  (C4: attach property after creation, or any partial edit)
// ---------------------------------------------------------------------------

async function handlePatch(req, res, supabase, id) {
  const body = req.body || {};

  // Format checks on any country-code or phone fields present
  const formatErrs = [...validateIso2Codes(body), ...validatePhoneE164(body)];
  if (formatErrs.length > 0) {
    return res.status(400).json({
      error: "Format validation failed",
      details: formatErrs,
    });
  }

  const payload = pickWritable(body);
  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: "No writable fields in payload." });
  }

  normalizeIsoCodes(payload);

  const { data, error } = await supabase
    .from("leads")
    .update(payload)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return res.status(400).json({ error: error.message });
  }
  if (!data) {
    return res.status(404).json({ error: "Lead not found or not accessible." });
  }

  return res.status(200).json({ lead: data });
}

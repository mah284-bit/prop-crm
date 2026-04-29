// api/leads/index.js
// Vercel serverless function — POST /api/leads (create new lead).
//
// Handles: POST /api/leads
// For GET/PATCH /api/leads/:id, see api/leads/[id].js
//
// Phase A.2 — Sprint 1 wiring.

import { validateContactPayload } from "../_data/reference.js";
import {
  userScopedClient,
  setCors,
  pickWritable,
  buildValidationInput,
  validateIso2Codes,
  validatePhoneE164,
  normalizeIsoCodes,
} from "../_data/leads-helpers.js";

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed. POST only on /api/leads. Use /api/leads/:id for GET or PATCH.",
    });
  }

  const supabase = userScopedClient(req);
  if (!supabase) {
    return res.status(401).json({
      error: "Authentication required. Send the user's Supabase JWT in the Authorization: Bearer header.",
    });
  }

  try {
    const body = req.body || {};

    // Buyer-type validation (only when buyer_type is provided).
    // Backward compat: leads can still be created without buyer_type at this
    // stage — the form encourages but doesn't require it. Buyer_type
    // becomes mandatory at the Reserved stage gate (later sprint).
    if (body.buyer_type) {
      const validationErrs = validateContactPayload(buildValidationInput(body));
      if (validationErrs.length > 0) {
        return res.status(400).json({
          error: "Validation failed",
          details: validationErrs,
        });
      }
    }

    // Format checks (always run)
    const formatErrs = [...validateIso2Codes(body), ...validatePhoneE164(body)];
    if (formatErrs.length > 0) {
      return res.status(400).json({
        error: "Format validation failed",
        details: formatErrs,
      });
    }

    // Minimum: a name (display_name OR name)
    const nameValue = body.display_name || body.name;
    if (!nameValue || String(nameValue).trim().length === 0) {
      return res.status(400).json({
        error: "Validation failed",
        details: [{ field: "name", message: "Lead name is required." }],
      });
    }

    const payload = pickWritable(body);

    // Mirror name <-> display_name so old code that reads `name` keeps working
    if (!payload.name && payload.display_name) payload.name = payload.display_name;
    if (!payload.display_name && payload.name) payload.display_name = payload.name;

    normalizeIsoCodes(payload);

    // Insert. RLS enforces company_id matches the user's own company.
    const { data, error } = await supabase
      .from("leads")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("[POST /api/leads] insert error:", error);
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ lead: data });
  } catch (err) {
    console.error("[POST /api/leads] unhandled:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

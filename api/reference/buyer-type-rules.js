// api/reference/buyer-type-rules.js
// Vercel serverless function — returns the buyer-type validation matrix.
//
// GET /api/reference/buyer-type-rules
//   → { buyer_types: string[], rules: Record<BuyerType, BuyerTypeRule> }
//
// The same rules object that the server validates against is exposed here
// so the UI can render fields dynamically (showing/hiding/marking required
// based on the selected buyer type) without duplicating the rules in code.
//
// Source of truth: api/_data/reference.js  (Master Spec §2.3)

import { BUYER_TYPES, BUYER_TYPE_RULES } from "../_data/reference.js";

export default async function handler(req, res) {
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
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    return res.status(200).json({
      buyer_types: BUYER_TYPES,
      rules: BUYER_TYPE_RULES,
    });
  } catch (err) {
    console.error("[/api/reference/buyer-type-rules] error:", err);
    return res.status(500).json({ error: "Failed to load buyer-type rules." });
  }
}

// api/collect-projects-v2.js
// PropPulse Collection Agent v2 — real AI-powered discovery.
//
// This function accepts a single developer to research and returns any new
// or updated projects found. The frontend loops over all 20 developers and
// calls this function once per developer (staying under Vercel Hobby's 10s
// function timeout).
//
// Design choices:
//   • One developer per call = timeout-safe on Hobby plan
//   • Soft cost cap via max web searches + capped max_tokens
//   • Time-windowed prompt (last 90 days) to avoid re-discovering old data
//   • Everything added with is_pp_verified = false → goes to Verification Queue
//   • Job logged to pp_agent_jobs for audit

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SYSTEM_PROMPT = `You are PropPulse Research Agent — a specialist in UAE real estate project discovery.

Your job: for the ONE developer the user names, use web search to find real-estate projects they have announced, launched, or updated IN THE LAST 90 DAYS (new launches, new phases, significant construction updates, price releases, or handover date changes).

STRICT OUTPUT FORMAT — return ONLY a JSON array, no prose before or after, no markdown fences. Each element:

{
  "name": "string (required) — the project's marketing name",
  "developer": "string (required) — the developer name exactly as given",
  "community": "string or null — neighbourhood/community",
  "emirate": "Dubai | Abu Dhabi | Sharjah | Ajman | RAK | Fujairah | UAQ",
  "project_type": "Residential | Commercial | Mixed Use | Villa | Townhouse | Hotel Apartments",
  "project_status": "Announced | Approved | Under Construction | Ready | Completed | On Hold",
  "announcement_date": "YYYY-MM-DD or null",
  "handover_date": "YYYY-MM-DD or null",
  "starting_price": "number in AED or null (no commas, no currency)",
  "total_units": "integer or null",
  "description": "string — 1-2 sentences max, factual only",
  "google_maps_url": "string or null",
  "service_charge_psf": "number in AED/sqft/yr or null",
  "confidence": "integer 0-100 — how confident you are this is real, recent, and accurate"
}

RULES:
• Return [] (empty array) if nothing qualifies — that's a valid, expected result.
• Never invent data. If a field is unknown, use null.
• Confidence < 70 means you're unsure; these still get returned but will be queued for human review.
• Do not return well-known long-established projects (e.g. Burj Khalifa, Palm Jumeirah original). Focus on NEW activity.
• Keep descriptions short, factual, quotable. No marketing fluff ("stunning", "world-class", etc.).
• Maximum 8 projects per developer per run.`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not set in Vercel env" });
  }
  if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase env vars not set" });
  }

  // Input: { developer_id?: string, developer_name?: string, developer_website?: string }
  // Callers can pass the developer_id (preferred, enables foreign-key linking) OR
  // just the name/website (agent run-once mode, for testing).
  const { developer_id, developer_name, developer_website } = req.body || {};
  if (!developer_id && !developer_name) {
    return res.status(400).json({ error: "Must provide developer_id or developer_name" });
  }

  // Resolve developer details from DB (single source of truth)
  let developer = null;
  if (developer_id) {
    const { data, error } = await supabaseAdmin
      .from("pp_developers")
      .select("id, name, website, city, country")
      .eq("id", developer_id)
      .single();
    if (error || !data) {
      return res.status(404).json({ error: "Developer not found in pp_developers" });
    }
    developer = data;
  } else {
    developer = { id: null, name: developer_name, website: developer_website || null };
  }

  const results = {
    developer: developer.name,
    added: 0,
    updated: 0,
    skipped: 0,
    queued_for_review: 0,
    errors: [],
    projects: [], // summary of what was added/updated for the UI
  };

  // Compose user message
  const userPrompt = `Research developer: ${developer.name}${
    developer.website ? ` (website: ${developer.website})` : ""
  }

Find any real-estate projects from this developer that have been announced, launched, or had significant updates in the LAST 90 DAYS in the UAE.

Return the JSON array as specified in the system prompt. Empty array [] is a valid answer.`;

  let claudeResp;
  try {
    claudeResp = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      temperature: 0.2, // low temp = factual, low hallucination
      system: SYSTEM_PROMPT,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5, // hard cap — key cost control
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
  } catch (err) {
    console.error("Claude API error:", err);
    results.errors.push(`Claude API: ${err.message || "unknown"}`);
    await logJob(developer, results, "failed");
    return res.status(500).json(results);
  }

  // Extract final text response (ignore tool_use / tool_result blocks)
  const textBlocks = (claudeResp.content || []).filter((b) => b.type === "text");
  const rawText = textBlocks.map((b) => b.text).join("\n").trim();

  // Parse — defensive, tolerate occasional markdown fences despite the prompt
  let projects = [];
  try {
    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    projects = JSON.parse(cleaned);
    if (!Array.isArray(projects)) throw new Error("Response was not a JSON array");
  } catch (err) {
    console.error("Failed to parse Claude response:", rawText.slice(0, 500));
    results.errors.push(`Parse error: ${err.message}`);
    await logJob(developer, results, "failed");
    return res.status(200).json(results);
  }

  // Insert each project into `projects` table with is_pp_verified = false
  for (const p of projects) {
    try {
      if (!p.name || !p.developer) {
        results.skipped++;
        continue;
      }

      // Dedup: does a project with this name already exist in the PP catalog
      // (company_id IS NULL means catalog-scoped)?
      const { data: existing } = await supabaseAdmin
        .from("projects")
        .select("id, is_pp_verified, pp_confidence_score, pp_last_updated")
        .is("company_id", null)
        .ilike("name", p.name)
        .maybeSingle();

      const payload = {
        name: p.name,
        developer: p.developer,
        pp_developer_id: developer.id || null,
        community: p.community || null,
        emirate: p.emirate || null,
        project_type: p.project_type || null,
        project_status: p.project_status || null,
        announcement_date: p.announcement_date || null,
        handover_date: p.handover_date || null,
        starting_price: p.starting_price != null ? Number(p.starting_price) : null,
        total_units: p.total_units != null ? Number(p.total_units) : null,
        description: p.description || null,
        google_maps_url: p.google_maps_url || null,
        service_charge_psf: p.service_charge_psf != null ? Number(p.service_charge_psf) : null,
        city: "Dubai", // default, overridable later
        country: "UAE",
        status: "Active",
        is_pp_verified: false, // HUMAN REVIEW REQUIRED
        pp_data_source: "ai_agent_v2",
        pp_last_updated: new Date().toISOString(),
        pp_confidence_score: p.confidence != null ? Math.round(p.confidence) : 50,
      };

      if (existing) {
        // Update the existing row, but ONLY if the AI is more confident than last time
        // OR the existing row is unverified (so we're not overwriting a human-verified one
        // with lower-confidence AI data).
        if (!existing.is_pp_verified || (payload.pp_confidence_score || 0) > (existing.pp_confidence_score || 0)) {
          const { error } = await supabaseAdmin
            .from("projects")
            .update(payload)
            .eq("id", existing.id);
          if (error) {
            results.errors.push(`${p.name}: ${error.message}`);
          } else {
            results.updated++;
            results.projects.push({ name: p.name, action: "updated", confidence: payload.pp_confidence_score });
          }
        } else {
          results.skipped++;
        }
      } else {
        // New row — catalog-scoped (company_id = null)
        const { error } = await supabaseAdmin.from("projects").insert({
          ...payload,
          company_id: null,
        });
        if (error) {
          results.errors.push(`${p.name}: ${error.message}`);
        } else {
          results.added++;
          results.queued_for_review++;
          results.projects.push({ name: p.name, action: "added", confidence: payload.pp_confidence_score });
        }
      }
    } catch (err) {
      results.errors.push(`${p.name || "unknown"}: ${err.message}`);
    }
  }

  await logJob(developer, results, "completed");
  return res.status(200).json(results);
}

// ── helpers ────────────────────────────────────────────────────────────────

async function logJob(developer, results, status) {
  try {
    await supabaseAdmin.from("pp_agent_jobs").insert({
      job_type: "project_scrape",
      target_name: developer.name,
      status,
      records_found: results.added + results.updated + results.skipped,
      records_added: results.added,
      records_updated: results.updated,
      records_skipped: results.skipped,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    // non-fatal — log and continue
    console.error("Failed to log job:", err.message);
  }
}

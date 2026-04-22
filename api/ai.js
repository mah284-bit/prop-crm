// api/ai.js
// Vercel serverless function — proxies requests to Anthropic Claude API
// Keeps ANTHROPIC_API_KEY server-side (never exposed to browser)

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export default async function handler(req, res) {
  // CORS (safe defaults for same-origin Vercel deploy; adjust if you add other origins)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: "Server misconfigured: ANTHROPIC_API_KEY is not set in Vercel environment variables.",
    });
  }

  try {
    const {
      messages,
      system,
      model = "claude-sonnet-4-5",
      max_tokens = 1024,
      temperature = 1,
    } = req.body || {};

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: "Request body must include a non-empty 'messages' array.",
      });
    }

    // Build payload
    const payload = {
      model,
      max_tokens,
      temperature,
      messages,
    };
    if (system) payload.system = system;

    const response = await client.messages.create(payload);

    // Extract the text from the first content block
    const textBlock = response.content?.find((b) => b.type === "text");
    const text = textBlock?.text ?? "";

    return res.status(200).json({
      text,
      stop_reason: response.stop_reason,
      usage: response.usage,
      model: response.model,
    });
  } catch (err) {
    console.error("AI route error:", err);

    // Surface Anthropic API errors cleanly
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Unknown error calling Anthropic API.";

    return res.status(status).json({
      error: message,
      type: err.type || "server_error",
    });
  }
}

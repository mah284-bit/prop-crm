// api/extract-proposal.js
// Phase 2 — AI-Extract Proposal PDF -> Opportunity fields.
// Clones the proven plumbing of validate-agreement.js (wired, working).
// Receives: proposal PDF url. Returns: structured identifiers to pre-fill an Opportunity.
// The broker ALWAYS reviews before save; extraction is assistive, never authoritative.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const { documentUrl } = req.body || {};
    if (!documentUrl) {
      return res.status(400).json({ error: "documentUrl is required" });
    }

    const docResponse = await fetch(documentUrl);
    if (!docResponse.ok) {
      return res.status(400).json({
        error: `Could not fetch document (${docResponse.status})`
      });
    }

    const contentType = docResponse.headers.get("content-type") || "";
    const buffer = await docResponse.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString("base64");

    let mediaType;
    let isImage = false;
    if (contentType.includes("pdf")) {
      mediaType = "application/pdf";
    } else if (contentType.includes("png")) {
      mediaType = "image/png"; isImage = true;
    } else if (contentType.includes("jpeg") || contentType.includes("jpg")) {
      mediaType = "image/jpeg"; isImage = true;
    } else {
      return res.status(400).json({
        error: `Unsupported file type: ${contentType}. Only PDF, JPG, PNG accepted.`
      });
    }

    const systemPrompt = `You are an expert at reading UAE real-estate property proposals.

Your task: extract the key identifiers from this proposal document so a broker can create an Opportunity from it.

Return ONLY a JSON object with this exact structure:
{
  "unit_ref": "string or null",
  "project": "string or null",
  "developer": "string or null",
  "buyer_name": "string or null",
  "price": number or null,
  "payment_plan": "string or null",
  "bedrooms": number or null,
  "confidence": "high" | "medium" | "low",
  "notes": "string or null"
}

Guidelines:
- unit_ref is the MOST important field. Extract it exactly as written; do not guess or normalise.
- price: return the agreed/net price if shown, else the headline price. Digits only (e.g. 2370783).
- If a field is not present in the document, set it to null. Never invent values.
- If the document is not a property proposal (wrong file), set confidence to "low" and note it.
- Be precise on unit_ref and price; these drive the Opportunity. Approximate on the rest.
- confidence reflects your certainty in unit_ref + price specifically.

Respond ONLY with the JSON object. No preamble, no explanation outside JSON.`;

    const userPrompt = `Please read the attached proposal document and return the JSON extraction result.`;

    const claudePayload = {
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: isImage ? "image" : "document",
              source: { type: "base64", media_type: mediaType, data: base64Data }
            },
            { type: "text", text: userPrompt }
          ]
        }
      ]
    };

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(claudePayload)
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("Claude API error:", claudeRes.status, errText);
      return res.status(502).json({
        error: `Claude API error (${claudeRes.status}): ${errText.slice(0, 200)}`
      });
    }

    const claudeData = await claudeRes.json();
    const responseText = claudeData?.content?.[0]?.text || "";

    let cleaned = responseText.trim();
    if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
    if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
    if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse Claude response:", responseText);
      return res.status(502).json({
        error: "AI response was not valid JSON",
        raw: responseText.slice(0, 500)
      });
    }

    if (!parsed.confidence || !["high", "medium", "low"].includes(parsed.confidence)) {
      parsed.confidence = "medium";
    }
    if (parsed.price != null && typeof parsed.price !== "number") {
      const n = Number(String(parsed.price).replace(/[^0-9.]/g, ""));
      parsed.price = Number.isFinite(n) && n > 0 ? n : null;
    }
    parsed.extracted_at = new Date().toISOString();
    parsed.model = "claude-sonnet-4-5";

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("extract-proposal handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}

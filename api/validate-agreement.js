// api/validate-agreement.js
// Stage 1 Day 8: AI-powered master agreement document validation
//
// Receives: signed URL of uploaded document + form data
// Returns: extracted fields + severity-graded match analysis
//
// Severity levels:
//   "info"     - Document matches form (minor formatting differences allowed)
//   "warning"  - Discrepancies that user should review (commission off, dates differ)
//   "critical" - Major mismatches (wrong developer, drastically different commission)
//
// Cost: ~$0.03-0.10 per call. Only invoked when user clicks "Validate with AI".
// Cached in DB so repeat opens don't re-validate.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const { documentUrl, formData } = req.body || {};

    if (!documentUrl) {
      return res.status(400).json({ error: "documentUrl is required" });
    }
    if (!formData) {
      return res.status(400).json({ error: "formData is required" });
    }

    // Fetch the document from the signed URL
    const docResponse = await fetch(documentUrl);
    if (!docResponse.ok) {
      return res.status(400).json({
        error: `Could not fetch document (${docResponse.status})`
      });
    }

    const contentType = docResponse.headers.get("content-type") || "";
    const buffer = await docResponse.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString("base64");

    // Determine media type for Claude
    let mediaType;
    let isImage = false;
    if (contentType.includes("pdf")) {
      mediaType = "application/pdf";
    } else if (contentType.includes("png")) {
      mediaType = "image/png";
      isImage = true;
    } else if (contentType.includes("jpeg") || contentType.includes("jpg")) {
      mediaType = "image/jpeg";
      isImage = true;
    } else {
      return res.status(400).json({
        error: `Unsupported file type: ${contentType}. Only PDF, JPG, PNG accepted.`
      });
    }

    // Build the prompt for Claude
    const systemPrompt = `You are an expert at analyzing UAE real-estate master developer agreements.

Your task: Compare a signed agreement document against form data the user entered.

Return your analysis as a JSON object with this exact structure:
{
  "extracted": {
    "developer_name": "string or null",
    "commission_pct": number or null,
    "bonus_commission_pct": number or null,
    "agreement_title": "string or null",
    "valid_from": "YYYY-MM-DD or null",
    "valid_until": "YYYY-MM-DD or null",
    "signed_by": "string or null",
    "signed_date": "YYYY-MM-DD or null"
  },
  "matches": [
    {
      "field": "developer_name",
      "form_value": "what user entered",
      "doc_value": "what document says",
      "match": true | false,
      "reason": "brief explanation"
    }
    // ... one entry per field that has both form and doc values
  ],
  "severity": "info" | "warning" | "critical",
  "summary": "one-sentence summary of validation result"
}

Severity rules:
- "info": All fields match perfectly OR only minor formatting differences (e.g., "Emaar Properties" vs "EMAAR PROPERTIES PJSC", same date in different formats)
- "warning": Some fields differ but are recoverable (commission off by 0.5%, signing date differs by a few days, name spelling variation)
- "critical": Major mismatches (wrong developer entirely, commission differs by >50%, document is not an agreement)

Important guidelines:
- If a field is not visible in the document, set doc_value to null and don't penalize
- If the document is not an agreement (wrong file uploaded), severity = "critical"
- If the document is unreadable/blank, severity = "critical"
- Be lenient on formatting, strict on actual values
- The form data is the user's claim; the document is the source of truth

Respond ONLY with the JSON object. No preamble, no explanation outside JSON.`;

    const userPrompt = `Form data the user entered:
${JSON.stringify({
  developer_name: formData.developer_name,
  commission_pct: formData.default_commission_pct,
  bonus_commission_pct: formData.bonus_commission_pct,
  agreement_title: formData.agreement_title,
  valid_from: formData.valid_from,
  valid_until: formData.valid_until,
  signed_by: formData.signed_by,
  signed_date: formData.signed_date
}, null, 2)}

Please analyze the attached document and return the JSON validation result.`;

    // Build Claude API request with vision
    const claudePayload = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: isImage ? "image" : "document",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Data
              }
            },
            {
              type: "text",
              text: userPrompt
            }
          ]
        }
      ]
    };

    // Call Claude API
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

    // Parse Claude's JSON response (strip code fences if any)
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

    // Validate the response shape
    if (!parsed.severity || !["info", "warning", "critical"].includes(parsed.severity)) {
      parsed.severity = "warning";
    }
    if (!parsed.matches) parsed.matches = [];
    if (!parsed.extracted) parsed.extracted = {};
    if (!parsed.summary) parsed.summary = "Validation complete.";

    // Add metadata
    parsed.validated_at = new Date().toISOString();
    parsed.model = "claude-sonnet-4-20250514";

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("validate-agreement handler error:", err);
    return res.status(500).json({
      error: err.message || "Internal server error"
    });
  }
}

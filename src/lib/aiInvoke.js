// aiInvoke — shared AI gateway helper. Single source of truth.
// Extracted from OpportunityDetail.jsx (was trapped local fn, called by
// App.jsx, OpportunityDetail, ProposalBuilderDialog, RemindersBell).
export async function aiInvoke({ system, prompt, messages, max_tokens }) {
  const msgs = messages || [{ role: "user", content: prompt || "" }];
  const cleaned = msgs
    .filter(m => m && m.content && (m.role === "user" || m.role === "assistant"))
    .map(m => ({ role: m.role, content: m.content }));
  const body = { messages: cleaned };
  if (system) body.system = system;
  if (max_tokens) body.max_tokens = max_tokens;
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `AI request failed (${res.status})`);
  return data.text || "";
}

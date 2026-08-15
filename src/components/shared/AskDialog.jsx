import { useState, useEffect, useRef, createContext, useContext, useCallback } from "react";

// Day 92: THE GATES STOP LOOKING LIKE THE BROWSER.
//
// Every gate in the app asked its question through window.prompt. Two things follow from that, and
// both bit during demo preparation:
//
//  1. IT LOOKS LIKE AN ERROR, NOT A PRODUCT. A grey box headed "localhost says" in front of a
//     partner. FOUNDER: "is there a way we can show it as part of the app, with a colourful screen?"
//
//  2. ⚠️ IT CAN BE SILENCED. After several prompts in one session Chrome offers "prevent this page
//     from creating additional dialogs" - and once ticked, EVERY prompt returns null instantly with
//     no dialog shown. The gate then refuses without a word: the button does nothing, the console is
//     clean, and nothing on screen explains it. It cost the founder half an hour on Day 90 and hit
//     three separate gates in one day. NO BROWSER DIALOG IS INVOLVED HERE, so it cannot happen.
//
// THE SHAPE THAT MAKES CONVERSION CHEAP: window.prompt is synchronous - execution stops and waits -
// while React is not. So `ask` returns a PROMISE that resolves when the user answers, and a call
// site changes from
//     const reason = window.prompt("...");
// to
//     const reason = await ask({ ... });
// which is one word, because every gate already sits inside an async function.
//
// RESOLUTION CONTRACT, matching what the gates already expect:
//   - Confirm with a reason  -> the trimmed string
//   - Confirm, no reason asked -> true
//   - Cancel, or an empty required reason -> null   (the gates all test falsy and return)

const AskContext = createContext(null);

export function AskProvider({ children }) {
  const [req, setReq] = useState(null);
  const resolver = useRef(null);
  const [reason, setReason] = useState("");

  const ask = useCallback((options) => {
    setReason("");
    setReq(options || {});
    return new Promise((resolve) => { resolver.current = resolve; });
  }, []);

  const finish = (value) => {
    const r = resolver.current;
    resolver.current = null;
    setReq(null);
    setReason("");
    if (r) r(value);
  };

  // Escape cancels, Enter confirms when no reason is required. A gate must never trap the broker.
  useEffect(() => {
    if (!req) return;
    const onKey = (e) => {
      if (e.key === "Escape") finish(null);
      if (e.key === "Enter" && !req.needsReason && !e.shiftKey) finish(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [req]);

  const tone = req?.tone || "default";
  const accent = tone === "danger" ? "#B91C1C" : tone === "warning" ? "#B45309" : "#0F2540";
  const wash = tone === "danger" ? "#FEF2F2" : tone === "warning" ? "#FFFBEB" : "#F8FAFC";
  const edge = tone === "danger" ? "#FCA5A5" : tone === "warning" ? "#FCD34D" : "#E2E8F0";

  const blocked = req?.needsReason && !reason.trim();

  return (
    <AskContext.Provider value={ask}>
      {children}
      {req && (
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget) finish(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(11,31,58,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: "1rem" }}
        >
          <div style={{ background: "#fff", borderRadius: 14, width: 480, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 50px rgba(11,31,58,.28)" }}>
            <div style={{ padding: "13px 18px", background: wash, borderBottom: "1px solid " + edge, borderRadius: "14px 14px 0 0" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: accent }}>{req.title || "Confirm"}</div>
            </div>

            <div style={{ padding: "16px 18px" }}>
              {req.body && (
                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.55, whiteSpace: "pre-wrap", marginBottom: req.detail || req.needsReason ? 12 : 0 }}>
                  {req.body}
                </div>
              )}

              {/* The figures a broker needs to answer honestly, set apart from the prose. */}
              {req.detail && (
                <div style={{ padding: "9px 12px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, color: "#0F2540", marginBottom: req.needsReason ? 12 : 0 }}>
                  {req.detail}
                </div>
              )}

              {req.best && (
                <div style={{ fontSize: 12, color: "#166534", marginBottom: 12 }}>
                  <strong>Better:</strong> {req.best}
                </div>
              )}

              {req.needsReason && (
                <>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: ".5px", display: "block", marginBottom: 5 }}>
                    {req.reasonLabel || "Reason (recorded)"}
                  </label>
                  <textarea
                    autoFocus
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={req.placeholder || ""}
                    rows={3}
                    style={{ width: "100%", padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, resize: "vertical", fontFamily: "inherit" }}
                  />
                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4 }}>
                    This is kept on the deal's record with your name and the date.
                  </div>
                </>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "0 18px 16px" }}>
              <button
                onClick={() => finish(null)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                {req.cancelLabel || "Cancel"}
              </button>
              <button
                onClick={() => finish(req.needsReason ? reason.trim() : true)}
                disabled={blocked}
                title={blocked ? "A reason is required" : undefined}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: blocked ? "#CBD5E0" : accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: blocked ? "not-allowed" : "pointer" }}
              >
                {req.confirmLabel || "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AskContext.Provider>
  );
}

// Falls back to window.confirm/prompt if a component is somehow rendered outside the provider -
// worse, but never a dead button.
export function useAsk() {
  const ask = useContext(AskContext);
  return ask || (async (o) => {
    if (o?.needsReason) {
      const r = window.prompt([o.title, o.body].filter(Boolean).join("\n\n"));
      return r && r.trim() ? r.trim() : null;
    }
    return window.confirm([o?.title, o?.body].filter(Boolean).join("\n\n")) ? true : null;
  });
}

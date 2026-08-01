import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";

// Day 81: THE DEVELOPER SIDE - closing the loop.
// The app recorded OUTCOMES (money received, terms agreed, an approval reference string) but never
// the WORK that produced them: what the buyer asked that the broker could not answer, who he asked,
// when he needed it by, and what came back. A block IS a negotiation with a developer and none of
// that negotiation was anywhere in the app.
//
// DELIBERATELY SMALL - founder: "not too many things like you have to run a CRM."
// ONE entity: an open question with an answer. No developer login, no approval chain, no status
// machine. Everything happens in the broker's presence - at the developer's office, in a meeting -
// so the app records what he WITNESSED, exactly as it does for the buyer side.
//
// WHAT THE MANAGER GETS, and it justifies the feature on its own: today a manager sees money and
// stages, and nothing shows that the broker chased the developer four times. The effort is
// INVISIBLE, so "he is only talking to the buyer" is the impression. Open questions with dates
// make the developer-side work visible, and tell the manager when to step in himself.
export default function DeveloperQuestions({ oppId, blockId, currentUser, showToast }) {
  const [rows, setRows] = useState([]);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [who, setWho] = useState("");
  const [by, setBy] = useState("");
  const [answering, setAnswering] = useState(null);
  const [ans, setAns] = useState("");
  const [via, setVia] = useState("Call");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      if (!oppId && !blockId) return;
      let qq = supabase
        .from("developer_questions")
        .select("*")
        .order("created_at", { ascending: false });
      qq = oppId ? qq.eq("opportunity_id", oppId) : qq.eq("block_deal_id", blockId);
      const { data } = await qq;
      setRows(data || []);
    })();
  }, [oppId, blockId, tick]);

  const dmy = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "");
  const openQs = rows.filter((r) => !r.answered_at);
  const doneQs = rows.filter((r) => r.answered_at);
  const overdue = (r) =>
    r.needed_by && new Date(r.needed_by) < new Date(new Date().toDateString());

  const save = async () => {
    if (!q.trim()) {
      showToast("What did the buyer ask?", "error");
      return;
    }
    const { error } = await supabase.from("developer_questions").insert({
      company_id: currentUser.company_id,
      opportunity_id: oppId || null,
      block_deal_id: oppId ? null : blockId,
      question: q.trim(),
      ask_who: who.trim() || null,
      needed_by: by || null,
      asked_by: currentUser.id,
    });
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setQ("");
    setWho("");
    setBy("");
    setAdding(false);
    setTick((t) => t + 1);
    showToast("Question logged - it stays open until the developer answers", "success");
  };

  const answer = async (row) => {
    if (!ans.trim()) {
      showToast("Record what the developer said", "error");
      return;
    }
    const { error } = await supabase
      .from("developer_questions")
      .update({
        answer: ans.trim(),
        answered_at: new Date().toISOString(),
        answered_via: via,
        answered_by: currentUser.id,
      })
      .eq("id", row.id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setAns("");
    setAnswering(null);
    setTick((t) => t + 1);
    showToast("Answer recorded", "success");
  };

  const S = {
    head: { display: "flex", alignItems: "center", gap: 10, marginBottom: 3 },
    title: { fontSize: 13, fontWeight: 700, color: "#0F2540" },
    pill: {
      fontSize: 11,
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: 9,
      background: "#FFFBEB",
      color: "#B45309",
      border: "1px solid #FCD34D",
    },
    ask: {
      marginLeft: "auto",
      padding: "4px 12px",
      borderRadius: 7,
      border: "1px solid #0F2540",
      background: "#fff",
      color: "#0F2540",
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
    },
    sub: { fontSize: 11, color: "#94A3B8", marginBottom: 10 },
    box: {
      background: "#F8FAFC",
      border: "1px solid #E2E8F0",
      borderRadius: 10,
      padding: "11px 13px",
      marginBottom: 12,
    },
    inp: {
      padding: "7px 9px",
      border: "1px solid #D1D5DB",
      borderRadius: 7,
      fontSize: 12,
    },
    lab: {
      fontSize: 10,
      fontWeight: 700,
      color: "#64748B",
      textTransform: "uppercase",
      letterSpacing: ".4px",
    },
    fieldRow: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 },
    end: { display: "flex", justifyContent: "flex-end", gap: 8 },
    no: {
      padding: "6px 13px",
      borderRadius: 7,
      border: "1px solid #CBD5E1",
      background: "#fff",
      color: "#64748B",
      fontSize: 12,
      cursor: "pointer",
    },
    yes: {
      padding: "6px 15px",
      borderRadius: 7,
      border: "none",
      background: "#0F2540",
      color: "#fff",
      fontSize: 12,
      fontWeight: 700,
      cursor: "pointer",
    },
    card: {
      border: "1px solid #E2E8F0",
      borderLeft: "3px solid #B45309",
      borderRadius: 8,
      padding: "9px 12px",
      marginBottom: 8,
      background: "#fff",
    },
    cardDone: {
      border: "1px solid #E2E8F0",
      borderLeft: "3px solid #16A34A",
      borderRadius: 8,
      padding: "9px 12px",
      marginBottom: 8,
      background: "#fff",
    },
    qtext: { fontSize: 12, fontWeight: 700, color: "#0F2540", marginBottom: 3 },
    meta: { fontSize: 11, color: "#94A3B8" },
    atext: {
      fontSize: 12,
      color: "#166534",
      marginTop: 5,
      paddingTop: 5,
      borderTop: "1px dashed #E2E8F0",
    },
    late: { color: "#B91C1C", fontWeight: 700 },
    small: {
      padding: "3px 10px",
      borderRadius: 6,
      border: "1px solid #16A34A",
      background: "#fff",
      color: "#16A34A",
      fontSize: 11,
      fontWeight: 700,
      cursor: "pointer",
    },
  };

  return (
    <div style={{ marginTop: 18 }}>
      <div style={S.head}>
        <div style={S.title}>Developer questions</div>
        {openQs.length > 0 && <span style={S.pill}>{openQs.length} open</span>}
        {!adding && (
          <button onClick={() => setAdding(true)} style={S.ask}>
            Ask the developer
          </button>
        )}
      </div>
      <div style={S.sub}>
        What the buyer asked that you could not answer - and what came back.
      </div>

      {adding && (
        <div style={S.box}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What does the buyer want to know?"
            style={{ ...S.inp, width: "100%", boxSizing: "border-box", marginBottom: 8 }}
          />
          <div style={S.fieldRow}>
            <div>
              <label style={S.lab}>Who will you ask</label>
              <br />
              <input
                value={who}
                onChange={(e) => setWho(e.target.value)}
                placeholder="e.g. Ghassan, Emaar sales"
                style={{ ...S.inp, width: 200 }}
              />
            </div>
            <div>
              <label style={S.lab}>Needed by</label>
              <br />
              <input
                type="date"
                value={by}
                onChange={(e) => setBy(e.target.value)}
                style={S.inp}
              />
            </div>
          </div>
          <div style={S.end}>
            <button
              onClick={() => {
                setAdding(false);
                setQ("");
                setWho("");
                setBy("");
              }}
              style={S.no}
            >
              Cancel
            </button>
            <button onClick={save} style={S.yes}>
              Log it
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 && !adding && (
        <div style={{ ...S.meta, fontStyle: "italic" }}>
          Nothing asked yet. When the buyer asks something you cannot answer, log it here so it is
          not carried in your head.
        </div>
      )}

      {openQs.map((r) => (
        <div key={r.id} style={S.card}>
          <div style={S.qtext}>{r.question}</div>
          <div style={S.meta}>
            {r.ask_who ? "Asking " + r.ask_who : "Nobody named yet"}
            {r.needed_by ? " \u00b7 " : ""}
            {r.needed_by && (
              <span style={overdue(r) ? S.late : {}}>
                {overdue(r) ? "was needed by " : "needed by "}
                {dmy(r.needed_by)}
              </span>
            )}
          </div>
          {answering === r.id ? (
            <div style={{ marginTop: 8 }}>
              <input
                value={ans}
                onChange={(e) => setAns(e.target.value)}
                placeholder="What did the developer say?"
                style={{ ...S.inp, width: "100%", boxSizing: "border-box", marginBottom: 7 }}
              />
              <div style={S.end}>
                <select value={via} onChange={(e) => setVia(e.target.value)} style={S.inp}>
                  <option>Call</option>
                  <option>Meeting</option>
                  <option>Email</option>
                  <option>WhatsApp</option>
                </select>
                <button
                  onClick={() => {
                    setAnswering(null);
                    setAns("");
                  }}
                  style={S.no}
                >
                  Cancel
                </button>
                <button onClick={() => answer(r)} style={S.yes}>
                  Record the answer
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 6 }}>
              <button onClick={() => setAnswering(r.id)} style={S.small}>
                Record the answer
              </button>
            </div>
          )}
        </div>
      ))}

      {doneQs.map((r) => (
        <div key={r.id} style={S.cardDone}>
          <div style={S.qtext}>{r.question}</div>
          <div style={S.atext}>
            {r.answer}
            <div style={{ ...S.meta, marginTop: 3 }}>
              {r.answered_via ? r.answered_via + " \u00b7 " : ""}
              {dmy(r.answered_at)}
              {r.ask_who ? " \u00b7 " + r.ask_who : ""}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

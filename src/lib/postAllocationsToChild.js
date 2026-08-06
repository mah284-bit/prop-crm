import { supabase } from "./supabase.js";

// Day 86: POST BLOCK MONEY INTO THE CHILD'S LEDGER.
//
// The block credits `block_payment_allocations` - which is correct, that is the audit trail of what
// was allocated to which unit for which particular. But the CHILD'S OWN SCREENS read
// pp_sales_closures.pre_spa_payments. So a block payment of 707,269 landed, every allocation was
// written correctly, and the child's bill still said 492,091 outstanding. The mirror image of the
// Day-85 fault, from the other direction.
//
// THE RULE AGREED (Day 86): ONE LEDGER PER CHILD, TWO SOURCES. Block money and the child's own
// collection both post into the same row. Neither is blind to the other.
//
// CUMULATIVE, NOT INCREMENTAL. The amount written is always the TOTAL allocated to that child for
// that particular, read fresh from the allocations. So a second block payment cannot double-count,
// and an amended allocation corrects itself on the next post. The allocations remain the AUDIT
// TRAIL; the closure row is the BALANCE, derived from it rather than accumulated beside it.

// Day 86: the RECEIVED DATE must be the date the money ARRIVED, not the date the app posted it.
// A payment received on 1 August and recorded on the 6th showed the 6th in the child's ledger -
// the sort of thing an accountant catches and a broker cannot explain.
export async function postAllocationsToChild(oppId, receivedDate) {
  if (!oppId) return { ok: false, error: "no opportunity" };
  try {
    const { data: closure } = await supabase
      .from("pp_sales_closures")
      .select("id, pre_spa_payments")
      .eq("opportunity_id", oppId)
      .maybeSingle();
    // No ledger yet means the child has not reached Reserved - birthChildClosure will credit it
    // when it does, reading the same allocations. Nothing to do here.
    if (!closure) return { ok: true, skipped: "no ledger yet" };

    const { data: allocs } = await supabase
      .from("block_payment_allocations")
      .select("particular, amount")
      .eq("opportunity_id", oppId);

    const total = {};
    (allocs || []).forEach((a) => {
      const k = a.particular || "reservation";
      total[k] = (total[k] || 0) + (Number(a.amount) || 0);
    });

    const pre = { ...(closure.pre_spa_payments || {}) };
    const map = {
      reservation: "reservation_fee",
      reservation_fee: "reservation_fee",
      initial_advance: "initial_advance",
      spa_fee: "spa_fee",
      dld_fee: "dld_fee",
      oqood_fee: "oqood_fee",
    };

    let touched = 0;
    Object.entries(total).forEach(([particular, amount]) => {
      const key = map[particular];
      if (!key || !pre[key]) return;
      // Never overwrite a WAIVED row - that is a decision, not a balance.
      if (pre[key].status === "waived") return;
      if (Number(pre[key].amount || 0) === Number(amount)) return;
      pre[key] = {
        ...pre[key],
        amount: String(amount),
        status: amount > 0 ? "received" : (pre[key].status || "pending"),
        date: pre[key].date || receivedDate || new Date().toISOString().slice(0, 10),
        method: pre[key].method || "Block allocation",
        notes: pre[key].notes || "Credited from block-level payments",
      };
      touched++;
    });

    if (!touched) return { ok: true, skipped: "already in step" };

    const { error } = await supabase
      .from("pp_sales_closures")
      .update({ pre_spa_payments: pre })
      .eq("id", closure.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, touched };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

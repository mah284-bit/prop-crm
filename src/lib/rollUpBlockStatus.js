import { supabase } from "./supabase.js";

// Day 82: A BLOCK COMPLETES, IT IS NOT CLOSED.
//
// Ruling (founder, Day 82): the closure ceremony is PER CHILD - the developer processes the SPA,
// the broker receives a copy, and THAT unit closes. Market check confirmed the shape: off-plan
// SPAs register through DLD's Oqood portal and each unit receives its own Oqood certificate, which
// becomes that unit's title deed. A certificate per unit means an SPA per unit. There is no group
// SPA as a DLD product.
//
// So the block has NO close button of its own. A block marked Won while one of its units still
// sits at SPA Requirements would be a lie, and the honest-ledger doctrine does not allow a surface
// to claim more than the record supports. The block simply REFLECTS where its children stand.
//
// The one genuinely block-level ceremony is CANCELLATION - the arrangement dying wholesale, which
// is a human act. "Nothing auto-cancels, humans decide" (Day 77). A manual cancellation is
// therefore never overwritten by a derived state.
//
// Called after any child stage change. Cheap: one read, and a write only when the status moves.
export async function rollUpBlockStatus(blockDealId) {
  if (!blockDealId) return { ok: true, unchanged: true };

  const { data: kids, error } = await supabase
    .from("opportunities")
    .select("id, stage")
    .eq("block_deal_id", blockDealId);
  if (error) return { ok: false, error: error.message };
  if (!kids || !kids.length) return { ok: true, unchanged: true };

  const won = kids.filter((k) => k.stage === "Closed Won").length;
  const lost = kids.filter((k) => k.stage === "Closed Lost").length;
  const live = kids.length - won - lost;

  // Nothing is derived while any child is still working - the block stays as it is.
  let next = null;
  if (live === 0) {
    if (won === kids.length) next = "completed";
    else if (lost === kids.length) next = "cancelled";
    else next = "partially_dropped";
  }
  if (!next) return { ok: true, unchanged: true };

  const { data: b } = await supabase
    .from("block_deals")
    .select("status")
    .eq("id", blockDealId)
    .maybeSingle();
  if (!b) return { ok: true, unchanged: true };
  if (b.status === next) return { ok: true, unchanged: true };

  // A MANUAL cancellation is a decision. Never let a derived state overwrite it.
  if (b.status === "cancelled") return { ok: true, unchanged: true };

  const { error: uErr } = await supabase
    .from("block_deals")
    .update({ status: next })
    .eq("id", blockDealId);
  if (uErr) return { ok: false, error: uErr.message };

  return { ok: true, status: next, won, lost, total: kids.length };
}

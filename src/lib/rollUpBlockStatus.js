import { supabase } from "./supabase.js";

// Day 82: A BLOCK COMPLETES, IT IS NOT CLOSED - and a resolved child must not leave debris.
//
// Ruling (founder, Day 82): the closure ceremony is PER CHILD - the developer processes the SPA,
// the broker receives a copy, and THAT unit closes. Market check confirmed the shape: off-plan
// SPAs register through DLD's Oqood portal and each unit gets its own Oqood certificate, which
// becomes that unit's title deed. A certificate per unit means an SPA per unit; there is no group
// SPA as a DLD product.
//
// So the block has NO close button of its own. A block marked Won while one of its units still
// sits at SPA Requirements would be a lie. The block simply REFLECTS where its children stand.
// The one genuinely block-level ceremony is CANCELLATION - a human act, never derived over.
//
// WHAT DAY-82 TESTING EXPOSED: closing a child told nothing else. Both units of a cancelled block
// stayed BOOKED - inventory silently held by a dead arrangement, with nothing on any screen
// saying why - and the block's own LINES still read "confirmed" while both deals were Closed Lost.
// The block's record disagreed with reality. So this function now settles all three together:
// the line, the unit, and the block's status. One place, one truth.
export async function rollUpBlockStatus(blockDealId) {
  if (!blockDealId) return { ok: true, unchanged: true };

  const { data: kids, error } = await supabase
    .from("opportunities")
    .select("id, stage, unit_id")
    .eq("block_deal_id", blockDealId);
  if (error) return { ok: false, error: error.message };
  if (!kids || !kids.length) return { ok: true, unchanged: true };

  const { data: lines } = await supabase
    .from("block_deal_units")
    .select("id, child_opportunity_id, status, unit_id")
    .eq("block_deal_id", blockDealId);

  let freed = 0;
  let linesMoved = 0;

  for (const k of kids) {
    const line = (lines || []).find((l) => l.child_opportunity_id === k.id);

    // A LOST child releases its unit. Nothing else in the app does this, so a dead deal used to
    // hold inventory forever - Day-82 testing found both units of a cancelled block still Booked.
    // Only ever set back to Available; never to Sold or Reserved, which are earned states owned
    // by the deal itself.
    if (k.stage === "Closed Lost") {
      if (line && line.status !== "dropped") {
        await supabase
          .from("block_deal_units")
          .update({ status: "dropped", status_reason: "Deal closed lost" })
          .eq("id", line.id);
        linesMoved++;
      }
      if (k.unit_id) {
        const { data: u } = await supabase
          .from("project_units")
          .select("status")
          .eq("id", k.unit_id)
          .maybeSingle();
        if (u && (u.status === "Booked" || u.status === "Reserved")) {
          await supabase
            .from("project_units")
            .update({ status: "Available" })
            .eq("id", k.unit_id);
          freed++;
        }
      }
    }

    // A WON child's unit belongs to the buyer. The unit's own status is the deal's business, not
    // the block's - we only settle the LINE so the block's record stops claiming it is in play.
    if (k.stage === "Closed Won" && line && line.status !== "sold") {
      await supabase
        .from("block_deal_units")
        .update({ status: "sold" })
        .eq("id", line.id);
      linesMoved++;
    }
  }

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
  if (!next) return { ok: true, unchanged: true, freed, linesMoved };

  const { data: b } = await supabase
    .from("block_deals")
    .select("status")
    .eq("id", blockDealId)
    .maybeSingle();
  if (!b) return { ok: true, unchanged: true, freed, linesMoved };
  if (b.status === next) return { ok: true, unchanged: true, freed, linesMoved };

  // A MANUAL cancellation is a decision. Never let a derived state overwrite it.
  if (b.status === "cancelled") return { ok: true, unchanged: true, freed, linesMoved };

  const { error: uErr } = await supabase
    .from("block_deals")
    .update({ status: next })
    .eq("id", blockDealId);
  if (uErr) return { ok: false, error: uErr.message };

  return { ok: true, status: next, won, lost, total: kids.length, freed, linesMoved };
}

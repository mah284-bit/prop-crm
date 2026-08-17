import { supabase } from "./supabase.js";
import { dealBill } from "./dealBill.js";
import { getFees } from "./feeSettings.js";

// Day 86: BIRTH THE CHILD'S COLLECTION LEDGER.
//
// A block child never went through the 1-to-1 RESERVATION CEREMONY. It is born at Offer Accepted
// and the block's completing payment advances it to Reserved - so no pp_sales_closures row was
// ever created for it. Found on the Day-85 walkthrough, live on AGR-08-04:
//   - NO FROZEN FEE POLICY, so dealFees fell through to the declared constant and the deal stated
//     an SPA fee of 5,250 while the block's own Money tab showed 6,000 for the same unit.
//   - NO LEDGER, so the bill panel read "25,002 already credited" when the block had allocated
//     163,436 to that unit across four particulars.
// Both wrong, in opposite directions, on the same screen a broker quotes from.
//
// THE RULING (Day 86): money arrives at BOTH levels, because that is how buyers pay - "it is a
// limitation of the card, I will pay this, bring a cheque later", and on a block it may come in
// two or three tranches. So neither level is the right one. ONE LEDGER PER CHILD, TWO SOURCES:
// a block payment allocates across children and credits each child's row; the child's own
// collection credits it directly. Neither is blind to the other.
//
// DOUBLE-COUNTING GUARD: block_payment_allocations stays the AUDIT TRAIL; this row is the BALANCE.
// Never sum both. That is why the reservation credited here is read from the allocations ONCE, at
// birth, and not recomputed afterwards.

const row = (expected, extra) => ({
  status: "pending", amount: "", date: "", notes: "", method: "",
  expected_amount: expected, ...(extra || {}),
});

export async function birthChildClosure({ child, block, companyId, currentUser }) {
  if (!child?.id || !block?.id) return { ok: false, error: "missing child or block" };
  try {
    // Never overwrite. If a row exists the child has its own history now.
    const { data: existing } = await supabase
      .from("pp_sales_closures").select("id").eq("opportunity_id", child.id).maybeSingle();
    if (existing) return { ok: true, skipped: "already has a ledger" };

    const fees = await getFees(companyId);
    const price = Number(child.current_agreed_price || child.budget || 0);

    // What the BLOCK has already put against this child, by particular. Read once, at birth.
    const { data: allocs } = await supabase
      .from("block_payment_allocations")
      .select("particular, amount")
      .eq("opportunity_id", child.id);
    const paid = {};
    (allocs || []).forEach((a) => {
      const k = a.particular || "reservation";
      paid[k] = (paid[k] || 0) + (Number(a.amount) || 0);
    });

    const bill = dealBill({
      price,
      planPreset: block.payment_plan_preset || child.current_payment_plan_preset,
      reservationAmount: paid.reservation || 0,
      spaFee: fees.spaFee,
      oqoodFee: fees.oqoodFee,
      dldPayer: child.current_dld_payer || "buyer",
      dldSplitPct: child.current_dld_split_pct || 50,
      dldPct: fees.dldPct,
    });

    const received = (k, expected) => {
      const got = Number(paid[k] || 0);
      if (got <= 0) return row(expected);
      return row(expected, {
        status: "received",
        amount: String(got),
        date: new Date().toISOString().slice(0, 10),
        method: "Block allocation",
        notes: "Credited from a block-level payment on " + (block.title || "this block"),
      });
    };

    const { error } = await supabase.from("pp_sales_closures").insert({
      opportunity_id: child.id,
      company_id: companyId,
      // NOT NULL on this table. On a 1-to-1 the row is born at SPA SIGNED and carries the final
      // agreed price; here it is born at RESERVED, before any SPA exists. The honest value is the
      // child's NET PRICE FROM THE BLOCK DISTRIBUTION - what the buyer has agreed to pay for this
      // unit. It is overwritten by the SPA ceremony if the final price differs, and that
      // divergence is already flagged there.
      final_sale_price: price,
      pre_spa_payments: {
        booking_fee:     row(null),
        reservation_fee: received("reservation", bill.reservation_fee.expected),
        initial_advance: received("initial_advance", bill.initial_advance.expected),
        spa_fee:         received("spa_fee", bill.spa_fee.expected),
        dld_fee:         received("dld_fee", bill.dld_fee.expected),
        oqood_fee:       received("oqood_fee", bill.oqood_fee.expected),
        other_fees:      row(null),
      },
      // The policy is frozen at the moment the unit becomes Reserved, exactly as the 1-to-1
      // ceremony freezes it - so a later change to company fees cannot reprice a settled deal.
      frozen_fee_policy: {
        spaFee: fees.spaFee, oqoodFee: fees.oqoodFee, dldPct: fees.dldPct,
        // Day 93: the developer's admin charge freezes with the rest. It moves more often than any
        // company figure, which is exactly why a reserved unit must keep the one it was priced on.
        adminFeePerUnit: fees.adminFeePerUnit || 0,
        reservationFee: fees.reservationFee,
        frozen_at: new Date().toISOString(),
        source: "block reservation completed",
      },
      created_by: currentUser?.id || null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, credited: paid };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

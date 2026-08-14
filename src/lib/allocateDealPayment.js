// Day 91: ONE PAYMENT, ALLOCATED ACROSS THE PARTICULARS.
//
// FOUNDER: "there are four payments, nobody will transfer or send a cheque for a, then b, then c -
// the expectation is all payments coming in. Why not like block payment: use one entry, amount
// received, and distribute to the four payments instead of units in a block."
//
// He is right, and the block has done exactly this since Day 80. A broker does not receive "a DLD
// payment" - he receives 586,534. What it COVERS is a question of allocation, not of data entry.
// Recording it line by line meant five clicks per line and twenty-five actions on a five-line
// collection, for a single transfer that arrived once.
//
// SAME DOCTRINE AS THE BLOCK, and for the same reason - PROPORTIONAL, NOT WATERFALL: the developer
// receives money against the account, not earmarked. Proportional keeps every line advancing
// together rather than declaring one settled arbitrarily because it happened to be first in a list.
//
// This is the block's Stage 1 with no Stage 2: one deal, so there are no units to spread across.
// The reservation is excluded - it is collected at its own ceremony and settled before this stage.

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Order matters only for the rounding remainder, which lands on the last live line.
const KEYS = ["initial_advance", "dld_fee", "spa_fee", "oqood_fee", "other_fees"];

export const PARTICULAR_LABELS = {
  booking_fee: "Booking fee",
  reservation_fee: "Reservation fee",
  initial_advance: "First instalment",
  spa_fee: "SPA fee",
  dld_fee: "DLD fee",
  oqood_fee: "Oqood fee",
  other_fees: "Other developer fees",
};

// ledger is pre_spa_payments: { key: { expected_amount, amount, status } }
export function allocateDealPayment({ amount, ledger }) {
  const landed = Number(amount) || 0;
  const rows = [];
  if (!landed || !ledger) return { rows, allocated: 0, unallocated: landed };

  const owed = {};
  let owedTotal = 0;
  KEYS.forEach((k) => {
    const r = ledger[k];
    if (!r || r.status === "waived") { owed[k] = 0; return; }
    const exp = Number(r.expected_amount || 0);
    const got = Number(r.amount || 0);
    const out = Math.max(0, exp - got);
    owed[k] = out;
    owedTotal += out;
  });

  if (!owedTotal) return { rows, allocated: 0, unallocated: landed };

  // Never allocate more than is owed. What is left over is UNALLOCATED and the broker is told -
  // money beyond the bill belongs somewhere else, and silently forcing it onto a line would make
  // the per-particular record meaningless (Day 90 ruling).
  const share = Math.min(landed, owedTotal);
  const live = KEYS.filter((k) => owed[k] > 0);
  let given = 0;
  live.forEach((k, i) => {
    const amt = i === live.length - 1 ? r2(share - given) : r2((share * owed[k]) / owedTotal);
    given = r2(given + amt);
    if (amt > 0) rows.push({ particular: k, label: PARTICULAR_LABELS[k] || k, amount: amt, owed_before: owed[k] });
  });

  return { rows, allocated: r2(given), unallocated: r2(landed - given) };
}

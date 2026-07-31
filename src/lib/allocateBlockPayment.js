// Day 80: BLOCK COLLECTION ALLOCATION - two-stage, proportional, invisible to the broker.
//
// FOUNDER'S MODEL: a chunk of money arrives for the BLOCK. The broker does not receive "an
// instalment payment" - he receives 500,000. What it COVERS is a question of allocation, not of
// data entry. So he records ONE amount and the app does the rest:
//   Stage 1 - across PARTICULARS, proportional to what each still owes
//   Stage 2 - within each, across UNITS, proportional to what each unit still owes
//
// WHY PROPORTIONAL NOT EQUAL: the reservation is a FIXED FEE per unit, so equal is right there
// and stays. Every other particular is a PERCENTAGE, so equal would over-credit small units and
// under-credit large ones - each unit's cost basis would be wrong at SPA.
// WHY NOT WATERFALL: the developer receives money against the account, not earmarked. Proportional
// keeps everything advancing together rather than declaring one line settled arbitrarily.
// The broker's only question is "is the chunk fully collected?" - detail belongs on the Money tab.

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const KEYS = ["initial_advance", "spa_fee", "dld_fee", "oqood_fee", "other_fees"];
const TOT = { initial_advance: "initial", spa_fee: "spa", dld_fee: "dld", oqood_fee: "oqood", other_fees: "other" };

export function allocateBlockPayment({ amount, bill, paidByParticular = {}, paidByUnit = {} }) {
  const landed = Number(amount) || 0;
  if (!landed || !bill) return { particulars: [], units: [], unallocated: landed };

  const owed = {};
  let owedTotal = 0;
  KEYS.forEach((k) => {
    const exp = Number((bill.tot || {})[TOT[k]] || 0);
    const out = Math.max(0, exp - Number(paidByParticular[k] || 0));
    owed[k] = out;
    owedTotal += out;
  });
  if (!owedTotal) return { particulars: [], units: [], unallocated: landed };

  const share = Math.min(landed, owedTotal);
  const particulars = [];
  const live = KEYS.filter((k) => owed[k] > 0);
  let given = 0;
  live.forEach((k, i) => {
    const amt = i === live.length - 1 ? r2(share - given) : r2(share * owed[k] / owedTotal);
    given = r2(given + amt);
    if (amt > 0) particulars.push({ particular: k, amount: amt, owed_before: owed[k] });
  });

  // STAGE 2 - within each particular, across units, by what each unit still owes.
  const units = [];
  particulars.forEach((pRow) => {
    const rows = (bill.per || []).map((u) => {
      const row = (u.bill || {})[pRow.particular] || {};
      const exp = Number(row.expected || 0);
      const got = Number(paidByUnit[pRow.particular + "|" + u.child_id] || 0);
      return { child_id: u.child_id, unit_ref: u.unit_ref, out: row.waived ? 0 : Math.max(0, exp - got) };
    }).filter((x) => x.out > 0);
    const uTotal = rows.reduce((t, x) => t + x.out, 0);
    if (!uTotal) return;
    let sent = 0;
    rows.forEach((x, i) => {
      const amt = i === rows.length - 1 ? r2(pRow.amount - sent) : r2(pRow.amount * x.out / uTotal);
      sent = r2(sent + amt);
      if (amt > 0) units.push({ particular: pRow.particular, child_id: x.child_id, unit_ref: x.unit_ref, amount: amt });
    });
  });

  // unallocated surfaces OVERPAYMENT rather than hiding it - the honest-ledger rule.
  return { particulars, units, unallocated: r2(landed - share) };
}

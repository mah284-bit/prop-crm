// BL-1 (Day 77): ONE TRUTH for "what does this deal owe, per particular".
// Extracted from OpportunityDetail's SPA-dialog effects so the 1-to-1 ledger and the BLOCK
// ledger compute identically. PURE - no supabase, no React. The caller fetches company /
// developer defaults and passes them in (portable, testable, N children without N round-trips).
//
// Collapsed two silo divergences found during extraction:
//  1. plan pct was a lookup MAP at one site and a REGEX (default 10) at another. Regex wins -
//     it handles any "N/M" preset without a map to maintain.
//  2. spa_fee 5250 / oqood_fee 4020 were HARD-CODED at one site while another read them from
//     company/developer settings. Settings win; the constants are last-resort fallbacks only.

// Fallbacks live in lib/feeSettings.js - the company's POLICY is the source of truth.
// These re-exports exist only so older callers keep working; pass resolved fees instead.
import { FALLBACK } from "./feeSettings.js";
export const FALLBACK_SPA_FEE = FALLBACK.spaFee;
export const FALLBACK_OQOOD_FEE = FALLBACK.oqoodFee;
export const DLD_PCT = FALLBACK.dldPct;

// "20/80" -> 20 · "50/50 PHP" -> 50 · "Custom"/unknown -> null
export function planInitialPct(preset) {
  const m = String(preset || "").match(/^(\d+)\s*\//);
  return m ? Number(m[1]) : null;
}

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Returns the EXPECTED amount for every particular of one deal.
// dldPayer: "buyer" | "developer" | "split" | "negotiated"
export function dealBill({
  price,
  planPreset,
  reservationAmount = 0,
  spaFee,
  oqoodFee,
  dldPayer = "buyer",
  dldSplitPct = 50,
  dldPct,
  // Day 93: THE DEVELOPER'S ADMIN CHARGE, per unit. Defaults to 0 so every existing caller keeps
  // today's behaviour exactly - a caller that does not pass it gets a dash on the line, as before.
  // Founder's ruling (Day 92): per unit, per developer, "it may change regularly" - which is why it
  // resolves through the master agreement and freezes at reservation like every other fee.
  adminFeePerUnit = 0,
} = {}) {
  const DPCT = dldPct != null ? Number(dldPct) : FALLBACK.dldPct;
  const p = Number(price || 0);
  const pct = planInitialPct(planPreset);
  const dldFull = r2(p * DPCT / 100);

  let dldExpected = 0;
  let dldWaived = false;
  let dldNote = "";
  if (dldPayer === "buyer") {
    dldExpected = dldFull;
    dldNote = "Expected from DLD payer: Buyer (" + DPCT + "% of final price)";
  } else if (dldPayer === "developer") {
    dldWaived = true;
    dldNote = "Auto from DLD payer: Developer absorbs";
  } else if (dldPayer === "split") {
    const bp = Number(dldSplitPct) || 50;
    dldExpected = r2(dldFull * bp / 100);
    const dev = r2(dldFull - dldExpected);
    dldNote = "Auto from DLD payer: Split - Buyer " + bp + "% (AED " +
      dldExpected.toLocaleString() + "), Developer " + (100 - bp) + "% (AED " +
      dev.toLocaleString() + ")";
  } else {
    dldNote = "Negotiated - enter manually";
  }

  return {
    reservation_fee: { expected: r2(reservationAmount) },
    initial_advance: { expected: pct ? r2(p * pct / 100) : 0, pct: pct },
    spa_fee:   { expected: r2(spaFee != null ? spaFee : FALLBACK_SPA_FEE) },
    dld_fee:   { expected: dldExpected, waived: dldWaived, note: dldNote, full: dldFull },
    oqood_fee: { expected: r2(oqoodFee != null ? oqoodFee : FALLBACK_OQOOD_FEE) },
    // The line took money and never stated what was owed. It does now, when the developer charges
    // one; a developer who charges nothing still shows a dash, which is the honest difference.
    other_fees:{ expected: r2(adminFeePerUnit) },
  };
}

// Sum of everything the buyer is expected to pay at this stage (waived rows excluded).
export function billTotal(bill) {
  if (!bill) return 0;
  return Object.values(bill).reduce(
    (s, row) => s + (row && !row.waived ? Number(row.expected || 0) : 0), 0);
}

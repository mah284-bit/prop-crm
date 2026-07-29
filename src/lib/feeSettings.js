import { supabase } from "./supabase.js";

// Day 78: ONE TRUTH for a company's fee policy.
// Founder: "broker to broker they charge according to the govt fees they pay AND have a company
// admin cost - some increase the value of the govt fees as part of their admin charges. Giving
// them the freedom to set their policies." The constants below are LAST-RESORT fallbacks only,
// used when a company has not set its own. They are NOT the policy.
//
// Read chain: company setting -> fallback constant.
// (A developer-level override tier is designed but its link column does not exist yet - see
// the board. When it lands, it slots between the two.)

export const FALLBACK = {
  spaFee: 5250,
  oqoodFee: 4020,
  reservationFee: 25000,
  dldPct: 4,
};

const num = (v, fb) => (v === null || v === undefined || v === "" ? fb : Number(v));

// Pure: turn a companies row into the resolved fee policy.
export function resolveFees(company) {
  return {
    spaFee:         num(company?.default_spa_fee,         FALLBACK.spaFee),
    oqoodFee:       num(company?.default_oqood_fee,       FALLBACK.oqoodFee),
    reservationFee: num(company?.default_reservation_fee, FALLBACK.reservationFee),
    dldPct:         num(company?.default_dld_pct,         FALLBACK.dldPct),
    isDefault: {
      spaFee:         company?.default_spa_fee == null,
      oqoodFee:       company?.default_oqood_fee == null,
      reservationFee: company?.default_reservation_fee == null,
      dldPct:         company?.default_dld_pct == null,
    },
  };
}

// Session cache - the policy changes rarely; do not round-trip per dialog open.
const cache = new Map();

export async function getFees(companyId) {
  if (!companyId) return resolveFees(null);
  if (cache.has(companyId)) return cache.get(companyId);
  const { data } = await supabase
    .from("companies")
    .select("default_spa_fee, default_oqood_fee, default_reservation_fee, default_dld_pct")
    .eq("id", companyId)
    .maybeSingle();
  const fees = resolveFees(data);
  cache.set(companyId, fees);
  return fees;
}

// Call after a company saves its fee policy so the next read is fresh.
export function clearFeeCache(companyId) {
  if (companyId) cache.delete(companyId); else cache.clear();
}

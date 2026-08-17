import { supabase } from "./supabase.js";

// Day 78: ONE TRUTH for a company's fee policy.
// Founder: "broker to broker they charge according to the govt fees they pay AND have a company
// admin cost - some increase the value of the govt fees as part of their admin charges. Giving
// them the freedom to set their policies." The constants below are LAST-RESORT fallbacks only,
// used when nothing above them is set. They are NOT the policy.
//
// ⭐ Day 93: THE DEVELOPER TIER LANDED. This file has said since Day 78 that "a developer-level
// override tier is designed but its link column does not exist yet - when it lands, it slots
// between the two." It now does.
//
// READ CHAIN, highest wins:
//     frozen policy  ->  developer's master agreement  ->  company setting  ->  fallback constant
//
// WHY THE DEVELOPER TIER MATTERS MORE THAN IT LOOKS: an admin charge is the DEVELOPER'S, not the
// brokerage's, and the founder's ruling on Day 92 was "per unit, per developer - it may change
// regularly." A company-wide figure would be wrong for every developer but one.
//
// ⚠️ NULL MEANS FALL THROUGH; ZERO MEANS ZERO. A developer who genuinely charges no admin fee sets
// 0 and it is honoured. A developer whose fee is simply unknown leaves it null and the company's
// figure applies. Those are two different facts and the column must be able to say both - which is
// why admin_fee_per_unit's DEFAULT 0 was dropped on Day 93: it made every developer read as
// "charges nothing".
//
// ⚠️ AND THE FREEZE STILL WINS. A deal priced at reservation keeps that policy however often the
// developer changes his (Day-78 rule). The freeze matters MOST here, precisely because a
// developer-level figure moves more often than a company-level one.

export const FALLBACK = {
  spaFee: 5250,
  oqoodFee: 4020,
  reservationFee: 25000,
  dldPct: 4,
  adminFeePerUnit: 0,   // most developers charge none; a fallback of 0 is the honest default
  dldPayer: "buyer",
};

const num = (v, fb) => (v === null || v === undefined || v === "" ? fb : Number(v));
const str = (v, fb) => (v === null || v === undefined || v === "" ? fb : String(v));

// Pure: turn a companies row into the resolved company-level policy.
export function resolveFees(company) {
  return {
    spaFee:         num(company?.default_spa_fee,         FALLBACK.spaFee),
    oqoodFee:       num(company?.default_oqood_fee,       FALLBACK.oqoodFee),
    reservationFee: num(company?.default_reservation_fee, FALLBACK.reservationFee),
    dldPct:         num(company?.default_dld_pct,         FALLBACK.dldPct),
    adminFeePerUnit: FALLBACK.adminFeePerUnit,  // company-level admin fee is not a concept - it is the developer's
    dldPayer:       FALLBACK.dldPayer,
    isDefault: {
      spaFee:         company?.default_spa_fee == null,
      oqoodFee:       company?.default_oqood_fee == null,
      reservationFee: company?.default_reservation_fee == null,
      dldPct:         company?.default_dld_pct == null,
    },
  };
}

// Pure: lay a developer's master agreement over the company policy. Only fields the agreement
// actually states are overridden - null on the agreement means "not set here", not "zero".
export function applyDeveloperTier(companyFees, agreement) {
  if (!agreement) return { ...companyFees, source: { ...(companyFees.source || {}) } };
  const src = {};
  const out = { ...companyFees };
  const take = (key, col, fn = num) => {
    const v = agreement[col];
    if (v === null || v === undefined || v === "") return;
    out[key] = fn(v, out[key]);
    src[key] = "developer";
  };
  take("spaFee", "default_spa_fee");
  take("oqoodFee", "default_oqood_fee");
  take("reservationFee", "default_reservation_fee");
  take("dldPct", "default_dld_pct");
  take("adminFeePerUnit", "admin_fee_per_unit");
  take("dldPayer", "default_dld_payer", str);
  out.source = src;
  out.developerAgreementId = agreement.id || null;
  return out;
}

// Session cache - the policy changes rarely; do not round-trip per dialog open.
const cache = new Map();
const agreementCache = new Map();

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

// The active agreement for one developer. Draft agreements are NOT policy - they are a negotiation.
export async function getDeveloperAgreement(companyId, developerId) {
  if (!companyId || !developerId) return null;
  const key = companyId + "|" + developerId;
  if (agreementCache.has(key)) return agreementCache.get(key);
  const { data } = await supabase
    .from("pp_master_agreements")
    .select("id, default_spa_fee, default_oqood_fee, default_reservation_fee, default_dld_pct, admin_fee_per_unit, default_dld_payer")
    .eq("company_id", companyId)
    .eq("developer_id", developerId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  agreementCache.set(key, data || null);
  return data || null;
}

// The whole chain in one call: company policy with the developer's agreement laid over it.
// Callers that hold a frozen policy still apply it ON TOP - the freeze is not this function's job,
// because only the caller knows whether its deal has one.
export async function getFeesForDeveloper(companyId, developerId) {
  const companyFees = await getFees(companyId);
  if (!developerId) return { ...companyFees, source: {} };
  const agreement = await getDeveloperAgreement(companyId, developerId);
  return applyDeveloperTier(companyFees, agreement);
}

// A deal's developer, resolved the way the commission invoice already does it (GF-19): the master
// agreement if the deal names one, otherwise the unit's project. Kept here so every fee surface
// resolves it the same way instead of each inventing its own chain.
export async function developerIdForOpportunity(opp) {
  if (!opp) return null;
  if (opp.master_agreement_id) {
    const { data: ma } = await supabase
      .from("pp_master_agreements").select("developer_id").eq("id", opp.master_agreement_id).maybeSingle();
    if (ma?.developer_id) return ma.developer_id;
  }
  if (opp.unit_id) {
    const { data: u } = await supabase
      .from("project_units").select("project_id").eq("id", opp.unit_id).maybeSingle();
    if (u?.project_id) {
      const { data: pr } = await supabase
        .from("projects").select("pp_developer_id").eq("id", u.project_id).maybeSingle();
      return pr?.pp_developer_id || null;
    }
  }
  return null;
}

export function clearFeeCache() {
  cache.clear();
  agreementCache.clear();
}

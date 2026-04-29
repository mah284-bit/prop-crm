// api/_data/reference.js
// Shared reference data for PropCRM.
// Translated from Sprint 1 v2 TypeScript sources to plain JavaScript / ESM.
// Single source of truth — both /api/reference/countries and
// /api/reference/buyer-type-rules import from here.
//
// Source of countries: ISO 3166-1 alpha-2.
// Calling codes: ITU-T E.164 (without leading '+').
// Buyer-type rules: Master Spec §2.3.

// ============================================================================
// COUNTRIES
// ============================================================================
// GCC + frequently-encountered countries are flagged `priority: true` so the
// dropdown can show them at the top.

export const COUNTRIES = [
  // ----- GCC priority -----
  { iso2: "AE", name_en: "United Arab Emirates", name_ar: "الإمارات العربية المتحدة", calling_code: "971", flag_emoji: "🇦🇪", priority: true },
  { iso2: "SA", name_en: "Saudi Arabia",         name_ar: "المملكة العربية السعودية", calling_code: "966", flag_emoji: "🇸🇦", priority: true },
  { iso2: "QA", name_en: "Qatar",                name_ar: "قطر",     calling_code: "974", flag_emoji: "🇶🇦", priority: true },
  { iso2: "KW", name_en: "Kuwait",               name_ar: "الكويت",  calling_code: "965", flag_emoji: "🇰🇼", priority: true },
  { iso2: "BH", name_en: "Bahrain",              name_ar: "البحرين", calling_code: "973", flag_emoji: "🇧🇭", priority: true },
  { iso2: "OM", name_en: "Oman",                 name_ar: "عُمان",   calling_code: "968", flag_emoji: "🇴🇲", priority: true },

  // ----- Common buyer-source countries (MEA + South Asia + Europe) -----
  { iso2: "EG", name_en: "Egypt",                name_ar: "مصر",     calling_code: "20",  flag_emoji: "🇪🇬", priority: true },
  { iso2: "JO", name_en: "Jordan",               name_ar: "الأردن",  calling_code: "962", flag_emoji: "🇯🇴", priority: true },
  { iso2: "LB", name_en: "Lebanon",              name_ar: "لبنان",   calling_code: "961", flag_emoji: "🇱🇧", priority: true },
  { iso2: "IN", name_en: "India",                                     calling_code: "91",  flag_emoji: "🇮🇳", priority: true },
  { iso2: "PK", name_en: "Pakistan",                                  calling_code: "92",  flag_emoji: "🇵🇰", priority: true },
  { iso2: "GB", name_en: "United Kingdom",                            calling_code: "44",  flag_emoji: "🇬🇧", priority: true },
  { iso2: "DE", name_en: "Germany",                                   calling_code: "49",  flag_emoji: "🇩🇪", priority: true },
  { iso2: "FR", name_en: "France",                                    calling_code: "33",  flag_emoji: "🇫🇷", priority: true },
  { iso2: "US", name_en: "United States",                             calling_code: "1",   flag_emoji: "🇺🇸", priority: true },

  // ----- Rest of the world (alphabetical by ISO2) -----
  { iso2: "AF", name_en: "Afghanistan",                               calling_code: "93",  flag_emoji: "🇦🇫" },
  { iso2: "AR", name_en: "Argentina",                                 calling_code: "54",  flag_emoji: "🇦🇷" },
  { iso2: "AU", name_en: "Australia",                                 calling_code: "61",  flag_emoji: "🇦🇺" },
  { iso2: "AT", name_en: "Austria",                                   calling_code: "43",  flag_emoji: "🇦🇹" },
  { iso2: "BD", name_en: "Bangladesh",                                calling_code: "880", flag_emoji: "🇧🇩" },
  { iso2: "BE", name_en: "Belgium",                                   calling_code: "32",  flag_emoji: "🇧🇪" },
  { iso2: "BR", name_en: "Brazil",                                    calling_code: "55",  flag_emoji: "🇧🇷" },
  { iso2: "CA", name_en: "Canada",                                    calling_code: "1",   flag_emoji: "🇨🇦" },
  { iso2: "CN", name_en: "China",                                     calling_code: "86",  flag_emoji: "🇨🇳" },
  { iso2: "CY", name_en: "Cyprus",                                    calling_code: "357", flag_emoji: "🇨🇾" },
  { iso2: "CZ", name_en: "Czech Republic",                            calling_code: "420", flag_emoji: "🇨🇿" },
  { iso2: "DK", name_en: "Denmark",                                   calling_code: "45",  flag_emoji: "🇩🇰" },
  { iso2: "DZ", name_en: "Algeria",          name_ar: "الجزائر",      calling_code: "213", flag_emoji: "🇩🇿" },
  { iso2: "ES", name_en: "Spain",                                     calling_code: "34",  flag_emoji: "🇪🇸" },
  { iso2: "FI", name_en: "Finland",                                   calling_code: "358", flag_emoji: "🇫🇮" },
  { iso2: "GR", name_en: "Greece",                                    calling_code: "30",  flag_emoji: "🇬🇷" },
  { iso2: "HK", name_en: "Hong Kong",                                 calling_code: "852", flag_emoji: "🇭🇰" },
  { iso2: "ID", name_en: "Indonesia",                                 calling_code: "62",  flag_emoji: "🇮🇩" },
  { iso2: "IE", name_en: "Ireland",                                   calling_code: "353", flag_emoji: "🇮🇪" },
  { iso2: "IL", name_en: "Israel",                                    calling_code: "972", flag_emoji: "🇮🇱" },
  { iso2: "IQ", name_en: "Iraq",             name_ar: "العراق",        calling_code: "964", flag_emoji: "🇮🇶" },
  { iso2: "IR", name_en: "Iran",                                      calling_code: "98",  flag_emoji: "🇮🇷" },
  { iso2: "IT", name_en: "Italy",                                     calling_code: "39",  flag_emoji: "🇮🇹" },
  { iso2: "JP", name_en: "Japan",                                     calling_code: "81",  flag_emoji: "🇯🇵" },
  { iso2: "KE", name_en: "Kenya",                                     calling_code: "254", flag_emoji: "🇰🇪" },
  { iso2: "KR", name_en: "South Korea",                               calling_code: "82",  flag_emoji: "🇰🇷" },
  { iso2: "LK", name_en: "Sri Lanka",                                 calling_code: "94",  flag_emoji: "🇱🇰" },
  { iso2: "LU", name_en: "Luxembourg",                                calling_code: "352", flag_emoji: "🇱🇺" },
  { iso2: "LY", name_en: "Libya",            name_ar: "ليبيا",         calling_code: "218", flag_emoji: "🇱🇾" },
  { iso2: "MA", name_en: "Morocco",          name_ar: "المغرب",        calling_code: "212", flag_emoji: "🇲🇦" },
  { iso2: "MT", name_en: "Malta",                                     calling_code: "356", flag_emoji: "🇲🇹" },
  { iso2: "MY", name_en: "Malaysia",                                  calling_code: "60",  flag_emoji: "🇲🇾" },
  { iso2: "NG", name_en: "Nigeria",                                   calling_code: "234", flag_emoji: "🇳🇬" },
  { iso2: "NL", name_en: "Netherlands",                               calling_code: "31",  flag_emoji: "🇳🇱" },
  { iso2: "NO", name_en: "Norway",                                    calling_code: "47",  flag_emoji: "🇳🇴" },
  { iso2: "NP", name_en: "Nepal",                                     calling_code: "977", flag_emoji: "🇳🇵" },
  { iso2: "NZ", name_en: "New Zealand",                               calling_code: "64",  flag_emoji: "🇳🇿" },
  { iso2: "PH", name_en: "Philippines",                               calling_code: "63",  flag_emoji: "🇵🇭" },
  { iso2: "PL", name_en: "Poland",                                    calling_code: "48",  flag_emoji: "🇵🇱" },
  { iso2: "PS", name_en: "Palestine",        name_ar: "فلسطين",        calling_code: "970", flag_emoji: "🇵🇸" },
  { iso2: "PT", name_en: "Portugal",                                  calling_code: "351", flag_emoji: "🇵🇹" },
  { iso2: "RO", name_en: "Romania",                                   calling_code: "40",  flag_emoji: "🇷🇴" },
  { iso2: "RU", name_en: "Russia",                                    calling_code: "7",   flag_emoji: "🇷🇺" },
  { iso2: "SD", name_en: "Sudan",            name_ar: "السودان",       calling_code: "249", flag_emoji: "🇸🇩" },
  { iso2: "SE", name_en: "Sweden",                                    calling_code: "46",  flag_emoji: "🇸🇪" },
  { iso2: "SG", name_en: "Singapore",                                 calling_code: "65",  flag_emoji: "🇸🇬" },
  { iso2: "SY", name_en: "Syria",            name_ar: "سوريا",         calling_code: "963", flag_emoji: "🇸🇾" },
  { iso2: "TH", name_en: "Thailand",                                  calling_code: "66",  flag_emoji: "🇹🇭" },
  { iso2: "TN", name_en: "Tunisia",          name_ar: "تونس",          calling_code: "216", flag_emoji: "🇹🇳" },
  { iso2: "TR", name_en: "Turkey",                                    calling_code: "90",  flag_emoji: "🇹🇷" },
  { iso2: "UG", name_en: "Uganda",                                    calling_code: "256", flag_emoji: "🇺🇬" },
  { iso2: "UA", name_en: "Ukraine",                                   calling_code: "380", flag_emoji: "🇺🇦" },
  { iso2: "VN", name_en: "Vietnam",                                   calling_code: "84",  flag_emoji: "🇻🇳" },
  { iso2: "YE", name_en: "Yemen",            name_ar: "اليمن",         calling_code: "967", flag_emoji: "🇾🇪" },
  { iso2: "ZA", name_en: "South Africa",                              calling_code: "27",  flag_emoji: "🇿🇦" },
];

/** O(1) lookup by ISO2 code */
export const COUNTRIES_BY_ISO2 = Object.fromEntries(
  COUNTRIES.map((c) => [c.iso2, c])
);

/** GCC country codes — used for buyer-type classification logic */
export const GCC_COUNTRIES = ["AE", "SA", "QA", "KW", "BH", "OM"];

export function isGccCountry(iso2) {
  if (!iso2) return false;
  return GCC_COUNTRIES.includes(iso2.toUpperCase());
}

/** Sorted dropdown order: priority countries alphabetical, then the rest alphabetical */
export function getDropdownCountries() {
  const priority = COUNTRIES.filter((c) => c.priority).sort((a, b) =>
    a.name_en.localeCompare(b.name_en)
  );
  const rest = COUNTRIES.filter((c) => !c.priority).sort((a, b) =>
    a.name_en.localeCompare(b.name_en)
  );
  return [...priority, ...rest];
}

/** Calling code lookup for phone input */
export function getCallingCode(iso2) {
  if (!iso2) return undefined;
  return COUNTRIES_BY_ISO2[iso2.toUpperCase()]?.calling_code;
}

// ============================================================================
// BUYER-TYPE RULES — Master Spec §2.3
// ============================================================================
// Single source of truth for which fields are required, by buyer type.
// Same object drives:
//   - Dynamic UI (which fields show)
//   - API validation (which fields the server requires)
//
// Each value is one of: "required" | "optional" | "hidden"
// Identity-doc fields are presence-checked at later stage gates,
// but exposed here so the UI can show "you'll need..." hints early.

export const BUYER_TYPES = [
  "local_national",
  "gcc_resident_expat",
  "international_non_resident",
  "corporate",
];

export const BUYER_TYPE_RULES = {
  local_national: {
    display_name: "required",
    legal_name_en: "required",
    legal_name_ar: "required",
    nationality_country_code: "required",
    residence_country_code: "required",
    phone_e164: "required",
    email: "required",

    emirates_id: "required",
    national_id: "required",
    passport: "optional",
    residence_visa: "hidden",
    address_proof: "hidden",
  },

  gcc_resident_expat: {
    display_name: "required",
    legal_name_en: "required",
    legal_name_ar: "optional",
    nationality_country_code: "required",
    residence_country_code: "required",
    phone_e164: "required",
    email: "required",

    emirates_id: "required",
    national_id: "hidden",
    passport: "required",
    residence_visa: "required",
    address_proof: "hidden",
  },

  international_non_resident: {
    display_name: "required",
    legal_name_en: "required",
    legal_name_ar: "optional",
    nationality_country_code: "required",
    residence_country_code: "required",
    phone_e164: "required",
    email: "required",

    emirates_id: "hidden",
    national_id: "hidden",
    passport: "required",
    residence_visa: "hidden",
    address_proof: "required",
  },

  corporate: {
    display_name: "required",
    legal_name_en: "required",
    legal_name_ar: "optional",
    nationality_country_code: "required",
    residence_country_code: "required",
    phone_e164: "required",
    email: "required",

    emirates_id: "hidden",
    national_id: "hidden",
    passport: "hidden",
    residence_visa: "hidden",
    address_proof: "hidden",
  },
};

/**
 * Validate a contact payload against the buyer-type rules.
 * Returns array of {field, message} errors. Empty = valid.
 */
export function validateContactPayload(input) {
  const errors = [];

  // Display name is always required
  if (!input.display_name || String(input.display_name).trim().length === 0) {
    errors.push({ field: "display_name", message: "Display name is required" });
  }

  // Buyer type must be set
  if (!input.buyer_type) {
    errors.push({
      field: "buyer_type",
      message: "Buyer type must be classified before saving",
    });
    return errors;
  }

  const rules = BUYER_TYPE_RULES[input.buyer_type];
  if (!rules) {
    errors.push({
      field: "buyer_type",
      message: `Unknown buyer type: ${input.buyer_type}`,
    });
    return errors;
  }

  const docFields = ["emirates_id", "national_id", "passport", "residence_visa", "address_proof"];

  for (const [field, req] of Object.entries(rules)) {
    if (req !== "required") continue;
    if (docFields.includes(field)) continue; // identity docs validated separately

    const value = input[field];
    if (value === undefined || value === null ||
        (typeof value === "string" && value.trim().length === 0)) {
      errors.push({
        field,
        message: `${humanize(field)} is required for ${humanize(input.buyer_type)}`,
      });
    }
  }

  return errors;
}

/**
 * Returns the list of identity documents that WILL be required for this
 * buyer type. UI uses this to render "you will need..." hints.
 */
export function getRequiredIdentityDocuments(buyerType) {
  const rules = BUYER_TYPE_RULES[buyerType];
  if (!rules) return [];
  const docFields = ["emirates_id", "national_id", "passport", "residence_visa", "address_proof"];
  return docFields.filter((f) => rules[f] === "required").map(humanize);
}

function humanize(field) {
  return field
    .replace(/_country_code/g, "")
    .replace(/_e164/g, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

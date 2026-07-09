// Country-based lookup functions
export const getStages = (country) => {
  const stagesByCountry = {
    AE: ["New Lead","Contacted","Site Visit","Proposal Sent","Negotiation","Closed Won","Closed Lost"],
    US: ["Lead","Qualified","Discovery","Proposal","Negotiation","Closed Won","Closed Lost"],
    UK: ["Prospect","Engaged","Viewing","Offered","Negotiating","Completed","Lost"],
  };
  return stagesByCountry[country] || stagesByCountry.AE; // Default to AE
};

export const getCommissionRate = (country) => {
  const rates = {
    AE: 5,
    US: 3,
    UK: 4,
  };
  return rates[country] || 5; // Default to AE
};

export const getLeadRoutingRules = (country) => {
  const rules = {
    AE: { sources: ['direct', 'portal', 'agent_referral', 'broker_network'], threshold: 7, action: 'flag_for_admin' },
    US: { sources: ['mls', 'referral', 'cold_call', 'paid_ads'], threshold: 5, action: 'auto_reassign' },
    UK: { sources: ['rightmove', 'zoopla', 'agent_referral', 'portal'], threshold: 10, action: 'flag_for_admin' },
  };
  return rules[country] || rules.AE;
};

export const getValidationRules = (country) => {
  const rules = {
    AE: { emiratesId: true, phone: true, nationality: true, passport: false, visaStatus: true },
    US: { ssn: false, phone: true, state: true, drivers_license: false, zip: true },
    UK: { ni: false, phone: true, postcode: true, drivers_license: false, county: true },
  };
  return rules[country] || rules.AE;
};

export const getTaxRate = (country) => {
  const rates = {
    AE: 5,     // VAT
    US: 0,     // 0 (state varies)
    UK: 20,    // VAT
  };
  return rates[country] || 5;
};

export const getLocale = (country) => {
  const locales = {
    AE: { lang: 'ar', locale: 'ar-AE', dateFormat: 'DD/MM/YYYY', decimalSep: ',' },
    US: { lang: 'en', locale: 'en-US', dateFormat: 'MM/DD/YYYY', decimalSep: '.' },
    UK: { lang: 'en', locale: 'en-GB', dateFormat: 'DD/MM/YYYY', decimalSep: '.' },
  };
  return locales[country] || locales.AE;
};

export const getPaymentTerms = (country) => {
  const terms = {
    AE: { defaultDays: 30, earlyPaymentDiscount: 2, latePaymentFee: 1.5 },
    US: { defaultDays: 15, earlyPaymentDiscount: 3, latePaymentFee: 2 },
    UK: { defaultDays: 45, earlyPaymentDiscount: 1, latePaymentFee: 1 },
  };
  return terms[country] || terms.AE;
};

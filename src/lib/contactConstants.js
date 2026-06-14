// Phone formats and country code data for contact management
const PHONE_FORMATS = {
  "UAE":          { prefix:"+971", pattern:/^\+971[0-9]{8,9}$/, example:"+971 50 123 4567", clean:/[\s\-\(\)]/g },
  "Saudi Arabia": { prefix:"+966", pattern:/^\+966[0-9]{9}$/,   example:"+966 50 123 4567", clean:/[\s\-\(\)]/g },
  "India":        { prefix:"+91",  pattern:/^\+91[6-9][0-9]{9}$/,example:"+91 98765 43210",  clean:/[\s\-\(\)]/g },
  "UK":           { prefix:"+44",  pattern:/^\+44[0-9]{10}$/,    example:"+44 7700 900000",  clean:/[\s\-\(\)]/g },
  "Pakistan":     { prefix:"+92",  pattern:/^\+92[0-9]{10}$/,    example:"+92 300 1234567",  clean:/[\s\-\(\)]/g },
  "Egypt":        { prefix:"+20",  pattern:/^\+20[0-9]{10}$/,    example:"+20 10 1234 5678",  clean:/[\s\-\(\)]/g },
  "Jordan":       { prefix:"+962", pattern:/^\+962[0-9]{8,9}$/,  example:"+962 7 9012 3456",  clean:/[\s\-\(\)]/g },
};

const COUNTRY_CODES = [
  { code: "+971", country: "UAE" },
  { code: "+966", country: "Saudi Arabia" },
  { code: "+91",  country: "India" },
  { code: "+92",  country: "Pakistan" },
  { code: "+44",  country: "UK" },
  { code: "+1",   country: "USA/Canada" },
  { code: "+20",  country: "Egypt" },
  { code: "+961", country: "Lebanon" },
  { code: "+962", country: "Jordan" },
  { code: "+963", country: "Syria" },
  { code: "+964", country: "Iraq" },
  { code: "+965", country: "Kuwait" },
  { code: "+212", country: "Morocco" },
  { code: "+216", country: "Tunisia" },
  { code: "+213", country: "Algeria" },
  { code: "+967", country: "Yemen" },
  { code: "+249", country: "Sudan" },
  { code: "+27",  country: "South Africa" },
  { code: "+254", country: "Kenya" },
  { code: "+90",  country: "Turkey" },
  { code: "+98",  country: "Iran" },
  { code: "+7",   country: "Russia" },
  { code: "+380", country: "Ukraine" },
  { code: "+61",  country: "Australia" },
  { code: "+64",  country: "New Zealand" },
];

const NATIONALITIES = [
  "UAE","Saudi Arabia","Kuwait","Qatar","Bahrain","Oman",
  "India","Pakistan","Bangladesh","Sri Lanka","Nepal","Philippines",
  "Egypt","Lebanon","Jordan","Syria","Iraq","Palestine","Morocco","Tunisia","Algeria","Yemen","Sudan",
  "UK","USA","Canada","Australia","New Zealand","South Africa",
  "France","Germany","Italy","Spain","Netherlands","Belgium","Switzerland","Sweden","Norway","Denmark","Russia","Ukraine",
  "China","Japan","South Korea","Iran","Turkey","Indonesia","Malaysia","Thailand","Vietnam",
  "Nigeria","Kenya","Ethiopia","Ghana",
  "Other",
];

export { PHONE_FORMATS, COUNTRY_CODES, NATIONALITIES };

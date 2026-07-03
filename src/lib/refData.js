// Shared reference data (moved out of App.jsx so App.jsx exports only its component -> React Fast Refresh works).
export const COUNTRY_CODES = [
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
  { code: "+968", country: "Oman" },
  { code: "+973", country: "Bahrain" },
  { code: "+974", country: "Qatar" },
  { code: "+33",  country: "France" },
  { code: "+49",  country: "Germany" },
  { code: "+39",  country: "Italy" },
  { code: "+34",  country: "Spain" },
  { code: "+86",  country: "China" },
  { code: "+81",  country: "Japan" },
  { code: "+82",  country: "South Korea" },
  { code: "+63",  country: "Philippines" },
  { code: "+62",  country: "Indonesia" },
  { code: "+60",  country: "Malaysia" },
  { code: "+27",  country: "South Africa" },
  { code: "+234", country: "Nigeria" },
  { code: "+254", country: "Kenya" },
  { code: "+90",  country: "Turkey" },
  { code: "+98",  country: "Iran" },
  { code: "+7",   country: "Russia" },
  { code: "+380", country: "Ukraine" },
  { code: "+61",  country: "Australia" },
  { code: "+64",  country: "New Zealand" },
];
export const NATIONALITIES = [
  "UAE","Saudi Arabia","Kuwait","Qatar","Bahrain","Oman",  // GCC
  "India","Pakistan","Bangladesh","Sri Lanka","Nepal","Philippines",  // South & SE Asia
  "Egypt","Lebanon","Jordan","Syria","Iraq","Palestine","Morocco","Tunisia","Algeria","Yemen","Sudan",  // MENA
  "UK","USA","Canada","Australia","New Zealand","South Africa",  // Western
  "France","Germany","Italy","Spain","Netherlands","Belgium","Switzerland","Sweden","Norway","Denmark","Russia","Ukraine",  // Europe
  "China","Japan","South Korea","Iran","Turkey","Indonesia","Malaysia","Thailand","Vietnam",  // Asia
  "Nigeria","Kenya","Ethiopia","Ghana",  // Africa
  "Other",
];

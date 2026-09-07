// Day 102: extracted from App.jsx. LeasingModule calls all four and threw "validateEmail is not
// defined" on Add Tenant - the eleventh casualty of the split five months ago, and the first that
// was a plain FUNCTION rather than a component, which is why the earlier sweep missed it.

export const validateEmail = (email) => {
  if (!email) return null; // optional field — only validate if filled
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(email.trim())) return "Invalid email — use format: name@domain.com";
  const banned = ["@test.","@example.","@fake.","@dummy."];
  if (banned.some(b => email.includes(b))) return "Please use a real email address";
  return null;
};

export const validatePhone = (phone, nationality = "") => {
  if (!phone) return null; // optional field
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");

  // Must start with +
  if (!cleaned.startsWith("+")) {
    const fmt = PHONE_FORMATS[nationality];
    return `Phone must start with country code. ${fmt ? `For ${nationality}: ${fmt.example}` : "e.g. +971 50 123 4567"}`;
  }

  // Country-specific validation
  const fmt = PHONE_FORMATS[nationality];
  if (fmt) {
    if (!fmt.pattern.test(cleaned)) {
      return `Invalid ${nationality} number — should be: ${fmt.example}`;
    }
    return null;
  }

  // Generic: just check it has 7-15 digits after +
  const digits = cleaned.slice(1).replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return "Phone number must have 7-15 digits after the country code";
  }
  return null;
};

export const validateEmiratesID = (id) => {
  if (!id) return null;
  const cleaned = id.replace(/[\s\-]/g, "");
  if (!/^784[0-9]{13}$/.test(cleaned)) {
    return "Emirates ID must be 15 digits starting with 784 — e.g. 784-1990-1234567-1";
  }
  return null;
};

export const validatePassport = (passport) => {
  if (!passport) return null;
  if (!/^[A-Z0-9]{6,9}$/i.test(passport.trim())) {
    return "Passport number should be 6-9 alphanumeric characters";
  }
  return null;
};

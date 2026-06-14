// Validation helper functions — email, password strength
export const getStrength = pw => {
  if (!pw) return { score: 0, label: "", color: "#E2E8F0", pct: 0 };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 1) return { score: s, label: "Weak", color: "#B83232", pct: 20 };
  if (s <= 2) return { score: s, label: "Fair", color: "#A06810", pct: 45 };
  if (s <= 3) return { score: s, label: "Good", color: "#1A5FA8", pct: 70 };
  return { score: s, label: "Strong", color: "#1A7F5A", pct: 100 };
};

export const validateEmail = (email) => {
  if (!email) return null;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(email.trim())) return "Invalid email — use format: name@domain.com";
  const banned = ["@test.", "@example.", "@fake.", "@dummy."];
  if (banned.some(b => email.includes(b))) return "Please use a real email address";
  return null;
};

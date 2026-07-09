// Formatting utilities for display
export const getCurrencySymbol = (curr) => { const s = { AED: "AED", USD: "$", GBP: "£", EUR: "€" }; return s[curr] || "AED"; };
export const fmtM    = (n, curr="AE")  => n ? `${getCurrencySymbol(curr)} ${(n/1e6).toFixed(2)}M` : "—";
export const fmtAED  = (n, curr="AED")  => n ? `${getCurrencySymbol(curr)} ${Number(n).toLocaleString("en-AE")}` : "—";
export const fmtDate = d  => d ? new Date(d).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"}) : "—";
export const fmtDT   = d  => d ? new Date(d).toLocaleString("en-AE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";
export const ini     = n  => (n||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
export const uid     = () => Date.now()+Math.floor(Math.random()*9999);

// Formatting utilities
export const fmtM    = n  => n ? `AED ${(n/1e6).toFixed(2)}M` : "—";
export const fmtAED  = n  => n ? `AED ${Number(n).toLocaleString("en-AE")}` : "—";
export const fmtDate = d  => d ? new Date(d).toLocaleDateString("en-AE",{day:"numeric",month:"short",year:"numeric"}) : "—";
export const fmtDT   = d  => d ? new Date(d).toLocaleString("en-AE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : "—";
export const ini     = n  => (n||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
export const uid     = () => Date.now()+Math.floor(Math.random()*9999);

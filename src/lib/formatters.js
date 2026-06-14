// Currency and number formatting utilities
export const fmtM = n => n ? `AED ${(n/1e6).toFixed(2)}M` : "—";
export const fmtAED = n => n ? `AED ${Number(n).toLocaleString("en-AE")}` : "—";

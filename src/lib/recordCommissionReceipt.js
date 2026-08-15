import { supabase } from "./supabase.js";

// Day 92: A COMMISSION RECEIPT IS A ROW, AND THE INVOICE IS THE SUM OF ITS ROWS.
//
// pp_commission_invoices carried amount_received and last_payment_date - ONE FIGURE AND ONE DATE.
// An invoice paid in three tranches showed the total and the last date, and the first two payments
// existed nowhere. So "what came in on the 15th?" - the question an accountant asks against a bank
// statement - had no answer, and a wrong settlement could not be traced back.
//
// FOUNDER: "it has to reference, else wrong settlements may happen. Confusion is something we have
// to clearly avoid and only showcase reality."
//
// Same shape as pp_payments on the deal ledger, and for the same reason: ROWS ARE THE TRUTH, THE
// TOTAL IS DERIVED. amount_received is never typed into again - it is recomputed from the rows
// after every write, so the invoice and its receipts cannot disagree.
//
// BATCH_ID is what makes a bulk settlement legible: one developer transfer covering four invoices
// writes four rows sharing a batch, so "Aldar paid 500,000 on 15 Aug" and "which invoices did it
// clear?" are both answerable from the same rows.

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Recompute an invoice's received total and status from its receipt rows.
export async function syncInvoiceFromReceipts(invoiceId) {
  const { data: inv, error: iErr } = await supabase
    .from("pp_commission_invoices")
    .select("id, commission_net, invoice_status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (iErr || !inv) return { ok: false, error: iErr?.message || "invoice not found" };

  const { data: rows, error: rErr } = await supabase
    .from("pp_commission_receipts")
    .select("amount, received_date")
    .eq("invoice_id", invoiceId)
    .neq("status", "voided");
  if (rErr) return { ok: false, error: rErr.message };

  const received = r2((rows || []).reduce((t, r) => t + Number(r.amount || 0), 0));
  const net = Number(inv.commission_net || 0);
  const last = (rows || [])
    .map((r) => r.received_date)
    .filter(Boolean)
    .sort()
    .pop() || null;

  // A disputed or written-off invoice keeps its status - money arriving does not undo that ruling.
  let status = inv.invoice_status;
  if (!["disputed", "written_off"].includes(status)) {
    if (received <= 0.5) status = "issued";
    else if (received >= net - 0.5) status = "paid";
    else status = "partially_paid";
  }

  const { error: uErr } = await supabase
    .from("pp_commission_invoices")
    .update({ amount_received: received, last_payment_date: last, invoice_status: status })
    .eq("id", invoiceId);
  if (uErr) return { ok: false, error: uErr.message };

  return { ok: true, received, status };
}

// One receipt against one invoice. Pass a shared batchId when a single transfer covers several.
export async function recordCommissionReceipt({
  invoice, amount, receivedDate, reference, method, notes, batchId, currentUser,
}) {
  const amt = Number(amount) || 0;
  if (!(amt > 0)) return { ok: false, error: "Amount must be greater than zero" };
  if (!receivedDate) return { ok: false, error: "A received date is required" };
  if (!invoice?.id) return { ok: false, error: "No invoice" };

  const { error } = await supabase.from("pp_commission_receipts").insert({
    company_id: invoice.company_id || currentUser?.company_id,
    invoice_id: invoice.id,
    developer_id: invoice.developer_id || null,
    amount: r2(amt),
    received_date: receivedDate,
    reference: reference || null,
    method: method || null,
    notes: notes || null,
    batch_id: batchId || null,
    created_by: currentUser?.id || null,
  });
  if (error) return { ok: false, error: error.message };

  return await syncInvoiceFromReceipts(invoice.id);
}

// A receipt recorded in error stays as a row with a reason - the same discipline as a voided
// payment. Deleting it would leave the bank statement disagreeing with the record.
export async function voidCommissionReceipt({ receiptId, invoiceId, reason, currentUser }) {
  if (!reason || !reason.trim()) return { ok: false, error: "A reason is required" };
  const { error } = await supabase
    .from("pp_commission_receipts")
    .update({ status: "voided", notes: "VOIDED: " + reason.trim() })
    .eq("id", receiptId);
  if (error) return { ok: false, error: error.message };
  return await syncInvoiceFromReceipts(invoiceId);
}

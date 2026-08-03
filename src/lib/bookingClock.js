import { supabase } from "./supabase.js";

// Day 83: THE BOOKING CLOCK — the Booked hold is a TIMED promise.
//
// A confirmed block claims its units. Without a clock, that claim is free and indefinite: a broker
// can freeze a floor of a tower on nothing but intent. The clock buys the hold with a deadline.
//
// WHOSE ACT IS IT? Founder's governing principle (Day 82): THE BROKER RECORDS HIS ACTIONS; THE
// DEVELOPER'S ACTIONS ARE RECORDED. The hold expiring is the DEVELOPER'S rule taking effect — he
// said "pay within N days or the units go back" — so the app is RECORDING his rule, not deciding
// anything. That is why the release is automatic, and why it does not contradict the standing
// "nothing auto-cancels, humans decide" ruling: THE DEAL SURVIVES. Only the inventory hold ends.
// The buyer can still pay; he simply no longer has those units held for him.
//
// WHY IT MATTERS BEYOND ENFORCEMENT (founder, Day 82): the original doctrine framed the clock as a
// way to kill the freeze-the-book abuse. It is worth more as EVIDENCE — how flexible or stringent
// each developer is, how fast he responds, and WHY a deal moved or died. A broker can then answer
// his manager from the record, and walk into a developer with his own history. So the release
// always carries a REASON: otherwise every lapse reads as the broker's fault, when often the
// approval took six days and the buyer was ready.

const DAY_MS = 86400000;

// Weekend-aware: the doctrine asks for a hold the world can rely on, and a deadline that lands on
// a Friday or Saturday is not one a Gulf buyer can act on. Skip forward to the next working day.
// (UAE weekend is Sat-Sun since 2022; Friday afternoon is a half day but still a working day.)
function addWorkingDays(from, days) {
  const d = new Date(from.getTime());
  let left = Math.max(0, Number(days) || 0);
  while (left > 0) {
    d.setTime(d.getTime() + DAY_MS);
    const wd = d.getDay(); // 0 Sun ... 6 Sat
    if (wd !== 6 && wd !== 0) left--;
  }
  // If it still lands on a weekend (days = 0 edge), roll forward.
  while (d.getDay() === 6 || d.getDay() === 0) d.setTime(d.getTime() + DAY_MS);
  // Day 83: LAND ON END OF DAY, DUBAI TIME. Without this the deadline inherits the HOUR of the
  // confirm - a block confirmed at 6am expired at 6am, and a broker reading "held until 10 Aug"
  // could lose the units mid-morning while he was still arranging the cheque. "Until the 10th"
  // must mean the END of the 10th. 19:59:59 UTC is 23:59:59 GST (UTC+4, no daylight saving).
  d.setUTCHours(19, 59, 59, 0);
  return d;
}

// Stamp the deadline as a FACT at confirm time, rather than recomputing it later from the confirm
// date. A stored deadline cannot drift when a setting changes, and the buyer was told a date.
export async function startBookingClock({ block, currentUser }) {
  if (!block?.id) return { ok: false, error: "no block" };
  try {
    let days = Number(block.hold_days) || 0;
    if (!days) {
      const { data: co } = await supabase
        .from("companies")
        .select("block_hold_days")
        .eq("id", block.company_id || currentUser?.company_id)
        .maybeSingle();
      days = Number(co?.block_hold_days) || 5;
    }
    const expires = addWorkingDays(new Date(), days);
    const { error } = await supabase
      .from("block_deals")
      .update({ hold_expires_at: expires.toISOString(), hold_days: days })
      .eq("id", block.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, expires_at: expires.toISOString(), days };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

// Read the clock for display. Returns null when there is nothing to say — no clock, already
// released, or the reservation is settled so the hold has been earned rather than lent.
export function readBookingClock(block, collectionSettled) {
  if (!block?.hold_expires_at) return null;
  if (block.hold_released_at) {
    return {
      state: "released",
      released_at: block.hold_released_at,
      reason: block.hold_release_reason || null,
    };
  }
  if (collectionSettled) return null;
  if (["cancelled", "completed"].includes(block.status)) return null;

  const exp = new Date(block.hold_expires_at);
  const now = new Date();
  const hours = Math.round((exp - now) / 3600000);
  const days = Math.ceil(hours / 24);
  return {
    state: hours <= 0 ? "lapsed" : hours <= 24 ? "urgent" : "running",
    expires_at: block.hold_expires_at,
    hours,
    days,
    nice: exp.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
  };
}

// The release. Units return to Available; the DEAL is untouched. A reason is always recorded -
// either the honest default (the window ran out) or whatever the human supplies when releasing
// early by hand.
export async function releaseBookingHold({ block, reason, currentUser }) {
  if (!block?.id) return { ok: false, error: "no block" };
  try {
    const { data: lines } = await supabase
      .from("block_deal_units")
      .select("id, unit_id, status, child_opportunity_id")
      .eq("block_deal_id", block.id);

    let freed = 0;
    for (const l of (lines || [])) {
      if (l.status === "dropped") continue;
      if (!l.unit_id) continue;
      // Never take a unit off a deal that has EARNED it. Reserved and beyond is paid-for ground.
      if (l.child_opportunity_id) {
        const { data: child } = await supabase
          .from("opportunities")
          .select("stage")
          .eq("id", l.child_opportunity_id)
          .maybeSingle();
        if (child && !["Offer Accepted"].includes(child.stage)) continue;
      }
      const { data: u } = await supabase
        .from("project_units")
        .select("status")
        .eq("id", l.unit_id)
        .maybeSingle();
      if (u && u.status === "Booked") {
        await supabase.from("project_units").update({ status: "Available" }).eq("id", l.unit_id);
        freed++;
      }
    }

    const why = String(reason || "").trim() || "Hold window expired before the reservation was collected";
    await supabase
      .from("block_deals")
      .update({ hold_released_at: new Date().toISOString(), hold_release_reason: why })
      .eq("id", block.id);

    await supabase.from("activities").insert({
      company_id: block.company_id || currentUser?.company_id || null,
      block_deal_id: block.id,
      type: "note",
      activity_subtype: "block_terms",
      note: "BOOKING HOLD RELEASED - " + freed + " unit(s) returned to Available. " + why
        + " The deals themselves are untouched; the buyer can still pay, but these units are no longer held.",
      user_id: currentUser?.id || null,
      user_name: currentUser?.full_name || currentUser?.email || "system",
    });

    return { ok: true, freed, reason: why };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

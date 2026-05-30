// Phase 2.2B — Contacts Subsystem
// Fetches all persons (buyer, spouse, representative, etc.) attached to a
// lead, along with each person's contact channels (phone, email, etc.).
//
// Returns persons sorted: primary buyer first, then others by created_at.
// Each person object includes a nested `contacts` array.
//
// Usage:
//   const { persons, loading, error, refetch } = useLeadPersons(leadId);
//
// To force re-fetch after saving changes:
//   await refetch();

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

export function useLeadPersons(leadId) {
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!leadId) {
      setPersons([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // 1) Fetch persons for this lead
      const { data: personRows, error: personErr } = await supabase
        .from("lead_persons")
        .select("*")
        .eq("lead_id", leadId)
        .order("is_primary_buyer", { ascending: false }) // primary buyer first
        .order("created_at", { ascending: true });
      if (personErr) throw personErr;

      const personIds = (personRows || []).map((p) => p.id);
      if (personIds.length === 0) {
        setPersons([]);
        return;
      }

      // 2) Fetch all contacts for these persons in one query
      const { data: contactRows, error: contactErr } = await supabase
        .from("lead_person_contacts")
        .select("*")
        .in("person_id", personIds)
        .order("is_primary_for_channel", { ascending: false })
        .order("created_at", { ascending: true });
      if (contactErr) throw contactErr;

      // 3) Group contacts by person_id and attach
      const contactsByPerson = {};
      (contactRows || []).forEach((c) => {
        if (!contactsByPerson[c.person_id]) contactsByPerson[c.person_id] = [];
        contactsByPerson[c.person_id].push(c);
      });

      const merged = personRows.map((p) => ({
        ...p,
        contacts: contactsByPerson[p.id] || [],
      }));

      setPersons(merged);
    } catch (e) {
      setError(e.message || "Failed to load persons");
      setPersons([]);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  return { persons, loading, error, refetch: load };
}

// Helper: extract primary contact value for a person by channel
// e.g. getPrimaryContact(person, 'phone') → "+919876543210" or null
export function getPrimaryContact(person, channel) {
  if (!person?.contacts) return null;
  const primary = person.contacts.find(
    (c) => c.channel === channel && c.is_primary_for_channel
  );
  return primary?.value || null;
}

// Helper: get a human-readable role label
export const ROLE_LABELS = {
  buyer: "Buyer",
  spouse: "Spouse",
  representative: "Representative",
  secretary: "Secretary / EA",
  accounts: "Accounts / Finance",
  manager: "Manager / In-charge",
  local_contact: "Local Contact",
  family: "Family",
  other: "Other",
};

// Helper: channel display
export const CHANNEL_LABELS = {
  phone: "Phone",
  email: "Email",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
};

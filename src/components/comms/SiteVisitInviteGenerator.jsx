import React, { useState } from "react";
import Btn from "../Btn.jsx";
import Modal from "../form/Modal.jsx";
import FF from "../form/FF.jsx";
import { fmtDate } from "../../lib/format.js";

export default function SiteVisitInviteGenerator({ activity, opportunity, unit, currentUser, onGenerated }) {
  const [showModal, setShowModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(opportunity?.buyer_email || "");
  const [recipientPhone, setRecipientPhone] = useState(opportunity?.buyer_phone || "");
  const [needsPickup, setNeedsPickup] = useState(false);
  const [pickupLocation, setPickupLocation] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    if (!recipientEmail && !recipientPhone) {
      setError("Enter email or phone");
      return;
    }

    setGenerating(true);
    try {
      const inviteData = {
        visitDate: activity?.scheduled_at,
        visitTime: activity?.scheduled_at,
        unitRef: unit?.reference,
        unitName: unit?.name,
        locationLat: unit?.location_lat,
        locationLng: unit?.location_lng,
        googleMapsUrl: unit?.maps_url,
        brokerName: currentUser?.full_name,
        brokerPhone: currentUser?.phone,
        recipientEmail,
        recipientPhone,
        needsPickup,
        pickupLocation,
        timestamp: new Date()
      };

      // TODO: Generate .ics calendar file
      // TODO: Send via email + WhatsApp

      console.log("Generated site visit invite:", inviteData);

      // Simulate generation
      await new Promise(r => setTimeout(r, 800));

      onGenerated?.(inviteData);
      setShowModal(false);
    } catch (err) {
      setError("Failed: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Btn
        onClick={() => setShowModal(true)}
        variant="gold"
        small
      >
        📍 Generate Site Visit Invite
      </Btn>

      {showModal && (
        <Modal title="Site Visit Invitation" onClose={() => setShowModal(false)} width={500}>
          <div style={{marginBottom: 16, fontSize: 12, color: "#64748B"}}>
            <div><strong>Visit Date:</strong> {fmtDate(activity?.scheduled_at)}</div>
            <div><strong>Unit:</strong> {unit?.name || "Unknown"}</div>
            <div><strong>Location:</strong> {unit?.maps_url ? <a href={unit.maps_url} target="_blank" rel="noopener noreferrer">View on Maps</a> : "No location data"}</div>
          </div>

          <FF label="Buyer Email" required={!recipientPhone}>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="buyer@example.com"
              style={{width: "100%", padding: "8px 12px", border: "1px solid #D1D9E6", borderRadius: 6, fontSize: 13}}
            />
          </FF>

          <FF label="Buyer WhatsApp" required={!recipientEmail}>
            <input
              type="tel"
              value={recipientPhone}
              onChange={(e) => setRecipientPhone(e.target.value)}
              placeholder="+971501234567"
              style={{width: "100%", padding: "8px 12px", border: "1px solid #D1D9E6", borderRadius: 6, fontSize: 13}}
            />
          </FF>

          <FF label="Offer pickup/drop service?">
            <label style={{display: "flex", alignItems: "center", gap: 8, cursor: "pointer"}}>
              <input
                type="checkbox"
                checked={needsPickup}
                onChange={(e) => setNeedsPickup(e.target.checked)}
              />
              <span style={{fontSize: 13}}>Yes, include pick-and-drop option</span>
            </label>
          </FF>

          {needsPickup && (
            <FF label="Pickup location suggestion">
              <input
                type="text"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                placeholder="e.g., Burj Khalifa, Downtown Dubai"
                style={{width: "100%", padding: "8px 12px", border: "1px solid #D1D9E6", borderRadius: 6, fontSize: 13}}
              />
            </FF>
          )}

          {error && (
            <div style={{
              background: "#FAEAEA",
              color: "#B83232",
              padding: 10,
              borderRadius: 6,
              marginBottom: 16,
              fontSize: 12
            }}>
              {error}
            </div>
          )}

          <div style={{display: "flex", gap: 12}}>
            <Btn
              onClick={handleGenerate}
              variant="gold"
              disabled={generating}
              full
            >
              {generating ? "Generating..." : "Generate & Send"}
            </Btn>
            <Btn
              onClick={() => setShowModal(false)}
              variant="outline"
              full
            >
              Cancel
            </Btn>
          </div>
        </Modal>
      )}
    </>
  );
}

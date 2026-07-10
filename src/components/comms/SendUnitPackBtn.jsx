import React, { useState } from "react";
import Btn from "../Btn.jsx";
import Modal from "../form/Modal.jsx";
import FF from "../form/FF.jsx";

export default function SendUnitPackBtn({ unit, opportunity, currentUser, onSent }) {
  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState(opportunity?.buyer_email || "");
  const [whatsapp, setWhatsapp] = useState(opportunity?.buyer_phone || "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!email && !whatsapp) {
      setError("Enter at least email or WhatsApp");
      return;
    }

    setSending(true);
    try {
      // TODO: Call bundle composer + send service
      // For now, log to console
      console.log("Sending unit pack:", {
        unitId: unit?.id,
        oppId: opportunity?.id,
        email,
        whatsapp,
        message,
        timestamp: new Date()
      });

      // Simulate sending
      await new Promise(r => setTimeout(r, 1000));

      // Log to document_sends table
      // TODO: Create API endpoint to log

      onSent?.();
      setShowModal(false);
      setEmail("");
      setWhatsapp("");
      setMessage("");
    } catch (err) {
      setError("Failed to send: " + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Btn 
        onClick={() => setShowModal(true)} 
        variant="gold"
        small
      >
        📤 Send Unit Pack
      </Btn>

      {showModal && (
        <Modal title="Send Unit Pack" onClose={() => setShowModal(false)} width={450}>
          <div style={{marginBottom: 16}}>
            <div style={{fontSize: 12, color: "#64748B", marginBottom: 12}}>
              <strong>Unit:</strong> {unit?.name || "Unknown"}
            </div>
          </div>

          <FF label="Buyer Email" required={!whatsapp}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="buyer@example.com"
              style={{width: "100%", padding: "8px 12px", border: "1px solid #D1D9E6", borderRadius: 6, fontSize: 13}}
            />
          </FF>

          <FF label="WhatsApp Number" required={!email}>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+971501234567"
              style={{width: "100%", padding: "8px 12px", border: "1px solid #D1D9E6", borderRadius: 6, fontSize: 13}}
            />
          </FF>

          <FF label="Message (optional)">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal note..."
              style={{width: "100%", padding: "8px 12px", border: "1px solid #D1D9E6", borderRadius: 6, fontSize: 13, minHeight: 80, fontFamily: "monospace"}}
            />
          </FF>

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
              onClick={handleSend} 
              variant="gold" 
              disabled={sending} 
              full
            >
              {sending ? "Sending..." : "Send"}
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

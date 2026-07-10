import React, { useState } from "react";
import { renderTemplate } from "../../lib/comms/TemplateEngine.js";
import Btn from "../Btn.jsx";
import Modal from "../form/Modal.jsx";
import FF from "../form/FF.jsx";

export default function SendTemplateBtn({ template, opportunity, currentUser, onSent }) {
  const [showModal, setShowModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(opportunity?.buyer_email || "");
  const [recipientPhone, setRecipientPhone] = useState(opportunity?.buyer_phone || "");
  const [sendChannel, setSendChannel] = useState("email");
  const [customData, setCustomData] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (sendChannel === "email" && !recipientEmail) {
      setError("Enter recipient email");
      return;
    }
    if (sendChannel === "whatsapp" && !recipientPhone) {
      setError("Enter recipient phone");
      return;
    }

    setSending(true);
    try {
      // Prepare data for template rendering
      const data = {
        first_name: opportunity?.lead_name?.split(" ")?.[0] || "Buyer",
        email: recipientEmail,
        phone: recipientPhone,
        project_name: opportunity?.project_name || "",
        unit_name: opportunity?.unit_name || "",
        asking_price: opportunity?.asking_price || "",
        broker_name: currentUser?.full_name || "Broker",
        company_name: currentUser?.company?.name || "PropCRM",
        ...customData
      };

      // Render subject and body
      const renderedSubject = renderTemplate(template?.subject, data);
      const renderedBody = renderTemplate(template?.body, data);

      // TODO: Send via email/WhatsApp service
      // TODO: Log to comms_log table

      console.log("Sending template:", {
        templateId: template?.id,
        channel: sendChannel,
        recipient: sendChannel === "email" ? recipientEmail : recipientPhone,
        subject: renderedSubject,
        body: renderedBody,
        timestamp: new Date()
      });

      // Simulate send
      await new Promise(r => setTimeout(r, 1200));

      onSent?.(template);
      setShowModal(false);
      setRecipientEmail("");
      setRecipientPhone("");
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
        ✉️ Send Template
      </Btn>

      {showModal && (
        <Modal title={`Send: ${template?.template_name}`} onClose={() => setShowModal(false)} width={500}>
          <div style={{marginBottom: 16, fontSize: 12, color: "#64748B"}}>
            <div><strong>Type:</strong> {template?.template_type}</div>
            <div><strong>Buyer Intent:</strong> {template?.buyer_intent || "All"}</div>
          </div>

          <FF label="Send Via" required>
            <select
              value={sendChannel}
              onChange={(e) => setSendChannel(e.target.value)}
              style={{width: "100%", padding: "8px 12px", border: "1px solid #D1D9E6", borderRadius: 6}}
            >
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="both">Both (Email + WhatsApp)</option>
            </select>
          </FF>

          {(sendChannel === "email" || sendChannel === "both") && (
            <FF label="Recipient Email" required={sendChannel === "email" || sendChannel === "both"}>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="buyer@example.com"
                style={{width: "100%", padding: "8px 12px", border: "1px solid #D1D9E6", borderRadius: 6, fontSize: 13}}
              />
            </FF>
          )}

          {(sendChannel === "whatsapp" || sendChannel === "both") && (
            <FF label="Recipient WhatsApp" required={sendChannel === "whatsapp" || sendChannel === "both"}>
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="+971501234567"
                style={{width: "100%", padding: "8px 12px", border: "1px solid #D1D9E6", borderRadius: 6, fontSize: 13}}
              />
            </FF>
          )}

          <div style={{
            background: "#F7F9FC",
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
            fontSize: 11,
            maxHeight: 150,
            overflow: "auto"
          }}>
            <div style={{fontWeight: 600, marginBottom: 8}}>Preview</div>
            <div style={{color: "#666"}}>
              <strong>Subject:</strong> {template?.subject || "---"}
            </div>
            <div style={{marginTop: 8, color: "#666"}}>
              <strong>Body:</strong> {template?.body || "---"}
            </div>
          </div>

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

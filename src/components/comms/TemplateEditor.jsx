import React, { useState } from "react";
import { renderTemplate, extractVariables, TEMPLATE_VARIABLES } from "../../lib/comms/TemplateEngine.js";
import Btn from "../Btn.jsx";
import FF from "../form/FF.jsx";

export default function TemplateEditor({ template, onSave, onCancel, companyId }) {
  const [name, setName] = useState(template?.template_name || "");
  const [type, setType] = useState(template?.template_type || "transactional");
  const [buyerIntent, setBuyerIntent] = useState(template?.buyer_intent || "");
  const [subject, setSubject] = useState(template?.subject || "");
  const [body, setBody] = useState(template?.body || "");
  const [preview, setPreview] = useState(false);
  const [sampleData, setSampleData] = useState({
    first_name: "Ahmed",
    last_name: "Al Mansouri",
    email: "ahmed@example.com",
    phone: "+971501234567",
    project_name: "Downtown Heights",
    unit_name: "3BR Apartment",
    asking_price: "850,000 AED",
    broker_name: "John Broker",
    company_name: "PropCRM",
    buyer_name: "Mr. Al Mansouri"
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const extractedVars = extractVariables(body);

  const handleAddVariable = (varName) => {
    setBody(body + ` {{${varName}}}`);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Template name required");
      return;
    }
    if (!subject.trim()) {
      setError("Subject required");
      return;
    }
    if (!body.trim()) {
      setError("Body required");
      return;
    }

    setSaving(true);
    try {
      const data = {
        template_name: name,
        template_type: type,
        buyer_intent: buyerIntent || null,
        subject,
        body,
        variables: extractedVars,
        company_id: companyId
      };
      onSave?.(data);
    } catch (err) {
      setError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, padding: 20}}>
      {/* LEFT: Editor */}
      <div>
        <div style={{fontSize: 14, fontWeight: 700, marginBottom: 16}}>Template Editor</div>

        <FF label="Template Name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Investor Welcome"
            style={{width: "100%", padding: "8px 12px", border: "1px solid #D1D9E6", borderRadius: 6}}
          />
        </FF>

        <FF label="Type" required>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{width: "100%", padding: "8px 12px", border: "1px solid #D1D9E6", borderRadius: 6}}
          >
            <option value="transactional">Transactional</option>
            <option value="marketing">Marketing</option>
          </select>
        </FF>

        <FF label="Buyer Intent">
          <select
            value={buyerIntent}
            onChange={(e) => setBuyerIntent(e.target.value)}
            style={{width: "100%", padding: "8px 12px", border: "1px solid #D1D9E6", borderRadius: 6}}
          >
            <option value="">All Buyers</option>
            <option value="investor">Investor</option>
            <option value="owner_occupier">Owner-Occupier</option>
            <option value="hybrid">Hybrid</option>
            <option value="corporate">Corporate</option>
            <option value="reseller">Reseller</option>
          </select>
        </FF>

        <FF label="Subject Line" required>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g., New Investment Opportunity for {{first_name}}"
            style={{width: "100%", padding: "8px 12px", border: "1px solid #D1D9E6", borderRadius: 6}}
          />
        </FF>

        <FF label="Email Body" required>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Use {{variable}} syntax for substitution..."
            style={{width: "100%", padding: "12px", border: "1px solid #D1D9E6", borderRadius: 6, minHeight: 200, fontFamily: "monospace", fontSize: 12}}
          />
        </FF>

        {error && <div style={{color: "#B83232", fontSize: 12, marginBottom: 12}}>{error}</div>}

        <div style={{display: "flex", gap: 12}}>
          <Btn onClick={handleSave} variant="gold" disabled={saving} full>
            {saving ? "Saving..." : "Save Template"}
          </Btn>
          <Btn onClick={onCancel} variant="outline" full>
            Cancel
          </Btn>
        </div>
      </div>

      {/* RIGHT: Variables + Preview */}
      <div>
        <div style={{fontSize: 14, fontWeight: 700, marginBottom: 16}}>Variables & Preview</div>

        {/* Variables Panel */}
        <div style={{background: "#F7F9FC", padding: 12, borderRadius: 6, marginBottom: 16}}>
          <div style={{fontSize: 12, fontWeight: 600, marginBottom: 10}}>Available Variables</div>
          <div style={{display: "flex", flexWrap: "wrap", gap: 6}}>
            {Object.entries(TEMPLATE_VARIABLES).map(([category, vars]) => (
              <div key={category}>
                {vars.map(varName => (
                  <button
                    key={varName}
                    onClick={() => handleAddVariable(varName)}
                    style={{
                      fontSize: 11,
                      padding: "4px 8px",
                      margin: "2px",
                      background: "#0F2540",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer"
                    }}
                  >
                    {varName}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div style={{background: "#fff", border: "1px solid #D1D9E6", borderRadius: 6, padding: 12}}>
          <div style={{fontSize: 12, fontWeight: 600, marginBottom: 10}}>Live Preview</div>
          <div style={{fontSize: 11, color: "#666", marginBottom: 8}}>
            <strong>Subject:</strong>
          </div>
          <div style={{fontSize: 12, background: "#f9f9f9", padding: 8, marginBottom: 12, borderRadius: 4, wordBreak: "break-word"}}>
            {renderTemplate(subject, sampleData)}
          </div>
          <div style={{fontSize: 11, color: "#666", marginBottom: 8}}>
            <strong>Body:</strong>
          </div>
          <div style={{fontSize: 11, background: "#f9f9f9", padding: 12, borderRadius: 4, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 300, overflow: "auto"}}>
            {renderTemplate(body, sampleData)}
          </div>
        </div>
      </div>
    </div>
  );
}

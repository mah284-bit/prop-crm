import React from "react";
import AppConfigSection from "../settings/AppConfigSection.jsx";

export default function CompanyConfigPage({
  appConfig,
  onConfigChange = () => {},
  showToast,
}) {
  return (
    <div className="fade-in" style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px 0" }}>Company Configuration</h1>
        <p style={{ color: "#64748B", fontSize: 14, margin: 0 }}>Manage company-wide settings (country, currency, mode)</p>
      </div>
      <AppConfigSection 
        appConfig={appConfig} 
        onConfigChange={onConfigChange}
        showToast={showToast}
      />
    </div>
  );
}

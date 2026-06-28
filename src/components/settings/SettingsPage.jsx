import React, { useState } from "react";
import AgentPoolsSection from "./AgentPoolsSection.jsx";
import LeadRoutingRulesSection from "./LeadRoutingRulesSection.jsx";
import GroupBranchesSection from "./GroupBranchesSection.jsx";
import CommissionSettingsSection from "./CommissionSettingsSection.jsx";
import AgentBracketsSection from "./AgentBracketsSection.jsx";

/* ═══════════════════════════════════════════════════════════════
   SettingsPage — Phase 2.1 Day 21
   Top-level Settings module with left sidebar nav + right content panel.
   Visible to: super_admin, admin, sales_manager (Tenant Super Admin scope).
   
   Current sections:
     - Agent Pools (Day 21 AM) — round-robin lead distribution
     - Lead Routing Rules (Day 21 PM) — Lead Admin designation, pool sources, stale threshold
   
   Future sections (post-demo): branding, AI quotas, integrations, billing
═══════════════════════════════════════════════════════════════ */

const SECTIONS = [
  { id: "group_branches", label: "Group & Branches", icon: "🏛️", description: "Your organisation structure — group and its branches" },
  { id: "agent_pools", label: "Agent Pools", icon: "👥", description: "Group agents for round-robin lead distribution" },
  { id: "lead_routing", label: "Lead Routing Rules", icon: "🎯", description: "Configure how pool-sourced leads flow" },
  { id: "commission", label: "Commission Defaults", icon: "💼", description: "Company-level default commission rate" },
  { id: "agent_brackets", label: "Agentwise Commission Breakup", icon: "📊", description: "Per-agent commission rate that overrides the company standard" },
];

export default function SettingsPage({ 
  currentUser, 
  users = [],
  showToast,
}) {
  const [activeSection, setActiveSection] = useState("agent_pools");

  return (
    <div className="fade-in" style={{ display: "flex", height: "100%", gap: 24 }}>
      {/* ── LEFT SIDEBAR ─────────────────────────────────────────── */}
      <div style={{
        width: 260,
        flexShrink: 0,
        background: "#fff",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 2px 8px rgba(15,37,64,0.06)",
        height: "fit-content",
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#6B7785",
          letterSpacing: "0.6px",
          textTransform: "uppercase",
          marginBottom: 14,
        }}>
          Settings
        </div>
        {SECTIONS.map(section => {
          const isActive = activeSection === section.id;
          const isDisabled = section.disabled;
          return (
            <button
              key={section.id}
              onClick={() => !isDisabled && setActiveSection(section.id)}
              disabled={isDisabled}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "12px 14px",
                marginBottom: 6,
                borderRadius: 10,
                border: "none",
                background: isActive ? "rgba(201, 168, 76, 0.12)" : "transparent",
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.5 : 1,
                textAlign: "left",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => { if (!isActive && !isDisabled) e.currentTarget.style.background = "#F5F7FA"; }}
              onMouseLeave={e => { if (!isActive && !isDisabled) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{section.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? "#0F2540" : "#0F2540",
                  marginBottom: 2,
                }}>
                  {section.label}
                  {isDisabled && (
                    <span style={{
                      marginLeft: 8,
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#9CA3AF",
                      background: "#F3F4F6",
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}>
                      Soon
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: 11,
                  color: "#6B7785",
                  lineHeight: 1.4,
                }}>
                  {section.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── RIGHT CONTENT PANEL ──────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {activeSection === "group_branches" && (
          <GroupBranchesSection
            currentUser={currentUser}
            showToast={showToast}
          />
        )}
        {activeSection === "agent_pools" && (
          <AgentPoolsSection
            currentUser={currentUser}
            users={users}
            showToast={showToast}
          />
        )}
        {activeSection === "lead_routing" && (
          <LeadRoutingRulesSection
            currentUser={currentUser}
            users={users}
            showToast={showToast}
          />
        )}
        {activeSection === "commission" && (
          <CommissionSettingsSection
            currentUser={currentUser}
            showToast={showToast}
          />
        )}
        {activeSection === "agent_brackets" && (
          <AgentBracketsSection
            currentUser={currentUser}
            users={users}
            showToast={showToast}
          />
        )}
      </div>
    </div>
  );
}

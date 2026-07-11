import React, { useMemo } from "react";

/**
 * Role-Aware Dashboard Rendering
 * Agent: Personal pipeline + activity
 * Manager: Team pipeline + performance
 * Super Admin: Company overview + market trends
 */
export function renderDashboardForRole(role, data) {
  const { leads, opps, activities, users, currentUser } = data;
  
  if (role === "sales_agent" || role === "agent") {
    return renderAgentDashboard(data);
  } else if (role === "sales_manager" || role === "manager" || role === "group_gm" || role === "admin") {
    return renderManagerDashboard(data);
  } else if (role === "super_admin") {
    return renderSuperAdminDashboard(data);
  } else {
    return renderViewerDashboard(data);
  }
}

function renderAgentDashboard({ leads, opps, activities, currentUser, units }) {
  const myOpps = opps.filter(o => o.assigned_to === currentUser.id);
  const active = myOpps.filter(o => o.status === "Active");
  const won = myOpps.filter(o => o.status === "Won");
  const pipelineValue = active.reduce((a, o) => a + (o.budget || 0), 0);
  const wonValue = won.reduce((a, o) => a + (o.final_price || 0), 0);
  const conversionRate = myOpps.length > 0 ? Math.round(won.length / myOpps.length * 100) : 0;
  const myActivities = activities.filter(a => a.user_id === currentUser.id);
  const thisWeek = myActivities.filter(a => {
    const created = new Date(a.created_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return created > weekAgo;
  });

  return {
    title: "🚀 My Pipeline",
    subtitle: `Personal dashboard for ${currentUser.full_name}`,
    cards: [
      { label: "Active Opportunities", value: active.length, icon: "🎯", color: "#1D4ED8", metric: `AED ${(pipelineValue/1e6).toFixed(1)}M` },
      { label: "Won This Quarter", value: won.length, icon: "✅", color: "#1A7F5A", metric: `AED ${(wonValue/1e6).toFixed(1)}M` },
      { label: "Conversion Rate", value: conversionRate + "%", icon: "📊", color: "#8A6200", metric: myOpps.length + " total opps" },
      { label: "Activity This Week", value: thisWeek.length, icon: "📞", color: "#5B21B6", metric: "calls/meetings/notes" },
    ],
    insights: [
      { title: "🔥 Hottest Deal", value: active.length > 0 ? active[0]?.title : "—", desc: "Highest budget opportunity" },
      { title: "⏱️ Days in Stage", value: active.length > 0 ? Math.floor((new Date() - new Date(active[0]?.stage_updated_at || new Date())) / 86400000) + "d" : "—", desc: "Current stage duration" },
    ]
  };
}

function renderManagerDashboard({ leads, opps, activities, users, currentUser }) {
  const teamUsers = users.filter(u => u.manager_id === currentUser.id);
  const teamIds = [currentUser.id, ...teamUsers.map(u => u.id)];
  const teamOpps = opps.filter(o => teamIds.includes(o.assigned_to));
  const teamActive = teamOpps.filter(o => o.status === "Active");
  const teamWon = teamOpps.filter(o => o.status === "Won");
  const pipelineValue = teamActive.reduce((a, o) => a + (o.budget || 0), 0);
  const staleDeals = teamActive.filter(o => o.stage_updated_at && Math.floor((new Date() - new Date(o.stage_updated_at)) / 864e5) >= 7);
  
  const agentPerf = {};
  teamUsers.forEach(u => {
    const uOpps = teamOpps.filter(o => o.assigned_to === u.id);
    agentPerf[u.id] = { name: u.full_name, deals: uOpps.length, won: uOpps.filter(o => o.status === "Won").length, value: uOpps.reduce((a, o) => a + (o.budget || 0), 0) };
  });

  return {
    title: "👥 Team Performance",
    subtitle: `Managing ${teamUsers.length} agents`,
    cards: [
      { label: "Team Pipeline", value: teamActive.length, icon: "📈", color: "#1D4ED8", metric: `AED ${(pipelineValue/1e6).toFixed(1)}M` },
      { label: "Team Wins", value: teamWon.length, icon: "🏆", color: "#1A7F5A", metric: "closed this quarter" },
      { label: "Stale Deals Alert", value: staleDeals.length, icon: "⚠️", color: "#C9A84C", metric: "7+ days no movement" },
      { label: "Team Size", value: teamUsers.length, icon: "👤", color: "#5B21B6", metric: "agents active" },
    ],
    insights: [
      { title: "🥇 Top Performer", value: Object.entries(agentPerf).sort((a, b) => b[1].won - a[1].won)[0]?.[1]?.name || "—", desc: Object.entries(agentPerf).sort((a, b) => b[1].won - a[1].won)[0]?.[1]?.won + " wins" },
      { title: "📊 Team Conversion", value: teamOpps.length > 0 ? Math.round(teamWon.length / teamOpps.length * 100) + "%" : "0%", desc: "overall win rate" },
    ]
  };
}

function renderSuperAdminDashboard({ opps, users, activities, currentUser }) {
  const allOpps = opps || [];
  const allActive = allOpps.filter(o => o.status === "Active");
  const allWon = allOpps.filter(o => o.status === "Won");
  const totalPipeline = allActive.reduce((a, o) => a + (o.budget || 0), 0);
  const totalWon = allWon.reduce((a, o) => a + (o.final_price || 0), 0);
  
  const agentStats = {};
  users.forEach(u => {
    const uOpps = allOpps.filter(o => o.assigned_to === u.id);
    if (uOpps.length > 0) {
      agentStats[u.id] = { name: u.full_name, deals: uOpps.length, won: uOpps.filter(o => o.status === "Won").length };
    }
  });

  return {
    title: "🏢 Company Overview",
    subtitle: "Market-wide intelligence & strategic insights",
    cards: [
      { label: "Total Pipeline", value: allActive.length, icon: "💼", color: "#1D4ED8", metric: `AED ${(totalPipeline/1e6).toFixed(1)}M` },
      { label: "Closed Revenue", value: allWon.length, icon: "💰", color: "#1A7F5A", metric: `AED ${(totalWon/1e6).toFixed(1)}M` },
      { label: "Market Conversion", value: allOpps.length > 0 ? Math.round(allWon.length / allOpps.length * 100) + "%" : "0%", icon: "📊", color: "#8A6200", metric: allOpps.length + " total deals" },
      { label: "Active Agents", value: users.length, icon: "👥", color: "#5B21B6", metric: "all roles" },
    ],
    insights: [
      { title: "🥇 Company Top Agent", value: Object.entries(agentStats).sort((a, b) => b[1].won - a[1].won)[0]?.[1]?.name || "—", desc: Object.entries(agentStats).sort((a, b) => b[1].won - a[1].won)[0]?.[1]?.won + " wins" },
      { title: "📈 Market Health", value: allOpps.length > 0 ? (totalPipeline / 1e6).toFixed(1) + "M AED" : "—", desc: "active pipeline value" },
    ]
  };
}

function renderViewerDashboard({ opps, currentUser }) {
  const visibleOpps = opps.filter(o => !["Closed Won", "Closed Lost"].includes(o.stage));
  return {
    title: "👁️ Limited View",
    subtitle: "Read-only access to opportunities",
    cards: [
      { label: "Visible Opportunities", value: visibleOpps.length, icon: "📋", color: "#718096", metric: "read-only access" },
    ],
    insights: []
  };
}

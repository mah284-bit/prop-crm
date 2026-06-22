# PropCRM — Solution Architecture
**For:** Testers, stakeholders, future developers
**Date:** 22 June 2026
**Product:** PropCRM — UAE Real Estate Broker CRM

## 1. What the solution is
PropCRM is a multi-tenant SaaS CRM purpose-built for UAE real estate brokerages. It replaces the broker's daily ritual of logging into multiple developer portals with a single workspace combining three layers:
- Intelligence — PropPulse: a catalogue of UAE projects/developers, AI-verified.
- Compliance — Master Agreements, stage gates, audit-grade proposal versioning.
- Workflow — leads, opportunities, proposals, negotiations, AI Coach, commission tracking.

Designed around the real broker sales lifecycle: Lead to Opportunity to Proposal (versioned) to Negotiation to Reserve/SPA to Closed Won to Commission.

## 2. Technology stack
- Frontend: React 19
- Build: Vite 8
- Styling: inline styles + Tailwind utilities
- Backend/DB: Supabase (PostgreSQL + Row-Level Security + Realtime + RPCs)
- AI: Anthropic API (Claude) — PropPulse agent + AI Coach
- Hosting: Vercel (deploys from main); Vercel serverless functions (e.g. /api/ai)

## 3. Code structure
- App.jsx (~2,866 lines): root — auth, routing/tabs, top-level state, data load.
- lib/: cross-cutting utilities (single source of truth). supabase.js (DB client), permissions.js (can(role,action)), aiInvoke.js (AI path), conversionHandler.js (lead-to-customer), generateProposalPDF.js + uploadProposalPDF.js (proposal output), plus validation/image/draggable/lead-person helpers.
- components/getVisibleCompanyIds.js: group-scope primitive for RLS. components/getGroupConsolidatedData.js: group rollup resolver.
- modules/: constants.js (stage meta, activity types), utils.js (date/currency formatters).
- components/: 67 components across 13 feature folders — ai/ (AI Assistant bubble), auth/ (login/signup), customers/ (lifecycle), dialogs/ (shared modals), inventory/ (units), leadqueue/ (Lead Queue + governance), leads/ (list + detail), opportunities/ (Opp Detail 7-tab, Proposal Builder, Stage Capture), payments/ (plan templates), property/ (Property Pack resolver/viewer/panels), sales/ (Activity Log, Lead Detail, Opportunities), settings/ (Agent Pools, Lead Routing, Group/Branches). Standalone: Dashboard, PropPulse, CoachPage, MasterAgreements, CommissionOutstanding, GroupConsolidatedView.

Pattern: feature-folder. New modules in src/components/<feature>/ (lowercase — Vercel/Linux case-sensitive). App.jsx progressively reduced via extraction; shared inline components (Modal, Badge, Spinner) passed as props.

## 4. Multi-tenancy model
Every tenant-scoped table carries company_id; data isolated per brokerage by filtering on it (43+ refs in App.jsx + 36 components). PropPulse tables (projects, project_units, properties) are intentionally GLOBAL — the shared cross-tenant catalogue/moat.

Group hierarchy: optional groups table above companies; company.group_id (nullable) links to a group. null = standalone/individual (company-of-one). Group-level users see a consolidated view across all branches in their group — gated by groups.branch_visibility (isolated / group_admin_only / shared) + the see_all capability. Enforced via getVisibleCompanyIds(currentUser), which resolves which company_ids a user may see and fails safe to [own] (never leaks cross-branch).

Identity tiers (target): Platform Operators (run platform, no tenant data) vs Tenant Users (full CRM in their company). See Architecture_Multi_Tenant_Identity_Model.md.

## 5. Key architectural decisions
- Single-source-of-truth resolvers (getPropertyPackAssets, getGroupConsolidatedData, getVisibleCompanyIds): build-once, consume in multiple layers.
- Capability-driven access, not hardcoded roles: can(role, capability) — new roles slot in without rewiring.
- Real-time sync: Supabase Realtime on proposals, activities, opportunities, leads — fresh across tabs/users without manual refresh.
- Audit-grade by design: proposal versioning (V1-Vn never overwritten), lead-assignment governance (mandatory reason), stage-gate capture before transitions.
- Buyer/Broker financial separation (UAE compliance), enforced architecturally.

## 6. Known architectural notes (not defects)
- App.jsx large root (~2,866 lines) — progressive extraction ongoing; not a blocker.
- Production bundle >500kB single chunk — code-splitting is a future perf optimization.
- Group RLS enforcement: primitive + consolidated view built; wiring group-scope into per-screen company_id queries is scheduled (needs multi-branch test data first).
- Browser native Back not yet synced to in-app navigation (Phase 2 Nav-History item).

Assembled 22 Jun 2026 from codebase structure + existing architecture docs.

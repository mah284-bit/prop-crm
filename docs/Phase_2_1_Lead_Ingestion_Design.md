# Phase 2.1 — Lead Ingestion, Assignment & Governance (Design)

**Date captured:** 30 May 2026 (Saturday afternoon, Day 19)
**Source:** Day 19 founder-architect design session, post Phase 2.0 ship
**Status:** Design locked. Implementation begins after this doc commits.
**Demo target:** 15 June 2026
**Estimated effort:** 5-7 days
**Reference docs:** Phase_2_Strategic_Roadmap_v1.md (Item 2), Pre_Demo_Phase_2_Sprint.md (now updated)

---

## Why this doc exists

Earlier today, the Pre-Demo Sprint discipline doc scoped Phase 2.1 as "Layer 1 round-robin only" with release/transfer/stale-detection deferred to Phase 2.1 Extended. Founder pushed back with a principled argument:

> *"if we do split we have to come back I leave this call to you avoiding come backs completely is my thought which is going on from past 2 days."*

Architect agreed. Splitting now creates 2 days of re-warm-up cost when we return. Full Phase 2.1 (Layer 1 + Governance) ships pre-demo as one coherent unit. This doc captures that locked decision and the design that makes it shippable in 5-7 days.

---

## The two-origin model

Every lead in PropCRM has ONE of two origins:

### Broker-created (default — no routing)
- Broker meets walk-in, gets referral, captures WhatsApp inquiry, etc.
- Lead is owned by the broker who created it from the moment of creation
- No Lead Queue involvement, no round-robin
- This is how almost all existing leads in the system today were created

### Pool-sourced (routing required)
- Lead arrives from a configured "pool source": website form, paid portal (Bayut, PropertyFinder), marketing campaign, etc.
- Lead lands in the Lead Queue without an assigned broker
- Lead Admin reviews and assigns via round-robin within a pool (or manually overrides)

**The trigger between modes:** the `lead.source` value when the lead is created. Sources configured as "pool-sourced" in `companies.pool_sources` land in the queue. All others (including manually-created walk-in/referral leads) follow the broker-created path.

---

## Schema design

### New table: `agent_pools`
Per-company groupings of agents who share lead distribution.

```sql
CREATE TABLE agent_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id),
  UNIQUE(company_id, name)
);
CREATE INDEX idx_agent_pools_company ON agent_pools(company_id) WHERE is_active = true;
```

### New table: `agent_pool_members`
Agent membership in pools. An agent can be in multiple pools.

```sql
CREATE TABLE agent_pool_members (
  pool_id uuid NOT NULL REFERENCES agent_pools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_assigned_at timestamptz,  -- NULL = never assigned, oldest gets next lead
  added_at timestamptz DEFAULT now(),
  PRIMARY KEY (pool_id, user_id)
);
CREATE INDEX idx_pool_members_user ON agent_pool_members(user_id);
```

### New table: `lead_assignment_log`
Append-only audit. Every assignment, release, transfer, stale-flag, force-reassignment writes a row.

```sql
CREATE TABLE lead_assignment_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN (
    'initial_assignment',      -- pool-sourced lead first assigned
    'broker_created',          -- broker created the lead (own assignment)
    'manual_override',         -- admin overrode round-robin
    'broker_released',         -- broker released to queue
    'broker_transferred',      -- broker transferred to another broker
    'admin_force_reassigned',  -- admin reassigned stale lead
    'stale_flagged'            -- system flagged as stale (no human action yet)
  )),
  from_user_id uuid REFERENCES profiles(id),  -- NULL if no prior owner
  to_user_id uuid REFERENCES profiles(id),    -- NULL if released to queue
  pool_id uuid REFERENCES agent_pools(id),    -- which pool if pool-routed
  method text CHECK (method IN ('round_robin','manual','transfer','release','auto_stale')),
  reason text,                                 -- mandatory for transfer/release/force
  triggered_by uuid REFERENCES profiles(id),   -- who initiated (may differ from from/to)
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_assignment_log_lead ON lead_assignment_log(lead_id, created_at DESC);
CREATE INDEX idx_assignment_log_company ON lead_assignment_log(company_id, created_at DESC);
```

### New columns on `leads`
```sql
ALTER TABLE leads ADD COLUMN origin text 
  DEFAULT 'broker_created'
  CHECK (origin IN ('broker_created', 'pool_sourced'));
ALTER TABLE leads ADD COLUMN assignment_status text
  DEFAULT 'assigned'
  CHECK (assignment_status IN ('unassigned', 'assigned', 'released', 'stale_flagged'));
ALTER TABLE leads ADD COLUMN last_assigned_at timestamptz;
-- For stale detection
ALTER TABLE leads ADD COLUMN last_broker_activity_at timestamptz;
```

### New columns on `companies`
```sql
-- The user designated as Lead Admin for this brokerage
ALTER TABLE companies ADD COLUMN lead_admin_user_id uuid REFERENCES profiles(id);

-- Sources configured to route through Lead Queue (rest are broker-created)
ALTER TABLE companies ADD COLUMN pool_sources text[] DEFAULT ARRAY[]::text[];
-- Example: ARRAY['website_form', 'bayut', 'propertyfinder', 'campaign_q3_2026']

-- Org-configurable stale threshold (days without activity before stale-flag)
ALTER TABLE companies ADD COLUMN stale_lead_threshold_days int DEFAULT 7;

-- Whether stale-flagging triggers auto-return to queue or just admin visibility
ALTER TABLE companies ADD COLUMN stale_action text DEFAULT 'flag_for_admin'
  CHECK (stale_action IN ('flag_for_admin', 'auto_return_to_queue'));
```

---

## Assignment service logic (round-robin)

When a pool-sourced lead arrives or admin assigns from queue:

```
function assignLeadViaPool(leadId, poolId, triggeredBy):
  1. Get all active members of poolId, sorted by last_assigned_at ASC (NULLs first)
  2. Pick the FIRST member — that's the agent who hasn't been assigned longest
  3. In a single transaction:
     a. UPDATE leads SET assigned_to = agent_id, 
                          assignment_status = 'assigned',
                          last_assigned_at = NOW(),
                          last_broker_activity_at = NOW()
        WHERE id = leadId
     b. UPDATE agent_pool_members SET last_assigned_at = NOW()
        WHERE pool_id = poolId AND user_id = agent_id
     c. INSERT INTO lead_assignment_log
        (lead_id, company_id, action, to_user_id, pool_id,
         method, triggered_by)
        VALUES (leadId, ..., 'initial_assignment', agent_id, poolId,
                'round_robin', triggeredBy)
  4. Return assignment result
```

**Idempotency:** if `assignment_status` is already 'assigned' for this lead, fail with clear error (prevents accidental double-assign races). Lead Admin uses Force Reassign action for legitimate reassigns.

**Fairness:** ordering by `last_assigned_at` with NULLs-first ensures new agents in a pool get their first lead quickly. Tied timestamps broken by `user_id` (deterministic, not random).

---

## Governance rules — release, transfer, stale

### Broker formal release (broker initiates)
A broker who can't or won't work a lead must formally release it.

**Two release modes:**
1. **Release to Lead Admin queue** — lead returns to unassigned state, lands back in Lead Queue for re-routing
2. **Transfer to specific broker** — direct hand-off with a named recipient and a mandatory reason

**Both require:**
- Free-text reason (audit trail clarity, prevents "drop it casually")
- Updates `lead_assignment_log` with `action='broker_released'` or `'broker_transferred'`
- Updates `leads.assignment_status` to `'released'` (mode 1) or keeps `'assigned'` with new `assigned_to` (mode 2)

**UI surface:** "Release Lead" button on Lead Detail (for current assignee only, hidden if admin), opens dialog with mode + reason fields.

### Stale-detection (system surfaces, admin acts)
A lead with no broker activity for `companies.stale_lead_threshold_days` (default 7) is candidate for stale-flag.

**Definition of "activity":** any new row in `activities` table where `created_by = leads.assigned_to` AND `lead_id = lead.id` (or `opportunity_id` linked to this lead).

**Behavior depends on `companies.stale_action`:**
- `'flag_for_admin'` (default) — system marks `leads.assignment_status = 'stale_flagged'` and surfaces in Lead Admin's "Stale Leads" view. Admin chooses to nudge broker or force-reassign.
- `'auto_return_to_queue'` (org choice) — system unassigns lead, returns to queue automatically, logs as `'auto_stale'` method.

**Mechanism:** scheduled job (Supabase pg_cron, runs hourly) scans for leads where `last_broker_activity_at < NOW() - INTERVAL 'X days'` and status is 'assigned' — updates them per company policy.

### Admin force-reassign
Lead Admin can reassign ANY lead at any time (broker-created or pool-sourced, stale or active) using a "Force Reassign" action. Requires reason. Logs as `'admin_force_reassigned'`.

**This is the safety valve.** Brokers don't get to ignore leads forever even if not formally released.

---

## UI surfaces

### 1. Lead Queue (new top-level nav)
Visible to: Lead Admin + role-eligible users (super_admin, admin, sales_manager).

Three tabs:
- **Unassigned** — pool-sourced leads waiting for assignment + released leads back in queue
- **Stale Flagged** — leads with `assignment_status='stale_flagged'`, sorted by oldest first
- **History** — recent assignments (last 30 days), searchable

Each row in Unassigned/Stale Flagged offers:
- Lead name, source, days waiting, primary contact
- "Assign to Pool" dropdown (lists pools, click → round-robin assigns)
- "Manual Assign" button (pick specific broker)
- "Mark Lost" (kills the lead, logs reason)

### 2. Lead Detail — new "Assignment" section
Shows on every Lead Detail view (whether broker-created or pool-sourced):
- Current assignee + assigned date
- "Release Lead" button (only for current assignee)
- Mini-timeline of assignment history (last 5 entries from `lead_assignment_log`)
- "Full history" link → expands to all log entries

### 3. Settings → Agent Pools
Admin UI under Settings module (note: this nudges Item 10 Settings forward, but only this slice).
- List of pools for this company
- Create pool: name, description, pick members (multi-select of agents)
- Edit pool: rename, add/remove members
- Deactivate pool (soft delete — keeps history)

### 4. Settings → Lead Routing Rules
Same module, separate section.
- **Lead Admin user** picker — designate WHO handles the queue
- **Pool sources** — text-list editor for which `source` values route to queue
- **Default pool** for pool-sourced leads — when source isn't mapped to a specific pool, this pool handles it
- **Stale threshold** — number input (days)
- **Stale action** — radio: "Flag for admin" / "Auto-return to queue"

---

## Lead creation flow — updated

### When a broker creates a lead (existing flow, minor update)
```
Broker fills Lead Creation Form V2 → Save
  ↓
INSERT leads with:
  origin = 'broker_created'
  assignment_status = 'assigned'
  assigned_to = current_user.id
  last_assigned_at = NOW()
  last_broker_activity_at = NOW()
  ↓
INSERT lead_assignment_log with:
  action = 'broker_created'
  to_user_id = current_user.id
  method = 'manual'
  triggered_by = current_user.id
```

### When a pool-sourced lead arrives (new flow)
Two paths to this state:
1. **API endpoint** (`/api/leads/intake`) called by website form, portal webhook, etc — creates lead with `source` matching one in `companies.pool_sources`
2. **Manual entry** by admin via "Add to Queue" action — admin specifies source as pool-sourced

```
Lead created with origin='pool_sourced', assignment_status='unassigned'
  ↓
Realtime event fires (Phase 2.0!) → Lead Queue UI updates everywhere
  ↓
Lead Admin sees new lead in Unassigned tab
  ↓
Admin clicks "Assign to Pool" → picks pool → round-robin runs
  ↓
Lead now has assigned_to + status='assigned'
Realtime fires again → that agent's pipeline updates instantly
```

---

## Day-by-day build sequence

| Day | Build | Verify |
|---|---|---|
| **Day 19 PM** (today) | Schema migration + RLS policies + companies columns | SQL runs clean, no rollback needed |
| **Day 20** | Assignment service (RPC functions) + Lead creation flow update + Pool-sourced intake logic | Manual SQL test: insert pool-sourced lead, call assignViaPool, verify log entry |
| **Day 21 AM** | Settings → Agent Pools UI | Admin can create pool, add agents |
| **Day 21 PM** | Settings → Lead Routing Rules UI | Admin can designate Lead Admin + configure pool sources |
| **Day 22 AM** | Lead Queue page + 3 tabs | Unassigned leads visible, assign works, history shows |
| **Day 22 PM** | Lead Detail Assignment section + Release dialog | Broker can release, log entry created |
| **Day 23** | Stale-detection (pg_cron job + admin visibility) | Pause and decide if cron is right vs client-side check |
| **Day 24** | Test, polish, deploy verify on production | Cross-tab + multi-user verification |
| **Day 25 buffer** | Slip-absorbing day | Either Phase 2.1 extras OR start demo hardening early |

Demo Hardening begins Day 26 regardless. If Phase 2.1 isn't fully done by then, Day 26 decision: ship partial + write the gap into demo Q&A, or pull one of the lower-value Layer 1 items.

---

## Open design questions (decide before code)

### Q1: Lead Admin role — new permission or existing?
Two options:
- **A) Reuse existing `sales_manager` role + check `companies.lead_admin_user_id`** — no new role needed, the designated user gets the Queue nav item visible
- **B) Add new `lead_admin` value to existing role system** — cleaner permission model but touches RBAC

**Architect lean:** A. Less RBAC change, faster to ship, doesn't preclude B later if needed.

### Q2: Stale-detection — server cron or client check?
- **Server cron (Supabase pg_cron):** scheduled job runs hourly, scans + updates. Reliable, even if no user is logged in.
- **Client check:** when Lead Admin opens the Lead Queue page, the page computes which leads are stale. Simpler, no cron infrastructure.

**Architect lean:** Client check for pre-demo. If a brokerage actually adopts auto-return-to-queue policy, cron becomes needed. Defer cron complexity.

### Q3: Pool-sourced intake endpoint — is it needed pre-demo?
Real customers have a website form that POSTs to PropCRM. For demo, we DON'T need that — admin can manually enter pool-sourced leads via "Add to Queue" form. The intake API is a Phase 2.1 Extended item.

**Architect lean:** Skip the intake API pre-demo. Demo shows manual queue entry + round-robin assignment. Investor narrative says "intake API drops in trivially when first website goes live."

### Q4: Broker-to-broker transfer — needs recipient consent?
- **A) No consent needed** — broker transfers, lead lands in recipient's pipeline immediately
- **B) Recipient must accept** — extra workflow step, prevents dumping

**Architect lean:** A. Adds discipline (reason required) without recipient veto. If broker abuses transfer, Lead Admin sees it in audit log. Recipient consent is over-engineering for the demo audience.

---

## Implementation discipline

1. **Schema first, in a single migration file** — `2026-05-30_phase_2_1_lead_ingestion.sql`. Includes rollback SQL at bottom.
2. **One golden-mark commit per day's deliverable** — revertable if next-day discovery shows we got something wrong.
3. **Every UI surface must work on the deployed Vercel preview before "done"** — local + preview verification.
4. **No Layer 2 or Layer 3.** Source-based routing rules and territory/language matching stay in roadmap. We DO ship the `pool_sources` array as a foundation, but we don't build sophisticated routing on top of it now.
5. **Update `Pre_Demo_Phase_2_Sprint.md` discipline doc** at end of Day 19 to reflect the new full Phase 2.1 scope.
6. **Update `Phase_2_Strategic_Roadmap_v1.md` Item 2** to reflect what Layer 1 ACTUALLY means after this revision.

---

## Founder principles preserved

> *"if we do split we have to come back I leave this call to you avoiding come backs completely is my thought which is going on from past 2 days."*

This document IS the response to that principle. Phase 2.1 ships as one coherent unit including governance, not split into Layer 1 + Extended.

> *"no half hearted work which spoils"*

Architect's vow: 5-7 days of complete Phase 2.1 work, then proper demo hardening. If something inside Phase 2.1 needs to be deferred mid-build, we WRITE THAT DOWN and we don't pretend it shipped.

> *"The design should be for 1 to be responsible to check and assign, if required we can give a setup here also for the orgs to decide"*

Per-company `lead_admin_user_id`. One designated person owns the Queue. Org sets it in Settings. Captured.

---

## Status

- [x] Design captured (this doc)
- [ ] Open questions Q1-Q4 resolved (architect recommendations above, founder confirms)
- [ ] Schema migration written + reviewed
- [ ] Schema deployed to Supabase
- [ ] Assignment service RPC functions
- [ ] Lead creation flow updated (broker_created tagging)
- [ ] Settings → Agent Pools UI
- [ ] Settings → Lead Routing Rules UI
- [ ] Lead Queue page (3 tabs)
- [ ] Lead Detail Assignment section + Release dialog
- [ ] Stale-detection client check
- [ ] Tested cross-tab on production
- [ ] Pre_Demo_Phase_2_Sprint.md updated
- [ ] Phase_2_Strategic_Roadmap_v1.md Item 2 updated

---

*Document created: 30 May 2026 (Day 19 afternoon)*
*Source: Founder-architect design session post Phase 2.0 ship*
*Status: Locked. Implementation Day 19 PM onwards.*
*Next: founder confirms Q1-Q4 architect recommendations, then schema migration drafted.*

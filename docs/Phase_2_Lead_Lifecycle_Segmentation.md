# Phase 2 — Lead Lifecycle & Buyer Segmentation

**Date captured:** 23 May 2026 (Saturday morning, Day 11)
**Source:** Founder revisiting original project notes
**Founder quote:** *"if you look at our design it the new buyers we create as lead, and remain as lead contacts... The minute we attach an opportunity/sale is confirmed we should convert them to as customers... this will help us segregate and we should also look at putting things as investors or simple buyers"*
**Strategic value:** CRITICAL — marketing automation foundation
**Effort:** 2-3 days focused work
**Timing:** Q3 2026 (post-pilot, with FAB + Customer-Facing Bundle)

---

## TL;DR

PropCRM currently treats every contact as a "lead" forever. **Real CRM lifecycle separates leads → customers → portfolio customers.** Plus, **segmenting buyers as Investors vs Owner-Occupiers vs Hybrid** unlocks targeted marketing — investor alerts for new launches, lifestyle content for end-users, repeat-purchase outreach to portfolio holders.

**This is professional CRM thinking** that competitors at our stage haven't built yet. Investor demo gold IF positioned in Phase 2 roadmap.

---

## The Problem Today

```
Current PropCRM:
  - 500 raw leads from campaigns/events/website all in one bucket
  - No distinction between "browsing" leads and "committed buyers"
  - No buyer-intent capture (why are they buying?)
  - When SPA signed → they stay as "lead" forever
  - No way to segment: "show me all my investor customers who closed in 2025"
  - No path for: "email all investor-type customers about new Sobha launch"
```

**Result:** Broker has data but cannot ACT on it for marketing. Marketing remains spray-and-pray.

---

## The Solution: Lifecycle + Segmentation

Two orthogonal dimensions:

### Dimension 1: Lifecycle Stage (where they are in the journey)

```
RAW LEAD (just captured)
   ↓ activities, qualification calls
QUALIFIED LEAD (verified interest, budget known)
   ↓ opportunity attached
ACTIVE PROSPECT (in sales pipeline)
   ↓ SPA signed
CUSTOMER (closed Won)                ⭐ AUTO-CONVERSION POINT
   ↓ handover complete
ACTIVE CUSTOMER (in service phase)
   ↓ ownership ≥ 1 property
PORTFOLIO CUSTOMER (Investor segment)  ⭐ MARKETING GOLD
```

**Auto-conversion logic:** When opportunity reaches "Closed Won" stage, the lead automatically becomes a Customer. Field `became_customer_at` is timestamped.

### Dimension 2: Buyer Intent (why they buy)

```
INVESTOR
  - Pure ROI focus
  - Looks at: rental yield, capital appreciation, payment plan flexibility
  - Multi-property strategy
  - Open to: new investment opportunities, market intelligence
  - Marketing fit: investor newsletters, ROI reports, new launch alerts
  
OWNER-OCCUPIER (End-User)
  - Buying to live in
  - Looks at: schools, community, facilities, location, lifestyle
  - Usually one property at a time
  - Marketing fit: lifestyle content, community events, neighbourhood updates
  
HYBRID
  - Live first 1-2 years, then rent
  - Half-and-half mindset
  - Marketing fit: both streams, lifestyle now + investment later
  
CORPORATE
  - Company asset purchase
  - Staff accommodation
  - Different decision process (committees, approvals, ROI thresholds)
  - Marketing fit: B2B real estate, bulk deals, corporate housing solutions
  
DEVELOPER / RESELLER
  - Buys to flip
  - Looks at: undervalued units, payment plan for resale before handover
  - Marketing fit: pre-launch access, off-market deals, bulk opportunities
```

These segments don't change much. An investor stays an investor. A family buying their first home stays an end-user (mostly). **Captured at lead creation, evolves slowly.**

---

## Marketing Automation Use Cases

### Use Case 1: Investor Alert Campaign
```
Trigger: New Sobha project (AED 40B Abu Dhabi) launches in PropPulse
Action: Filter customers WHERE buyer_intent='investor' AND lifecycle_stage='portfolio_customer'
Result: Targeted email/WhatsApp to ~50 investor customers
Content: "New investment opportunity - 7.5% projected yield, payment plan 20/80, 
         pre-launch pricing for our valued investors"
Conversion expectation: 15-25% engagement, 2-5% booking inquiry
```

### Use Case 2: Move-In Anniversary
```
Trigger: 1 year after became_customer_at for OWNER-OCCUPIERS
Action: Filter WHERE buyer_intent='owner_occupier' AND became_customer_at=NOW()-1yr
Result: Anniversary check-in message
Content: "Happy first anniversary in your new home! How can we help with anything?"
Result: Goodwill + referral opportunity (anniversary parties = network exposure)
```

### Use Case 3: Repeat Investor Win-Back
```
Trigger: 6 months silent investor customer
Action: Filter WHERE buyer_intent='investor' AND last_activity < NOW()-6 months
Result: Re-engagement campaign
Content: Market analysis + 3 hand-picked opportunities matching their last purchase profile
Goal: Reactivate dormant capital, second property
```

### Use Case 4: Pre-Launch Investor Privilege
```
Trigger: Developer announces pre-launch access for premium clients
Action: Top 20% by portfolio_size + buyer_intent='investor'
Result: VIP invite (limited slots)
Content: Exclusive 24h pre-launch access before public release
Result: Creates customer loyalty + first-mover advantage feeling
```

### Use Case 5: Raw Lead Nurture by Intent
```
Even raw leads benefit:
  Raw lead buyer_intent='investor' → market intelligence emails
  Raw lead buyer_intent='owner_occupier' → community lifestyle showcases
  
Result: Higher engagement, better lead qualification, fewer wasted calls
```

---

## Schema Design

```sql
-- Lifecycle stage tracking
ALTER TABLE leads ADD COLUMN lifecycle_stage text DEFAULT 'raw'
  CHECK (lifecycle_stage IN (
    'raw',              -- just captured, no qualification yet
    'qualified',        -- 1+ meaningful interactions, profile complete
    'active_prospect',  -- has opportunity attached
    'customer',         -- closed Won (auto-set)
    'portfolio_customer' -- 2+ properties owned (auto-calculated)
  ));

-- Buyer intent (already have buyer_type for KYC, this is for marketing)
ALTER TABLE leads ADD COLUMN buyer_intent text
  CHECK (buyer_intent IN (
    'investor',
    'owner_occupier',
    'hybrid',
    'corporate',
    'reseller'
  ));

-- Customer fields (become meaningful after closed Won)
ALTER TABLE leads ADD COLUMN became_customer_at timestamp;
ALTER TABLE leads ADD COLUMN portfolio_size integer DEFAULT 0;
ALTER TABLE leads ADD COLUMN total_purchases_aed numeric DEFAULT 0;
ALTER TABLE leads ADD COLUMN marketing_opt_in boolean DEFAULT true;
ALTER TABLE leads ADD COLUMN last_marketing_contact timestamp;

-- Auto-conversion trigger (function + trigger)
CREATE OR REPLACE FUNCTION convert_lead_to_customer()
RETURNS TRIGGER AS $$
BEGIN
  -- When opportunity moves to Closed Won
  IF NEW.stage = 'Closed Won' AND OLD.stage != 'Closed Won' THEN
    UPDATE leads SET 
      lifecycle_stage = CASE 
        WHEN portfolio_size >= 1 THEN 'portfolio_customer'
        ELSE 'customer'
      END,
      became_customer_at = COALESCE(became_customer_at, NOW()),
      portfolio_size = portfolio_size + 1,
      total_purchases_aed = COALESCE(total_purchases_aed, 0) + COALESCE(NEW.current_agreed_price, 0)
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER opp_closed_won_converts_lead
AFTER UPDATE OF stage ON opportunities
FOR EACH ROW EXECUTE FUNCTION convert_lead_to_customer();
```

---

## UI Changes Required

### 1. Lead Creation Form
Add at top of form:
```
What kind of buyer are they?
[ Investor | Owner-Occupier | Hybrid | Corporate | Reseller ]
```

This becomes a required field. Drives downstream segmentation.

### 2. Lead List View — Add Segment Filters
```
Lifecycle: [All ▼]  Buyer Intent: [All ▼]  Source: [All ▼]
  ├─ Raw
  ├─ Qualified
  ├─ Active Prospect
  ├─ Customer
  └─ Portfolio Customer
```

### 3. Customers Screen (NEW menu item)
Separate from Leads:
- Default filter: lifecycle_stage IN ('customer', 'portfolio_customer')
- Cards show: name, properties owned, total purchase value, last contact, buyer intent badge
- Filters: Buyer Intent, Portfolio Size, Time Since Purchase

### 4. Lead/Customer Detail View
Add lifecycle pill at top:
```
[MF] Misbah F  [QUALIFIED] [INVESTOR]
```

### 5. Bulk Actions
On Leads/Customers list:
```
☑ Select 47 contacts
[Send Email] [Send WhatsApp] [Create Task]
```

### 6. Manager Dashboard
Per-segment metrics:
```
Investor Customers: 23 (AED 47M in portfolio)
Owner-Occupier Customers: 41 (AED 89M in portfolio)
Conversion rate by intent:
  - Investor leads → closed: 28%
  - Owner-Occupier leads → closed: 18%
```

---

## Build Plan (Phase 2)

### Day 1 — Schema + Lead Creation (6-8 hrs)
- Schema migration (lifecycle + intent + customer fields)
- Auto-conversion trigger (closed_won → customer)
- Lead creation form: Buyer Intent dropdown
- Lead/Customer detail view: lifecycle badges

### Day 2 — Customers Screen + Filters (6-8 hrs)
- New Customers screen as separate menu item
- Segmentation filters across Leads + Customers
- Manager Dashboard segment metrics

### Day 3 — Bulk Actions + Email/WhatsApp (6-8 hrs)
- Select-and-send bulk action UI
- Template management (per-segment templates)
- Email integration (SMTP or Resend/Sendgrid)
- WhatsApp Business API integration (separate Phase 2 dependency)

**Total: 2-3 days focused work**

---

## Demo Positioning (June 5)

**If investor asks: "How do you segment customers for marketing?"**

Answer:
> "Today PropCRM captures all the data needed — buyer type, source, contact history. 
> Phase 2 (Q3 2026) adds lifecycle management — leads automatically convert to customers 
> when SPA signed — plus buyer intent segmentation: Investor / Owner-Occupier / Hybrid / 
> Corporate / Reseller.
>
> This unlocks targeted marketing: send investor alerts only to investor customers, 
> lifestyle content to end-users, pre-launch privileges to portfolio holders. 
> Modern CRM lifecycle, designed for the UAE real estate buyer journey."

**Investor takeaway:**
- Founder thinks like a CRM strategist, not just a developer
- Marketing automation is roadmapped, not afterthought
- Customer lifetime value is engineered into the schema
- UAE-specific (investor segment is huge in UAE)

---

## Why This Matters Beyond Demo

### Network effect
Every brokerage that adopts PropCRM contributes:
- More investor patterns → better targeting models
- More buyer intent data → better recommendation engine
- Eventually: AI can suggest "this lead profile matches our investor segment"

### Revenue model expansion
- Premium tier: Customers + Marketing Automation (vs basic CRM)
- Per-message pricing for WhatsApp campaigns
- Marketing services upsell

### Strategic moat
Other CRMs treat real estate leads generically. **PropCRM understands UAE buyer psychology** — investor vs end-user is THE primary segmentation here. Building for this market specifically is the moat.

---

## Connection to Other Phase 2 Work

### Connects to:
- **Phase_2_Activity_Logging_Everywhere.md** — log activities tagged with lifecycle stage
- **Phase_2_Role_Based_Dashboard_Vision.md** — Manager sees per-segment performance
- **Phase_2_Backlog_Master_Doc.md** — Master tracker
- **Phase_2_Customer_Facing_Bundle** (in master doc) — bundle send tracks per-segment

### Synergy:
All Phase 2 features compound. Lifecycle + Bundle + Logging + Role-Based Dashboard = professional CRM platform.

---

## Founder Notes Preserved

> "if you look at our design it the new buyers we create as lead, and remain as lead contacts"

> "out of 500 leads we get of a campaign or event or website or anywhere from once we start communicating it remains in lead unless move forward attach and opportunity"

> "The minute we attach an opportunity/sale is confirmed we should convert them to as customers"

> "this will help us segregate and we should also look at putting things as investors or simple buyers who want to live on the property bought"

> "If this segregations is done, we can pick the investors and blast emails with new good investing opportunities"

---

## Status

- [x] Captured in Phase 2 backlog (this doc)
- [ ] Schema migration written
- [ ] Customer model designed
- [ ] UI mockups
- [ ] Built in dev2 / Phase 2
- [ ] Launched with marketing automation

---

*Document created: 23 May 2026 (Saturday morning, Day 11)*
*Source: Founder revisiting original project vision, documented during δ-LITE Lead Detail logging restoration*
*Status: Phase 2 priority, scheduled Q3 2026 with FAB + Customer-Facing Bundle*

# PropPlatform — Strategic Doc on Data, Listings & Leads

**Date:** 06 May 2026
**Purpose:** After today's broker meeting + competitive intel on BrokerPro, this doc maps the complete UAE broker SaaS ecosystem and recommends what PropPlatform should build vs partner vs defer.
**For:** Abid Mirza, Founder, BFC + partner discussion
**Time invested in research:** ~75 minutes across 6 web searches

---

## EXECUTIVE SUMMARY

After today's broker meeting and follow-up research, three things are clear:

1. **A complete UAE broker CRM has 3 pillars, not 1.** Inbound data (PropPulse already does this), outbound listing syndication (you don't have this), and lead capture inbox (you don't have this). Ruby CRM, REM, SEM, Behomes — they all do all 3.

2. **PropPulse is genuinely differentiated** on Pillar 1. The MD's reaction to BrokerPro's "DLD direct data" claim is real — DLD integration is achievable in 4-8 weeks with proper trade license activity. You can match this. It's regulatory paperwork, not technology.

3. **The strategic question is bigger than data sources.** It's: *should PropPlatform be a complete UAE broker CRM (3 pillars) or stay specialised on project intelligence (1 pillar = PropPulse)?* This decision shapes everything else.

**My recommendation:** Build to 3 pillars, but in disciplined sequence. **Phase order: Pillar 1 (deepen) → Pillar 2 (listings) → Pillar 3 (leads).** Each pillar adds market value AND credibility; skipping any limits broker adoption.

---

## 1. THE 3-PILLAR BROKER SAAS REALITY (2026)

### What complete CRMs do today

Every successful UAE broker CRM in 2026 — Ruby CRM, REM, SEM, Propspace (PropertyFinder's CRM), Behomes, Propertybase Salesforce — covers all three pillars. Specialists on a single pillar exist (Reelly = Pillar 1 only) but they're partners, not standalone solutions.

| Pillar | What it does | Examples in UAE | Status in PropPlatform today |
|---|---|---|---|
| **1. Inbound data** | "What's available to sell?" — projects, units, prices, transactions | Reelly (Pillar 1 only), Behomes data layer | ✅ PropPulse covers this. Strong differentiator. |
| **2. Outbound listings** | "Get my inventory in front of buyers" — syndicate to portals | Ruby CRM, REM, Propspace | ❌ NOT BUILT |
| **3. Lead capture** | "Calls and inquiries land in one place" — unified inbox | All of the above | ❌ NOT BUILT (basic Leads module exists but doesn't ingest from external sources) |

### Why this matters

Your meeting today: **the brokers were impressed with PropPulse but already have SEM** (Pillar 2 + 3). That's why Broker 2 said "finish everything, come back when ready" — *they're waiting for PropPlatform to also handle listings and leads, not just intelligence.*

Until you do, you're a **layer they add**, not a **system they switch to.** Both are valid businesses. The first is a smaller, tighter market. The second is the 100M+ AED ARR opportunity.

---

## 2. PILLAR 1 — INBOUND DATA SOURCES (DEEP DIVE)

### What you have today
- AI agent scrapes ~20 developer websites
- 27 projects, growing
- Manual verification queue
- Pretty good UX

### What's still missing (the ecosystem map)

| Source | What it provides | Cost | Time to integrate | Your need |
|---|---|---|---|---|
| **Dubai Pulse Open Data** | Projects, developers, transactions (Dubai). Daily refresh. | Free | 1-2 weeks | **HIGH** — quick win, same data BrokerPro likely uses |
| **DLD Trakheesi API** | Listing permits, advertisement compliance | Free for licensed | 4-8 weeks (approval) | MEDIUM |
| **DLD Oqood API** | Off-plan registration BEFORE public launch | Free for licensed | 4-8 weeks | **HIGH** — this is what BrokerPro markets as "before announced" |
| **DARI / ADRES (Abu Dhabi)** | Same as DLD, AD market | Setup TBD | 6-12 weeks | MEDIUM (defer) |
| **Bayut API** | Live listings (rent/sale), agent info | Free tier + paid | 1-2 weeks | LOW (different data type) |
| **Apify scrapers (Bayut/PF)** | Listings + owner contact info | $0.80-$0.89 per 1,000 listings | 1 week | LOW (use only if specific need) |
| **Reelly partnership** | 1,856 projects + brochures | Subscription | 1 week | DEFER — overlap with PropPulse |

### What's missing from PropPulse vs Reelly (honest gap)

I noticed in research: **Ruby CRM markets "1,856 off-plan projects via Reelly" as a feature.** PropPulse has 27. That's a coverage gap visible to brokers.

**Options to close it:**
- **Option A:** Scale your AI agent to 100+ developers (effort: many weeks, ongoing maintenance)
- **Option B:** Add Dubai Pulse open data (gets you the official registry, ~5,000+ Dubai projects in one ingest)
- **Option C:** Reelly partnership (rent the coverage, lose the moat)

**Recommended:** **Option B is highest leverage.** Dubai Pulse is free, gives authoritative coverage, lets you keep PropPulse moat while adding scale.

### Why the BrokerPro pitch worked on the MD

The MD heard "data direct from DLD before announced." Translation:
- "Direct from DLD" → Dubai Pulse open data + DLD APIs
- "Before announced" → Oqood off-plan registration data (registered in Oqood ~2-12 weeks before public launch by developer)

**You can build the exact same pitch in 4-8 weeks.** Trade license amendment + DLD approval are the bottleneck, not technology.

---

## 3. PILLAR 2 — OUTBOUND LISTING SYNDICATION

### How it actually works in UAE 2026

Brokers want to:
1. Enter a property in their CRM ONCE
2. Have it appear automatically on Bayut, PropertyFinder, Dubizzle, Skyloov (and Facebook/Instagram if they advertise there)
3. Maintain consistency across all portals
4. Track which portal generated each lead

**The mechanism: XML feeds.**

### The XML feed model (industry standard)

Confirmed from Bayut Help Centre:
> *"A XML Integration is required to sync properties with Bayut and/or dubizzle in bulk using external CRM systems. The XML feeds should be shared as publicly accessible URLs, the Bayut system will be reading this URL to sync the updates."*

How it works:
1. PropPlatform generates an XML feed at a public URL per portal: e.g., `https://prop-crm-two.vercel.app/feeds/bayut/{broker_id}.xml`
2. Broker registers the URL with their portal account manager
3. Portal polls the URL every X hours and ingests new/updated/deleted listings
4. Broker manages everything in PropPlatform — no copy-paste, no logging into 4 dashboards

### Required portals for UAE brokers

| Portal | Importance | XML feed model | Notes |
|---|---|---|---|
| **PropertyFinder** | Critical | XML feed, Trakheesi permit field required | Largest portal for premium |
| **Bayut** | Critical | XML feed | Highest organic traffic |
| **Dubizzle** | Critical | XML feed (same as Bayut — owned by EMPG) | Strong for rent + budget |
| **Skyloov** | Important | Less documented, integration via partner | Newer but growing |
| **Houza** | Optional | Possible | Smaller share |
| **Facebook/Instagram** | Important | Meta ads with lead forms | Different model — Pillar 3 |

### What you'd need to build

**Per portal:** XML schema mapping, feed generator, scheduled regeneration when broker edits, error reporting back to broker, photo handling, multilingual descriptions (English + Arabic).

**Effort estimate:** 
- First portal (e.g., Bayut): 2-3 weeks
- Each additional portal (PF, Dubizzle, Skyloov): 1 week each (similar mechanics, different schema)
- **Total for 4 portals: 5-7 weeks of dev work**

**One-time cost (estimate):** AED 25,000 - 50,000 dev time
**Ongoing cost:** Minimal — XML hosting included in Vercel, periodic schema updates 

### Why this is high-value

This is **the daily workflow** for brokers. Right now they:
- Enter listings in their CRM
- Copy-paste to Bayut (30 min)
- Copy-paste to PF (30 min)
- Copy-paste to Dubizzle (30 min)
- Copy-paste to Skyloov (30 min)
- Update photos when one changes (multiply by 4)
- Withdraw listing when sold (multiply by 4)

**Multi-portal syndication saves 2-3 hours per listing per broker per week.** It's a feature brokers SEE and FEEL, unlike background data.

### Strategic implication

**Without this, PropPlatform is a tool brokers add. With this, PropPlatform is a tool brokers switch to.** Same product, different market position.

---

## 4. PILLAR 3 — LEAD CAPTURE & UNIFICATION

### The problem brokers have

Today, leads come from:
1. **Portal inquiries** (Bayut/PF/Dubizzle "Contact Agent" → email/SMS)
2. **Facebook Lead Ads** (Meta forms → CRM via API)
3. **Google Ads** (forms → CRM via API)
4. **Direct website** (their own brokerage site forms)
5. **WhatsApp** (incoming messages)
6. **Phone calls** (from any of the above)

Each source has its own dashboard, format, response time, and quality. **Brokers spend their day switching between tabs.**

### The solution: unified inbox

Top UAE CRMs have built this:
- Ruby CRM: "PropertyFinder inquiries, Bayut inquiries, Dubizzle, Skyloov, Facebook all in one inbox"
- Behomes: "automate lead generation and management"
- LeadSquared, Bitrix24, Zoho IQ Real Estate: similar

### What you'd need to build

| Component | Complexity | Effort |
|---|---|---|
| **Portal inquiry intake** (parse emails from Bayut/PF/Dubizzle, extract structured data) | Medium | 2-3 weeks |
| **Meta Lead Ads API integration** (Facebook + Instagram lead forms) | Medium | 1-2 weeks |
| **Google Ads lead form API** | Medium | 1-2 weeks |
| **WhatsApp Business API integration** | Complex | 3-4 weeks (also requires WhatsApp Business approval) |
| **Webhook listener for native website forms** | Low | 1 week |
| **Auto-routing & assignment logic** | Medium | 1-2 weeks |
| **Unified inbox UI** | Medium | 2-3 weeks |
| **Source attribution + reporting** | Low | 1 week |

**Effort estimate:** 12-18 weeks of dev work for all of the above (full Pillar 3)
**Phased start (just Bayut + PF + Meta):** 5-7 weeks

**One-time cost (estimate):** AED 60,000 - 120,000 dev time  
**Ongoing cost:** Meta API minimal, WhatsApp Business has tier pricing (~AED 2,000-10,000/month at broker scale)

### What about lead GENERATION (not capture)?

**Important distinction:** capture vs generate.

- **Capture** = receiving leads brokers' marketing already produces (no marketing budget needed from PropPlatform)
- **Generate** = creating leads via ads (requires marketing budget, different business model)

**Lead generation companies in UAE 2026:**
- AgentBolt, GoDubai Portal, Owner Leads Dubai, Zoom Property
- **Pricing model:** AED 50-150 per mid-market lead, AED 200-500 per luxury lead, monthly retainer + per-lead fees
- They run Google Ads + Meta Ads + their own portals, sell qualified leads to brokers

**Should PropPlatform generate leads?** I'd say **no, at least not initially.** Reasons:
1. Different business model (PropPlatform = SaaS subscription; lead gen = pay-per-lead or rev-share)
2. Different cost structure (SaaS = R&D heavy; lead gen = marketing budget heavy)
3. Different legal/compliance burden (PDPL, ad targeting rules)
4. Brokers can BUY leads from existing companies and have them flow into PropPlatform via Pillar 3

**Better strategy:** Capture leads from any source the broker chooses to use. Be agnostic. Let brokers buy leads from AgentBolt or GoDubai Portal — those leads then flow into PropPlatform's unified inbox.

### What was BrokerPro's "100s of leads" promise?

Probably one of:
1. **Reselling leads** from their own portal/ads (lead gen business model)
2. **Aggregated portal inquiries** (capture model — same as your Pillar 3)
3. **Marketing claim with weak delivery** (most common in this space)

**You can't and probably shouldn't compete on lead generation as a SaaS.** But you CAN compete on lead capture + unification — same outcome from broker's perspective, different unit economics.

---

## 5. THE STRATEGIC DECISION — OPTION A vs OPTION B

### Option A: Stay focused on PropPulse

**Position:** "PropPulse is the most accurate, AI-deep project intelligence layer. Plug it into your existing CRM (REM, SEM, Salesforce, etc.)."

**Pros:**
- Smaller build, faster iteration
- Genuine differentiation (no one does AI-deep + DLD-integrated + customer-owned data)
- Lower complexity to maintain
- Could be sold as a "data layer" to other CRMs (B2B2B)

**Cons:**
- Smaller market — only brokers willing to buy a layer
- Brokers prefer all-in-one (your meeting today proves this)
- Easier for incumbents to clone (Reelly pivot, Ruby CRM extends, etc.)
- Limits your pricing power — "data subscription" pricing is lower than "full CRM" pricing

**Likely revenue ceiling:** AED 10-30M ARR
**Likely customer count:** 50-200 brokerages

### Option B: Become a complete CRM (3 pillars)

**Position:** "PropPlatform is the complete UAE broker CRM with PropPulse at its core — better data, better listings, better lead management."

**Pros:**
- Larger market — competing for full CRM seat
- Higher pricing power — full SaaS pricing, not data subscription
- Brokers can replace SEM/Ruby/REM with you (real switching cost)
- PropPulse becomes the moat WITHIN a complete product (harder to clone)

**Cons:**
- Bigger build, longer time to feature parity
- Higher maintenance burden
- More competitive (Ruby CRM, REM, SEM all funded and growing)
- Risk of being "good at nothing"

**Likely revenue ceiling:** AED 100M-500M ARR
**Likely customer count:** 1,000-5,000 brokerages

### My honest read on YOUR situation

Three factors weigh toward **Option B**:

1. **Your meeting feedback today.** Both Broker 1 and Broker 2 mentioned PropPulse positively but signaled they NEED full CRM. "Finish everything, come back when ready" = "we're waiting for completeness."

2. **Your background.** You've built enterprise CRM systems for 15+ years. Building a complete CRM is your strength. Building a "data layer" is closer to a database product, which is a different muscle.

3. **The naming research conclusion.** When you decide on a name (Mediant, Vouchdesk, etc.), it'll be a bigger brand if PropPlatform = full CRM. "Mediant" as a data layer feels narrow.

But **Option A** has one factor in its favor:

**Your operating principle: "no big bang."** Option B IS a big bang relative to where you are today. Option A respects the principle by staying focused.

### The reconciliation

**Build toward Option B in disciplined phases.** This respects "no big bang" while building toward the larger market. Pillar 1 deepens (DLD integration). Pillar 2 ships in the next sprint cycle. Pillar 3 follows after Pillar 2 is stable.

**Do NOT try to build all 3 pillars in parallel.** That IS a big bang. Sequence them.

---

## 6. RECOMMENDED PHASING

### Phase 0 (NOW — next 2 weeks): Foundation

These don't add features but enable everything else:

1. ✅ **lib/supabase.js refactor** (30-45 min) — fix demo loading issues
2. ✅ **5 PropPulse SQL queries** (20-30 min) — answer pending data questions
3. ✅ **Vercel cron for AI agent** (1-2 hours) — agent runs daily without manual trigger
4. ✅ **Apply for trade license amendment** (start the 14-day clock) — adds software activity to BFC

**Investment:** AED 1,500-3,000 (license amendment) + dev time you already have

### Phase 1 (next 4-6 weeks): Pillar 1 deepen

1. **Dubai Pulse Open Data integration** — gets you "all Dubai projects" coverage (5,000+ vs 27)
2. **PropPulse UI improvements** — loading states, source attribution badges, faster perceived performance
3. **Trade license amendment completes**, apply for DLD API access
4. **AI agent scaling** — go from 20 developers to 50

**Investment:** AED 15,000-30,000 dev time

### Phase 2 (months 2-3): Pillar 2 build

1. **XML feed engine** — generic XML output system
2. **Bayut feed** (first portal — proves architecture)
3. **PropertyFinder feed** (second portal)
4. **Dubizzle + Skyloov feeds** (efficient since pattern is established)

**Investment:** AED 30,000-60,000 dev time

### Phase 3 (months 3-4): DLD APIs go live

1. **Trakheesi listing validation** — automatic permit checking before publishing
2. **Oqood off-plan registration data** — projects appear in PropPulse before public announcement
3. **Begin marketing PropPulse with "DLD-integrated" credentialing**

**Investment:** AED 30,000-50,000 dev time

### Phase 4 (months 4-6): Pillar 3 build

1. **Portal inquiry intake** (parse Bayut/PF/Dubizzle inquiry emails)
2. **Meta Lead Ads integration**
3. **Unified inbox UI**
4. **Lead routing + assignment**

**Investment:** AED 60,000-120,000 dev time

### Phase 5 (month 6+): WhatsApp + advanced

1. WhatsApp Business API integration (broker scale)
2. Google Ads lead forms
3. Advanced lead scoring
4. Mobile app considerations

**Investment:** TBD

### Total 6-month investment

**Estimate range: AED 135,000 - 265,000 in dev time + AED 5,000-15,000 in regulatory/integration costs**

(All ESTIMATES — for the investment sheet)

---

## 7. WHAT THIS MEANS FOR YOUR INVESTMENT SHEET

The investment sheet I built earlier covered Pillar 1 only. **Now needs expansion to cover all 3 pillars.**

### Suggested updates to investment sheet

**Add new tabs:**
- Tab 5: Pillar 2 — Listings Syndication costs
- Tab 6: Pillar 3 — Lead Capture costs
- Tab 7: 6-month total investment summary
- Tab 8: Revenue projection per phase (assumptions about pricing × broker adoption)

I can produce the updated sheet — but only if you want it. Otherwise we can keep the simple version.

---

## 8. ANSWERS TO YOUR THREE SPECIFIC QUESTIONS

### Q1: Does this complete the daily project feed?

**Yes, but with different freshness profiles per source:**
- Dubai Pulse: daily refresh (overnight)
- DLD APIs (Trakheesi/Oqood): real-time
- Bayut/PF (if used for listings): real-time
- Your AI agent: daily/weekly per developer (your cron)

**Combined: daily completeness for UAE off-plan + secondary market.**

Plan refresh frequency once you have the integrations running and see actual update patterns. **Don't pre-optimise.**

### Q2: Bayut/PF — listing portals not project portals

**Confirmed your understanding.** They show LISTINGS (broker-advertised properties for sale/rent) not PROJECTS (developer-built off-plan offerings).

**Different data, different sources, both needed:**
- Project data: DLD/DARI + AI agent + Reelly partnership (if pursued)
- Listing data: Bayut/PF/Dubizzle (if you want price intelligence)

You're right that brokers may have advertised THEIR inventory on Bayut/PF — those are listings, not the underlying project record.

### Q3: Outbound listing — broker advertising inventory + leads

**This is Pillar 2 + Pillar 3.** Both require dedicated build phases (Phase 2 + Phase 4 above).

**For listings:** XML feeds to Bayut, PropertyFinder, Dubizzle, Skyloov. Industry standard. 5-7 weeks to build all 4.

**For leads:** Two paths:
1. **Capture** (inbound, agnostic) — recommended for PropPlatform
2. **Generate** (outbound, marketing-budget-heavy) — recommended to defer or partner

For lead generation, suggest brokers use existing services (AgentBolt, GoDubai Portal, Bayut Pro, PF Pro) — those leads then flow into PropPlatform's Pillar 3 inbox. **Be the destination, not the source.**

---

## 9. THE BIG STRATEGIC QUESTION FOR PARTNER DISCUSSION

> *Should PropPlatform aim to be a complete UAE broker CRM (Pillars 1+2+3) or stay specialised on project intelligence (Pillar 1)?*

This is the decision that shapes:
- 6-12 month roadmap
- Investment sheet totals
- Hiring needs
- Pricing strategy
- Naming choice (specialised tool name vs platform name)
- Anchor customer expectations
- Series A pitch

**My recommendation:** Option B (complete CRM) in disciplined phases. But this is a decision for you and your colleague, not me.

---

## 10. WHAT TO DO TOMORROW

### Immediate (next 2 days):

1. **Discuss this doc with your partner** — Option A vs Option B
2. **If Option B agreed:** start Phase 0 (refactor + cron + license amendment)
3. **Update FOUNDER_CONTEXT.md** with the strategic direction decision
4. **Continue meeting capture document** (you said you're working on it)

### This week:

1. **Refactor lib/supabase.js** (30-45 min)
2. **Run PropPulse SQL queries** (20-30 min)
3. **Apply for trade license amendment** if Option B (start the clock)

### This month:

1. **Phase 1 begins** — Dubai Pulse integration
2. **Naming decision finalised** — based on Option A vs Option B choice

---

## 11. HONEST META-NOTE

This doc is intentionally large because the meeting today changed the strategic picture significantly. **A 5-paragraph reply wouldn't have done justice to what you uncovered.**

But ALSO — **don't let this doc generate panic.** Three pillars over 6 months is a reasonable sequenced plan. It's not a rushed reaction to BrokerPro. It's a disciplined extension of what you already built into a complete product.

You currently have:
- Anchor customer (Al Mansoori)
- Strong Pillar 1 (PropPulse)
- 14+ docs in /docs folder
- Multiple potential customers from today's meeting (Broker 1 & 2 favorable)
- Clear competitive intel

**You don't need to ship Pillars 2 and 3 next week. You need to DECIDE whether to ship them at all, and if yes, in what order.**

---

## APPENDIX: DATA SOURCES REFERENCED IN THIS DOC

| Source | URL |
|---|---|
| Dubai Pulse Open Data | https://www.dubaipulse.gov.ae/data/ |
| DLD API Gateway | https://dubailand.gov.ae/en/eservices/api-gateway/ |
| ADRES (Abu Dhabi DARI) | https://www.adres.ae/dari/ |
| Bayut XML Integration Guide | https://support.bayut.com/hc/en-us/articles/18984946157714/ |
| BayutAPI (RapidAPI wrapper) | https://bayutapi.dev/ |
| Ruby CRM (competitor reference) | https://www.rubycrm.ai/ |
| Behomes (competitor reference) | https://behomes.tech/ |
| Propertybase Salesforce (competitor) | https://help.propertybase.com/ |

---

*Compiled across 75 minutes of structured research after today's broker meeting. This doc represents Claude's analysis based on web research; specific costs and timelines need verification by your team before commitment.*

— For Abid Mirza · BFC · 06 May 2026

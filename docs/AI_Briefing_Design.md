# THE MORNING BRIEFING - AI AS A METADATA READER, NOT A CALCULATOR (Day 81)

## THE FOUNDER'S FRAMING
"I always wondered there will be an AI behind the app sniffing all this and reminding you - hello,
you have all this for today and weeks ahead."
And the boundary, stated by the founder and RATIFIED WITHOUT QUALIFICATION:
"NEVER on the money arithmetic. Not even telling AI everything - just the Midas touch: it READS IN
and tells the broker hey, you have something waiting."
From his ERP years: "I cannot fit a boxing glove inside the app which will punch you when you are
doing a wrong data entry, or when you have not seen this report." The app cannot FORCE attention -
but it can put the right thing in front of someone at the right moment. That is the whole feature.

## THE ARCHITECTURE THAT MAKES IT CHEAP AND TRUSTWORTHY
DO NOT send the model the book. The APP computes the signals in SQL - stale deals, expiring
reservations, unanswered developer questions, uncollected balances, proposals with no follow-up,
blocks approved but not confirmed. That is a QUERY, not a model.
The AI receives roughly fifteen lines of structured facts and does the ONE thing it is good at:
judging which THREE matter today, and saying so in a sentence a broker will act on.
SQL CALCULATES. AI READS AND PRIORITISES. Crossing that line destroys the feature.

## COST (measured shape, Sonnet)
~1,500 tokens in, ~400 out per broker per day = about $0.01.
20 brokers x 22 working days = about $4-5 per MONTH for an entire brokerage.
The naive design - "analyse my whole pipeline" - would cost roughly 50x AND BE WORSE, because a
model reasoning over raw rows hallucinates where SQL is exact.

## WHY THIS IS A REAL DIFFERENTIATOR, NOT A FEATURE CHECKBOX
Every CRM has bolted a chatbox on. Almost none have an underlying record HONEST ENOUGH TO REASON
OVER. PropCRM's doctrines - actuals only, never fabricate expected, price integrity, every act
audited - were built for correctness; their second payoff is that an agent reading this data can
be TRUSTED. Most competitors' AI is guessing over half-filled fields.
SECOND MOAT: PropPulse. An assistant that knows THIS buyer's deals AND the whole UAE inventory can
say things a deal-only assistant cannot - "he is stalled on price at Creek Harbour; three
comparable units at Grove are 4% cheaper with the same handover."

## SCOPE DISCIPLINE
"Prominent" must NOT mean AI everywhere. ONE surface that earns trust daily - the briefing on the
dashboard. Get that right and it sells the product; scatter AI across ten screens and it is noise.
WHAT WOULD KILL IT: letting the AI compute money, or crying wolf. A briefing wrong twice is
ignored forever.

## STATUS
Boarded as D12 (portfolio-level coach). The per-deal Coach exists and is deliberately BETA - it
does a limited job today. POST-TESTER work: it needs real usage to know what is worth surfacing.
Designed now so nothing gets built that undermines it.

# CONTEXT HELP - MECHANISM NOW, CONTENT LAST (Day 81, OPEN)

## THE FOUNDER'S FRAMING
"Context help should be developed as the LAST part of the project - after that, some changes we
should be able to update from OUR END."
Both halves are right, and they pull in different directions:
- CONTENT LAST, because help documents the app AS IT IS. Writing help for a screen that will be
  redesigned next month is wasted twice.
- MECHANISM NOW, because "update from our end" is a DESIGN DECISION that determines where the
  content lives - and choosing it late means rewriting rather than filling in.

## THE CHOICE
HARD-CODED IN COMPONENTS (what the app does today - field hints written into JSX):
every wording change needs a developer, a build and a deploy. Fine for a handful of hints,
unworkable for a help system.
IN THE DATABASE (recommended): a help table keyed by screen / field / topic, edited from Settings.
Wording changes without touching code. Optionally PER-COMPANY, so a brokerage can use its own
language for its own staff. This also matches a pattern the app already follows - appConfig,
Buyer Fees, role capabilities: CONFIGURATION LIVES IN THE DATABASE, NOT THE CODE.

## WHY IT MATTERS BEYOND CONVENIENCE
Day 81 surfaced the need concretely: the founder hunted for the "Record developer approval" button
("BLIND........") and described the block flow as "go there do it, come here do this, move there do
this". Help text is ONE answer to that. A CLEARER JOURNEY is a better one - see the C0 block-as-a-
deal work. Help should explain a good flow, not compensate for a confusing one.

## WHAT IS THERE TODAY
Nothing. A Tester Guide (.docx) and field-level placeholder hints. No in-app help, no tooltips
beyond those hints, no onboarding, no first-run guidance.

## DECISION NEEDED (not yet taken)
1. Database-backed help - yes or no. If yes, the table can be added cheaply at any point; what
   matters is that content authors know it exists before they start writing into components.
2. Scope: field hints only, or screen-level topics, or a searchable help surface?
3. Per-company overrides, or one set of content for every tenant?
NOT SCHEDULED. Revisit when the app stops moving - after the tester round.

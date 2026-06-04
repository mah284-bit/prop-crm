-- One-time backfill (Day 27): convert leads whose opps were ALREADY in a
-- conversion stage (Reserved/Closed Won/SPA Signed) before the auto-conversion
-- trigger existed. The trigger only fires on FUTURE stage changes, so existing
-- closed deals' leads were never converted. This backfills them once.
-- Idempotent recompute (same logic as convert_lead_to_customer) — safe to re-run.
-- Ran live 4 Jun 2026: converted 4 leads (Misbah F, Mohammed Ali, Satish Sabnis, Rajesh Haridas).
WITH agg AS (
  SELECT o.lead_id, COUNT(*) AS cnt,
         COALESCE(SUM(o.current_agreed_price),0) AS total,
         MIN(o.created_at) AS first_conv
  FROM opportunities o
  WHERE o.lead_id IS NOT NULL
    AND o.stage IN ('Reserved','Closed Won','SPA Signed')
  GROUP BY o.lead_id
)
UPDATE leads l SET
  lifecycle_stage = CASE WHEN agg.cnt >= 2 THEN 'portfolio_customer' ELSE 'customer' END,
  became_customer_at = COALESCE(l.became_customer_at, agg.first_conv, NOW()),
  portfolio_size = agg.cnt,
  total_purchases_aed = agg.total
FROM agg
WHERE l.id = agg.lead_id;

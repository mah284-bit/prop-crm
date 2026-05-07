-- Migration: Add Master Developer Agreements module
-- Date: 09 May 2026
-- Purpose: Stage 1 of 6-stage broker sales workflow
-- Spec: docs/Stage_1_Master_Agreement_Build_Spec.md

-- ============================================================
-- 1) Create pp_master_agreements table
-- ============================================================

CREATE TABLE IF NOT EXISTS pp_master_agreements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant scope
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- The relationship
  developer_id          UUID NOT NULL REFERENCES pp_developers(id) ON DELETE RESTRICT,
  developer_name        TEXT NOT NULL,

  -- Agreement identity
  agreement_title       TEXT NOT NULL,
  agreement_reference   TEXT,

  -- Commercial terms
  default_commission_pct NUMERIC(5,2) NOT NULL,
  bonus_commission_pct   NUMERIC(5,2),
  bonus_threshold        TEXT,

  -- Payment terms
  payment_terms          TEXT,
  payment_trigger        TEXT,
  payment_days           INTEGER,

  -- Discount authority
  discount_authority_pct NUMERIC(5,2),
  discount_requires_approval_above NUMERIC(5,2),

  -- Document trail
  agreement_document_url TEXT,
  agreement_document_filename TEXT,

  -- Validity period
  valid_from             DATE,
  valid_until            DATE,

  -- Audit trail
  signed_by              TEXT,
  signed_date            DATE,
  signed_on_behalf_of    TEXT,

  -- Lifecycle
  status                 TEXT NOT NULL DEFAULT 'active',
  notes                  TEXT,

  -- Timestamps
  created_at             TIMESTAMPTZ DEFAULT now(),
  created_by             UUID REFERENCES profiles(id),
  updated_at             TIMESTAMPTZ DEFAULT now(),
  updated_by             UUID REFERENCES profiles(id),

  -- Constraints
  CONSTRAINT chk_agreement_dates CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CONSTRAINT chk_default_pct_range CHECK (default_commission_pct >= 0 AND default_commission_pct <= 100),
  CONSTRAINT chk_status_values CHECK (status IN ('draft', 'active', 'expired', 'terminated'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_master_agreements_company ON pp_master_agreements(company_id);
CREATE INDEX IF NOT EXISTS idx_master_agreements_developer ON pp_master_agreements(developer_id);
CREATE INDEX IF NOT EXISTS idx_master_agreements_active ON pp_master_agreements(company_id, status) WHERE status = 'active';

-- ============================================================
-- 2) Enable Row Level Security
-- ============================================================

ALTER TABLE pp_master_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants see own agreements"
  ON pp_master_agreements
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Tenants insert own agreements"
  ON pp_master_agreements
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Tenants update own agreements"
  ON pp_master_agreements
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Tenants delete own agreements"
  ON pp_master_agreements
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- ============================================================
-- 3) Link pp_commissions to pp_master_agreements
-- ============================================================

ALTER TABLE pp_commissions
ADD COLUMN IF NOT EXISTS master_agreement_id UUID REFERENCES pp_master_agreements(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commissions_master_agreement ON pp_commissions(master_agreement_id);

-- ============================================================
-- Migration complete
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- RLS AUDIT — run this first in Supabase → SQL Editor
-- Shows which tables exist and whether RLS is enabled on each
-- ══════════════════════════════════════════════════════════════

SELECT
  t.tablename,
  t.rowsecurity AS rls_enabled,
  COUNT(p.policyname) AS policy_count,
  ARRAY_AGG(p.policyname ORDER BY p.policyname) FILTER (WHERE p.policyname IS NOT NULL) AS policies
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'activities','companies','discount_requests','lease_cheques',
    'lease_contracts','lease_opportunities','lease_payments','leases',
    'leads','maintenance','opportunities','payment_plan_templates',
    'permission_sets','profiles','project_buildings','project_categories',
    'project_units','projects','properties','rent_payments','reservations',
    'sales_contracts','sales_payments','tenants','unit_lease_pricing',
    'unit_sale_pricing','units'
  )
GROUP BY t.tablename, t.rowsecurity
ORDER BY rls_enabled, t.tablename;


-- ══════════════════════════════════════════════════════════════
-- RLS POLICIES — apply after reviewing the audit above
-- Uses the same pattern as fix-superadmin-rls.sql:
--   company_id match OR is_super_admin = true
-- Only run policies for tables where rls_enabled = false or policy_count = 0
-- ══════════════════════════════════════════════════════════════

-- Enable RLS on all tables that need it
ALTER TABLE public.activities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_cheques     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_contracts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_sets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_payments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_contracts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units             ENABLE ROW LEVEL SECURITY;

-- ── Activities ────────────────────────────────────────────────
DROP POLICY IF EXISTS "activities_company" ON public.activities;
CREATE POLICY "activities_company" ON public.activities FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Companies ─────────────────────────────────────────────────
-- Regular users see only their own company; super_admins see all
DROP POLICY IF EXISTS "companies_access" ON public.companies;
CREATE POLICY "companies_access" ON public.companies FOR ALL
  USING (
    id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Discount Requests ─────────────────────────────────────────
DROP POLICY IF EXISTS "discount_requests_company" ON public.discount_requests;
CREATE POLICY "discount_requests_company" ON public.discount_requests FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Lease Cheques ─────────────────────────────────────────────
DROP POLICY IF EXISTS "lease_cheques_company" ON public.lease_cheques;
CREATE POLICY "lease_cheques_company" ON public.lease_cheques FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Lease Contracts ───────────────────────────────────────────
DROP POLICY IF EXISTS "lease_contracts_company" ON public.lease_contracts;
CREATE POLICY "lease_contracts_company" ON public.lease_contracts FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Lease Payments ────────────────────────────────────────────
DROP POLICY IF EXISTS "lease_payments_company" ON public.lease_payments;
CREATE POLICY "lease_payments_company" ON public.lease_payments FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Leases ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "leases_company" ON public.leases;
CREATE POLICY "leases_company" ON public.leases FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Maintenance ───────────────────────────────────────────────
DROP POLICY IF EXISTS "maintenance_company" ON public.maintenance;
CREATE POLICY "maintenance_company" ON public.maintenance FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Payment Plan Templates ────────────────────────────────────
DROP POLICY IF EXISTS "payment_plan_templates_company" ON public.payment_plan_templates;
CREATE POLICY "payment_plan_templates_company" ON public.payment_plan_templates FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Permission Sets ───────────────────────────────────────────
DROP POLICY IF EXISTS "permission_sets_company" ON public.permission_sets;
CREATE POLICY "permission_sets_company" ON public.permission_sets FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Profiles ──────────────────────────────────────────────────
-- Users can always read/update their own profile.
-- Managers can see profiles in their company.
-- Super admins see all.
DROP POLICY IF EXISTS "profiles_access" ON public.profiles;
CREATE POLICY "profiles_access" ON public.profiles FOR ALL
  USING (
    id = auth.uid()
    OR company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Project Buildings ─────────────────────────────────────────
DROP POLICY IF EXISTS "project_buildings_company" ON public.project_buildings;
CREATE POLICY "project_buildings_company" ON public.project_buildings FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Project Categories ────────────────────────────────────────
DROP POLICY IF EXISTS "project_categories_company" ON public.project_categories;
CREATE POLICY "project_categories_company" ON public.project_categories FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Properties ────────────────────────────────────────────────
DROP POLICY IF EXISTS "properties_company" ON public.properties;
CREATE POLICY "properties_company" ON public.properties FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Rent Payments ─────────────────────────────────────────────
DROP POLICY IF EXISTS "rent_payments_company" ON public.rent_payments;
CREATE POLICY "rent_payments_company" ON public.rent_payments FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Reservations ──────────────────────────────────────────────
DROP POLICY IF EXISTS "reservations_company" ON public.reservations;
CREATE POLICY "reservations_company" ON public.reservations FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Sales Contracts ───────────────────────────────────────────
DROP POLICY IF EXISTS "sales_contracts_company" ON public.sales_contracts;
CREATE POLICY "sales_contracts_company" ON public.sales_contracts FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Sales Payments ────────────────────────────────────────────
DROP POLICY IF EXISTS "sales_payments_company" ON public.sales_payments;
CREATE POLICY "sales_payments_company" ON public.sales_payments FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Units (leasing) ───────────────────────────────────────────
DROP POLICY IF EXISTS "units_company" ON public.units;
CREATE POLICY "units_company" ON public.units FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- ── Verify final state ────────────────────────────────────────
SELECT
  t.tablename,
  t.rowsecurity AS rls_enabled,
  COUNT(p.policyname) AS policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
  AND t.tablename IN (
    'activities','companies','discount_requests','lease_cheques',
    'lease_contracts','lease_opportunities','lease_payments','leases',
    'leads','maintenance','opportunities','payment_plan_templates',
    'permission_sets','profiles','project_buildings','project_categories',
    'project_units','projects','properties','rent_payments','reservations',
    'sales_contracts','sales_payments','tenants','unit_lease_pricing',
    'unit_sale_pricing','units'
  )
GROUP BY t.tablename, t.rowsecurity
ORDER BY rls_enabled, t.tablename;

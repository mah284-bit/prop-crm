-- Fix RLS to allow super admin to see all companies' data
-- Run in Supabase → SQL Editor

-- Projects
DROP POLICY IF EXISTS "projects_company" ON public.projects;
CREATE POLICY "projects_company" ON public.projects FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- Project units
DROP POLICY IF EXISTS "units_company" ON public.project_units;
CREATE POLICY "units_company" ON public.project_units FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- Unit sale pricing
DROP POLICY IF EXISTS "sale_pricing_company" ON public.unit_sale_pricing;
CREATE POLICY "sale_pricing_company" ON public.unit_sale_pricing FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- Unit lease pricing  
DROP POLICY IF EXISTS "lease_pricing_company" ON public.unit_lease_pricing;
CREATE POLICY "lease_pricing_company" ON public.unit_lease_pricing FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- Leads
DROP POLICY IF EXISTS "leads_company" ON public.leads;
CREATE POLICY "leads_company" ON public.leads FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- Opportunities
DROP POLICY IF EXISTS "opportunities_company" ON public.opportunities;
CREATE POLICY "opportunities_company" ON public.opportunities FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- Tenants
DROP POLICY IF EXISTS "tenants_company" ON public.tenants;
CREATE POLICY "tenants_company" ON public.tenants FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

-- Lease opportunities
DROP POLICY IF EXISTS "lopp_company" ON public.lease_opportunities;
CREATE POLICY "lopp_company" ON public.lease_opportunities FOR ALL
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
  );

SELECT 'Super admin RLS fixed for all tables' as result;

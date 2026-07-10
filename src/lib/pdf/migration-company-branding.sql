-- Add company branding columns
ALTER TABLE companies ADD COLUMN IF NOT EXISTS company_branding JSONB DEFAULT '{"logo_url":null,"header_template":"letterhead","brand_colors":{"primary":"#0F2540","secondary":"#C9A84C"},"footer_text":"","signature_image_url":null}'::jsonb;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS pdf_template_type TEXT DEFAULT 'letterhead' CHECK (pdf_template_type IN ('letterhead','minimal','premium','custom'));

CREATE TABLE IF NOT EXISTS email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('transactional','marketing')),
  buyer_intent TEXT CHECK (buyer_intent IN ('investor','owner_occupier','hybrid','corporate','reseller',null)),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  variables JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, template_name)
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own company templates" ON email_templates FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admins can manage own company templates" ON email_templates FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin')));

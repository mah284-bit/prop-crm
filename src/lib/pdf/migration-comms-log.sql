-- Comms delivery log table
CREATE TABLE IF NOT EXISTS comms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id),
  template_id uuid REFERENCES email_templates(id),
  opportunity_id uuid REFERENCES opportunities(id),
  lead_id uuid REFERENCES leads(id),
  recipient_email TEXT,
  recipient_whatsapp TEXT,
  message_type TEXT NOT NULL CHECK (message_type IN ('email', 'whatsapp')),
  subject TEXT,
  body TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  variables_used JSONB,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE comms_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own company logs" ON comms_log
  FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admins can manage logs" ON comms_log
  FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

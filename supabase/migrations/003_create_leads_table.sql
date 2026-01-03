-- ============================================================================
-- CREATE LEADS TABLE FOR SIGNUP FORM DATA
-- ============================================================================
-- This table stores lead information from signup forms across platforms

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  business_name TEXT,
  organization_type TEXT CHECK (organization_type IN ('restaurant', 'church', 'school', 'venue', 'hospitality', 'retail', 'other')),
  role TEXT,
  locations TEXT,
  source TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_org_type ON leads(organization_type);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Enable RLS (only super admins can view)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Policy: Super admins can view all leads
CREATE POLICY "Super admins can view all leads"
  ON leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'platform_role' = 'super_admin'
    )
  );

-- Policy: Allow inserts from anyone (for form submissions)
CREATE POLICY "Anyone can insert leads"
  ON leads FOR INSERT
  WITH CHECK (true);

-- Comment describing the table
COMMENT ON TABLE leads IS 'Stores signup form submissions with organization details for lead tracking and onboarding';

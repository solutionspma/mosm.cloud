-- ============================================================================
-- ADD ORGANIZATION_TYPE TO ORGANIZATIONS TABLE
-- ============================================================================
-- Add organization_type field to organizations for templates and defaults

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'organization_type'
  ) THEN
    ALTER TABLE organizations 
    ADD COLUMN organization_type TEXT 
    CHECK (organization_type IN ('restaurant', 'church', 'school', 'venue', 'hospitality', 'retail', 'other'));
    
    CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(organization_type);
  END IF;
END $$;

COMMENT ON COLUMN organizations.organization_type IS 'Type of organization for templates, defaults, and feature flags';

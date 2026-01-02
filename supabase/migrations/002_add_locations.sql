-- ============================================================
-- PHASE F: LOCATIONS TABLE + PER-LOCATION BILLING
-- ============================================================
-- This migration adds location-scoped billing support
-- Business model: $29-$99/location/month + $250 setup fee
-- ============================================================

-- Create locations table
CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  plan_tier TEXT CHECK (plan_tier IN ('starter', 'pro', 'enterprise')) DEFAULT 'starter',
  device_limit INTEGER DEFAULT 3,
  active BOOLEAN DEFAULT true,
  setup_fee_paid BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add active_locations count to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS active_locations INTEGER DEFAULT 0;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_locations_org_id ON locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(active) WHERE active = true;

-- Update devices table to reference locations
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id);

CREATE INDEX IF NOT EXISTS idx_devices_location_id ON devices(location_id);

-- Function to update organization's active_locations count
CREATE OR REPLACE FUNCTION update_active_locations_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.active = true THEN
    UPDATE organizations 
    SET active_locations = active_locations + 1 
    WHERE id = NEW.organization_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.active = true AND NEW.active = false THEN
      UPDATE organizations 
      SET active_locations = active_locations - 1 
      WHERE id = NEW.organization_id;
    ELSIF OLD.active = false AND NEW.active = true THEN
      UPDATE organizations 
      SET active_locations = active_locations + 1 
      WHERE id = NEW.organization_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.active = true THEN
    UPDATE organizations 
    SET active_locations = active_locations - 1 
    WHERE id = OLD.organization_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update active_locations count
DROP TRIGGER IF EXISTS trigger_update_active_locations ON locations;
CREATE TRIGGER trigger_update_active_locations
AFTER INSERT OR UPDATE OR DELETE ON locations
FOR EACH ROW EXECUTE FUNCTION update_active_locations_count();

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE locations IS 'Physical locations belonging to an organization. Each location has its own device limit and billing tier.';
COMMENT ON COLUMN locations.plan_tier IS 'Billing tier: starter ($29/mo, 3 devices), pro ($99/mo, 25 devices), enterprise (custom)';
COMMENT ON COLUMN locations.setup_fee_paid IS 'Whether the $250 one-time setup fee has been paid for this location';
COMMENT ON COLUMN organizations.active_locations IS 'Count of active locations for billing purposes';

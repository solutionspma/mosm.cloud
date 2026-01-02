-- MOSM Cloud Super Admin Schema
-- Platform-wide administration for the MOSM Cloud operator
-- Run this AFTER control-plane-schema.sql

-- ============================================================
-- SUPER ADMIN USERS
-- ============================================================

-- Super admin designation (you, the platform operator)
CREATE TABLE IF NOT EXISTS super_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id),
  permissions JSONB DEFAULT '["*"]', -- All permissions by default
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================
-- PLATFORM METRICS
-- ============================================================

-- Aggregated platform stats (updated periodically)
CREATE TABLE IF NOT EXISTS platform_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_organizations INTEGER DEFAULT 0,
  total_locations INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  total_menus INTEGER DEFAULT 0,
  total_screens INTEGER DEFAULT 0,
  total_devices INTEGER DEFAULT 0,
  services_online INTEGER DEFAULT 0,
  services_degraded INTEGER DEFAULT 0,
  services_offline INTEGER DEFAULT 0,
  events_today INTEGER DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_date)
);

-- ============================================================
-- PLATFORM ALERTS
-- ============================================================

-- Platform-wide alerts for super admin
CREATE TABLE IF NOT EXISTS platform_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  alert_type TEXT NOT NULL, -- 'service_down', 'high_error_rate', 'org_inactive', etc.
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_alerts_unack 
  ON platform_alerts(acknowledged, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_alerts_org 
  ON platform_alerts(organization_id, created_at DESC);

-- ============================================================
-- RLS FOR SUPER ADMIN TABLES
-- ============================================================

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_alerts ENABLE ROW LEVEL SECURITY;

-- Only super admins can view super_admins table
CREATE POLICY "Super admin view super_admins" ON super_admins
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM super_admins)
  );

-- Only super admins can view platform metrics
CREATE POLICY "Super admin view metrics" ON platform_metrics
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM super_admins)
  );

-- Only super admins can view platform alerts
CREATE POLICY "Super admin view alerts" ON platform_alerts
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM super_admins)
  );

CREATE POLICY "Super admin update alerts" ON platform_alerts
  FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM super_admins)
  );

-- ============================================================
-- HELPER FUNCTION: Check if user is super admin
-- ============================================================

CREATE OR REPLACE FUNCTION is_super_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins WHERE user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNCTION: Compute Platform Metrics
-- ============================================================

CREATE OR REPLACE FUNCTION compute_platform_metrics()
RETURNS void AS $$
DECLARE
  v_orgs INTEGER;
  v_locations INTEGER;
  v_users INTEGER;
  v_menus INTEGER;
  v_screens INTEGER;
  v_devices INTEGER;
  v_online INTEGER;
  v_degraded INTEGER;
  v_offline INTEGER;
  v_events INTEGER;
BEGIN
  -- Count totals
  SELECT COUNT(*) INTO v_orgs FROM organizations;
  SELECT COUNT(*) INTO v_locations FROM locations;
  SELECT COUNT(*) INTO v_users FROM users;
  SELECT COUNT(*) INTO v_menus FROM menus;
  SELECT COUNT(*) INTO v_screens FROM screens;
  SELECT COUNT(*) INTO v_devices FROM devices;
  
  -- Service health
  SELECT COUNT(*) INTO v_online FROM service_registry WHERE status = 'online';
  SELECT COUNT(*) INTO v_degraded FROM service_registry WHERE status = 'degraded';
  SELECT COUNT(*) INTO v_offline FROM service_registry WHERE status = 'offline';
  
  -- Events today
  SELECT COUNT(*) INTO v_events FROM event_log 
  WHERE timestamp >= CURRENT_DATE;
  
  -- Upsert metrics
  INSERT INTO platform_metrics (
    metric_date, total_organizations, total_locations, total_users,
    total_menus, total_screens, total_devices,
    services_online, services_degraded, services_offline,
    events_today, computed_at
  ) VALUES (
    CURRENT_DATE, v_orgs, v_locations, v_users,
    v_menus, v_screens, v_devices,
    v_online, v_degraded, v_offline,
    v_events, NOW()
  )
  ON CONFLICT (metric_date) DO UPDATE SET
    total_organizations = EXCLUDED.total_organizations,
    total_locations = EXCLUDED.total_locations,
    total_users = EXCLUDED.total_users,
    total_menus = EXCLUDED.total_menus,
    total_screens = EXCLUDED.total_screens,
    total_devices = EXCLUDED.total_devices,
    services_online = EXCLUDED.services_online,
    services_degraded = EXCLUDED.services_degraded,
    services_offline = EXCLUDED.services_offline,
    events_today = EXCLUDED.events_today,
    computed_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- GRANT SUPER ADMIN ACCESS TO VIEW ALL TABLES
-- (Override RLS for super admins)
-- ============================================================

-- Create policies for super admins to view ALL data
CREATE POLICY "Super admin view all organizations" ON organizations
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admin view all locations" ON locations
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admin view all users" ON users
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admin view all menus" ON menus
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admin view all screens" ON screens
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admin view all devices" ON devices
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admin view all service_registry" ON service_registry
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admin view all event_log" ON event_log
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admin view all rollouts" ON rollouts
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admin view all audit_log" ON audit_log
  FOR SELECT USING (is_super_admin());

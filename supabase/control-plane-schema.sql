-- MOSM Cloud Control Plane Schema Extensions
-- Run this AFTER the base schema.sql

-- ============================================================
-- SERVICE REGISTRY (Step 1)
-- ============================================================

-- Service registry table - tracks MOD OS, POS-Lite, KDS instances
CREATE TABLE IF NOT EXISTS service_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id TEXT NOT NULL, -- 'modos-menus', 'pos-lite', 'kds'
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL, -- unique instance identifier
  base_url TEXT,
  status TEXT DEFAULT 'unknown' CHECK (status IN ('online', 'degraded', 'offline', 'unknown')),
  version TEXT,
  last_heartbeat TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(service_id, location_id, instance_id)
);

-- Index for fast heartbeat lookups
CREATE INDEX IF NOT EXISTS idx_service_registry_lookup 
  ON service_registry(service_id, location_id);
CREATE INDEX IF NOT EXISTS idx_service_registry_status 
  ON service_registry(status);
CREATE INDEX IF NOT EXISTS idx_service_registry_heartbeat 
  ON service_registry(last_heartbeat);

-- ============================================================
-- CONFIGURATION (Step 2)
-- ============================================================

-- Location configuration - source of truth for MOD OS
CREATE TABLE IF NOT EXISTS location_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  active_menu_id UUID REFERENCES menus(id) ON DELETE SET NULL,
  fallback_menu_id UUID REFERENCES menus(id) ON DELETE SET NULL,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id)
);

-- Feature flags per location
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique index for feature flags (handles NULL values properly)
CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_flags_unique 
  ON feature_flags (
    COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    flag_key
  );

-- Screen assignments
CREATE TABLE IF NOT EXISTS screen_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  screen_id UUID NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  assigned_menu_id UUID REFERENCES menus(id) ON DELETE SET NULL,
  assigned_layout_id UUID REFERENCES layouts(id) ON DELETE SET NULL,
  display_mode TEXT DEFAULT 'menu' CHECK (display_mode IN ('menu', 'promotion', 'info', 'custom')),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(screen_id)
);

-- ============================================================
-- EVENT MIRRORING (Step 3)
-- ============================================================

-- Event log - stores all events from MOD OS and POS-Lite
-- This is for AUDIT ONLY - no business logic
CREATE TABLE IF NOT EXISTS event_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL, -- 'order.created', 'menu.updated', 'availability.changed'
  source_service TEXT NOT NULL, -- 'modos-menus', 'pos-lite', 'kds'
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resource_type TEXT, -- 'order', 'menu', 'item'
  resource_id TEXT,
  payload JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition-ready index for event log (high volume)
CREATE INDEX IF NOT EXISTS idx_event_log_timestamp 
  ON event_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_type 
  ON event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_log_location 
  ON event_log(location_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_org 
  ON event_log(organization_id, timestamp DESC);

-- ============================================================
-- ROLLOUT ORCHESTRATION (Step 5)
-- ============================================================

-- Rollout definitions
CREATE TABLE IF NOT EXISTS rollouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rollout_type TEXT NOT NULL CHECK (rollout_type IN ('menu_activation', 'config_update', 'feature_toggle')),
  target_locations UUID[] DEFAULT '{}',
  payload JSONB NOT NULL, -- what to deploy
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'failed', 'rolled_back')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rollout execution log per location
CREATE TABLE IF NOT EXISTS rollout_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rollout_id UUID NOT NULL REFERENCES rollouts(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG (Enhanced)
-- ============================================================

-- Detailed audit trail for compliance
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', 'permission_change'
  table_name TEXT NOT NULL,
  record_id UUID,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp 
  ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor 
  ON audit_log(actor_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_org 
  ON audit_log(organization_id, timestamp DESC);

-- ============================================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================================

ALTER TABLE service_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE screen_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE rollouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rollout_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Service registry: viewable by org members
CREATE POLICY "View org service registry" ON service_registry
  FOR SELECT USING (location_id IN (
    SELECT id FROM locations WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  ));

-- Location config: viewable by org members
CREATE POLICY "View org location config" ON location_config
  FOR SELECT USING (location_id IN (
    SELECT id FROM locations WHERE organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  ));

-- Feature flags: viewable by org members
CREATE POLICY "View org feature flags" ON feature_flags
  FOR SELECT USING (
    organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    OR location_id IN (
      SELECT id FROM locations WHERE organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Event log: viewable by org members
CREATE POLICY "View org events" ON event_log
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Rollouts: viewable by org members
CREATE POLICY "View org rollouts" ON rollouts
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

-- Audit log: viewable by org owners/managers only
CREATE POLICY "View org audit log" ON audit_log
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to update service status based on heartbeat timeout
CREATE OR REPLACE FUNCTION update_stale_services()
RETURNS void AS $$
BEGIN
  UPDATE service_registry
  SET status = 'offline', updated_at = NOW()
  WHERE status != 'offline'
    AND last_heartbeat < NOW() - INTERVAL '2 minutes';
END;
$$ LANGUAGE plpgsql;

-- Scheduled job hint (run via pg_cron or external scheduler)
-- SELECT cron.schedule('update-stale-services', '* * * * *', 'SELECT update_stale_services()');

-- Apply updated_at triggers to new tables
CREATE TRIGGER update_service_registry_updated_at 
  BEFORE UPDATE ON service_registry 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_location_config_updated_at 
  BEFORE UPDATE ON location_config 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_feature_flags_updated_at 
  BEFORE UPDATE ON feature_flags 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_screen_config_updated_at 
  BEFORE UPDATE ON screen_config 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_rollouts_updated_at 
  BEFORE UPDATE ON rollouts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

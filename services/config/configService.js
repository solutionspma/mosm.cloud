/**
 * Config Service
 * Manages location and screen configuration
 * 
 * MOSM Cloud Control Plane - Configuration (Step 2)
 * 
 * This service:
 * - Provides configuration to MOD OS, POS-Lite
 * - Is the source of truth for active menus, screen assignments
 * - Manages feature flags
 * 
 * This service does NOT:
 * - Render menus
 * - Execute menu logic
 * - Modify live operations
 */

import { supabaseAdmin } from '../supabase.js';

/**
 * Get full configuration for a location
 * Called by MOD OS on boot and periodically
 */
export async function getLocationConfig(locationId) {
  // Get location details
  const { data: location, error: locError } = await supabaseAdmin
    .from('locations')
    .select(`
      id,
      name,
      address,
      timezone,
      is_active,
      organization_id
    `)
    .eq('id', locationId)
    .single();
  
  if (locError) throw locError;
  if (!location) throw new Error('Location not found');
  
  // Get location config
  const { data: config } = await supabaseAdmin
    .from('location_config')
    .select(`
      active_menu_id,
      fallback_menu_id,
      config
    `)
    .eq('location_id', locationId)
    .single();
  
  // Get active menu details if exists
  let activeMenu = null;
  if (config?.active_menu_id) {
    const { data: menu } = await supabaseAdmin
      .from('menus')
      .select('id, name, version, status, metadata')
      .eq('id', config.active_menu_id)
      .single();
    activeMenu = menu;
  }
  
  // Get feature flags for this location
  const { data: flags } = await supabaseAdmin
    .from('feature_flags')
    .select('flag_key, enabled, config')
    .or(`location_id.eq.${locationId},organization_id.eq.${location.organization_id}`);
  
  // Convert flags array to object
  const featureFlags = {};
  for (const flag of (flags || [])) {
    featureFlags[flag.flag_key] = {
      enabled: flag.enabled,
      config: flag.config
    };
  }
  
  return {
    location: {
      id: location.id,
      name: location.name,
      address: location.address,
      timezone: location.timezone,
      isActive: location.is_active,
      organizationId: location.organization_id
    },
    activeMenu,
    fallbackMenuId: config?.fallback_menu_id || null,
    config: config?.config || {},
    featureFlags,
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Get screen configuration for a location
 * Called by MOD OS to know which menus/layouts to display
 */
export async function getScreenConfig(locationId) {
  // Get all screens for devices at this location
  const { data: screens, error } = await supabaseAdmin
    .from('screens')
    .select(`
      id,
      name,
      screen_index,
      resolution,
      orientation,
      assigned_layout_id,
      position,
      devices!inner(
        id,
        name,
        location_id,
        status
      )
    `)
    .eq('devices.location_id', locationId);
  
  if (error) throw error;
  
  // Get screen config overrides
  const { data: configs } = await supabaseAdmin
    .from('screen_config')
    .select('*')
    .eq('location_id', locationId);
  
  const configMap = new Map((configs || []).map(c => [c.screen_id, c]));
  
  // Merge screen data with config
  const screensWithConfig = (screens || []).map(screen => {
    const config = configMap.get(screen.id) || {};
    return {
      id: screen.id,
      name: screen.name,
      screenIndex: screen.screen_index,
      resolution: screen.resolution,
      orientation: screen.orientation,
      position: screen.position,
      device: {
        id: screen.devices.id,
        name: screen.devices.name,
        status: screen.devices.status
      },
      assignedLayoutId: config.assigned_layout_id || screen.assigned_layout_id,
      assignedMenuId: config.assigned_menu_id || null,
      displayMode: config.display_mode || 'menu',
      config: config.config || {}
    };
  });
  
  return {
    locationId,
    screens: screensWithConfig,
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Get feature flags for a location
 * Called by POS-Lite and MOD OS
 */
export async function getFeatureFlags(locationId) {
  // Get location's org
  const { data: location } = await supabaseAdmin
    .from('locations')
    .select('organization_id')
    .eq('id', locationId)
    .single();
  
  if (!location) throw new Error('Location not found');
  
  // Get flags (location-specific override org-level)
  const { data: orgFlags } = await supabaseAdmin
    .from('feature_flags')
    .select('flag_key, enabled, config')
    .eq('organization_id', location.organization_id);
  
  const { data: locFlags } = await supabaseAdmin
    .from('feature_flags')
    .select('flag_key, enabled, config')
    .eq('location_id', locationId);
  
  // Merge: location overrides org
  const flags = {};
  for (const flag of (orgFlags || [])) {
    flags[flag.flag_key] = { enabled: flag.enabled, config: flag.config };
  }
  for (const flag of (locFlags || [])) {
    flags[flag.flag_key] = { enabled: flag.enabled, config: flag.config };
  }
  
  return {
    locationId,
    flags,
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Get menu data for a specific menu ID
 * Called by MOD OS when it needs full menu content
 */
export async function getMenuConfig(menuId) {
  const { data: menu, error } = await supabaseAdmin
    .from('menus')
    .select(`
      id,
      name,
      status,
      version,
      metadata,
      organization_id,
      layouts(
        id,
        name,
        screen_index,
        resolution,
        aspect_ratio,
        orientation,
        safe_zone,
        elements,
        background
      )
    `)
    .eq('id', menuId)
    .single();
  
  if (error) throw error;
  if (!menu) throw new Error('Menu not found');
  
  return {
    menu: {
      id: menu.id,
      name: menu.name,
      status: menu.status,
      version: menu.version,
      metadata: menu.metadata,
      organizationId: menu.organization_id
    },
    layouts: menu.layouts || [],
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Update location configuration (admin only)
 */
export async function updateLocationConfig(locationId, updates) {
  const { data, error } = await supabaseAdmin
    .from('location_config')
    .upsert({
      location_id: locationId,
      ...updates,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'location_id'
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Set feature flag
 */
export async function setFeatureFlag(flagKey, enabled, options = {}) {
  const { locationId, organizationId, config = {} } = options;
  
  if (!locationId && !organizationId) {
    throw new Error('Must specify locationId or organizationId');
  }
  
  const { data, error } = await supabaseAdmin
    .from('feature_flags')
    .upsert({
      flag_key: flagKey,
      enabled,
      location_id: locationId || null,
      organization_id: organizationId || null,
      config,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export default {
  getLocationConfig,
  getScreenConfig,
  getFeatureFlags,
  getMenuConfig,
  updateLocationConfig,
  setFeatureFlag
};

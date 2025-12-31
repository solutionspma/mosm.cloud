/**
 * MOSM Config API
 * Read-only configuration endpoints for MOD OS and POS-Lite
 * 
 * Routes:
 * GET /api/mosm/config/location/:id - Get location configuration
 * GET /api/mosm/config/screens/:location_id - Get screen configuration
 * GET /api/mosm/config/features/:location_id - Get feature flags
 * GET /api/mosm/config/menu/:menu_id - Get menu configuration
 * 
 * These endpoints are READ-ONLY for consuming services.
 * MOD OS Menus reads config on boot, caches locally.
 * POS-Lite reads feature flags only.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Service-Key'
};

/**
 * Validate service key or user auth
 */
async function validateAuth(event) {
  // Check service key first (for service-to-service calls)
  const serviceKey = event.headers['x-service-key'];
  if (serviceKey && serviceKey === process.env.MOSM_SERVICE_KEY) {
    return { valid: true, type: 'service' };
  }
  
  // Check user auth
  const authHeader = event.headers.authorization;
  if (!authHeader) return { valid: false };
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) return { valid: false };
  
  const { data: userProfile } = await supabaseAdmin
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  
  return { 
    valid: true, 
    type: 'user',
    user, 
    organizationId: userProfile?.organization_id,
    role: userProfile?.role
  };
}

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  // Only GET requests allowed
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed. Config API is read-only.' })
    };
  }
  
  const path = event.path
    .replace('/.netlify/functions/mosm-config', '')
    .replace('/api/mosm/config', '');
  
  try {
    // Validate auth
    const auth = await validateAuth(event);
    if (!auth.valid) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }
    
    // =====================================================
    // GET /location/:id - Full location configuration
    // =====================================================
    const locationMatch = path.match(/^\/location\/([^/]+)$/);
    if (locationMatch) {
      const locationId = locationMatch[1];
      
      // Get location details
      const { data: location, error: locError } = await supabaseAdmin
        .from('locations')
        .select(`
          id, name, address, timezone, is_active, organization_id
        `)
        .eq('id', locationId)
        .single();
      
      if (locError || !location) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Location not found' })
        };
      }
      
      // Get location config
      const { data: config } = await supabaseAdmin
        .from('location_config')
        .select('active_menu_id, fallback_menu_id, config')
        .eq('location_id', locationId)
        .single();
      
      // Get active menu if exists
      let activeMenu = null;
      if (config?.active_menu_id) {
        const { data: menu } = await supabaseAdmin
          .from('menus')
          .select('id, name, version, status, metadata')
          .eq('id', config.active_menu_id)
          .single();
        activeMenu = menu;
      }
      
      // Get feature flags
      const { data: flags } = await supabaseAdmin
        .from('feature_flags')
        .select('flag_key, enabled, config')
        .or(`location_id.eq.${locationId},organization_id.eq.${location.organization_id}`);
      
      const featureFlags = {};
      for (const flag of (flags || [])) {
        featureFlags[flag.flag_key] = { enabled: flag.enabled, config: flag.config };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
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
        })
      };
    }
    
    // =====================================================
    // GET /screens/:location_id - Screen configuration
    // =====================================================
    const screensMatch = path.match(/^\/screens\/([^/]+)$/);
    if (screensMatch) {
      const locationId = screensMatch[1];
      
      // Get all screens for devices at this location
      const { data: screens, error } = await supabaseAdmin
        .from('screens')
        .select(`
          id, name, screen_index, resolution, orientation,
          assigned_layout_id, position,
          devices!inner(id, name, location_id, status)
        `)
        .eq('devices.location_id', locationId);
      
      if (error) throw error;
      
      // Get screen config overrides
      const { data: configs } = await supabaseAdmin
        .from('screen_config')
        .select('*')
        .eq('location_id', locationId);
      
      const configMap = new Map((configs || []).map(c => [c.screen_id, c]));
      
      const screensWithConfig = (screens || []).map(screen => {
        const cfg = configMap.get(screen.id) || {};
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
          assignedLayoutId: cfg.assigned_layout_id || screen.assigned_layout_id,
          assignedMenuId: cfg.assigned_menu_id || null,
          displayMode: cfg.display_mode || 'menu',
          config: cfg.config || {}
        };
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          locationId,
          screens: screensWithConfig,
          fetchedAt: new Date().toISOString()
        })
      };
    }
    
    // =====================================================
    // GET /features/:location_id - Feature flags
    // =====================================================
    const featuresMatch = path.match(/^\/features\/([^/]+)$/);
    if (featuresMatch) {
      const locationId = featuresMatch[1];
      
      // Get location's org
      const { data: location } = await supabaseAdmin
        .from('locations')
        .select('organization_id')
        .eq('id', locationId)
        .single();
      
      if (!location) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Location not found' })
        };
      }
      
      // Get flags (location-specific override org-level)
      const { data: orgFlags } = await supabaseAdmin
        .from('feature_flags')
        .select('flag_key, enabled, config')
        .eq('organization_id', location.organization_id);
      
      const { data: locFlags } = await supabaseAdmin
        .from('feature_flags')
        .select('flag_key, enabled, config')
        .eq('location_id', locationId);
      
      const flags = {};
      for (const flag of (orgFlags || [])) {
        flags[flag.flag_key] = { enabled: flag.enabled, config: flag.config };
      }
      for (const flag of (locFlags || [])) {
        flags[flag.flag_key] = { enabled: flag.enabled, config: flag.config };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          locationId,
          flags,
          fetchedAt: new Date().toISOString()
        })
      };
    }
    
    // =====================================================
    // GET /menu/:menu_id - Menu configuration
    // =====================================================
    const menuMatch = path.match(/^\/menu\/([^/]+)$/);
    if (menuMatch) {
      const menuId = menuMatch[1];
      
      const { data: menu, error } = await supabaseAdmin
        .from('menus')
        .select(`
          id, name, status, version, metadata, organization_id,
          layouts(
            id, name, screen_index, resolution, aspect_ratio,
            orientation, safe_zone, elements, background
          )
        `)
        .eq('id', menuId)
        .single();
      
      if (error || !menu) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Menu not found' })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
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
        })
      };
    }
    
    // Route not found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };
    
  } catch (error) {
    console.error('MOSM Config error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

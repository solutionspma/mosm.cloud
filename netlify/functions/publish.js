/**
 * Publish API Endpoint
 * 
 * Routes:
 * POST   /api/publish/menu/:menuId    - Publish a menu
 * GET    /api/publish/device/:deviceId - Get published content for device
 * POST   /api/publish/ack/:deviceId    - Acknowledge update received
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/**
 * Get user from authorization header
 */
async function getUser(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  const path = event.path.replace('/.netlify/functions/publish', '').replace('/api/publish', '');
  const method = event.httpMethod;
  
  try {
    const user = await getUser(event.headers.authorization);
    
    let body = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }
    
    // POST /publish/menu/:menuId - Publish a menu
    if (method === 'POST' && path.startsWith('/menu/')) {
      const menuId = path.replace('/menu/', '');
      
      // 1. Get the menu
      const { data: menu, error: menuError } = await supabase
        .from('menus')
        .select('*')
        .eq('id', menuId)
        .single();
      
      if (menuError) throw menuError;
      
      // 2. Get all layouts for the menu
      const { data: layouts, error: layoutError } = await supabase
        .from('layouts')
        .select('*')
        .eq('menu_id', menuId);
      
      if (layoutError) throw layoutError;
      
      if (!layouts || layouts.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Menu has no layouts to publish' })
        };
      }
      
      // 3. Update menu status to published
      const { data: publishedMenu, error: publishError } = await supabase
        .from('menus')
        .update({
          status: 'published',
          last_published_at: new Date().toISOString(),
          last_published_by: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', menuId)
        .select()
        .single();
      
      if (publishError) throw publishError;
      
      // 4. Create publish history record
      const { data: publishRecord } = await supabase
        .from('publish_history')
        .insert({
          menu_id: menuId,
          version: publishedMenu.version,
          published_by: user?.id,
          layout_count: layouts.length,
          published_at: new Date().toISOString()
        })
        .select()
        .single();
      
      // 5. Find and mark affected devices
      const { data: screens } = await supabase
        .from('screens')
        .select(`*, device:devices(*)`)
        .in('assigned_layout_id', layouts.map(l => l.id));
      
      let affectedDevices = 0;
      if (screens && screens.length > 0) {
        const deviceIds = [...new Set(screens.map(s => s.device?.id).filter(Boolean))];
        affectedDevices = deviceIds.length;
        
        await supabase
          .from('devices')
          .update({ 
            needs_update: true,
            last_update_pushed: new Date().toISOString()
          })
          .in('id', deviceIds);
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          menu: publishedMenu,
          publishRecord,
          affectedDevices
        })
      };
    }
    
    // GET /publish/device/:deviceId - Get published content for device
    if (method === 'GET' && path.startsWith('/device/')) {
      const deviceId = path.replace('/device/', '');
      
      // Get device with screens and their assigned layouts
      const { data: screens, error } = await supabase
        .from('screens')
        .select(`
          *,
          layout:layouts (
            *,
            menu:menus (id, status, version, name)
          )
        `)
        .eq('device_id', deviceId)
        .order('screen_index');
      
      if (error) throw error;
      
      // Filter to only published menus
      const publishedScreens = screens
        .filter(s => s.layout && s.layout.menu && s.layout.menu.status === 'published')
        .map(s => ({
          screenIndex: s.screen_index,
          resolution: s.resolution,
          orientation: s.orientation,
          layout: {
            id: s.layout.id,
            elements: s.layout.elements,
            background: s.layout.background,
            safeZone: s.layout.safe_zone,
            resolution: s.layout.resolution
          },
          menu: {
            id: s.layout.menu.id,
            name: s.layout.menu.name,
            version: s.layout.menu.version
          }
        }));
      
      // Get device fallback menu if set
      const { data: device } = await supabase
        .from('devices')
        .select('fallback_menu_id, settings')
        .eq('id', deviceId)
        .single();
      
      let fallback = null;
      if (device?.fallback_menu_id) {
        const { data: fallbackLayouts } = await supabase
          .from('layouts')
          .select('*')
          .eq('menu_id', device.fallback_menu_id)
          .order('screen_index')
          .limit(1);
        
        if (fallbackLayouts && fallbackLayouts.length > 0) {
          fallback = {
            layout: fallbackLayouts[0],
            menuId: device.fallback_menu_id
          };
        }
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          deviceId,
          timestamp: new Date().toISOString(),
          screens: publishedScreens,
          fallback,
          settings: device?.settings
        })
      };
    }
    
    // POST /publish/ack/:deviceId - Acknowledge update received
    if (method === 'POST' && path.startsWith('/ack/')) {
      const deviceId = path.replace('/ack/', '');
      
      const { error } = await supabase
        .from('devices')
        .update({
          needs_update: false,
          last_update_received: new Date().toISOString()
        })
        .eq('id', deviceId);
      
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }
    
    // Route not found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };
    
  } catch (error) {
    console.error('Publish error:', error);
    return {
      statusCode: error.status || 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

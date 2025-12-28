/**
 * Layouts API Endpoint
 * 
 * Routes:
 * GET    /api/layouts           - Get layouts (requires menuId query param)
 * POST   /api/layouts           - Create a new layout
 * GET    /api/layouts/:id       - Get a specific layout
 * PUT    /api/layouts/:id       - Update a layout
 * DELETE /api/layouts/:id       - Delete a layout
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
 * Parse layout ID from path
 */
function getLayoutId(path) {
  const match = path.match(/\/([^\/]+)/);
  return match ? match[1] : null;
}

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  const path = event.path.replace('/.netlify/functions/layouts', '').replace('/api/layouts', '');
  const method = event.httpMethod;
  
  try {
    let body = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }
    
    // GET /layouts - List layouts for a menu or organization
    if (method === 'GET' && (path === '' || path === '/')) {
      const menuId = event.queryStringParameters?.menuId;
      const organizationId = event.queryStringParameters?.organizationId;
      
      // Query by menuId if provided
      if (menuId) {
        const { data, error } = await supabase
          .from('layouts')
          .select('*')
          .eq('menu_id', menuId)
          .order('screen_index');
        
        if (error) throw error;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ layouts: data })
        };
      }
      
      // Query by organizationId - get all layouts for all menus in org
      if (organizationId) {
        // First get all menus in this organization
        const { data: menus, error: menusError } = await supabase
          .from('menus')
          .select('id, name')
          .eq('organization_id', organizationId);
        
        if (menusError) throw menusError;
        
        if (!menus || menus.length === 0) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ layouts: [] })
          };
        }
        
        const menuIds = menus.map(m => m.id);
        const menuMap = Object.fromEntries(menus.map(m => [m.id, m.name]));
        
        const { data, error } = await supabase
          .from('layouts')
          .select('*')
          .in('menu_id', menuIds)
          .order('screen_index');
        
        if (error) throw error;
        
        // Add menu name to each layout for display
        const layoutsWithMenuName = (data || []).map(l => ({
          ...l,
          menu_name: menuMap[l.menu_id] || 'Unknown'
        }));
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ layouts: layoutsWithMenuName })
        };
      }
      
      // No filter provided - return empty array (safer than error for UI)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ layouts: [] })
      };
    }
    
    // POST /layouts - Create layout
    if (method === 'POST' && (path === '' || path === '/')) {
      const { 
        menuId, 
        screenIndex, 
        name, 
        resolution, 
        aspectRatio, 
        orientation,
        safeZone,
        elements,
        background
      } = body;
      
      if (!menuId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'menuId is required' })
        };
      }
      
      const { data, error } = await supabase
        .from('layouts')
        .insert({
          menu_id: menuId,
          screen_index: screenIndex || 1,
          name: name || `Screen ${screenIndex || 1}`,
          resolution: resolution || '1920x1080',
          aspect_ratio: aspectRatio || '16:9',
          orientation: orientation || 'landscape',
          safe_zone: safeZone || 'tv_1080p',
          elements: elements || [],
          background: background || { type: 'color', value: '#000000' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ layout: data })
      };
    }
    
    // Check for layout ID routes
    const layoutId = getLayoutId(path);
    
    if (layoutId) {
      // GET /layouts/:id
      if (method === 'GET') {
        const { data, error } = await supabase
          .from('layouts')
          .select('*')
          .eq('id', layoutId)
          .single();
        
        if (error) throw error;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ layout: data })
        };
      }
      
      // PUT /layouts/:id
      if (method === 'PUT') {
        const updateData = { updated_at: new Date().toISOString() };
        
        // Copy allowed fields
        if (body.name !== undefined) updateData.name = body.name;
        if (body.resolution !== undefined) updateData.resolution = body.resolution;
        if (body.orientation !== undefined) updateData.orientation = body.orientation;
        if (body.elements !== undefined) updateData.elements = body.elements;
        
        // Map camelCase to snake_case
        if (body.menuId) updateData.menu_id = body.menuId;
        if (body.screenIndex !== undefined) updateData.screen_index = body.screenIndex;
        if (body.screen_index !== undefined) updateData.screen_index = body.screen_index;
        if (body.aspectRatio) updateData.aspect_ratio = body.aspectRatio;
        if (body.aspect_ratio) updateData.aspect_ratio = body.aspect_ratio;
        if (body.safeZone) updateData.safe_zone = body.safeZone;
        if (body.safe_zone) updateData.safe_zone = body.safe_zone;
        
        // Handle background - combine background_color and background_image into single JSONB
        if (body.background_color !== undefined || body.background_image !== undefined) {
          updateData.background = {
            type: body.background_image ? 'image' : 'color',
            value: body.background_image || body.background_color || '#000000',
            color: body.background_color || '#000000'
          };
        } else if (body.background !== undefined) {
          updateData.background = body.background;
        }
        
        const { data, error } = await supabase
          .from('layouts')
          .update(updateData)
          .eq('id', layoutId)
          .select()
          .single();
        
        if (error) throw error;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ layout: data })
        };
      }
      
      // DELETE /layouts/:id
      if (method === 'DELETE') {
        const { error } = await supabase
          .from('layouts')
          .delete()
          .eq('id', layoutId);
        
        if (error) throw error;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Layout deleted' })
        };
      }
    }
    
    // Route not found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };
    
  } catch (error) {
    console.error('Layouts error:', error);
    return {
      statusCode: error.status || 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

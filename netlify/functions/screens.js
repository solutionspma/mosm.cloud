/**
 * Screens API Endpoint
 * 
 * Routes:
 * GET    /api/screens              - Get screens (requires deviceId query param)
 * POST   /api/screens              - Create a new screen
 * GET    /api/screens/:id          - Get a specific screen
 * PUT    /api/screens/:id          - Update a screen
 * DELETE /api/screens/:id          - Delete a screen
 * PUT    /api/screens/:id/assign   - Assign layout to screen
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
 * Parse screen ID from path
 */
function getScreenId(path) {
  const match = path.match(/\/([^\/]+)/);
  return match ? match[1] : null;
}

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  const path = event.path.replace('/.netlify/functions/screens', '').replace('/api/screens', '');
  const method = event.httpMethod;
  
  try {
    let body = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }
    
    // GET /screens - List screens for a device
    if (method === 'GET' && (path === '' || path === '/')) {
      const deviceId = event.queryStringParameters?.deviceId;
      
      if (!deviceId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'deviceId query parameter is required' })
        };
      }
      
      const { data, error } = await supabase
        .from('screens')
        .select(`*, layout:layouts(*)`)
        .eq('device_id', deviceId)
        .order('screen_index');
      
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ screens: data })
      };
    }
    
    // POST /screens - Create screen
    if (method === 'POST' && (path === '' || path === '/')) {
      const { 
        deviceId, 
        screenIndex, 
        name, 
        resolution, 
        orientation,
        position
      } = body;
      
      if (!deviceId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'deviceId is required' })
        };
      }
      
      const { data, error } = await supabase
        .from('screens')
        .insert({
          device_id: deviceId,
          screen_index: screenIndex || 1,
          name: name || `Screen ${screenIndex || 1}`,
          resolution: resolution || '1920x1080',
          orientation: orientation || 'landscape',
          position: position || { x: 0, y: 0, row: 1, column: screenIndex || 1 },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ screen: data })
      };
    }
    
    // Check for screen ID routes
    const screenId = getScreenId(path);
    
    if (screenId) {
      // PUT /screens/:id/assign - Assign layout
      if (method === 'PUT' && path.endsWith('/assign')) {
        const { layoutId } = body;
        
        const { data, error } = await supabase
          .from('screens')
          .update({
            assigned_layout_id: layoutId || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', screenId.replace('/assign', ''))
          .select()
          .single();
        
        if (error) throw error;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ screen: data })
        };
      }
      
      // GET /screens/:id
      if (method === 'GET') {
        const { data, error } = await supabase
          .from('screens')
          .select(`*, layout:layouts(*)`)
          .eq('id', screenId)
          .single();
        
        if (error) throw error;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ screen: data })
        };
      }
      
      // PUT /screens/:id
      if (method === 'PUT' && !path.endsWith('/assign')) {
        const updateData = { ...body, updated_at: new Date().toISOString() };
        
        // Map camelCase to snake_case
        if (body.deviceId) updateData.device_id = body.deviceId;
        if (body.screenIndex) updateData.screen_index = body.screenIndex;
        if (body.assignedLayoutId !== undefined) updateData.assigned_layout_id = body.assignedLayoutId;
        
        // Remove camelCase versions
        delete updateData.deviceId;
        delete updateData.screenIndex;
        delete updateData.assignedLayoutId;
        
        const { data, error } = await supabase
          .from('screens')
          .update(updateData)
          .eq('id', screenId)
          .select()
          .single();
        
        if (error) throw error;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ screen: data })
        };
      }
      
      // DELETE /screens/:id
      if (method === 'DELETE') {
        const { error } = await supabase
          .from('screens')
          .delete()
          .eq('id', screenId);
        
        if (error) throw error;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Screen deleted' })
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
    console.error('Screens error:', error);
    return {
      statusCode: error.status || 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * Menus API Endpoint
 * 
 * Routes:
 * GET    /api/menus           - Get all menus for organization
 * POST   /api/menus           - Create a new menu
 * GET    /api/menus/:id       - Get a specific menu
 * PUT    /api/menus/:id       - Update a menu
 * DELETE /api/menus/:id       - Delete (archive) a menu
 * POST   /api/menus/:id/publish - Publish a menu
 * POST   /api/menus/:id/duplicate - Duplicate a menu
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
 * Extract user from authorization header
 */
async function getUser(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

/**
 * Parse menu ID from path
 */
function getMenuId(path) {
  const match = path.match(/\/([^\/]+)/);
  return match ? match[1] : null;
}

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  const path = event.path.replace('/.netlify/functions/menus', '').replace('/api/menus', '');
  const method = event.httpMethod;
  
  try {
    // Get authenticated user
    const user = await getUser(event.headers.authorization);
    
    let body = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }
    
    // GET /menus - List all menus
    if (method === 'GET' && (path === '' || path === '/')) {
      const organizationId = event.queryStringParameters?.organizationId;
      const status = event.queryStringParameters?.status;
      
      let query = supabase.from('menus').select('*');
      
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }
      
      if (status) {
        query = query.eq('status', status);
      } else {
        query = query.neq('status', 'archived');
      }
      
      query = query.order('updated_at', { ascending: false });
      
      const { data, error } = await query;
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ menus: data })
      };
    }
    
    // POST /menus - Create menu
    if (method === 'POST' && (path === '' || path === '/')) {
      const { name, organizationId, tags, metadata } = body;
      
      console.log('CREATE MENU - Request body:', JSON.stringify(body));
      console.log('CREATE MENU - User:', user?.id);
      console.log('CREATE MENU - Organization ID:', organizationId);
      
      if (!name) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Menu name is required' })
        };
      }
      
      const insertData = {
        name,
        status: 'draft',
        version: 1,
        organization_id: organizationId,
        created_by: user?.id,
        last_edited_by: user?.id,
        tags: tags || [],
        metadata: metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      console.log('CREATE MENU - Insert data:', JSON.stringify(insertData));
      
      const { data, error } = await supabase
        .from('menus')
        .insert(insertData)
        .select()
        .single();
      
      console.log('CREATE MENU - Result:', JSON.stringify({ data, error }));
      
      if (error) throw error;
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ menu: data })
      };
    }
    
    // Check for menu ID routes
    const menuId = getMenuId(path);
    
    if (menuId) {
      // POST /menus/:id/publish
      if (method === 'POST' && path.endsWith('/publish')) {
        const { data: menu, error: fetchError } = await supabase
          .from('menus')
          .select('*')
          .eq('id', menuId)
          .single();
        
        if (fetchError) throw fetchError;
        
        const { data, error } = await supabase
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
        
        if (error) throw error;
        
        // Create publish history record
        await supabase.from('publish_history').insert({
          menu_id: menuId,
          version: data.version,
          published_by: user?.id,
          published_at: new Date().toISOString()
        });
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ menu: data, message: 'Menu published successfully' })
        };
      }
      
      // POST /menus/:id/duplicate
      if (method === 'POST' && path.endsWith('/duplicate')) {
        const { newName } = body;
        
        // Get original menu
        const { data: original, error: fetchError } = await supabase
          .from('menus')
          .select('*')
          .eq('id', menuId)
          .single();
        
        if (fetchError) throw fetchError;
        
        // Create duplicate
        const { data: duplicate, error: createError } = await supabase
          .from('menus')
          .insert({
            name: newName || `${original.name} (Copy)`,
            status: 'draft',
            version: 1,
            organization_id: original.organization_id,
            created_by: user?.id,
            last_edited_by: user?.id,
            tags: original.tags,
            metadata: { ...original.metadata, duplicated_from: menuId },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (createError) throw createError;
        
        // Duplicate layouts
        const { data: layouts } = await supabase
          .from('layouts')
          .select('*')
          .eq('menu_id', menuId);
        
        if (layouts && layouts.length > 0) {
          const newLayouts = layouts.map(layout => ({
            menu_id: duplicate.id,
            screen_index: layout.screen_index,
            name: layout.name,
            resolution: layout.resolution,
            aspect_ratio: layout.aspect_ratio,
            orientation: layout.orientation,
            safe_zone: layout.safe_zone,
            elements: layout.elements,
            background: layout.background,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));
          
          await supabase.from('layouts').insert(newLayouts);
        }
        
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ menu: duplicate })
        };
      }
      
      // GET /menus/:id
      if (method === 'GET') {
        const { data, error } = await supabase
          .from('menus')
          .select('*')
          .eq('id', menuId)
          .single();
        
        if (error) throw error;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ menu: data })
        };
      }
      
      // PUT /menus/:id
      if (method === 'PUT') {
        // Get current version
        const { data: current } = await supabase
          .from('menus')
          .select('version')
          .eq('id', menuId)
          .single();
        
        const { data, error } = await supabase
          .from('menus')
          .update({
            ...body,
            version: (current?.version || 0) + 1,
            last_edited_by: user?.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', menuId)
          .select()
          .single();
        
        if (error) throw error;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ menu: data })
        };
      }
      
      // DELETE /menus/:id (archive)
      if (method === 'DELETE') {
        const { data, error } = await supabase
          .from('menus')
          .update({
            status: 'archived',
            updated_at: new Date().toISOString()
          })
          .eq('id', menuId)
          .select()
          .single();
        
        if (error) throw error;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ menu: data, message: 'Menu archived' })
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
    console.error('Menus error:', error);
    return {
      statusCode: error.status || 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

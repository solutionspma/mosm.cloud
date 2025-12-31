/**
 * MOSM Events API
 * Event mirroring endpoint for MOD OS and POS-Lite
 * 
 * Routes:
 * POST /api/mosm/events - Log event(s) from external services
 * GET  /api/mosm/events - Query events (requires auth)
 * GET  /api/mosm/events/summary - Get event summary for dashboard
 * GET  /api/mosm/audit - Query audit log (owners/managers only)
 * 
 * CRITICAL: This is for AUDIT ONLY.
 * MOSM does NOT act on events. MOSM only stores and observes.
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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Service-Key'
};

/**
 * Validate service key for event ingestion
 */
function validateServiceKey(event) {
  const serviceKey = event.headers['x-service-key'];
  return serviceKey && serviceKey === process.env.MOSM_SERVICE_KEY;
}

/**
 * Validate user auth
 */
async function validateUserAuth(event) {
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
  
  const path = event.path
    .replace('/.netlify/functions/mosm-events', '')
    .replace('/api/mosm', '');
  const method = event.httpMethod;
  
  try {
    // =====================================================
    // POST /events - Log event(s) from external services
    // =====================================================
    if (method === 'POST' && (path === '/events' || path === '')) {
      // Validate service key
      if (!validateServiceKey(event)) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid service key' })
        };
      }
      
      const body = JSON.parse(event.body || '{}');
      
      // Support single event or batch
      const events = Array.isArray(body) ? body : [body];
      
      // Validate events
      const validEvents = [];
      const errors = [];
      
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        if (!e.event_type || !e.source_service || !e.location_id) {
          errors.push({
            index: i,
            error: 'Missing required fields: event_type, source_service, location_id'
          });
          continue;
        }
        
        // Validate source service
        const validServices = ['modos-menus', 'pos-lite', 'kds', 'mosm-cloud'];
        if (!validServices.includes(e.source_service)) {
          errors.push({
            index: i,
            error: `Invalid source_service. Must be one of: ${validServices.join(', ')}`
          });
          continue;
        }
        
        validEvents.push({
          event_type: e.event_type,
          source_service: e.source_service,
          location_id: e.location_id,
          organization_id: e.organization_id || null,
          actor_id: e.actor_id || null,
          resource_type: e.resource_type || null,
          resource_id: e.resource_id || null,
          payload: e.payload || {},
          timestamp: e.timestamp || new Date().toISOString()
        });
      }
      
      if (validEvents.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'No valid events', errors })
        };
      }
      
      // Insert events
      const { data, error } = await supabaseAdmin
        .from('event_log')
        .insert(validEvents)
        .select();
      
      if (error) {
        console.error('Event insert error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to log events' })
        };
      }
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          success: true,
          logged: data.length,
          errors: errors.length > 0 ? errors : undefined
        })
      };
    }
    
    // =====================================================
    // GET /events - Query events
    // =====================================================
    if (method === 'GET' && (path === '/events' || path === '')) {
      const auth = await validateUserAuth(event);
      if (!auth.valid) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Unauthorized' })
        };
      }
      
      const params = event.queryStringParameters || {};
      
      let query = supabaseAdmin
        .from('event_log')
        .select('*', { count: 'exact' })
        .eq('organization_id', auth.organizationId)
        .order('timestamp', { ascending: false })
        .range(
          parseInt(params.offset) || 0,
          (parseInt(params.offset) || 0) + (parseInt(params.limit) || 100) - 1
        );
      
      if (params.event_type) {
        query = query.eq('event_type', params.event_type);
      }
      if (params.source_service) {
        query = query.eq('source_service', params.source_service);
      }
      if (params.location_id) {
        query = query.eq('location_id', params.location_id);
      }
      if (params.start_time) {
        query = query.gte('timestamp', params.start_time);
      }
      if (params.end_time) {
        query = query.lte('timestamp', params.end_time);
      }
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          events: data || [],
          total: count || 0,
          limit: parseInt(params.limit) || 100,
          offset: parseInt(params.offset) || 0
        })
      };
    }
    
    // =====================================================
    // GET /events/summary - Event summary for dashboard
    // =====================================================
    if (method === 'GET' && path === '/events/summary') {
      const auth = await validateUserAuth(event);
      if (!auth.valid) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Unauthorized' })
        };
      }
      
      const params = event.queryStringParameters || {};
      const hours = parseInt(params.hours) || 24;
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      let query = supabaseAdmin
        .from('event_log')
        .select('event_type, source_service')
        .eq('organization_id', auth.organizationId)
        .gte('timestamp', startTime);
      
      if (params.location_id) {
        query = query.eq('location_id', params.location_id);
      }
      
      const { data: events, error } = await query;
      
      if (error) throw error;
      
      // Aggregate
      const byType = {};
      const byService = {};
      
      for (const e of (events || [])) {
        byType[e.event_type] = (byType[e.event_type] || 0) + 1;
        byService[e.source_service] = (byService[e.source_service] || 0) + 1;
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          total: events?.length || 0,
          period: `${hours} hours`,
          byType,
          byService,
          startTime
        })
      };
    }
    
    // =====================================================
    // GET /audit - Query audit log (owners/managers only)
    // =====================================================
    if (method === 'GET' && path === '/audit') {
      const auth = await validateUserAuth(event);
      if (!auth.valid) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Unauthorized' })
        };
      }
      
      // Only owners and managers can view audit log
      if (!['owner', 'manager'].includes(auth.role)) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Forbidden. Audit log requires owner or manager role.' })
        };
      }
      
      const params = event.queryStringParameters || {};
      
      let query = supabaseAdmin
        .from('audit_log')
        .select('*', { count: 'exact' })
        .eq('organization_id', auth.organizationId)
        .order('timestamp', { ascending: false })
        .range(
          parseInt(params.offset) || 0,
          (parseInt(params.offset) || 0) + (parseInt(params.limit) || 100) - 1
        );
      
      if (params.actor_id) {
        query = query.eq('actor_id', params.actor_id);
      }
      if (params.table_name) {
        query = query.eq('table_name', params.table_name);
      }
      if (params.action) {
        query = query.eq('action', params.action);
      }
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          entries: data || [],
          total: count || 0,
          limit: parseInt(params.limit) || 100,
          offset: parseInt(params.offset) || 0
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
    console.error('MOSM Events error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

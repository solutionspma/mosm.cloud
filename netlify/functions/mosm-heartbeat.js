/**
 * MOSM Heartbeat API
 * Receives heartbeats from MOD OS, POS-Lite, KDS
 * 
 * Routes:
 * POST /api/mosm/heartbeat - Register service heartbeat
 * GET  /api/mosm/services - List all services (requires auth)
 * GET  /api/mosm/services/:location_id - List services for location
 * GET  /api/mosm/health - Get service health summary
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const HEARTBEAT_TIMEOUT_MS = 120000; // 2 minutes

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Service-Key'
};

/**
 * Validate service key for heartbeat endpoints
 * Services use a shared key to authenticate heartbeats
 */
function validateServiceKey(event) {
  const serviceKey = event.headers['x-service-key'];
  const validKey = process.env.MOSM_SERVICE_KEY;
  
  // Allow if service key matches OR if valid user auth token
  if (serviceKey && serviceKey === validKey) {
    return { valid: true };
  }
  
  return { valid: false };
}

/**
 * Validate user auth token
 */
async function validateUserAuth(event) {
  const authHeader = event.headers.authorization;
  if (!authHeader) return { valid: false };
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) return { valid: false };
  
  // Get user's organization
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
    .replace('/.netlify/functions/mosm-heartbeat', '')
    .replace('/api/mosm', '');
  const method = event.httpMethod;
  
  try {
    // =====================================================
    // POST /heartbeat - Record service heartbeat
    // =====================================================
    if (method === 'POST' && path === '/heartbeat') {
      // Validate service key
      const { valid } = validateServiceKey(event);
      if (!valid) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Invalid service key' })
        };
      }
      
      const body = JSON.parse(event.body || '{}');
      const { service, location_id, instance_id, status, version, base_url, metadata } = body;
      
      // Validate required fields
      if (!service || !location_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: 'Missing required fields: service, location_id' 
          })
        };
      }
      
      // Validate service type
      const validServices = ['modos-menus', 'pos-lite', 'kds'];
      if (!validServices.includes(service)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ 
            error: `Invalid service type. Must be one of: ${validServices.join(', ')}` 
          })
        };
      }
      
      const now = new Date().toISOString();
      
      // Upsert heartbeat
      const { data, error } = await supabaseAdmin
        .from('service_registry')
        .upsert({
          service_id: service,
          location_id,
          instance_id: instance_id || `${service}-${location_id}`,
          status: status || 'online',
          version: version || null,
          base_url: base_url || null,
          last_heartbeat: now,
          metadata: metadata || {},
          updated_at: now
        }, {
          onConflict: 'service_id,location_id,instance_id'
        })
        .select()
        .single();
      
      if (error) {
        console.error('Heartbeat error:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to record heartbeat' })
        };
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          service: data,
          timestamp: now
        })
      };
    }
    
    // =====================================================
    // GET /services - List all services for org
    // =====================================================
    if (method === 'GET' && path === '/services') {
      const auth = await validateUserAuth(event);
      if (!auth.valid) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Unauthorized' })
        };
      }
      
      const { data, error } = await supabaseAdmin
        .from('service_registry')
        .select(`
          *,
          locations!inner(
            id,
            name,
            organization_id
          )
        `)
        .eq('locations.organization_id', auth.organizationId)
        .order('service_id');
      
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ services: data || [] })
      };
    }
    
    // =====================================================
    // GET /services/:location_id - List services for location
    // =====================================================
    const servicesMatch = path.match(/^\/services\/([^/]+)$/);
    if (method === 'GET' && servicesMatch) {
      const locationId = servicesMatch[1];
      
      const auth = await validateUserAuth(event);
      if (!auth.valid) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Unauthorized' })
        };
      }
      
      const { data, error } = await supabaseAdmin
        .from('service_registry')
        .select('*')
        .eq('location_id', locationId)
        .order('service_id');
      
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ services: data || [] })
      };
    }
    
    // =====================================================
    // GET /health - Service health summary
    // =====================================================
    if (method === 'GET' && path === '/health') {
      const auth = await validateUserAuth(event);
      if (!auth.valid) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Unauthorized' })
        };
      }
      
      // Get all services for org
      const { data: services, error } = await supabaseAdmin
        .from('service_registry')
        .select(`
          *,
          locations!inner(
            id,
            name,
            organization_id
          )
        `)
        .eq('locations.organization_id', auth.organizationId);
      
      if (error) throw error;
      
      // Calculate health summary
      const now = Date.now();
      const summary = {
        total: services?.length || 0,
        online: 0,
        degraded: 0,
        offline: 0,
        unknown: 0,
        byService: {},
        byLocation: {}
      };
      
      for (const service of (services || [])) {
        const lastHeartbeat = new Date(service.last_heartbeat).getTime();
        const isStale = (now - lastHeartbeat) > HEARTBEAT_TIMEOUT_MS;
        const effectiveStatus = isStale ? 'offline' : service.status;
        
        summary[effectiveStatus]++;
        
        if (!summary.byService[service.service_id]) {
          summary.byService[service.service_id] = { online: 0, degraded: 0, offline: 0, unknown: 0 };
        }
        summary.byService[service.service_id][effectiveStatus]++;
        
        const locId = service.location_id;
        if (!summary.byLocation[locId]) {
          summary.byLocation[locId] = { 
            name: service.locations?.name || 'Unknown',
            services: []
          };
        }
        summary.byLocation[locId].services.push({
          service: service.service_id,
          status: effectiveStatus,
          version: service.version,
          lastHeartbeat: service.last_heartbeat
        });
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ health: summary })
      };
    }
    
    // Route not found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };
    
  } catch (error) {
    console.error('MOSM Heartbeat error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

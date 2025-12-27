/**
 * Devices API Endpoint
 * 
 * Routes:
 * GET    /api/devices              - Get all devices for organization
 * POST   /api/devices/register     - Register a new device
 * POST   /api/devices/heartbeat    - Device heartbeat
 * GET    /api/devices/:id          - Get a specific device
 * PUT    /api/devices/:id          - Update a device
 * DELETE /api/devices/:id          - Delete a device
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

const HEARTBEAT_TIMEOUT_MS = 60000; // 60 seconds

/**
 * Check if device is online based on last heartbeat
 */
function getDeviceStatus(lastHeartbeat) {
  if (!lastHeartbeat) return 'unknown';
  const lastBeat = new Date(lastHeartbeat).getTime();
  const now = Date.now();
  return (now - lastBeat) < HEARTBEAT_TIMEOUT_MS ? 'online' : 'offline';
}

/**
 * Parse device ID from path
 */
function getDeviceId(path) {
  const match = path.match(/\/([^\/]+)$/);
  return match ? match[1] : null;
}

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  const path = event.path.replace('/.netlify/functions/devices', '').replace('/api/devices', '');
  const method = event.httpMethod;
  
  try {
    let body = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }
    
    // GET /devices - List all devices
    if (method === 'GET' && (path === '' || path === '/')) {
      const organizationId = event.queryStringParameters?.organizationId;
      
      let query = supabase
        .from('devices')
        .select(`*, screens(*)`);
      
      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }
      
      query = query.order('name');
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Update status based on heartbeat
      const devices = data.map(device => ({
        ...device,
        status: getDeviceStatus(device.last_heartbeat)
      }));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ devices })
      };
    }
    
    // POST /devices/register - Register new device
    if (method === 'POST' && path === '/register') {
      const { 
        name, 
        organizationId, 
        locationId,
        location,
        ipAddress,
        macAddress,
        osVersion,
        appVersion,
        screenCount
      } = body;
      
      if (!name || !organizationId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'name and organizationId are required' })
        };
      }
      
      const { data: device, error } = await supabase
        .from('devices')
        .insert({
          name,
          organization_id: organizationId,
          location_id: locationId || null,
          location: location || '',
          status: 'online',
          last_heartbeat: new Date().toISOString(),
          ip_address: ipAddress || '',
          mac_address: macAddress || null,
          os_version: osVersion || null,
          app_version: appVersion || null,
          settings: { autoUpdate: true, brightness: 100, volume: 50 },
          registered_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Create default screens if screenCount provided
      if (screenCount && screenCount > 0) {
        const screens = [];
        for (let i = 1; i <= screenCount; i++) {
          screens.push({
            device_id: device.id,
            screen_index: i,
            name: `Screen ${i}`,
            resolution: '1920x1080',
            orientation: 'landscape',
            position: { x: 0, y: 0, row: 1, column: i },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
        
        await supabase.from('screens').insert(screens);
      }
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ device })
      };
    }
    
    // POST /devices - Self-register from player (with pairing code)
    if (method === 'POST' && (path === '' || path === '/')) {
      const { deviceId, pairingCode, name, status, deviceInfo } = body;
      
      if (!deviceId || !pairingCode) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'deviceId and pairingCode are required' })
        };
      }
      
      // Check if device already exists
      const { data: existing } = await supabase
        .from('devices')
        .select('id')
        .eq('id', deviceId)
        .single();
      
      if (existing) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Device already registered', deviceId })
        };
      }
      
      // Create pending device (needs to be claimed by org)
      const { data: device, error } = await supabase
        .from('devices')
        .insert({
          id: deviceId,
          name: name || `Device ${pairingCode}`,
          pairing_code: pairingCode,
          status: status || 'pending',
          device_info: deviceInfo || {},
          last_heartbeat: new Date().toISOString(),
          registered_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ device })
      };
    }
    
    // POST /devices/heartbeat - Device heartbeat
    if (method === 'POST' && path === '/heartbeat') {
      const { deviceId, ipAddress, osVersion, appVersion, status } = body;
      
      if (!deviceId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'deviceId is required' })
        };
      }
      
      const { data, error } = await supabase
        .from('devices')
        .update({
          status: 'online',
          last_heartbeat: new Date().toISOString(),
          ip_address: ipAddress,
          os_version: osVersion,
          app_version: appVersion,
          updated_at: new Date().toISOString()
        })
        .eq('id', deviceId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Check if device needs update
      const needsUpdate = data.needs_update || false;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          device: data, 
          needsUpdate,
          serverTime: new Date().toISOString()
        })
      };
    }
    
    // Check for device ID routes
    const deviceId = getDeviceId(path);
    
    if (deviceId && deviceId !== 'register' && deviceId !== 'heartbeat') {
      // GET /devices/:id
      if (method === 'GET') {
        const { data, error } = await supabase
          .from('devices')
          .select(`*, screens(*)`)
          .eq('id', deviceId)
          .single();
        
        if (error) throw error;
        
        // Update status
        data.status = getDeviceStatus(data.last_heartbeat);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ device: data })
        };
      }
      
      // PUT /devices/:id
      if (method === 'PUT') {
        const updateData = { ...body, updated_at: new Date().toISOString() };
        
        // Map camelCase to snake_case
        if (body.organizationId) updateData.organization_id = body.organizationId;
        if (body.locationId) updateData.location_id = body.locationId;
        if (body.ipAddress) updateData.ip_address = body.ipAddress;
        if (body.macAddress) updateData.mac_address = body.macAddress;
        if (body.osVersion) updateData.os_version = body.osVersion;
        if (body.appVersion) updateData.app_version = body.appVersion;
        if (body.fallbackMenuId) updateData.fallback_menu_id = body.fallbackMenuId;
        
        // Remove camelCase versions
        delete updateData.organizationId;
        delete updateData.locationId;
        delete updateData.ipAddress;
        delete updateData.macAddress;
        delete updateData.osVersion;
        delete updateData.appVersion;
        delete updateData.fallbackMenuId;
        
        const { data, error } = await supabase
          .from('devices')
          .update(updateData)
          .eq('id', deviceId)
          .select()
          .single();
        
        if (error) throw error;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ device: data })
        };
      }
      
      // DELETE /devices/:id
      if (method === 'DELETE') {
        // Delete screens first
        await supabase.from('screens').delete().eq('device_id', deviceId);
        
        // Delete device
        const { error } = await supabase
          .from('devices')
          .delete()
          .eq('id', deviceId);
        
        if (error) throw error;
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Device deleted' })
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
    console.error('Devices error:', error);
    return {
      statusCode: error.status || 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

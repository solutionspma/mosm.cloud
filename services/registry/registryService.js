/**
 * Registry Service
 * Manages service heartbeats and health monitoring
 * 
 * MOSM Cloud Control Plane - Service Registry (Step 1)
 * 
 * This service:
 * - Receives heartbeats from MOD OS, POS-Lite, KDS
 * - Tracks service health across all locations
 * - Provides visibility into the service mesh
 * 
 * This service does NOT:
 * - Block or modify service operations
 * - Execute business logic
 * - Control service behavior
 */

import { supabaseAdmin } from '../supabase.js';

const HEARTBEAT_TIMEOUT_MS = 120000; // 2 minutes

/**
 * Register or update a service heartbeat
 * Called by MOD OS, POS-Lite, KDS every 30-60 seconds
 */
export async function recordHeartbeat({
  service,
  locationId,
  instanceId,
  status = 'online',
  version = null,
  baseUrl = null,
  metadata = {}
}) {
  const now = new Date().toISOString();
  
  const { data, error } = await supabaseAdmin
    .from('service_registry')
    .upsert({
      service_id: service,
      location_id: locationId,
      instance_id: instanceId || `${service}-${locationId}`,
      status,
      version,
      base_url: baseUrl,
      last_heartbeat: now,
      metadata,
      updated_at: now
    }, {
      onConflict: 'service_id,location_id,instance_id'
    })
    .select()
    .single();
  
  if (error) {
    console.error('Failed to record heartbeat:', error);
    throw error;
  }
  
  return data;
}

/**
 * Get all services for a location
 */
export async function getLocationServices(locationId) {
  const { data, error } = await supabaseAdmin
    .from('service_registry')
    .select('*')
    .eq('location_id', locationId)
    .order('service_id');
  
  if (error) throw error;
  return data || [];
}

/**
 * Get all services for an organization
 */
export async function getOrganizationServices(organizationId) {
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
    .eq('locations.organization_id', organizationId)
    .order('service_id');
  
  if (error) throw error;
  return data || [];
}

/**
 * Get service health summary for dashboard
 */
export async function getServiceHealthSummary(organizationId) {
  const services = await getOrganizationServices(organizationId);
  
  const summary = {
    total: services.length,
    online: 0,
    degraded: 0,
    offline: 0,
    unknown: 0,
    byService: {},
    byLocation: {}
  };
  
  const now = Date.now();
  
  for (const service of services) {
    // Check if heartbeat is stale
    const lastHeartbeat = new Date(service.last_heartbeat).getTime();
    const isStale = (now - lastHeartbeat) > HEARTBEAT_TIMEOUT_MS;
    const effectiveStatus = isStale ? 'offline' : service.status;
    
    // Update counts
    summary[effectiveStatus]++;
    
    // Group by service type
    if (!summary.byService[service.service_id]) {
      summary.byService[service.service_id] = { online: 0, degraded: 0, offline: 0, unknown: 0 };
    }
    summary.byService[service.service_id][effectiveStatus]++;
    
    // Group by location
    const locationId = service.location_id;
    if (!summary.byLocation[locationId]) {
      summary.byLocation[locationId] = { 
        name: service.locations?.name || 'Unknown',
        services: []
      };
    }
    summary.byLocation[locationId].services.push({
      service: service.service_id,
      status: effectiveStatus,
      version: service.version,
      lastHeartbeat: service.last_heartbeat
    });
  }
  
  return summary;
}

/**
 * Get specific service instance
 */
export async function getService(serviceId, locationId, instanceId = null) {
  let query = supabaseAdmin
    .from('service_registry')
    .select('*')
    .eq('service_id', serviceId)
    .eq('location_id', locationId);
  
  if (instanceId) {
    query = query.eq('instance_id', instanceId);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return instanceId ? data?.[0] : data;
}

/**
 * Mark stale services as offline
 * Should be called periodically (e.g., every minute)
 */
export async function updateStaleServices() {
  const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS).toISOString();
  
  const { data, error } = await supabaseAdmin
    .from('service_registry')
    .update({ 
      status: 'offline',
      updated_at: new Date().toISOString()
    })
    .neq('status', 'offline')
    .lt('last_heartbeat', cutoff)
    .select();
  
  if (error) {
    console.error('Failed to update stale services:', error);
    throw error;
  }
  
  return data || [];
}

/**
 * Remove a service from registry
 */
export async function deregisterService(serviceId, locationId, instanceId) {
  const { error } = await supabaseAdmin
    .from('service_registry')
    .delete()
    .eq('service_id', serviceId)
    .eq('location_id', locationId)
    .eq('instance_id', instanceId);
  
  if (error) throw error;
  return true;
}

export default {
  recordHeartbeat,
  getLocationServices,
  getOrganizationServices,
  getServiceHealthSummary,
  getService,
  updateStaleServices,
  deregisterService
};

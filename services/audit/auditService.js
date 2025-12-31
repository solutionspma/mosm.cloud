/**
 * Audit Service
 * Handles event mirroring and audit logging
 * 
 * MOSM Cloud Control Plane - Event Mirroring (Step 3)
 * 
 * This service:
 * - Receives events from MOD OS, POS-Lite, KDS
 * - Stores events for audit and analytics
 * - Provides event query capabilities
 * 
 * This service does NOT:
 * - Act on events
 * - Trigger business logic
 * - Modify external systems
 * 
 * CRITICAL: Event storage ONLY. No mutation of live systems.
 */

import { supabaseAdmin } from '../supabase.js';

/**
 * Log an event from external service
 * Used by MOD OS, POS-Lite, KDS to mirror events
 */
export async function logEvent({
  eventType,
  sourceService,
  locationId,
  organizationId,
  actorId = null,
  resourceType = null,
  resourceId = null,
  payload = {},
  timestamp = null
}) {
  const { data, error } = await supabaseAdmin
    .from('event_log')
    .insert({
      event_type: eventType,
      source_service: sourceService,
      location_id: locationId,
      organization_id: organizationId,
      actor_id: actorId,
      resource_type: resourceType,
      resource_id: resourceId,
      payload,
      timestamp: timestamp || new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    console.error('Failed to log event:', error);
    throw error;
  }
  
  return data;
}

/**
 * Log multiple events in batch
 */
export async function logEventBatch(events) {
  const formatted = events.map(e => ({
    event_type: e.eventType,
    source_service: e.sourceService,
    location_id: e.locationId,
    organization_id: e.organizationId,
    actor_id: e.actorId || null,
    resource_type: e.resourceType || null,
    resource_id: e.resourceId || null,
    payload: e.payload || {},
    timestamp: e.timestamp || new Date().toISOString()
  }));
  
  const { data, error } = await supabaseAdmin
    .from('event_log')
    .insert(formatted)
    .select();
  
  if (error) throw error;
  return data;
}

/**
 * Query events for an organization
 */
export async function queryEvents(organizationId, options = {}) {
  const {
    eventType,
    sourceService,
    locationId,
    startTime,
    endTime,
    limit = 100,
    offset = 0
  } = options;
  
  let query = supabaseAdmin
    .from('event_log')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (eventType) {
    query = query.eq('event_type', eventType);
  }
  if (sourceService) {
    query = query.eq('source_service', sourceService);
  }
  if (locationId) {
    query = query.eq('location_id', locationId);
  }
  if (startTime) {
    query = query.gte('timestamp', startTime);
  }
  if (endTime) {
    query = query.lte('timestamp', endTime);
  }
  
  const { data, error, count } = await query;
  
  if (error) throw error;
  
  return {
    events: data || [],
    total: count || 0,
    limit,
    offset
  };
}

/**
 * Get event summary for dashboard
 */
export async function getEventSummary(organizationId, options = {}) {
  const { locationId, hours = 24 } = options;
  
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  // Get events grouped by type
  let query = supabaseAdmin
    .from('event_log')
    .select('event_type, source_service')
    .eq('organization_id', organizationId)
    .gte('timestamp', startTime);
  
  if (locationId) {
    query = query.eq('location_id', locationId);
  }
  
  const { data: events, error } = await query;
  
  if (error) throw error;
  
  // Aggregate counts
  const byType = {};
  const byService = {};
  
  for (const event of (events || [])) {
    byType[event.event_type] = (byType[event.event_type] || 0) + 1;
    byService[event.source_service] = (byService[event.source_service] || 0) + 1;
  }
  
  return {
    total: events?.length || 0,
    period: `${hours} hours`,
    byType,
    byService,
    startTime
  };
}

/**
 * Log audit trail for internal MOSM actions
 */
export async function logAuditTrail({
  action,
  tableName,
  recordId,
  actorId,
  actorRole,
  organizationId,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null
}) {
  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .insert({
      action,
      table_name: tableName,
      record_id: recordId,
      actor_id: actorId,
      actor_role: actorRole,
      organization_id: organizationId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: ipAddress,
      user_agent: userAgent
    })
    .select()
    .single();
  
  if (error) {
    console.error('Failed to log audit trail:', error);
    // Don't throw - audit logging should not break operations
    return null;
  }
  
  return data;
}

/**
 * Query audit log
 */
export async function queryAuditLog(organizationId, options = {}) {
  const {
    actorId,
    tableName,
    action,
    startTime,
    endTime,
    limit = 100,
    offset = 0
  } = options;
  
  let query = supabaseAdmin
    .from('audit_log')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (actorId) {
    query = query.eq('actor_id', actorId);
  }
  if (tableName) {
    query = query.eq('table_name', tableName);
  }
  if (action) {
    query = query.eq('action', action);
  }
  if (startTime) {
    query = query.gte('timestamp', startTime);
  }
  if (endTime) {
    query = query.lte('timestamp', endTime);
  }
  
  const { data, error, count } = await query;
  
  if (error) throw error;
  
  return {
    entries: data || [],
    total: count || 0,
    limit,
    offset
  };
}

export default {
  logEvent,
  logEventBatch,
  queryEvents,
  getEventSummary,
  logAuditTrail,
  queryAuditLog
};

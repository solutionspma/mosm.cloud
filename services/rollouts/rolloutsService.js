/**
 * Rollouts Service
 * Handles multi-location menu deployment orchestration
 * 
 * MOSM Cloud Control Plane - Rollout Orchestration (Step 5)
 * 
 * This service:
 * - Creates and manages rollout definitions
 * - Tracks rollout execution across locations
 * - Supports scheduling and rollback
 * 
 * This service does NOT:
 * - Execute menu rendering
 * - Directly modify MOD OS state
 * - Block kitchen operations
 * 
 * MOSM sends rollout commands. MOD OS executes them.
 */

import { supabaseAdmin } from '../supabase.js';

/**
 * Create a new rollout
 */
export async function createRollout({
  name,
  organizationId,
  rolloutType, // 'menu_activation', 'config_update', 'feature_toggle'
  targetLocations,
  payload,
  scheduledAt = null,
  createdBy
}) {
  const { data, error } = await supabaseAdmin
    .from('rollouts')
    .insert({
      name,
      organization_id: organizationId,
      rollout_type: rolloutType,
      target_locations: targetLocations,
      payload,
      status: scheduledAt ? 'scheduled' : 'pending',
      scheduled_at: scheduledAt,
      created_by: createdBy
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // Create execution records for each location
  if (data && targetLocations.length > 0) {
    const executions = targetLocations.map(locId => ({
      rollout_id: data.id,
      location_id: locId,
      status: 'pending'
    }));
    
    await supabaseAdmin
      .from('rollout_executions')
      .insert(executions);
  }
  
  return data;
}

/**
 * Get rollout with executions
 */
export async function getRollout(rolloutId) {
  const { data: rollout, error } = await supabaseAdmin
    .from('rollouts')
    .select(`
      *,
      rollout_executions(
        id,
        location_id,
        status,
        started_at,
        completed_at,
        error_message
      )
    `)
    .eq('id', rolloutId)
    .single();
  
  if (error) throw error;
  return rollout;
}

/**
 * List rollouts for organization
 */
export async function listRollouts(organizationId, options = {}) {
  const { status, limit = 50, offset = 0 } = options;
  
  let query = supabaseAdmin
    .from('rollouts')
    .select('*', { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data, error, count } = await query;
  
  if (error) throw error;
  
  return {
    rollouts: data || [],
    total: count || 0,
    limit,
    offset
  };
}

/**
 * Start executing a rollout
 */
export async function startRollout(rolloutId) {
  const now = new Date().toISOString();
  
  const { data, error } = await supabaseAdmin
    .from('rollouts')
    .update({
      status: 'in_progress',
      started_at: now,
      updated_at: now
    })
    .eq('id', rolloutId)
    .eq('status', 'pending') // Only start pending rollouts
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update execution status for a location
 */
export async function updateExecutionStatus(rolloutId, locationId, status, errorMessage = null) {
  const now = new Date().toISOString();
  
  const updates = {
    status,
    error_message: errorMessage
  };
  
  if (status === 'in_progress') {
    updates.started_at = now;
  } else if (status === 'completed' || status === 'failed') {
    updates.completed_at = now;
  }
  
  const { data, error } = await supabaseAdmin
    .from('rollout_executions')
    .update(updates)
    .eq('rollout_id', rolloutId)
    .eq('location_id', locationId)
    .select()
    .single();
  
  if (error) throw error;
  
  // Check if all executions are complete
  await checkRolloutCompletion(rolloutId);
  
  return data;
}

/**
 * Check if rollout is complete and update status
 */
async function checkRolloutCompletion(rolloutId) {
  const { data: executions } = await supabaseAdmin
    .from('rollout_executions')
    .select('status')
    .eq('rollout_id', rolloutId);
  
  if (!executions) return;
  
  const allComplete = executions.every(e => 
    e.status === 'completed' || e.status === 'failed'
  );
  
  if (allComplete) {
    const hasFailure = executions.some(e => e.status === 'failed');
    const finalStatus = hasFailure ? 'failed' : 'completed';
    
    await supabaseAdmin
      .from('rollouts')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', rolloutId);
  }
}

/**
 * Cancel a pending or scheduled rollout
 */
export async function cancelRollout(rolloutId) {
  const { data, error } = await supabaseAdmin
    .from('rollouts')
    .update({
      status: 'rolled_back',
      updated_at: new Date().toISOString()
    })
    .eq('id', rolloutId)
    .in('status', ['pending', 'scheduled'])
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Rollback a completed rollout
 * Creates a new rollout with reverse payload
 */
export async function rollbackRollout(rolloutId, createdBy) {
  const original = await getRollout(rolloutId);
  
  if (!original) {
    throw new Error('Rollout not found');
  }
  
  // Mark original as rolled back
  await supabaseAdmin
    .from('rollouts')
    .update({
      status: 'rolled_back',
      updated_at: new Date().toISOString()
    })
    .eq('id', rolloutId);
  
  // Create rollback rollout
  const rollbackPayload = {
    ...original.payload,
    is_rollback: true,
    original_rollout_id: rolloutId
  };
  
  return createRollout({
    name: `Rollback: ${original.name}`,
    organizationId: original.organization_id,
    rolloutType: original.rollout_type,
    targetLocations: original.target_locations,
    payload: rollbackPayload,
    createdBy
  });
}

/**
 * Get pending scheduled rollouts that should execute
 */
export async function getDueScheduledRollouts() {
  const now = new Date().toISOString();
  
  const { data, error } = await supabaseAdmin
    .from('rollouts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now);
  
  if (error) throw error;
  return data || [];
}

export default {
  createRollout,
  getRollout,
  listRollouts,
  startRollout,
  updateExecutionStatus,
  cancelRollout,
  rollbackRollout,
  getDueScheduledRollouts
};

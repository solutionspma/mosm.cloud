/**
 * Location Service
 * 
 * Phase F: Per-location billing and management
 * 
 * BUSINESS MODEL:
 * - $29-$99 per location / month (based on plan_tier)
 * - $250 one-time setup fee per new location
 * - Devices live under locations
 * - Device limits enforced per location
 * 
 * AUTHORITY: Only mOSm.cloud manages locations
 */

import { createClient } from '@supabase/supabase-js';
import { updateSubscriptionQuantity, createLocationAddCheckout } from '../billing/createCheckout';

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

export interface Location {
  id: string;
  organization_id: string;
  name: string;
  address?: string;
  plan_tier: 'starter' | 'pro' | 'enterprise';
  device_limit: number;
  active: boolean;
  setup_fee_paid: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateLocationInput {
  organization_id: string;
  name: string;
  address?: string;
  plan_tier?: 'starter' | 'pro' | 'enterprise';
}

// Device limits per plan tier (from billing contract)
const PLAN_DEVICE_LIMITS: Record<string, number> = {
  starter: 3,
  pro: 25,
  enterprise: 999, // Effectively unlimited
};

/**
 * Get all locations for an organization
 */
export async function getLocations(organizationId: string): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get a single location by ID
 */
export async function getLocation(locationId: string): Promise<Location | null> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('id', locationId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Get active location count for an organization
 */
export async function getActiveLocationCount(organizationId: string): Promise<number> {
  const { count, error } = await supabase
    .from('locations')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('active', true);

  if (error) throw error;
  return count || 0;
}

/**
 * Create a new location
 * 
 * NOTE: This creates the location with setup_fee_paid = false
 * The setup fee must be paid via checkout before the location becomes active
 */
export async function createLocation(input: CreateLocationInput): Promise<Location> {
  const planTier = input.plan_tier || 'starter';
  const deviceLimit = PLAN_DEVICE_LIMITS[planTier];

  const { data, error } = await supabase
    .from('locations')
    .insert({
      organization_id: input.organization_id,
      name: input.name,
      address: input.address,
      plan_tier: planTier,
      device_limit: deviceLimit,
      active: false, // Inactive until setup fee paid
      setup_fee_paid: false,
    })
    .select()
    .single();

  if (error) throw error;

  console.log(`📍 Created location: ${data.name} (${data.id}) - awaiting setup fee`);
  return data;
}

/**
 * Mark location setup fee as paid and activate
 * Called after successful checkout
 */
export async function activateLocationAfterPayment(locationId: string): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .update({
      setup_fee_paid: true,
      active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', locationId)
    .select()
    .single();

  if (error) throw error;

  console.log(`✅ Location activated: ${data.name} (${data.id})`);
  return data;
}

/**
 * Update a location's plan tier
 */
export async function updateLocationPlan(
  locationId: string,
  planTier: 'starter' | 'pro' | 'enterprise'
): Promise<Location> {
  const deviceLimit = PLAN_DEVICE_LIMITS[planTier];

  const { data, error } = await supabase
    .from('locations')
    .update({
      plan_tier: planTier,
      device_limit: deviceLimit,
      updated_at: new Date().toISOString(),
    })
    .eq('id', locationId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Deactivate a location (soft delete)
 * Billing continues until end of period, but no new devices can pair
 */
export async function deactivateLocation(locationId: string): Promise<Location> {
  const { data, error } = await supabase
    .from('locations')
    .update({
      active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', locationId)
    .select()
    .single();

  if (error) throw error;

  console.log(`⏸️ Location deactivated: ${data.name} (${data.id})`);
  return data;
}

/**
 * Get device count for a location
 */
export async function getLocationDeviceCount(locationId: string): Promise<number> {
  const { count, error } = await supabase
    .from('devices')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId);

  if (error) throw error;
  return count || 0;
}

/**
 * Check if a location can accept more devices
 */
export async function canAddDevice(locationId: string): Promise<{ allowed: boolean; reason?: string }> {
  const location = await getLocation(locationId);
  
  if (!location) {
    return { allowed: false, reason: 'LOCATION_NOT_FOUND' };
  }

  if (!location.active) {
    return { allowed: false, reason: 'LOCATION_INACTIVE' };
  }

  if (!location.setup_fee_paid) {
    return { allowed: false, reason: 'SETUP_FEE_NOT_PAID' };
  }

  const deviceCount = await getLocationDeviceCount(locationId);
  
  if (deviceCount >= location.device_limit) {
    return { 
      allowed: false, 
      reason: 'DEVICE_LIMIT_REACHED',
    };
  }

  return { allowed: true };
}

/**
 * Sync subscription quantity after location changes
 * Called when locations are added/removed
 */
export async function syncSubscriptionQuantity(
  organizationId: string,
  subscriptionId: string
): Promise<void> {
  const locationCount = await getActiveLocationCount(organizationId);
  await updateSubscriptionQuantity(subscriptionId, locationCount);
}

export default {
  getLocations,
  getLocation,
  getActiveLocationCount,
  createLocation,
  activateLocationAfterPayment,
  updateLocationPlan,
  deactivateLocation,
  getLocationDeviceCount,
  canAddDevice,
  syncSubscriptionQuantity,
};

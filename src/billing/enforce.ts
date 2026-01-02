/**
 * Billing Enforcement
 * 
 * PHASE D: Enforcement Proof
 * PHASE F: Location-scoped enforcement
 * 
 * RULES (CANONICAL):
 * - Call when pairing devices ✅
 * - NOT on device boot ❌
 * - NOT on heartbeat ❌
 * 
 * PHASE F ADDITIONS:
 * - Enforce at LOCATION level, not just account
 * - Check location.active, location.setup_fee_paid
 * - Device limits per location, not per account
 * 
 * This avoids accidental shutdowns and device bricking.
 * Existing devices ALWAYS continue working.
 */

// Valid billing statuses that allow device pairing
export const ACTIVE_BILLING_STATUSES = ['paid', 'trialing'];

// Blocked statuses
export const BLOCKED_BILLING_STATUSES = ['unpaid', 'past_due', 'canceled'];

interface Account {
  id?: string;
  plan: {
    max_devices: number | 'unlimited';
  };
  billing_status: string;
}

interface Location {
  id: string;
  organization_id: string;
  name: string;
  plan_tier: 'starter' | 'pro' | 'enterprise';
  device_limit: number;
  active: boolean;
  setup_fee_paid: boolean;
}

interface EnforcementLog {
  type: 'BILLING_ENFORCEMENT';
  timestamp: string;
  org_id?: string;
  location_id?: string;
  billing_status: string;
  action: string;
  result: 'ALLOWED' | 'BLOCKED';
  reason?: string;
  device_count?: number;
  max_devices?: number | 'unlimited';
}

// In-memory log buffer (replace with actual logging service)
const enforcementLogs: EnforcementLog[] = [];

/**
 * Log enforcement events for audit trail
 * CRITICAL: This is legally and operationally important
 */
export function logEnforcementEvent(log: Omit<EnforcementLog, 'type' | 'timestamp'>): void {
  const entry: EnforcementLog = {
    type: 'BILLING_ENFORCEMENT',
    timestamp: new Date().toISOString(),
    ...log,
  };
  
  enforcementLogs.push(entry);
  
  // Console log for dev visibility
  const icon = log.result === 'BLOCKED' ? '🚫' : '✅';
  console.log(`${icon} [ENFORCEMENT] ${log.action} → ${log.result} (status: ${log.billing_status})`);
  
  // TODO: Send to actual logging service (Supabase, CloudWatch, etc.)
  // await supabase.from('enforcement_logs').insert(entry);
}

/**
 * Get recent enforcement logs (for debugging/audit)
 */
export function getEnforcementLogs(limit = 100): EnforcementLog[] {
  return enforcementLogs.slice(-limit);
}

/**
 * Check if billing status allows the action
 */
export function isBillingActive(billing_status: string): boolean {
  return ACTIVE_BILLING_STATUSES.includes(billing_status);
}

/**
 * Enforce billing status for device pairing (account-level)
 * Returns structured error instead of throwing
 */
export function enforceBillingForPairing(account: Account): {
  allowed: boolean;
  error?: string;
  code?: string;
  message?: string;
} {
  const isActive = isBillingActive(account.billing_status);
  
  logEnforcementEvent({
    org_id: account.id,
    billing_status: account.billing_status,
    action: 'PAIR_DEVICE',
    result: isActive ? 'ALLOWED' : 'BLOCKED',
    reason: isActive ? undefined : `Billing status '${account.billing_status}' not in allowed list`,
  });
  
  if (!isActive) {
    return {
      allowed: false,
      error: 'BILLING_INACTIVE',
      code: 'BILLING_INACTIVE',
      message: 'Active subscription required to pair new devices. Please visit /billing to activate.',
    };
  }
  
  return { allowed: true };
}

/**
 * Enforce device limit based on account plan
 * Throws if limit exceeded
 */
export function enforceDeviceLimit(account: Account, deviceCount: number): void {
  const maxDevices = account.plan.max_devices;
  
  if (maxDevices === 'unlimited') {
    logEnforcementEvent({
      org_id: account.id,
      billing_status: account.billing_status,
      action: 'CHECK_DEVICE_LIMIT',
      result: 'ALLOWED',
      reason: 'Enterprise plan - unlimited devices',
      device_count: deviceCount,
      max_devices: 'unlimited',
    });
    return;
  }

  const allowed = deviceCount <= maxDevices;
  
  logEnforcementEvent({
    org_id: account.id,
    billing_status: account.billing_status,
    action: 'CHECK_DEVICE_LIMIT',
    result: allowed ? 'ALLOWED' : 'BLOCKED',
    reason: allowed ? undefined : `Limit ${maxDevices}, attempting ${deviceCount}`,
    device_count: deviceCount,
    max_devices: maxDevices,
  });

  if (!allowed) {
    throw new Error(
      `Device limit exceeded. Plan allows ${maxDevices} devices, attempting to add device #${deviceCount}`
    );
  }
}

/**
 * Check if account can add more devices
 * Returns boolean instead of throwing
 */
export function canAddDevice(account: Account, currentDeviceCount: number): boolean {
  const maxDevices = account.plan.max_devices;
  
  if (maxDevices === 'unlimited') {
    return true;
  }

  return currentDeviceCount < maxDevices;
}

/**
 * Get remaining device slots for account
 */
export function getRemainingDeviceSlots(account: Account, currentDeviceCount: number): number | 'unlimited' {
  const maxDevices = account.plan.max_devices;
  
  if (maxDevices === 'unlimited') {
    return 'unlimited';
  }

  return Math.max(0, maxDevices - currentDeviceCount);
}

// ============================================================
// PHASE F: LOCATION-SCOPED ENFORCEMENT
// ============================================================

/**
 * Enforce device pairing at LOCATION level
 * 
 * Checks:
 * 1. Account billing_status must be active
 * 2. Location must be active
 * 3. Location setup_fee_paid must be true
 * 4. Location device_count must be under device_limit
 * 
 * Returns structured error instead of throwing
 */
export function enforceLocationPairing(
  account: Account,
  location: Location,
  currentDeviceCount: number
): {
  allowed: boolean;
  error?: string;
  code?: string;
  message?: string;
} {
  // Check 1: Account-level billing
  const billingActive = isBillingActive(account.billing_status);
  if (!billingActive) {
    logEnforcementEvent({
      org_id: account.id,
      location_id: location.id,
      billing_status: account.billing_status,
      action: 'LOCATION_PAIR_DEVICE',
      result: 'BLOCKED',
      reason: `Account billing status '${account.billing_status}' not active`,
    });
    
    return {
      allowed: false,
      error: 'BILLING_INACTIVE',
      code: 'BILLING_INACTIVE',
      message: 'Active subscription required. Please visit /billing to activate.',
    };
  }

  // Check 2: Location must be active
  if (!location.active) {
    logEnforcementEvent({
      org_id: account.id,
      location_id: location.id,
      billing_status: account.billing_status,
      action: 'LOCATION_PAIR_DEVICE',
      result: 'BLOCKED',
      reason: 'Location is not active',
    });
    
    return {
      allowed: false,
      error: 'LOCATION_INACTIVE',
      code: 'LOCATION_INACTIVE',
      message: `Location '${location.name}' is not active.`,
    };
  }

  // Check 3: Setup fee must be paid
  if (!location.setup_fee_paid) {
    logEnforcementEvent({
      org_id: account.id,
      location_id: location.id,
      billing_status: account.billing_status,
      action: 'LOCATION_PAIR_DEVICE',
      result: 'BLOCKED',
      reason: 'Location setup fee not paid',
    });
    
    return {
      allowed: false,
      error: 'SETUP_FEE_NOT_PAID',
      code: 'SETUP_FEE_NOT_PAID',
      message: `Setup fee required for location '${location.name}'. Please complete payment.`,
    };
  }

  // Check 4: Device limit per location
  if (currentDeviceCount >= location.device_limit) {
    logEnforcementEvent({
      org_id: account.id,
      location_id: location.id,
      billing_status: account.billing_status,
      action: 'LOCATION_PAIR_DEVICE',
      result: 'BLOCKED',
      reason: `Device limit reached: ${currentDeviceCount}/${location.device_limit}`,
      device_count: currentDeviceCount,
      max_devices: location.device_limit,
    });
    
    return {
      allowed: false,
      error: 'DEVICE_LIMIT_REACHED',
      code: 'DEVICE_LIMIT_REACHED',
      message: `Location '${location.name}' has reached its device limit (${location.device_limit}). Upgrade plan or add another location.`,
    };
  }

  // All checks passed
  logEnforcementEvent({
    org_id: account.id,
    location_id: location.id,
    billing_status: account.billing_status,
    action: 'LOCATION_PAIR_DEVICE',
    result: 'ALLOWED',
    device_count: currentDeviceCount,
    max_devices: location.device_limit,
  });

  return { allowed: true };
}

/**
 * Check if a location can accept more devices (non-throwing version)
 */
export function canLocationAddDevice(
  account: Account,
  location: Location,
  currentDeviceCount: number
): boolean {
  const result = enforceLocationPairing(account, location, currentDeviceCount);
  return result.allowed;
}

/**
 * Get remaining device slots for a location
 */
export function getLocationRemainingSlots(location: Location, currentDeviceCount: number): number {
  return Math.max(0, location.device_limit - currentDeviceCount);
}
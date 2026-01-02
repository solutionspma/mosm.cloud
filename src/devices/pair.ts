/**
 * Device Pairing Endpoint
 * POST /api/devices/pair
 * 
 * User → Office communication
 * Pairs a registered device to an account
 * 
 * PHASE D: Enforcement Proof
 * - Explicit error responses (no generic 500s)
 * - Audit logging on all enforcement decisions
 * - Clear client messaging
 */

import { 
  enforceDeviceLimit, 
  enforceBillingForPairing,
  ACTIVE_BILLING_STATUSES,
  logEnforcementEvent,
} from '../billing/enforce';

interface DevicePairingRequest {
  device_id: string;
  account_id: string;
  pairing_code?: string;
  device_name?: string;
}

interface DevicePairingSuccess {
  success: true;
  device_id: string;
  account_id: string;
  paired_at: string;
  device_name: string;
}

interface DevicePairingError {
  success: false;
  error: string;
  code: string;
  message: string;
  billing_status?: string;
  help?: string;
}

type DevicePairingResponse = DevicePairingSuccess | DevicePairingError;

interface Account {
  id: string;
  billing_status: string;
  plan: { max_devices: number | 'unlimited' };
  device_count: number;
}

export async function pairDevice(
  req: DevicePairingRequest,
  account: Account
): Promise<DevicePairingResponse> {
  // ============================================================
  // BILLING GATE (PHASE D ENFORCEMENT)
  // ============================================================
  // Account must have active billing to pair devices
  // Returns structured error - NO GENERIC 500s
  
  const billingCheck = enforceBillingForPairing(account);
  
  if (!billingCheck.allowed) {
    return {
      success: false,
      error: billingCheck.error!,
      code: billingCheck.code!,
      message: billingCheck.message!,
      billing_status: account.billing_status,
      help: 'Visit /billing to activate your subscription',
    };
  }

  // ============================================================
  // DEVICE LIMIT GATE
  // ============================================================
  // Enforce device limit based on plan (starter=3, pro=25, enterprise=unlimited)
  
  try {
    enforceDeviceLimit(account, account.device_count + 1);
  } catch (limitError: any) {
    logEnforcementEvent({
      org_id: account.id,
      billing_status: account.billing_status,
      action: 'PAIR_DEVICE',
      result: 'BLOCKED',
      reason: limitError.message,
      device_count: account.device_count,
      max_devices: account.plan.max_devices,
    });
    
    return {
      success: false,
      error: 'DEVICE_LIMIT_EXCEEDED',
      code: 'DEVICE_LIMIT_EXCEEDED',
      message: limitError.message,
      billing_status: account.billing_status,
      help: 'Upgrade your plan at /billing to add more devices',
    };
  }

  // ============================================================
  // PAIRING LOGIC
  // ============================================================
  
  // Validate pairing code if provided
  if (req.pairing_code) {
    // await validatePairingCode(req.pairing_code);
  }

  // Link device to account (stub - implement with your database)
  // await db.devices.update({ device_id: req.device_id }, { account_id: req.account_id })

  // Log successful pairing
  logEnforcementEvent({
    org_id: account.id,
    billing_status: account.billing_status,
    action: 'PAIR_DEVICE',
    result: 'ALLOWED',
    device_count: account.device_count + 1,
    max_devices: account.plan.max_devices,
  });

  return {
    success: true,
    device_id: req.device_id,
    account_id: req.account_id,
    paired_at: new Date().toISOString(),
    device_name: req.device_name || `Device ${req.device_id.slice(0, 8)}`,
  };
}

/**
 * Check if an account can pair a device (without side effects)
 * Use this for UI checks before attempting to pair
 */
export function canPairDevice(account: Account): { 
  allowed: boolean; 
  reason?: string;
  code?: string;
  billing_status: string;
} {
  // Check billing status
  if (!ACTIVE_BILLING_STATUSES.includes(account.billing_status)) {
    return {
      allowed: false,
      code: 'BILLING_INACTIVE',
      reason: 'Active subscription required to pair new devices',
      billing_status: account.billing_status,
    };
  }

  // Check device limit
  const maxDevices = account.plan.max_devices;
  if (maxDevices !== 'unlimited' && account.device_count >= maxDevices) {
    return {
      allowed: false,
      code: 'DEVICE_LIMIT_EXCEEDED',
      reason: `Device limit reached (${maxDevices} devices on current plan)`,
      billing_status: account.billing_status,
    };
  }

  return {
    allowed: true,
    billing_status: account.billing_status,
  };
}



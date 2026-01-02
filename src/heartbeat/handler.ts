/**
 * Heartbeat Handler
 * POST /api/heartbeat
 * 
 * Device → Office communication
 * Receives device health signals every 60 seconds
 * 
 * PHASE D: NO BRICKING POLICY (CRITICAL)
 * ============================================================
 * This handler NEVER:
 * - Disables existing paired devices
 * - Revokes sessions mid-cycle
 * - Checks or enforces billing status
 * - Returns commands to shut down devices
 * 
 * Billing enforcement happens ONLY at:
 * - New device pairing (pair.ts)
 * - NOT here
 * 
 * This ensures:
 * - No angry customers with dead screens
 * - No emergency unlocks needed
 * - No refunds for bricked hardware
 * - Existing devices always work
 * ============================================================
 */

interface HeartbeatPayload {
  device_id: string;
  status: 'online' | 'idle' | 'playing';
  uptime: number;
  current_board?: string;
  last_seen: string;
}

interface HeartbeatResponse {
  acknowledged: boolean;
  server_time: string;
  billing_status?: string;  // Informational only - NOT enforcement
  plan?: string;
  device_count?: number;
  commands?: Command[];
}

interface Command {
  type: 'reload' | 'switch_board' | 'update' | 'restart';
  payload?: Record<string, unknown>;
}

const HEARTBEAT_INTERVAL_SECONDS = 60;
const MISSED_BEATS_BEFORE_OFFLINE = 3;

// In-memory store (replace with database)
const deviceLastSeen: Map<string, Date> = new Map();

/**
 * Handle device heartbeat
 * 
 * IMPORTANT: This function NEVER blocks devices based on billing.
 * It only acknowledges the heartbeat and optionally returns commands.
 * 
 * The billing_status in the response is INFORMATIONAL ONLY.
 * Devices can use it to show a "please renew" banner, but
 * they must NEVER self-disable based on it.
 */
export async function handleHeartbeat(
  payload: HeartbeatPayload,
  accountInfo?: { billing_status: string; plan: string; device_count: number }
): Promise<HeartbeatResponse> {
  // Update last seen timestamp
  deviceLastSeen.set(payload.device_id, new Date());

  // Store heartbeat data (stub)
  // await db.heartbeats.create({ ...payload })

  // Check for pending commands
  // NOTE: Never send 'shutdown' or 'disable' commands based on billing
  const commands: Command[] = [];
  // const pendingCommands = await db.commands.findPending(payload.device_id);

  // ALWAYS acknowledge - billing status does NOT affect this
  return {
    acknowledged: true,
    server_time: new Date().toISOString(),
    // These are INFORMATIONAL - device should NOT self-disable
    billing_status: accountInfo?.billing_status,
    plan: accountInfo?.plan,
    device_count: accountInfo?.device_count,
    commands,
  };
}

/**
 * Check if device is offline based on missed heartbeats
 * This is for MONITORING only - not enforcement
 */
export function checkDeviceOffline(device_id: string): boolean {
  const lastSeen = deviceLastSeen.get(device_id);
  if (!lastSeen) return true;

  const now = new Date();
  const diffSeconds = (now.getTime() - lastSeen.getTime()) / 1000;
  return diffSeconds > HEARTBEAT_INTERVAL_SECONDS * MISSED_BEATS_BEFORE_OFFLINE;
}

export const HEARTBEAT_CONFIG = {
  interval_seconds: HEARTBEAT_INTERVAL_SECONDS,
  missed_beats_before_offline: MISSED_BEATS_BEFORE_OFFLINE,
};

/**
 * NO BRICKING POLICY DOCUMENTATION
 * 
 * Q: What happens when a subscription is canceled?
 * A: Existing paired devices continue working indefinitely.
 *    Only NEW device pairing is blocked.
 * 
 * Q: What if payment fails?
 * A: Existing devices continue working.
 *    Only NEW device pairing is blocked.
 * 
 * Q: Can we remotely disable a device?
 * A: Only for legitimate reasons (stolen device, etc.)
 *    NEVER for billing enforcement.
 * 
 * Q: What if a customer disputes a charge?
 * A: Existing devices continue working during dispute.
 *    If dispute is lost, only NEW pairing blocked.
 * 
 * This policy protects:
 * - Customer trust
 * - Hardware investment
 * - Business reputation
 * - Legal liability
 */


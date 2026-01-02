/**
 * Device Registration Endpoint
 * POST /api/devices/register
 * 
 * Device → Office communication
 * Registers a new device with the platform
 */

import { generateDeviceToken } from '../auth/tokens';

interface DeviceRegistrationRequest {
  device_id: string;
  type: 'menu-board' | 'kiosk' | 'tv';
  os_version: string;
  hardware_id?: string;
}

interface DeviceRegistrationResponse {
  device_id: string;
  device_token: string;
  registered_at: string;
  status: 'pending_pairing' | 'active';
}

export async function registerDevice(
  req: DeviceRegistrationRequest
): Promise<DeviceRegistrationResponse> {
  // Validate device info
  if (!req.device_id || !req.type) {
    throw new Error('Missing required device information');
  }

  // Generate long-lived device token
  const device_token = await generateDeviceToken({
    device_id: req.device_id,
    type: req.type,
  });

  // Store device in database (stub)
  // await db.devices.create({ ... })

  return {
    device_id: req.device_id,
    device_token,
    registered_at: new Date().toISOString(),
    status: 'pending_pairing',
  };
}

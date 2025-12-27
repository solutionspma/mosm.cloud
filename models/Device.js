/**
 * Device Model
 * Represents a physical device (Mini PC, Kiosk, etc.)
 * 
 * CRITICAL RULES:
 * - No screen exists without an owner
 * - Device sends heartbeat every 15 seconds
 * - If offline → use last cached version
 */

export const DeviceSchema = {
  id: 'uuid',
  name: 'string',
  organizationId: 'uuid',
  locationId: 'uuid | null',
  location: 'string',
  status: 'online | offline | unknown',
  lastHeartbeat: 'timestamp',
  ipAddress: 'string',
  macAddress: 'string | null',
  osVersion: 'string | null',
  appVersion: 'string | null',
  screens: 'uuid[]',
  fallbackMenuId: 'uuid | null',
  settings: 'object',
  registeredAt: 'timestamp',
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

export const DeviceStatus = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  UNKNOWN: 'unknown'
};

// Device is considered offline if no heartbeat for 60 seconds
export const HEARTBEAT_TIMEOUT_MS = 60000;
export const HEARTBEAT_INTERVAL_MS = 15000;

/**
 * Create a new Device object
 */
export function createDevice(data) {
  return {
    id: data.id || crypto.randomUUID(),
    name: data.name || 'Unnamed Device',
    organizationId: data.organizationId,
    locationId: data.locationId || null,
    location: data.location || '',
    status: data.status || DeviceStatus.UNKNOWN,
    lastHeartbeat: data.lastHeartbeat || null,
    ipAddress: data.ipAddress || '',
    macAddress: data.macAddress || null,
    osVersion: data.osVersion || null,
    appVersion: data.appVersion || null,
    screens: data.screens || [],
    fallbackMenuId: data.fallbackMenuId || null,
    settings: data.settings || {
      autoUpdate: true,
      brightness: 100,
      volume: 50,
      rotation: 0
    },
    registeredAt: data.registeredAt || new Date().toISOString(),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Update device heartbeat
 */
export function updateHeartbeat(device, ipAddress) {
  return {
    ...device,
    status: DeviceStatus.ONLINE,
    lastHeartbeat: new Date().toISOString(),
    ipAddress: ipAddress || device.ipAddress,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Check if device is online based on last heartbeat
 */
export function isOnline(device) {
  if (!device.lastHeartbeat) return false;
  
  const lastBeat = new Date(device.lastHeartbeat).getTime();
  const now = Date.now();
  
  return (now - lastBeat) < HEARTBEAT_TIMEOUT_MS;
}

/**
 * Get device status based on heartbeat
 */
export function getStatus(device) {
  if (!device.lastHeartbeat) return DeviceStatus.UNKNOWN;
  return isOnline(device) ? DeviceStatus.ONLINE : DeviceStatus.OFFLINE;
}

/**
 * Add screen to device
 */
export function addScreen(device, screenId) {
  if (device.screens.includes(screenId)) return device;
  
  return {
    ...device,
    screens: [...device.screens, screenId],
    updatedAt: new Date().toISOString()
  };
}

/**
 * Remove screen from device
 */
export function removeScreen(device, screenId) {
  return {
    ...device,
    screens: device.screens.filter(id => id !== screenId),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Update device settings
 */
export function updateSettings(device, settings) {
  return {
    ...device,
    settings: { ...device.settings, ...settings },
    updatedAt: new Date().toISOString()
  };
}

/**
 * Set fallback menu for offline mode
 */
export function setFallbackMenu(device, menuId) {
  return {
    ...device,
    fallbackMenuId: menuId,
    updatedAt: new Date().toISOString()
  };
}

export default {
  Schema: DeviceSchema,
  Status: DeviceStatus,
  HEARTBEAT_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
  create: createDevice,
  updateHeartbeat,
  isOnline,
  getStatus,
  addScreen,
  removeScreen,
  updateSettings,
  setFallbackMenu
};

/**
 * Location Model
 * Represents a physical location (store, restaurant, etc.)
 */

export const LocationSchema = {
  id: 'uuid',
  organizationId: 'uuid',
  name: 'string',
  address: 'object',
  timezone: 'string',
  devices: 'uuid[]',
  isActive: 'boolean',
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

/**
 * Create a new Location object
 */
export function createLocation(data) {
  return {
    id: data.id || crypto.randomUUID(),
    organizationId: data.organizationId,
    name: data.name,
    address: data.address || {
      street: '',
      city: '',
      state: '',
      zip: '',
      country: 'US'
    },
    timezone: data.timezone || 'America/New_York',
    devices: data.devices || [],
    isActive: data.isActive !== false,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Add device to location
 */
export function addDevice(location, deviceId) {
  if (location.devices.includes(deviceId)) return location;
  
  return {
    ...location,
    devices: [...location.devices, deviceId],
    updatedAt: new Date().toISOString()
  };
}

/**
 * Remove device from location
 */
export function removeDevice(location, deviceId) {
  return {
    ...location,
    devices: location.devices.filter(id => id !== deviceId),
    updatedAt: new Date().toISOString()
  };
}

export default {
  Schema: LocationSchema,
  create: createLocation,
  addDevice,
  removeDevice
};

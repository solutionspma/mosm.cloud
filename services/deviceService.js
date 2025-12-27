/**
 * Device Service
 * Handles device registration, heartbeats, and management
 * 
 * CRITICAL RULES:
 * - No screen exists without an owner
 * - Device sends heartbeat every 15 seconds
 * - If offline → use last cached version
 */

import { supabase, supabaseAdmin } from './supabase.js';
import Device from '../models/Device.js';
import Screen from '../models/Screen.js';
import { validateDevice, validateScreen } from '../utils/validators.js';

/**
 * Get all devices for an organization
 */
export async function getDevices(organizationId, options = {}) {
  let query = supabase
    .from('devices')
    .select(`
      *,
      screens (*)
    `)
    .eq('organization_id', organizationId);
  
  // Filter by location
  if (options.locationId) {
    query = query.eq('location_id', options.locationId);
  }
  
  // Filter by status
  if (options.status) {
    query = query.eq('status', options.status);
  }
  
  query = query.order('name');
  
  const { data, error } = await query;
  if (error) throw error;
  
  // Update status based on heartbeat
  return data.map(device => ({
    ...device,
    status: Device.getStatus(device)
  }));
}

/**
 * Get a single device by ID
 */
export async function getDevice(deviceId) {
  const { data, error } = await supabase
    .from('devices')
    .select(`
      *,
      screens (*)
    `)
    .eq('id', deviceId)
    .single();
  
  if (error) throw error;
  
  return {
    ...data,
    status: Device.getStatus(data)
  };
}

/**
 * Register a new device
 */
export async function registerDevice(deviceData) {
  const validation = validateDevice(deviceData);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }
  
  const device = Device.create(deviceData);
  
  const { data, error } = await supabase
    .from('devices')
    .insert({
      id: device.id,
      name: device.name,
      organization_id: device.organizationId,
      location_id: device.locationId,
      location: device.location,
      status: device.status,
      last_heartbeat: device.lastHeartbeat,
      ip_address: device.ipAddress,
      mac_address: device.macAddress,
      os_version: device.osVersion,
      app_version: device.appVersion,
      fallback_menu_id: device.fallbackMenuId,
      settings: device.settings,
      registered_at: device.registeredAt,
      created_at: device.createdAt,
      updated_at: device.updatedAt
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update device heartbeat
 */
export async function heartbeat(deviceId, heartbeatData = {}) {
  const { data, error } = await supabase
    .from('devices')
    .update({
      status: 'online',
      last_heartbeat: new Date().toISOString(),
      ip_address: heartbeatData.ipAddress,
      os_version: heartbeatData.osVersion,
      app_version: heartbeatData.appVersion,
      updated_at: new Date().toISOString()
    })
    .eq('id', deviceId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update device
 */
export async function updateDevice(deviceId, updates) {
  const { data, error } = await supabase
    .from('devices')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', deviceId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update device settings
 */
export async function updateSettings(deviceId, settings) {
  const device = await getDevice(deviceId);
  
  return updateDevice(deviceId, {
    settings: { ...device.settings, ...settings }
  });
}

/**
 * Set fallback menu for device
 */
export async function setFallbackMenu(deviceId, menuId) {
  return updateDevice(deviceId, { fallback_menu_id: menuId });
}

/**
 * Delete a device
 */
export async function deleteDevice(deviceId) {
  // Delete screens first
  await supabase.from('screens').delete().eq('device_id', deviceId);
  
  // Delete device
  const { error } = await supabase
    .from('devices')
    .delete()
    .eq('id', deviceId);
  
  if (error) throw error;
}

/**
 * Add screen to device
 */
export async function addScreen(deviceId, screenData) {
  const validation = validateScreen({ ...screenData, deviceId });
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }
  
  const screen = Screen.create({ ...screenData, deviceId });
  
  const { data, error } = await supabase
    .from('screens')
    .insert({
      id: screen.id,
      device_id: screen.deviceId,
      screen_index: screen.screenIndex,
      name: screen.name,
      resolution: screen.resolution,
      orientation: screen.orientation,
      assigned_layout_id: screen.assignedLayoutId,
      position: screen.position,
      created_at: screen.createdAt,
      updated_at: screen.updatedAt
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update screen
 */
export async function updateScreen(screenId, updates) {
  const { data, error } = await supabase
    .from('screens')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', screenId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Assign layout to screen
 */
export async function assignLayout(screenId, layoutId) {
  return updateScreen(screenId, { assigned_layout_id: layoutId });
}

/**
 * Unassign layout from screen
 */
export async function unassignLayout(screenId) {
  return updateScreen(screenId, { assigned_layout_id: null });
}

/**
 * Delete screen
 */
export async function deleteScreen(screenId) {
  const { error } = await supabase
    .from('screens')
    .delete()
    .eq('id', screenId);
  
  if (error) throw error;
}

/**
 * Get screens for device
 */
export async function getScreens(deviceId) {
  const { data, error } = await supabase
    .from('screens')
    .select(`
      *,
      layout:layouts(*)
    `)
    .eq('device_id', deviceId)
    .order('screen_index');
  
  if (error) throw error;
  return data;
}

/**
 * Get online devices count
 */
export async function getOnlineCount(organizationId) {
  const devices = await getDevices(organizationId);
  return devices.filter(d => d.status === 'online').length;
}

/**
 * Get offline devices (for alerts)
 */
export async function getOfflineDevices(organizationId) {
  const devices = await getDevices(organizationId);
  return devices.filter(d => d.status === 'offline');
}

/**
 * Mark stale devices as offline
 */
export async function markStaleDevicesOffline() {
  const cutoff = new Date(Date.now() - Device.HEARTBEAT_TIMEOUT_MS).toISOString();
  
  const { error } = await supabase
    .from('devices')
    .update({ status: 'offline', updated_at: new Date().toISOString() })
    .eq('status', 'online')
    .lt('last_heartbeat', cutoff);
  
  if (error) throw error;
}

export default {
  getDevices,
  getDevice,
  registerDevice,
  heartbeat,
  updateDevice,
  updateSettings,
  setFallbackMenu,
  deleteDevice,
  addScreen,
  updateScreen,
  assignLayout,
  unassignLayout,
  deleteScreen,
  getScreens,
  getOnlineCount,
  getOfflineDevices,
  markStaleDevicesOffline
};

/**
 * Publish Service
 * Handles the publish pipeline: Menu → Devices
 * 
 * CRITICAL:
 * - Locks menu version on publish
 * - Generates device payload
 * - Invalidates old cache
 * - Pushes update flag to devices
 */

import { supabase } from './supabase.js';
import menuService from './menuService.js';
import layoutService from './layoutService.js';

/**
 * Publish a menu to devices
 */
export async function publishMenu(menuId, userId) {
  // 1. Get the menu
  const menu = await menuService.getMenu(menuId);
  
  if (!menu) {
    throw new Error('Menu not found');
  }
  
  // 2. Get all layouts for the menu
  const layouts = await layoutService.getLayouts(menuId);
  
  if (!layouts || layouts.length === 0) {
    throw new Error('Menu has no layouts to publish');
  }
  
  // 3. Update menu status to published
  const publishedMenu = await menuService.publishMenu(menuId, userId);
  
  // 4. Create a publish record
  const publishRecord = {
    menu_id: menuId,
    version: publishedMenu.version,
    published_by: userId,
    layout_count: layouts.length,
    published_at: new Date().toISOString()
  };
  
  const { data: record, error: recordError } = await supabase
    .from('publish_history')
    .insert(publishRecord)
    .select()
    .single();
  
  if (recordError) throw recordError;
  
  // 5. Get all screens that have layouts from this menu assigned
  const { data: screens } = await supabase
    .from('screens')
    .select(`
      *,
      device:devices(*)
    `)
    .in('assigned_layout_id', layouts.map(l => l.id));
  
  // 6. Mark devices as needing update
  if (screens && screens.length > 0) {
    const deviceIds = [...new Set(screens.map(s => s.device.id))];
    
    await supabase
      .from('devices')
      .update({ 
        needs_update: true,
        last_update_pushed: new Date().toISOString()
      })
      .in('id', deviceIds);
  }
  
  return {
    menu: publishedMenu,
    publishRecord: record,
    affectedDevices: screens ? screens.length : 0
  };
}

/**
 * Unpublish a menu (set back to draft)
 */
export async function unpublishMenu(menuId) {
  const { data, error } = await supabase
    .from('menus')
    .update({
      status: 'draft',
      updated_at: new Date().toISOString()
    })
    .eq('id', menuId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Get publish history for a menu
 */
export async function getPublishHistory(menuId, limit = 10) {
  const { data, error } = await supabase
    .from('publish_history')
    .select(`
      *,
      published_by_user:users(id, name, email)
    `)
    .eq('menu_id', menuId)
    .order('published_at', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data;
}

/**
 * Get device payload for a specific screen
 * This is what the device actually receives
 */
export async function getDevicePayload(deviceId) {
  // Get device with screens
  const { data: device, error: deviceError } = await supabase
    .from('devices')
    .select(`
      *,
      screens (
        *,
        layout:layouts (*)
      )
    `)
    .eq('id', deviceId)
    .single();
  
  if (deviceError) throw deviceError;
  
  // Build payload for each screen
  const screenPayloads = device.screens
    .filter(s => s.layout) // Only screens with assigned layouts
    .map(screen => ({
      screenIndex: screen.screen_index,
      resolution: screen.resolution,
      orientation: screen.orientation,
      layout: {
        id: screen.layout.id,
        menuId: screen.layout.menu_id,
        elements: screen.layout.elements,
        background: screen.layout.background,
        safeZone: screen.layout.safe_zone
      }
    }));
  
  // Get fallback menu if set
  let fallbackLayout = null;
  if (device.fallback_menu_id) {
    const fallbackLayouts = await layoutService.getLayouts(device.fallback_menu_id);
    if (fallbackLayouts && fallbackLayouts.length > 0) {
      fallbackLayout = fallbackLayouts[0];
    }
  }
  
  return {
    deviceId: device.id,
    timestamp: new Date().toISOString(),
    screens: screenPayloads,
    fallback: fallbackLayout,
    settings: device.settings
  };
}

/**
 * Mark device as updated (clear needs_update flag)
 */
export async function markDeviceUpdated(deviceId) {
  const { error } = await supabase
    .from('devices')
    .update({
      needs_update: false,
      last_update_received: new Date().toISOString()
    })
    .eq('id', deviceId);
  
  if (error) throw error;
}

/**
 * Check if device needs update
 */
export async function deviceNeedsUpdate(deviceId) {
  const { data, error } = await supabase
    .from('devices')
    .select('needs_update')
    .eq('id', deviceId)
    .single();
  
  if (error) throw error;
  return data.needs_update;
}

/**
 * Get published layout for kiosk/player
 * Only returns layouts from PUBLISHED menus
 */
export async function getPublishedLayout(layoutId) {
  const { data, error } = await supabase
    .from('layouts')
    .select(`
      *,
      menu:menus(id, status, version)
    `)
    .eq('id', layoutId)
    .single();
  
  if (error) throw error;
  
  // Only return if menu is published
  if (data.menu.status !== 'published') {
    throw new Error('Layout belongs to unpublished menu');
  }
  
  return data;
}

/**
 * Get all published layouts for a device
 * This is the main endpoint for kiosk/player
 */
export async function getPublishedLayoutsForDevice(deviceId) {
  const { data: screens, error } = await supabase
    .from('screens')
    .select(`
      *,
      layout:layouts (
        *,
        menu:menus (id, status, version, name)
      )
    `)
    .eq('device_id', deviceId)
    .order('screen_index');
  
  if (error) throw error;
  
  // Filter to only published menus
  return screens
    .filter(s => s.layout && s.layout.menu && s.layout.menu.status === 'published')
    .map(s => ({
      screenIndex: s.screen_index,
      resolution: s.resolution,
      orientation: s.orientation,
      layout: {
        id: s.layout.id,
        elements: s.layout.elements,
        background: s.layout.background,
        safeZone: s.layout.safe_zone
      },
      menu: {
        id: s.layout.menu.id,
        name: s.layout.menu.name,
        version: s.layout.menu.version
      }
    }));
}

export default {
  publishMenu,
  unpublishMenu,
  getPublishHistory,
  getDevicePayload,
  markDeviceUpdated,
  deviceNeedsUpdate,
  getPublishedLayout,
  getPublishedLayoutsForDevice
};

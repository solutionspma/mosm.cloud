/**
 * Layout Service
 * Handles all layout CRUD operations
 * 
 * CRITICAL:
 * - Layouts are MAPPED to screens, not scaled
 * - One Layout per Screen
 * - Resolution is FIXED per layout
 */

import { supabase } from './supabase.js';
import Layout from '../models/Layout.js';
import { validateLayout } from '../utils/validators.js';

/**
 * Get all layouts for a menu
 */
export async function getLayouts(menuId) {
  const { data, error } = await supabase
    .from('layouts')
    .select('*')
    .eq('menu_id', menuId)
    .order('screen_index');
  
  if (error) throw error;
  return data;
}

/**
 * Get a single layout by ID
 */
export async function getLayout(layoutId) {
  const { data, error } = await supabase
    .from('layouts')
    .select('*')
    .eq('id', layoutId)
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Get layout by menu and screen index
 */
export async function getLayoutByScreen(menuId, screenIndex) {
  const { data, error } = await supabase
    .from('layouts')
    .select('*')
    .eq('menu_id', menuId)
    .eq('screen_index', screenIndex)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data;
}

/**
 * Create a new layout
 */
export async function createLayout(layoutData) {
  const validation = validateLayout(layoutData);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }
  
  const layout = Layout.create(layoutData);
  
  const { data, error } = await supabase
    .from('layouts')
    .insert({
      id: layout.id,
      menu_id: layout.menuId,
      screen_index: layout.screenIndex,
      name: layout.name,
      resolution: layout.resolution,
      aspect_ratio: layout.aspectRatio,
      orientation: layout.orientation,
      safe_zone: layout.safeZone,
      elements: layout.elements,
      background: layout.background,
      created_at: layout.createdAt,
      updated_at: layout.updatedAt
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update a layout
 */
export async function updateLayout(layoutId, updates) {
  const { data, error } = await supabase
    .from('layouts')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', layoutId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update layout elements
 */
export async function updateElements(layoutId, elements) {
  return updateLayout(layoutId, { elements });
}

/**
 * Update layout background
 */
export async function updateBackground(layoutId, background) {
  return updateLayout(layoutId, { background });
}

/**
 * Change layout resolution
 */
export async function changeResolution(layoutId, resolution, aspectRatio, safeZone) {
  return updateLayout(layoutId, {
    resolution,
    aspect_ratio: aspectRatio,
    safe_zone: safeZone
  });
}

/**
 * Duplicate layout
 */
export async function duplicateLayout(layoutId, newScreenIndex, newName) {
  const original = await getLayout(layoutId);
  
  const newLayout = Layout.duplicate(
    {
      ...original,
      menuId: original.menu_id,
      screenIndex: original.screen_index,
      aspectRatio: original.aspect_ratio,
      safeZone: original.safe_zone
    },
    newScreenIndex,
    newName
  );
  
  return createLayout(newLayout);
}

/**
 * Delete a layout
 */
export async function deleteLayout(layoutId) {
  const { error } = await supabase
    .from('layouts')
    .delete()
    .eq('id', layoutId);
  
  if (error) throw error;
}

/**
 * Delete all layouts for a menu
 */
export async function deleteLayoutsForMenu(menuId) {
  const { error } = await supabase
    .from('layouts')
    .delete()
    .eq('menu_id', menuId);
  
  if (error) throw error;
}

/**
 * Reorder screen indices
 */
export async function reorderLayouts(menuId, newOrder) {
  // newOrder is array of { layoutId, newIndex }
  const updates = newOrder.map(({ layoutId, newIndex }) => 
    supabase
      .from('layouts')
      .update({ 
        screen_index: newIndex,
        updated_at: new Date().toISOString()
      })
      .eq('id', layoutId)
  );
  
  await Promise.all(updates);
}

/**
 * Get layout count for a menu
 */
export async function getLayoutCount(menuId) {
  const { count, error } = await supabase
    .from('layouts')
    .select('*', { count: 'exact', head: true })
    .eq('menu_id', menuId);
  
  if (error) throw error;
  return count;
}

/**
 * Get layouts assigned to screens
 */
export async function getAssignedLayouts(screenIds) {
  const { data, error } = await supabase
    .from('screens')
    .select(`
      *,
      layout:layouts(*)
    `)
    .in('id', screenIds)
    .not('assigned_layout_id', 'is', null);
  
  if (error) throw error;
  return data;
}

export default {
  getLayouts,
  getLayout,
  getLayoutByScreen,
  createLayout,
  updateLayout,
  updateElements,
  updateBackground,
  changeResolution,
  duplicateLayout,
  deleteLayout,
  deleteLayoutsForMenu,
  reorderLayouts,
  getLayoutCount,
  getAssignedLayouts
};

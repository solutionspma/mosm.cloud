/**
 * Menu Service
 * Handles all menu CRUD operations
 * 
 * CRITICAL RULES:
 * - Save FIRST
 * - No silent overwrites
 * - No auto-renaming
 */

import { supabase } from './supabase.js';
import Menu from '../models/Menu.js';
import { validateMenu } from '../utils/validators.js';

/**
 * Get all menus for an organization
 */
export async function getMenus(organizationId, options = {}) {
  let query = supabase
    .from('menus')
    .select('*')
    .eq('organization_id', organizationId);
  
  // Filter by status
  if (options.status) {
    query = query.eq('status', options.status);
  }
  
  // Exclude archived by default
  if (!options.includeArchived) {
    query = query.neq('status', 'archived');
  }
  
  // Order by
  query = query.order(options.orderBy || 'updated_at', { 
    ascending: options.ascending || false 
  });
  
  // Pagination
  if (options.limit) {
    query = query.limit(options.limit);
  }
  if (options.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  
  return data;
}

/**
 * Get a single menu by ID
 */
export async function getMenu(menuId) {
  const { data, error } = await supabase
    .from('menus')
    .select('*')
    .eq('id', menuId)
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Create a new menu
 */
export async function createMenu(menuData) {
  const validation = validateMenu(menuData);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
  }
  
  const menu = Menu.create(menuData);
  
  const { data, error } = await supabase
    .from('menus')
    .insert({
      id: menu.id,
      name: menu.name,
      status: menu.status,
      version: menu.version,
      organization_id: menu.organizationId,
      created_by: menu.createdBy,
      last_edited_by: menu.lastEditedBy,
      tags: menu.tags,
      metadata: menu.metadata,
      created_at: menu.createdAt,
      updated_at: menu.updatedAt
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Update a menu
 */
export async function updateMenu(menuId, updates, userId) {
  // Get current menu first
  const currentMenu = await getMenu(menuId);
  
  // Increment version on update
  const newVersion = currentMenu.version + 1;
  
  const { data, error } = await supabase
    .from('menus')
    .update({
      ...updates,
      version: newVersion,
      last_edited_by: userId,
      updated_at: new Date().toISOString()
    })
    .eq('id', menuId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Publish a menu
 */
export async function publishMenu(menuId, userId) {
  const { data, error } = await supabase
    .from('menus')
    .update({
      status: 'published',
      last_published_at: new Date().toISOString(),
      last_published_by: userId,
      updated_at: new Date().toISOString()
    })
    .eq('id', menuId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Archive a menu
 */
export async function archiveMenu(menuId) {
  const { data, error } = await supabase
    .from('menus')
    .update({
      status: 'archived',
      updated_at: new Date().toISOString()
    })
    .eq('id', menuId)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

/**
 * Duplicate a menu
 */
export async function duplicateMenu(menuId, newName, userId) {
  // Get original menu
  const original = await getMenu(menuId);
  
  // Create duplicate
  const duplicate = await createMenu({
    name: newName || `${original.name} (Copy)`,
    organizationId: original.organization_id,
    createdBy: userId,
    tags: original.tags,
    metadata: { ...original.metadata, duplicated_from: menuId }
  });
  
  // Also duplicate layouts
  const { data: layouts } = await supabase
    .from('layouts')
    .select('*')
    .eq('menu_id', menuId);
  
  if (layouts && layouts.length > 0) {
    const newLayouts = layouts.map(layout => ({
      menu_id: duplicate.id,
      screen_index: layout.screen_index,
      name: layout.name,
      resolution: layout.resolution,
      aspect_ratio: layout.aspect_ratio,
      orientation: layout.orientation,
      safe_zone: layout.safe_zone,
      elements: layout.elements,
      background: layout.background,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    
    await supabase.from('layouts').insert(newLayouts);
  }
  
  return duplicate;
}

/**
 * Delete a menu (soft delete - archive)
 */
export async function deleteMenu(menuId) {
  return archiveMenu(menuId);
}

/**
 * Permanently delete a menu (hard delete)
 */
export async function permanentlyDeleteMenu(menuId) {
  // Delete layouts first
  await supabase.from('layouts').delete().eq('menu_id', menuId);
  
  // Delete menu
  const { error } = await supabase
    .from('menus')
    .delete()
    .eq('id', menuId);
  
  if (error) throw error;
}

/**
 * Search menus
 */
export async function searchMenus(organizationId, query) {
  const { data, error } = await supabase
    .from('menus')
    .select('*')
    .eq('organization_id', organizationId)
    .neq('status', 'archived')
    .ilike('name', `%${query}%`)
    .order('updated_at', { ascending: false })
    .limit(20);
  
  if (error) throw error;
  return data;
}

/**
 * Get published menus for display
 */
export async function getPublishedMenus(organizationId) {
  const { data, error } = await supabase
    .from('menus')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('status', 'published')
    .order('name');
  
  if (error) throw error;
  return data;
}

export default {
  getMenus,
  getMenu,
  createMenu,
  updateMenu,
  publishMenu,
  archiveMenu,
  duplicateMenu,
  deleteMenu,
  permanentlyDeleteMenu,
  searchMenus,
  getPublishedMenus
};

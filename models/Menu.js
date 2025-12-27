/**
 * Menu Model
 * Represents a menu in mOSm.Cloud
 * 
 * CRITICAL RULES:
 * - No menu exists without a version
 * - Builder saves to Cloud FIRST
 * - Preview pulls from Cloud
 * - Kiosk only reads PUBLISHED menus
 */

export const MenuSchema = {
  id: 'uuid',
  name: 'string',
  status: 'draft | published | archived',
  version: 'number',
  organizationId: 'uuid',
  createdBy: 'uuid',
  lastEditedBy: 'uuid',
  lastPublishedAt: 'timestamp | null',
  lastPublishedBy: 'uuid | null',
  tags: 'string[]',
  metadata: 'object',
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

export const MenuStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
};

/**
 * Create a new Menu object
 */
export function createMenu(data) {
  if (!data.name) {
    throw new Error('Menu name is required');
  }
  
  return {
    id: data.id || crypto.randomUUID(),
    name: data.name,
    status: data.status || MenuStatus.DRAFT,
    version: data.version || 1,
    organizationId: data.organizationId,
    createdBy: data.createdBy,
    lastEditedBy: data.lastEditedBy || data.createdBy,
    lastPublishedAt: data.lastPublishedAt || null,
    lastPublishedBy: data.lastPublishedBy || null,
    tags: data.tags || [],
    metadata: data.metadata || {},
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Increment menu version (called on every save)
 */
export function incrementVersion(menu) {
  return {
    ...menu,
    version: menu.version + 1,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Publish a menu
 */
export function publishMenu(menu, userId) {
  return {
    ...menu,
    status: MenuStatus.PUBLISHED,
    lastPublishedAt: new Date().toISOString(),
    lastPublishedBy: userId,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Archive a menu
 */
export function archiveMenu(menu) {
  return {
    ...menu,
    status: MenuStatus.ARCHIVED,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Duplicate a menu
 */
export function duplicateMenu(menu, newName, userId) {
  return createMenu({
    name: newName || `${menu.name} (Copy)`,
    organizationId: menu.organizationId,
    createdBy: userId,
    tags: [...menu.tags],
    metadata: { ...menu.metadata, duplicatedFrom: menu.id }
  });
}

export default {
  Schema: MenuSchema,
  Status: MenuStatus,
  create: createMenu,
  incrementVersion,
  publish: publishMenu,
  archive: archiveMenu,
  duplicate: duplicateMenu
};

/**
 * Layout Model
 * Represents a single screen layout within a menu
 * 
 * CRITICAL:
 * - Menus are NOT scaled. They are MAPPED.
 * - Each Layout targets a specific screen
 * - Resolution is FIXED per layout
 * - Zoom % is VIEW ONLY in editor
 */

export const LayoutSchema = {
  id: 'uuid',
  menuId: 'uuid',
  screenIndex: 'number',
  name: 'string',
  resolution: 'string',
  aspectRatio: 'string',
  orientation: 'landscape | portrait',
  safeZone: 'string',
  elements: 'array',
  background: 'object',
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

export const Orientations = {
  LANDSCAPE: 'landscape',
  PORTRAIT: 'portrait'
};

/**
 * Create a new Layout object
 */
export function createLayout(data) {
  return {
    id: data.id || crypto.randomUUID(),
    menuId: data.menuId,
    screenIndex: data.screenIndex || 1,
    name: data.name || `Screen ${data.screenIndex || 1}`,
    resolution: data.resolution || '1920x1080',
    aspectRatio: data.aspectRatio || '16:9',
    orientation: data.orientation || Orientations.LANDSCAPE,
    safeZone: data.safeZone || 'tv_1080p',
    elements: data.elements || [],
    background: data.background || {
      type: 'color',
      value: '#000000'
    },
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Update layout elements
 */
export function updateElements(layout, elements) {
  return {
    ...layout,
    elements: elements,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Update layout background
 */
export function updateBackground(layout, background) {
  return {
    ...layout,
    background: background,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Change layout resolution
 */
export function changeResolution(layout, resolution, aspectRatio, safeZone) {
  return {
    ...layout,
    resolution: resolution,
    aspectRatio: aspectRatio || layout.aspectRatio,
    safeZone: safeZone || layout.safeZone,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Get layout dimensions from resolution string
 */
export function getDimensions(resolution) {
  const [w, h] = resolution.split('x').map(Number);
  return { width: w, height: h };
}

/**
 * Duplicate layout for another screen
 */
export function duplicateLayout(layout, newScreenIndex, newName) {
  return createLayout({
    menuId: layout.menuId,
    screenIndex: newScreenIndex,
    name: newName || `Screen ${newScreenIndex}`,
    resolution: layout.resolution,
    aspectRatio: layout.aspectRatio,
    orientation: layout.orientation,
    safeZone: layout.safeZone,
    elements: JSON.parse(JSON.stringify(layout.elements)),
    background: { ...layout.background }
  });
}

export default {
  Schema: LayoutSchema,
  Orientations,
  create: createLayout,
  updateElements,
  updateBackground,
  changeResolution,
  getDimensions,
  duplicate: duplicateLayout
};

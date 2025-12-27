/**
 * Screen Model
 * Represents a physical screen output on a device
 * 
 * A Device can have multiple Screens
 * Each Screen gets ONE Layout assigned
 */

export const ScreenSchema = {
  id: 'uuid',
  deviceId: 'uuid',
  screenIndex: 'number',
  name: 'string',
  resolution: 'string',
  orientation: 'landscape | portrait',
  assignedLayoutId: 'uuid | null',
  position: 'object',
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

/**
 * Create a new Screen object
 */
export function createScreen(data) {
  return {
    id: data.id || crypto.randomUUID(),
    deviceId: data.deviceId,
    screenIndex: data.screenIndex || 1,
    name: data.name || `Screen ${data.screenIndex || 1}`,
    resolution: data.resolution || '1920x1080',
    orientation: data.orientation || 'landscape',
    assignedLayoutId: data.assignedLayoutId || null,
    position: data.position || {
      x: 0,
      y: 0,
      row: 1,
      column: data.screenIndex || 1
    },
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Assign a layout to a screen
 */
export function assignLayout(screen, layoutId) {
  return {
    ...screen,
    assignedLayoutId: layoutId,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Unassign layout from screen
 */
export function unassignLayout(screen) {
  return {
    ...screen,
    assignedLayoutId: null,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Update screen resolution
 */
export function updateResolution(screen, resolution, orientation) {
  return {
    ...screen,
    resolution: resolution,
    orientation: orientation || screen.orientation,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Update screen position in multi-screen setup
 */
export function updatePosition(screen, position) {
  return {
    ...screen,
    position: { ...screen.position, ...position },
    updatedAt: new Date().toISOString()
  };
}

export default {
  Schema: ScreenSchema,
  create: createScreen,
  assignLayout,
  unassignLayout,
  updateResolution,
  updatePosition
};

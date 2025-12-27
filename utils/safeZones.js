/**
 * Safe Zones
 * 
 * Safe zones define the margin area where content should not be placed
 * to avoid being cut off on different display types.
 * 
 * TV overscan: TVs can cut off 3-5% of the image edge
 * Kiosk bezels: Physical bezels obscure edge content
 */

export const SAFE_ZONES = {
  // TV profiles
  tv_4k: { 
    margin: 120,
    label: '4K TV Safe Zone',
    description: 'Standard overscan protection for 4K TVs'
  },
  tv_1080p: { 
    margin: 60,
    label: '1080p TV Safe Zone',
    description: 'Standard overscan protection for 1080p TVs'
  },
  tv_720p: { 
    margin: 40,
    label: '720p TV Safe Zone',
    description: 'Standard overscan protection for 720p TVs'
  },
  
  // Commercial displays (less overscan)
  commercial_4k: {
    margin: 60,
    label: '4K Commercial Display',
    description: 'Commercial displays with minimal overscan'
  },
  commercial_1080p: {
    margin: 30,
    label: '1080p Commercial Display',
    description: 'Commercial displays with minimal overscan'
  },
  
  // Kiosk profiles
  kiosk: { 
    margin: 40,
    label: 'Kiosk Standard',
    description: 'Standard bezel protection for kiosks'
  },
  kiosk_touchscreen: {
    margin: 50,
    label: 'Kiosk Touchscreen',
    description: 'Extra margin for touchscreen edge areas'
  },
  
  // Edge-to-edge (no safe zone)
  none: {
    margin: 0,
    label: 'No Safe Zone',
    description: 'Full bleed - content goes to edge'
  },
  
  // Custom
  minimal: {
    margin: 20,
    label: 'Minimal',
    description: 'Minimal safe zone for precise displays'
  },
  standard: {
    margin: 48,
    label: 'Standard',
    description: 'Default safe zone for most displays'
  },
  generous: {
    margin: 80,
    label: 'Generous',
    description: 'Extra margin for older displays'
  }
};

/**
 * Get safe zone by key
 */
export function getSafeZone(key) {
  return SAFE_ZONES[key] || SAFE_ZONES.standard;
}

/**
 * Get safe zone margin in pixels
 */
export function getMargin(key) {
  const zone = getSafeZone(key);
  return zone.margin;
}

/**
 * Calculate safe zone rectangle for a given resolution
 */
export function getSafeRect(width, height, safeZoneKey) {
  const margin = getMargin(safeZoneKey);
  
  return {
    x: margin,
    y: margin,
    width: width - (margin * 2),
    height: height - (margin * 2),
    margin: margin
  };
}

/**
 * Check if a point is inside the safe zone
 */
export function isInSafeZone(x, y, canvasWidth, canvasHeight, safeZoneKey) {
  const rect = getSafeRect(canvasWidth, canvasHeight, safeZoneKey);
  
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

/**
 * Check if an element is fully within safe zone
 */
export function isElementInSafeZone(element, canvasWidth, canvasHeight, safeZoneKey) {
  const rect = getSafeRect(canvasWidth, canvasHeight, safeZoneKey);
  
  const elemRight = element.x + element.width;
  const elemBottom = element.y + element.height;
  
  return (
    element.x >= rect.x &&
    element.y >= rect.y &&
    elemRight <= rect.x + rect.width &&
    elemBottom <= rect.y + rect.height
  );
}

/**
 * Snap element to safe zone if outside
 */
export function snapToSafeZone(element, canvasWidth, canvasHeight, safeZoneKey) {
  const rect = getSafeRect(canvasWidth, canvasHeight, safeZoneKey);
  
  let { x, y, width, height } = element;
  
  // Snap left edge
  if (x < rect.x) x = rect.x;
  
  // Snap top edge
  if (y < rect.y) y = rect.y;
  
  // Snap right edge
  if (x + width > rect.x + rect.width) {
    x = rect.x + rect.width - width;
  }
  
  // Snap bottom edge
  if (y + height > rect.y + rect.height) {
    y = rect.y + rect.height - height;
  }
  
  return { ...element, x, y };
}

/**
 * Get recommended safe zone for resolution
 */
export function getRecommendedSafeZone(resolutionKey) {
  if (resolutionKey.includes('4k') || resolutionKey.includes('8k')) {
    return 'tv_4k';
  }
  if (resolutionKey.includes('kiosk')) {
    return 'kiosk';
  }
  if (resolutionKey.includes('commercial')) {
    return 'commercial_1080p';
  }
  return 'tv_1080p';
}

/**
 * Get all safe zones as array for dropdowns
 */
export function getSafeZoneList() {
  return Object.entries(SAFE_ZONES).map(([key, value]) => ({
    key,
    ...value
  }));
}

export default {
  SAFE_ZONES,
  getSafeZone,
  getMargin,
  getSafeRect,
  isInSafeZone,
  isElementInSafeZone,
  snapToSafeZone,
  getRecommendedSafeZone,
  getSafeZoneList
};

/**
 * Resolution Profiles
 * 
 * CRITICAL:
 * - Canvas ALWAYS fits inside editor
 * - Scaling NEVER alters resolution
 * - Zoom % is VIEW ONLY
 */

export const RESOLUTIONS = {
  '720p': { w: 1280, h: 720, label: 'HD 720p', aspectRatio: '16:9' },
  '1080p': { w: 1920, h: 1080, label: 'Full HD 1080p', aspectRatio: '16:9' },
  '2k': { w: 2560, h: 1440, label: '2K QHD', aspectRatio: '16:9' },
  '4k': { w: 3840, h: 2160, label: '4K UHD', aspectRatio: '16:9' },
  '8k': { w: 7680, h: 4320, label: '8K UHD', aspectRatio: '16:9' },
  
  // Portrait versions
  '720p_portrait': { w: 720, h: 1280, label: 'HD 720p Portrait', aspectRatio: '9:16' },
  '1080p_portrait': { w: 1080, h: 1920, label: 'Full HD 1080p Portrait', aspectRatio: '9:16' },
  '4k_portrait': { w: 2160, h: 3840, label: '4K UHD Portrait', aspectRatio: '9:16' },
  
  // Common TV sizes
  'tv_720p': { w: 1280, h: 720, label: 'TV 720p', aspectRatio: '16:9' },
  'tv_1080p': { w: 1920, h: 1080, label: 'TV 1080p', aspectRatio: '16:9' },
  'tv_4k': { w: 3840, h: 2160, label: 'TV 4K', aspectRatio: '16:9' },
  
  // Kiosk formats
  'kiosk_portrait': { w: 1080, h: 1920, label: 'Kiosk Portrait', aspectRatio: '9:16' },
  'kiosk_landscape': { w: 1920, h: 1080, label: 'Kiosk Landscape', aspectRatio: '16:9' },
  
  // Ultra-wide
  'ultrawide': { w: 2560, h: 1080, label: 'Ultra-wide', aspectRatio: '21:9' },
  'super_ultrawide': { w: 3440, h: 1440, label: 'Super Ultra-wide', aspectRatio: '21:9' },
  
  // Square (for specific displays)
  'square_1080': { w: 1080, h: 1080, label: 'Square 1080', aspectRatio: '1:1' },
  'square_1440': { w: 1440, h: 1440, label: 'Square 1440', aspectRatio: '1:1' }
};

/**
 * Get resolution by key
 */
export function getResolution(key) {
  return RESOLUTIONS[key] || RESOLUTIONS['1080p'];
}

/**
 * Get resolution dimensions as string
 */
export function getResolutionString(key) {
  const res = getResolution(key);
  return `${res.w}x${res.h}`;
}

/**
 * Parse resolution string to dimensions
 */
export function parseResolution(resString) {
  const [w, h] = resString.split('x').map(Number);
  return { w, h };
}

/**
 * Get aspect ratio from dimensions
 */
export function getAspectRatio(width, height) {
  const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

/**
 * Calculate zoom to fit canvas in container
 */
export function calculateFitZoom(canvasWidth, canvasHeight, containerWidth, containerHeight, padding = 40) {
  const availableWidth = containerWidth - (padding * 2);
  const availableHeight = containerHeight - (padding * 2);
  
  const scaleX = availableWidth / canvasWidth;
  const scaleY = availableHeight / canvasHeight;
  
  return Math.min(scaleX, scaleY, 1); // Never zoom in past 100%
}

/**
 * Get all resolutions as array for dropdowns
 */
export function getResolutionList() {
  return Object.entries(RESOLUTIONS).map(([key, value]) => ({
    key,
    ...value,
    value: `${value.w}x${value.h}`
  }));
}

/**
 * Check if resolution is portrait
 */
export function isPortrait(resKey) {
  const res = getResolution(resKey);
  return res.h > res.w;
}

/**
 * Get opposite orientation resolution
 */
export function flipOrientation(resKey) {
  const res = getResolution(resKey);
  const flipped = { w: res.h, h: res.w };
  
  // Find matching resolution or return custom
  for (const [key, value] of Object.entries(RESOLUTIONS)) {
    if (value.w === flipped.w && value.h === flipped.h) {
      return key;
    }
  }
  
  return `${flipped.w}x${flipped.h}`;
}

export default {
  RESOLUTIONS,
  getResolution,
  getResolutionString,
  parseResolution,
  getAspectRatio,
  calculateFitZoom,
  getResolutionList,
  isPortrait,
  flipOrientation
};

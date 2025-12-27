/**
 * Validators
 * Input validation utilities for mOSm.Cloud
 */

/**
 * Validate email format
 */
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid) {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return re.test(uuid);
}

/**
 * Validate resolution string format (e.g., "1920x1080")
 */
export function isValidResolution(resolution) {
  const re = /^\d+x\d+$/;
  return re.test(resolution);
}

/**
 * Validate menu name
 */
export function isValidMenuName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.trim().length === 0) return false;
  if (name.length > 100) return false;
  return true;
}

/**
 * Validate device name
 */
export function isValidDeviceName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.trim().length === 0) return false;
  if (name.length > 50) return false;
  return true;
}

/**
 * Validate IP address
 */
export function isValidIP(ip) {
  const re = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return re.test(ip);
}

/**
 * Validate MAC address
 */
export function isValidMAC(mac) {
  const re = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  return re.test(mac);
}

/**
 * Sanitize string input
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim().replace(/[<>]/g, '');
}

/**
 * Validate required fields in object
 */
export function validateRequired(obj, requiredFields) {
  const missing = [];
  
  for (const field of requiredFields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      missing.push(field);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Validate menu data
 */
export function validateMenu(data) {
  const errors = [];
  
  if (!isValidMenuName(data.name)) {
    errors.push('Menu name is required and must be under 100 characters');
  }
  
  if (data.organizationId && !isValidUUID(data.organizationId)) {
    errors.push('Invalid organization ID');
  }
  
  if (data.status && !['draft', 'published', 'archived'].includes(data.status)) {
    errors.push('Invalid menu status');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate layout data
 */
export function validateLayout(data) {
  const errors = [];
  
  if (!data.menuId || !isValidUUID(data.menuId)) {
    errors.push('Valid menu ID is required');
  }
  
  if (data.resolution && !isValidResolution(data.resolution)) {
    errors.push('Invalid resolution format (expected WxH)');
  }
  
  if (data.screenIndex !== undefined && (typeof data.screenIndex !== 'number' || data.screenIndex < 1)) {
    errors.push('Screen index must be a positive number');
  }
  
  if (data.orientation && !['landscape', 'portrait'].includes(data.orientation)) {
    errors.push('Invalid orientation');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate device data
 */
export function validateDevice(data) {
  const errors = [];
  
  if (!isValidDeviceName(data.name)) {
    errors.push('Device name is required and must be under 50 characters');
  }
  
  if (!data.organizationId || !isValidUUID(data.organizationId)) {
    errors.push('Valid organization ID is required');
  }
  
  if (data.ipAddress && !isValidIP(data.ipAddress)) {
    errors.push('Invalid IP address format');
  }
  
  if (data.macAddress && !isValidMAC(data.macAddress)) {
    errors.push('Invalid MAC address format');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate screen data
 */
export function validateScreen(data) {
  const errors = [];
  
  if (!data.deviceId || !isValidUUID(data.deviceId)) {
    errors.push('Valid device ID is required');
  }
  
  if (data.resolution && !isValidResolution(data.resolution)) {
    errors.push('Invalid resolution format');
  }
  
  if (data.screenIndex !== undefined && (typeof data.screenIndex !== 'number' || data.screenIndex < 1)) {
    errors.push('Screen index must be a positive number');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  isValidEmail,
  isValidUUID,
  isValidResolution,
  isValidMenuName,
  isValidDeviceName,
  isValidIP,
  isValidMAC,
  sanitizeString,
  validateRequired,
  validateMenu,
  validateLayout,
  validateDevice,
  validateScreen
};

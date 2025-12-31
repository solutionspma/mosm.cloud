/**
 * MOSM Config Client
 * Drop this into MOD OS Menus to fetch configuration from MOSM Cloud
 * 
 * This client:
 * - Fetches location config on boot
 * - Caches config locally
 * - Continues operating with cached config if MOSM is unreachable
 * 
 * CRITICAL: MOD OS must NEVER depend on MOSM at runtime.
 */

const CONFIG_CACHE_KEY = 'mosm_config_cache';
const CONFIG_FETCH_TIMEOUT = 10000; // 10 seconds

class MOSMConfigClient {
  constructor(config) {
    this.mosmBaseUrl = config.mosmBaseUrl || process.env.MOSM_BASE_URL;
    this.serviceKey = config.serviceKey || process.env.MOSM_SERVICE_KEY;
    this.locationId = config.locationId || process.env.LOCATION_ID;
    
    this._cache = null;
    this._lastFetch = null;
  }
  
  /**
   * Get location configuration
   * Tries MOSM first, falls back to cache
   */
  async getLocationConfig() {
    try {
      const config = await this._fetchFromMOSM(`/api/mosm/config/location/${this.locationId}`);
      this._cacheConfig('location', config);
      return config;
    } catch (error) {
      console.warn(`[MOSM] Config fetch failed, using cache: ${error.message}`);
      return this._getCachedConfig('location');
    }
  }
  
  /**
   * Get screen configuration
   */
  async getScreenConfig() {
    try {
      const config = await this._fetchFromMOSM(`/api/mosm/config/screens/${this.locationId}`);
      this._cacheConfig('screens', config);
      return config;
    } catch (error) {
      console.warn(`[MOSM] Screen config fetch failed, using cache: ${error.message}`);
      return this._getCachedConfig('screens');
    }
  }
  
  /**
   * Get feature flags
   */
  async getFeatureFlags() {
    try {
      const config = await this._fetchFromMOSM(`/api/mosm/config/features/${this.locationId}`);
      this._cacheConfig('features', config);
      return config;
    } catch (error) {
      console.warn(`[MOSM] Feature flags fetch failed, using cache: ${error.message}`);
      return this._getCachedConfig('features');
    }
  }
  
  /**
   * Get menu configuration by ID
   */
  async getMenuConfig(menuId) {
    try {
      const config = await this._fetchFromMOSM(`/api/mosm/config/menu/${menuId}`);
      this._cacheConfig(`menu_${menuId}`, config);
      return config;
    } catch (error) {
      console.warn(`[MOSM] Menu config fetch failed, using cache: ${error.message}`);
      return this._getCachedConfig(`menu_${menuId}`);
    }
  }
  
  /**
   * Check if a feature flag is enabled
   */
  async isFeatureEnabled(flagKey, defaultValue = false) {
    try {
      const flags = await this.getFeatureFlags();
      return flags?.flags?.[flagKey]?.enabled ?? defaultValue;
    } catch (error) {
      return defaultValue;
    }
  }
  
  /**
   * Fetch from MOSM with timeout
   */
  async _fetchFromMOSM(path) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG_FETCH_TIMEOUT);
    
    try {
      const response = await fetch(`${this.mosmBaseUrl}${path}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Key': this.serviceKey
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      this._lastFetch = new Date();
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  /**
   * Cache config to localStorage (browser) or memory (Node)
   */
  _cacheConfig(key, config) {
    const cacheEntry = {
      data: config,
      timestamp: new Date().toISOString()
    };
    
    if (typeof localStorage !== 'undefined') {
      try {
        const cache = JSON.parse(localStorage.getItem(CONFIG_CACHE_KEY) || '{}');
        cache[key] = cacheEntry;
        localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(cache));
      } catch (e) {
        // localStorage might be full or disabled
      }
    }
    
    // Also keep in memory
    if (!this._cache) this._cache = {};
    this._cache[key] = cacheEntry;
  }
  
  /**
   * Get cached config
   */
  _getCachedConfig(key) {
    // Try memory first
    if (this._cache?.[key]) {
      return this._cache[key].data;
    }
    
    // Try localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const cache = JSON.parse(localStorage.getItem(CONFIG_CACHE_KEY) || '{}');
        if (cache[key]) {
          return cache[key].data;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    
    return null;
  }
  
  /**
   * Clear all cached config
   */
  clearCache() {
    this._cache = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CONFIG_CACHE_KEY);
    }
  }
  
  /**
   * Get cache status
   */
  getCacheStatus() {
    return {
      lastFetch: this._lastFetch,
      hasCachedData: !!this._cache || 
        (typeof localStorage !== 'undefined' && !!localStorage.getItem(CONFIG_CACHE_KEY))
    };
  }
}

/**
 * Quick start helper
 */
function createConfigClient(locationId, options = {}) {
  return new MOSMConfigClient({
    locationId,
    ...options
  });
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MOSMConfigClient, createConfigClient };
}

if (typeof window !== 'undefined') {
  window.MOSMConfigClient = MOSMConfigClient;
  window.createMOSMConfigClient = createConfigClient;
}

export { MOSMConfigClient, createConfigClient };
export default MOSMConfigClient;

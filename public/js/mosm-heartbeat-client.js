/**
 * MOSM Heartbeat Client
 * Drop this into MOD OS Menus, POS-Lite, or KDS
 * 
 * This client:
 * - Sends heartbeats to MOSM Cloud every 30 seconds
 * - Reports service status (online, degraded)
 * - Continues operating if MOSM is unreachable
 * 
 * CRITICAL: This is fire-and-forget. Never block operations on MOSM.
 */

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 5000;   // 5 second timeout

class MOSMHeartbeatClient {
  constructor(config) {
    this.mosmBaseUrl = config.mosmBaseUrl || process.env.MOSM_BASE_URL;
    this.serviceKey = config.serviceKey || process.env.MOSM_SERVICE_KEY;
    this.service = config.service; // 'modos-menus', 'pos-lite', 'kds'
    this.locationId = config.locationId || process.env.LOCATION_ID;
    this.instanceId = config.instanceId || this._generateInstanceId();
    this.version = config.version || process.env.SERVICE_VERSION || 'unknown';
    this.baseUrl = config.baseUrl || null;
    
    this._intervalId = null;
    this._status = 'online';
    this._lastSuccess = null;
    this._consecutiveFailures = 0;
    
    // Callbacks
    this.onSuccess = config.onSuccess || (() => {});
    this.onError = config.onError || (() => {});
  }
  
  /**
   * Start sending heartbeats
   */
  start() {
    if (this._intervalId) {
      console.warn('[MOSM] Heartbeat already running');
      return;
    }
    
    console.log(`[MOSM] Starting heartbeat for ${this.service} at ${this.locationId}`);
    
    // Send immediately, then on interval
    this._sendHeartbeat();
    this._intervalId = setInterval(() => this._sendHeartbeat(), HEARTBEAT_INTERVAL);
    
    return this;
  }
  
  /**
   * Stop sending heartbeats
   */
  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
      console.log('[MOSM] Heartbeat stopped');
    }
    return this;
  }
  
  /**
   * Update status (call this when service state changes)
   */
  setStatus(status) {
    if (['online', 'degraded'].includes(status)) {
      this._status = status;
      // Send immediate heartbeat on status change
      this._sendHeartbeat();
    }
    return this;
  }
  
  /**
   * Send a single heartbeat
   */
  async _sendHeartbeat() {
    const payload = {
      service: this.service,
      location_id: this.locationId,
      instance_id: this.instanceId,
      status: this._status,
      version: this.version,
      base_url: this.baseUrl,
      metadata: {
        uptime: process.uptime ? Math.floor(process.uptime()) : null,
        memory: process.memoryUsage ? process.memoryUsage().heapUsed : null,
        timestamp: new Date().toISOString()
      }
    };
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT);
      
      const response = await fetch(`${this.mosmBaseUrl}/api/mosm/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Key': this.serviceKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        this._lastSuccess = new Date();
        this._consecutiveFailures = 0;
        this.onSuccess({ timestamp: this._lastSuccess });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      this._consecutiveFailures++;
      
      // Only log every 5th failure to avoid spam
      if (this._consecutiveFailures % 5 === 1) {
        console.warn(`[MOSM] Heartbeat failed (${this._consecutiveFailures}x): ${error.message}`);
      }
      
      this.onError({ 
        error: error.message, 
        consecutiveFailures: this._consecutiveFailures 
      });
      
      // CRITICAL: Never throw. MOSM being down should not affect operations.
    }
  }
  
  /**
   * Generate unique instance ID
   */
  _generateInstanceId() {
    const hostname = typeof window !== 'undefined' 
      ? window.location.hostname 
      : (process.env.HOSTNAME || 'unknown');
    const random = Math.random().toString(36).substring(2, 8);
    return `${hostname}-${random}`;
  }
  
  /**
   * Get client status
   */
  getStatus() {
    return {
      running: !!this._intervalId,
      status: this._status,
      lastSuccess: this._lastSuccess,
      consecutiveFailures: this._consecutiveFailures
    };
  }
}

/**
 * Quick start helper
 */
function createHeartbeat(service, locationId, options = {}) {
  return new MOSMHeartbeatClient({
    service,
    locationId,
    ...options
  });
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MOSMHeartbeatClient, createHeartbeat };
}

if (typeof window !== 'undefined') {
  window.MOSMHeartbeatClient = MOSMHeartbeatClient;
  window.createMOSMHeartbeat = createHeartbeat;
}

export { MOSMHeartbeatClient, createHeartbeat };
export default MOSMHeartbeatClient;

/**
 * Shared Auth Module for mOSm Platform
 * Works across modosmenus.netlify.app and mosm-cloud.netlify.app
 * 
 * Features:
 * - Single sign-on across both platforms
 * - 30-minute session with activity-based refresh
 * - Automatic token refresh
 * - Session persistence across page reloads
 */

// Configuration
const AUTH_CONFIG = {
  supabaseUrl: 'https://ggucwvqjikhjnfnbvwez.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndWN3dnFqaWtoam5mbmJ2d2V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQxMTk0NTUsImV4cCI6MjA0OTY5NTQ1NX0.8e0beHfEkKRsYIJxVfLcDOCKBb5FTj8lhSgcKXxQHZ4',
  sessionTimeout: 30 * 60 * 1000, // 30 minutes in ms
  warningTimeout: 5 * 60 * 1000,  // 5 minute warning before expiry
  storageKeys: {
    session: 'mosm_session',
    user: 'mosm_user',
    lastActivity: 'mosm_last_activity'
  }
};

// Supabase client (loaded from CDN)
let supabase = null;

/**
 * Initialize auth system
 * Call this on every page load
 */
async function initAuth() {
  // Initialize Supabase client if not already done
  if (!supabase && window.supabase) {
    supabase = window.supabase.createClient(
      AUTH_CONFIG.supabaseUrl,
      AUTH_CONFIG.supabaseAnonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
          storageKey: 'mosm_supabase_auth'
        }
      }
    );
  }
  
  // Check for existing session
  const session = await getSession();
  
  if (session) {
    // Update last activity
    updateLastActivity();
    
    // Start session monitor
    startSessionMonitor();
    
    // Listen for auth state changes
    if (supabase) {
      supabase.auth.onAuthStateChange((event, session) => {
        console.log('[Auth] State change:', event);
        
        if (event === 'SIGNED_OUT' || !session) {
          clearSession();
          redirectToLogin();
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('[Auth] Token refreshed');
          saveSession(session);
        }
      });
    }
  }
  
  return session;
}

/**
 * Sign in with email and password
 */
async function signIn(email, password) {
  if (supabase) {
    // Use Supabase client directly for better session management
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    // Save to our localStorage format for compatibility
    saveSession(data.session);
    saveUser(data.user);
    updateLastActivity();
    startSessionMonitor();
    
    return { session: data.session, user: data.user };
  } else {
    // Fallback to API
    const response = await fetch('https://mosm-cloud.netlify.app/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Login failed');
    
    saveSession(data.session);
    saveUser(data.user);
    updateLastActivity();
    startSessionMonitor();
    
    return data;
  }
}

/**
 * Sign up new user
 */
async function signUp(email, password, name) {
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });
    
    if (error) throw error;
    return data;
  } else {
    const response = await fetch('https://mosm-cloud.netlify.app/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Signup failed');
    return data;
  }
}

/**
 * Sign out
 */
async function signOut() {
  if (supabase) {
    await supabase.auth.signOut();
  }
  clearSession();
  redirectToLogin();
}

/**
 * Get current session
 */
async function getSession() {
  // First try Supabase client
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      saveSession(session);
      return session;
    }
  }
  
  // Fall back to localStorage
  const stored = localStorage.getItem(AUTH_CONFIG.storageKeys.session);
  if (stored) {
    try {
      const session = JSON.parse(stored);
      
      // Check if token is expired
      if (session.expires_at && new Date(session.expires_at * 1000) < new Date()) {
        console.log('[Auth] Session expired');
        clearSession();
        return null;
      }
      
      return session;
    } catch (e) {
      console.error('[Auth] Failed to parse session:', e);
      clearSession();
      return null;
    }
  }
  
  return null;
}

/**
 * Get current user
 */
async function getUser() {
  const stored = localStorage.getItem(AUTH_CONFIG.storageKeys.user);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Get access token for API calls
 */
async function getAccessToken() {
  const session = await getSession();
  return session?.access_token || null;
}

/**
 * Save session to localStorage
 */
function saveSession(session) {
  localStorage.setItem(AUTH_CONFIG.storageKeys.session, JSON.stringify(session));
}

/**
 * Save user to localStorage
 */
function saveUser(user) {
  localStorage.setItem(AUTH_CONFIG.storageKeys.user, JSON.stringify(user));
}

/**
 * Clear session from localStorage
 */
function clearSession() {
  localStorage.removeItem(AUTH_CONFIG.storageKeys.session);
  localStorage.removeItem(AUTH_CONFIG.storageKeys.user);
  localStorage.removeItem(AUTH_CONFIG.storageKeys.lastActivity);
  localStorage.removeItem('mosm_supabase_auth');
}

/**
 * Update last activity timestamp
 */
function updateLastActivity() {
  localStorage.setItem(AUTH_CONFIG.storageKeys.lastActivity, Date.now().toString());
}

/**
 * Check if session is within timeout window
 */
function isSessionActive() {
  const lastActivity = localStorage.getItem(AUTH_CONFIG.storageKeys.lastActivity);
  if (!lastActivity) return false;
  
  const elapsed = Date.now() - parseInt(lastActivity);
  return elapsed < AUTH_CONFIG.sessionTimeout;
}

/**
 * Get time until session expires (in ms)
 */
function getTimeUntilExpiry() {
  const lastActivity = localStorage.getItem(AUTH_CONFIG.storageKeys.lastActivity);
  if (!lastActivity) return 0;
  
  const elapsed = Date.now() - parseInt(lastActivity);
  return Math.max(0, AUTH_CONFIG.sessionTimeout - elapsed);
}

/**
 * Redirect to login page
 */
function redirectToLogin() {
  // Determine which platform we're on
  const isModOSMenus = window.location.hostname.includes('modosmenus');
  const currentUrl = window.location.href;
  
  if (isModOSMenus) {
    window.location.href = `/apps/login.html?return=${encodeURIComponent(currentUrl)}`;
  } else {
    window.location.href = `/login.html?return=${encodeURIComponent(currentUrl)}`;
  }
}

/**
 * Start session monitor
 * Tracks activity and warns before expiry
 */
let sessionMonitorInterval = null;
let warningShown = false;

function startSessionMonitor() {
  if (sessionMonitorInterval) {
    clearInterval(sessionMonitorInterval);
  }
  
  // Track user activity
  const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
  const activityHandler = () => {
    updateLastActivity();
    warningShown = false;
    hideExpiryWarning();
  };
  
  activityEvents.forEach(event => {
    document.addEventListener(event, activityHandler, { passive: true });
  });
  
  // Check session every 30 seconds
  sessionMonitorInterval = setInterval(async () => {
    const session = await getSession();
    
    if (!session) {
      console.log('[Auth] No session found');
      redirectToLogin();
      return;
    }
    
    if (!isSessionActive()) {
      console.log('[Auth] Session timeout - no activity');
      signOut();
      return;
    }
    
    const timeLeft = getTimeUntilExpiry();
    
    // Show warning 5 minutes before expiry
    if (timeLeft <= AUTH_CONFIG.warningTimeout && !warningShown) {
      warningShown = true;
      showExpiryWarning(Math.ceil(timeLeft / 60000));
    }
    
  }, 30000);
}

/**
 * Show session expiry warning
 */
function showExpiryWarning(minutesLeft) {
  // Remove existing warning if any
  hideExpiryWarning();
  
  const warning = document.createElement('div');
  warning.id = 'session-expiry-warning';
  warning.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: #fff;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      z-index: 100000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      gap: 12px;
    ">
      <span style="font-size: 24px;">⏰</span>
      <div>
        <div style="font-weight: 600; margin-bottom: 4px;">Session expiring soon</div>
        <div style="font-size: 13px; opacity: 0.9;">Move your mouse to stay signed in</div>
      </div>
      <button onclick="hideExpiryWarning()" style="
        background: rgba(0,0,0,0.2);
        border: none;
        color: #fff;
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
        margin-left: 12px;
      ">✕</button>
    </div>
  `;
  document.body.appendChild(warning);
}

/**
 * Hide session expiry warning
 */
function hideExpiryWarning() {
  const warning = document.getElementById('session-expiry-warning');
  if (warning) {
    warning.remove();
  }
}

/**
 * Require authentication
 * Call this on protected pages - redirects to login if not authenticated
 */
async function requireAuth() {
  const session = await getSession();
  
  if (!session) {
    redirectToLogin();
    return null;
  }
  
  if (!isSessionActive()) {
    console.log('[Auth] Session inactive');
    clearSession();
    redirectToLogin();
    return null;
  }
  
  return session;
}

/**
 * Make authenticated API request
 */
async function authFetch(url, options = {}) {
  const token = await getAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  updateLastActivity();
  
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };
  
  const response = await fetch(url, { ...options, headers });
  
  // Handle 401 - session expired
  if (response.status === 401) {
    clearSession();
    redirectToLogin();
    throw new Error('Session expired');
  }
  
  return response;
}

// Export for use in other scripts
window.MOSMAuth = {
  init: initAuth,
  signIn,
  signUp,
  signOut,
  getSession,
  getUser,
  getAccessToken,
  requireAuth,
  authFetch,
  updateLastActivity,
  isSessionActive,
  getTimeUntilExpiry
};

// Auto-initialize on page load if Supabase is available
document.addEventListener('DOMContentLoaded', () => {
  // Wait for Supabase to load
  if (window.supabase) {
    initAuth();
  } else {
    // If Supabase not loaded, still init with fallback
    setTimeout(initAuth, 100);
  }
});

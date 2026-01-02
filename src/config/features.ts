/**
 * Feature Flags — Phase E Safety Locks
 * 
 * These flags control public access to the platform.
 * Keep both FALSE until ready for controlled launch.
 * 
 * Rule: Revenue-capable, not revenue-seeking.
 */

export const FEATURES = {
  /**
   * Public signup — Allow new users to register
   * FALSE = Only internal/invited users can access
   */
  public_signup: false,

  /**
   * Public checkout — Allow public payment links
   * FALSE = Checkout only callable from authenticated UI
   */
  public_checkout: false,

  /**
   * Self-service portal — Allow users to manage billing
   * FALSE = Admin-only billing management
   */
  self_service_billing: false,
};

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature] === true;
}

/**
 * Require a feature to be enabled, throw if not
 */
export function requireFeature(feature: keyof typeof FEATURES): void {
  if (!isFeatureEnabled(feature)) {
    throw new Error(`Feature '${feature}' is not enabled`);
  }
}

export default FEATURES;

/**
 * Billing Module Index
 * 
 * AUTHORITY: All billing logic lives in mOSm.cloud
 * Edge devices (modOSmenus) NEVER import from this module
 * 
 * Phase C: Test Mode Wiring Complete
 * Phase D: Enforcement Proof Complete
 */

// Stripe client (singleton)
export { stripe } from './stripeClient';

// Checkout & Portal
export { 
  createCheckoutSession, 
  createBillingPortalSession,
  getCheckoutSession,
} from './createCheckout';

// Subscription status queries
export { 
  getAccountBillingStatus, 
  getSubscriptionDetails,
  type BillingStatus,
} from './subscriptionStatus';

// Enforcement functions (Phase D)
export { 
  enforceDeviceLimit, 
  enforceBillingForPairing,
  canAddDevice, 
  getRemainingDeviceSlots,
  isBillingActive,
  logEnforcementEvent,
  getEnforcementLogs,
  ACTIVE_BILLING_STATUSES,
  BLOCKED_BILLING_STATUSES,
} from './enforce';

// Webhook handler
export { handleStripeWebhook } from './webhooks';


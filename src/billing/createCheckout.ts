/**
 * Checkout Session Creator
 * 
 * Phase E: Mode-aware checkout (TEST or LIVE)
 * Phase F: Per-location pricing + setup fees
 * 
 * AUTHORITY: Only mOSm.cloud can initiate billing flows
 * Edge devices never see this
 * 
 * BILLING MODEL:
 * - Stripe bills per account (quantity = location count)
 * - Platform enforces per location
 * - $250 one-time setup fee per new location
 * 
 * SAFETY: Feature flags control public access
 */

import { stripe, stripeMode } from './stripeClient';
import { isFeatureEnabled } from '../config/features';

interface Organization {
  id: string;
  email: string;
  name: string;
  stripe_customer_id?: string;
  active_locations?: number;
}

interface CheckoutOptions {
  plan: 'starter' | 'pro';
  /** Number of locations being billed (for quantity pricing) */
  locationCount?: number;
  /** Number of NEW locations (triggers setup fee) */
  newLocations?: number;
  successUrl?: string;
  cancelUrl?: string;
  /** Bypass public_checkout flag (for internal/admin use) */
  internal?: boolean;
}

/**
 * Get price IDs based on STRIPE_MODE
 * Phase F: Includes setup fee price
 */
const getPriceIds = () => {
  const isLive = stripeMode === 'live';
  return {
    starter: isLive 
      ? process.env.STRIPE_LIVE_PRICE_STARTER || 'price_live_starter'
      : process.env.STRIPE_PRICE_STARTER || 'price_test_starter',
    pro: isLive
      ? process.env.STRIPE_LIVE_PRICE_PRO || 'price_live_pro'
      : process.env.STRIPE_PRICE_PRO || 'price_test_pro',
    setup: isLive
      ? process.env.STRIPE_LIVE_PRICE_SETUP || 'price_live_setup'
      : process.env.STRIPE_PRICE_SETUP || 'price_test_setup',
  };
};

/**
 * Create a checkout session for an organization
 * 
 * Phase F: Per-location billing
 * - Subscription price × locationCount
 * - Setup fee × newLocations (one-time)
 * 
 * SAFETY: Requires public_checkout feature flag OR internal=true
 */
export async function createCheckoutSession(
  org: Organization,
  options: CheckoutOptions
): Promise<{ sessionId: string; url: string }> {
  // SAFETY LOCK: Block public checkout unless explicitly enabled
  if (!options.internal && !isFeatureEnabled('public_checkout')) {
    throw new Error('PUBLIC_CHECKOUT_DISABLED: Checkout not available');
  }

  const priceIds = getPriceIds();
  const planPriceId = priceIds[options.plan];
  const locationCount = options.locationCount || 1;
  const newLocations = options.newLocations || 0;

  // Build line items: subscription + optional setup fee
  const lineItems: Array<{ price: string; quantity: number }> = [
    {
      price: planPriceId,
      quantity: locationCount, // Charge per location
    },
  ];

  // Add setup fee for NEW locations only ($250 one-time)
  if (newLocations > 0) {
    lineItems.push({
      price: priceIds.setup,
      quantity: newLocations,
    });
  }

  // Use existing customer or create via checkout
  const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
    mode: 'subscription',
    line_items: lineItems,
    success_url: options.successUrl || `${process.env.MOSM_BASE_URL || 'http://localhost:8888'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: options.cancelUrl || `${process.env.MOSM_BASE_URL || 'http://localhost:8888'}/billing/cancel`,
    metadata: {
      organization_id: org.id,
      plan: options.plan,
      location_count: String(locationCount),
      new_locations: String(newLocations),
    },
    subscription_data: {
      metadata: {
        organization_id: org.id,
        plan: options.plan,
        location_count: String(locationCount),
      },
    },
  };

  // If org already has a Stripe customer, use it
  if (org.stripe_customer_id) {
    sessionParams.customer = org.stripe_customer_id;
  } else {
    // Otherwise, collect customer info during checkout
    sessionParams.customer_email = org.email;
    sessionParams.customer_creation = 'always';
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return {
    sessionId: session.id,
    url: session.url!,
  };
}

/**
 * Create checkout for adding locations to existing subscription
 * Charges setup fee for new locations only
 */
export async function createLocationAddCheckout(
  org: Organization,
  options: {
    newLocationCount: number;
    plan: 'starter' | 'pro';
    successUrl?: string;
    cancelUrl?: string;
    internal?: boolean;
  }
): Promise<{ sessionId: string; url: string }> {
  // SAFETY LOCK
  if (!options.internal && !isFeatureEnabled('public_checkout')) {
    throw new Error('PUBLIC_CHECKOUT_DISABLED: Checkout not available');
  }

  const priceIds = getPriceIds();

  // Only charge setup fee for new locations (one-time payment)
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', // One-time payment for setup fees
    line_items: [
      {
        price: priceIds.setup,
        quantity: options.newLocationCount,
      },
    ],
    success_url: options.successUrl || `${process.env.MOSM_BASE_URL || 'http://localhost:8888'}/locations/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: options.cancelUrl || `${process.env.MOSM_BASE_URL || 'http://localhost:8888'}/locations`,
    customer: org.stripe_customer_id,
    metadata: {
      organization_id: org.id,
      type: 'location_setup',
      new_location_count: String(options.newLocationCount),
    },
  });

  return {
    sessionId: session.id,
    url: session.url!,
  };
}

/**
 * Update subscription quantity when locations change
 * Called after location is added/removed
 */
export async function updateSubscriptionQuantity(
  subscriptionId: string,
  newLocationCount: number
): Promise<void> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const subscriptionItemId = subscription.items.data[0]?.id;

  if (!subscriptionItemId) {
    throw new Error('No subscription item found');
  }

  await stripe.subscriptionItems.update(subscriptionItemId, {
    quantity: newLocationCount,
  });

  console.log(`📊 Updated subscription ${subscriptionId} to ${newLocationCount} locations`);
}

/**
 * Create a billing portal session for managing subscription
 */
export async function createBillingPortalSession(
  stripeCustomerId: string,
  returnUrl?: string
): Promise<{ url: string }> {
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl || `${process.env.MOSM_BASE_URL || 'http://localhost:8888'}/billing`,
  });

  return { url: session.url };
}

/**
 * Get checkout session details (for success page)
 */
export async function getCheckoutSession(sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'customer'],
  });

  return {
    id: session.id,
    status: session.status,
    customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
    organization_id: session.metadata?.organization_id,
    plan: session.metadata?.plan,
  };
}

/**
 * Stripe Client Wrapper
 * 
 * AUTHORITY: All Stripe communication happens ONLY through mOSm.cloud
 * Edge runtimes (modOSmenus) NEVER talk to Stripe
 * 
 * Phase E: Mode-aware client
 * - STRIPE_MODE=live → Uses live keys
 * - STRIPE_MODE=test → Uses test keys (default)
 */

import Stripe from 'stripe';

const isLive = process.env.STRIPE_MODE === 'live';

const secretKey = isLive
  ? process.env.STRIPE_LIVE_SECRET_KEY
  : process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.warn(`⚠️ STRIPE_${isLive ? 'LIVE_' : ''}SECRET_KEY not set - billing features disabled`);
}

export const stripe = new Stripe(
  secretKey as string,
  { apiVersion: '2024-04-10' }
);

// Export mode for webhook signature verification
export const stripeMode = isLive ? 'live' : 'test';

export default stripe;

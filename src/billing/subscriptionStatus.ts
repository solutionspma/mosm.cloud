/**
 * Subscription Status Check
 * 
 * Read-only query to Stripe for payment status
 * No enforcement here - status only
 */

import { stripe } from './stripeClient';

export type BillingStatus = 'paid' | 'unpaid' | 'past_due' | 'canceled';

export async function getAccountBillingStatus(stripeCustomerId: string): Promise<BillingStatus> {
  try {
    const subs = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 1,
    });

    if (!subs.data.length) return 'unpaid';

    const sub = subs.data[0];
    
    switch (sub.status) {
      case 'active':
      case 'trialing':
        return 'paid';
      case 'past_due':
        return 'past_due';
      case 'canceled':
      case 'unpaid':
        return 'unpaid';
      default:
        return 'unpaid';
    }
  } catch (error) {
    console.error('Failed to fetch billing status:', error);
    return 'unpaid';
  }
}

export async function getSubscriptionDetails(stripeCustomerId: string) {
  const subs = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'active',
    limit: 1,
    expand: ['data.items.data.price.product'],
  });

  if (!subs.data.length) return null;

  const sub = subs.data[0];
  return {
    id: sub.id,
    status: sub.status,
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_period_end: sub.cancel_at_period_end,
  };
}

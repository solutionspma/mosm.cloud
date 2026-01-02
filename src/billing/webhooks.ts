/**
 * Stripe Webhook Handler
 * 
 * PHASE C: Test Mode Wiring
 * PHASE E: Mode-aware signature verification (TEST + LIVE)
 * 
 * Handles Stripe webhook events and syncs billing state to Supabase
 * This is where Stripe → Platform state sync happens
 * 
 * AUTHORITY: Only mOSm.cloud processes billing webhooks
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { stripeMode } from './stripeClient';

// Initialize Supabase admin client for webhook processing
const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

/**
 * Get webhook secret based on STRIPE_MODE
 * Phase E: Supports both TEST and LIVE webhooks
 */
function getWebhookSecret(): string {
  const isLive = stripeMode === 'live';
  const secret = isLive
    ? process.env.STRIPE_LIVE_WEBHOOK_SECRET
    : process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!secret) {
    throw new Error(`STRIPE_${isLive ? 'LIVE_' : ''}WEBHOOK_SECRET not configured`);
  }
  
  return secret;
}

interface WebhookRequest {
  rawBody: Buffer | string;
  headers: Record<string, string>;
}

interface WebhookResponse {
  status: number;
  body: Record<string, unknown>;
}

type BillingStatus = 'unpaid' | 'paid' | 'past_due' | 'canceled' | 'trialing';

/**
 * Map Stripe subscription status to our billing status
 */
function mapSubscriptionStatus(stripeStatus: Stripe.Subscription.Status): BillingStatus {
  switch (stripeStatus) {
    case 'active':
      return 'paid';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return 'unpaid';
    default:
      return 'unpaid';
  }
}

/**
 * Main webhook handler
 * Phase E: Uses mode-aware webhook secret
 */
export async function handleStripeWebhook(req: WebhookRequest): Promise<WebhookResponse> {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return { status: 400, body: { error: 'Missing signature' } };
  }

  let event: Stripe.Event;
  
  try {
    const webhookSecret = getWebhookSecret();
    event = Stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return { status: 400, body: { error: 'Invalid signature' } };
  }

  console.log(`📨 Stripe webhook [${stripeMode.toUpperCase()}]: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return { status: 200, body: { received: true } };
  } catch (error) {
    console.error(`❌ Webhook handler error:`, error);
    return { status: 500, body: { error: 'Webhook handler failed' } };
  }
}

/**
 * Handle checkout.session.completed
 * This is the PRIMARY entry point for new subscriptions
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organization_id;
  const plan = session.metadata?.plan || 'starter';
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  if (!organizationId) {
    console.error('❌ No organization_id in checkout session metadata');
    return;
  }

  console.log(`✅ Checkout completed for org ${organizationId}, plan: ${plan}`);

  const { error } = await supabase
    .from('organizations')
    .update({
      stripe_customer_id: customerId,
      subscription_id: subscriptionId,
      billing_status: 'paid',
      current_plan: plan,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId);

  if (error) {
    console.error('❌ Failed to update org billing status:', error);
    throw error;
  }

  console.log(`✅ Org ${organizationId} billing_status → paid`);
}

/**
 * Handle subscription create/update
 */
async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' 
    ? subscription.customer 
    : subscription.customer.id;
  
  const billingStatus = mapSubscriptionStatus(subscription.status);
  const plan = subscription.metadata?.plan || 'starter';

  console.log(`🔄 Subscription ${subscription.id} status: ${subscription.status} → ${billingStatus}`);

  const { error } = await supabase
    .from('organizations')
    .update({
      subscription_id: subscription.id,
      subscription_status: subscription.status,
      billing_status: billingStatus,
      current_plan: plan,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  if (error) {
    console.error('❌ Failed to update subscription status:', error);
    throw error;
  }
}

/**
 * Handle subscription deleted (canceled)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' 
    ? subscription.customer 
    : subscription.customer.id;

  console.log(`🚫 Subscription ${subscription.id} deleted for customer ${customerId}`);

  const { error } = await supabase
    .from('organizations')
    .update({
      billing_status: 'unpaid',
      subscription_status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  if (error) {
    console.error('❌ Failed to mark org as unpaid:', error);
    throw error;
  }

  console.log(`✅ Customer ${customerId} billing_status → unpaid`);
}

/**
 * Handle payment failed
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string' 
    ? invoice.customer 
    : invoice.customer?.id;

  if (!customerId) return;

  console.log(`⚠️ Payment failed for customer ${customerId}`);

  const { error } = await supabase
    .from('organizations')
    .update({
      billing_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId);

  if (error) {
    console.error('❌ Failed to mark org as past_due:', error);
    throw error;
  }
}


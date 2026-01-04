/**
 * Stripe Billing API
 * Netlify Function
 * 
 * Phase E: Mode-aware (TEST/LIVE)
 * Phase F: Per-location billing + setup fees
 * 
 * Routes:
 * POST /api/billing/webhook     - Stripe webhook endpoint
 * POST /api/billing/checkout    - Create checkout session
 * POST /api/billing/portal      - Create billing portal session (self-service)
 * GET  /api/billing/status      - Get org billing status
 * POST /api/billing/location-setup - Checkout for new location setup fee
 */

import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Phase E: Mode-aware Stripe client
const isLive = process.env.STRIPE_MODE === 'live';
const stripeSecretKey = isLive 
  ? process.env.STRIPE_LIVE_SECRET_KEY 
  : process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = isLive
  ? process.env.STRIPE_LIVE_WEBHOOK_SECRET
  : process.env.STRIPE_WEBHOOK_SECRET;

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-04-10',
});

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Stripe-Signature'
};

// Phase F: Mode-aware price IDs (per-location + setup)
const getPriceIds = () => ({
  starter: isLive 
    ? process.env.STRIPE_LIVE_PRICE_STARTER 
    : process.env.STRIPE_PRICE_STARTER,
  pro: isLive 
    ? process.env.STRIPE_LIVE_PRICE_PRO 
    : process.env.STRIPE_PRICE_PRO,
  setup: isLive
    ? process.env.STRIPE_LIVE_PRICE_SETUP
    : process.env.STRIPE_PRICE_SETUP,
});

/**
 * Map Stripe status to billing status
 */
function mapSubscriptionStatus(status) {
  switch (status) {
    case 'active': return 'paid';
    case 'trialing': return 'trialing';
    case 'past_due': return 'past_due';
    default: return 'unpaid';
  }
}

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path
    .replace('/.netlify/functions/billing', '')
    .replace('/api/billing', '');
  const method = event.httpMethod;

  console.log(`📊 Billing API [${isLive ? 'LIVE' : 'TEST'}]: ${method} ${path}`);

  try {
    // =====================================================
    // POST /webhook - Stripe webhook handler
    // =====================================================
    if (method === 'POST' && path === '/webhook') {
      const sig = event.headers['stripe-signature'];
      
      if (!sig) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing stripe-signature header' })
        };
      }

      let stripeEvent;
      try {
        stripeEvent = stripe.webhooks.constructEvent(
          event.body,
          sig,
          stripeWebhookSecret
        );
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid signature' })
        };
      }

      console.log(`📨 Stripe webhook [${isLive ? 'LIVE' : 'TEST'}]: ${stripeEvent.type}`);

      // Handle events
      switch (stripeEvent.type) {
        case 'checkout.session.completed': {
          const session = stripeEvent.data.object;
          const orgId = session.metadata?.organization_id;
          const plan = session.metadata?.plan || 'starter';
          const checkoutType = session.metadata?.type;
          const locationCount = parseInt(session.metadata?.location_count || '1', 10);
          
          // Phase F: Handle location setup fee checkout
          if (checkoutType === 'location_setup') {
            const newLocationCount = parseInt(session.metadata?.new_location_count || '0', 10);
            console.log(`📍 Location setup fee paid: ${newLocationCount} locations`);
            // Location activation handled separately
            break;
          }
          
          if (orgId) {
            await supabase
              .from('organizations')
              .update({
                stripe_customer_id: session.customer,
                subscription_id: session.subscription,
                billing_status: 'paid',
                current_plan: plan,
                active_locations: locationCount,
                updated_at: new Date().toISOString(),
              })
              .eq('id', orgId);
            
            console.log(`✅ Org ${orgId} → paid (${plan}, ${locationCount} locations)`);
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = stripeEvent.data.object;
          const billingStatus = mapSubscriptionStatus(subscription.status);
          
          await supabase
            .from('organizations')
            .update({
              billing_status: billingStatus,
              subscription_status: subscription.status,
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', subscription.customer);
          
          console.log(`🔄 Subscription updated → ${billingStatus}`);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = stripeEvent.data.object;
          
          await supabase
            .from('organizations')
            .update({
              billing_status: 'unpaid',
              subscription_status: 'canceled',
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_customer_id', subscription.customer);
          
          console.log(`🚫 Subscription canceled → unpaid`);
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = stripeEvent.data.object;
          
          if (invoice.customer) {
            await supabase
              .from('organizations')
              .update({
                billing_status: 'past_due',
                updated_at: new Date().toISOString(),
              })
              .eq('stripe_customer_id', invoice.customer);
            
            console.log(`⚠️ Payment failed → past_due`);
          }
          break;
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ received: true })
      };
    }

    // =====================================================
    // POST /checkout - Create checkout session
    // =====================================================
    if (method === 'POST' && path === '/checkout') {
      const body = JSON.parse(event.body || '{}');
      const { organizationId, plan = 'starter' } = body;

      if (!organizationId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'organizationId is required' })
        };
      }

      // Get org details
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, stripe_customer_id')
        .eq('id', organizationId)
        .single();

      if (orgError || !org) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Organization not found' })
        };
      }

      // Get owner email
      const { data: owner } = await supabase
        .from('users')
        .select('email')
        .eq('organization_id', organizationId)
        .eq('role', 'owner')
        .single();

      const PRICE_IDS = getPriceIds();
      const priceId = PRICE_IDS[plan];
      if (!priceId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Invalid plan: ${plan}. Configure STRIPE_PRICE_${plan.toUpperCase()}` })
        };
      }

      // Phase F: Per-location billing
      const locationCount = body.locationCount || 1;
      const newLocations = body.newLocations || locationCount; // All locations are new on first checkout

      // Build line items
      const lineItems = [
        { price: priceId, quantity: locationCount }
      ];

      // Add setup fee for new locations ($250 each)
      if (newLocations > 0 && PRICE_IDS.setup) {
        lineItems.push({
          price: PRICE_IDS.setup,
          quantity: newLocations,
        });
      }

      const sessionParams = {
        mode: 'subscription',
        line_items: lineItems,
        success_url: `${process.env.MOSM_BASE_URL || 'http://localhost:8888'}/payment-success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.MOSM_BASE_URL || 'http://localhost:8888'}/checkout.html`,
        metadata: {
          organization_id: organizationId,
          plan: plan,
          location_count: String(locationCount),
          new_locations: String(newLocations),
        },
        subscription_data: {
          metadata: {
            organization_id: organizationId,
            plan: plan,
            location_count: String(locationCount),
          },
        },
      };

      if (org.stripe_customer_id) {
        sessionParams.customer = org.stripe_customer_id;
      } else if (owner?.email) {
        sessionParams.customer_email = owner.email;
        sessionParams.customer_creation = 'always';
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          sessionId: session.id,
          url: session.url 
        })
      };
    }

    // =====================================================
    // POST /portal - Create billing portal session (Phase F: Self-Service)
    // =====================================================
    if (method === 'POST' && path === '/portal') {
      const body = JSON.parse(event.body || '{}');
      const { organizationId } = body;

      if (!organizationId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'organizationId is required' })
        };
      }

      const { data: org } = await supabase
        .from('organizations')
        .select('stripe_customer_id')
        .eq('id', organizationId)
        .single();

      if (!org?.stripe_customer_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'No billing account found' })
        };
      }

      // Phase F: Customer self-service portal
      // Customers can: view invoices, update payment, cancel subscription
      // Customers cannot: pause, modify plan directly (must go through our UI)
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: `${process.env.MOSM_BASE_URL || 'http://localhost:8888'}/billing`,
      });

      console.log(`🔑 Portal session created for org ${organizationId}`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ url: session.url })
      };
    }

    // =====================================================
    // POST /location-setup - Create checkout for new location setup fee
    // Phase F: Per-location setup fees
    // =====================================================
    if (method === 'POST' && path === '/location-setup') {
      const body = JSON.parse(event.body || '{}');
      const { organizationId, newLocationCount = 1 } = body;

      if (!organizationId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'organizationId is required' })
        };
      }

      const { data: org } = await supabase
        .from('organizations')
        .select('stripe_customer_id')
        .eq('id', organizationId)
        .single();

      if (!org?.stripe_customer_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'No billing account found. Complete initial checkout first.' })
        };
      }

      const PRICE_IDS = getPriceIds();
      if (!PRICE_IDS.setup) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Setup fee price not configured' })
        };
      }

      // One-time payment for setup fees
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price: PRICE_IDS.setup,
            quantity: newLocationCount,
          },
        ],
        customer: org.stripe_customer_id,
        success_url: `${process.env.MOSM_BASE_URL || 'http://localhost:8888'}/locations/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.MOSM_BASE_URL || 'http://localhost:8888'}/locations`,
        metadata: {
          organization_id: organizationId,
          type: 'location_setup',
          new_location_count: String(newLocationCount),
        },
      });

      console.log(`📍 Location setup checkout: ${newLocationCount} locations × $250`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          sessionId: session.id,
          url: session.url,
          setupFeeTotal: newLocationCount * 250,
        })
      };
    }

    // =====================================================
    // GET /status - Get billing status for org
    // =====================================================
    if (method === 'GET' && path === '/status') {
      const organizationId = event.queryStringParameters?.organizationId;

      if (!organizationId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'organizationId is required' })
        };
      }

      const { data: org, error } = await supabase
        .from('organizations')
        .select('billing_status, current_plan, subscription_id, current_period_end, active_locations')
        .eq('id', organizationId)
        .single();

      if (error || !org) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Organization not found' })
        };
      }

      // Phase F: Include location count in status
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          billing_status: org.billing_status || 'unpaid',
          current_plan: org.current_plan || 'starter',
          has_subscription: !!org.subscription_id,
          current_period_end: org.current_period_end,
          active_locations: org.active_locations || 0,
          stripe_mode: isLive ? 'live' : 'test',
        })
      };
    }

    // 404 for unknown routes
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (error) {
    console.error('Billing API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

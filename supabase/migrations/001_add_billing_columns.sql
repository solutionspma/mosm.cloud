-- Migration: Add billing columns to organizations
-- Run this in Supabase SQL Editor
-- Phase C: Stripe Test Mode Wiring

-- Add billing columns to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS current_plan TEXT DEFAULT 'starter',
ADD COLUMN IF NOT EXISTS subscription_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT,
ADD COLUMN IF NOT EXISTS billing_email TEXT,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Add constraint for billing_status values
ALTER TABLE organizations
DROP CONSTRAINT IF EXISTS organizations_billing_status_check;

ALTER TABLE organizations
ADD CONSTRAINT organizations_billing_status_check 
CHECK (billing_status IN ('unpaid', 'paid', 'past_due', 'canceled', 'trialing'));

-- Add constraint for current_plan values (align with billing contract)
ALTER TABLE organizations
DROP CONSTRAINT IF EXISTS organizations_current_plan_check;

ALTER TABLE organizations
ADD CONSTRAINT organizations_current_plan_check 
CHECK (current_plan IN ('starter', 'pro', 'enterprise'));

-- Create index for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer 
ON organizations(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_organizations_billing_status 
ON organizations(billing_status);

-- Comment for documentation
COMMENT ON COLUMN organizations.stripe_customer_id IS 'Stripe customer ID (cus_xxx)';
COMMENT ON COLUMN organizations.billing_status IS 'Current billing status: unpaid, paid, past_due, canceled, trialing';
COMMENT ON COLUMN organizations.current_plan IS 'Current plan: starter, pro, enterprise';
COMMENT ON COLUMN organizations.subscription_id IS 'Active Stripe subscription ID (sub_xxx)';
COMMENT ON COLUMN organizations.subscription_status IS 'Raw Stripe subscription status';
COMMENT ON COLUMN organizations.current_period_end IS 'When current billing period ends';

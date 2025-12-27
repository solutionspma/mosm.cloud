/**
 * Organizations API Endpoint
 * Handles organization CRUD operations
 * 
 * Routes:
 * GET  /api/organizations        - Get user's organization
 * POST /api/organizations        - Create new organization
 * PUT  /api/organizations/:id    - Update organization
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Helper to get user from token
async function getUserFromToken(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return user;
}

// Generate URL-friendly slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Math.random().toString(36).substring(2, 8);
}

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/organizations', '').replace('/api/organizations', '');
  const method = event.httpMethod;

  try {
    // Get authenticated user
    const user = await getUserFromToken(event.headers.authorization);
    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    let body = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }

    // GET / - Get user's organization
    if (method === 'GET' && (path === '' || path === '/')) {
      // First get user profile to find org_id
      const { data: userProfile, error: userError } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (userError || !userProfile?.organization_id) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            organization: null,
            requiresOnboarding: true 
          })
        };
      }

      // Get the organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', userProfile.organization_id)
        .single();

      if (orgError) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            organization: null,
            requiresOnboarding: true 
          })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          organization: org,
          requiresOnboarding: false 
        })
      };
    }

    // POST / - Create new organization
    if (method === 'POST' && (path === '' || path === '/')) {
      const { name, timezone, currency, logoUrl } = body;

      if (!name) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Organization name is required' })
        };
      }

      // Check if user already has an organization
      const { data: existingUser } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (existingUser?.organization_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'User already belongs to an organization' })
        };
      }

      // Create the organization
      const { data: org, error: createError } = await supabase
        .from('organizations')
        .insert({
          name,
          slug: generateSlug(name),
          owner_id: user.id,
          timezone: timezone || 'America/New_York',
          settings: { currency: currency || 'USD' },
          logo_url: logoUrl || null
        })
        .select()
        .single();

      if (createError) {
        console.error('Create org error:', createError);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to create organization', details: createError.message })
        };
      }

      // Update user to belong to this org and set as owner
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          organization_id: org.id,
          role: 'owner'
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Update user error:', updateError);
        // Rollback org creation
        await supabase.from('organizations').delete().eq('id', org.id);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to assign organization to user' })
        };
      }

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ 
          organization: org,
          message: 'Organization created successfully'
        })
      };
    }

    // PUT /:id - Update organization
    if (method === 'PUT' && path.length > 1) {
      const orgId = path.substring(1);
      const { name, timezone, currency, logoUrl, settings } = body;

      // Verify user owns this org
      const { data: userProfile } = await supabase
        .from('users')
        .select('organization_id, role')
        .eq('id', user.id)
        .single();

      if (userProfile?.organization_id !== orgId || !['owner', 'manager'].includes(userProfile?.role)) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({ error: 'Not authorized to update this organization' })
        };
      }

      const updates = {};
      if (name) updates.name = name;
      if (timezone) updates.timezone = timezone;
      if (logoUrl !== undefined) updates.logo_url = logoUrl;
      if (settings || currency) {
        updates.settings = { ...(settings || {}), currency: currency || 'USD' };
      }

      const { data: org, error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', orgId)
        .select()
        .single();

      if (error) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Failed to update organization' })
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ organization: org })
      };
    }

    // Route not found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (error) {
    console.error('Organizations error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

/**
 * Invites API Endpoint
 * Handles team member invitation operations
 * 
 * Routes:
 * GET    /api/invites         - Get pending invites for organization
 * POST   /api/invites         - Create/send a new invite
 * GET    /api/invites/:id     - Get specific invite details
 * DELETE /api/invites/:id     - Cancel an invite
 * POST   /api/invites/:id/accept - Accept an invite
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Use service key - same as other working functions
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/**
 * Get user from authorization header - same pattern as organizations.js
 */
async function getUserFromToken(authHeader) {
  if (!authHeader) {
    console.log('No auth header provided');
    return null;
  }
  
  const token = authHeader.replace('Bearer ', '');
  console.log('Validating token, length:', token.length);
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error) {
    console.error('Auth error:', error.message, error.status);
    return null;
  }
  
  console.log('User authenticated:', user?.email);
  return user;
}

/**
 * Get user's organization ID - tries multiple methods
 */
async function getUserOrganization(userId, userEmail) {
  // First try users table by ID
  const { data: userData } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .single();
  
  if (userData?.organization_id) {
    return userData.organization_id;
  }
  
  // Try users table by email
  if (userEmail) {
    const { data: emailUser } = await supabase
      .from('users')
      .select('organization_id')
      .eq('email', userEmail.toLowerCase())
      .single();
    
    if (emailUser?.organization_id) {
      return emailUser.organization_id;
    }
  }
  
  // Last resort: find org where this user is owner
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', userId)
    .single();
  
  if (org?.id) {
    return org.id;
  }
  
  return null;
}

/**
 * Parse invite ID from path
 */
function getInviteId(path) {
  const match = path.match(/\/([^\/]+)/);
  return match ? match[1] : null;
}

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/invites', '').replace('/api/invites', '');
  const method = event.httpMethod;

  console.log('Invites API called:', method, path);
  console.log('Auth header present:', !!event.headers.authorization);

  try {
    // Get authenticated user
    const user = await getUserFromToken(event.headers.authorization);
    if (!user) {
      console.log('Authentication failed - no user returned');
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized - invalid or expired token' })
      };
    }

    let body = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }

    // GET /invites - List pending invites for user's organization
    if (method === 'GET' && (path === '' || path === '/')) {
      const organizationId = await getUserOrganization(user.id, user.email);
      
      if (!organizationId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'User is not part of an organization' })
        };
      }

      const { data, error } = await supabase
        .from('invites')
        .select('*, inviter:users!invites_invited_by_fkey(email)')
        .eq('organization_id', organizationId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ invites: data || [] })
      };
    }

    // POST /invites - Create and send invite
    if (method === 'POST' && (path === '' || path === '/')) {
      let { email, role = 'viewer' } = body;

      if (!email) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email is required' })
        };
      }

      // Map common role aliases to valid roles
      const roleMap = {
        'admin': 'manager',
        'editor': 'designer',
        'view': 'viewer'
      };
      if (roleMap[role]) {
        role = roleMap[role];
      }

      // Validate role
      const validRoles = ['owner', 'manager', 'designer', 'viewer'];
      if (!validRoles.includes(role)) {
        role = 'viewer'; // Default to viewer if invalid
      }

      // Get user's organization
      const organizationId = await getUserOrganization(user.id, user.email);
      if (!organizationId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'User is not part of an organization' })
        };
      }

      // Check if email already has a pending invite
      const { data: existingInvite } = await supabase
        .from('invites')
        .select('id')
        .eq('email', email.toLowerCase())
        .eq('organization_id', organizationId)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (existingInvite) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'An invitation has already been sent to this email' })
        };
      }

      // Check if email is already a member
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .eq('organization_id', organizationId)
        .single();

      if (existingUser) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'This person is already a member of your organization' })
        };
      }

      // Create invite with 7-day expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data: invite, error } = await supabase
        .from('invites')
        .insert({
          email: email.toLowerCase(),
          organization_id: organizationId,
          role,
          invited_by: user.id,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Get organization name for the response
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();

      // TODO: Send email notification (integrate with email service)
      // For now, just return success - the invite will be visible in the invites list

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({
          invite,
          message: `Invitation sent to ${email}`,
          organization: org?.name
        })
      };
    }

    // Check for invite ID routes
    const inviteId = getInviteId(path);

    if (inviteId) {
      // GET /invites/:id - Get specific invite
      if (method === 'GET' && !path.includes('/accept')) {
        const { data, error } = await supabase
          .from('invites')
          .select('*, organization:organizations(name), inviter:users!invites_invited_by_fkey(email)')
          .eq('id', inviteId)
          .single();

        if (error) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Invite not found' })
          };
        }

        // Check if invite is valid
        const isExpired = new Date(data.expires_at) < new Date();
        const isAccepted = !!data.accepted_at;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            invite: data,
            status: isAccepted ? 'accepted' : isExpired ? 'expired' : 'pending'
          })
        };
      }

      // POST /invites/:id/accept - Accept invite
      if (method === 'POST' && path.endsWith('/accept')) {
        // Get the invite
        const { data: invite, error: fetchError } = await supabase
          .from('invites')
          .select('*')
          .eq('id', inviteId)
          .single();

        if (fetchError || !invite) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Invite not found' })
          };
        }

        // Check if invite is still valid
        if (invite.accepted_at) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'This invitation has already been accepted' })
          };
        }

        if (new Date(invite.expires_at) < new Date()) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'This invitation has expired' })
          };
        }

        // Check if user email matches invite email
        if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'This invitation is for a different email address' })
          };
        }

        // Update user's organization
        const { error: updateError } = await supabase
          .from('users')
          .update({
            organization_id: invite.organization_id,
            role: invite.role
          })
          .eq('id', user.id);

        if (updateError) throw updateError;

        // Mark invite as accepted
        await supabase
          .from('invites')
          .update({ accepted_at: new Date().toISOString() })
          .eq('id', inviteId);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Invitation accepted successfully' })
        };
      }

      // DELETE /invites/:id - Cancel invite
      if (method === 'DELETE') {
        const organizationId = await getUserOrganization(user.id, user.email);
        
        // Verify the invite belongs to user's organization
        const { data: invite, error: fetchError } = await supabase
          .from('invites')
          .select('organization_id')
          .eq('id', inviteId)
          .single();

        if (fetchError || !invite || invite.organization_id !== organizationId) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Invite not found' })
          };
        }

        const { error } = await supabase
          .from('invites')
          .delete()
          .eq('id', inviteId);

        if (error) throw error;

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Invitation cancelled' })
        };
      }
    }

    // Not found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (error) {
    console.error('Invites API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    };
  }
}

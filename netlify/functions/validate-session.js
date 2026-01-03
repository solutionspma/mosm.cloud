import { createClient } from '@supabase/supabase-js';

/**
 * SESSION VALIDATION ENDPOINT
 * 
 * AUTHORITY: This is the ONLY place that validates sessions.
 * modOSmenus calls this endpoint - it does NOT validate locally.
 */

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { token } = JSON.parse(event.body);

    if (!token) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          valid: false,
          message: 'Token required' 
        })
      };
    }

    // Validate the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Token validation failed:', error);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          valid: false,
          message: 'Invalid or expired token' 
        })
      };
    }

    // Get user's organization info
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, organizations(*)')
      .eq('id', user.id)
      .single();

    // Return validation success with user data
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.user_metadata?.role || 'owner',
          org_id: profile?.organization_id || null,
          org_name: profile?.organizations?.name || null
        },
        expires_at: user.exp || null
      })
    };

  } catch (err) {
    console.error('Session validation error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        valid: false,
        message: 'Validation failed',
        error: err.message 
      })
    };
  }
};

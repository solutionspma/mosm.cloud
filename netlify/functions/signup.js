/**
 * Enhanced Signup API Endpoint
 * Handles new user registration with business information
 * 
 * POST /api/signup
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export async function handler(event, context) {
  // Handle CORS preflight
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
    const body = JSON.parse(event.body || '{}');
    const { 
      email, 
      password, 
      full_name,
      business_name,
      organization_type,
      role,
      locations
    } = body;
    
    // Validate required fields
    if (!email || !password || !full_name || !business_name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required fields: email, password, full_name, business_name' 
        })
      };
    }
    
    if (password.length < 8) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Password must be at least 8 characters' 
        })
      };
    }
    
    // Create auth user with Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          name: full_name,
          business_name,
          organization_type,
          role,
          locations
        },
        emailRedirectTo: 'https://mosm.cloud/dashboard.html'
      }
    });
    
    if (authError) {
      console.error('Signup auth error:', authError);
      return {
        statusCode: authError.status || 400,
        headers,
        body: JSON.stringify({ 
          error: authError.message || 'Failed to create account'
        })
      };
    }
    
    const userId = authData.user?.id;
    
    if (!userId) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'User created but ID not returned' })
      };
    }
    
    // Create organization record
    try {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: business_name,
          owner_id: userId,
          organization_type,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (orgError) {
        console.error('Error creating organization:', orgError);
        // Don't fail signup if org creation fails - can be fixed later
      }
      
      // Create user profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          full_name,
          email,
          role,
          organization_id: orgData?.id,
          created_at: new Date().toISOString()
        });
      
      if (profileError) {
        console.error('Error creating profile:', profileError);
      }
      
      // Store location count in metadata
      if (locations) {
        const { error: metaError } = await supabase
          .from('user_metadata')
          .insert({
            user_id: userId,
            key: 'locations',
            value: locations,
            created_at: new Date().toISOString()
          });
        
        if (metaError) {
          console.error('Error storing location metadata:', metaError);
        }
      }
    } catch (dbError) {
      console.error('Database error during signup:', dbError);
      // User account is created, but some data may be missing
      // They can complete it later in onboarding
    }
    
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ 
        success: true,
        user: authData.user,
        message: 'Account created successfully! Check your email to verify your account.'
      })
    };
    
  } catch (error) {
    console.error('Signup error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message || 'Internal server error' 
      })
    };
  }
}

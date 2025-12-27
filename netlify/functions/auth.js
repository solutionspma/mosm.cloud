/**
 * Auth API Endpoint
 * Handles authentication operations
 * 
 * Routes:
 * POST /api/auth/signup
 * POST /api/auth/signin
 * POST /api/auth/signout
 * GET  /api/auth/session
 * POST /api/auth/reset-password
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export async function handler(event, context) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  const path = event.path.replace('/.netlify/functions/auth', '').replace('/api/auth', '');
  const method = event.httpMethod;
  
  try {
    let body = {};
    if (event.body) {
      body = JSON.parse(event.body);
    }
    
    // POST /signup
    if (method === 'POST' && path === '/signup') {
      const { email, password, name } = body;
      
      if (!email || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email and password are required' })
        };
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name: name || '' }
        }
      });
      
      if (error) throw error;
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ user: data.user, session: data.session })
      };
    }
    
    // POST /signin
    if (method === 'POST' && path === '/signin') {
      const { email, password } = body;
      
      if (!email || !password) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email and password are required' })
        };
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ user: data.user, session: data.session })
      };
    }
    
    // POST /signout
    if (method === 'POST' && path === '/signout') {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Signed out successfully' })
      };
    }
    
    // GET /session
    if (method === 'GET' && path === '/session') {
      const authHeader = event.headers.authorization;
      
      if (!authHeader) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'No authorization header' })
        };
      }
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ user })
      };
    }
    
    // POST /reset-password
    if (method === 'POST' && path === '/reset-password') {
      const { email } = body;
      
      if (!email) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Email is required' })
        };
      }
      
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'Password reset email sent' })
      };
    }
    
    // Route not found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };
    
  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: error.status || 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
}

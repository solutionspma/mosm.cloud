/**
 * Supabase Client
 * Singleton client for Supabase connections
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

/**
 * Public client (uses anon key)
 * Use for client-side operations
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Admin client (uses service key)
 * Use for server-side operations that need elevated permissions
 */
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/**
 * Get authenticated client for a specific user
 */
export function getAuthenticatedClient(accessToken) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

export default supabase;

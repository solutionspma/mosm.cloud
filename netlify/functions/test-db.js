/**
 * Test Database Connection
 * GET /api/test-db
 */

import { createClient } from '@supabase/supabase-js';

export async function handler(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  
  // Check if env vars are set
  const envStatus = {
    SUPABASE_URL: supabaseUrl ? `Set (${supabaseUrl.substring(0, 30)}...)` : 'NOT SET',
    SUPABASE_SERVICE_KEY: supabaseServiceKey ? `Set (${supabaseServiceKey.substring(0, 20)}...)` : 'NOT SET'
  };
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Missing environment variables',
        envStatus
      })
    };
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Try to count menus
    const { count, error } = await supabase
      .from('menus')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Database query failed',
          details: error.message,
          envStatus
        })
      };
    }
    
    // Try to list all menus
    const { data: menus, error: listError } = await supabase
      .from('menus')
      .select('id, name, organization_id, created_by, status')
      .limit(10);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        envStatus,
        menuCount: count,
        menus: menus || [],
        listError: listError?.message
      })
    };
    
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Connection failed',
        details: err.message,
        envStatus
      })
    };
  }
}

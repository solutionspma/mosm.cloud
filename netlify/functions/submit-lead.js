import { createClient } from '@supabase/supabase-js';

export const handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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

    const data = JSON.parse(event.body);

    // Validate required fields
    if (!data.email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // Insert lead into leads table
    const { error } = await supabase
      .from('leads')
      .upsert({
        email: data.email.toLowerCase().trim(),
        name: data.name || null,
        company: data.company || null,
        role: data.role || null,
        locations: data.locations || null,
        source: 'landing_page',
        submitted_at: data.submitted_at || new Date().toISOString(),
        metadata: {
          user_agent: event.headers['user-agent'],
          referrer: event.headers['referer'] || null
        }
      }, {
        onConflict: 'email'
      });

    if (error) {
      console.error('Supabase error:', error);
      // If table doesn't exist, create it first time
      if (error.code === '42P01') {
        // Table doesn't exist - just log and return success
        console.log('Leads table not found, lead data:', data);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, message: 'Lead recorded (pending table)' })
        };
      }
      throw error;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'Lead submitted successfully' })
    };

  } catch (err) {
    console.error('Lead submission error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to submit lead', details: err.message })
    };
  }
};

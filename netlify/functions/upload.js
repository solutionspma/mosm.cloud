/**
 * Image Upload API Endpoint
 * 
 * Handles image uploads to Supabase Storage
 * POST /api/upload - Upload an image file
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Storage bucket name
const BUCKET_NAME = 'menu-images';

/**
 * Extract user from authorization header
 */
async function getUser(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

/**
 * Ensure storage bucket exists
 */
async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === BUCKET_NAME);
  
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      fileSizeLimit: 10485760 // 10MB
    });
    if (error && !error.message.includes('already exists')) {
      throw error;
    }
  }
}

/**
 * Generate unique filename
 */
function generateFilename(originalName, orgId) {
  const ext = originalName.split('.').pop() || 'png';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const folder = orgId || 'uploads';
  return `${folder}/${timestamp}-${random}.${ext}`;
}

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
    // Get authenticated user
    const user = await getUser(event.headers.authorization);
    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }
    
    // Parse request body
    const { file, filename, contentType, organizationId } = JSON.parse(event.body);
    
    if (!file) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No file provided' })
      };
    }
    
    // Validate content type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (contentType && !allowedTypes.includes(contentType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG' })
      };
    }
    
    // Ensure bucket exists
    await ensureBucket();
    
    // Convert base64 to buffer
    const base64Data = file.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Check file size (10MB max)
    if (buffer.length > 10 * 1024 * 1024) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'File too large. Maximum size is 10MB' })
      };
    }
    
    // Generate unique path
    const filePath = generateFilename(filename || 'image.png', organizationId);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: contentType || 'image/png',
        upsert: false
      });
    
    if (error) {
      console.error('Upload error:', error);
      throw error;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);
    
    // Log upload for tracking
    console.log(`Image uploaded by user ${user.id}: ${filePath}`);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        url: publicUrl,
        path: filePath,
        size: buffer.length
      })
    };
    
  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: error.status || 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Upload failed' })
    };
  }
}

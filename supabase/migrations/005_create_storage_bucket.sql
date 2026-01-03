-- ============================================================================
-- CREATE MOSM-ASSETS STORAGE BUCKET
-- ============================================================================
-- Central asset storage for menus, templates, backgrounds, icons
-- Shared between modOSmenus and mOSm.cloud

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('mosm-assets', 'mosm-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the bucket
-- Allow public read access
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'mosm-assets');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'mosm-assets');

-- Allow users to update their own uploads
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'mosm-assets' AND auth.uid() = owner);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'mosm-assets' AND auth.uid() = owner);

-- Allow super admins full access
CREATE POLICY "Super admins full access"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'mosm-assets' AND
  (auth.jwt() -> 'user_metadata' ->> 'platform_role' = 'super_admin')
);

-- ============================================================================
-- STORAGE FOLDER STRUCTURE (DOCUMENTATION)
-- ============================================================================
-- 
-- mosm-assets/
-- ├── menus/
-- │   ├── restaurants/       # Restaurant menu templates
-- │   ├── sports-bars/       # Sports bar menu templates
-- │   ├── churches/          # Church service templates
-- │   ├── hotels/            # Hotel lobby templates
-- │   └── cafes/             # Café menu templates
-- ├── backgrounds/           # Background images and patterns
-- ├── icons/                 # Icons and UI elements
-- └── templates/             # Complete menu board templates
--
-- PUBLIC URL FORMAT:
-- https://<project-id>.supabase.co/storage/v1/object/public/mosm-assets/<path>
--
-- USAGE:
-- Both modOSmenus and mOSm.cloud reference assets from this central bucket
-- ============================================================================

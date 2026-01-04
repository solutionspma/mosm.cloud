-- ============================================================================
-- RLS POLICY PERFORMANCE OPTIMIZATION (mOSm.cloud)
-- ============================================================================
-- This migration optimizes Row Level Security policies by wrapping auth.uid()
-- and auth.jwt() calls with SELECT to prevent per-row function evaluation.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
-- Date: 2026-01-03
-- ============================================================================

-- LEADS TABLE
-- ============================================================================
DROP POLICY IF EXISTS "Super admins can view all leads" ON leads;

CREATE POLICY "Super admins can view all leads"
  ON leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = (select auth.uid())
      AND auth.users.raw_user_meta_data->>'platform_role' = 'super_admin'
    )
  );


-- STORAGE BUCKET POLICIES (mosm-assets)
-- ============================================================================
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Super admins full access" ON storage.objects;

CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'mosm-assets' AND (select auth.uid()) = owner);

CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'mosm-assets' AND (select auth.uid()) = owner);

CREATE POLICY "Super admins full access"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'mosm-assets' AND
  ((select auth.jwt()) -> 'user_metadata' ->> 'platform_role' = 'super_admin')
);


-- ============================================================================
-- PERFORMANCE IMPACT
-- ============================================================================
-- Before: auth.uid() evaluated for EVERY row in table scan
-- After: auth.uid() evaluated ONCE per query, result reused
-- Expected speedup: 10-100x for large result sets
-- ============================================================================


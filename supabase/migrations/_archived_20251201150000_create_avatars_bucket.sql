-- Migration: Create Avatars Bucket and RLS Policies
-- Description: Crée le bucket 'avatars' pour Supabase Storage avec les politiques RLS appropriées
-- Note: Version simplifiée sans SET ROLE pour compatibilité Supabase hébergé

-- 1. Créer le bucket 'avatars' s'il n'existe pas déjà
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS for storage.objects (si pas déjà activé)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Public read access for avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated user can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated user can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated user can delete own avatar" ON storage.objects;

-- 4. RLS Policy: Allow public read access for avatars bucket
CREATE POLICY "Public read access for avatars"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- 5. RLS Policy: Allow authenticated users to upload their own avatar
CREATE POLICY "Authenticated user can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 6. RLS Policy: Allow authenticated users to update their own avatar
CREATE POLICY "Authenticated user can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 7. RLS Policy: Allow authenticated users to delete their own avatar
CREATE POLICY "Authenticated user can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

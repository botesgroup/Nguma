-- Create policies for the "documents" storage bucket to allow admin uploads

-- 1. Allow public read access for everyone
-- This policy allows anyone to download files from the 'documents' bucket, which is necessary for users to see the PDF.
CREATE POLICY "Public Read Access for Documents"
ON storage.objects FOR SELECT
USING ( bucket_id = 'documents' );

-- 2. Allow authenticated admins to insert new documents
-- This policy allows users who are logged in AND have the 'admin' role in the 'user_roles' table to upload new files.
CREATE POLICY "Admin Insert Access for Documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents' AND
  auth.role() = 'authenticated' AND
  (SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
);

-- 3. Allow authenticated admins to update documents
-- This policy allows admins to update/overwrite existing files.
CREATE POLICY "Admin Update Access for Documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents' AND
  auth.role() = 'authenticated' AND
  (SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
);

-- 4. Allow authenticated admins to delete documents
-- This policy allows admins to delete files from the bucket.
CREATE POLICY "Admin Delete Access for Documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents' AND
  auth.role() = 'authenticated' AND
  (SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'))
);

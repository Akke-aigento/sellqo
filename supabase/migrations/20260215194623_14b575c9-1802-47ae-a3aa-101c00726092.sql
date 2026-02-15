INSERT INTO storage.buckets (id, name, public) VALUES ('tenant-assets', 'tenant-assets', true);

CREATE POLICY "Authenticated users can upload tenant assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tenant-assets');

CREATE POLICY "Public read access for tenant assets"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'tenant-assets');
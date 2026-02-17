
-- Create storage bucket for message attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload message attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'message-attachments');

-- Allow authenticated users to read attachments
CREATE POLICY "Authenticated users can read message attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'message-attachments');

-- Allow public read for email rendering
CREATE POLICY "Public can read message attachments"
ON storage.objects FOR SELECT TO anon
USING (bucket_id = 'message-attachments');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete message attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'message-attachments');

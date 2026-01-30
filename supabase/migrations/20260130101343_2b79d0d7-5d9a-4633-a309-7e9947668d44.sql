-- 1. Update customer_messages voor status/folder tracking
ALTER TABLE customer_messages
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS folder_id UUID;

-- 2. Inbox folders tabel
CREATE TABLE IF NOT EXISTS inbox_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  is_system BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- 3. RLS voor inbox_folders
ALTER TABLE inbox_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their tenant folders"
  ON inbox_folders FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids(auth.uid())));

-- 4. Foreign key voor folder_id (alleen als constraint niet bestaat)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_customer_messages_folder'
  ) THEN
    ALTER TABLE customer_messages
    ADD CONSTRAINT fk_customer_messages_folder
    FOREIGN KEY (folder_id) REFERENCES inbox_folders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. Metadata kolom voor attachments (indien niet bestaat)
ALTER TABLE customer_message_attachments
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 6. Maak storage_path nullable (voor attachments die nog niet gedownload zijn)
ALTER TABLE customer_message_attachments
ALTER COLUMN storage_path DROP NOT NULL;

-- 7. Index voor snelle filtering
CREATE INDEX IF NOT EXISTS idx_messages_status ON customer_messages(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_folder ON customer_messages(folder_id);

-- 8. Functie om standaard mappen aan te maken voor nieuwe tenants
CREATE OR REPLACE FUNCTION ensure_inbox_folders()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO inbox_folders (tenant_id, name, icon, is_system, sort_order)
  VALUES 
    (NEW.id, 'Inbox', 'inbox', true, 0),
    (NEW.id, 'Gearchiveerd', 'archive', true, 1),
    (NEW.id, 'Prullenbak', 'trash-2', true, 2)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9. Trigger voor nieuwe tenants (drop eerst als bestaat)
DROP TRIGGER IF EXISTS trigger_ensure_inbox_folders ON tenants;
CREATE TRIGGER trigger_ensure_inbox_folders
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION ensure_inbox_folders();

-- 10. Maak standaard mappen aan voor alle bestaande tenants
INSERT INTO inbox_folders (tenant_id, name, icon, is_system, sort_order)
SELECT t.id, folder.name, folder.icon, true, folder.sort_order
FROM tenants t
CROSS JOIN (
  VALUES 
    ('Inbox', 'inbox', 0),
    ('Gearchiveerd', 'archive', 1),
    ('Prullenbak', 'trash-2', 2)
) AS folder(name, icon, sort_order)
ON CONFLICT (tenant_id, name) DO NOTHING;
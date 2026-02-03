-- Update FK constraint to ON DELETE SET NULL
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_marketplace_connection_id_fkey;

ALTER TABLE orders 
ADD CONSTRAINT orders_marketplace_connection_id_fkey 
FOREIGN KEY (marketplace_connection_id) 
REFERENCES marketplace_connections(id) 
ON DELETE SET NULL;
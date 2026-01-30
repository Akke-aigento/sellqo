-- Reset test data
DELETE FROM notifications 
WHERE type IN ('shopify_request_pending', 'shopify_request_new');

DELETE FROM shopify_connection_requests 
WHERE id = '85ffb421-9ea7-4f6c-8255-e6e22278b8b0';

-- Sync trigger: ticket status → shopify request status
CREATE OR REPLACE FUNCTION public.sync_ticket_to_shopify_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.related_resource_type = 'shopify_connection_request' 
     AND NEW.related_resource_id IS NOT NULL
     AND (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
     
    UPDATE shopify_connection_requests
    SET status = CASE NEW.status
      WHEN 'open' THEN 'pending'::text
      WHEN 'in_progress' THEN 'in_review'::text
      WHEN 'resolved' THEN 'approved'::text
      WHEN 'closed' THEN 'completed'::text
      ELSE status
    END,
    updated_at = now()
    WHERE id = NEW.related_resource_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if exists to avoid conflicts
DROP TRIGGER IF EXISTS trigger_sync_ticket_shopify ON support_tickets;

CREATE TRIGGER trigger_sync_ticket_shopify
  AFTER UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION sync_ticket_to_shopify_request();
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON newsletter_subscribers;

-- Create a more specific policy that still allows public inserts but only for new subscriptions
-- This is intentional for newsletter signups from the public storefront
CREATE POLICY "Public newsletter signup"
  ON newsletter_subscribers FOR INSERT
  WITH CHECK (
    -- Only allow setting specific fields, status must be pending
    status = 'pending' 
    AND sync_status = 'pending'
    AND source IN ('website', 'popup', 'checkout', 'footer')
  );
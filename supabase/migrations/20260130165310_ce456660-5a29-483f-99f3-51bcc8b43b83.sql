-- Add DELETE policy for platform admins on support_tickets
CREATE POLICY "Platform admins can delete tickets"
  ON support_tickets
  FOR DELETE
  USING (is_platform_admin(auth.uid()));
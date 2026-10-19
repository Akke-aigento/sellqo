// SOCIAL-GATE-1 — Social enkel voor ontgrendelde winkels (zie useSocialAccess). Zonder toegang
// gaat de bezoeker naar Marketing → E-mail. De terugkeer uit de Stripe-checkout voor AI-credits
// (via /admin/marketing/ai → Social) wordt eerst nog afgehandeld, zodat de aankoop bevestigd wordt.

import { type ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocialAccess } from '@/hooks/useSocialAccess';
import { useAICreditsReturn } from '@/hooks/useAICreditsReturn';

function NoSocialAccess() {
  const navigate = useNavigate();
  // Eerst de credits-terugkeer (zet zelf een toast en ruimt de parameters op), dan weg.
  useAICreditsReturn(() => undefined, () => undefined);
  useEffect(() => {
    navigate('/admin/marketing', { replace: true });
  }, [navigate]);
  return null;
}

export function SocialGate({ children }: { children: ReactNode }) {
  const { allowed, isLoading } = useSocialAccess();
  if (isLoading) return null;
  if (allowed) return <>{children}</>;
  return <NoSocialAccess />;
}


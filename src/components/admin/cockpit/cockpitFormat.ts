// DASH-2a — gedeelde opmaak voor de cockpit-kaarten (kanaalnamen, kleuren).
import type { TFunction } from 'i18next';

const KNOWN_CHANNELS = ['webshop', 'pos', 'bol_com', 'amazon', 'shopify', 'woocommerce', 'ebay'] as const;
type KnownChannel = (typeof KNOWN_CHANNELS)[number];

const isKnown = (c: string): c is KnownChannel => (KNOWN_CHANNELS as readonly string[]).includes(c);

/** Kanaalnaam in de UI-taal; een onbekend kanaal toont zijn sleutel. */
export function channelLabel(t: TFunction, channel: string): string {
  if (!isKnown(channel)) return channel;
  const labels: Record<KnownChannel, string> = {
    webshop: t('admin.cockpit.channels.webshop'),
    pos: t('admin.cockpit.channels.pos'),
    bol_com: t('admin.cockpit.channels.bol_com'),
    amazon: t('admin.cockpit.channels.amazon'),
    shopify: t('admin.cockpit.channels.shopify'),
    woocommerce: t('admin.cockpit.channels.woocommerce'),
    ebay: t('admin.cockpit.channels.ebay'),
  };
  return labels[channel];
}

/** Kleur per positie in de verdeling (hoogste omzet eerst), zoals de mockup: navy, oranje, grijs. */
export const CHANNEL_COLORS = [
  'bg-primary',
  'bg-accent',
  'bg-muted-foreground/60',
  'bg-[hsl(var(--chart-1))]',
  'bg-[hsl(var(--chart-2))]',
  'bg-[hsl(var(--chart-3))]',
];

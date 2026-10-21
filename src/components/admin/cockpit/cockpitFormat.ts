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

/**
 * DASH-2b — kanaalkleuren als vaste waarden (bg voor de legende, stroke voor de donut), ook in
 * dark mode onderscheidbaar: daar is --primary oranje en zou kanaal 1 en 2 gelijk kleuren.
 */
export const CHANNEL_SWATCHES = [
  { bg: 'bg-[#1D3A5C] dark:bg-[#8FB3D9]', stroke: 'stroke-[#1D3A5C] dark:stroke-[#8FB3D9]' },
  { bg: 'bg-[#FF6B33]', stroke: 'stroke-[#FF6B33]' },
  { bg: 'bg-[#A9B6C6] dark:bg-[#64748B]', stroke: 'stroke-[#A9B6C6] dark:stroke-[#64748B]' },
  { bg: 'bg-[#2563EB]', stroke: 'stroke-[#2563EB]' },
  { bg: 'bg-[#9333EA]', stroke: 'stroke-[#9333EA]' },
  { bg: 'bg-[#0D9488]', stroke: 'stroke-[#0D9488]' },
];

/** Vaste kleur per kanaal, zodat een kanaal zijn kleur houdt als de volgorde wisselt. */
const CHANNEL_SWATCH_INDEX: Record<string, number> = { webshop: 0, pos: 1, bol_com: 2, amazon: 3, shopify: 4, woocommerce: 5, ebay: 5 };
export const channelSwatch = (channel: string) => CHANNEL_SWATCHES[CHANNEL_SWATCH_INDEX[channel] ?? 5];

/** De donkerblauwe hero-achtergrond, in beide thema's donker met witte tekst. */
export const HERO_SURFACE = 'bg-[#1D3A5C] text-white dark:bg-[#13283F] shadow-lg shadow-[#1D3A5C]/15';

/** "14:30" uit minuten sinds middernacht. */
export const minuteLabel = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

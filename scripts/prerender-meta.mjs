#!/usr/bin/env node
/**
 * SEO-2 — statische <head> per marketingroute.
 *
 * sellqo.app is een SPA: zonder dit krijgt Google voor /horeca de head van de homepage
 * (PageMeta zet titel en beschrijving pas in de browser). Na `vite build` schrijven we
 * dist/<route>/index.html met de juiste title, description, canonical en og-tags.
 * Teksten komen uit landing.nl.json, dezelfde bron als de pagina's zelf.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const nl = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/locales/landing.nl.json'), 'utf8')).landing;

const ROUTES = [
  { route: 'horeca', title: nl.sector.horeca.meta_title, description: nl.sector.horeca.meta_desc },
  { route: 'events', title: nl.sector.events.meta_title, description: nl.sector.events.meta_desc },
  { route: 'pricing', title: nl.pricing.meta_title, description: nl.pricing.meta_desc },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const indexPath = path.join(DIST, 'index.html');
if (!fs.existsSync(indexPath)) { console.error('prerender-meta: dist/index.html ontbreekt'); process.exit(1); }
const base = fs.readFileSync(indexPath, 'utf8');

function withHead(html, { route, title, description }) {
  const url = `https://sellqo.app/${route}`;
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(description)}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(description)}" />`)
    .replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`);
  out = out.replace(/<link rel="canonical"[^>]*>\s*/g, '');
  return out.replace('</head>', `    <link rel="canonical" href="${url}" />\n  </head>`);
}

for (const r of ROUTES) {
  const dir = path.join(DIST, r.route);
  fs.mkdirSync(dir, { recursive: true });
  const html = withHead(base, r);
  if (!html.includes(`<title>${esc(r.title)}</title>`)) { console.error(`prerender-meta: titel niet gezet voor /${r.route}`); process.exit(1); }
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`prerender-meta: /${r.route}`);
}

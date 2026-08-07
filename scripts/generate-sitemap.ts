// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.
// Statische publieke routes + gepubliceerde blogartikelen uit blog_posts.

import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve } from "path"

const BASE_URL = "https://sellqo.app"

interface SitemapEntry {
  path: string
  lastmod?: string
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"
  priority?: string
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/pricing", changefreq: "monthly", priority: "0.9" },
  { path: "/about", changefreq: "monthly", priority: "0.7" },
  { path: "/contact", changefreq: "monthly", priority: "0.7" },
  { path: "/blog", changefreq: "weekly", priority: "0.6" },
]

function readEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key]
  const envPath = resolve(".env")
  if (!existsSync(envPath)) return undefined
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, "")
  }
  return undefined
}

async function fetchBlogEntries(): Promise<SitemapEntry[]> {
  const url = readEnv("VITE_SUPABASE_URL")
  const key = readEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ?? readEnv("VITE_SUPABASE_ANON_KEY")
  if (!url || !key) {
    console.warn("sitemap: no Supabase credentials found — skipping blog entries")
    return []
  }
  try {
    const res = await fetch(
      `${url}/rest/v1/blog_posts?select=slug,updated_at&status=eq.published&order=published_at.desc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    )
    if (!res.ok) {
      console.warn(`sitemap: blog fetch failed (${res.status}) — skipping blog entries`)
      return []
    }
    const rows = (await res.json()) as Array<{ slug: string; updated_at: string }>
    return rows.map((r) => ({
      path: `/blog/${r.slug}`,
      lastmod: r.updated_at ? new Date(r.updated_at).toISOString().split("T")[0] : undefined,
      changefreq: "monthly" as const,
      priority: "0.6",
    }))
  } catch (e) {
    console.warn("sitemap: blog fetch error — skipping blog entries:", e)
    return []
  }
}

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  )

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n")
}

const entries = [...staticEntries, ...(await fetchBlogEntries())]
writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries))
console.log(`sitemap.xml written (${entries.length} entries)`)

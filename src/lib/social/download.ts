// SOCIAL-4b — een beeld of video downloaden met een leesbare naam.
// <a download> werkt niet voor bestanden van een ander domein (GitHub, Supabase-opslag), dus
// eerst ophalen als blob. Lukt dat niet (bv. geen CORS), dan openen we het bestand in een
// nieuw tabblad zodat de gebruiker het zelf kan bewaren.

export function mediaFileName(url: string, base: string, index: number): string {
  let ext = 'jpg';
  try {
    const m = new URL(url).pathname.toLowerCase().match(/\.(jpe?g|png|webp|mp4|mov)$/);
    if (m) ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  } catch {
    // ongeldige URL: standaard jpg
  }
  const safe = base.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'social';
  return `${safe}-${index + 1}.${ext}`;
}

export async function downloadMedia(url: string, fileName: string): Promise<void> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

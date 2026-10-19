// SOCIAL-3 — tekst van de herinnering "zelf posten" (social-publish-due).
// Apart bestand zodat de test hem kan laden zonder de edge function te starten.

export interface ReminderPost {
  media_type: string | null;
  manual_reason: string | null;
  post_text: string | null;
  scheduled_for: string;
}

export const TIME_FMT = new Intl.DateTimeFormat("nl-BE", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit" });

/** De link voor de link-sticker, als de weektaak die als laatste regel meegaf (LEREN.md §5). */
export function stickerLink(text: string | null): string | null {
  const m = (text ?? "").match(/Link-sticker:\s*(https?:\/\/\S+)/i);
  return m ? m[1] : null;
}

/**
 * Titel en tekst van de herinnering "zelf posten". SOCIAL-REMIND-1: de melding komt op het
 * moment zelf, dus "nu" in de titel; het geplande uur blijft in de tekst.
 */
export function manualReminderText(post: ReminderPost): { title: string; message: string } {
  const at = TIME_FMT.format(new Date(post.scheduled_for));
  if (post.media_type === "reel") {
    return {
      title: "Nu posten: reel (muziek kiezen)",
      message: `Gepland om ${at}. Download de video in de Social planning, kies een nummer in de Instagram-app en vink hem daarna af met "Gepost".`,
    };
  }
  if (post.media_type === "story" || post.manual_reason === "sticker") {
    const link = stickerLink(post.post_text);
    const what = (post.post_text ?? "").replace(/Link-sticker:\s*\S+/i, "").replace(/\s+/g, " ").trim().slice(0, 120);
    return {
      title: "Nu posten: story",
      message: `Gepland om ${at}. ${what ? what + " " : ""}${link ? `Link-sticker: ${link} ` : ""}Het beeld staat in de Social planning; vink hem daarna af met "Gepost".`.trim(),
    };
  }
  return {
    title: "Nu posten",
    message: `Gepland om ${at}. Alles staat in de Social planning; vink hem daarna af met "Gepost".`,
  };
}


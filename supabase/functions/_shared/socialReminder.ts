// SOCIAL-3 — tekst van de herinnering "zelf posten" (social-publish-due).
// Apart bestand zodat de test hem kan laden zonder de edge function te starten.

export interface ReminderPost {
  media_type: string | null;
  manual_reason: string | null;
  post_text: string | null;
  scheduled_for: string;
}

export const TIME_FMT = new Intl.DateTimeFormat("nl-BE", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit" });

/** Titel en tekst van de herinnering "zelf posten".  */
export function manualReminderText(post: ReminderPost): { title: string; message: string } {
  const at = TIME_FMT.format(new Date(post.scheduled_for));
  if (post.media_type === "reel") {
    return {
      title: "Reel klaar: muziek kiezen en posten",
      message: `Gepland om ${at}. Download de video in de Social planning, kies een nummer in de Instagram-app en vink hem daarna af met "Gepost".`,
    };
  }
  if (post.media_type === "story" || post.manual_reason === "sticker") {
    const what = (post.post_text ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    return {
      title: "Story klaar om zelf te posten",
      message: `Gepland om ${at}. ${what ? what + " " : ""}Het beeld staat in de Social planning; vink hem daarna af met "Gepost".`.trim(),
    };
  }
  return {
    title: "Post klaar om zelf te posten",
    message: `Gepland om ${at}. Alles staat in de Social planning; vink hem daarna af met "Gepost".`,
  };
}


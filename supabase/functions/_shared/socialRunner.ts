// SOCIAL-4c — één geclaimde post publiceren. Gedeeld door social-publish-due (de cron) en
// social-post-publish ("Nu posten" in de Social planning), zodat beide exact hetzelfde doen:
// reelvideo en beelden klaarmaken, publiceren, en de post bijwerken naar posted / terug naar
// zijn vorige status (tijdelijke fout of video nog in verwerking) / failed (+ melding).
//
// De post moet al geclaimd zijn (status 'publishing', publish_attempts verhoogd,
// publish_claimed_from gezet): via social_claim_due_posts of de claim in social-post-publish.

import {
  publishPost,
  resolveTarget,
  type SocialMediaType,
  type SocialPlatform,
} from "./socialPublish.ts";
import { prepareInstagramImages, prepareInstagramVideo } from "./socialMedia.ts";

export const MAX_ATTEMPTS = 3;
const PLATFORMS: readonly SocialPlatform[] = ["facebook", "instagram", "twitter", "linkedin"];
const MEDIA_TYPES: readonly SocialMediaType[] = ["image", "carousel", "story", "reel"];

export interface ClaimedPost {
  id: string;
  tenant_id: string;
  platform: string;
  post_text: string | null;
  image_urls: string[] | null;
  media_type: string | null;
  publish_attempts: number;
  publish_claimed_from: string | null;
  video_url: string | null;
  publish_container_id: string | null;
}

export type RunOutcome =
  | { status: "posted"; platformPostId: string | null }
  | { status: "retry"; error: string }
  | { status: "processing" }
  | { status: "failed"; error: string };

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

async function notifyFailure(admin: Admin, post: ClaimedPost, error: string): Promise<void> {
  // Bestaand meldingstype (integrations/integration_error): de tenant ziet het in zijn meldingencentrum.
  const { error: insertError } = await admin.from("notifications").insert({
    tenant_id: post.tenant_id,
    category: "integrations",
    type: "integration_error",
    priority: "high",
    title: `Social post niet gepubliceerd (${post.platform})`,
    message: error,
    action_url: "/admin/marketing/social",
    data: { social_post_id: post.id, platform: post.platform },
  });
  if (insertError) console.error("[socialRunner] melding mislukt:", insertError.message);
}

export async function runClaimedPost(
  admin: Admin,
  post: ClaimedPost,
  opts: { ownHost: string; billingBlocked?: boolean },
): Promise<RunOutcome> {
  const fail = async (message: string, retryable: boolean): Promise<RunOutcome> => {
    if (retryable && post.publish_attempts < MAX_ATTEMPTS) {
      await admin.from("social_posts").update({
        status: post.publish_claimed_from ?? "approved",
        error_message: `Poging ${post.publish_attempts} van ${MAX_ATTEMPTS} mislukt: ${message}`,
        updated_at: new Date().toISOString(),
      }).eq("id", post.id);
      return { status: "retry", error: message };
    }
    await admin.from("social_posts").update({
      status: "failed",
      error_message: message,
      updated_at: new Date().toISOString(),
    }).eq("id", post.id);
    await notifyFailure(admin, post, message);
    return { status: "failed", error: message };
  };

  // Winkel in leesmodus (onbetaald): niet publiceren.
  if (opts.billingBlocked) {
    return await fail("Niet gepubliceerd: je account staat in leesmodus door een openstaande betaling.", false);
  }
  if (!PLATFORMS.includes(post.platform as SocialPlatform)) {
    return await fail(`Platform '${post.platform}' wordt niet ondersteund.`, false);
  }
  const mediaType = MEDIA_TYPES.includes(post.media_type as SocialMediaType)
    ? (post.media_type as SocialMediaType)
    : "image";

  const resolved = await resolveTarget(admin, post.tenant_id, post.platform as SocialPlatform);
  if (!resolved.ok) return await fail(resolved.error, false);

  // SOCIAL-3: de video van een reel naar de eigen opslag (enkel bij de eerste poging;
  // met een bewaarde container is de upload naar Instagram al gebeurd).
  let videoUrl = post.video_url;
  if (mediaType === "reel" && resolved.target.kind === "instagram" && !post.publish_container_id) {
    const preparedVideo = await prepareInstagramVideo(admin, post.tenant_id, videoUrl ?? "", { ownHost: opts.ownHost });
    if (!preparedVideo.ok) return await fail(preparedVideo.error, preparedVideo.retryable);
    if (preparedVideo.url !== videoUrl) {
      videoUrl = preparedVideo.url;
      await admin.from("social_posts").update({ video_url: videoUrl }).eq("id", post.id);
    }
  }

  // SOCIAL-1c: Instagram wil JPEG binnen 4:5..1,91:1. PNG's worden omgezet en de
  // nieuwe URL's bewaard, zodat een nieuwe poging niet opnieuw moet omzetten.
  let imageUrls = post.image_urls ?? [];
  if (resolved.target.kind === "instagram" && imageUrls.length > 0) {
    const prepared = await prepareInstagramImages(admin, post.tenant_id, imageUrls, { ownHost: opts.ownHost });
    if (!prepared.ok) return await fail(prepared.error, prepared.retryable);
    if (prepared.converted > 0) {
      imageUrls = prepared.urls;
      await admin.from("social_posts").update({ image_urls: imageUrls }).eq("id", post.id);
    }
  }

  const result = await publishPost(resolved.target, {
    text: post.post_text ?? "",
    imageUrls,
    mediaType,
    videoUrl,
    containerId: post.publish_container_id,
  });

  if (result.pendingContainerId) {
    // Geen mislukte poging: Instagram is nog bezig. Container bewaren; de claim-functie
    // pakt de post na 50 minuten opnieuw op en publiceert dan zonder nieuwe upload.
    await admin.from("social_posts").update({
      status: post.publish_claimed_from ?? "approved",
      publish_container_id: result.pendingContainerId,
      publish_attempts: Math.max(0, post.publish_attempts - 1),
      error_message: "Instagram verwerkt de video nog. SellQo probeert het binnen het uur opnieuw.",
      updated_at: new Date().toISOString(),
    }).eq("id", post.id);
    return { status: "processing" };
  }

  if (result.success) {
    await admin.from("social_posts").update({
      status: "posted",
      posted_at: result.postedAt ?? new Date().toISOString(),
      platform_post_id: result.platformPostId ?? null,
      connection_id: resolved.target.connectionId,
      error_message: null,
      publish_container_id: null,
      updated_at: new Date().toISOString(),
    }).eq("id", post.id);
    return { status: "posted", platformPostId: result.platformPostId ?? null };
  }
  return await fail(result.error ?? "Onbekende fout", result.retryable ?? false);
}

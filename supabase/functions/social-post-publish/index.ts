import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { authenticateRequest, requireRole, AuthError, authErrorResponse } from "../_shared/auth.ts";
import { requireBillingState } from "../_shared/billingGuard.ts";
// SOCIAL-1: het publiceren zelf zit in _shared/socialPublish.ts, samen met de scheduler
// (social-publish-due). Hier blijft enkel het aanvragen: meteen posten of inplannen.
import { publishPost, resolveTarget, type SocialMediaType, type SocialPlatform } from "../_shared/socialPublish.ts";
import { prepareInstagramImages } from "../_shared/socialMedia.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PostRequest {
  tenantId: string;
  platform: SocialPlatform;
  text: string;
  imageUrls?: string[];
  scheduledFor?: string;
  contentId?: string;
  mediaType?: SocialMediaType;
}

const PLATFORMS: readonly SocialPlatform[] = ['facebook', 'instagram', 'twitter', 'linkedin'];
const MEDIA_TYPES: readonly SocialMediaType[] = ['image', 'carousel', 'story'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId, platform, text, imageUrls, scheduledFor, contentId, mediaType }: PostRequest = await req.json();
    const auth = await authenticateRequest(req, tenantId);
    requireRole(auth, tenantId, ["tenant_admin", "staff", "marketing"]);

    if (!tenantId || !platform || !text) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: tenantId, platform, text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!PLATFORMS.includes(platform)) {
      return new Response(
        JSON.stringify({ error: 'Platform niet ondersteund' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const media: SocialMediaType = mediaType && MEDIA_TYPES.includes(mediaType) ? mediaType : 'image';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    // BILLING-ENFORCE-1: schrijven kan niet terwijl er een betaling openstaat.
    await requireBillingState(supabase, auth, tenantId, "social_channels");

    // Welk account en token? Faalt meteen met een duidelijke uitleg (geen koppeling,
    // verlopen token, meerdere pagina's zonder keuze, IG zonder gekoppelde pagina).
    const resolved = await resolveTarget(supabase, tenantId, platform);
    if (!resolved.ok) {
      return new Response(
        JSON.stringify({ error: resolved.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SOCIAL-1c: beelden voor Instagram meteen klaarmaken (PNG -> JPEG, verhouding),
    // zowel bij inplannen als bij meteen posten. Zo hoort de tenant nu al of een beeld
    // niet bruikbaar is, en niet pas op het geplande moment.
    let images = imageUrls || [];
    if (resolved.target.kind === 'instagram' && images.length > 0) {
      const prepared = await prepareInstagramImages(supabase, tenantId, images);
      if (!prepared.ok) {
        return new Response(
          JSON.stringify({ error: prepared.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      images = prepared.urls;
    }

    // Inplannen: social-publish-due pikt 'scheduled' op zodra scheduled_for voorbij is.
    if (scheduledFor && new Date(scheduledFor) > new Date()) {
      const { data: post, error: postError } = await supabase.from('social_posts').insert({
        tenant_id: tenantId,
        connection_id: resolved.target.connectionId,
        content_id: contentId,
        platform,
        post_text: text,
        image_urls: images,
        media_type: media,
        scheduled_for: scheduledFor,
        status: 'scheduled',
        source: 'ui',
      }).select().single();

      if (postError) throw postError;

      return new Response(
        JSON.stringify({ success: true, scheduled: true, postId: post.id, scheduledFor }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Meteen posten.
    const result = await publishPost(resolved.target, { text, imageUrls: images, mediaType: media });

    const { data: post, error: postError } = await supabase.from('social_posts').insert({
      tenant_id: tenantId,
      connection_id: resolved.target.connectionId,
      content_id: contentId,
      platform,
      post_text: text,
      image_urls: images,
      media_type: media,
      posted_at: result.postedAt,
      platform_post_id: result.platformPostId,
      status: result.success ? 'posted' : 'failed',
      error_message: result.error,
      publish_attempts: 1,
      last_attempt_at: new Date().toISOString(),
      source: 'ui',
    }).select().single();

    if (postError) {
      console.error('Failed to save post record:', postError);
    }

    return new Response(
      JSON.stringify({
        success: result.success,
        platformPostId: result.platformPostId,
        postedAt: result.postedAt,
        error: result.error,
        postId: post?.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    if (error instanceof AuthError) {
      return authErrorResponse(error, corsHeaders);
    }
    console.error('Post publish error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PostRequest {
  tenantId: string;
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin';
  text: string;
  imageUrls?: string[];
  scheduledFor?: string;
  contentId?: string;
}

interface PostResult {
  success: boolean;
  platformPostId?: string;
  postedAt?: string;
  error?: string;
}

async function postToFacebook(accessToken: string, text: string, imageUrls?: string[]): Promise<PostResult> {
  try {
    // First get the user's pages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
    );
    const pagesData = await pagesResponse.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      return { success: false, error: 'Geen Facebook pagina gevonden. Koppel een Business pagina.' };
    }

    // Use the first page
    const page = pagesData.data[0];
    const pageAccessToken = page.access_token;
    const pageId = page.id;

    let endpoint = `https://graph.facebook.com/v18.0/${pageId}/feed`;
    const body: Record<string, string> = {
      message: text,
      access_token: pageAccessToken,
    };

    // If there are images, post as photo(s) instead
    if (imageUrls && imageUrls.length > 0) {
      endpoint = `https://graph.facebook.com/v18.0/${pageId}/photos`;
      body.url = imageUrls[0]; // Use first image
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (result.id) {
      return {
        success: true,
        platformPostId: result.id,
        postedAt: new Date().toISOString(),
      };
    } else {
      return { success: false, error: result.error?.message || 'Onbekende Facebook fout' };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function postToTwitter(accessToken: string, text: string, imageUrls?: string[]): Promise<PostResult> {
  try {
    // TODO: Handle image uploads via media endpoint first
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    const result = await response.json();

    if (result.data?.id) {
      return {
        success: true,
        platformPostId: result.data.id,
        postedAt: new Date().toISOString(),
      };
    } else {
      return { success: false, error: result.detail || result.title || 'Onbekende Twitter fout' };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function postToLinkedIn(accessToken: string, authorId: string, text: string): Promise<PostResult> {
  try {
    const body = {
      author: `urn:li:person:${authorId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    };

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (result.id) {
      return {
        success: true,
        platformPostId: result.id,
        postedAt: new Date().toISOString(),
      };
    } else {
      return { success: false, error: result.message || 'Onbekende LinkedIn fout' };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId, platform, text, imageUrls, scheduledFor, contentId }: PostRequest = await req.json();

    if (!tenantId || !platform || !text) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: tenantId, platform, text' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the connection for this tenant and platform
    const { data: connection, error: connError } = await supabase
      .from('social_connections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('platform', platform)
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: `Geen actieve ${platform} koppeling gevonden` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Token verlopen. Koppel je account opnieuw.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If scheduled for the future, save to social_posts and return
    if (scheduledFor && new Date(scheduledFor) > new Date()) {
      const { data: post, error: postError } = await supabase.from('social_posts').insert({
        tenant_id: tenantId,
        connection_id: connection.id,
        content_id: contentId,
        platform,
        post_text: text,
        image_urls: imageUrls || [],
        scheduled_for: scheduledFor,
        status: 'scheduled',
      }).select().single();

      if (postError) throw postError;

      return new Response(
        JSON.stringify({ success: true, scheduled: true, postId: post.id, scheduledFor }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Post immediately based on platform
    let result: PostResult;

    switch (platform) {
      case 'facebook':
      case 'instagram':
        result = await postToFacebook(connection.access_token, text, imageUrls);
        break;
      case 'twitter':
        result = await postToTwitter(connection.access_token, text, imageUrls);
        break;
      case 'linkedin':
        result = await postToLinkedIn(connection.access_token, connection.account_id!, text);
        break;
      default:
        result = { success: false, error: 'Platform niet ondersteund' };
    }

    // Save the post result
    const { data: post, error: postError } = await supabase.from('social_posts').insert({
      tenant_id: tenantId,
      connection_id: connection.id,
      content_id: contentId,
      platform,
      post_text: text,
      image_urls: imageUrls || [],
      posted_at: result.postedAt,
      platform_post_id: result.platformPostId,
      status: result.success ? 'posted' : 'failed',
      error_message: result.error,
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
    console.error('Post publish error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

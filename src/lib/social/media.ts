// SOCIAL-4b — welke media een post heeft, in de volgorde waarin ze online gaan.
import { format } from 'date-fns';

interface MediaPost {
  platform: string;
  media_type: string;
  scheduled_for: string | null;
  image_urls: string[] | null;
  video_url: string | null;
  video_silent_url: string | null;
}

export interface MediaItem {
  url: string;
  kind: 'image' | 'video';
  label: string;
}

/** Alle media van een post, in de volgorde waarin ze online gaan. */
export function postMedia(post: MediaPost, labels: { image: (n: number) => string; video: string; silent: string; cover: string }): MediaItem[] {
  const images = (post.image_urls ?? []).filter(Boolean);
  if (post.media_type === 'reel') {
    const items: MediaItem[] = [];
    if (post.video_url) items.push({ url: post.video_url, kind: 'video', label: labels.video });
    if (post.video_silent_url && post.video_silent_url !== post.video_url) {
      items.push({ url: post.video_silent_url, kind: 'video', label: labels.silent });
    }
    if (images[0]) items.push({ url: images[0], kind: 'image', label: labels.cover });
    return items;
  }
  return images.map((url, i) => ({ url, kind: 'image', label: labels.image(i + 1) }));
}

export function mediaBaseName(post: Pick<MediaPost, 'platform' | 'scheduled_for' | 'media_type'>): string {
  const day = post.scheduled_for ? format(new Date(post.scheduled_for), 'yyyy-MM-dd') : 'post';
  return `${post.platform}-${day}-${post.media_type}`;
}


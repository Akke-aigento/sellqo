import type { HomepageSection, VideoContent } from '@/types/storefront';

interface VideoSectionProps {
  section: HomepageSection;
}

export function VideoSection({ section }: VideoSectionProps) {
  const content = section.content as VideoContent;
  const settings = section.settings;

  if (!content.video_url) return null;

  // Determine if it's a YouTube/Vimeo embed or direct video
  const isYouTube = content.video_url.includes('youtube.com') || content.video_url.includes('youtu.be');
  const isVimeo = content.video_url.includes('vimeo.com');

  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^&?]+)/);
    return match ? match[1] : null;
  };

  const getVimeoId = (url: string) => {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : null;
  };

  return (
    <section 
      className="py-16"
      style={{
        backgroundColor: settings.background_color || undefined,
        color: settings.text_color || undefined,
        paddingTop: settings.padding_top || undefined,
        paddingBottom: settings.padding_bottom || undefined,
      }}
    >
      <div className={settings.full_width ? '' : 'container mx-auto px-4'}>
        {/* Section Header */}
        {(section.title || section.subtitle) && (
          <div className="text-center mb-10">
            {section.title && (
              <h2 className="text-3xl font-bold mb-2">{section.title}</h2>
            )}
            {section.subtitle && (
              <p className="text-muted-foreground">{section.subtitle}</p>
            )}
          </div>
        )}

        {/* Video */}
        <div className="max-w-4xl mx-auto">
          {isYouTube ? (
            <div className="aspect-video rounded-lg overflow-hidden">
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeId(content.video_url!)}?autoplay=${content.autoplay ? 1 : 0}&loop=${content.loop ? 1 : 0}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : isVimeo ? (
            <div className="aspect-video rounded-lg overflow-hidden">
              <iframe
                src={`https://player.vimeo.com/video/${getVimeoId(content.video_url!)}?autoplay=${content.autoplay ? 1 : 0}&loop=${content.loop ? 1 : 0}`}
                className="w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <video
              src={content.video_url}
              poster={content.poster_url}
              autoPlay={content.autoplay}
              loop={content.loop}
              muted={content.autoplay} // Required for autoplay
              controls
              className="w-full rounded-lg"
            />
          )}
        </div>
      </div>
    </section>
  );
}

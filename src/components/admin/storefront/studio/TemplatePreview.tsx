import type { Theme, TemplateSeedDefinition } from '@/types/storefront';

/**
 * Miniatuur van een template, opgebouwd uit het bouwplan zelf.
 *
 * Staat er een echte screenshot in `preview_image_url`, dan wint die. Zolang
 * die er niet is, tekenen we de opbouw uit `seed_definition` na: welke secties
 * in welke volgorde, in de kleuren van het template. Dat is geen verzonnen
 * mockup maar een weergave van wat de tenant daadwerkelijk krijgt, en het kan
 * nooit verouderen ten opzichte van de seed.
 */
export function TemplatePreview({ theme }: { theme: Theme }) {
  const colors = theme.default_settings;
  const seed = theme.seed_definition as TemplateSeedDefinition | null | undefined;

  if (theme.preview_image_url) {
    return (
      <img
        src={theme.preview_image_url}
        alt={`Voorbeeld van ${theme.name}`}
        className="h-full w-full object-cover object-top"
        loading="lazy"
      />
    );
  }

  const sections = seed?.sections.filter((s) => s.is_visible) ?? [];

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{ backgroundColor: colors.background_color }}
      aria-label={`Opbouw van ${theme.name}`}
    >
      {/* Koptekst */}
      <div
        className="flex shrink-0 items-center gap-1.5 px-2 py-1.5"
        style={{ backgroundColor: colors.primary_color }}
      >
        <div className="h-1.5 w-6 rounded-full bg-white/40" />
        <div
          className={
            colors.header_style === 'centered'
              ? 'flex flex-1 justify-center gap-1'
              : 'ml-auto flex gap-1'
          }
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-1 w-3 rounded-full bg-white/60" />
          ))}
        </div>
      </div>

      {/* Secties in volgorde */}
      <div className="flex flex-1 flex-col gap-1 p-1.5">
        {sections.map((section, i) => {
          switch (section.section_type) {
            case 'announcement':
              return (
                <div
                  key={i}
                  className="h-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: colors.accent_color }}
                />
              );
            case 'hero':
              return (
                <div
                  key={i}
                  className="flex min-h-[34%] flex-1 flex-col justify-center gap-1 rounded-sm px-2"
                  style={{ backgroundColor: colors.secondary_color }}
                >
                  <div
                    className="h-1.5 w-2/3 rounded-full"
                    style={{ backgroundColor: colors.text_color, opacity: 0.75 }}
                  />
                  <div
                    className="h-1 w-1/2 rounded-full"
                    style={{ backgroundColor: colors.text_color, opacity: 0.4 }}
                  />
                  <div
                    className="mt-0.5 h-2 w-10 rounded-sm"
                    style={{ backgroundColor: colors.primary_color }}
                  />
                </div>
              );
            case 'featured_products':
            case 'collection':
              return (
                <div key={i} className="grid shrink-0 grid-cols-4 gap-1">
                  {[0, 1, 2, 3].map((p) => (
                    <div key={p} className="space-y-0.5">
                      <div
                        className="aspect-square rounded-sm"
                        style={{ backgroundColor: colors.secondary_color }}
                      />
                      <div
                        className="h-0.5 rounded-full"
                        style={{ backgroundColor: colors.text_color, opacity: 0.35 }}
                      />
                    </div>
                  ))}
                </div>
              );
            case 'text_image':
              return (
                <div key={i} className="flex shrink-0 gap-1">
                  <div
                    className="h-6 flex-1 rounded-sm"
                    style={{ backgroundColor: colors.secondary_color }}
                  />
                  <div className="flex flex-1 flex-col justify-center gap-0.5">
                    <div
                      className="h-0.5 w-full rounded-full"
                      style={{ backgroundColor: colors.text_color, opacity: 0.4 }}
                    />
                    <div
                      className="h-0.5 w-4/5 rounded-full"
                      style={{ backgroundColor: colors.text_color, opacity: 0.25 }}
                    />
                  </div>
                </div>
              );
            case 'testimonials':
              return (
                <div key={i} className="grid shrink-0 grid-cols-3 gap-1">
                  {[0, 1, 2].map((t) => (
                    <div
                      key={t}
                      className="h-4 rounded-sm"
                      style={{ backgroundColor: colors.secondary_color, opacity: 0.7 }}
                    />
                  ))}
                </div>
              );
            case 'newsletter':
              return (
                <div
                  key={i}
                  className="flex h-4 shrink-0 items-center justify-center gap-1 rounded-sm"
                  style={{ backgroundColor: colors.secondary_color }}
                >
                  <div className="h-1.5 w-10 rounded-sm bg-white/70" />
                  <div
                    className="h-1.5 w-5 rounded-sm"
                    style={{ backgroundColor: colors.accent_color }}
                  />
                </div>
              );
            default:
              return (
                <div
                  key={i}
                  className="h-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: colors.secondary_color, opacity: 0.6 }}
                />
              );
          }
        })}
      </div>
    </div>
  );
}

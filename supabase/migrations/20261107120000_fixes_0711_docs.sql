-- FIXES-0711 — helpartikels volgen de fixes van deze batch.
--   1. onderbalk-aanpassen: "Personaliseer menu" onderaan het menu bestaat niet meer (zijbalk-personalisatie weg).
--   2. zaalplan-en-qr-per-tafel: het paneel van een tafel heeft nu "Klaar" en toont "Opgeslagen".
--   3. qr-online-betalen: wat de gast ziet als online betalen even niet lukt (ONLINE_PAY_UNAVAILABLE).
-- Live nagetrokken op 7-11-2026 (read-only): elk anker staat precies één keer in zijn artikel
--   (md5 vooraf: onderbalk-aanpassen 068a93b9968fdfd03c0a4c47091c12d2, zaalplan-en-qr-per-tafel
--   98123b3ca4f9123bacd26f1acce2db4b, qr-online-betalen 50167c8a7b60919a832fe1c12c471a6c).
--
-- Idempotent: per anker eerst kijken of de nieuwe tekst er al staat (dan overslaan); anders moet het anker
-- precies één keer voorkomen, of de migratie stopt met een fout (inhoud veranderd sinds de recon).
-- Snapshot één keer (create table if not exists).
-- PAS DRAAIEN NA de publish van de admin (anders beschrijft het artikel een knop die er nog niet is).
-- Handmatig terugdraaien:
--   update public.doc_articles d set content = s.content, updated_at = now()
--     from snapshots.sellqo_20261107_doc_articles_fixes0711 s where d.id = s.id;

create schema if not exists snapshots;
create table if not exists snapshots.sellqo_20261107_doc_articles_fixes0711 as
  select * from public.doc_articles where doc_level = 'tenant' and slug in ('onderbalk-aanpassen', 'zaalplan-en-qr-per-tafel', 'qr-online-betalen');
revoke all on snapshots.sellqo_20261107_doc_articles_fixes0711 from anon, authenticated;

do $$
declare
  r record;
  c text;
  n int;
begin
  for r in
    select * from (values
      (1, 'onderbalk-aanpassen',
        ' Je komt er ook via <em>Personaliseer menu</em> onderaan het menu.</p>',
        ' Met enkel het horecapakket vind je het onder <strong>Mijn zaak › Jij › Mijn onderbalk</strong>.</p>',
        'Mijn zaak › Jij › Mijn onderbalk'),
      (2, 'zaalplan-en-qr-per-tafel',
        'met <strong>Dupliceren</strong> maak je een kopie met het volgende nummer.</p>',
        'met <strong>Dupliceren</strong> maak je een kopie met het volgende nummer.</p>' || chr(10) ||
        '<p>Elke wijziging wordt meteen bewaard; je ziet dan kort <em>Opgeslagen</em>. Ben je klaar met een tafel, tik dan onderaan op <strong>Klaar</strong>: een naam die je nog aan het typen was, wordt ook bewaard en het paneel sluit.</p>',
        'onderaan op <strong>Klaar</strong>'),
      (3, 'qr-online-betalen',
        'ziet daarna <em>Betaald</em>.</li>' || chr(10) || '</ol>',
        'ziet daarna <em>Betaald</em>.</li>' || chr(10) || '</ol>' || chr(10) ||
        '<p>Lukt online betalen op dat moment niet, bijvoorbeeld door een storing bij Stripe of een probleem met je Stripe-koppeling, dan ziet de gast: <em>Online betalen lukt nu niet. Vraag de rekening aan de bediening.</em> Wat hij gekozen had, komt meteen weer vrij. Kijk dan in <strong>Instellingen › Betalingsmethoden</strong> (met enkel het horecapakket: <strong>Mijn zaak › Betalen › Online betalen</strong>) of je Stripe-account nog gekoppeld is.</p>',
        'Online betalen lukt nu niet.')
    ) as v(nr, slug, anchor, replacement, marker)
  loop
    select content into c from public.doc_articles where doc_level = 'tenant' and slug = r.slug;
    if c is null then raise notice 'FIXES-0711 docs %: artikel % ontbreekt, overgeslagen', r.nr, r.slug; continue; end if;
    if position(r.marker in c) > 0 then raise notice 'FIXES-0711 docs %: al bijgewerkt', r.nr; continue; end if;
    n := (length(c) - length(replace(c, r.anchor, ''))) / length(r.anchor);
    if n <> 1 then
      raise exception 'FIXES-0711 docs %: anker in % % keer gevonden, verwacht 1', r.nr, r.slug, n;
    end if;
    update public.doc_articles set content = replace(c, r.anchor, r.replacement), updated_at = now()
     where doc_level = 'tenant' and slug = r.slug;
  end loop;
end
$$;

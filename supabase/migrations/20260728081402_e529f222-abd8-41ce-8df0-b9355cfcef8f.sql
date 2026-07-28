INSERT INTO public.doc_articles (doc_level, category_id, title, slug, content, excerpt, tags, context_path, is_published, sort_order)
VALUES (
  'tenant',
  'a0000001-0000-0000-0000-00000000000c',
  'Wachtwoord opnieuw instellen',
  'wachtwoord-opnieuw-instellen',
  E'# Wachtwoord opnieuw instellen\n\nBen je je wachtwoord vergeten? Je kan zelf een nieuw wachtwoord instellen — er is geen tussenkomst van support nodig.\n\n## Zo werkt het\n\n1. Ga naar de **inlogpagina** van SellQo.\n2. Klik onder het loginformulier op **"Wachtwoord vergeten?"**.\n3. Vul het e-mailadres in waarmee je bij SellQo bent geregistreerd en klik op **"Reset-link versturen"**.\n4. Je ontvangt een bevestiging op het scherm. Om misbruik te voorkomen tonen we altijd dezelfde boodschap, ongeacht of het adres bij ons bekend is.\n\n## De reset-mail\n\n- De mail komt van SellQo en heeft als onderwerp *"Reset your password"*.\n- **Het kan enkele minuten duren** voor hij binnenkomt. Controleer ook je **spam- of ongewenste-mailmap** als je niets ziet.\n- **De reset-link is beperkt geldig** (ongeveer één uur). Vraag anders gewoon een nieuwe aan.\n\n## Nieuw wachtwoord kiezen\n\nKlik op de knop in de mail. Je komt op een pagina waar je een nieuw wachtwoord kan kiezen (**minimaal 8 tekens**). Na het opslaan word je automatisch doorgestuurd naar het beheerdashboard.\n\n## Veelvoorkomende situaties\n\n- **Geen mail ontvangen?** Wacht enkele minuten, controleer de spam-map, en controleer of je het juiste e-mailadres hebt ingevuld. Direct opnieuw proberen kan pas na 60 seconden — dit voorkomt dat iemand het formulier misbruikt.\n- **Link werkt niet meer?** Reset-links vervallen na ongeveer een uur. Vraag een nieuwe aan via dezelfde knop op de inlogpagina.\n- **Meerdere accounts?** Elk e-mailadres hoort bij één account. Reset alleen het adres dat je effectief gebruikt om in te loggen.',
  'Vraag zelf een reset-mail aan vanaf de inlogpagina en stel een nieuw wachtwoord in.',
  ARRAY['account','login','wachtwoord','reset'],
  '/auth',
  true,
  10
)
ON CONFLICT (doc_level, slug) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  excerpt = EXCLUDED.excerpt,
  tags = EXCLUDED.tags,
  context_path = EXCLUDED.context_path,
  category_id = EXCLUDED.category_id,
  is_published = EXCLUDED.is_published,
  updated_at = now();
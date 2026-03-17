

## Rich text editor in ReplyComposer + E-mail handtekening

### Probleem
De ReplyComposer gebruikt nu een plain `<Textarea>` — geen opmaak mogelijk. Er bestaat al een `ComposeRichEditor` component met TipTap (bold, italic, underline, lijsten, links) maar die wordt niet gebruikt in de inbox reply.

### Wijzigingen

**1. ReplyComposer.tsx — Textarea vervangen door ComposeRichEditor**
- Vervang de `<Textarea>` door `<ComposeRichEditor>` voor het email-kanaal
- Voor WhatsApp/social kanalen: houd plain textarea (die ondersteunen geen HTML)
- De `message` state wordt HTML voor email, plain text voor social
- Bij verzenden: `body_html` is de editor HTML, `body_text` wordt gestript
- Cmd+Enter shortcut behouden via TipTap keyboard extension
- Template picker en AI suggesties injecteren content via editor API

**2. Database — `email_signatures` tabel toevoegen**
- Kolommen: `id`, `tenant_id`, `user_id` (nullable, voor persoonlijke vs tenant-breed), `name`, `body_html`, `is_default`, `created_at`, `updated_at`
- RLS: tenant users kunnen eigen signatures lezen/beheren

**3. useEmailSignature.ts — Hook voor handtekeningen**
- Fetch de default signature voor de huidige user/tenant
- CRUD operaties voor signatures
- Auto-append signature bij nieuwe reply (onder een `--` separator)

**4. SignatureSettings.tsx — Beheer in instellingen**
- Kleine pagina/modal onder inbox-instellingen om handtekeningen te maken/bewerken
- Gebruikt dezelfde `ComposeRichEditor` voor WYSIWYG bewerking
- Optie om als standaard in te stellen

**5. ComposeRichEditor.tsx — Uitbreiden**
- Keyboard shortcut: Cmd+Enter triggert een `onSubmit` callback
- Methode `insertSignature(html)` exposen via ref of callback
- Strikethrough toevoegen aan toolbar (extra opmaakoptie)

### Resultaat
- Email replies: volledige rich text toolbar (vet, cursief, onderstrepen, lijsten, links)
- WhatsApp/social: blijft plain text (platform beperking)
- Handtekening wordt automatisch toegevoegd onder elke email reply
- Handtekeningen beheerbaar via instellingen


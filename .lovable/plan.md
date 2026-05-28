## Doel
Openstaande uitnodigingen direct zichtbaar maken in de hoofd-lijst "Teamleden", zodat het na "Uitnodigen" meteen duidelijk is dat er iets gebeurd is.

## Aanpak
Eén samengevoegde tabel: actieve leden + pending invitations als rijen met een "In afwachting" badge. De aparte "Openstaande uitnodigingen" kaart eronder verwijderen (dubbele info).

## Wijzigingen
**`src/components/admin/settings/TeamSettings.tsx`** (alleen UI):
- Combineer `members` en `pendingInvitations` in één lijst, gesorteerd: actieve leden eerst, dan pending.
- Pending rij toont:
  - Avatar met initiaal van e-mail (gedimd)
  - E-mailadres + kleine badge "In afwachting" (geel/secondary)
  - Rol-badge (zoals nu)
  - Kolom "Toegevoegd op" → "Uitgenodigd op {date}" of "Verloopt {date} / Verlopen"
  - Action-menu: "Opnieuw versturen" + "Uitnodiging annuleren" (i.p.v. rol-wijziging/verwijderen)
- Verwijder de aparte `Card` met "Openstaande uitnodigingen" onderaan.
- Pas leeg-staat aan: als `members.length === 0 && pendingInvitations.length === 0` → huidige lege staat tonen.
- Loading-state wacht op zowel `isLoading` als `invitationsLoading`.

**`src/components/admin/settings/InviteTeamMemberDialog.tsx`** (verifiëren):
- Na succesvol versturen `refetch()` van invitations triggeren zodat de nieuwe rij meteen verschijnt (waarschijnlijk al via `useTeamInvitations.sendInvitation` → `fetchInvitations()`, even checken).

## Niet aanpassen
- Geen backend/edge function wijzigingen.
- Geen DB-migraties.
- `useTeamMembers` en `useTeamInvitations` blijven ongewijzigd.
- Rollen-uitleg kaart blijft staan.

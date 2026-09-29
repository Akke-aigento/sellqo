// UNIFIED-MAIL-1: de naamkeuze staat in _shared/senderName.ts (gedeeld met
// create-notification). Deze her-export houdt de bestaande imports werkend.
export { parseFromHeader, resolveSenderName, type ParsedFrom } from '../../supabase/functions/_shared/senderName';

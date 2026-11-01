export type { TableRequest, AcceptOutcome, TableCall } from '@/kassa/app/horeca/requests';
export { groupByTable } from '@/kassa/app/horeca/requests';
export const useAutoAccept = () => false;
export const rejectRequest = async () => ({ ok: true });
export const acceptRequest = async () => ({ ok: true });
// OBER-ROEPEN-1
export const handleCall = async () => ({ ok: true });

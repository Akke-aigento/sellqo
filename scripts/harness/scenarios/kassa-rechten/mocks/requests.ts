export type { TableRequest, AcceptOutcome } from '@/kassa/app/horeca/requests';
export { groupByTable } from '@/kassa/app/horeca/requests';
export const useAutoAccept = () => false;
export const rejectRequest = async () => ({ ok: true });
export const acceptRequest = async () => ({ ok: true });

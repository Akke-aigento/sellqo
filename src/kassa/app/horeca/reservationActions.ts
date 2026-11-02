// RESERVATIE-1 — reservaties vanuit de kassa. Enkel de tabel table_reservations; een rekening
// wordt hier nooit aangeraakt (een tafel openen loopt via het gewone commando open_check).
// KASSA-MOBIEL-1: met de kassa-client (sessie van het toestel).
import { createReservation, updateReservation, type Reservation, type ReservationInput, type ReservationStatus } from '@/lib/horeca/reservations';
import type { HorecaStore } from './store';
import { kassaSupabase } from '@/kassa/app/kassaSupabase';

export async function saveReservation(store: HorecaStore, input: ReservationInput, existing?: Reservation | null): Promise<void> {
  if (existing) {
    await updateReservation(existing.id, input, kassaSupabase);
    store.patchReservation(existing.id, input);
  } else {
    await createReservation(store.tenantId, input, kassaSupabase);
  }
  await store.refresh();
}

export async function setReservationStatus(store: HorecaStore, r: Reservation, status: ReservationStatus): Promise<void> {
  const before = r.status;
  store.patchReservation(r.id, { status });
  try {
    await updateReservation(r.id, { status }, kassaSupabase);
  } catch (e) {
    store.patchReservation(r.id, { status: before });
    throw e;
  }
}

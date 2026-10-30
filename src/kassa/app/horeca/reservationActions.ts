// RESERVATIE-1 — reservaties vanuit de kassa. Enkel de tabel table_reservations; een rekening
// wordt hier nooit aangeraakt (een tafel openen loopt via het gewone commando open_check).
import { createReservation, updateReservation, type Reservation, type ReservationInput, type ReservationStatus } from '@/lib/horeca/reservations';
import type { HorecaStore } from './store';

export async function saveReservation(store: HorecaStore, input: ReservationInput, existing?: Reservation | null): Promise<void> {
  if (existing) {
    await updateReservation(existing.id, input);
    store.patchReservation(existing.id, input);
  } else {
    await createReservation(store.tenantId, input);
  }
  await store.refresh();
}

export async function setReservationStatus(store: HorecaStore, r: Reservation, status: ReservationStatus): Promise<void> {
  const before = r.status;
  store.patchReservation(r.id, { status });
  try {
    await updateReservation(r.id, { status });
  } catch (e) {
    store.patchReservation(r.id, { status: before });
    throw e;
  }
}

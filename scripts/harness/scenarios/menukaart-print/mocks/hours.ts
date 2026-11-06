export const businessHoursKey = (id: string | undefined) => ['business-hours', id];
export function useBusinessHours() {
  return { data: { week: { 1: [['11:30', '14:00'], ['17:30', '22:00']], 2: [['11:30', '14:00'], ['17:30', '22:00']], 3: [], 4: [['11:30', '22:00']], 5: [['11:30', '23:00']], 6: [['11:30', '23:00']], 0: [['12:00', '21:00']] }, closures: [], timezone: 'Europe/Brussels' }, isLoading: false };
}

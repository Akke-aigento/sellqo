// De stand van Café De Wissel: 7 van 11 klaar (geen logo, geen gekoppeld toestel, geen post, website offline),
// QR-bestellen met online afrekenen, dus "online betalen" telt mee.
export const horecaStatusKey = (id?: string) => ['horeca-settings-hub', id];
export function useHorecaStatus() {
  return { isLoading: false, data: {
    name: 'Café De Wissel', address: 'Markt 1', postalCode: '3000', city: 'Leuven', vat: 'BE0123456789', logo: false, hoursSet: true,
    terminals: 1, pairedDevices: 0, cashiers: 3, payMethods: 2, kassaTip: true, terminalMode: 'none', receiptPrint: true, mailOnline: false, notifyDevices: 1,
    tables: 12, areas: 2, stations: 0, printers: 1,
    qrMode: 'order', qrFlow: 'check', qrPayCounter: true, qrPayOnline: false, checkOnline: true, onlineTip: true, leadMinutes: 60,
    shopLive: false, shopOrdering: false, pickup: false, delivery: false, slots: false, payOnPickup: false, addonGroups: 2, menuItems: 24,
    stripe: true,
  } };
}

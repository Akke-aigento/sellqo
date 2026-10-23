// KASSA-0 — de verplichte testopstelling van de FOD (UC_TestSetup, 06-08-2024): fictief
// restaurant "The FPS Finances Experience". Gebruikt door tests, de simulator-server en
// later de certificatie-testtenant. posId is instelbaar: de use cases gebruiken
// CPOS0031234567/…568, de POS-detailbeschrijving 2.2.2 noemt CFOD0010000001 (Q&A-vraag 7).
import type { EventMeta, PosContext } from './identity';
import type { DrawerInput, PaymentType, QuantityType, VatLabel } from './types';

export const TEST_BUSINESS = {
  name: 'The FPS Finances Experience',
  address: 'Boulevard Albert II 33, 1030 Brussels',
  vatNo: 'BE0000000097',
  estNo: '2000000042',
} as const;

export const TEST_POS_IDS = { bar: 'CPOS0031234567', reception: 'CPOS0031234568', certification: 'CFOD0010000001' } as const;
export const TEST_FDM_IDS = ['FOD01000001', 'FOD01000002'] as const;

export const TEST_TERMINALS = [
  { terminalId: 'POS-1-BAR', deviceId: 'F0:1D:3D:CC:13:C8', kind: 'computer', posId: TEST_POS_IDS.bar },
  { terminalId: 'POS-2-REC', deviceId: '80:1A:A6:75:66:FC', kind: 'computer', posId: TEST_POS_IDS.reception },
  { terminalId: 'TER-1-BAR', deviceId: 'b54a614f-39cc-4a7b-bd9f-aa6b693d769c', kind: 'tablet', posId: TEST_POS_IDS.bar },
  { terminalId: 'TER-2-DIN', deviceId: '1631678d-7a85-4ac3-b296-bb4565e873fe', kind: 'tablet', posId: TEST_POS_IDS.bar },
  { terminalId: 'TER-3-TER', deviceId: '58d5ce57-e32e-4463-b3fe-b43513089669', kind: 'tablet', posId: TEST_POS_IDS.bar },
  { terminalId: 'TER-4-HH', deviceId: 'a1b2c3d4', kind: 'handheld', posId: TEST_POS_IDS.bar },
  { terminalId: 'TER-4-HH', deviceId: 'e5f6g7h8', kind: 'handheld (backup)', posId: TEST_POS_IDS.bar },
  { terminalId: 'TER-5-HH', deviceId: 'i9j1k2l3', kind: 'handheld', posId: TEST_POS_IDS.bar },
  { terminalId: 'TER-5-HH', deviceId: 'm4n5o6p7', kind: 'handheld (backup)', posId: TEST_POS_IDS.bar },
] as const;

export const TEST_DRAWER: DrawerInput = { id: '1', name: 'Drawer-1' };

/** INSZ van het testpersoneel (enkel toegelaten gebruikers volgens de opstelling). */
export const TEST_STAFF = [
  { employeeId: '75061189702', name: 'John', role: 'bartender' },
  { employeeId: '84022899837', name: 'Elisa', role: 'chef de salle' },
  { employeeId: '80113078968', name: 'Sammy', role: 'sommelier' },
] as const;

export interface TestProduct {
  productId: string;
  productName: string;
  departmentId: string;
  departmentName: string;
  /** Eenheidsprijs incl. btw in centen; null = open prijs. */
  unitPrice: number | null;
  quantityType: QuantityType;
  /** Eén label, of de verdeling voor een all-in-product. */
  labels: VatLabel[];
  note?: string;
}

export const TEST_MENU: TestProduct[] = [
  { productId: '10006', productName: 'Dry Martini', departmentId: '10', departmentName: 'Aperitifs', unitPrice: 1200, quantityType: 'PIECE', labels: ['A'] },
  { productId: '12007', productName: 'Perrier', departmentId: '12', departmentName: 'Soft Drinks', unitPrice: 250, quantityType: 'PIECE', labels: ['A'] },
  { productId: '12009', productName: 'Coca Cola', departmentId: '12', departmentName: 'Soft Drinks', unitPrice: 304, quantityType: 'PIECE', labels: ['A'] },
  { productId: '15001', productName: 'Bourgogne Red', departmentId: '15', departmentName: 'Wines', unitPrice: 3500, quantityType: 'PIECE', labels: ['A'] },
  { productId: '15002', productName: 'Chardonnay White', departmentId: '15', departmentName: 'Wines', unitPrice: 4000, quantityType: 'PIECE', labels: ['A'] },
  { productId: '15003', productName: 'Wine (glass)', departmentId: '15', departmentName: 'Wines', unitPrice: 800, quantityType: 'PIECE', labels: ['A'] },
  { productId: '15023', productName: 'Matching Wines', departmentId: '15', departmentName: 'Wines', unitPrice: 2400, quantityType: 'PIECE', labels: ['A'] },
  { productId: '20001', productName: 'Carpaccio Beef', departmentId: '20', departmentName: 'Starters', unitPrice: 2000, quantityType: 'PIECE', labels: ['B'] },
  { productId: '22001', productName: 'Burger of the CHEF', departmentId: '22', departmentName: 'Main Dishes', unitPrice: 2800, quantityType: 'PIECE', labels: ['B'] },
  { productId: '22005', productName: 'Catch of the day', departmentId: '22', departmentName: 'Main Dishes', unitPrice: 4500, quantityType: 'KILOGRAM', labels: ['B'] },
  { productId: '22010', productName: 'Dish of the day', departmentId: '22', departmentName: 'Main Dishes', unitPrice: null, quantityType: 'PIECE', labels: ['B'], note: 'open prijs' },
  { productId: '25003', productName: 'Dame Blanche', departmentId: '25', departmentName: 'Desserts', unitPrice: 1152, quantityType: 'PIECE', labels: ['B'] },
  { productId: '25008', productName: 'crème brûlée', departmentId: '25', departmentName: 'Desserts', unitPrice: 1000, quantityType: 'PIECE', labels: ['B'] },
  { productId: '28007', productName: 'Tapas variation', departmentId: '28', departmentName: 'Tapas', unitPrice: 334, quantityType: 'PIECE', labels: ['B'] },
  { productId: '30001', productName: 'Business menu', departmentId: '30', departmentName: 'Menus', unitPrice: 3800, quantityType: 'PIECE', labels: ['B'], note: '1 Carpaccio + 1 Burger' },
  { productId: '30010', productName: 'Business menu all-in', departmentId: '30', departmentName: 'Menus', unitPrice: 5800, quantityType: 'PIECE', labels: ['A', 'B'], note: '1 Carpaccio + 1 Burger + 1 Matching wines' },
  { productId: '30020', productName: 'Menu drink', departmentId: '30', departmentName: 'Menus', unitPrice: 1200, quantityType: 'PIECE', labels: ['A'], note: '1 aperitif + 1 soft drink' },
  { productId: '40001', productName: 'Gift Voucher General', departmentId: '400', departmentName: 'Vouchers', unitPrice: 5000, quantityType: 'PIECE', labels: ['X'], note: 'MPV' },
  { productId: '40002', productName: 'Gift Voucher General', departmentId: '400', departmentName: 'Vouchers', unitPrice: 10000, quantityType: 'PIECE', labels: ['X'], note: 'MPV' },
  { productId: '40003', productName: 'Gift Voucher General', departmentId: '400', departmentName: 'Vouchers', unitPrice: 15000, quantityType: 'PIECE', labels: ['X'], note: 'MPV' },
  { productId: '40004', productName: 'Gift Voucher General', departmentId: '400', departmentName: 'Vouchers', unitPrice: 25000, quantityType: 'PIECE', labels: ['X'], note: 'MPV' },
  { productId: '40020', productName: 'Voucher Special Diner Offer', departmentId: '400', departmentName: 'Vouchers', unitPrice: 7500, quantityType: 'PIECE', labels: ['B'], note: 'SPV' },
  { productId: '90001', productName: 'Bottle S', departmentId: '90', departmentName: 'Bottle Deposits', unitPrice: 1, quantityType: 'PIECE', labels: ['X'] },
  { productId: '90100', productName: 'Beer bin/ keg beer', departmentId: '90', departmentName: 'Bottle Deposits', unitPrice: 449, quantityType: 'PIECE', labels: ['X'] },
  { productId: '500001', productName: 'Cigarettes (20 pcs)', departmentId: '500', departmentName: 'Cigarettes', unitPrice: 840, quantityType: 'PIECE', labels: ['D'] },
];

/** Betaalmiddelen van het testrestaurant met hun fiscaal type. */
export const TEST_PAYMENT_METHODS: { id: string; name: string; type: PaymentType }[] = [
  { id: '1', name: 'CONTANT', type: 'CASH' },
  { id: '2', name: 'BANCONTACT', type: 'CARD_DEBIT' },
  { id: '3', name: 'Credit Card', type: 'CARD_CREDIT' },
  { id: '4', name: 'Meal Check', type: 'CHEQUE_MEAL' },
  { id: '5', name: 'VOUCHER', type: 'VOUCHER_STORE' },
  { id: '6', name: 'Payconiq', type: 'APP' },
];

export const TEST_POS: PosContext = {
  language: 'NL',
  vatNo: TEST_BUSINESS.vatNo,
  estNo: TEST_BUSINESS.estNo,
  posId: TEST_POS_IDS.bar,
  posSwVersion: 'sellqo-kassa-0.0.0-test',
  terminalId: 'TER-2-DIN',
  deviceId: '1631678d-7a85-4ac3-b296-bb4565e873fe',
};

export function testMeta(over: Partial<EventMeta> = {}): EventMeta {
  return {
    posFiscalTicketNo: 1000,
    posDateTime: '2024-07-29T13:00:00.000+02:00',
    bookingPeriodId: 'dffcd829-a0e5-41ca-a0ae-9eb887f95637',
    bookingDate: '2024-07-29',
    ticketMedium: 'PAPER',
    employeeId: '84022899837',
    ...over,
  };
}

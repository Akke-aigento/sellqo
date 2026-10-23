// KASSA-0 — bekende afwijkingen in de officiële use cases zelf (niet in onze code).
// Elke afwijking staat er met de exacte verschillen; komt er een verschil bij of valt er
// een weg, dan faalt de test (zodat we het zien). Vragen hierover staan in de Q&A-lijst
// van de eisenmatrix (§14/§16).
export interface KnownDeviation { reason: string; diffs?: string[]; skip?: boolean }

const ENG_R_IN_RANGE = 'ENG-set (Reports 1.3, juli 2024) telt rapport-events (R) mee in posDevices en de FDM-tellers; de nieuwere NL-set (2025) en FAQ Q502/Q504 niet. Wij volgen NL + FAQ. Q&A-vraag 12.';
const ENG_P_TOTAL = 'ENG-set telt T1 (bestelling 52,00 op TER-1-BAR) niet mee in P (3 tickets/198 i.p.v. 4/250); de NL-set telt alle P-events incl. voorrekeningen. Wij volgen NL. Q&A-vraag 13.';

export const KNOWN: Record<string, KnownDeviation> = {
  'reports-eng/REPORTS_ENG/M180_signReportTurnoverX/signReportTurnoverX/report': {
    reason: ENG_P_TOTAL,
    diffs: ['turnover.transactions[1].amount: 250 ≠ 198', 'turnover.transactions[1].ticketCount: 4 ≠ 3'],
  },
  'reports-eng/REPORTS_ENG/M182_signReportUserX/signReportUserX/report': {
    reason: ENG_R_IN_RANGE,
    diffs: ['posDevices: lengte 3 ≠ 4', 'fdmDevices[0].lastTotalCounter: 56 ≠ 58'],
  },
  'reports-eng/REPORTS_ENG/M183_signReportUserZ/signReportUserZ/report': {
    reason: ENG_R_IN_RANGE,
    diffs: ['posDevices: lengte 3 ≠ 4', 'fdmDevices[0].lastTotalCounter: 56 ≠ 59'],
  },
  'reports-eng/REPORTS_ENG/M184_signReportTurnoverZUserZ/signReportTurnoverZ/report': {
    reason: `${ENG_P_TOTAL} ${ENG_R_IN_RANGE}`,
    diffs: ['turnover.transactions[1].amount: 250 ≠ 198', 'turnover.transactions[1].ticketCount: 4 ≠ 3', 'posDevices: lengte 3 ≠ 4', 'fdmDevices[0].lastTotalCounter: 56 ≠ 57'],
  },
  'reports-eng/REPORTS_ENG/M184_signReportTurnoverZUserZ/signReportUserZ/report': {
    reason: ENG_R_IN_RANGE,
    diffs: ['posDevices: lengte 3 ≠ 4', 'fdmDevices[0].lastTotalCounter: 56 ≠ 59'],
  },
  'reports-nl/REPORTS_NL/M184_signReportTurnoverZUserZ/signReportTurnoverZ/report': {
    reason: 'De NL-map bevat een kopie van de ENG-M184 (byte-identieke variabelen, data van 30-07-2024); hoort bij de ENG-inputtickets en wordt daar getest.',
    skip: true,
  },
  'reports-nl/REPORTS_NL/M184_signReportTurnoverZUserZ/signReportUserZ/report': {
    reason: 'Kopie van de ENG-M184, zie hierboven.',
    skip: true,
  },
  'reports-nl/REPORTS_NL/Report4_UserZ/signReportUserZ/report': {
    reason: 'Officieel rapport geeft gebruiker 75061189702 lastPosDateTime 13:51 (het tijdstip van zijn eigen X-rapport), terwijl posDevices en fdmDevices in hetzelfde rapport R-events uitsluiten (13:41, teller 83). Intern tegenstrijdig; wij sluiten R overal uit (FAQ Q502). Q&A-vraag 12.',
    diffs: ['users[0].lastPosDateTime: "2025-02-11T13:30:00+01:00" ≠ "2025-02-11T13:51:00+01:00"'],
  },
};

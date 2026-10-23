// KASSA-0 — scope v1 per use case (eisenmatrix §13).
const V1 = /^(M11|M12|M13|M14|M16|M17|Q1|UC20[01]|UC22|UC23|UC24|UC25|UC26|UC28|UC292|UC4105|UC4106|UC4107|UC4109|UC4116|UC4117|UC4119|UC4120|UC4123|UC4102|UC4103|UC4104|REPORTS)/;
const DECIDE = /^(M15|UC4100|UC4118|UC4121|UC4122)/;
export function scopeOf(uc: string): 'v1' | 'beslissen' | 'later' {
  if (DECIDE.test(uc)) return 'beslissen';
  if (V1.test(uc)) return 'v1';
  return 'later';
}

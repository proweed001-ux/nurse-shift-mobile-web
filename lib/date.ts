export const thaiMonths = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

export function daysInMonth(month: number, buddhistYear: number): number {
  const gregorianYear = buddhistYear - 543;
  return new Date(gregorianYear, month, 0).getDate();
}

export function formatThaiDate(day: number, month: number, buddhistYear: number): string {
  return `${day} ${thaiMonths[month - 1]} ${buddhistYear}`;
}

export function toGregorianYear(buddhistYear: number): number {
  return buddhistYear > 2400 ? buddhistYear - 543 : buddhistYear;
}

export function monthPlanId(month: number, buddhistYear: number): string {
  return `${buddhistYear}-${String(month).padStart(2, '0')}`;
}

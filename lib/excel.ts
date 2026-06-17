import * as XLSX from 'xlsx';
import { daysInMonth } from './date';
import { getShiftText, normalizeShiftCodes, replacePersonnelByName, summarize } from './logic';
import { MonthPlan, Personnel, ShiftCell } from './types';

export async function importShiftExcel(file: File, month: number, buddhistYear: number, currentPersonnel: Personnel[]): Promise<MonthPlan> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const totalDays = daysInMonth(month, buddhistYear);

  let personnel = [...currentPersonnel];
  const shifts: ShiftCell[] = [];

  rows.forEach((row) => {
    const keys = Object.keys(row);
    const nameKey = keys.find((key) => ['ชื่อ', 'ชื่อ-สกุล', 'name', 'Name', 'full_name'].includes(key.trim())) ?? keys[0];
    const rawName = String(row[nameKey] ?? '').trim();
    if (!rawName || rawName === 'ชื่อ') return;

    const person = replacePersonnelByName(personnel, rawName);
    if (!personnel.some((p) => p.id === person.id)) personnel = [...personnel, person];

    for (let day = 1; day <= totalDays; day += 1) {
      const possibleKeys = [String(day), `${day}`, `${day}.0`, `วันที่ ${day}`];
      const dayKey = keys.find((key) => possibleKeys.includes(key.trim()));
      if (!dayKey) continue;
      const codes = normalizeShiftCodes(row[dayKey]);
      if (codes.length) shifts.push({ personnelId: person.id, day, codes });
    }
  });

  return {
    id: `${buddhistYear}-${String(month).padStart(2, '0')}`,
    month,
    year: buddhistYear - 543,
    buddhistYear,
    personnel,
    shifts,
    updatedAt: new Date().toISOString(),
  };
}

export function exportMonthlySummary(plan: MonthPlan): void {
  const rows = summarize(plan).map((row, index) => ({
    ลำดับ: index + 1,
    'ชื่อ-สกุล': row.personnel.fullName,
    ตำแหน่ง: `${row.personnel.position}${row.personnel.level ? ' ' + row.personnel.level : ''}`,
    เช้า: row.morning,
    บ่าย: row.afternoon,
    ดึก: row.night,
    รวมเวร: row.workTotal,
    ออฟ: row.off,
    ลาพักผ่อน: row.vacation,
    ลาป่วย: row.sick,
    ลากิจ: row.personalLeave,
    วันหยุดราชการ: row.holiday,
    รวมวันลา: row.leaveTotal,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'สรุปเวร');
  XLSX.writeFile(workbook, `สรุปเวร_${String(plan.month).padStart(2, '0')}_${plan.buddhistYear}.xlsx`);
}

export function exportShiftTable(plan: MonthPlan): void {
  const totalDays = daysInMonth(plan.month, plan.buddhistYear);
  const rows = plan.personnel.filter((p) => p.active).map((person) => {
    const row: Record<string, string | number> = { ชื่อ: person.fullName };
    for (let day = 1; day <= totalDays; day += 1) {
      row[String(day)] = getShiftText(plan, person.id, day);
    }
    return row;
  });
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'ตารางเวร');
  XLSX.writeFile(workbook, `ตารางเวร_${String(plan.month).padStart(2, '0')}_${plan.buddhistYear}.xlsx`);
}

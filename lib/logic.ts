import { daysInMonth } from './date';
import { MonthPlan, Personnel, ShiftCell, ShiftCode, SummaryRow, ValidationIssue } from './types';

export function normalizeShiftCode(value: unknown): ShiftCode {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const normalized = raw.replace(/[oO]/g, '0');
  if (normalized === 'ช') return 'ช';
  if (normalized === 'บ') return 'บ';
  if (normalized === 'ด') return 'ด';
  if (normalized === '0' || normalized === 'อ' || normalized === 'ออฟ') return '0';
  if (['Va', 'VA', 'va'].includes(normalized)) return 'Va';
  if (['SL', 'sl'].includes(normalized)) return 'SL';
  if (['PL', 'pl'].includes(normalized)) return 'PL';
  if (['PH', 'ph'].includes(normalized)) return 'PH';
  return '';
}

export function getShift(plan: MonthPlan, personnelId: string, day: number): ShiftCode {
  return plan.shifts.find((item) => item.personnelId === personnelId && item.day === day)?.code ?? '';
}

export function setShift(plan: MonthPlan, personnelId: string, day: number, code: ShiftCode): MonthPlan {
  const without = plan.shifts.filter((item) => !(item.personnelId === personnelId && item.day === day));
  const shifts = code ? [...without, { personnelId, day, code }] : without;
  return { ...plan, shifts, updatedAt: new Date().toISOString() };
}

export function validatePlan(plan: MonthPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const totalDays = daysInMonth(plan.month, plan.buddhistYear);
  const activePeople = plan.personnel.filter((p) => p.active);

  for (const person of activePeople) {
    const seen = new Set<number>();
    for (const cell of plan.shifts.filter((s) => s.personnelId === person.id)) {
      if (seen.has(cell.day)) {
        issues.push({ type: 'error', personnelName: person.fullName, day: cell.day, message: 'ลงเวรซ้อนในวันเดียวกัน' });
      }
      seen.add(cell.day);
      if (cell.day < 1 || cell.day > totalDays) {
        issues.push({ type: 'error', personnelName: person.fullName, day: cell.day, message: 'วันที่เกินจำนวนวันของเดือนนี้' });
      }
    }

    for (let day = 1; day < totalDays; day += 1) {
      const today = getShift(plan, person.id, day);
      const tomorrow = getShift(plan, person.id, day + 1);
      if (today === 'ด' && tomorrow === 'ช') {
        issues.push({ type: 'error', personnelName: person.fullName, day: day + 1, message: `เวรดึกวันที่ ${day} ต่อเวรเช้าวันที่ ${day + 1}` });
      }
    }
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const morning = plan.shifts.filter((s) => s.day === day && s.code === 'ช').length;
    const afternoon = plan.shifts.filter((s) => s.day === day && s.code === 'บ').length;
    const night = plan.shifts.filter((s) => s.day === day && s.code === 'ด').length;
    if (morning === 0) issues.push({ type: 'warning', day, message: 'ยังไม่มีเวรเช้า' });
    if (afternoon === 0) issues.push({ type: 'warning', day, message: 'ยังไม่มีเวรบ่าย' });
    if (night === 0) issues.push({ type: 'warning', day, message: 'ยังไม่มีเวรดึก' });
  }

  return issues;
}

export function summarize(plan: MonthPlan): SummaryRow[] {
  return plan.personnel.filter((p) => p.active).map((person) => {
    const cells = plan.shifts.filter((s) => s.personnelId === person.id);
    const count = (code: ShiftCode) => cells.filter((c) => c.code === code).length;
    const morning = count('ช');
    const afternoon = count('บ');
    const night = count('ด');
    const vacation = count('Va');
    const sick = count('SL');
    const personalLeave = count('PL');
    const holiday = count('PH');
    return {
      personnel: person,
      morning,
      afternoon,
      night,
      off: count('0'),
      vacation,
      sick,
      personalLeave,
      holiday,
      workTotal: morning + afternoon + night,
      leaveTotal: vacation + sick + personalLeave,
    };
  });
}

export function copyPlanToMonth(source: MonthPlan, month: number, buddhistYear: number): MonthPlan {
  const targetDays = daysInMonth(month, buddhistYear);
  return {
    ...source,
    id: `${buddhistYear}-${String(month).padStart(2, '0')}`,
    month,
    year: buddhistYear - 543,
    buddhistYear,
    shifts: source.shifts.filter((cell) => cell.day <= targetDays),
    updatedAt: new Date().toISOString(),
  };
}

export function replacePersonnelByName(personnel: Personnel[], fullName: string, fallbackPosition = 'พยาบาลวิชาชีพ'): Personnel {
  const clean = fullName.trim();
  const existing = personnel.find((p) => p.fullName.replace(/\s+/g, '') === clean.replace(/\s+/g, ''));
  if (existing) return existing;
  return {
    id: `p${Date.now()}${Math.random().toString(16).slice(2)}`,
    fullName: clean,
    nickname: clean.split(' ').at(0) ?? clean,
    position: fallbackPosition,
    level: '',
    active: true,
  };
}

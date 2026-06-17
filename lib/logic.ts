import { daysInMonth } from './date';
import { ActiveShiftCode, MonthPlan, Personnel, ShiftCell, ShiftCode, SummaryRow, ValidationIssue, WorkShiftCode, activeShiftCodes, nonWorkShiftCodes, workShiftCodes } from './types';

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

export function normalizeShiftCodes(value: unknown): ActiveShiftCode[] {
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  const chunks = raw
    .replace(/เช้า/g, ' ช ')
    .replace(/บ่าย/g, ' บ ')
    .replace(/ดึก/g, ' ด ')
    .replace(/ออฟ/g, ' 0 ')
    .replace(/[,+/|\\\n\t]+/g, ' ')
    .split(/\s+/)
    .flatMap((part) => {
      if (/^[ชบด]+$/.test(part) && part.length > 1) return part.split('');
      return [part];
    });
  const codes = chunks.map(normalizeShiftCode).filter((code): code is ActiveShiftCode => Boolean(code));
  return Array.from(new Set(codes)).sort((a, b) => activeShiftCodes.indexOf(a) - activeShiftCodes.indexOf(b));
}

export function normalizeOtCodes(value: unknown): WorkShiftCode[] {
  return normalizeShiftCodes(value).filter((code): code is WorkShiftCode => workShiftCodes.includes(code as WorkShiftCode));
}

export function parseShiftCellValue(value: unknown): { codes: ActiveShiftCode[]; otCodes: WorkShiftCode[] } {
  const raw = String(value ?? '').trim();
  if (!raw) return { codes: [], otCodes: [] };
  const otParts: string[] = [];
  let regularRaw = raw
    .replace(/\(?\s*OT\s*[:：]?\s*([ชบด\s,+/|\\]+)\s*\)?/gi, (_match, otText: string) => {
      otParts.push(otText);
      return ' ';
    })
    .replace(/([ชบด])\*/g, (_match, code: string) => {
      otParts.push(code);
      return ' ';
    });

  regularRaw = regularRaw.replace(/\s+/g, ' ').trim();
  return {
    codes: normalizeShiftCodes(regularRaw),
    otCodes: normalizeOtCodes(otParts.join(' ')),
  };
}

function sortActiveCodes(codes: ActiveShiftCode[]): ActiveShiftCode[] {
  return Array.from(new Set(codes)).filter((code): code is ActiveShiftCode => activeShiftCodes.includes(code)).sort((a, b) => activeShiftCodes.indexOf(a) - activeShiftCodes.indexOf(b));
}

function sortOtCodes(codes: WorkShiftCode[]): WorkShiftCode[] {
  return Array.from(new Set(codes)).filter((code): code is WorkShiftCode => workShiftCodes.includes(code)).sort((a, b) => workShiftCodes.indexOf(a) - workShiftCodes.indexOf(b));
}

function upsertCell(plan: MonthPlan, personnelId: string, day: number, patch: Partial<ShiftCell>): MonthPlan {
  const current = plan.shifts.find((item) => item.personnelId === personnelId && item.day === day);
  const nextCell: ShiftCell = {
    personnelId,
    day,
    codes: current ? getShiftCodes(plan, personnelId, day) : [],
    otCodes: current ? getOtCodes(plan, personnelId, day) : [],
    note: current?.note,
    ...patch,
    code: undefined,
  };
  nextCell.codes = sortActiveCodes(nextCell.codes ?? []);
  nextCell.otCodes = sortOtCodes(nextCell.otCodes ?? []);

  const without = plan.shifts.filter((item) => !(item.personnelId === personnelId && item.day === day));
  const shouldKeep = (nextCell.codes?.length ?? 0) > 0 || (nextCell.otCodes?.length ?? 0) > 0 || Boolean(nextCell.note);
  return { ...plan, shifts: shouldKeep ? [...without, nextCell] : without, updatedAt: new Date().toISOString() };
}

export function getShiftCodes(plan: MonthPlan, personnelId: string, day: number): ActiveShiftCode[] {
  const cell = plan.shifts.find((item) => item.personnelId === personnelId && item.day === day);
  if (!cell) return [];
  if (Array.isArray(cell.codes)) {
    return sortActiveCodes(cell.codes.filter((code): code is ActiveShiftCode => activeShiftCodes.includes(code as ActiveShiftCode)));
  }
  return normalizeShiftCodes(cell.code ?? '');
}

export function getOtCodes(plan: MonthPlan, personnelId: string, day: number): WorkShiftCode[] {
  const cell = plan.shifts.find((item) => item.personnelId === personnelId && item.day === day);
  if (!cell || !Array.isArray(cell.otCodes)) return [];
  return sortOtCodes(cell.otCodes);
}

export function getShift(plan: MonthPlan, personnelId: string, day: number): ShiftCode {
  return getShiftCodes(plan, personnelId, day)[0] ?? '';
}

export function getShiftText(plan: MonthPlan, personnelId: string, day: number): string {
  return getShiftCodes(plan, personnelId, day).join('/');
}

export function getCellDisplayText(plan: MonthPlan, personnelId: string, day: number): string {
  const regular = getShiftCodes(plan, personnelId, day).join('/');
  const ot = getOtCodes(plan, personnelId, day).join('/');
  return [regular, ot ? `OT:${ot}` : ''].filter(Boolean).join(' ');
}

export function setShiftCodes(plan: MonthPlan, personnelId: string, day: number, codes: ActiveShiftCode[]): MonthPlan {
  return upsertCell(plan, personnelId, day, { codes: sortActiveCodes(codes) });
}

export function setOtCodes(plan: MonthPlan, personnelId: string, day: number, otCodes: WorkShiftCode[]): MonthPlan {
  return upsertCell(plan, personnelId, day, { otCodes: sortOtCodes(otCodes) });
}

export function setShift(plan: MonthPlan, personnelId: string, day: number, code: ShiftCode): MonthPlan {
  return setShiftCodes(plan, personnelId, day, normalizeShiftCodes(code));
}

export function toggleShiftCode(plan: MonthPlan, personnelId: string, day: number, code: ActiveShiftCode): MonthPlan {
  const current = getShiftCodes(plan, personnelId, day);
  const next = current.includes(code) ? current.filter((item) => item !== code) : [...current, code];
  return setShiftCodes(plan, personnelId, day, next);
}

export function toggleOtCode(plan: MonthPlan, personnelId: string, day: number, code: WorkShiftCode): MonthPlan {
  const current = getOtCodes(plan, personnelId, day);
  const next = current.includes(code) ? current.filter((item) => item !== code) : [...current, code];
  return setOtCodes(plan, personnelId, day, next);
}

export function validatePlan(plan: MonthPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const totalDays = daysInMonth(plan.month, plan.buddhistYear);
  const activePeople = plan.personnel.filter((p) => p.active);

  for (const person of activePeople) {
    for (const cell of plan.shifts.filter((s) => s.personnelId === person.id)) {
      if (cell.day < 1 || cell.day > totalDays) {
        issues.push({ type: 'error', personnelName: person.fullName, day: cell.day, message: 'วันที่เกินจำนวนวันของเดือนนี้' });
      }
      const codes = getShiftCodes(plan, person.id, cell.day);
      const hasWork = codes.some((code) => workShiftCodes.includes(code as WorkShiftCode));
      const hasNonWork = codes.some((code) => nonWorkShiftCodes.includes(code as never));
      if (hasWork && hasNonWork) {
        issues.push({ type: 'warning', personnelName: person.fullName, day: cell.day, message: 'มีทั้งเวรทำงานและวันหยุด/วันลาในช่องเดียวกัน' });
      }
      if (codes.includes('ช') && codes.includes('ด')) {
        issues.push({ type: 'warning', personnelName: person.fullName, day: cell.day, message: 'มีเวรเช้าและเวรดึกในวันเดียวกัน ตรวจว่าตั้งใจหรือไม่' });
      }
    }

    for (let day = 1; day < totalDays; day += 1) {
      const today = getShiftCodes(plan, person.id, day);
      const tomorrow = getShiftCodes(plan, person.id, day + 1);
      if (today.includes('ด') && tomorrow.includes('ช')) {
        issues.push({ type: 'error', personnelName: person.fullName, day: day + 1, message: `เวรดึกวันที่ ${day} ต่อเวรเช้าวันที่ ${day + 1}` });
      }
    }
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const morning = plan.shifts.filter((s) => s.day === day && getShiftCodes(plan, s.personnelId, day).includes('ช')).length;
    const afternoon = plan.shifts.filter((s) => s.day === day && getShiftCodes(plan, s.personnelId, day).includes('บ')).length;
    const night = plan.shifts.filter((s) => s.day === day && getShiftCodes(plan, s.personnelId, day).includes('ด')).length;
    if (morning === 0) issues.push({ type: 'warning', day, message: 'ยังไม่มีเวรเช้า' });
    if (afternoon === 0) issues.push({ type: 'warning', day, message: 'ยังไม่มีเวรบ่าย' });
    if (night === 0) issues.push({ type: 'warning', day, message: 'ยังไม่มีเวรดึก' });
  }

  return issues;
}

export function summarize(plan: MonthPlan): SummaryRow[] {
  return plan.personnel.filter((p) => p.active).map((person) => {
    const count = (code: ActiveShiftCode) => plan.shifts.filter((cell) => cell.personnelId === person.id && getShiftCodes(plan, person.id, cell.day).includes(code)).length;
    const otCount = (code: WorkShiftCode) => plan.shifts.filter((cell) => cell.personnelId === person.id && getOtCodes(plan, person.id, cell.day).includes(code)).length;
    const morning = count('ช');
    const afternoon = count('บ');
    const night = count('ด');
    const vacation = count('Va');
    const sick = count('SL');
    const personalLeave = count('PL');
    const holiday = count('PH');
    const otMorning = otCount('ช');
    const otAfternoon = otCount('บ');
    const otNight = otCount('ด');
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
      otMorning,
      otAfternoon,
      otNight,
      otTotal: otMorning + otAfternoon + otNight,
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
    shifts: source.shifts.filter((cell) => cell.day <= targetDays).map((cell) => ({
      ...cell,
      codes: cell.codes ?? normalizeShiftCodes(cell.code),
      otCodes: sortOtCodes(cell.otCodes ?? []),
      code: undefined,
    })),
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

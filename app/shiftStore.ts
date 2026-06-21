import { originalCells, originalOt, originalPeople } from './sourceData';

export type Code = 'ช' | 'บ' | 'ด' | '0' | 'Va' | 'SL' | 'PL' | 'PH';
export type WorkCode = 'ช' | 'บ' | 'ด';
export type Person = { id: string; name: string; position?: string; active: boolean };
export type ShiftPlan = {
  id: string;
  month: number;
  year: number;
  people: Person[];
  cells: Record<string, string[]>;
  ot: Record<string, string[]>;
  updatedAt: string;
};

type LegacyPersonnel = { id: string; fullName: string; nickname: string; position: string; level: string; active: boolean };
type LegacyPlan = { id: string; month: number; year: number; buddhistYear: number; personnel: LegacyPersonnel[]; shifts: Array<{ personnelId: string; day: number; codes?: string[]; otCodes?: string[] }>; updatedAt: string };

export const SOURCE_MONTH = 7;
export const SOURCE_YEAR = 2569;
export const CURRENT_PLAN_KEY = 'nurse_shift_current_unified_v2';
export const PLAN_PREFIX = 'nurse_shift_unified_plan_v2_';
const LEGACY_PERSONNEL_KEY = 'nurse_shift_personnel_v1';
const LEGACY_PLAN_PREFIX = 'nurse_shift_plan_v1_';

export const realPeople: Person[] = originalPeople.map((p) => ({ id: p.id, name: p.name, position: p.position, active: true }));

export function monthId(month: number, year: number) { return `${year}-${String(month).padStart(2, '0')}`; }
export function cellId(personId: string, day: number) { return `${personId}:${day}`; }
export function daysInPlanMonth(month: number, year: number) { return new Date(year - 543, month, 0).getDate(); }
export function copyRecord(value: unknown) { return JSON.parse(JSON.stringify(value)) as Record<string, string[]>; }

export function makePlan(month = SOURCE_MONTH, year = SOURCE_YEAR): ShiftPlan {
  const sourceMonth = month === SOURCE_MONTH && year === SOURCE_YEAR;
  return {
    id: monthId(month, year),
    month,
    year,
    people: realPeople,
    cells: sourceMonth ? copyRecord(originalCells) : {},
    ot: sourceMonth ? copyRecord(originalOt) : {},
    updatedAt: new Date().toISOString(),
  };
}

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export function loadPlan(month = SOURCE_MONTH, year = SOURCE_YEAR): ShiftPlan {
  const id = monthId(month, year);
  return readJson<ShiftPlan>(`${PLAN_PREFIX}${id}`) ?? readJson<ShiftPlan>(CURRENT_PLAN_KEY) ?? makePlan(month, year);
}

export function loadCurrentPlan(): ShiftPlan {
  return readJson<ShiftPlan>(CURRENT_PLAN_KEY) ?? makePlan();
}

export function savePlan(plan: ShiftPlan): ShiftPlan {
  if (typeof window === 'undefined') return plan;
  const next = { ...plan, id: monthId(plan.month, plan.year), updatedAt: new Date().toISOString() };
  window.localStorage.setItem(CURRENT_PLAN_KEY, JSON.stringify(next));
  window.localStorage.setItem(`${PLAN_PREFIX}${next.id}`, JSON.stringify(next));
  syncLegacyStorage(next);
  window.dispatchEvent(new CustomEvent('nurse-shift-plan-sync', { detail: next }));
  return next;
}

export function resetOriginalPlan(): ShiftPlan {
  return savePlan(makePlan(SOURCE_MONTH, SOURCE_YEAR));
}

export function toLegacyPlan(plan: ShiftPlan): LegacyPlan {
  const personnel = plan.people.map((p) => ({
    id: p.id,
    fullName: p.name,
    nickname: p.name,
    position: p.position ?? '',
    level: '',
    active: p.active,
  }));
  const allIds = new Set([...Object.keys(plan.cells), ...Object.keys(plan.ot)]);
  const shifts = Array.from(allIds).map((id) => {
    const [personnelId, dayText] = id.split(':');
    return {
      personnelId,
      day: Number(dayText),
      codes: plan.cells[id] ?? [],
      otCodes: plan.ot[id] ?? [],
    };
  }).filter((item) => item.personnelId && Number.isFinite(item.day));
  return {
    id: monthId(plan.month, plan.year),
    month: plan.month,
    year: plan.year - 543,
    buddhistYear: plan.year,
    personnel,
    shifts,
    updatedAt: plan.updatedAt,
  };
}

export function syncLegacyStorage(plan: ShiftPlan) {
  if (typeof window === 'undefined') return;
  const legacy = toLegacyPlan(plan);
  window.localStorage.setItem(LEGACY_PERSONNEL_KEY, JSON.stringify(legacy.personnel));
  window.localStorage.setItem(`${LEGACY_PLAN_PREFIX}${legacy.id}`, JSON.stringify(legacy));
}

export function planText(plan: ShiftPlan, personId: string, day: number) {
  const id = cellId(personId, day);
  return [...(plan.cells[id] ?? []), ...(plan.ot[id] ?? []).map((code) => `OT:${code}`)].join(' ');
}

export function listenPlanSync(callback: (plan: ShiftPlan) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const onCustom = (event: Event) => callback((event as CustomEvent<ShiftPlan>).detail ?? loadCurrentPlan());
  const onStorage = (event: StorageEvent) => {
    if (event.key === CURRENT_PLAN_KEY || event.key?.startsWith(PLAN_PREFIX)) callback(loadCurrentPlan());
  };
  window.addEventListener('nurse-shift-plan-sync', onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('nurse-shift-plan-sync', onCustom);
    window.removeEventListener('storage', onStorage);
  };
}

import { monthPlanId } from './date';
import { defaultPersonnel } from './sample';
import { MonthPlan, Personnel } from './types';

const PERSONNEL_KEY = 'nurse_shift_personnel_v1';
const PLAN_PREFIX = 'nurse_shift_plan_v1_';

export function loadPersonnel(): Personnel[] {
  if (typeof window === 'undefined') return defaultPersonnel;
  const raw = window.localStorage.getItem(PERSONNEL_KEY);
  if (!raw) return defaultPersonnel;
  try {
    return JSON.parse(raw) as Personnel[];
  } catch {
    return defaultPersonnel;
  }
}

export function savePersonnel(personnel: Personnel[]): void {
  window.localStorage.setItem(PERSONNEL_KEY, JSON.stringify(personnel));
}

export function makeBlankPlan(month: number, buddhistYear: number, personnel = loadPersonnel()): MonthPlan {
  return {
    id: monthPlanId(month, buddhistYear),
    month,
    year: buddhistYear - 543,
    buddhistYear,
    personnel,
    shifts: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadPlan(month: number, buddhistYear: number): MonthPlan | null {
  if (typeof window === 'undefined') return null;
  const key = `${PLAN_PREFIX}${monthPlanId(month, buddhistYear)}`;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MonthPlan;
  } catch {
    return null;
  }
}

export function savePlan(plan: MonthPlan): void {
  savePersonnel(plan.personnel);
  window.localStorage.setItem(`${PLAN_PREFIX}${plan.id}`, JSON.stringify({ ...plan, updatedAt: new Date().toISOString() }));
}

export function listPlans(): MonthPlan[] {
  if (typeof window === 'undefined') return [];
  return Object.keys(window.localStorage)
    .filter((key) => key.startsWith(PLAN_PREFIX))
    .map((key) => {
      try {
        return JSON.parse(window.localStorage.getItem(key) ?? '') as MonthPlan;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as MonthPlan[];
}

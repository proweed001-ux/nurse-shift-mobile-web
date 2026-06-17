export type ShiftCode = 'ช' | 'บ' | 'ด' | '0' | 'Va' | 'SL' | 'PL' | 'PH' | '';

export type Personnel = {
  id: string;
  fullName: string;
  nickname: string;
  position: string;
  level: string;
  active: boolean;
};

export type ShiftCell = {
  personnelId: string;
  day: number;
  code: ShiftCode;
};

export type MonthPlan = {
  id: string;
  month: number;
  year: number;
  buddhistYear: number;
  personnel: Personnel[];
  shifts: ShiftCell[];
  updatedAt: string;
};

export type ValidationIssue = {
  type: 'error' | 'warning';
  personnelName?: string;
  day?: number;
  message: string;
};

export type SummaryRow = {
  personnel: Personnel;
  morning: number;
  afternoon: number;
  night: number;
  off: number;
  vacation: number;
  sick: number;
  personalLeave: number;
  holiday: number;
  workTotal: number;
  leaveTotal: number;
};

export const shiftMeta: Record<Exclude<ShiftCode, ''>, { label: string; time: string; start: string; end: string; className: string }> = {
  'ช': { label: 'เวรเช้า', time: '08.00น. – 16.00น.', start: '08:00', end: '16:00', className: 'shift-morning' },
  'บ': { label: 'เวรบ่าย', time: '16.00น. – 24.00น.', start: '16:00', end: '24:00', className: 'shift-afternoon' },
  'ด': { label: 'เวรดึก', time: '24.00น. – 08.00น.', start: '24:00', end: '08:00', className: 'shift-night' },
  '0': { label: 'ออฟ', time: '-', start: '-', end: '-', className: 'shift-off' },
  'Va': { label: 'ลาพักผ่อน', time: '-', start: '-', end: '-', className: 'shift-leave' },
  'SL': { label: 'ลาป่วย', time: '-', start: '-', end: '-', className: 'shift-leave' },
  'PL': { label: 'ลากิจ', time: '-', start: '-', end: '-', className: 'shift-leave' },
  'PH': { label: 'วันหยุดราชการ', time: '-', start: '-', end: '-', className: 'shift-holiday' },
};

export const shiftCodes: ShiftCode[] = ['ช', 'บ', 'ด', '0', 'Va', 'SL', 'PL', 'PH', ''];

import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import { daysInMonth, formatThaiDate, thaiMonths } from './date';
import { getShiftCodes } from './logic';
import { MonthPlan, Personnel, shiftMeta } from './types';

export type TemplateKind = 'ot' | 'reserve';

export type TemplateMeta = {
  name: string;
  savedAt: string;
};

const TEMPLATE_PREFIX = 'nurse_shift_docx_template_v1_';
const META_PREFIX = 'nurse_shift_docx_template_meta_v1_';

type DocxRow = string[];

type TableMatch = {
  index: number;
  xml: string;
  isTarget: boolean;
};

function templateKey(kind: TemplateKind): string {
  return `${TEMPLATE_PREFIX}${kind}`;
}

function metaKey(kind: TemplateKind): string {
  return `${META_PREFIX}${kind}`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripXml(xml: string): string {
  return xml
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('อ่านไฟล์แม่แบบไม่สำเร็จ'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.split(',')[1] ?? '');
    };
    reader.readAsDataURL(file);
  });
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function saveTemplateFile(kind: TemplateKind, file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith('.docx')) {
    throw new Error('รองรับเฉพาะไฟล์ .docx');
  }
  const base64 = await fileToBase64(file);
  window.localStorage.setItem(templateKey(kind), base64);
  window.localStorage.setItem(metaKey(kind), JSON.stringify({ name: file.name, savedAt: new Date().toISOString() } satisfies TemplateMeta));
}

export function loadTemplateMeta(kind: TemplateKind): TemplateMeta | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(metaKey(kind));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TemplateMeta;
  } catch {
    return null;
  }
}

export function clearTemplate(kind: TemplateKind): void {
  window.localStorage.removeItem(templateKey(kind));
  window.localStorage.removeItem(metaKey(kind));
}

function loadTemplateBuffer(kind: TemplateKind): ArrayBuffer {
  const base64 = window.localStorage.getItem(templateKey(kind));
  if (!base64) {
    throw new Error(kind === 'ot' ? 'ยังไม่ได้ตั้งค่าแม่แบบคำสั่ง OT' : 'ยังไม่ได้ตั้งค่าแม่แบบเวรสแปล');
  }
  return base64ToArrayBuffer(base64);
}

function positionText(person: Personnel): string {
  return `${person.position}${person.level ? ' ' + person.level : ''}`;
}

function replaceCellText(cellXml: string, text: string): string {
  let replaced = false;
  const safe = escapeXml(text);
  const withText = cellXml.replace(/<w:t([^>]*)>[\s\S]*?<\/w:t>/g, (match, attrs: string) => {
    if (!replaced) {
      replaced = true;
      const preserve = attrs.includes('xml:space') ? attrs : `${attrs} xml:space="preserve"`;
      return `<w:t${preserve}>${safe}</w:t>`;
    }
    return `<w:t${attrs}></w:t>`;
  });

  if (replaced) return withText;

  return cellXml.replace(
    /<\/w:tc>$/,
    `<w:p><w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p></w:tc>`
  );
}

function makeRowFromTemplate(rowTemplate: string, values: string[]): string {
  let cellIndex = 0;
  return rowTemplate.replace(/<w:tc[\s\S]*?<\/w:tc>/g, (cellXml) => {
    const value = values[cellIndex] ?? '';
    cellIndex += 1;
    return replaceCellText(cellXml, value);
  });
}

function getRows(tableXml: string): string[] {
  return tableXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) ?? [];
}

function isOtTableText(text: string): boolean {
  return text.includes('เวลาปฏิบัติงาน') && text.includes('ชื่อ') && text.includes('ตำแหน่ง');
}

function isReserveTableText(text: string): boolean {
  return text.includes('เวรดึก') && text.includes('เวรเช้า') && text.includes('เวรบ่าย');
}

function replaceRowsInMatchingTables(xml: string, matcher: (text: string) => boolean, dataRows: DocxRow[]): string {
  const tableRegex = /<w:tbl[\s\S]*?<\/w:tbl>/g;
  const tables: TableMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(xml))) {
    tables.push({ index: match.index, xml: match[0], isTarget: matcher(stripXml(match[0])) });
  }

  const targetCount = tables.filter((table) => table.isTarget).length;
  if (targetCount === 0) return xml;

  let result = '';
  let lastIndex = 0;
  let dataCursor = 0;
  let targetIndex = 0;

  for (const table of tables) {
    result += xml.slice(lastIndex, table.index);
    lastIndex = table.index + table.xml.length;

    if (!table.isTarget) {
      result += table.xml;
      continue;
    }

    targetIndex += 1;
    const rows = getRows(table.xml);
    const headerRowIndex = rows.findIndex((row) => matcher(stripXml(row)));
    const safeHeaderIndex = headerRowIndex >= 0 ? headerRowIndex : 0;
    const headerRows = rows.slice(0, safeHeaderIndex + 1);
    const rowTemplate = rows[safeHeaderIndex + 1] ?? rows[safeHeaderIndex];
    const oldDataCapacity = Math.max(rows.length - headerRows.length, 1);
    const isLastTarget = targetIndex === targetCount;
    const count = isLastTarget ? Math.max(oldDataCapacity, dataRows.length - dataCursor) : oldDataCapacity;
    const chunk = dataRows.slice(dataCursor, dataCursor + count);
    dataCursor += chunk.length;
    const newRows = chunk.map((values) => makeRowFromTemplate(rowTemplate, values));

    const firstRowStart = table.xml.indexOf(rows[0]);
    const lastRowEnd = table.xml.lastIndexOf(rows[rows.length - 1]) + rows[rows.length - 1].length;
    result += table.xml.slice(0, firstRowStart) + [...headerRows, ...newRows].join('') + table.xml.slice(lastRowEnd);
  }

  result += xml.slice(lastIndex);
  return result;
}

function applyMonthYearText(xml: string, plan: MonthPlan): string {
  const currentMonth = thaiMonths[plan.month - 1];
  const previousMonth = thaiMonths[(plan.month + 10) % 12];
  return xml
    .replace(/กรกฎาคม|กรกฏาคม/g, currentMonth)
    .replace(/มิถุนายน/g, previousMonth)
    .replace(/2569/g, String(plan.buddhistYear));
}

function buildOtRows(plan: MonthPlan): DocxRow[] {
  const totalDays = daysInMonth(plan.month, plan.buddhistYear);
  const rows: DocxRow[] = [];
  for (let day = 1; day <= totalDays; day += 1) {
    const orderedCodes = ['ด', 'ช', 'บ'] as const;
    for (const code of orderedCodes) {
      const people = plan.personnel.filter((person) => person.active && getShiftCodes(plan, person.id, day).includes(code));
      for (const person of people) {
        rows.push([
          formatThaiDate(day, plan.month, plan.buddhistYear),
          shiftMeta[code].time,
          person.fullName,
          positionText(person),
          '',
        ]);
      }
    }
  }
  return rows;
}

function buildReserveRows(plan: MonthPlan): DocxRow[] {
  const totalDays = daysInMonth(plan.month, plan.buddhistYear);
  const rows: DocxRow[] = [];
  const namesFor = (day: number, code: 'ด' | 'ช' | 'บ') => plan.personnel
    .filter((person) => person.active && getShiftCodes(plan, person.id, day).includes(code))
    .map((person) => person.nickname || person.fullName.split(' ')[0])
    .join(', ');

  for (let day = 1; day <= totalDays; day += 1) {
    rows.push([
      formatThaiDate(day, plan.month, plan.buddhistYear),
      namesFor(day, 'ด'),
      namesFor(day, 'ช'),
      namesFor(day, 'บ'),
      '',
    ]);
  }
  return rows;
}

function patchDocx(buffer: ArrayBuffer, plan: MonthPlan, kind: TemplateKind): Blob {
  const zip = new PizZip(buffer);
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) throw new Error('ไม่พบ word/document.xml ในไฟล์แม่แบบ');

  let xml = documentFile.asText();
  xml = applyMonthYearText(xml, plan);
  xml = kind === 'ot'
    ? replaceRowsInMatchingTables(xml, isOtTableText, buildOtRows(plan))
    : replaceRowsInMatchingTables(xml, isReserveTableText, buildReserveRows(plan));

  zip.file('word/document.xml', xml);
  const output = zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  return output;
}

export function exportOtFromTemplate(plan: MonthPlan): void {
  const blob = patchDocx(loadTemplateBuffer('ot'), plan, 'ot');
  saveAs(blob, `คำสั่ง_OT_พยาบาล_ตามแม่แบบ_${thaiMonths[plan.month - 1]}_${plan.buddhistYear}.docx`);
}

export function exportReserveFromTemplate(plan: MonthPlan): void {
  const blob = patchDocx(loadTemplateBuffer('reserve'), plan, 'reserve');
  saveAs(blob, `เวรสแปล_ตามแม่แบบ_${thaiMonths[plan.month - 1]}_${plan.buddhistYear}.docx`);
}

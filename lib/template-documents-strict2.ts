import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import { daysInMonth, formatThaiDate, thaiMonths } from './date';
import { getOtCodes, getShiftCodes } from './logic';
import { MonthPlan, Personnel, shiftMeta } from './types';

type Kind = 'ot' | 'reserve';
type Row = string[];
const TEMPLATE_PREFIX = 'nurse_shift_docx_template_v1_';

function key(kind: Kind) {
  return `${TEMPLATE_PREFIX}${kind}`;
}

function bufferFromBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function loadTemplate(kind: Kind) {
  const raw = window.localStorage.getItem(key(kind));
  if (!raw) throw new Error(kind === 'ot' ? 'ยังไม่ได้ตั้งค่าแม่แบบคำสั่ง OT' : 'ยังไม่ได้ตั้งค่าแม่แบบเวรสแปล');
  return bufferFromBase64(raw);
}

function escapeXml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function plainText(xml: string) {
  return xml.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

function replaceCellText(cellXml: string, value: string) {
  let first = true;
  const safe = escapeXml(value);
  return cellXml.replace(/<w:t([^>]*)>[\s\S]*?<\/w:t>/g, (_match, attrs: string) => {
    if (!first) return `<w:t${attrs}></w:t>`;
    first = false;
    const fixedAttrs = attrs.includes('xml:space') ? attrs : `${attrs} xml:space="preserve"`;
    return `<w:t${fixedAttrs}>${safe}</w:t>`;
  });
}

function makeRow(rowTemplate: string, values: Row) {
  let index = 0;
  return rowTemplate.replace(/<w:tc[\s\S]*?<\/w:tc>/g, (cellXml) => replaceCellText(cellXml, values[index++] ?? ''));
}

function replaceTargetTables(xml: string, matcher: (text: string) => boolean, newRows: Row[]) {
  return xml.replace(/<w:tbl[\s\S]*?<\/w:tbl>/g, (tableXml) => {
    if (!matcher(plainText(tableXml))) return tableXml;
    const rows = tableXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) ?? [];
    if (rows.length === 0) return tableXml;
    const headerIndex = Math.max(0, rows.findIndex((row) => matcher(plainText(row))));
    const firstRow = rows[0] ?? '';
    const lastRow = rows[rows.length - 1] ?? firstRow;
    const headerRows = rows.slice(0, headerIndex + 1);
    const rowTemplate = rows[headerIndex + 1] ?? rows[headerIndex] ?? firstRow;
    const start = tableXml.indexOf(firstRow);
    const end = tableXml.lastIndexOf(lastRow) + lastRow.length;
    return tableXml.slice(0, start) + [...headerRows, ...newRows.map((row) => makeRow(rowTemplate, row))].join('') + tableXml.slice(end);
  });
}

function applyMonthYear(xml: string, plan: MonthPlan) {
  const current = thaiMonths[plan.month - 1] ?? '';
  const previous = thaiMonths[(plan.month + 10) % 12] ?? '';
  return xml.replace(/กรกฎาคม|กรกฏาคม/g, current).replace(/มิถุนายน/g, previous).replace(/2569/g, String(plan.buddhistYear));
}

function positionText(person: Personnel) {
  return `${person.position}${person.level ? ' ' + person.level : ''}`;
}

function makeOtRows(plan: MonthPlan): Row[] {
  const output: Row[] = [];
  for (let day = 1; day <= daysInMonth(plan.month, plan.buddhistYear); day += 1) {
    for (const code of ['ด', 'ช', 'บ'] as const) {
      for (const person of plan.personnel.filter((item) => item.active && getOtCodes(plan, item.id, day).includes(code))) {
        output.push([formatThaiDate(day, plan.month, plan.buddhistYear), shiftMeta[code].time, person.fullName, positionText(person), 'OT']);
      }
    }
  }
  return output;
}

function makeReserveRows(plan: MonthPlan): Row[] {
  const output: Row[] = [];
  for (let day = 1; day <= daysInMonth(plan.month, plan.buddhistYear); day += 1) {
    const names = (code: 'ด' | 'ช' | 'บ') => plan.personnel
      .filter((item) => item.active && getShiftCodes(plan, item.id, day).includes(code))
      .map((item) => item.nickname || item.fullName.split(' ')[0])
      .join(', ');
    output.push([formatThaiDate(day, plan.month, plan.buddhistYear), names('ด'), names('ช'), names('บ'), '']);
  }
  return output;
}

function patch(kind: Kind, plan: MonthPlan) {
  const zip = new PizZip(loadTemplate(kind));
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('ไม่พบ word/document.xml ในไฟล์แม่แบบ');
  const isOtTable = (text: string) => text.includes('เวลาปฏิบัติงาน') && text.includes('ชื่อ') && text.includes('ตำแหน่ง');
  const isReserveTable = (text: string) => text.includes('เวรดึก') && text.includes('เวรเช้า') && text.includes('เวรบ่าย');
  const originalXml = applyMonthYear(file.asText(), plan);
  const updatedXml = replaceTargetTables(originalXml, kind === 'ot' ? isOtTable : isReserveTable, kind === 'ot' ? makeOtRows(plan) : makeReserveRows(plan));
  zip.file('word/document.xml', updatedXml);
  return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export function exportOtFromTemplateStrict2(plan: MonthPlan) {
  saveAs(patch('ot', plan), `คำสั่ง_OT_พยาบาล_ตามแม่แบบ_${thaiMonths[plan.month - 1] ?? ''}_${plan.buddhistYear}.docx`);
}

export function exportReserveFromTemplateStrict2(plan: MonthPlan) {
  saveAs(patch('reserve', plan), `เวรสแปล_ตามแม่แบบ_${thaiMonths[plan.month - 1] ?? ''}_${plan.buddhistYear}.docx`);
}

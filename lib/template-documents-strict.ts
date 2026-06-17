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

function buf(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function load(kind: Kind) {
  const raw = window.localStorage.getItem(key(kind));
  if (!raw) throw new Error(kind === 'ot' ? 'ยังไม่ได้ตั้งค่าแม่แบบคำสั่ง OT' : 'ยังไม่ได้ตั้งค่าแม่แบบเวรสแปล');
  return buf(raw);
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function plain(xml: string) {
  return xml.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

function setCell(cellXml: string, value: string) {
  let done = false;
  const safe = esc(value);
  const next = cellXml.replace(/<w:t([^>]*)>[\s\S]*?<\/w:t>/g, (_m, attrs: string) => {
    if (done) return `<w:t${attrs}></w:t>`;
    done = true;
    return `<w:t${attrs.includes('xml:space') ? attrs : `${attrs} xml:space="preserve"`}>${safe}</w:t>`;
  });
  return done ? next : cellXml.replace(/<\/w:tc>$/, `<w:p><w:r><w:t xml:space="preserve">${safe}</w:t></w:r></w:p></w:tc>`);
}

function rowFrom(template: string, values: Row) {
  let i = 0;
  return template.replace(/<w:tc[\s\S]*?<\/w:tc>/g, (cell) => setCell(cell, values[i++] ?? ''));
}

function replaceTable(xml: string, isTarget: (text: string) => boolean, rows: Row[]) {
  return xml.replace(/<w:tbl[\s\S]*?<\/w:tbl>/g, (tableXml) => {
    if (!isTarget(plain(tableXml))) return tableXml;
    const tableRows = tableXml.match(/<w:tr[\s\S]*?<\/w:tr>/g) ?? [];
    if (!tableRows.length) return tableXml;
    const headerIndex = Math.max(0, tableRows.findIndex((row) => isTarget(plain(row))));
    const header = tableRows.slice(0, headerIndex + 1);
    const template = tableRows[headerIndex + 1] ?? tableRows[headerIndex];
    const first = tableXml.indexOf(tableRows[0]);
    const last = tableXml.lastIndexOf(tableRows[tableRows.length - 1]) + tableRows[tableRows.length - 1].length;
    return tableXml.slice(0, first) + [...header, ...rows.map((r) => rowFrom(template, r))].join('') + tableXml.slice(last);
  });
}

function applyMonth(xml: string, plan: MonthPlan) {
  const current = thaiMonths[plan.month - 1];
  const previous = thaiMonths[(plan.month + 10) % 12];
  return xml.replace(/กรกฎาคม|กรกฏาคม/g, current).replace(/มิถุนายน/g, previous).replace(/2569/g, String(plan.buddhistYear));
}

function pos(person: Personnel) {
  return `${person.position}${person.level ? ' ' + person.level : ''}`;
}

function otRows(plan: MonthPlan): Row[] {
  const out: Row[] = [];
  for (let day = 1; day <= daysInMonth(plan.month, plan.buddhistYear); day += 1) {
    for (const code of ['ด', 'ช', 'บ'] as const) {
      for (const person of plan.personnel.filter((p) => p.active && getOtCodes(plan, p.id, day).includes(code))) {
        out.push([formatThaiDate(day, plan.month, plan.buddhistYear), shiftMeta[code].time, person.fullName, pos(person), 'OT']);
      }
    }
  }
  return out;
}

function reserveRows(plan: MonthPlan): Row[] {
  const out: Row[] = [];
  for (let day = 1; day <= daysInMonth(plan.month, plan.buddhistYear); day += 1) {
    const names = (code: 'ด' | 'ช' | 'บ') => plan.personnel.filter((p) => p.active && getShiftCodes(plan, p.id, day).includes(code)).map((p) => p.nickname || p.fullName.split(' ')[0]).join(', ');
    out.push([formatThaiDate(day, plan.month, plan.buddhistYear), names('ด'), names('ช'), names('บ'), '']);
  }
  return out;
}

function patch(kind: Kind, plan: MonthPlan) {
  const zip = new PizZip(load(kind));
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('ไม่พบ word/document.xml ในไฟล์แม่แบบ');
  const isOt = (text: string) => text.includes('เวลาปฏิบัติงาน') && text.includes('ชื่อ') && text.includes('ตำแหน่ง');
  const isReserve = (text: string) => text.includes('เวรดึก') && text.includes('เวรเช้า') && text.includes('เวรบ่าย');
  const xml = replaceTable(applyMonth(file.asText(), plan), kind === 'ot' ? isOt : isReserve, kind === 'ot' ? otRows(plan) : reserveRows(plan));
  zip.file('word/document.xml', xml);
  return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export function exportOtFromTemplateStrict(plan: MonthPlan) {
  saveAs(patch('ot', plan), `คำสั่ง_OT_พยาบาล_ตามแม่แบบ_${thaiMonths[plan.month - 1]}_${plan.buddhistYear}.docx`);
}

export function exportReserveFromTemplateStrict(plan: MonthPlan) {
  saveAs(patch('reserve', plan), `เวรสแปล_ตามแม่แบบ_${thaiMonths[plan.month - 1]}_${plan.buddhistYear}.docx`);
}

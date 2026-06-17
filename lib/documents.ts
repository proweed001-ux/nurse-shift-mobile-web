import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { daysInMonth, formatThaiDate, thaiMonths } from './date';
import { getShift, summarize } from './logic';
import { MonthPlan, Personnel, shiftMeta } from './types';

function cell(text: string, width?: number, bold = false): TableCell {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold, font: 'TH Sarabun New', size: 28 })],
      }),
    ],
  });
}

function leftCell(text: string, width?: number, bold = false): TableCell {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text, bold, font: 'TH Sarabun New', size: 28 })] })],
  });
}

function title(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120 },
    children: [new TextRun({ text, bold: true, font: 'TH Sarabun New', size: 34 })],
  });
}

function normal(text: string, center = false): Paragraph {
  return new Paragraph({
    alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { after: 80 },
    children: [new TextRun({ text, font: 'TH Sarabun New', size: 30 })],
  });
}

function positionText(person: Personnel): string {
  return `${person.position}${person.level ? ' ' + person.level : ''}`;
}

export async function exportOtDocx(plan: MonthPlan): Promise<void> {
  const totalDays = daysInMonth(plan.month, plan.buddhistYear);
  const rows: TableRow[] = [
    new TableRow({ children: [cell('วัน เดือน ปี', 20, true), cell('เวลาปฏิบัติงาน', 20, true), cell('ชื่อ – สกุล', 32, true), cell('ตำแหน่ง', 22, true), cell('หมายเหตุ', 6, true)] }),
  ];

  for (let day = 1; day <= totalDays; day += 1) {
    const orderedCodes = ['ด', 'ช', 'บ'] as const;
    for (const code of orderedCodes) {
      const people = plan.personnel.filter((person) => getShift(plan, person.id, day) === code);
      for (const person of people) {
        rows.push(new TableRow({ children: [
          cell(formatThaiDate(day, plan.month, plan.buddhistYear), 20),
          cell(shiftMeta[code].time, 20),
          leftCell(person.fullName, 32),
          leftCell(positionText(person), 22),
          cell('', 6),
        ] }));
      }
    }
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: [
        title('บัญชีรายชื่อและตารางเวลา'),
        normal(`ขึ้นปฏิบัติงาน ประจำเดือน ${thaiMonths[plan.month - 1]} พ.ศ. ${plan.buddhistYear}`, true),
        normal('กลุ่มการพยาบาล โรงพยาบาลชัยนาทนเรนทร', true),
        normal(`แนบท้ายคำสั่งโรงพยาบาลชัยนาทนเรนทร ที่        / ${plan.buddhistYear} ลงวันที่        ${thaiMonths[Math.max(plan.month - 2, 0)]} พ.ศ. ${plan.buddhistYear}`),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
        normal(''),
        normal('........................................', true),
        normal('( นางอรอุมา สุขใย )', true),
        normal('หัวหน้างานห้องคลอด', true),
        normal('“ชาวชัยนาทร่วมใจ ต่อต้านภัยคอร์รัปชัน”', true),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `คำสั่ง_OT_พยาบาล_${thaiMonths[plan.month - 1]}_${plan.buddhistYear}.docx`);
}

export async function exportReserveDocx(plan: MonthPlan): Promise<void> {
  const totalDays = daysInMonth(plan.month, plan.buddhistYear);
  const rows: TableRow[] = [
    new TableRow({ children: [cell('วัน/เดือน/ปี', 25, true), cell('เวรดึก', 20, true), cell('เวรเช้า', 20, true), cell('เวรบ่าย', 20, true), cell('หมายเหตุ', 15, true)] }),
  ];
  const namesFor = (day: number, code: 'ด' | 'ช' | 'บ') => plan.personnel
    .filter((person) => getShift(plan, person.id, day) === code)
    .map((person) => person.nickname || person.fullName.split(' ')[0])
    .join(', ');

  for (let day = 1; day <= totalDays; day += 1) {
    rows.push(new TableRow({ children: [
      cell(formatThaiDate(day, plan.month, plan.buddhistYear), 25),
      cell(namesFor(day, 'ด'), 20),
      cell(namesFor(day, 'ช'), 20),
      cell(namesFor(day, 'บ'), 20),
      cell('', 15),
    ] }));
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: [
        title(`งานห้องคลอด กลุ่มการพยาบาล ที่        / ${plan.buddhistYear}`),
        normal(`เรื่อง ให้ข้าราชการอยู่เวรสำรองกรณีภาระงานมาก เจ้าหน้าที่ลากิจ ลาป่วย ประจำเดือน${thaiMonths[plan.month - 1]} พ.ศ. ${plan.buddhistYear}`, true),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
        normal(''),
        normal('........................................', true),
        normal('( นางอรอุมา สุขใย )', true),
        normal('หัวหน้างานห้องคลอด', true),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `เวรสแปล_${thaiMonths[plan.month - 1]}_${plan.buddhistYear}.docx`);
}

export async function exportSummaryDocx(plan: MonthPlan): Promise<void> {
  const rows: TableRow[] = [
    new TableRow({ children: [cell('ชื่อ-สกุล', 30, true), cell('เช้า', 8, true), cell('บ่าย', 8, true), cell('ดึก', 8, true), cell('รวมเวร', 10, true), cell('ออฟ', 8, true), cell('ลา', 8, true), cell('วันหยุด', 10, true)] }),
  ];
  summarize(plan).forEach((row) => {
    rows.push(new TableRow({ children: [
      leftCell(row.personnel.fullName, 30),
      cell(String(row.morning), 8),
      cell(String(row.afternoon), 8),
      cell(String(row.night), 8),
      cell(String(row.workTotal), 10),
      cell(String(row.off), 8),
      cell(String(row.leaveTotal), 8),
      cell(String(row.holiday), 10),
    ] }));
  });
  const doc = new Document({ sections: [{ children: [title(`สรุปเวรรายเดือน ${thaiMonths[plan.month - 1]} ${plan.buddhistYear}`), new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })] }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `สรุปเวร_${thaiMonths[plan.month - 1]}_${plan.buddhistYear}.docx`);
}

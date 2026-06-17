'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { daysInMonth, formatThaiDate, thaiMonths } from '../lib/date';
import { exportMonthlySummary, exportShiftTable, importShiftExcel } from '../lib/excel';
import { copyPlanToMonth, getShift, setShift, summarize, validatePlan } from '../lib/logic';
import { defaultPersonnel } from '../lib/sample';
import { listPlans, loadPersonnel, loadPlan, makeBlankPlan, savePersonnel, savePlan } from '../lib/storage';
import { MonthPlan, Personnel, ShiftCode, shiftCodes, shiftMeta } from '../lib/types';
import { exportOtDocx, exportReserveDocx, exportSummaryDocx } from '../lib/documents';

type Tab = 'calendar' | 'documents' | 'report' | 'people' | 'settings';

type PickerState = {
  personnelId: string;
  day: number;
} | null;

const currentDate = new Date();
const defaultMonth = currentDate.getMonth() + 1;
const defaultBuddhistYear = currentDate.getFullYear() + 543;

function nextShift(code: ShiftCode): ShiftCode {
  const visible = ['ช', 'บ', 'ด', '0', 'Va', 'SL', 'PL', 'PH', ''] as ShiftCode[];
  const index = visible.indexOf(code);
  return visible[(index + 1) % visible.length];
}

function downloadJson(plan: MonthPlan) {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_shift_${plan.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [month, setMonth] = useState(defaultMonth);
  const [buddhistYear, setBuddhistYear] = useState(defaultBuddhistYear);
  const [plan, setPlan] = useState<MonthPlan | null>(null);
  const [tab, setTab] = useState<Tab>('calendar');
  const [picker, setPicker] = useState<PickerState>(null);
  const [allPlans, setAllPlans] = useState<MonthPlan[]>([]);
  const [message, setMessage] = useState('');
  const [newPerson, setNewPerson] = useState({ fullName: '', nickname: '', position: 'พยาบาลวิชาชีพ', level: '' });

  useEffect(() => {
    const personnel = loadPersonnel();
    const loaded = loadPlan(month, buddhistYear) ?? makeBlankPlan(month, buddhistYear, personnel);
    setPlan(loaded);
    setAllPlans(listPlans());
  }, [month, buddhistYear]);

  const totalDays = useMemo(() => daysInMonth(month, buddhistYear), [month, buddhistYear]);
  const issues = useMemo(() => (plan ? validatePlan(plan) : []), [plan]);
  const summary = useMemo(() => (plan ? summarize(plan) : []), [plan]);
  const dashboard = useMemo(() => {
    const morning = summary.reduce((sum, item) => sum + item.morning, 0);
    const afternoon = summary.reduce((sum, item) => sum + item.afternoon, 0);
    const night = summary.reduce((sum, item) => sum + item.night, 0);
    const leave = summary.reduce((sum, item) => sum + item.leaveTotal, 0);
    return { morning, afternoon, night, leave };
  }, [summary]);

  function persist(next: MonthPlan, flash = 'บันทึกแล้ว') {
    setPlan(next);
    savePlan(next);
    setAllPlans(listPlans());
    setMessage(flash);
    setTimeout(() => setMessage(''), 1800);
  }

  function updateCell(personnelId: string, day: number, code: ShiftCode) {
    if (!plan) return;
    persist(setShift(plan, personnelId, day, code));
  }

  async function onImportExcel(event: ChangeEvent<HTMLInputElement>) {
    if (!plan || !event.target.files?.[0]) return;
    try {
      const next = await importShiftExcel(event.target.files[0], month, buddhistYear, plan.personnel);
      persist(next, 'นำเข้า Excel สำเร็จ');
    } catch (error) {
      setMessage('นำเข้า Excel ไม่สำเร็จ ตรวจว่าหัวตารางมีคอลัมน์ชื่อ และวันที่ 1-31');
      console.error(error);
    } finally {
      event.target.value = '';
    }
  }

  function createBlankMonth() {
    const next = makeBlankPlan(month, buddhistYear, loadPersonnel());
    persist(next, 'สร้างเดือนใหม่แล้ว');
  }

  function copyPreviousPlan(sourceId: string) {
    const source = allPlans.find((item) => item.id === sourceId);
    if (!source) return;
    persist(copyPlanToMonth(source, month, buddhistYear), 'คัดลอกจากเดือนที่เลือกแล้ว');
  }

  function addPerson() {
    if (!plan || !newPerson.fullName.trim()) return;
    const person: Personnel = {
      id: `p${Date.now()}`,
      fullName: newPerson.fullName.trim(),
      nickname: newPerson.nickname.trim() || newPerson.fullName.trim().split(' ')[0],
      position: newPerson.position.trim() || 'พยาบาลวิชาชีพ',
      level: newPerson.level.trim(),
      active: true,
    };
    const personnel = [...plan.personnel, person];
    savePersonnel(personnel);
    persist({ ...plan, personnel }, 'เพิ่มบุคลากรแล้ว');
    setNewPerson({ fullName: '', nickname: '', position: 'พยาบาลวิชาชีพ', level: '' });
  }

  function togglePerson(personId: string) {
    if (!plan) return;
    const personnel = plan.personnel.map((person) => person.id === personId ? { ...person, active: !person.active } : person);
    savePersonnel(personnel);
    persist({ ...plan, personnel }, 'ปรับสถานะแล้ว');
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.[0]) return;
    try {
      const text = await event.target.files[0].text();
      const next = JSON.parse(text) as MonthPlan;
      persist(next, 'นำเข้าไฟล์สำรองแล้ว');
      setMonth(next.month);
      setBuddhistYear(next.buddhistYear);
    } catch {
      setMessage('นำเข้าไฟล์สำรองไม่สำเร็จ');
    } finally {
      event.target.value = '';
    }
  }

  if (!plan) return null;

  const selectedPickerPerson = picker ? plan.personnel.find((person) => person.id === picker.personnelId) : null;

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-card">
          <h1>ระบบตารางเวรพยาบาล</h1>
          <p>เปิดบนมือถือ อัปโหลด Excel แก้เวร ตรวจความผิดพลาด และสร้างเอกสาร OT/เวรสแปล/สรุปเวรจากข้อมูลชุดเดียว</p>
        </div>
        <div className="quick-grid">
          <div className="stat"><div className="stat-label">เวรเช้า</div><div className="stat-value">{dashboard.morning}</div></div>
          <div className="stat"><div className="stat-label">เวรบ่าย</div><div className="stat-value">{dashboard.afternoon}</div></div>
          <div className="stat"><div className="stat-label">เวรดึก</div><div className="stat-value">{dashboard.night}</div></div>
          <div className="stat"><div className="stat-label">วันลา</div><div className="stat-value">{dashboard.leave}</div></div>
        </div>
      </section>

      <section className="toolbar">
        <div className="field-row">
          <div className="field">
            <label>เดือน</label>
            <select className="select" value={month} onChange={(event) => setMonth(Number(event.target.value))}>
              {thaiMonths.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>ปี พ.ศ.</label>
            <input className="input" inputMode="numeric" value={buddhistYear} onChange={(event) => setBuddhistYear(Number(event.target.value) || defaultBuddhistYear)} />
          </div>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={createBlankMonth}>สร้างเดือนใหม่</button>
          <label className="btn">
            อัปโหลด Excel
            <input hidden type="file" accept=".xlsx,.xls" onChange={onImportExcel} />
          </label>
          <select className="select" style={{ width: 'auto' }} defaultValue="" onChange={(event) => copyPreviousPlan(event.target.value)}>
            <option value="" disabled>คัดลอกจากเดือน...</option>
            {allPlans.filter((item) => item.id !== plan.id).map((item) => (
              <option key={item.id} value={item.id}>{thaiMonths[item.month - 1]} {item.buddhistYear}</option>
            ))}
          </select>
        </div>
      </section>

      {message ? <div className="notice" style={{ marginBottom: 14 }}>{message}</div> : null}

      <nav className="tabs" aria-label="เมนูหลัก">
        <button className={`tab ${tab === 'calendar' ? 'active' : ''}`} onClick={() => setTab('calendar')}>ตารางเวร</button>
        <button className={`tab ${tab === 'documents' ? 'active' : ''}`} onClick={() => setTab('documents')}>สร้างเอกสาร</button>
        <button className={`tab ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}>สรุป/ตรวจ</button>
        <button className={`tab ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}>บุคลากร</button>
        <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>สำรองข้อมูล</button>
      </nav>

      {tab === 'calendar' && (
        <section className="card">
          <h2>ตารางเวร {thaiMonths[month - 1]} {buddhistYear}</h2>
          <p className="hint">แตะช่องเวรเพื่อเลือก ช / บ / ด / 0 / Va / SL / PL / PH หรือแตะเร็ว ๆ เพื่อวนรหัสเวร</p>
          <div className="grid-wrap">
            <table className="shift-table">
              <thead>
                <tr>
                  <th className="name-col">ชื่อ</th>
                  {Array.from({ length: totalDays }, (_, i) => <th key={i + 1}>{i + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {plan.personnel.filter((person) => person.active).map((person) => (
                  <tr key={person.id}>
                    <td className="name-col">{person.nickname || person.fullName}</td>
                    {Array.from({ length: totalDays }, (_, i) => {
                      const day = i + 1;
                      const code = getShift(plan, person.id, day);
                      const className = code ? shiftMeta[code].className : 'empty-shift';
                      return (
                        <td key={day}>
                          <button
                            className={`shift-cell ${className}`}
                            title={`${person.fullName} วันที่ ${day}`}
                            onClick={() => setPicker({ personnelId: person.id, day })}
                            onDoubleClick={() => updateCell(person.id, day, nextShift(code))}
                          >
                            {code || '+'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'documents' && (
        <section className="panel-grid">
          <div className="card">
            <h2>สร้างไฟล์ Word</h2>
            <p className="hint">ไฟล์จะถูกสร้างใหม่ตามเดือนที่เลือก ไม่เขียนทับไฟล์ต้นฉบับ</p>
            <div className="actions">
              <button className="btn primary" onClick={() => exportOtDocx(plan)}>คำสั่ง OT .docx</button>
              <button className="btn primary" onClick={() => exportReserveDocx(plan)}>เวรสแปล .docx</button>
              <button className="btn" onClick={() => exportSummaryDocx(plan)}>สรุปเวร .docx</button>
            </div>
          </div>
          <div className="card">
            <h2>Excel / PDF</h2>
            <p className="hint">PDF บนมือถือให้กด “พิมพ์/บันทึก PDF” แล้วเลือก Save as PDF ของเครื่อง</p>
            <div className="actions">
              <button className="btn" onClick={() => exportMonthlySummary(plan)}>สรุปเวร .xlsx</button>
              <button className="btn" onClick={() => exportShiftTable(plan)}>ตารางเวร .xlsx</button>
              <button className="btn" onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button>
            </div>
          </div>
        </section>
      )}

      {tab === 'report' && (
        <section className="panel-grid">
          <div className="card">
            <h2>ตรวจ Conflict</h2>
            <div className="issue-list">
              {issues.length === 0 ? <div className="issue">ไม่พบปัญหา</div> : issues.slice(0, 80).map((issue, index) => (
                <div className={`issue ${issue.type}`} key={`${issue.message}-${index}`}>
                  <b>{issue.type === 'error' ? 'ผิดพลาด' : 'แจ้งเตือน'}:</b> {issue.personnelName ? `${issue.personnelName} ` : ''}{issue.day ? `วันที่ ${issue.day} ` : ''}{issue.message}
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h2>สรุปรายบุคคล</h2>
            <div className="grid-wrap">
              <table className="summary-table">
                <thead>
                  <tr><th>ชื่อ</th><th>ช</th><th>บ</th><th>ด</th><th>ลา</th><th>รวม</th></tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    <tr key={row.personnel.id}>
                      <td>{row.personnel.nickname || row.personnel.fullName}</td>
                      <td>{row.morning}</td>
                      <td>{row.afternoon}</td>
                      <td>{row.night}</td>
                      <td>{row.leaveTotal}</td>
                      <td>{row.workTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {tab === 'people' && (
        <section className="panel-grid">
          <div className="card">
            <h2>เพิ่มบุคลากร</h2>
            <div className="person-form">
              <input className="input" placeholder="ชื่อ-สกุล" value={newPerson.fullName} onChange={(event) => setNewPerson({ ...newPerson, fullName: event.target.value })} />
              <input className="input" placeholder="ชื่อเล่น/ชื่อสั้น" value={newPerson.nickname} onChange={(event) => setNewPerson({ ...newPerson, nickname: event.target.value })} />
              <input className="input" placeholder="ตำแหน่ง" value={newPerson.position} onChange={(event) => setNewPerson({ ...newPerson, position: event.target.value })} />
              <input className="input" placeholder="ระดับ" value={newPerson.level} onChange={(event) => setNewPerson({ ...newPerson, level: event.target.value })} />
              <button className="btn primary" onClick={addPerson}>เพิ่ม</button>
            </div>
          </div>
          <div className="card">
            <h2>รายชื่อ</h2>
            <div className="panel-grid" style={{ gridTemplateColumns: '1fr' }}>
              {plan.personnel.map((person) => (
                <div className="person-card" key={person.id}>
                  <div className="person-title">{person.fullName}</div>
                  <div className="muted">{person.nickname} · {person.position} {person.level}</div>
                  <button className={`btn small ${person.active ? '' : 'danger'}`} onClick={() => togglePerson(person.id)}>{person.active ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}</button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === 'settings' && (
        <section className="panel-grid">
          <div className="card">
            <h2>สำรองข้อมูล</h2>
            <p className="hint">เวอร์ชันนี้เก็บข้อมูลในเครื่อง/เบราว์เซอร์ของผู้ใช้ ควรสำรอง JSON หลังทำตารางเสร็จ</p>
            <div className="actions">
              <button className="btn primary" onClick={() => downloadJson(plan)}>ดาวน์โหลด Backup JSON</button>
              <label className="btn">นำเข้า Backup JSON<input hidden type="file" accept=".json" onChange={importBackup} /></label>
            </div>
          </div>
          <div className="card">
            <h2>ล้างข้อมูลตัวอย่าง</h2>
            <p className="hint">ใช้เมื่ออยากกลับไปใช้รายชื่อเริ่มต้น</p>
            <button className="btn danger" onClick={() => { savePersonnel(defaultPersonnel); persist({ ...plan, personnel: defaultPersonnel, shifts: [] }, 'รีเซ็ตข้อมูลแล้ว'); }}>รีเซ็ตข้อมูล</button>
          </div>
        </section>
      )}

      {picker && selectedPickerPerson && (
        <div className="modal-backdrop" onClick={() => setPicker(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2>{selectedPickerPerson.fullName}</h2>
            <p className="muted">{formatThaiDate(picker.day, month, buddhistYear)}</p>
            <div className="shift-picker">
              {shiftCodes.map((code) => (
                <button
                  key={code || 'blank'}
                  className={`btn ${code && shiftMeta[code] ? shiftMeta[code].className : ''}`}
                  onClick={() => { updateCell(picker.personnelId, picker.day, code); setPicker(null); }}
                >
                  {code || 'ว่าง'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <PrintDocument plan={plan} />
    </main>
  );
}

function PrintDocument({ plan }: { plan: MonthPlan }) {
  const totalDays = daysInMonth(plan.month, plan.buddhistYear);
  return (
    <div className="print-doc">
      <h2 style={{ textAlign: 'center' }}>บัญชีรายชื่อและตารางเวลาขึ้นปฏิบัติงาน</h2>
      <p style={{ textAlign: 'center' }}>ประจำเดือน {thaiMonths[plan.month - 1]} พ.ศ. {plan.buddhistYear}</p>
      <table>
        <thead><tr><th>วัน เดือน ปี</th><th>เวรดึก</th><th>เวรเช้า</th><th>เวรบ่าย</th></tr></thead>
        <tbody>
          {Array.from({ length: totalDays }, (_, i) => {
            const day = i + 1;
            const names = (code: 'ด' | 'ช' | 'บ') => plan.personnel.filter((person) => getShift(plan, person.id, day) === code).map((person) => person.nickname || person.fullName).join(', ');
            return <tr key={day}><td>{formatThaiDate(day, plan.month, plan.buddhistYear)}</td><td>{names('ด')}</td><td>{names('ช')}</td><td>{names('บ')}</td></tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

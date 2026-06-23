'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { thaiMonths } from '../../lib/date';
import { summarize } from '../../lib/logic';
import { MonthPlan } from '../../lib/types';
import { exportOtDocx, exportReserveDocx, exportSummaryDocx } from '../../lib/documents';
import { ShiftPlan, listenPlanSync, loadCurrentPlan, loadPlan, savePlan, toLegacyPlan } from '../shiftStore';

export default function TemplatesPage() {
  const [plan, setPlan] = useState<ShiftPlan | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const current = savePlan(loadCurrentPlan());
    setPlan(current);
    return listenPlanSync((next) => setPlan(next));
  }, []);

  const legacyPlan = useMemo(() => plan ? toLegacyPlan(plan) as unknown as MonthPlan : null, [plan]);
  const summary = useMemo(() => (legacyPlan ? summarize(legacyPlan) : []), [legacyPlan]);
  const totals = useMemo(() => ({
    morning: summary.reduce((sum, row) => sum + row.morning, 0),
    afternoon: summary.reduce((sum, row) => sum + row.afternoon, 0),
    night: summary.reduce((sum, row) => sum + row.night, 0),
    ot: summary.reduce((sum, row) => sum + row.otTotal, 0),
  }), [summary]);

  function changeMonth(month: number, year: number) {
    const next = savePlan(loadPlan(month, year));
    setPlan(next);
  }

  async function exportOt() {
    if (!legacyPlan) return;
    try {
      await exportOtDocx(legacyPlan);
      setMessage('ดาวน์โหลดคำสั่ง OT เป็นไฟล์ .docx ที่เปิดได้แล้ว');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'สร้างคำสั่ง OT ไม่สำเร็จ');
    }
  }

  async function exportReserve() {
    if (!legacyPlan) return;
    try {
      await exportReserveDocx(legacyPlan);
      setMessage('ดาวน์โหลดเวรสแปลเป็นไฟล์ .docx ที่เปิดได้แล้ว');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'สร้างเวรสแปลไม่สำเร็จ');
    }
  }

  async function exportSummary() {
    if (!legacyPlan) return;
    try {
      await exportSummaryDocx(legacyPlan);
      setMessage('ดาวน์โหลดสรุปเวรเป็นไฟล์ .docx ที่เปิดได้แล้ว');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'สร้างสรุปเวรไม่สำเร็จ');
    }
  }

  if (!plan || !legacyPlan) return null;

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-card">
          <h1>Export Word จากข้อมูลตารางเวรจริง</h1>
          <p>แก้แล้ว: ไม่ patch ไฟล์แม่แบบด้วย XML ตรง ๆ เพราะทำให้ Word เปิดไม่ได้ในบางเครื่อง ตอนนี้สร้าง .docx ใหม่ด้วยไลบรารี docx จากข้อมูล Store กลางโดยตรง</p>
        </div>
        <div className="quick-grid">
          <div className="stat"><div className="stat-label">เช้า</div><div className="stat-value">{totals.morning}</div></div>
          <div className="stat"><div className="stat-label">บ่าย</div><div className="stat-value">{totals.afternoon}</div></div>
          <div className="stat"><div className="stat-label">ดึก</div><div className="stat-value">{totals.night}</div></div>
          <div className="stat"><div className="stat-label">OT สีแดง</div><div className="stat-value">{totals.ot}</div></div>
        </div>
      </section>

      <section className="toolbar">
        <div className="field-row">
          <div className="field">
            <label>เดือน</label>
            <select className="select" value={plan.month} onChange={(event) => changeMonth(Number(event.target.value), plan.year)}>
              {thaiMonths.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>ปี พ.ศ.</label>
            <input className="input" inputMode="numeric" value={plan.year} onChange={(event) => changeMonth(plan.month, Number(event.target.value) || plan.year)} />
          </div>
        </div>
        <div className="actions">
          <Link className="btn" href="/">กลับตารางเวร</Link>
          <Link className="btn" href="/forms">ข้อมูลจริง</Link>
        </div>
      </section>

      {message ? <div className="notice" style={{ marginBottom: 14 }}>{message}</div> : null}

      <section className="panel-grid">
        <div className="card">
          <h2>สร้างเอกสาร Word ที่เปิดได้</h2>
          <p className="hint">คำสั่ง OT ใช้เฉพาะ OT สีแดงจากตารางจริง ส่วนเวรสแปลใช้เวรปกติจากตารางจริง</p>
          <div className="actions">
            <button className="btn primary" onClick={exportOt}>ดาวน์โหลด Word เวร OT</button>
            <button className="btn primary" onClick={exportReserve}>ดาวน์โหลด Word เวรสแปล</button>
            <button className="btn primary" onClick={exportSummary}>ดาวน์โหลด Word สรุปเวร</button>
          </div>
        </div>
        <div className="card">
          <h2>สาเหตุที่ไฟล์เดิมเปิดไม่ได้</h2>
          <p className="hint">ตัวเดิมแก้ไฟล์ .docx แม่แบบโดยเขียน XML ใน word/document.xml ตรง ๆ ถ้าโครงตารางในไฟล์จริงมี merge cell หรือ tag ซับซ้อน Word จะมองว่าไฟล์เสียหาย รอบนี้เปลี่ยนเป็นสร้าง DOCX ใหม่ที่ถูกต้องจากข้อมูลจริงในตาราง</p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h2>ข้อมูลที่จะถูกใส่ในเอกสาร</h2>
        <div className="grid-wrap">
          <table className="summary-table">
            <thead><tr><th>ชื่อ</th><th>ช</th><th>บ</th><th>ด</th><th>OT</th><th>ลา</th><th>รวม</th></tr></thead>
            <tbody>{summary.map((row) => <tr key={row.personnel.id}><td>{row.personnel.fullName}</td><td>{row.morning}</td><td>{row.afternoon}</td><td>{row.night}</td><td className="ot-table-text">{row.otTotal}</td><td>{row.leaveTotal}</td><td>{row.workTotal}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

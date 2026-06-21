'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { thaiMonths } from '../../lib/date';
import { summarize } from '../../lib/logic';
import { MonthPlan } from '../../lib/types';
import { clearTemplate, loadTemplateMeta, saveTemplateFile, TemplateKind, TemplateMeta } from '../../lib/template-documents';
import { exportOtFromTemplateStrict2, exportReserveFromTemplateStrict2 } from '../../lib/template-documents-strict2';
import { ShiftPlan, listenPlanSync, loadCurrentPlan, loadPlan, savePlan, toLegacyPlan } from '../shiftStore';

export default function TemplatesPage() {
  const [plan, setPlan] = useState<ShiftPlan | null>(null);
  const [message, setMessage] = useState('');
  const [templateMeta, setTemplateMeta] = useState<Record<TemplateKind, TemplateMeta | null>>({ ot: null, reserve: null });

  useEffect(() => {
    const current = savePlan(loadCurrentPlan());
    setPlan(current);
    refreshTemplateMeta();
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

  function refreshTemplateMeta() {
    setTemplateMeta({ ot: loadTemplateMeta('ot'), reserve: loadTemplateMeta('reserve') });
  }

  function changeMonth(month: number, year: number) {
    const next = savePlan(loadPlan(month, year));
    setPlan(next);
  }

  async function handleTemplateUpload(kind: TemplateKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await saveTemplateFile(kind, file);
      refreshTemplateMeta();
      setMessage(kind === 'ot' ? 'บันทึกแม่แบบคำสั่ง OT แล้ว' : 'บันทึกแม่แบบเวรสแปลแล้ว');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'บันทึกแม่แบบไม่สำเร็จ');
    } finally {
      event.target.value = '';
    }
  }

  function removeTemplate(kind: TemplateKind) {
    clearTemplate(kind);
    refreshTemplateMeta();
    setMessage(kind === 'ot' ? 'ลบแม่แบบคำสั่ง OT แล้ว' : 'ลบแม่แบบเวรสแปลแล้ว');
  }

  function exportOt() {
    if (!legacyPlan) return;
    try {
      if (!templateMeta.ot) { setMessage('ต้องอัปโหลดแม่แบบคำสั่ง OT ก่อน เพื่อคงฟอร์มต้นฉบับเป๊ะ'); return; }
      exportOtFromTemplateStrict2(legacyPlan);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'สร้างคำสั่ง OT ไม่สำเร็จ');
    }
  }

  function exportReserve() {
    if (!legacyPlan) return;
    try {
      if (!templateMeta.reserve) { setMessage('ต้องอัปโหลดแม่แบบเวรสแปลก่อน เพื่อคงฟอร์มต้นฉบับเป๊ะ'); return; }
      exportReserveFromTemplateStrict2(legacyPlan);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'สร้างเวรสแปลไม่สำเร็จ');
    }
  }

  if (!plan || !legacyPlan) return null;

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-card">
          <h1>แม่แบบเอกสาร Word แบบล็อกฟอร์ม</h1>
          <p>หน้านี้อ่านข้อมูลจาก Store กลางเดียวกับหน้าลงเวรทันที</p>
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
          <h2>1) ตั้งค่าแม่แบบ Word ต้นฉบับ</h2>
          <p className="hint">ต้องอัปโหลดไฟล์ต้นฉบับ .docx ก่อนสร้างเอกสาร เพื่อคงฟอร์มเดิม</p>
          <div className="person-card">
            <div className="person-title">คำสั่ง OT พยาบาล</div>
            <div className="muted">{templateMeta.ot ? `ล็อกฟอร์มจากไฟล์: ${templateMeta.ot.name}` : 'ยังไม่ได้ตั้งค่า'}</div>
            <div className="actions">
              <label className="btn primary">อัปโหลดแม่แบบ OT<input hidden type="file" accept=".docx" onChange={(event) => handleTemplateUpload('ot', event)} /></label>
              {templateMeta.ot ? <button className="btn danger" onClick={() => removeTemplate('ot')}>ลบ</button> : null}
            </div>
          </div>
          <div className="person-card" style={{ marginTop: 10 }}>
            <div className="person-title">เวรสแปล / เวรสำรอง</div>
            <div className="muted">{templateMeta.reserve ? `ล็อกฟอร์มจากไฟล์: ${templateMeta.reserve.name}` : 'ยังไม่ได้ตั้งค่า'}</div>
            <div className="actions">
              <label className="btn primary">อัปโหลดแม่แบบเวรสแปล<input hidden type="file" accept=".docx" onChange={(event) => handleTemplateUpload('reserve', event)} /></label>
              {templateMeta.reserve ? <button className="btn danger" onClick={() => removeTemplate('reserve')}>ลบ</button> : null}
            </div>
          </div>
        </div>
        <div className="card">
          <h2>2) สร้างไฟล์จากข้อมูลกลาง</h2>
          <p className="hint">คำสั่ง OT ใช้เฉพาะ OT สีแดง ส่วนเวรสแปลใช้เวรปกติ</p>
          <div className="actions">
            <button className="btn primary" onClick={exportOt}>สร้างคำสั่ง OT</button>
            <button className="btn primary" onClick={exportReserve}>สร้างเวรสแปล</button>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h2>ข้อมูลจาก Store กลางที่จะถูกใส่ในเอกสาร</h2>
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

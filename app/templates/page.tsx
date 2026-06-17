'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { thaiMonths } from '../../lib/date';
import { summarize } from '../../lib/logic';
import { listPlans, loadPersonnel, loadPlan, makeBlankPlan, savePlan } from '../../lib/storage';
import { MonthPlan } from '../../lib/types';
import { clearTemplate, loadTemplateMeta, saveTemplateFile, TemplateKind, TemplateMeta } from '../../lib/template-documents';
import { exportOtFromTemplateStrict, exportReserveFromTemplateStrict } from '../../lib/template-documents-strict';

const now = new Date();
const defaultMonth = now.getMonth() + 1;
const defaultBuddhistYear = now.getFullYear() + 543;

export default function TemplatesPage() {
  const [month, setMonth] = useState(defaultMonth);
  const [buddhistYear, setBuddhistYear] = useState(defaultBuddhistYear);
  const [plan, setPlan] = useState<MonthPlan | null>(null);
  const [plans, setPlans] = useState<MonthPlan[]>([]);
  const [message, setMessage] = useState('');
  const [templateMeta, setTemplateMeta] = useState<Record<TemplateKind, TemplateMeta | null>>({ ot: null, reserve: null });

  useEffect(() => {
    const loaded = loadPlan(month, buddhistYear) ?? makeBlankPlan(month, buddhistYear, loadPersonnel());
    setPlan(loaded);
    setPlans(listPlans());
    refreshTemplateMeta();
  }, [month, buddhistYear]);

  const summary = useMemo(() => (plan ? summarize(plan) : []), [plan]);
  const totals = useMemo(() => ({
    morning: summary.reduce((sum, row) => sum + row.morning, 0),
    afternoon: summary.reduce((sum, row) => sum + row.afternoon, 0),
    night: summary.reduce((sum, row) => sum + row.night, 0),
    ot: summary.reduce((sum, row) => sum + row.otTotal, 0),
  }), [summary]);

  function refreshTemplateMeta() {
    setTemplateMeta({ ot: loadTemplateMeta('ot'), reserve: loadTemplateMeta('reserve') });
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

  function saveCurrentPlan() {
    if (!plan) return;
    savePlan(plan);
    setPlans(listPlans());
    setMessage('บันทึกแผนเวรแล้ว');
  }

  function selectPlan(planId: string) {
    const selected = plans.find((item) => item.id === planId);
    if (!selected) return;
    setMonth(selected.month);
    setBuddhistYear(selected.buddhistYear);
    setPlan(selected);
  }

  function exportOt() {
    if (!plan) return;
    try {
      if (!templateMeta.ot) {
        setMessage('ต้องอัปโหลดแม่แบบคำสั่ง OT ก่อน เพื่อคงฟอร์มต้นฉบับเป๊ะ');
        return;
      }
      exportOtFromTemplateStrict(plan);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'สร้างคำสั่ง OT ไม่สำเร็จ');
    }
  }

  function exportReserve() {
    if (!plan) return;
    try {
      if (!templateMeta.reserve) {
        setMessage('ต้องอัปโหลดแม่แบบเวรสแปลก่อน เพื่อคงฟอร์มต้นฉบับเป๊ะ');
        return;
      }
      exportReserveFromTemplateStrict(plan);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'สร้างเวรสแปลไม่สำเร็จ');
    }
  }

  if (!plan) return null;

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-card">
          <h1>แม่แบบเอกสาร Word แบบล็อกฟอร์ม</h1>
          <p>คำสั่ง OT จะดึงเฉพาะ OT สีแดง ช/บ/ด ส่วนเวรสแปลจะดึงจากเวรปกติ ช/บ/ด</p>
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
          <Link className="btn" href="/">กลับตารางเวร</Link>
          <button className="btn" onClick={saveCurrentPlan}>บันทึก</button>
          <select className="select" style={{ width: 'auto' }} defaultValue="" onChange={(event) => selectPlan(event.target.value)}>
            <option value="" disabled>เลือกเดือนที่บันทึกไว้...</option>
            {plans.map((item) => <option key={item.id} value={item.id}>{thaiMonths[item.month - 1]} {item.buddhistYear}</option>)}
          </select>
        </div>
      </section>

      {message ? <div className="notice" style={{ marginBottom: 14 }}>{message}</div> : null}

      <section className="panel-grid">
        <div className="card">
          <h2>1) ตั้งค่าแม่แบบ Word ต้นฉบับ</h2>
          <p className="hint">ต้องอัปโหลดไฟล์ต้นฉบับ .docx ก่อนสร้างเอกสาร เพื่อไม่ให้ระบบใช้ฟอร์มที่สร้างใหม่</p>

          <div className="person-card">
            <div className="person-title">คำสั่ง OT พยาบาล</div>
            <div className="muted">{templateMeta.ot ? `ล็อกฟอร์มจากไฟล์: ${templateMeta.ot.name}` : 'ยังไม่ได้ตั้งค่า — ยังสร้างแบบล็อกฟอร์มไม่ได้'}</div>
            <div className="actions">
              <label className="btn primary">อัปโหลดแม่แบบ OT<input hidden type="file" accept=".docx" onChange={(event) => handleTemplateUpload('ot', event)} /></label>
              {templateMeta.ot ? <button className="btn danger" onClick={() => removeTemplate('ot')}>ลบ</button> : null}
            </div>
          </div>

          <div className="person-card" style={{ marginTop: 10 }}>
            <div className="person-title">เวรสแปล / เวรสำรอง</div>
            <div className="muted">{templateMeta.reserve ? `ล็อกฟอร์มจากไฟล์: ${templateMeta.reserve.name}` : 'ยังไม่ได้ตั้งค่า — ยังสร้างแบบล็อกฟอร์มไม่ได้'}</div>
            <div className="actions">
              <label className="btn primary">อัปโหลดแม่แบบเวรสแปล<input hidden type="file" accept=".docx" onChange={(event) => handleTemplateUpload('reserve', event)} /></label>
              {templateMeta.reserve ? <button className="btn danger" onClick={() => removeTemplate('reserve')}>ลบ</button> : null}
            </div>
          </div>
        </div>

        <div className="card">
          <h2>2) สร้างไฟล์จากฟอร์มเดิม</h2>
          <p className="hint">คำสั่ง OT ใช้เฉพาะตัวแดง OT:ช/บ/ด เท่านั้น</p>
          <div className="actions">
            <button className="btn primary" onClick={exportOt}>สร้างคำสั่ง OT จากฟอร์มเดิม</button>
            <button className="btn primary" onClick={exportReserve}>สร้างเวรสแปลจากฟอร์มเดิม</button>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h2>ข้อมูลที่จะถูกใส่ในเอกสาร</h2>
        <div className="grid-wrap">
          <table className="summary-table">
            <thead><tr><th>ชื่อ</th><th>ช</th><th>บ</th><th>ด</th><th>OT</th><th>ลา</th><th>รวม</th></tr></thead>
            <tbody>
              {summary.map((row) => (
                <tr key={row.personnel.id}>
                  <td>{row.personnel.fullName}</td>
                  <td>{row.morning}</td>
                  <td>{row.afternoon}</td>
                  <td>{row.night}</td>
                  <td className="ot-table-text">{row.otTotal}</td>
                  <td>{row.leaveTotal}</td>
                  <td>{row.workTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

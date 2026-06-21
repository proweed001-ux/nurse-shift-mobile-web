'use client';

import { originalForms } from '../sourceData';
import { daysInPlanMonth, loadCurrentPlan, planText, resetOriginalPlan } from '../shiftStore';

export default function FormsPage() {
  const plan = loadCurrentPlan();
  const totalDays = daysInPlanMonth(plan.month, plan.year);

  function loadToHome() {
    resetOriginalPlan();
    location.href = '/';
  }

  return <main className="p"><style>{css}</style><section className="hero"><h1>ข้อมูลจริงจากแบบฟอร์มต้นฉบับ</h1><p>{originalForms.excel.title}</p><p>{originalForms.excel.group}</p></section><section className="actions"><button onClick={loadToHome}>โหลดข้อมูลจริงเข้า Store กลาง</button><a href="/">กลับหน้าลงเวร</a><a href="/templates">หน้าแม่แบบ Word</a></section><section className="card"><h2>แบบฟอร์มที่ดึงมา</h2><p><b>Excel:</b> {originalForms.excel.sourceFile}</p><p><b>หัวเอกสาร:</b> {originalForms.excel.note}</p><p><b>OT Word:</b> {originalForms.ot.columns.join(' / ')}</p><p><b>เวรสแปล:</b> {originalForms.reserve.columns.join(' / ')}</p></section><section className="card"><h2>รายชื่อจริง {plan.people.length} คน</h2><div className="wrap"><table><thead><tr><th>ชื่อ</th><th>ตำแหน่ง</th>{Array.from({length: Math.min(10,totalDays)},(_,i)=><th key={i}>{i+1}</th>)}</tr></thead><tbody>{plan.people.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.position}</td>{Array.from({length: Math.min(10,totalDays)}, (_, i) => { const value=planText(plan,p.id,i+1); return <td key={i} className={value.includes('OT') ? 'ot' : ''}>{value || '-'}</td>; })}</tr>)}</tbody></table></div></section></main>;
}

const css = `body{margin:0;background:#f1f5f9;font-family:system-ui;color:#0f172a}.p{max-width:1100px;margin:auto;padding:12px}.hero{background:linear-gradient(135deg,#1e3a8a,#2563eb);color:white;border-radius:22px;padding:18px}.actions{display:grid;grid-template-columns:1fr;gap:8px;margin:10px 0}button,a{border:0;border-radius:14px;background:#e2e8f0;color:#0f172a;padding:12px;font-weight:800;text-align:center;text-decoration:none}.actions button{background:#16a34a;color:white}.card{background:white;border-radius:18px;padding:12px;box-shadow:0 8px 22px #cbd5e1;margin:10px 0}.wrap{overflow:auto}table{border-collapse:separate;border-spacing:0;width:max-content;min-width:100%;font-size:13px}th,td{border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;min-width:52px;padding:6px;text-align:center}th{background:#dbeafe;position:sticky;top:0}td:first-child,th:first-child{position:sticky;left:0;background:white;text-align:left;min-width:170px}.ot{color:#dc2626}@media(min-width:760px){.actions{grid-template-columns:1fr 1fr 1fr}}`;
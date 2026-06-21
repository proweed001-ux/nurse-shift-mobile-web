'use client';

import { useEffect, useMemo, useState } from 'react';
import ShiftImageScanner, { ScanResult } from './ShiftImageScannerV2';
import {
  Code,
  Person,
  ShiftPlan,
  SOURCE_MONTH,
  SOURCE_YEAR,
  cellId,
  daysInPlanMonth,
  listenPlanSync,
  loadPlan,
  makePlan,
  planText,
  realPeople,
  resetOriginalPlan,
  savePlan,
} from './shiftStore';

const codes: Code[] = ['ช','บ','ด','0','Va','SL','PL','PH'];
const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
type Mode = 'command' | 'table' | 'scan' | 'check' | 'people' | 'backup';

export default function Home() {
  const [month, setMonth] = useState(SOURCE_MONTH);
  const [year, setYear] = useState(SOURCE_YEAR);
  const [plan, setPlan] = useState<ShiftPlan | null>(null);
  const [mode, setMode] = useState<Mode>('command');
  const [pick, setPick] = useState<{ person: Person; day: number } | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    const loaded = savePlan(loadPlan(SOURCE_MONTH, SOURCE_YEAR));
    setPlan(loaded);
    setMonth(loaded.month);
    setYear(loaded.year);
    return listenPlanSync((next) => {
      setPlan(next);
      setMonth(next.month);
      setYear(next.year);
    });
  }, []);

  useEffect(() => {
    if (!plan) return;
    if (plan.month !== month || plan.year !== year) setPlan(loadPlan(month, year));
  }, [month, year]);

  const totalDays = daysInPlanMonth(month, year);
  const active = plan?.people.filter((p) => p.active) || [];
  const issues = useMemo(() => {
    if (!plan) return [] as string[];
    const out: string[] = [];
    for (let d = 1; d <= totalDays; d += 1) {
      for (const code of ['ช','บ','ด']) {
        if (!active.some((p) => (plan.cells[cellId(p.id,d)] || []).includes(code))) out.push(`วันที่ ${d} ยังไม่มีเวร ${code}`);
      }
    }
    for (const person of active) {
      for (let d = 1; d <= totalDays; d += 1) {
        if ((plan.cells[cellId(person.id,d)] || []).includes('ด') && (plan.cells[cellId(person.id,d+1)] || []).includes('ช')) out.push(`${person.name} ดึกต่อเช้า วันที่ ${d}-${d+1}`);
      }
    }
    return out;
  }, [plan, active, totalDays]);

  if (!plan) return null;

  function save(next: ShiftPlan) {
    const saved = savePlan(next);
    setPlan(saved);
    setMonth(saved.month);
    setYear(saved.year);
  }

  function resetRealData() { save(resetOriginalPlan()); }

  function toggle(person: Person, day: number, target: 'cells' | 'ot', code: string) {
    const id = cellId(person.id, day);
    const list = plan[target][id] || [];
    const next = list.includes(code) ? list.filter((x) => x !== code) : [...list, code];
    save({ ...plan, [target]: { ...plan[target], [id]: next } });
  }

  function applyScanResults(results: ScanResult[]) {
    const nextOt = { ...plan.ot };
    results.forEach((row) => {
      if (row.shift !== 'unknown') nextOt[cellId(row.personId, row.date)] = [row.shift];
    });
    save({ ...plan, ot: nextOt });
    setMode('table');
  }

  function csv() {
    const rows = active.map((p) => [p.name, ...Array.from({ length: totalDays }, (_, i) => planText(plan, p.id, i + 1))].map((x) => `"${x}"`).join(','));
    const data = '\ufeffชื่อ,' + Array.from({length: totalDays}, (_,i)=>i+1).join(',') + '\n' + rows.join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' }));
    a.download = `ตารางเวร_X10_${month}_${year}.csv`;
    a.click();
  }

  function backup() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(plan,null,2)], { type: 'application/json' }));
    a.download = `backup_X10_${month}_${year}.json`;
    a.click();
  }

  return <main className="x"><style>{css}</style><nav>{(['command','table','scan','check','people','backup'] as Mode[]).map((m) => <button key={m} className={mode===m?'on':''} onClick={() => setMode(m)}>{m==='command'?'Command':m==='table'?'ตารางเวร':m==='scan'?'สแกนรูป':m==='check'?'ตรวจสอบ':m==='people'?'บุคลากร':'Backup'}</button>)}<a href="/forms">ข้อมูลจริง</a><a href="/templates">แม่แบบ Word</a></nav><section className="hero"><h1>Nurse Shift Pro X10</h1><p>ทุกหน้าใช้ข้อมูลกลางชุดเดียวแล้ว: รายชื่อจริง {realPeople.length} คน / เดือนกรกฎาคม 2569 / ตารางเวร / OT / แม่แบบเอกสาร / สแกนรูปแบบ Grid-based Red Scanner</p><p><button onClick={resetRealData}>รีโหลดรายชื่อและตารางจริง</button></p></section><section className="bar"><select value={month} onChange={(e)=>setMonth(+e.target.value)}>{months.map((m,i)=><option value={i+1} key={m}>{m}</option>)}</select><input value={year} onChange={(e)=>setYear(+e.target.value||SOURCE_YEAR)} /><button onClick={() => save(makePlan(month, year))}>สร้างเดือนใหม่</button></section>{mode==='command' && <section className="grid"><Card title="คำสั่งเร็ว"><button onClick={()=>setMode('table')}>ลงเวร</button><button onClick={()=>setMode('scan')}>สแกนจากรูปถ่าย</button><button onClick={csv}>Export CSV</button><button onClick={()=>window.print()}>PDF</button><button onClick={backup}>Backup</button></Card><Card title="ภาพรวม"><b>คนใช้งาน {active.length}</b><b>ปัญหา {issues.length}</b><b>ช่องที่กรอก {Object.keys(plan.cells).length}</b><b className="red">OT {Object.keys(plan.ot).length}</b></Card></section>}{mode==='table' && <section><div className="actions"><button onClick={()=>setMode('scan')}>สแกนจากรูปถ่าย</button><button onClick={csv}>CSV</button><button onClick={()=>window.print()}>PDF</button><button onClick={backup}>Backup</button><button onClick={resetRealData}>โหลดข้อมูลจริง</button></div><div className="wrap"><table><thead><tr><th className="name">ชื่อ</th>{Array.from({length:totalDays},(_,i)=><th key={i}>{i+1}</th>)}</tr></thead><tbody>{active.map((p)=><tr key={p.id}><td className="name"><b>{p.name}</b><small>{p.position}</small></td>{Array.from({length:totalDays},(_,i)=>{const day=i+1, t=planText(plan,p.id,day); return <td className={t.includes('OT')?'ot':''} onClick={()=>setPick({person:p,day})} key={day}>{t||'+'}</td>})}</tr>)}</tbody></table></div></section>}{mode==='scan' && <ShiftImageScanner people={active} days={totalDays} onConfirm={applyScanResults} />}{mode==='check' && <section className="card"><h2>Smart Check</h2>{issues.length?issues.map((i)=><p className="warn" key={i}>{i}</p>):<p>ไม่พบปัญหา</p>}</section>}{mode==='people' && <section className="card"><input value={newName} onChange={(e)=>setNewName(e.target.value)} placeholder="ชื่อ-สกุล"/><button onClick={()=>{ if(newName.trim()) { save({...plan, people:[...plan.people,{id:'p'+Date.now(),name:newName.trim(),active:true}]}); setNewName(''); }}}>เพิ่มคน</button>{plan.people.map((p)=><p key={p.id}><input value={p.name} onChange={(e)=>save({...plan, people:plan.people.map((x)=>x.id===p.id?{...x,name:e.target.value}:x)})}/><label><input type="checkbox" checked={p.active} onChange={()=>save({...plan, people:plan.people.map((x)=>x.id===p.id?{...x,active:!x.active}:x)})}/> ใช้งาน</label></p>)}</section>}{mode==='backup' && <section className="card"><button onClick={backup}>Backup JSON</button><pre>{JSON.stringify({เดือน:month,ปี:year,คน:plan.people.length,ช่อง:Object.keys(plan.cells).length,ot:Object.keys(plan.ot).length,store:'unified'},null,2)}</pre></section>}{pick && <div className="modal" onClick={()=>setPick(null)}><div className="box" onClick={(e)=>e.stopPropagation()}><h2>{pick.person.name}</h2><p>{pick.person.position}</p><p>วันที่ {pick.day}</p><h3>เวรปกติ</h3><div className="pick">{codes.map((c)=><button key={c} className={(plan.cells[cellId(pick.person.id,pick.day)]||[]).includes(c)?'on':''} onClick={()=>toggle(pick.person,pick.day,'cells',c)}>{c}</button>)}</div><h3>OT สีแดง</h3><div className="pick">{['ช','บ','ด'].map((c)=><button key={c} className={(plan.ot[cellId(pick.person.id,pick.day)]||[]).includes(c)?'on red':'red'} onClick={()=>toggle(pick.person,pick.day,'ot',c)}>{c}</button>)}</div><button onClick={()=>setPick(null)}>ปิด</button></div></div>}</main>;
}
function Card({title,children}:{title:string;children:React.ReactNode}){return <section className="card"><h2>{title}</h2>{children}</section>}
const css=`body{margin:0;background:#f1f5f9;font-family:system-ui;color:#0f172a}.x{max-width:1180px;margin:auto;padding:12px}button,a,label{border:0;border-radius:14px;background:#e2e8f0;color:#0f172a;padding:12px;font-weight:800;text-decoration:none;text-align:center}.on{background:#2563eb!important;color:white}nav,.bar,.actions{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:10px 0}.hero{background:linear-gradient(135deg,#1e3a8a,#2563eb);color:white;border-radius:22px;padding:18px}.hero button{background:white;color:#1e3a8a}select,input{border:1px solid #cbd5e1;border-radius:12px;padding:12px;font-size:16px}.grid{display:grid;gap:12px}.card,.wrap{background:white;border-radius:18px;padding:12px;box-shadow:0 8px 22px #cbd5e1}.card button{margin:4px}.wrap{overflow:auto;padding:0}table{border-collapse:separate;border-spacing:0;width:max-content;min-width:100%;font-size:13px}th,td{border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;min-width:52px;height:44px;text-align:center;padding:4px}th{position:sticky;top:0;background:#dbeafe;z-index:2}.name{position:sticky;left:0;z-index:3;min-width:210px;text-align:left;background:white}.name small{display:block;color:#64748b;font-size:11px}.ot,.red{color:#dc2626}.warn{background:#fef3c7;color:#92400e;border-radius:12px;padding:8px}.modal{position:fixed;inset:0;background:#0008;display:grid;place-items:center;padding:12px}.box{background:white;border-radius:22px;padding:16px;width:min(420px,100%)}.pick{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}pre{background:#0f172a;color:#e2e8f0;border-radius:12px;padding:12px}@media(min-width:760px){nav{grid-template-columns:repeat(8,1fr)}.bar{grid-template-columns:1fr 1fr auto}.grid{grid-template-columns:1fr 1fr}}@media print{nav,.bar,.actions,.modal,button,a,label{display:none!important}.card,.wrap,.hero{box-shadow:none}.x{max-width:none}th,td{font-size:9px;min-width:28px}}`;
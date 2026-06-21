export default function Home() {
  return (
    <main style={{ padding: 16, fontFamily: 'system-ui', maxWidth: 960, margin: '0 auto' }}>
      <h1>Nurse Shift Pro X10</h1>
      <p>ระบบตารางเวรพยาบาลเวอร์ชัน X10 กำลังจัดชุดฟังก์ชันเต็มเข้าหน้าแรก</p>
      <section style={{ display: 'grid', gap: 12 }}>
        <a href="/templates" style={{ padding: 16, borderRadius: 12, background: '#dbeafe', color: '#1e3a8a', fontWeight: 800, textDecoration: 'none' }}>เปิดหน้าแม่แบบ Word</a>
        <a href="https://nurse-shift-mobile-web-proweed-s-projects.vercel.app/templates" style={{ padding: 16, borderRadius: 12, background: '#e2e8f0', color: '#0f172a', fontWeight: 800, textDecoration: 'none' }}>เปิดจากโดเมนหลัก</a>
      </section>
    </main>
  );
}

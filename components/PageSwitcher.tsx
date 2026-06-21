import Link from 'next/link';

export default function PageSwitcher({ active }: { active: 'schedule' | 'templates' }) {
  return (
    <nav className="page-switcher" aria-label="สลับหน้าหลัก">
      <Link className={`page-switch ${active === 'schedule' ? 'active' : ''}`} href="/">
        ตารางเวร
        <small>ลงเวร / OT / Export</small>
      </Link>
      <Link className={`page-switch ${active === 'templates' ? 'active' : ''}`} href="/templates">
        แม่แบบ Word
        <small>ฟอร์มต้นฉบับ / เอกสาร</small>
      </Link>
    </nav>
  );
}

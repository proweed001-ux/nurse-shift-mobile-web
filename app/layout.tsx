import type { Metadata, Viewport } from 'next';
import './globals.css';
import './ot.css';

export const metadata: Metadata = {
  title: 'Nurse Shift Mobile',
  description: 'ระบบจัดตารางเวรพยาบาลและสร้างเอกสาร OT/เวรสำรองบนมือถือ',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0f766e',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

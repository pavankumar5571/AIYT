import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI-YouTube · Build Dashboard',
  description: 'Progress and cost of every AI-generated story video in the pipeline.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app">{children}</div>
      </body>
    </html>
  );
}

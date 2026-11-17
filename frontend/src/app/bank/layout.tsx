import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ZephyrBank — Business Banking',
  description: 'ZephyrBank — Secured by MSAS Multimodal Authentication Middleware',
};

export default function BankLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      {children}
    </div>
  );
}

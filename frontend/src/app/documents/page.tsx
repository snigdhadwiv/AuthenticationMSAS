'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, apiFetch } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

interface KYCDoc {
  has_kyc: boolean;
  id?: number;
  status?: string;
  document_type?: string;
  full_name?: string;
  dob?: string;
  ocr_name?: string;
  ocr_dob?: string;
  ocr_id_number?: string;
  field_match_score?: number;
  ocr_confidence?: number;
  liveness_passed?: boolean;
  voice_enrolled?: boolean;
  document_image_url?: string | null;
  selfie_image_url?: string | null;
  created_at?: string;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      {label}
    </span>
  );
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? '#16a34a' : pct >= 40 ? '#f59e0b' : '#dc2626';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full overflow-hidden bg-gray-200">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm font-bold w-10 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function DocumentsPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [kycDoc, setKycDoc] = useState<KYCDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { router.replace('/login'); return; }
    apiFetch('/kyc/my-docs/', token)
      .then(r => r.json())
      .then(setKycDoc)
      .catch(() => setKycDoc({ has_kyc: false }))
      .finally(() => setLoading(false));
  }, [token]);

  const links = [
    { name: 'HOME', isActive: false, onClick: () => router.push('/dashboard') },
    { name: 'TRANSACTIONS', isActive: false, onClick: () => router.push('/transaction/new') },
    { name: 'RISKS', isActive: false, onClick: () => router.push('/dashboard') },
    { name: 'DOCUMENTS', isActive: true, onClick: () => {} },
    { name: 'PROFILE', isActive: false, onClick: () => router.push('/profile') },
    { name: 'SETTINGS', isActive: false, onClick: () => router.push('/user-settings') },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f3f4f6' }}>
      <Navbar />
      <div className="flex flex-1 items-stretch">
        <Sidebar links={links} />
        <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>My Documents</h1>
            <p className="text-sm mt-1" style={{ color: '#374151' }}>KYC documents submitted and verified during onboarding.</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-24">
              <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
            </div>
          ) : !kycDoc?.has_kyc ? (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-16 text-center">
              <div className="text-6xl mb-4">📋</div>
              <h2 className="text-xl font-bold mb-2" style={{ color: '#111827' }}>No KYC Documents Found</h2>
              <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: '#374151' }}>
                Your account may have been created manually. Complete eKYC to link your identity documents.
              </p>
              <button onClick={() => router.push('/kyc')}
                className="bg-primary-red text-white px-8 py-3 rounded-xl font-semibold hover:bg-primary-red-hover transition-colors text-sm shadow-sm">
                Start eKYC Verification →
              </button>
            </div>
          ) : (
            <div className="space-y-5">

              {/* Status Banner */}
              <div className={`rounded-2xl p-5 flex items-center justify-between border shadow-sm ${kycDoc.status === 'APPROVED' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div>
                  <p className={`font-bold ${kycDoc.status === 'APPROVED' ? 'text-green-800' : 'text-yellow-800'}`}>
                    KYC Status: {kycDoc.status}
                  </p>
                  <p className={`text-sm mt-0.5 ${kycDoc.status === 'APPROVED' ? 'text-green-600' : 'text-yellow-600'}`}>
                    Submitted {kycDoc.created_at ? new Date(kycDoc.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                  </p>
                </div>
                {kycDoc.status === 'APPROVED' && (
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white text-xl font-bold shadow-sm">✓</div>
                )}
              </div>

              {/* Document + Selfie */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-gray-50">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#374151' }}>
                      {kycDoc.document_type?.replace('_', ' ') || 'Identity Document'}
                    </p>
                    <StatusBadge ok={!!kycDoc.document_image_url} label={kycDoc.document_image_url ? 'Uploaded' : 'Missing'} />
                  </div>
                  {kycDoc.document_image_url ? (
                    <img src={kycDoc.document_image_url} alt="Identity Document" className="w-full object-contain max-h-52 p-3 bg-white" />
                  ) : (
                    <div className="h-36 flex items-center justify-center bg-gray-50">
                      <span className="text-4xl opacity-30">📄</span>
                    </div>
                  )}
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 bg-gray-50">
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#374151' }}>Liveness Selfie</p>
                    <StatusBadge ok={!!kycDoc.liveness_passed} label={kycDoc.liveness_passed ? 'Verified' : 'Pending'} />
                  </div>
                  {kycDoc.selfie_image_url ? (
                    <img src={kycDoc.selfie_image_url} alt="Liveness Selfie" className="w-full object-cover max-h-52" />
                  ) : (
                    <div className="h-36 flex items-center justify-center bg-gray-50">
                      <span className="text-4xl opacity-30">🤳</span>
                    </div>
                  )}
                </div>
              </div>

              {/* AI Extracted Data */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#374151' }}>AI-Extracted Document Data</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {[
                    ['Full Name (OCR)', kycDoc.ocr_name || '—'],
                    ['Date of Birth (OCR)', kycDoc.ocr_dob || '—'],
                    ['Document Number', kycDoc.ocr_id_number || '—'],
                    ['Document Type', kycDoc.document_type?.replace('_', ' ') || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="px-5 py-3.5 flex justify-between items-center">
                      <span className="text-sm" style={{ color: '#374151' }}>{label}</span>
                      <span className="text-sm font-semibold" style={{ color: '#111827' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verification Scores */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#374151' }}>Verification Scores</p>
                </div>
                <div className="p-6 space-y-5">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm" style={{ color: '#374151' }}>Field Match (Name/DOB vs OCR)</span>
                    </div>
                    <ScoreBar value={kycDoc.field_match_score ?? 0} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm" style={{ color: '#374151' }}>OCR Confidence</span>
                    </div>
                    <ScoreBar value={kycDoc.ocr_confidence ?? 0} />
                  </div>
                  <div className="pt-2 flex gap-3 flex-wrap">
                    <StatusBadge ok={!!kycDoc.liveness_passed} label="Liveness" />
                    <StatusBadge ok={!!kycDoc.voice_enrolled} label="Voice Enrolled" />
                    <StatusBadge ok={kycDoc.status === 'APPROVED'} label="KYC Approved" />
                  </div>
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}

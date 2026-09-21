'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

const API = 'http://127.0.0.1:8000/api';

const EVENT_COLORS: Record<string, string> = {
  KYC_SUBMITTED:  'bg-blue-100 text-blue-800',
  DOC_UPLOADED:   'bg-purple-100 text-purple-800',
  OCR_EXTRACTED:  'bg-indigo-100 text-indigo-800',
  FIELD_MATCH:    'bg-cyan-100 text-cyan-800',
  LIVENESS_PASS:  'bg-green-100 text-green-800',
  LIVENESS_FAIL:  'bg-red-100 text-red-800',
  VOICE_ENROLLED: 'bg-teal-100 text-teal-800',
  AI_DECISION:    'bg-yellow-100 text-yellow-800',
  ADMIN_APPROVED: 'bg-green-200 text-green-900',
  ADMIN_REJECTED: 'bg-red-200 text-red-900',
  USER_CREATED:   'bg-emerald-100 text-emerald-800',
};

const STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
  PENDING:   { color: 'text-yellow-700 bg-yellow-50 border-yellow-200', icon: '⏳' },
  APPROVED:  { color: 'text-green-700 bg-green-50 border-green-200',    icon: '✅' },
  REJECTED:  { color: 'text-red-700 bg-red-50 border-red-200',          icon: '❌' },
  RETRY:     { color: 'text-orange-700 bg-orange-50 border-orange-200', icon: '🔄' },
  ESCALATED: { color: 'text-purple-700 bg-purple-50 border-purple-200', icon: '👁️' },
};

export default function KYCStatusPage() {
  const params   = useParams();
  const router   = useRouter();
  const appId    = params?.id as string;
  const [data, setData]   = useState<any>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await fetch(`${API}/kyc/status/${appId}/`);
      const d   = await res.json();
      if (!res.ok) throw new Error(d.error || 'Not found');
      setData(d);
    } catch (e: any) { setError(e.message); }
  };

  useEffect(() => { if (appId) load(); }, [appId]);

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-8 border border-border-brown text-center">
        <p className="text-red-600 font-medium">{error}</p>
        <button onClick={() => router.push('/kyc')} className="mt-4 text-primary-red text-sm hover:underline">Start New Application</button>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-border-brown border-t-primary-red rounded-full animate-spin" />
    </div>
  );

  const status = data.status as string;
  const cfg    = STATUS_CONFIG[status] || STATUS_CONFIG['PENDING'];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-border-brown px-6 py-4 flex items-center gap-3">
        <span className="text-primary-red font-bold text-xl">MSAS</span>
        <span className="text-secondary-brown text-sm">·</span>
        <span className="text-secondary-brown text-sm">KYC Application #{appId}</span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        {/* Status Card */}
        <div className={`rounded-xl border-2 p-6 text-center ${cfg.color}`}>
          <div className="text-4xl mb-2">{cfg.icon}</div>
          <h1 className="text-2xl font-bold mb-1">Application {status}</h1>
          {data.ai_rationale && <p className="text-sm mt-2">{data.ai_rationale}</p>}
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl border border-border-brown p-5 space-y-3 text-sm">
          <h3 className="font-semibold text-foreground uppercase text-xs tracking-wide border-b pb-2 mb-3">Application Summary</h3>
          {[
            ['Full Name', data.full_name],
            ['Email', data.email],
            ['Document Type', data.document_type],
            ['OCR Name', data.ocr_name || '—'],
            ['OCR ID Number', data.ocr_id_number || '—'],
            ['Field Match', data.field_match_score ? `${Math.round(data.field_match_score * 100)}%` : '—'],
            ['OCR Confidence', data.ocr_confidence ? `${Math.round(data.ocr_confidence * 100)}%` : '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-secondary-brown">{k}</span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
          <div className="flex gap-4 pt-2 border-t border-border-brown">
            <span className={`text-xs px-2 py-1 rounded-full ${data.liveness_passed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              Liveness {data.liveness_passed ? '✓' : '—'}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full ${data.voice_enrolled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              Voice {data.voice_enrolled ? '✓' : '—'}
            </span>
          </div>
        </div>

        {/* Audit Trail */}
        {data.audit_trail?.length > 0 && (
          <div className="bg-white rounded-xl border border-border-brown p-5">
            <h3 className="font-semibold text-foreground uppercase text-xs tracking-wide border-b pb-2 mb-4">Audit Trail</h3>
            <div className="space-y-3">
              {data.audit_trail.map((log: any, i: number) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-primary-red mt-1.5" />
                    {i < data.audit_trail.length - 1 && <div className="w-0.5 h-8 bg-border-brown" />}
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${EVENT_COLORS[log.event] || 'bg-gray-100 text-gray-700'}`}>
                        {log.event.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-secondary-brown">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {log.detail && Object.keys(log.detail).length > 0 && (
                      <pre className="text-xs text-secondary-brown mt-1 font-mono bg-gray-50 rounded px-2 py-1 overflow-auto">
                        {JSON.stringify(log.detail, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={load} className="flex-1 border border-border-brown text-secondary-brown py-2.5 rounded-xl hover:bg-gray-50 text-sm font-medium">
            Refresh Status
          </button>
          <button onClick={() => router.push('/login')} className="flex-1 bg-primary-red text-white py-2.5 rounded-xl hover:bg-primary-red-hover text-sm font-semibold">
            Go to Login
          </button>
        </div>
      </main>
    </div>
  );
}

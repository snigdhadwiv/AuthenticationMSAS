'use client';
import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, apiFetch } from '@/lib/auth';

interface AuditEntry { id: number; event_type: string; detail: any; timestamp: string; }
interface TxnDetail { id: number; user: string; amount: string; payee_name: string; status: string; risk_score: number; decision_rationale: string; created_at: string; }

const EVENT_ICONS: Record<string, string> = {
  TRANSACTION_CREATED:  '📝', RISK_ASSESSED:        '📊',
  CHALLENGE_STARTED:    '🚀', LIVENESS_PASS:        '✅',
  LIVENESS_FAIL:        '❌', AUDIO_MATCH:          '🎤',
  AUDIO_FAIL:           '🔇', DECISION_ALLOW:       '🟢',
  DECISION_DENY:        '🔴', DECISION_ESCALATE:    '🟡',
  ADMIN_APPROVED:       '✅', ADMIN_REJECTED:       '❌',
  LOW_RISK_PASSTHROUGH: '⚡',
};

export default function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuth();
  const router = useRouter();
  const [data,    setData]    = useState<{ transaction: TxnDetail; events: AuditEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    apiFetch(`/transactions/${id}/audit/`, token)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id, token]);

  const statusColor = (s: string) => {
    if (s === 'ALLOWED') return 'text-green-600 bg-green-50 border-green-200';
    if (s === 'DENIED')  return 'text-primary-red bg-red-50 border-red-200';
    if (s === 'ESCALATED') return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-border-brown px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-secondary-brown hover:text-primary-red text-sm">← Back</button>
        <span className="text-primary-red font-bold">MSAS</span>
        <span className="text-secondary-brown text-sm">Audit Trail</span>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-border-brown border-t-primary-red rounded-full animate-spin" />
          </div>
        ) : !data ? (
          <p className="text-center text-accent-brown py-20">Transaction not found.</p>
        ) : (
          <>
            {/* Transaction summary */}
            <div className="bg-white border border-border-brown rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-accent-brown uppercase tracking-wide">Transaction #{data.transaction.id}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">₹{parseFloat(data.transaction.amount).toLocaleString('en-IN')}</p>
                  <p className="text-secondary-brown">→ {data.transaction.payee_name}</p>
                  <p className="text-xs text-accent-brown mt-1">Risk: {Math.round(data.transaction.risk_score * 100)}%</p>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${statusColor(data.transaction.status)}`}>
                  {data.transaction.status}
                </span>
              </div>
              {data.transaction.decision_rationale && (
                <div className="mt-4 bg-gray-50 rounded-lg px-4 py-3 text-sm text-secondary-brown">
                  <span className="font-medium">Rationale: </span>{data.transaction.decision_rationale}
                </div>
              )}
            </div>

            {/* Event timeline */}
            <div>
              <h2 className="font-semibold text-foreground mb-4">Event Timeline</h2>
              <div className="relative">
                {/* vertical line */}
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border-brown" />
                <div className="space-y-4">
                  {data.events.map((log, i) => (
                    <div key={log.id} className="relative pl-12">
                      {/* dot */}
                      <div className="absolute left-3 top-3 w-4 h-4 rounded-full bg-white border-2 border-border-brown flex items-center justify-center text-xs">
                        {EVENT_ICONS[log.event_type] ?? '•'}
                      </div>
                      <div className="bg-white border border-border-brown rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {log.event_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-accent-brown">
                            {new Date(log.timestamp).toLocaleTimeString('en-IN')}
                          </span>
                        </div>
                        {Object.keys(log.detail).length > 0 && (
                          <pre className="text-xs text-accent-brown bg-gray-50 rounded p-2 overflow-x-auto mt-1">
                            {JSON.stringify(log.detail, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

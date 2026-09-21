'use client';
import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, apiFetch } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

interface AuditEntry { id: number; event_type: string; detail: any; timestamp: string; }
interface TxnDetail {
  id: number; user: string; amount: string; payee_name: string;
  payee_account: string; description: string; status: string;
  risk_score: number; risk_factors: Record<string, number>;
  challenge_required: boolean; liveness_passed: boolean | null;
  audio_matched: boolean | null; decision_rationale: string;
  reviewed_by: string | null; review_note: string; reviewed_at: string | null;
  created_at: string;
}

const EVENT_META: Record<string, { icon: string; label: string; color: string }> = {
  TRANSACTION_CREATED:  { icon: '📝', label: 'Transaction Created',        color: '#6b7280' },
  RISK_ASSESSED:        { icon: '📊', label: 'Risk Assessment',             color: '#6366f1' },
  CHALLENGE_STARTED:    { icon: '🚀', label: 'Step-Up Challenge Started',   color: '#d97706' },
  LIVENESS_PASS:        { icon: '✅', label: 'Liveness Check Passed',       color: '#16a34a' },
  LIVENESS_FAIL:        { icon: '❌', label: 'Liveness Check Failed',       color: '#dc2626' },
  AUDIO_MATCH:          { icon: '🎤', label: 'Voice Biometric Matched',     color: '#16a34a' },
  AUDIO_FAIL:           { icon: '🔇', label: 'Voice Biometric Failed',      color: '#dc2626' },
  DECISION_ALLOW:       { icon: '🟢', label: 'Decision: Approved',          color: '#16a34a' },
  DECISION_DENY:        { icon: '🔴', label: 'Decision: Denied',            color: '#dc2626' },
  DECISION_ESCALATE:    { icon: '🟡', label: 'Decision: Escalated to Admin', color: '#d97706' },
  ADMIN_APPROVED:       { icon: '✅', label: 'Admin Approved',              color: '#16a34a' },
  ADMIN_REJECTED:       { icon: '❌', label: 'Admin Rejected',              color: '#dc2626' },
  LOW_RISK_PASSTHROUGH: { icon: '⚡', label: 'Auto-Approved (Low Risk)',    color: '#16a34a' },
};

const RISK_LABELS: Record<string, string> = {
  transfer_amount: 'Transfer Amount',
  time_of_day:     'Time of Day',
  payee_risk:      'Payee Risk',
  device_velocity: 'Device Velocity',
  location_change: 'Location Change',
};

export default function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token, user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<{ transaction: TxnDetail; events: AuditEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const isAdmin = user?.is_staff ?? false;

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    apiFetch(`/transactions/${id}/audit/`, token)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, token]);

  const handleAdminAction = async (action: 'APPROVE' | 'REJECT') => {
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/review/${id}/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Action failed');
      setActionMsg(action === 'APPROVE' ? '✅ Transaction approved and executed.' : '❌ Transaction rejected and blocked.');
      // Refresh data
      const refreshed = await apiFetch(`/transactions/${id}/audit/`, token);
      setData(await refreshed.json());
    } catch (e: any) { setActionMsg('Error: ' + e.message); }
    finally { setActionLoading(false); }
  };

  const sidebarLinks = isAdmin ? [
    { name: 'USERS', isActive: false, onClick: () => router.push('/admin-dashboard') },
    { name: 'ESCALATIONS', isActive: false, onClick: () => router.push('/admin-dashboard?tab=escalations') },
    { name: 'KYC APPS', isActive: false, onClick: () => router.push('/admin-dashboard?tab=kyc') },
    { name: 'AUDIT LOGS', isActive: false, onClick: () => router.push('/admin-dashboard?tab=audit') },
  ] : [
    { name: 'HOME', isActive: false, onClick: () => router.push('/dashboard') },
    { name: 'TRANSACTIONS', isActive: true, onClick: () => router.push('/transactions') },
    { name: 'RISKS', isActive: false, onClick: () => router.push('/dashboard') },
    { name: 'DOCUMENTS', isActive: false, onClick: () => router.push('/documents') },
    { name: 'PROFILE', isActive: false, onClick: () => router.push('/profile') },
    { name: 'SETTINGS', isActive: false, onClick: () => router.push('/user-settings') },
  ];

  const txn = data?.transaction;
  const riskPct = Math.round((txn?.risk_score ?? 0) * 100);
  const riskColor = riskPct > 60 ? '#dc2626' : riskPct > 35 ? '#d97706' : '#16a34a';

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      ALLOWED: 'bg-green-100 text-green-700 border-green-200',
      DENIED: 'bg-red-100 text-red-700 border-red-200',
      ESCALATED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      PENDING: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    return `px-3 py-1 rounded-full text-sm font-bold border ${map[s] || map.PENDING}`;
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f3f4f6' }}>
      <Navbar />
      <div className="flex flex-1 items-stretch">
        <Sidebar links={sidebarLinks} />

        <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">

          {/* Back */}
          <button onClick={() => router.back()}
            className="flex items-center gap-1 text-sm mb-6 hover:underline"
            style={{ color: '#374151' }}>
            ← Back
          </button>

          {loading ? (
            <div className="flex justify-center py-24">
              <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
            </div>
          ) : !data || !txn ? (
            <div className="text-center py-24" style={{ color: '#374151' }}>Transaction not found.</div>
          ) : (
            <div className="space-y-5">

              {/* ── Hero card ─────────────────────────────────────── */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 flex items-start justify-between border-b border-gray-100"
                  style={{ background: txn.status === 'ESCALATED' ? '#fffbeb' : txn.status === 'DENIED' ? '#fef2f2' : txn.status === 'ALLOWED' ? '#f0fdf4' : '#f9fafb' }}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#374151' }}>
                      Transaction #{txn.id}
                    </p>
                    <p className="text-3xl font-bold" style={{ color: '#111827' }}>
                      ₹{parseFloat(txn.amount).toLocaleString('en-IN')}
                    </p>
                    <p className="text-sm mt-1" style={{ color: '#374151' }}>
                      → {txn.payee_name}
                      {txn.payee_account && <span className="ml-2 font-mono text-xs" style={{ color: '#6b7280' }}>@{txn.payee_account}</span>}
                    </p>
                    {txn.description && <p className="text-xs mt-1 italic" style={{ color: '#6b7280' }}>"{txn.description}"</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={statusBadge(txn.status)}>{txn.status}</span>
                    <p className="text-xs" style={{ color: '#6b7280' }}>
                      {new Date(txn.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-xs" style={{ color: '#374151' }}>User: <span className="font-semibold">{txn.user}</span></p>
                  </div>
                </div>

                {/* Risk + biometrics row */}
                <div className="px-6 py-5 grid grid-cols-2 gap-6 border-b border-gray-100">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#374151' }}>Risk Score</p>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 h-3 rounded-full overflow-hidden bg-gray-200">
                        <div className="h-full rounded-full transition-all" style={{ width: `${riskPct}%`, background: riskColor }} />
                      </div>
                      <span className="text-xl font-bold w-14 text-right" style={{ color: riskColor }}>{riskPct}%</span>
                    </div>
                    {txn.risk_factors && Object.entries(txn.risk_factors).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs w-32 flex-shrink-0" style={{ color: '#374151' }}>{RISK_LABELS[k] ?? k}</span>
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-gray-200">
                          <div className="h-full rounded-full" style={{
                            width: `${Math.round((v as number) * 100)}%`,
                            background: (v as number) > 0.6 ? '#dc2626' : (v as number) > 0.35 ? '#d97706' : '#16a34a'
                          }} />
                        </div>
                        <span className="text-xs font-semibold w-8 text-right" style={{ color: '#374151' }}>
                          {Math.round((v as number) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#374151' }}>Biometric Results</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm" style={{ color: '#374151' }}>Step-Up Required:</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${txn.challenge_required ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                          {txn.challenge_required ? 'Yes' : 'No (auto-approved)'}
                        </span>
                      </div>
                      {txn.liveness_passed !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm" style={{ color: '#374151' }}>Liveness Check:</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${txn.liveness_passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {txn.liveness_passed ? '✓ Passed' : '✗ Failed'}
                          </span>
                        </div>
                      )}
                      {txn.audio_matched !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm" style={{ color: '#374151' }}>Voice Biometric:</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${txn.audio_matched ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {txn.audio_matched ? '✓ Matched' : '✗ Mismatch'}
                          </span>
                        </div>
                      )}
                    </div>

                    {txn.decision_rationale && (
                      <div className="mt-4">
                        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#374151' }}>AI Rationale</p>
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm leading-relaxed" style={{ color: '#111827' }}>
                          {txn.decision_rationale}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Admin review section (if reviewed) */}
                {txn.reviewed_by && (
                  <div className="px-6 py-4 bg-blue-50 border-t border-blue-100">
                    <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#1e40af' }}>Admin Review</p>
                    <p className="text-sm" style={{ color: '#1e3a8a' }}>
                      <span className="font-semibold">{txn.reviewed_by}</span> reviewed on{' '}
                      {txn.reviewed_at ? new Date(txn.reviewed_at).toLocaleString('en-IN') : ''}
                    </p>
                    {txn.review_note && <p className="text-sm mt-1" style={{ color: '#1e40af' }}>"{txn.review_note}"</p>}
                  </div>
                )}

                {/* Admin actions (for ESCALATED txns) */}
                {isAdmin && txn.status === 'ESCALATED' && (
                  <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                    {actionMsg ? (
                      <p className="font-semibold text-sm text-center py-1"
                        style={{ color: actionMsg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{actionMsg}</p>
                    ) : !showNote ? (
                      <div className="flex items-center justify-between">
                        <p className="text-sm" style={{ color: '#374151' }}>Admin action required for this escalated transaction.</p>
                        <button onClick={() => setShowNote(true)}
                          className="text-white text-sm font-semibold px-5 py-2 rounded-lg hover:opacity-90"
                          style={{ background: '#d32f2f' }}>
                          Take Action →
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                          placeholder="Review note (optional)…"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                          style={{ color: '#111827' }} />
                        <div className="flex gap-3">
                          <button onClick={() => handleAdminAction('APPROVE')} disabled={actionLoading}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60">
                            ✓ Approve — Execute Transfer
                          </button>
                          <button onClick={() => handleAdminAction('REJECT')} disabled={actionLoading}
                            className="flex-1 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 hover:opacity-90"
                            style={{ background: '#d32f2f' }}>
                            ✗ Reject — Block Transaction
                          </button>
                          <button onClick={() => setShowNote(false)}
                            className="border border-gray-200 px-4 rounded-lg text-sm hover:bg-gray-100" style={{ color: '#374151' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Audit Timeline ─────────────────────────────────── */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold" style={{ color: '#111827' }}>Event Timeline</h2>
                  <p className="text-xs mt-0.5" style={{ color: '#374151' }}>Tamper-evident audit trail — every step of this transaction.</p>
                </div>
                <div className="p-6">
                  <div className="relative">
                    <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />
                    <div className="space-y-4">
                      {data.events.map((log, i) => {
                        const meta = EVENT_META[log.event_type] ?? { icon: '•', label: log.event_type.replace(/_/g, ' '), color: '#6b7280' };
                        return (
                          <div key={log.id} className="relative pl-12">
                            <div className="absolute left-2.5 top-3 w-5 h-5 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-xs">
                              {meta.icon}
                            </div>
                            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-gray-300 transition-colors">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                                <span className="text-xs" style={{ color: '#6b7280' }}>
                                  {new Date(log.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                              </div>
                              {Object.keys(log.detail).length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {Object.entries(log.detail).map(([k, v]) => (
                                    <div key={k} className="flex gap-2 text-xs">
                                      <span className="font-medium capitalize" style={{ color: '#374151' }}>{k.replace(/_/g, ' ')}:</span>
                                      <span style={{ color: '#111827' }}>
                                        {typeof v === 'object' ? (
                                          <span className="font-mono">
                                            {Object.entries(v as Record<string, number>).map(([fk, fv]) =>
                                              `${RISK_LABELS[fk] ?? fk}: ${Math.round((fv as number) * 100)}%`
                                            ).join(' · ')}
                                          </span>
                                        ) : String(v)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
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

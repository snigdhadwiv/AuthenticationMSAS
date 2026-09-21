'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, apiFetch } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
interface User { id: number; username: string; email: string; first_name: string; last_name: string; is_active: boolean; is_enrolled: boolean; date_joined: string; }
interface Transaction { id: number; user: string; amount: string; payee_name: string; status: string; risk_score: number; decision_rationale: string; created_at: string; review_note: string; reviewed_by: string | null; }
interface AuditEntry { id: number; event_type: string; detail: any; timestamp: string; }
interface KYCApp { id: number; full_name: string; email: string; document_type: string; ocr_name: string; ocr_id_number: string; ocr_confidence: number; field_match_score: number; liveness_passed: boolean; voice_enrolled: boolean; status: string; ai_decision: string; ai_rationale: string; retry_count: number; review_note: string; created_at: string; document_image_url: string | null; selfie_image_url: string | null; created_username: string | null; }

type Tab = 'home' | 'users' | 'escalations' | 'audit' | 'kyc';

export default function AdminDashboard() {
  const { user, token, logout } = useAuth();
  const router  = useRouter();
  const [tab,   setTab]   = useState<Tab>('home');
  const [analytics, setAnalytics] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [escalations, setEscalations] = useState<Transaction[]>([]);
  const [auditLogs,   setAuditLogs]   = useState<AuditEntry[]>([]);
  const [kycApps,     setKycApps]     = useState<KYCApp[]>([]);
  const [loading,     setLoading]     = useState(false);

  // Create user form
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', first_name: '', last_name: '', phone: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  useEffect(() => {
    if (!token || !user?.is_staff) { router.replace('/login'); return; }
    loadTab(tab);
  }, [tab, token]);

  const loadTab = async (t: Tab) => {
    if (!token) return;
    setLoading(true);
    try {
      if (t === 'home') {
        const r = await apiFetch('/admin/analytics/', token);
        setAnalytics(await r.json());
      } else if (t === 'users') {
        const r = await apiFetch('/admin/users/', token);
        setUsers(await r.json());
      } else if (t === 'escalations') {
        const r = await apiFetch('/admin/escalations/', token);
        setEscalations(await r.json());
      } else if (t === 'kyc') {
        const r = await apiFetch('/admin/kyc/', token);
        setKycApps(await r.json());
      } else {
        const r = await apiFetch('/admin/audit-log/', token);
        setAuditLogs(await r.json());
      }
    } finally { setLoading(false); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(''); setFormSuccess('');
    if (!token) return;
    const res = await apiFetch('/admin/users/create/', token, { method: 'POST', body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) { setFormError(data.error); return; }
    setFormSuccess(`User "${form.username}" created!`);
    setForm({ username: '', email: '', password: '', first_name: '', last_name: '', phone: '' });
    setShowCreate(false);
    loadTab('users');
  };

  const handleDeleteUser = async (id: number, name: string) => {
    if (!confirm(`Delete user "${name}"?`)) return;
    await apiFetch(`/admin/users/${id}/delete/`, token!, { method: 'DELETE' });
    setUsers(u => u.filter(x => x.id !== id));
  };

  const handleReview = async (id: number, action: 'APPROVE' | 'REJECT') => {
    const note = action === 'REJECT' ? prompt('Rejection reason (optional):') ?? '' : '';
    await apiFetch(`/admin/review/${id}/`, token!, { method: 'POST', body: JSON.stringify({ action, note }) });
    setEscalations(e => e.filter(x => x.id !== id));
  };

  const eventColor = (type: string) => {
    if (type.includes('ALLOW') || type.includes('PASS') || type.includes('APPROVED') || type.includes('MATCH')) return 'bg-green-100 text-green-700';
    if (type.includes('DENY') || type.includes('FAIL') || type.includes('REJECTED')) return 'bg-red-100 text-primary-red';
    if (type.includes('ESCALATE')) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  };

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'home',        label: '🏠 Home / Analytics' },
    { key: 'users',       label: '👤 User Management',  badge: users.length },
    { key: 'escalations', label: '⚠️ Escalation Queue', badge: escalations.length },
    { key: 'kyc',         label: '🆔 KYC Applications', badge: kycApps.filter(a => a.status === 'PENDING' || a.status === 'ESCALATED').length },
    { key: 'audit',       label: '📋 Audit Log' },
  ];

  const sidebarLinks = [
    { name: 'HOME', isActive: tab === 'home', onClick: () => setTab('home') },
    { name: 'USERS', isActive: tab === 'users', onClick: () => setTab('users') },
    { name: 'ESCALATIONS', isActive: tab === 'escalations', onClick: () => setTab('escalations') },
    { name: 'KYC APPS', isActive: tab === 'kyc', onClick: () => setTab('kyc') },
    { name: 'AUDIT LOGS', isActive: tab === 'audit', onClick: () => setTab('audit') },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Navbar />

      <div className="flex flex-1 items-stretch">
        <Sidebar links={sidebarLinks} />

        <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--foreground)' }}>
            Admin Dashboard: {sidebarLinks.find(l => l.isActive)?.name}
          </h1>

        {formSuccess && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-4 text-sm">{formSuccess}</div>}

        {/* ── Home / Analytics Tab ──────────────────────────────────────────── */}
        {tab === 'home' && (
          <div className="space-y-6">
            {loading || !analytics ? (
              <div className="flex justify-center py-24"><div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" /></div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Users */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <p className="text-sm font-semibold text-gray-500 uppercase">Total Users</p>
                    <p className="text-3xl font-bold mt-2 text-gray-900">{analytics.users.total}</p>
                    <p className="text-xs text-gray-500 mt-2"><span className="text-green-600 font-bold">{analytics.users.enrolled}</span> enrolled with biometrics</p>
                  </div>
                  
                  {/* Total Transactions */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <p className="text-sm font-semibold text-gray-500 uppercase">Total Transactions</p>
                    <p className="text-3xl font-bold mt-2 text-gray-900">{analytics.transactions.total}</p>
                    <p className="text-xs text-gray-500 mt-2">All time platform volume</p>
                  </div>

                  {/* Pending Escalations */}
                  <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-sm bg-red-50">
                    <p className="text-sm font-semibold text-red-700 uppercase">Action Required</p>
                    <p className="text-3xl font-bold mt-2 text-red-700">{analytics.transactions.escalated}</p>
                    <p className="text-xs text-red-600 mt-2">Escalated transactions pending review</p>
                  </div>

                  {/* Pending KYC */}
                  <div className="bg-white border border-yellow-200 rounded-2xl p-6 shadow-sm bg-yellow-50">
                    <p className="text-sm font-semibold text-yellow-700 uppercase">KYC Queue</p>
                    <p className="text-3xl font-bold mt-2 text-yellow-700">{analytics.kyc.pending}</p>
                    <p className="text-xs text-yellow-600 mt-2">Applications waiting for approval</p>
                  </div>
                </div>

                {/* Secondary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Risk Engine Stats */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4">Risk Engine Breakdown</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">High Risk (&gt;80%)</span>
                          <span className="font-bold text-red-600">{analytics.risk.high} txns</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-red-500 h-2 rounded-full" style={{ width: `${Math.min((analytics.risk.high / (analytics.transactions.total || 1)) * 100, 100)}%` }}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Medium Risk (40-80%)</span>
                          <span className="font-bold text-yellow-600">{analytics.risk.medium} txns</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-yellow-500 h-2 rounded-full" style={{ width: `${Math.min((analytics.risk.medium / (analytics.transactions.total || 1)) * 100, 100)}%` }}></div></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Low Risk (&lt;40%)</span>
                          <span className="font-bold text-green-600">{analytics.risk.low} txns</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min((analytics.risk.low / (analytics.transactions.total || 1)) * 100, 100)}%` }}></div></div>
                      </div>
                    </div>
                  </div>

                  {/* Decisions Stats */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-4">Decision Outcomes</h3>
                    <div className="flex items-center gap-6">
                      <div className="relative w-32 h-32 flex-shrink-0">
                        {/* CSS-only pseudo donut chart for quick visual */}
                        <div className="absolute inset-0 rounded-full border-[16px] border-gray-100"></div>
                        <div className="absolute inset-0 rounded-full border-[16px] border-green-500" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 50%)' }}></div>
                        <div className="absolute inset-0 rounded-full border-[16px] border-red-500" style={{ clipPath: 'polygon(0 50%, 100% 100%, 0 100%)' }}></div>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                          <span className="text-sm text-gray-500">Total</span>
                          <span className="font-bold text-xl">{analytics.transactions.total}</span>
                        </div>
                      </div>
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="text-sm text-gray-600">Allowed</span>
                          </div>
                          <span className="font-bold">{analytics.transactions.allowed}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span className="text-sm text-gray-600">Denied</span>
                          </div>
                          <span className="font-bold">{analytics.transactions.denied}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <span className="text-sm text-gray-600">Escalated</span>
                          </div>
                          <span className="font-bold">{analytics.transactions.escalated}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Users Tab ─────────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowCreate(v => !v)}
                className="bg-primary-red hover:bg-primary-red-hover text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                {showCreate ? '✕ Cancel' : '+ Create User'}
              </button>
            </div>

            {showCreate && (
              <form onSubmit={handleCreateUser} className="bg-white border border-gray-200 rounded-xl p-6 grid grid-cols-2 gap-4">
                <h3 className="col-span-2 font-semibold" style={{ color: '#111827' }}>Create New User</h3>
                {formError && <p className="col-span-2 text-red-600 text-sm font-medium">{formError}</p>}
                {[
                  { label: 'Username *',   name: 'username',   type: 'text',     req: true },
                  { label: 'Password *',   name: 'password',   type: 'password', req: true },
                  { label: 'First Name',   name: 'first_name', type: 'text' },
                  { label: 'Last Name',    name: 'last_name',  type: 'text' },
                  { label: 'Email',        name: 'email',      type: 'email' },
                  { label: 'Phone',        name: 'phone',      type: 'tel' },
                ].map(f => (
                  <div key={f.name}>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>{f.label}</label>
                    <input
                      type={f.type} required={f.req}
                      value={(form as any)[f.name]}
                      onChange={e => setForm(v => ({ ...v, [f.name]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                      style={{ color: '#111827', background: '#f9fafb' }}
                    />
                  </div>
                ))}
                <div className="col-span-2 flex justify-end">
                  <button type="submit" className="bg-red-600 text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-red-700">
                    Create User
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>{['Username', 'Name', 'Email', 'Enrolled', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-8 text-gray-500">Loading…</td></tr>
                  ) : users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium" style={{ color: '#111827' }}>{u.username}</td>
                      <td className="px-4 py-3" style={{ color: '#374151' }}>{u.first_name} {u.last_name}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>{u.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${u.is_enrolled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {u.is_enrolled ? '✓ Enrolled' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>{new Date(u.date_joined).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDeleteUser(u.id, u.username)}
                          className="text-xs font-semibold hover:underline" style={{ color: '#d32f2f' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Escalations Tab ───────────────────────────────────────────────── */}
        {tab === 'escalations' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Pending Review', value: escalations.length, color: '#d32f2f' },
                { label: 'High Risk (>80%)', value: escalations.filter(e => e.risk_score > 0.8).length, color: '#dc2626' },
                { label: 'Medium Risk (60-80%)', value: escalations.filter(e => e.risk_score >= 0.6 && e.risk_score <= 0.8).length, color: '#d97706' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4 border border-gray-200 bg-white shadow-sm">
                  <p className="text-xs font-medium" style={{ color: '#374151' }}>{s.label}</p>
                  <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
              </div>
            ) : escalations.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-16 text-center shadow-sm">
                <div className="text-5xl mb-4">✅</div>
                <p className="font-bold text-lg" style={{ color: '#111827' }}>No Pending Escalations</p>
                <p className="text-sm mt-1" style={{ color: '#374151' }}>All flagged transactions have been reviewed.</p>
              </div>
            ) : (
              escalations.map(t => (
                <EscalationCard key={t.id} txn={t} token={token!}
                  onResolved={() => setEscalations(e => e.filter(x => x.id !== t.id))} />
              ))
            )}
          </div>
        )}

        {/* ── Audit Log Tab ─────────────────────────────────────────────────── */}
        {tab === 'audit' && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>{['Time', 'Transaction', 'Event', 'Detail', 'Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-500">Loading…</td></tr>
                ) : auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#374151' }}>
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: '#111827' }}>
                      Txn #{(log as any).transaction_id ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${eventColor(log.event_type)}`}>
                        {log.event_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono truncate max-w-xs" style={{ color: '#6b7280' }}>
                      {JSON.stringify(log.detail)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a href={`/audit/${(log as any).transaction_id}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-semibold hover:underline" style={{ color: '#d32f2f' }}>
                        View ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── KYC Applications Tab ────────────────────────────────────────────── */}
        {tab === 'kyc' && (
          <KYCApplicationsTab apps={kycApps} token={token!} onRefresh={() => loadTab('kyc')} />
        )}
        </main>
      </div>
    </div>
  );
}

// ─── KYC Applications Tab Component ──────────────────────────────────────────

function KYCApplicationsTab({ apps, token, onRefresh }: { apps: any[]; token: string; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const statusColor: Record<string, string> = {
    PENDING:   'bg-yellow-100 text-yellow-800',
    APPROVED:  'bg-green-100 text-green-800',
    REJECTED:  'bg-red-100 text-red-800',
    RETRY:     'bg-orange-100 text-orange-800',
    ESCALATED: 'bg-purple-100 text-purple-800',
  };

  const review = async (appId: number, action: 'APPROVE' | 'REJECT') => {
    setActionLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/kyc/${appId}/review/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review failed');
      if (data.username) alert(`Account created!\nUsername: ${data.username}\nPassword: ${data.password}`);
      setReviewing(null); setNote('');
      onRefresh();
    } catch (e: any) { alert(e.message); }
    finally { setActionLoading(false); }
  };

  if (apps.length === 0) return (
    <div className="text-center py-16 text-secondary-brown">No KYC applications yet.</div>
  );

  return (
    <div className="space-y-3">
      {apps.map(app => (
        <div key={app.id} className="bg-white rounded-xl border border-border-brown overflow-hidden">
          {/* Summary row */}
          <div
            className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50"
            onClick={() => setExpanded(expanded === app.id ? null : app.id)}
          >
            <div className="flex items-center gap-4">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[app.status] || 'bg-gray-100 text-gray-700'}`}>
                {app.status}
              </span>
              <div>
                <p className="font-semibold text-sm" style={{ color: '#111827' }}>{app.full_name}</p>
                <p className="text-xs" style={{ color: '#374151' }}>{app.email} · {app.document_type}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs" style={{ color: '#374151' }}>
              <span>Match: <strong className={app.field_match_score >= 0.7 ? 'text-green-700' : app.field_match_score >= 0.4 ? 'text-yellow-700' : 'text-red-700'}>{Math.round(app.field_match_score * 100)}%</strong></span>
              <span className={app.liveness_passed ? 'text-green-700 font-medium' : ''}>Liveness {app.liveness_passed ? '✓' : '—'}</span>
              <span className={app.voice_enrolled ? 'text-green-700 font-medium' : ''}>Voice {app.voice_enrolled ? '✓' : '—'}</span>
              <span>{new Date(app.created_at).toLocaleDateString('en-IN')}</span>
              <span className="text-lg">{expanded === app.id ? '▲' : '▼'}</span>
            </div>
          </div>

          {/* Expanded detail */}
          {expanded === app.id && (
            <div className="border-t border-gray-200 p-5 space-y-5 bg-gray-50">
              <div className="grid grid-cols-2 gap-5">
                {/* Left: Submitted vs OCR */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wide" style={{ color: '#374151' }}>Identity Verification</h4>
                  <table className="text-sm w-full">
                    <thead><tr>
                      <th className="text-left text-xs pb-2 font-medium" style={{ color: '#374151' }}>Field</th>
                      <th className="text-left text-xs pb-2 font-medium" style={{ color: '#374151' }}>Submitted</th>
                      <th className="text-left text-xs pb-2 font-medium" style={{ color: '#374151' }}>OCR Extracted</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="py-1.5 pr-3" style={{ color: '#374151' }}>Name</td>
                        <td className="py-1.5 font-medium pr-3" style={{ color: '#111827' }}>{app.full_name}</td>
                        <td className="py-1.5 font-mono" style={{ color: app.ocr_name ? '#111827' : '#6b7280' }}>{app.ocr_name || '—'}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 pr-3" style={{ color: '#374151' }}>ID Number</td>
                        <td className="py-1.5" style={{ color: '#111827' }}>—</td>
                        <td className="py-1.5 font-mono" style={{ color: '#111827' }}>{app.ocr_id_number || '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="flex gap-4 text-xs pt-2" style={{ color: '#374151' }}>
                    <span>Field Match: <strong className={app.field_match_score >= 0.7 ? 'text-green-700' : 'text-yellow-700'}>{Math.round(app.field_match_score * 100)}%</strong></span>
                    <span>OCR Confidence: <strong style={{ color: '#111827' }}>{Math.round(app.ocr_confidence * 100)}%</strong></span>
                  </div>
                  {app.ai_rationale && <p className="text-xs italic bg-white border border-gray-200 rounded-lg p-3" style={{ color: '#374151' }}>{app.ai_rationale}</p>}
                  {app.created_username && <p className="text-xs text-green-700 font-medium">✓ Account created: <span className="font-mono">{app.created_username}</span></p>}
                </div>

                {/* Right: Images */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wide" style={{ color: '#374151' }}>Captured Images</h4>
                  <div className="flex gap-3">
                    {app.document_image_url && (
                      <div>
                        <p className="text-xs mb-1" style={{ color: '#6b7280' }}>Document</p>
                        <img src={`http://127.0.0.1:8000${app.document_image_url}`} className="h-28 rounded-lg border border-gray-300 object-contain bg-white" alt="Document" />
                      </div>
                    )}
                    {app.selfie_image_url && (
                      <div>
                        <p className="text-xs mb-1" style={{ color: '#6b7280' }}>Selfie</p>
                        <img src={`http://127.0.0.1:8000${app.selfie_image_url}`} className="h-28 rounded-lg border border-gray-300 object-cover bg-white" alt="Selfie" />
                      </div>
                    )}
                    {!app.document_image_url && !app.selfie_image_url && <p className="text-xs" style={{ color: '#6b7280' }}>No images available</p>}
                  </div>
                </div>
              </div>

              {/* Admin action */}
              {(app.status === 'ESCALATED' || app.status === 'PENDING') && !app.created_username && (
                <div className="border-t border-gray-200 pt-4">
                  {reviewing === app.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={note} onChange={e => setNote(e.target.value)}
                        placeholder="Add a review note (optional)..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-red-500"
                        style={{ color: '#111827', background: '#f9fafb' }}
                      />
                      <div className="flex gap-3">
                        <button onClick={() => review(app.id, 'APPROVE')} disabled={actionLoading}
                          className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                          ✓ Approve & Create Account
                        </button>
                        <button onClick={() => review(app.id, 'REJECT')} disabled={actionLoading}
                          className="bg-primary-red text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-primary-red-hover disabled:opacity-50">
                          ✗ Reject Application
                        </button>
                        <button onClick={() => { setReviewing(null); setNote(''); }}
                          className="border border-border-brown px-4 py-2 rounded-lg text-sm text-secondary-brown hover:bg-gray-100">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setReviewing(app.id)}
                      className="bg-secondary-brown text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-accent-brown">
                      Review Application →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── EscalationCard ──────────────────────────────────────────────────────────
function EscalationCard({ txn, token, onResolved }: { txn: any; token: string; onResolved: () => void }) {
  const [showActions, setShowActions] = useState(false);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const riskPct = Math.round(txn.risk_score * 100);
  const riskColor = riskPct > 80 ? '#dc2626' : riskPct > 60 ? '#d97706' : '#16a34a';

  const submit = async (action: 'APPROVE' | 'REJECT') => {
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/review/${txn.id}/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');
      setMsg(action === 'APPROVE' ? '✅ Transaction approved and executed.' : '❌ Transaction rejected.');
      setTimeout(onResolved, 1500);
    } catch (e: any) { setMsg('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100"
        style={{ background: riskPct > 80 ? '#fef2f2' : '#fffbeb' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
            style={{ background: riskColor }}>
            {riskPct}%
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: '#111827' }}>
              Txn #{txn.id} — {txn.user}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#374151' }}>
              {new Date(txn.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <span className="ml-3 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
            ESCALATED
          </span>
        </div>
        <a href={`/audit/${txn.id}`} target="_blank" rel="noopener noreferrer"
          className="text-sm font-semibold hover:underline" style={{ color: '#d32f2f' }}>
          Full Details ↗
        </a>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: transaction details */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm" style={{ color: '#374151' }}>Amount</span>
            <span className="font-bold text-lg" style={{ color: '#111827' }}>
              ₹{parseFloat(txn.amount).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm" style={{ color: '#374151' }}>Payee</span>
            <span className="font-medium text-sm" style={{ color: '#111827' }}>{txn.payee_name}</span>
          </div>
          {txn.payee_account && (
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: '#374151' }}>Account</span>
              <span className="text-sm font-mono" style={{ color: '#6b7280' }}>{txn.payee_account}</span>
            </div>
          )}
          {/* Risk bar */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-sm" style={{ color: '#374151' }}>Risk Score</span>
              <span className="text-sm font-bold" style={{ color: riskColor }}>{riskPct}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full overflow-hidden bg-gray-200">
              <div className="h-full rounded-full transition-all" style={{ width: `${riskPct}%`, background: riskColor }} />
            </div>
          </div>
          {/* Biometric results */}
          <div className="flex gap-2 flex-wrap pt-1">
            {txn.liveness_passed === true && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">✓ Liveness Passed</span>}
            {txn.liveness_passed === false && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">✗ Liveness Failed</span>}
            {txn.audio_matched === true && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">✓ Voice Matched</span>}
            {txn.audio_matched === false && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">✗ Voice Mismatch</span>}
          </div>
        </div>

        {/* Right: AI rationale */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#374151' }}>AI Decision Rationale</p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm leading-relaxed" style={{ color: '#111827' }}>
            {txn.decision_rationale || 'No rationale recorded.'}
          </div>
          {txn.review_note && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm" style={{ color: '#1e40af' }}>
              <span className="font-bold">Admin Note: </span>{txn.review_note}
            </div>
          )}
        </div>
      </div>

      {/* Action footer */}
      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
        {msg ? (
          <p className="text-sm font-semibold text-center" style={{ color: msg.startsWith('✅') ? '#16a34a' : '#dc2626' }}>{msg}</p>
        ) : !showActions ? (
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: '#374151' }}>Review this escalated transaction to allow or block the funds.</p>
            <button onClick={() => setShowActions(true)}
              className="text-sm font-semibold px-5 py-2 rounded-lg text-white transition-colors hover:opacity-90"
              style={{ background: '#d32f2f' }}>
              Review →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Add a review note (optional)... e.g. 'Confirmed fraud attempt' or 'Verified with customer, approved'"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
              style={{ color: '#111827' }} />
            <div className="flex gap-3">
              <button onClick={() => submit('APPROVE')} disabled={loading}
                className="flex-1 bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-60">
                ✓ Approve — Execute Transfer
              </button>
              <button onClick={() => submit('REJECT')} disabled={loading}
                className="flex-1 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 hover:opacity-90"
                style={{ background: '#d32f2f' }}>
                ✗ Reject — Block Transaction
              </button>
              <button onClick={() => setShowActions(false)}
                className="border border-gray-200 px-4 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition-colors"
                style={{ color: '#374151' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

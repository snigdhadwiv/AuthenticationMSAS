'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, apiFetch } from '@/lib/auth';

interface User { id: number; username: string; email: string; first_name: string; last_name: string; is_active: boolean; is_enrolled: boolean; date_joined: string; }
interface Transaction { id: number; user: string; amount: string; payee_name: string; status: string; risk_score: number; decision_rationale: string; created_at: string; review_note: string; reviewed_by: string | null; }
interface AuditEntry { id: number; event_type: string; detail: any; timestamp: string; }

type Tab = 'users' | 'escalations' | 'audit';

export default function AdminDashboard() {
  const { user, token, logout } = useAuth();
  const router  = useRouter();
  const [tab,   setTab]   = useState<Tab>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [escalations, setEscalations] = useState<Transaction[]>([]);
  const [auditLogs,   setAuditLogs]   = useState<AuditEntry[]>([]);
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
      if (t === 'users') {
        const r = await apiFetch('/admin/users/', token);
        setUsers(await r.json());
      } else if (t === 'escalations') {
        const r = await apiFetch('/admin/escalations/', token);
        setEscalations(await r.json());
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
    { key: 'users',       label: '👤 User Management',  badge: users.length },
    { key: 'escalations', label: '⚠️ Escalation Queue', badge: escalations.length },
    { key: 'audit',       label: '📋 Audit Log' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-border-brown px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-primary-red font-bold text-xl">MSAS</span>
          <span className="bg-primary-red text-white text-xs font-semibold px-2 py-0.5 rounded">ADMIN</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-secondary-brown">{user?.username}</span>
          <button onClick={logout} className="text-sm text-primary-red hover:underline">Sign Out</button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Admin Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2
                ${tab === t.key ? 'bg-white text-primary-red shadow' : 'text-secondary-brown hover:text-foreground'}`}>
              {t.label}
              {t.badge !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-primary-red text-white' : 'bg-gray-200 text-gray-600'}`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {formSuccess && <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 mb-4 text-sm">{formSuccess}</div>}

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
              <form onSubmit={handleCreateUser} className="bg-white border border-border-brown rounded-xl p-6 grid grid-cols-2 gap-4">
                <h3 className="col-span-2 font-semibold text-foreground">Create New User</h3>
                {formError && <p className="col-span-2 text-primary-red text-sm">{formError}</p>}
                {[
                  { label: 'Username *',   name: 'username',   type: 'text',     req: true },
                  { label: 'Password *',   name: 'password',   type: 'password', req: true },
                  { label: 'First Name',   name: 'first_name', type: 'text' },
                  { label: 'Last Name',    name: 'last_name',  type: 'text' },
                  { label: 'Email',        name: 'email',      type: 'email' },
                  { label: 'Phone',        name: 'phone',      type: 'tel' },
                ].map(f => (
                  <div key={f.name}>
                    <label className="block text-xs font-medium text-secondary-brown mb-1">{f.label}</label>
                    <input
                      type={f.type} required={f.req}
                      value={(form as any)[f.name]}
                      onChange={e => setForm(v => ({ ...v, [f.name]: e.target.value }))}
                      className="w-full border border-border-brown rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-red"
                    />
                  </div>
                ))}
                <div className="col-span-2 flex justify-end">
                  <button type="submit" className="bg-primary-red text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-primary-red-hover">
                    Create User
                  </button>
                </div>
              </form>
            )}

            <div className="bg-white border border-border-brown rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-accent-brown uppercase">
                  <tr>{['Username', 'Name', 'Email', 'Enrolled', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-border-brown">
                  {loading ? (
                    <tr><td colSpan={6} className="text-center py-8 text-accent-brown">Loading…</td></tr>
                  ) : users.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-foreground">{u.username}</td>
                      <td className="px-4 py-3 text-secondary-brown">{u.first_name} {u.last_name}</td>
                      <td className="px-4 py-3 text-accent-brown">{u.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${u.is_enrolled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {u.is_enrolled ? 'Enrolled' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-accent-brown text-xs">{new Date(u.date_joined).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDeleteUser(u.id, u.username)}
                          className="text-xs text-primary-red hover:underline">Delete</button>
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
          <div className="bg-white border border-border-brown rounded-xl overflow-hidden">
            {escalations.length === 0 && !loading ? (
              <div className="text-center py-12 text-accent-brown">✅ No pending escalations.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-accent-brown uppercase">
                  <tr>{['#', 'User', 'Amount', 'Payee', 'Risk', 'Rationale', 'Date', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-border-brown">
                  {loading ? (
                    <tr><td colSpan={8} className="text-center py-8 text-accent-brown">Loading…</td></tr>
                  ) : escalations.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-accent-brown">#{t.id}</td>
                      <td className="px-4 py-3 font-medium">{t.user}</td>
                      <td className="px-4 py-3 font-semibold text-secondary-brown">₹{parseFloat(t.amount).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">{t.payee_name}</td>
                      <td className="px-4 py-3 font-semibold" style={{ color: t.risk_score > 0.6 ? '#d32f2f' : '#f59e0b' }}>
                        {Math.round(t.risk_score * 100)}%
                      </td>
                      <td className="px-4 py-3 text-xs text-accent-brown max-w-xs truncate">{t.decision_rationale || '—'}</td>
                      <td className="px-4 py-3 text-xs text-accent-brown">{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => handleReview(t.id, 'APPROVE')}
                          className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Approve</button>
                        <button onClick={() => handleReview(t.id, 'REJECT')}
                          className="text-xs bg-primary-red text-white px-3 py-1 rounded hover:bg-primary-red-hover">Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Audit Log Tab ─────────────────────────────────────────────────── */}
        {tab === 'audit' && (
          <div className="bg-white border border-border-brown rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-accent-brown uppercase">
                <tr>{['Time', 'Transaction', 'Event', 'Detail'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-border-brown">
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-8 text-accent-brown">Loading…</td></tr>
                ) : auditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-accent-brown whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-xs text-accent-brown">#{(log as any).transaction_id ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${eventColor(log.event_type)}`}>
                        {log.event_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-accent-brown font-mono truncate max-w-xs">
                      {JSON.stringify(log.detail)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, apiFetch } from '@/lib/auth';
import Navbar from '@/components/Navbar';

import Sidebar from '@/components/Sidebar';

interface Transaction {
  id: number; amount: string; payee_name: string; payee_account: string;
  status: string; risk_score: number; challenge_required: boolean; created_at: string;
}

export default function UserDashboard() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('HOME');

  const loadData = () => {
    if (!token) { router.replace('/login'); return; }
    apiFetch('/auth/me/', token).then(r => r.json()).then(d => {
      if (d.balance !== undefined) setBalance(d.balance);
    });
    apiFetch('/transactions/', token)
      .then(r => r.json())
      .then(data => setTransactions(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [token]);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      ALLOWED: 'bg-green-100 text-green-700 border-green-200',
      DENIED: 'bg-red-100 text-red-700 border-red-200',
      ESCALATED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      PENDING: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    return `px-2.5 py-1 rounded-full text-xs font-bold border ${map[s] || map.PENDING}`;
  };

  const balanceNum = balance !== null ? parseFloat(balance) : null;
  const approved = transactions.filter(t => t.status === 'ALLOWED');
  const denied = transactions.filter(t => t.status === 'DENIED');

  const links = [
    { name: 'HOME', isActive: activeTab === 'HOME', onClick: () => setActiveTab('HOME') },
    { name: 'TRANSACTIONS', isActive: activeTab === 'TRANSACTIONS', onClick: () => router.push('/transactions') },
    { name: 'RISKS', isActive: activeTab === 'RISKS', onClick: () => setActiveTab('RISKS') },
    { name: 'DOCUMENTS', isActive: false, onClick: () => router.push('/documents') },
    { name: 'PROFILE', isActive: false, onClick: () => router.push('/profile') },
    { name: 'SETTINGS', isActive: false, onClick: () => router.push('/user-settings') },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--background)' }}>
      <Navbar />

      <div className="flex flex-1 items-stretch">
        <Sidebar links={links} />

        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {activeTab === 'HOME' && (
            <>
              {/* Enrollment Banner */}
        {user && !user.is_enrolled && (
          <div className="rounded-xl p-5 flex items-center justify-between bg-yellow-50 border border-yellow-200">
            <div>
              <h3 className="text-yellow-800 font-bold mb-0.5">Action Required: Enroll Voice Biometrics</h3>
              <p className="text-yellow-700 text-sm">Register your voiceprint to enable high-risk transactions.</p>
            </div>
            <button onClick={() => router.push('/enroll')}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex-shrink-0 ml-4">
              Enroll Now →
            </button>
          </div>
        )}

        {/* Hero Balance + Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Wallet Balance */}
          <div className="lg:col-span-1 rounded-2xl p-6 text-white shadow-lg"
            style={{ background: 'linear-gradient(135deg, #d32f2f 0%, #7f1d1d 100%)' }}>
            <p className="text-red-200 text-xs font-semibold uppercase tracking-widest mb-1">Available Balance</p>
            <p className="text-4xl font-bold tracking-tight">
              {balanceNum !== null
                ? `₹${balanceNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                : '—'}
            </p>
            <p className="text-red-200 text-xs mt-3">MSAS Virtual Wallet · @{user?.username}</p>
          </div>

          {/* Stats */}
          <div className="lg:col-span-2 grid grid-cols-3 gap-4">
            {[
              { label: 'Total Transactions', value: transactions.length, sub: 'All time' },
              { label: 'Approved', value: approved.length, sub: `₹${approved.reduce((s, t) => s + parseFloat(t.amount), 0).toLocaleString('en-IN')} total` },
              { label: 'Blocked / Denied', value: denied.length, sub: 'Security holds' },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-5" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>{s.label}</p>
                <p className="text-3xl font-bold text-primary-red mt-1">{s.value}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => router.push('/transactions')}
            className="bg-primary-red hover:bg-primary-red-hover text-white font-semibold px-6 py-2.5 rounded-lg transition-colors shadow-sm text-sm flex items-center gap-2">
            <span className="text-lg leading-none">+</span> New Transfer
          </button>
          <button onClick={() => router.push('/transactions')}
            className="font-medium px-5 py-2.5 rounded-lg transition-colors text-sm border"
            style={{ background: 'var(--surface-elevated)', color: 'var(--foreground-muted)', borderColor: 'var(--border)' }}>
            View Transactions →
          </button>
          <button onClick={loadData}
            className="font-medium px-5 py-2.5 rounded-lg transition-colors text-sm border"
            style={{ background: 'var(--surface-elevated)', color: 'var(--foreground-muted)', borderColor: 'var(--border)' }}>
            ↻ Refresh
          </button>
        </div>

        {/* Recent Transactions Preview (last 3 only) */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)', boxShadow: 'var(--card-shadow)' }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Recent Transactions</h2>
            <button onClick={() => router.push('/transactions')}
              className="text-xs font-medium hover:underline" style={{ color: '#d32f2f' }}>
              View all {transactions.length} →
            </button>
          </div>
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-primary-red/20 border-t-primary-red rounded-full animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">💸</div>
              <p className="font-medium" style={{ color: 'var(--foreground-muted)' }}>No transactions yet.</p>
              <p className="text-sm mt-1" style={{ color: 'var(--foreground-muted)' }}>Start by making your first transfer.</p>
            </div>
          ) : (
            <div>
              {transactions.slice(0, 3).map((t, i) => (
                <div key={t.id} className="px-6 py-3.5 flex items-center justify-between"
                  style={{ borderBottom: i < 2 && i < transactions.slice(0,3).length - 1 ? '1px solid var(--border)' : undefined }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold" style={{ color: '#374151' }}>
                      {t.payee_name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{t.payee_name}</p>
                      <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>{new Date(t.created_at).toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                      t.status === 'ALLOWED' ? 'bg-green-100 text-green-700 border-green-200' :
                      t.status === 'DENIED' ? 'bg-red-100 text-red-700 border-red-200' :
                      'bg-yellow-100 text-yellow-700 border-yellow-200'}`}>{t.status}</span>
                    <span className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>₹{parseFloat(t.amount).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))}
              {transactions.length > 3 && (
                <div className="px-6 py-3 text-center border-t" style={{ borderColor: 'var(--border)' }}>
                  <button onClick={() => router.push('/transactions')} className="text-sm font-medium hover:underline" style={{ color: '#d32f2f' }}>
                    See all {transactions.length} transactions →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </>
    )}

    {activeTab === 'RISKS' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm" style={{ background: 'var(--surface-elevated)', borderColor: 'var(--border)' }}>
              <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>Risk Dashboard</h2>
              <p style={{ color: 'var(--foreground-muted)' }}>Security analytics and risk profiling will appear here.</p>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

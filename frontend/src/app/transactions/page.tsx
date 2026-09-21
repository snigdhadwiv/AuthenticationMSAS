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

export default function TransactionsPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const links = [
    { name: 'HOME', isActive: false, onClick: () => router.push('/dashboard') },
    { name: 'TRANSACTIONS', isActive: true, onClick: () => {} },
    { name: 'RISKS', isActive: false, onClick: () => router.push('/dashboard') },
    { name: 'DOCUMENTS', isActive: false, onClick: () => router.push('/documents') },
    { name: 'PROFILE', isActive: false, onClick: () => router.push('/profile') },
    { name: 'SETTINGS', isActive: false, onClick: () => router.push('/user-settings') },
  ];

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      ALLOWED: 'bg-green-100 text-green-700 border-green-200',
      DENIED: 'bg-red-100 text-red-700 border-red-200',
      ESCALATED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      PENDING: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    return `px-2.5 py-1 rounded-full text-xs font-bold border ${map[s] || map.PENDING}`;
  };

  if (!user) return null;
  const balanceNum = balance !== null ? parseFloat(balance) : null;
  const approved = transactions.filter(t => t.status === 'ALLOWED');
  const denied = transactions.filter(t => t.status === 'DENIED');
  const totalSent = approved.reduce((s, t) => s + parseFloat(t.amount), 0);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f3f4f6' }}>
      <Navbar />
      <div className="flex flex-1 items-stretch">
        <Sidebar links={links} />

        <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full relative">

          {/* Balance Bar */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: '#374151' }}>Available Balance</p>
                  <p className="text-3xl font-bold" style={{ color: '#d32f2f' }}>
                    {balanceNum !== null ? `₹${balanceNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#6b7280' }}>MSAS Virtual Wallet · @{user.username}</p>
                </div>
                <div className="w-px h-12 bg-gray-200 hidden sm:block" />
                <div className="hidden sm:flex gap-6">
                  {[
                    { label: 'Total', value: transactions.length, color: '#111827' },
                    { label: 'Approved', value: approved.length, color: '#16a34a' },
                    { label: 'Blocked', value: denied.length, color: '#dc2626' },
                  ].map(s => (
                    <div key={s.label}>
                      <p className="text-xs" style={{ color: '#374151' }}>{s.label}</p>
                      <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden md:block">
                  <p className="text-xs" style={{ color: '#374151' }}>Total Sent</p>
                  <p className="font-bold" style={{ color: '#111827' }}>₹{totalSent.toLocaleString('en-IN')}</p>
                </div>
                <button onClick={loadData}
                  className="text-sm font-medium border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  style={{ color: '#374151' }}>
                  ↻ Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Transaction History Table */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
              <div>
                <h2 className="font-semibold" style={{ color: '#111827' }}>Transaction History</h2>
                <p className="text-xs mt-0.5" style={{ color: '#374151' }}>All your past transfers and their MSAS security decisions.</p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-gray-100 font-semibold" style={{ color: '#374151' }}>
                {transactions.length} records
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-5xl mb-4">💸</div>
                <p className="font-semibold text-lg mb-1" style={{ color: '#111827' }}>No transactions yet.</p>
                <p className="text-sm mb-6" style={{ color: '#374151' }}>Start by making your first transfer.</p>
                <button onClick={() => router.push('/transaction/new')}
                  className="bg-primary-red text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary-red-hover transition-colors shadow-sm">
                  + Make a Transfer
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['#', 'Recipient', 'Amount', 'Risk Score', 'Status', 'Date', ''].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                          style={{ color: '#374151' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t, i) => (
                      <tr key={t.id}
                        className="hover:bg-gray-50 transition-colors"
                        style={{ background: i % 2 === 0 ? '#ffffff' : '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
                        <td className="px-5 py-3.5 font-mono text-xs" style={{ color: '#6b7280' }}>#{t.id}</td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-sm" style={{ color: '#111827' }}>{t.payee_name}</p>
                          {t.payee_account && <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>@{t.payee_account}</p>}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-sm" style={{ color: '#111827' }}>
                          ₹{parseFloat(t.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full overflow-hidden bg-gray-200">
                              <div className="h-full rounded-full"
                                style={{
                                  width: `${Math.round(t.risk_score * 100)}%`,
                                  background: t.risk_score > 0.6 ? '#dc2626' : t.risk_score > 0.35 ? '#f59e0b' : '#16a34a'
                                }} />
                            </div>
                            <span className="text-xs font-semibold" style={{ color: '#374151' }}>{Math.round(t.risk_score * 100)}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={statusBadge(t.status)}>{t.status}</span>
                        </td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: '#6b7280' }}>
                          {new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-3.5">
                          <button onClick={() => router.push(`/audit/${t.id}`)}
                            className="text-xs font-medium hover:underline" style={{ color: '#d32f2f' }}>
                            Audit →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Floating "+" Button */}
          <button
            onClick={() => router.push('/transaction/new')}
            title="New Transfer"
            className="fixed bottom-8 right-8 w-14 h-14 rounded-full text-white text-2xl font-bold shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-50"
            style={{ background: '#d32f2f', boxShadow: '0 4px 20px rgba(211,47,47,0.4)' }}>
            +
          </button>

        </main>
      </div>
    </div>
  );
}

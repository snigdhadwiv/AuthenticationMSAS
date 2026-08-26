'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, apiFetch } from '@/lib/auth';

interface Transaction {
  id: number; amount: string; payee_name: string; status: string;
  risk_score: number; challenge_required: boolean; created_at: string;
}

export default function UserDashboard() {
  const { user, token, logout } = useAuth();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { router.replace('/login'); return; }
    apiFetch('/transactions/', token)
      .then(r => r.json())
      .then(data => setTransactions(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [token]);

  const statusColor = (s: string) => {
    if (s === 'ALLOWED')   return 'bg-green-100 text-green-700';
    if (s === 'DENIED')    return 'bg-red-100 text-primary-red';
    if (s === 'ESCALATED') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  };

  const totalSpent = transactions
    .filter(t => t.status === 'ALLOWED')
    .reduce((s, t) => s + parseFloat(t.amount), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-border-brown px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-primary-red font-bold text-xl">MSAS</span>
          <span className="text-secondary-brown text-sm ml-3">User Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-secondary-brown">
            {user?.first_name || user?.username}
          </span>
          <button onClick={logout}
            className="text-sm text-primary-red hover:underline">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        
        {/* Enrollment Banner */}
        {user && !user.is_enrolled && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <h3 className="text-yellow-800 font-bold mb-1">Action Required: Enroll Voice Biometrics</h3>
              <p className="text-yellow-700 text-sm">You must register your voiceprint to perform high-risk transactions.</p>
            </div>
            <button 
              onClick={() => router.push('/enroll')}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              Enroll Now →
            </button>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Transactions', value: transactions.length },
            { label: 'Approved', value: transactions.filter(t => t.status === 'ALLOWED').length },
            { label: 'Total Approved (₹)', value: `₹${totalSpent.toLocaleString('en-IN')}` },
          ].map(s => (
            <div key={s.label} className="bg-white border border-border-brown rounded-xl p-5">
              <p className="text-xs text-accent-brown uppercase tracking-wide">{s.label}</p>
              <p className="text-3xl font-bold text-primary-red mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/transaction/new')}
            className="bg-primary-red hover:bg-primary-red-hover text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            + New Transaction
          </button>
        </div>

        {/* Transaction table */}
        <div className="bg-white border border-border-brown rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border-brown">
            <h2 className="font-semibold text-foreground">Recent Transactions</h2>
          </div>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-border-brown border-t-primary-red rounded-full animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12 text-accent-brown">
              No transactions yet. Start by making a new transaction.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-accent-brown uppercase">
                <tr>
                  {['#', 'Payee', 'Amount', 'Risk', 'Status', 'Date', 'Audit'].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-brown">
                {transactions.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-accent-brown">#{t.id}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{t.payee_name}</td>
                    <td className="px-4 py-3 font-semibold text-secondary-brown">₹{parseFloat(t.amount).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${t.risk_score > 0.6 ? 'bg-red-500' : t.risk_score > 0.35 ? 'bg-yellow-400' : 'bg-green-400'}`}
                            style={{ width: `${Math.round(t.risk_score * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-accent-brown">{Math.round(t.risk_score * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-accent-brown text-xs">
                      {new Date(t.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/audit/${t.id}`)}
                        className="text-xs text-primary-red hover:underline"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

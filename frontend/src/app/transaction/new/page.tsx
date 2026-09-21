'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, apiFetch } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

const RISK_LABELS: Record<string, string> = {
  transfer_amount: 'Transfer Amount',
  time_of_day:     'Time of Day',
  payee_risk:      'Payee Risk',
  device_velocity: 'Device Velocity',
  location_change: 'Location Change',
};

const inputStyle = {
  color: '#111827',
  background: '#fff',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  padding: '10px 16px',
  width: '100%',
  fontSize: '14px',
  outline: 'none',
};

export default function NewTransactionPage() {
  const { token } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({ payee_name: '', payee_account: '', amount: '', description: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [risk, setRisk] = useState<{
    risk_score: number; risk_factors: Record<string, number>;
    challenge_required: boolean; transaction_id: number; status: string; sender_balance?: string;
  } | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch('/auth/me/', token).then(r => r.json()).then(d => {
      if (d.balance) setBalance(parseFloat(d.balance));
    });
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) { router.push('/login'); return; }
    setError(''); setLoading(true);
    try {
      const res  = await apiFetch('/transactions/initiate/', token, {
        method: 'POST',
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to initiate transaction.'); return; }
      setRisk(data);
      if (data.sender_balance) setBalance(parseFloat(data.sender_balance));
      if (!data.challenge_required) {
        setTimeout(() => router.push('/transactions'), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const links = [
    { name: 'HOME', isActive: false, onClick: () => router.push('/dashboard') },
    { name: 'TRANSACTIONS', isActive: true, onClick: () => router.push('/transactions') },
    { name: 'RISKS', isActive: false, onClick: () => router.push('/dashboard') },
    { name: 'DOCUMENTS', isActive: false, onClick: () => router.push('/documents') },
    { name: 'PROFILE', isActive: false, onClick: () => router.push('/profile') },
    { name: 'SETTINGS', isActive: false, onClick: () => router.push('/user-settings') },
  ];

  const riskPct   = Math.round((risk?.risk_score ?? 0) * 100);
  const riskColor = riskPct > 60 ? '#d32f2f' : riskPct > 35 ? '#f59e0b' : '#16a34a';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f3f4f6' }}>
      <Navbar />
      <div className="flex flex-1 items-stretch">
        <Sidebar links={links} />

        <main className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">

          {/* Back breadcrumb */}
          <button onClick={() => router.push('/transactions')}
            className="flex items-center gap-1 text-sm mb-6 hover:underline"
            style={{ color: '#374151' }}>
            ← Back to Transactions
          </button>

          <h1 className="text-2xl font-bold mb-6" style={{ color: '#111827' }}>Initiate Transfer</h1>

          {/* Live balance chip */}
          {balance !== null && (
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-3.5 flex items-center justify-between mb-5 shadow-sm">
              <span className="text-sm font-medium" style={{ color: '#374151' }}>Your Available Balance</span>
              <span className="text-lg font-bold" style={{ color: '#d32f2f' }}>
                ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm mb-4" style={{ color: '#d32f2f' }}>
              {error}
            </div>
          )}

          {!risk ? (
            <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5 shadow-sm">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Recipient Name</label>
                <input type="text" name="payee_name" value={form.payee_name} onChange={handleChange}
                  placeholder="e.g. Rahul Sharma" required style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#111827' }}>
                  Recipient Username / UPI ID
                  <span className="text-xs font-normal ml-2" style={{ color: '#6b7280' }}>
                    (enter username to transfer to another MSAS user)
                  </span>
                </label>
                <input type="text" name="payee_account" value={form.payee_account} onChange={handleChange}
                  placeholder="e.g. rahul_s1234 or rahul@upi" style={inputStyle} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Amount (₹)</label>
                <input type="number" name="amount" value={form.amount} onChange={handleChange}
                  placeholder="0.00" required min="1" max={balance ?? undefined} style={inputStyle} />
                {balance !== null && form.amount && parseFloat(form.amount) > balance && (
                  <p className="text-xs mt-1" style={{ color: '#d32f2f' }}>⚠️ Amount exceeds your available balance.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Description (optional)</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={2}
                  placeholder="Reason for transfer…" style={{ ...inputStyle, resize: 'none' }} />
              </div>
              <button type="submit"
                disabled={loading || (balance !== null && !!form.amount && parseFloat(form.amount) > balance)}
                className="w-full text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60"
                style={{ background: '#d32f2f' }}>
                {loading ? 'Analysing risk…' : 'Submit Transaction'}
              </button>
            </form>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6 shadow-sm">

              {/* Updated balance after transfer */}
              {risk.sender_balance && !risk.challenge_required && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                  <span className="text-green-800 text-sm font-medium">✅ Funds transferred. New Balance:</span>
                  <span className="text-green-700 font-bold text-lg">
                    ₹{parseFloat(risk.sender_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {/* Risk meter */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold" style={{ color: '#111827' }}>Risk Assessment</span>
                  <span className="text-lg font-bold" style={{ color: riskColor }}>{riskPct}%</span>
                </div>
                <div className="w-full h-4 rounded-full overflow-hidden" style={{ background: '#e5e7eb' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${riskPct}%`, backgroundColor: riskColor }} />
                </div>
                <div className="flex justify-between text-xs mt-1" style={{ color: '#6b7280' }}>
                  <span>Low Risk</span><span>High Risk</span>
                </div>
              </div>

              {/* Signal breakdown */}
              <div className="space-y-2.5">
                <p className="text-sm font-semibold" style={{ color: '#111827' }}>Signal Breakdown</p>
                {Object.entries(risk.risk_factors).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs w-36" style={{ color: '#374151' }}>{RISK_LABELS[key] ?? key}</span>
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#e5e7eb' }}>
                      <div className="h-full rounded-full"
                        style={{
                          width: `${Math.round((val as number) * 100)}%`,
                          backgroundColor: (val as number) > 0.6 ? '#d32f2f' : (val as number) > 0.35 ? '#f59e0b' : '#16a34a'
                        }} />
                    </div>
                    <span className="text-xs w-8 text-right font-semibold" style={{ color: '#374151' }}>
                      {Math.round((val as number) * 100)}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Decision */}
              {risk.challenge_required ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <p className="text-yellow-800 font-semibold mb-3">⚠️ High-risk transaction — Step-Up Authentication required</p>
                  <button onClick={() => router.push(`/challenge/${risk.transaction_id}`)}
                    className="text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
                    style={{ background: '#d32f2f' }}>
                    Proceed to Biometric Challenge →
                  </button>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-green-700 font-semibold">✅ Low-risk transaction — Automatically approved!</p>
                  <p className="text-xs text-green-600 mt-1">Redirecting to transactions…</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

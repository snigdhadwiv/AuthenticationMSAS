'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, apiFetch } from '@/lib/auth';

const RISK_LABELS: Record<string, string> = {
  transfer_amount: 'Transfer Amount',
  time_of_day:     'Time of Day',
  payee_risk:      'Payee Risk',
  device_velocity: 'Device Velocity',
  location_change: 'Location Change',
};

export default function NewTransactionPage() {
  const { token } = useAuth();
  const router     = useRouter();

  const [form, setForm] = useState({ payee_name: '', payee_account: '', amount: '', description: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [risk,    setRisk]    = useState<{ risk_score: number; risk_factors: Record<string, number>; challenge_required: boolean; transaction_id: number; status: string } | null>(null);

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

      if (!data.challenge_required) {
        // Low-risk — auto approved, go to dashboard
        setTimeout(() => router.push('/dashboard'), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const riskPct    = Math.round((risk?.risk_score ?? 0) * 100);
  const riskColor  = riskPct > 60 ? '#d32f2f' : riskPct > 35 ? '#f59e0b' : '#16a34a';

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-border-brown px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.back()} className="text-secondary-brown hover:text-primary-red text-sm">← Back</button>
        <span className="text-primary-red font-bold">MSAS</span>
        <span className="text-secondary-brown text-sm">New Transaction</span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Initiate Transfer</h1>

        {error && <div className="bg-red-50 border border-red-200 text-primary-red rounded-lg px-4 py-3 text-sm">{error}</div>}

        {!risk ? (
          <form onSubmit={handleSubmit} className="bg-white border border-border-brown rounded-2xl p-6 space-y-4">
            {[
              { label: 'Recipient Name', name: 'payee_name', type: 'text', placeholder: 'e.g. Rahul Sharma' },
              { label: 'Recipient Account / UPI ID', name: 'payee_account', type: 'text', placeholder: 'e.g. rahul@upi' },
              { label: 'Amount (₹)', name: 'amount', type: 'number', placeholder: '0.00' },
            ].map(f => (
              <div key={f.name}>
                <label className="block text-sm font-medium text-secondary-brown mb-1">{f.label}</label>
                <input
                  type={f.type} name={f.name} value={(form as any)[f.name]}
                  onChange={handleChange} placeholder={f.placeholder} required
                  className="w-full border border-border-brown rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-red"
                />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-secondary-brown mb-1">Description (optional)</label>
              <textarea
                name="description" value={form.description} onChange={handleChange} rows={2}
                className="w-full border border-border-brown rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-red resize-none"
                placeholder="Reason for transfer…"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-primary-red hover:bg-primary-red-hover text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-60">
              {loading ? 'Analysing risk…' : 'Submit Transaction'}
            </button>
          </form>
        ) : (
          <div className="bg-white border border-border-brown rounded-2xl p-6 space-y-6">
            {/* Risk meter */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-secondary-brown">Risk Assessment</span>
                <span className="text-lg font-bold" style={{ color: riskColor }}>{riskPct}%</span>
              </div>
              <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${riskPct}%`, backgroundColor: riskColor }}
                />
              </div>
              <div className="flex justify-between text-xs text-accent-brown mt-1">
                <span>Low Risk</span><span>High Risk</span>
              </div>
            </div>

            {/* Signal breakdown */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-secondary-brown">Signal Breakdown</p>
              {Object.entries(risk.risk_factors).map(([key, val]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-accent-brown w-36">{RISK_LABELS[key] ?? key}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round((val as number) * 100)}%`, backgroundColor: (val as number) > 0.6 ? '#d32f2f' : (val as number) > 0.35 ? '#f59e0b' : '#16a34a' }}
                    />
                  </div>
                  <span className="text-xs text-accent-brown w-8 text-right">{Math.round((val as number) * 100)}%</span>
                </div>
              ))}
            </div>

            {/* Decision */}
            {risk.challenge_required ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-yellow-800 font-semibold mb-3">⚠️ High-risk transaction — Step-Up Authentication required</p>
                <button
                  onClick={() => router.push(`/challenge/${risk.transaction_id}`)}
                  className="bg-primary-red text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-primary-red-hover transition-colors"
                >
                  Proceed to Biometric Challenge →
                </button>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-700 font-semibold">✅ Low-risk transaction — Automatically approved!</p>
                <p className="text-xs text-green-600 mt-1">Redirecting to dashboard…</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

'use client';
/**
 * ZephyrBank — External Bank Application Layer
 * ─────────────────────────────────────────────
 * This page simulates a third-party bank application that integrates
 * MSAS (Multimodal Step-Up Authentication System) as a middleware plugin.
 *
 * Architecture:
 *   [ZephyrBank Frontend] → calls → [MSAS Middleware API]
 *                                      ↓
 *                              [Risk Engine + Biometric AI]
 *                                      ↓
 *                              ALLOW / ESCALATE / DENY → ZephyrBank
 */

import { useState, useEffect, useRef } from 'react';
import AuthenticationChallenge from '@/components/AuthenticationChallenge';

const API = 'http://127.0.0.1:8000/api';

// ── Types ──────────────────────────────────────────────────────────────────
type Phase =
  | 'LOGIN'
  | 'DASHBOARD'
  | 'SEND_MONEY'
  | 'RISK_ASSESSMENT'
  | 'MSAS_CHALLENGE'
  | 'RESULT';

interface BankUser {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  balance: string;
  is_enrolled: boolean;
}

interface Transaction {
  id: number;
  amount: string;
  payee_name: string;
  status: string;
  risk_score: number;
  created_at: string;
}

interface RiskResult {
  transaction_id: number;
  risk_score: number;
  risk_factors: Record<string, number>;
  challenge_required: boolean;
  status: string;
  sender_balance: string;
}

// ── Colour palette (ZephyrBank = deep blue theme) ─────────────────────────
const C = {
  primary:   '#1a56db',
  primary2:  '#1e429f',
  bg:        '#f0f4ff',
  surface:   '#ffffff',
  border:    '#e1e8f7',
  text:      '#1e293b',
  muted:     '#64748b',
  success:   '#16a34a',
  danger:    '#dc2626',
  warning:   '#b45309',
  msas:      '#dc2626',   // MSAS brand red
};

// ── Helper ─────────────────────────────────────────────────────────────────
const apiFetch = (path: string, token: string, opts: RequestInit = {}) =>
  fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });

const fmt = (amount: string | number) =>
  `₹${parseFloat(String(amount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const riskColor = (s: number) =>
  s < 0.4 ? C.success : s < 0.7 ? C.warning : C.danger;

const riskLabel = (s: number) =>
  s < 0.4 ? 'LOW RISK' : s < 0.7 ? 'MEDIUM RISK' : 'HIGH RISK';

// ── Account number mask ────────────────────────────────────────────────────
const maskAcct = (u: string) => {
  const hash = u.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return `**** **** **** ${(hash % 9000 + 1000).toString()}`;
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function ZephyrBankPage() {
  const [phase, setPhase]       = useState<Phase>('LOGIN');
  const [token, setToken]       = useState('');
  const [user, setUser]         = useState<BankUser | null>(null);
  const [txns, setTxns]         = useState<Transaction[]>([]);
  const [form, setForm]         = useState({ payee_name: '', payee_account: '', amount: '', note: '' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginErr, setLoginErr] = useState('');
  const [sendErr, setSendErr]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [decision, setDecision] = useState<{ result: string; rationale: string } | null>(null);

  // ── LOGIN ────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr('');
    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });
      if (!r.ok) { setLoginErr('Invalid credentials. Please try again.'); return; }
      const { access } = await r.json();
      setToken(access);

      const meR = await apiFetch('/auth/me/', access);
      const me  = await meR.json();
      setUser({ ...me, balance: me.balance || '50000.00' });

      const txR = await apiFetch('/transactions/', access);
      setTxns(await txR.json());

      setPhase('DASHBOARD');
    } catch {
      setLoginErr('Connection error. Is the MSAS backend running?');
    } finally { setLoading(false); }
  };

  // ── REFRESH BALANCE / TXNS ───────────────────────────────────────────────
  const refreshData = async () => {
    if (!token) return;
    const meR = await apiFetch('/auth/me/', token);
    const me  = await meR.json();
    setUser(prev => prev ? { ...prev, balance: me.balance } : prev);
    const txR = await apiFetch('/transactions/', token);
    setTxns(await txR.json());
  };

  // ── INITIATE TRANSFER → MSAS Risk Engine ────────────────────────────────
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendErr('');
    if (!form.payee_name || !form.amount) { setSendErr('Payee name and amount are required.'); return; }
    if (parseFloat(form.amount) <= 0)     { setSendErr('Amount must be greater than ₹0.'); return; }

    setLoading(true);
    setPhase('RISK_ASSESSMENT');

    try {
      const r = await apiFetch('/transactions/initiate/', token, {
        method: 'POST',
        body: JSON.stringify({
          payee_name:    form.payee_name,
          payee_account: form.payee_account,
          amount:        parseFloat(form.amount),
          description:   form.note,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setSendErr(data.error || 'Transfer failed.'); setPhase('SEND_MONEY'); return; }

      setRiskResult(data);

      // Update balance immediately visible
      if (data.sender_balance) {
        setUser(prev => prev ? { ...prev, balance: data.sender_balance } : prev);
      }

      if (data.challenge_required) {
        setTimeout(() => setPhase('MSAS_CHALLENGE'), 1200);
      } else {
        // Auto-approved low risk
        setDecision({ result: 'ALLOW', rationale: 'Low-risk transaction automatically approved.' });
        setTimeout(() => { refreshData(); setPhase('RESULT'); }, 1000);
      }
    } catch {
      setSendErr('Network error. Please try again.');
      setPhase('SEND_MONEY');
    } finally { setLoading(false); }
  };

  // ── RECEIVE CHALLENGE RESULT (called by AuthenticationChallenge) ─────────
  // We pass a wrapper that intercepts the challenge page redirect and instead
  // updates our local state directly.
  const handleChallengeComplete = () => {
    // After challenge, re-fetch the transaction status
    if (!riskResult) return;
    apiFetch(`/transactions/`, token)
      .then(r => r.json())
      .then((data: Transaction[]) => {
        const thisTxn = data.find(t => t.id === riskResult.transaction_id);
        setDecision({
          result:    thisTxn?.status || 'UNKNOWN',
          rationale: `Transaction ${thisTxn?.status?.toLowerCase() || 'processed'} by MSAS Decision Fusion Engine.`,
        });
        setTxns(data);
        setPhase('RESULT');
      });
  };

  // ═════════════════════════════════════════════════════════════════════════
  //  RENDER HELPERS
  // ═════════════════════════════════════════════════════════════════════════

  // ── Shared card wrapper ───────────────────────────────────────────────────
  const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28, boxShadow: '0 2px 12px rgba(26,86,219,0.07)', ...style }}>
      {children}
    </div>
  );

  // ── Top navbar ────────────────────────────────────────────────────────────
  const BankNav = () => (
    <nav style={{ background: C.primary2, color: '#fff', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, background: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 18, color: C.primary }}>⚡</span>
        </div>
        <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px' }}>ZephyrBank</span>
        <span style={{ background: 'rgba(255,255,255,0.15)', fontSize: 10, padding: '2px 8px', borderRadius: 20, letterSpacing: 1, marginLeft: 4 }}>BUSINESS BANKING</span>
      </div>
      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, opacity: 0.85 }}>Hello, {user.first_name || user.username}</span>
          <button onClick={() => { setToken(''); setUser(null); setPhase('LOGIN'); }}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12 }}>
            Sign Out
          </button>
        </div>
      )}
    </nav>
  );

  // ── MSAS plugin badge ─────────────────────────────────────────────────────
  const MSASBadge = () => (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff0f0', border: `1px solid ${C.msas}`, borderRadius: 20, padding: '4px 12px', fontSize: 11, color: C.msas, fontWeight: 700 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.msas, display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
      MSAS™ MIDDLEWARE ACTIVE
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: LOGIN
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'LOGIN') return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(135deg, ${C.primary2} 0%, #1a56db 50%, #3b82f6 100%)`, display: 'flex', flexDirection: 'column' }}>
      <nav style={{ padding: '20px 40px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, background: '#fff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 20, color: C.primary }}>⚡</span>
        </div>
        <span style={{ fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: '-0.5px' }}>ZephyrBank</span>
        <span style={{ background: 'rgba(255,255,255,0.2)', fontSize: 10, padding: '2px 8px', borderRadius: 20, color: '#fff', letterSpacing: 1, marginLeft: 4 }}>BUSINESS BANKING</span>
      </nav>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px 60px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Login card */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 36, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: C.text, marginBottom: 4 }}>Welcome back</h1>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 24 }}>Sign in to your ZephyrBank account</p>

            {loginErr && (
              <div style={{ background: '#fff0f0', border: `1px solid ${C.danger}`, borderRadius: 8, padding: '10px 14px', color: C.danger, fontSize: 13, marginBottom: 16 }}>
                {loginErr}
              </div>
            )}

            <form onSubmit={handleLogin}>
              {(['username', 'password'] as const).map(field => (
                <div key={field} style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {field === 'username' ? 'User ID / Username' : 'Password'}
                  </label>
                  <input
                    type={field === 'password' ? 'password' : 'text'}
                    value={loginForm[field]}
                    onChange={e => setLoginForm(p => ({ ...p, [field]: e.target.value }))}
                    placeholder={field === 'username' ? 'e.g. priya_sharma' : '••••••••'}
                    required
                    style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', fontSize: 14, color: C.text, background: '#f8faff', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <button type="submit" disabled={loading}
                style={{ width: '100%', background: loading ? '#93c5fd' : C.primary, color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 8 }}>
                {loading ? 'Signing in...' : 'Sign In →'}
              </button>
            </form>

            {/* Demo credentials hint */}
            <div style={{ marginTop: 20, padding: '12px 14px', background: '#f0f4ff', borderRadius: 10, fontSize: 12, color: C.muted }}>
              <strong style={{ color: C.primary }}>Demo accounts:</strong><br />
              priya_sharma / rahul_singh / arjun_mehta / kavya_rao<br />
              <span style={{ color: '#94a3b8' }}>Password: password123</span>
            </div>
          </div>

          {/* MSAS powered-by badge */}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, padding: '8px 16px' }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>Security powered by</span>
              <span style={{ fontWeight: 800, color: '#fca5a5', fontSize: 13, letterSpacing: 0.5 }}>MSAS™</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Multimodal Auth Middleware</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'DASHBOARD') return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <BankNav />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        {/* Welcome + balance */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* Primary account card */}
          <div style={{ background: `linear-gradient(135deg, ${C.primary2}, ${C.primary})`, borderRadius: 20, padding: 28, color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -30, top: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ position: 'absolute', right: 20, bottom: -40, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
            <p style={{ fontSize: 11, letterSpacing: 2, opacity: 0.7, textTransform: 'uppercase', marginBottom: 8 }}>Savings Account</p>
            <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>{maskAcct(user?.username || '')}</p>
            <p style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', marginBottom: 4 }}>{fmt(user?.balance || '50000')}</p>
            <p style={{ fontSize: 11, opacity: 0.6 }}>Available Balance</p>
            <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
              <button onClick={() => setPhase('SEND_MONEY')}
                style={{ background: '#fff', color: C.primary, border: 'none', padding: '8px 20px', borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Send Money
              </button>
              <button onClick={refreshData}
                style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '8px 16px', borderRadius: 20, fontSize: 12, cursor: 'pointer' }}>
                Refresh ↻
              </button>
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { label: 'Total Sent', value: fmt(txns.filter(t => t.status === 'ALLOWED').reduce((s, t) => s + parseFloat(t.amount), 0)), icon: '↑', color: C.danger },
              { label: 'Transactions', value: txns.length.toString(), icon: '📋', color: C.primary },
              { label: 'Flagged', value: txns.filter(t => t.status === 'ESCALATED').length.toString(), icon: '⚠', color: C.warning },
              { label: 'Blocked', value: txns.filter(t => t.status === 'DENIED').length.toString(), icon: '🛡', color: C.success },
            ].map(item => (
              <div key={item.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* MSAS Integration Banner */}
        <div style={{ background: '#fff0f0', border: `1px solid rgba(220,38,38,0.2)`, borderRadius: 14, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 42, height: 42, background: C.msas, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontSize: 18 }}>🔌</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: C.msas, fontSize: 13 }}>MSAS™ Middleware Plugin — Active</div>
            <div style={{ fontSize: 12, color: '#7f1d1d', marginTop: 2 }}>
              All transactions above ₹30,000 are automatically intercepted and verified by the Multimodal Step-Up Authentication System. High-risk transfers trigger a real-time biometric challenge (Face Liveness + Voice AI).
            </div>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right', fontSize: 11, color: C.muted }}>
            <div style={{ color: C.success, fontWeight: 700 }}>● Online</div>
            <div>Threshold: 0.50</div>
          </div>
        </div>

        {/* Recent Transactions */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Recent Transactions</h2>
            <button onClick={() => setPhase('SEND_MONEY')}
              style={{ background: C.primary, color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + New Transfer
            </button>
          </div>

          {txns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
              <p>No transactions yet. Try sending money!</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Date', 'Payee', 'Amount', 'Risk Score', 'MSAS Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txns.slice().reverse().slice(0, 10).map(t => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '12px 12px', fontSize: 12, color: C.muted }}>{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                    <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 600, color: C.text }}>{t.payee_name}</td>
                    <td style={{ padding: '12px 12px', fontSize: 13, fontWeight: 700, color: C.text }}>{fmt(t.amount)}</td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: riskColor(t.risk_score), background: `${riskColor(t.risk_score)}18`, padding: '3px 8px', borderRadius: 20 }}>
                        {(t.risk_score * 100).toFixed(0)}% — {riskLabel(t.risk_score)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                        background: t.status === 'ALLOWED' ? '#dcfce7' : t.status === 'DENIED' ? '#fee2e2' : '#fef9c3',
                        color:      t.status === 'ALLOWED' ? C.success   : t.status === 'DENIED' ? C.danger   : C.warning,
                      }}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: SEND MONEY
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'SEND_MONEY') return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <BankNav />
      <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 24px' }}>
        <button onClick={() => setPhase('DASHBOARD')} style={{ background: 'none', border: 'none', color: C.primary, cursor: 'pointer', fontSize: 14, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Back to Dashboard
        </button>

        <Card>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 4 }}>Send Money</h2>
          <p style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>
            Available balance: <strong style={{ color: C.primary }}>{fmt(user?.balance || '0')}</strong>
          </p>

          {sendErr && (
            <div style={{ background: '#fff0f0', border: `1px solid ${C.danger}`, borderRadius: 8, padding: '10px 14px', color: C.danger, fontSize: 13, marginBottom: 16 }}>
              {sendErr}
            </div>
          )}

          <form onSubmit={handleTransfer}>
            {[
              { key: 'payee_name',    label: 'Payee Name',       placeholder: 'e.g. Rahul Sharma', type: 'text' },
              { key: 'payee_account', label: 'Account / UPI ID', placeholder: 'Optional: rahul@upi', type: 'text' },
              { key: 'amount',        label: 'Amount (₹)',        placeholder: 'e.g. 45000', type: 'number' },
              { key: 'note',          label: 'Note (optional)',   placeholder: 'Rent / EMI / etc.', type: 'text' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {f.label}
                </label>
                <input
                  type={f.type}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  min={f.key === 'amount' ? '1' : undefined}
                  style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '12px 16px', fontSize: 14, color: C.text, background: '#f8faff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}

            {/* MSAS note */}
            <div style={{ background: '#f0f4ff', border: `1px solid #c7d7f7`, borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 12, color: C.muted }}>
              🔌 <strong style={{ color: C.primary }}>MSAS Middleware:</strong> Transfers ≥ ₹30,000 or with suspicious payee patterns will automatically trigger a biometric step-up challenge.
            </div>

            <button type="submit" disabled={loading}
              style={{ width: '100%', background: loading ? '#93c5fd' : C.primary, color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Processing...' : 'Initiate Transfer →'}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: RISK ASSESSMENT (animated loading screen)
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'RISK_ASSESSMENT') return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <BankNav />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 60px)', padding: 24 }}>
        <div style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
          {/* Architecture flow */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
            {[
              { label: 'ZephyrBank', color: C.primary, icon: '⚡' },
              { label: '→', color: C.muted, icon: null, plain: true },
              { label: 'MSAS Middleware', color: C.msas, icon: '🔌' },
              { label: '→', color: C.muted, icon: null, plain: true },
              { label: 'Risk Engine', color: '#7c3aed', icon: '🧠' },
            ].map((step, i) => step.plain ? (
              <span key={i} style={{ color: C.muted, fontSize: 18 }}>→</span>
            ) : (
              <div key={i} style={{ background: `${step.color}18`, border: `1.5px solid ${step.color}40`, borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{step.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: step.color }}>{step.label}</span>
              </div>
            ))}
          </div>

          <div style={{ width: 60, height: 60, border: `4px solid ${C.border}`, borderTop: `4px solid ${C.msas}`, borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 1s linear infinite' }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, marginBottom: 8 }}>Analysing Transaction Risk</h2>
          <p style={{ color: C.muted, fontSize: 14 }}>
            MSAS is computing contextual risk score for ₹{form.amount} to <strong>{form.payee_name}</strong>…
          </p>

          {riskResult && (
            <div style={{ marginTop: 24, background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: 20, textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: C.muted }}>Risk Score</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: riskColor(riskResult.risk_score) }}>
                  {(riskResult.risk_score * 100).toFixed(0)}%
                </span>
              </div>
              {Object.entries(riskResult.risk_factors).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: C.muted, width: 130, flexShrink: 0 }}>
                    {k.replace(/_/g, ' ')}
                  </span>
                  <div style={{ flex: 1, background: C.border, borderRadius: 4, height: 6 }}>
                    <div style={{ width: `${v * 100}%`, background: riskColor(v), height: '100%', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: riskColor(v), width: 30, textAlign: 'right' }}>
                    {(v * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
              {riskResult.challenge_required && (
                <div style={{ marginTop: 12, background: '#fff0f0', border: `1px solid ${C.msas}`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: C.msas, fontWeight: 600 }}>
                  ⚠️ Risk threshold exceeded — MSAS biometric challenge required
                </div>
              )}
            </div>
          )}
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: MSAS CHALLENGE (plugin activated)
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'MSAS_CHALLENGE') return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
      <BankNav />

      {/* MSAS Plugin Header Banner */}
      <div style={{ background: `linear-gradient(90deg, ${C.primary2} 0%, ${C.msas} 100%)`, color: '#fff', padding: '16px 32px' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>🔌</span>
              <span style={{ fontWeight: 800, fontSize: 16 }}>MSAS™ Middleware Plugin — Activated</span>
              <span style={{ background: 'rgba(255,255,255,0.2)', fontSize: 10, padding: '2px 8px', borderRadius: 20, letterSpacing: 1 }}>STEP-UP AUTH v2.0</span>
            </div>
            <p style={{ fontSize: 12, opacity: 0.8 }}>
              ZephyrBank has handed control to MSAS for biometric verification of this ₹{form.amount} transfer.
            </p>
          </div>
          {/* Architecture pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, background: 'rgba(255,255,255,0.12)', padding: '6px 12px', borderRadius: 20 }}>
            <span style={{ opacity: 0.7 }}>ZephyrBank</span>
            <span>→</span>
            <span style={{ fontWeight: 800, color: '#fca5a5' }}>MSAS Plugin</span>
            <span>→</span>
            <span style={{ opacity: 0.7 }}>AI Engine</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 740, margin: '32px auto', padding: '0 24px' }}>
        {/* Transaction being verified */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, background: '#fff0f0', border: `2px solid ${C.msas}`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
            🛡️
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: C.text, fontSize: 14 }}>
              Transfer of {fmt(form.amount)} to {form.payee_name}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              Risk Score: <strong style={{ color: riskColor(riskResult?.risk_score || 0) }}>{((riskResult?.risk_score || 0) * 100).toFixed(0)}%</strong>
              {' '} — Biometric verification required by MSAS security policy
            </div>
          </div>
          <div>
            <span style={{ background: '#fff0f0', color: C.msas, fontWeight: 700, fontSize: 11, padding: '4px 10px', borderRadius: 20, border: `1px solid ${C.msas}` }}>
              INTERCEPTED
            </span>
          </div>
        </div>

        {/* MSAS Challenge Component */}
        <div style={{ position: 'relative' }}>
          {/* Plugin frame border */}
          <div style={{ border: `2.5px solid ${C.msas}`, borderRadius: 20, overflow: 'hidden', boxShadow: `0 0 30px rgba(220,38,38,0.12)` }}>
            {/* MSAS Plugin Header */}
            <div style={{ background: C.msas, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>🔴 MSAS™ Biometric Engine</span>
              <span style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 10 }}>
                Look & Speak Challenge
              </span>
            </div>
            {/* Actual challenge */}
            <div style={{ background: '#fff' }}>
              <AuthenticationChallenge
                transactionId={riskResult?.transaction_id}
                token={token}
                riskScore={riskResult?.risk_score || 0.5}
              />
            </div>
          </div>
        </div>

        {/* After challenge: check transaction status button */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button onClick={handleChallengeComplete}
            style={{ background: C.primary, color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 20, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            ✓ Verify & Return to ZephyrBank
          </button>
          <p style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
            Click after completing the biometric challenge above
          </p>
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  //  PAGE: RESULT
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'RESULT') {
    const isAllow = decision?.result === 'ALLOW' || decision?.result === 'ALLOWED';
    const isDeny  = decision?.result === 'DENY'  || decision?.result === 'DENIED';
    const isEsc   = decision?.result === 'ESCALATE' || decision?.result === 'ESCALATED';

    return (
      <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Segoe UI', Arial, sans-serif" }}>
        <BankNav />
        <div style={{ maxWidth: 500, margin: '60px auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>
            {isAllow ? '✅' : isDeny ? '❌' : '⚠️'}
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 900, color: isAllow ? C.success : isDeny ? C.danger : C.warning, marginBottom: 8 }}>
            {isAllow ? 'Transfer Approved!' : isDeny ? 'Transfer Denied' : 'Under Review'}
          </h2>
          <p style={{ fontSize: 14, color: C.muted, marginBottom: 24, maxWidth: 380, margin: '0 auto 24px' }}>
            {decision?.rationale}
          </p>

          {isAllow && (
            <div style={{ background: '#f0fdf4', border: `1px solid ${C.success}`, borderRadius: 14, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: C.success, marginBottom: 8 }}>Transfer Details</div>
              <div style={{ fontSize: 13, color: C.text }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: C.muted }}>To</span>
                  <span style={{ fontWeight: 600 }}>{form.payee_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: C.muted }}>Amount</span>
                  <span style={{ fontWeight: 800, color: C.danger }}>- {fmt(form.amount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.muted }}>New Balance</span>
                  <span style={{ fontWeight: 800, color: C.success }}>{fmt(user?.balance || '0')}</span>
                </div>
              </div>
            </div>
          )}

          {/* MSAS attribution */}
          <div style={{ background: '#fff0f0', border: `1px solid rgba(220,38,38,0.2)`, borderRadius: 12, padding: '12px 16px', marginBottom: 24, fontSize: 12, color: '#7f1d1d' }}>
            🔌 Decision by <strong>MSAS™ Decision Fusion Engine</strong> — {isAllow ? 'All biometric checks passed' : isEsc ? 'Flagged for manual compliance review' : 'Biometric or anti-spoof check failed'}
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={() => { setDecision(null); setRiskResult(null); setForm({ payee_name: '', payee_account: '', amount: '', note: '' }); setPhase('DASHBOARD'); }}
              style={{ background: C.primary, color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 20, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              ← Back to Dashboard
            </button>
            {!isDeny && (
              <button onClick={() => { setForm({ payee_name: '', payee_account: '', amount: '', note: '' }); setDecision(null); setPhase('SEND_MONEY'); }}
                style={{ background: C.surface, color: C.primary, border: `1.5px solid ${C.primary}`, padding: '12px 24px', borderRadius: 20, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                New Transfer
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, apiFetch } from '@/lib/auth';
import Navbar from '@/components/Navbar';

type Tab = 'profile' | 'documents' | 'security' | 'notifications';

interface KYCDoc {
  has_kyc: boolean;
  id?: number;
  status?: string;
  document_type?: string;
  full_name?: string;
  dob?: string;
  ocr_name?: string;
  ocr_dob?: string;
  ocr_id_number?: string;
  field_match_score?: number;
  ocr_confidence?: number;
  liveness_passed?: boolean;
  voice_enrolled?: boolean;
  document_image_url?: string | null;
  selfie_image_url?: string | null;
  created_at?: string;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
      ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      {label}
    </span>
  );
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? '#16a34a' : pct >= 40 ? '#f59e0b' : '#dc2626';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm font-bold w-10 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function SettingsPage() {
  const { user, token, updateUser } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [kycDoc, setKycDoc] = useState<KYCDoc | null>(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [notifyHighRisk, setNotifyHighRisk] = useState(true);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    if (!token) { router.replace('/login'); return; }
    apiFetch('/auth/me/', token).then(r => r.json()).then(data => {
      setFormData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        phone: data.phone || ''
      });
    });
  }, [token, router]);

  useEffect(() => {
    if (activeTab === 'documents' && token && !kycDoc) {
      setKycLoading(true);
      apiFetch('/kyc/my-docs/', token)
        .then(r => r.json())
        .then(setKycDoc)
        .catch(() => setKycDoc({ has_kyc: false }))
        .finally(() => setKycLoading(false));
    }
  }, [activeTab, token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true); setSuccess(false); setError('');
    try {
      const res = await apiFetch('/auth/me/', token, { method: 'PUT', body: JSON.stringify(formData) });
      if (!res.ok) throw new Error('Failed to update profile');
      setSuccess(true);
      if (updateUser) updateUser(formData);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'profile', label: 'Personal Info', icon: '👤' },
    { id: 'documents', label: 'My Documents', icon: '📄' },
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
  ];

  const cardStyle = {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    boxShadow: 'var(--card-shadow)',
  };

  const inputStyle = {
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '10px 16px',
    background: 'var(--surface)',
    color: 'var(--foreground)',
    outline: 'none',
    fontSize: '14px',
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Page header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-full bg-primary-red/10 border-2 border-primary-red/20 flex items-center justify-center text-primary-red font-bold text-2xl">
              {(user.first_name || user.username)[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>
                {user.first_name ? `${user.first_name} ${user.last_name}` : user.username}
              </h1>
              <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>@{user.username} · {user.is_staff ? 'Administrator' : 'Account Holder'}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-8">
          {/* Sidebar Tabs */}
          <div className="w-48 flex-shrink-0 space-y-1">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-all ${
                  activeTab === tab.id
                    ? 'bg-primary-red text-white shadow-sm'
                    : 'text-secondary-brown hover:bg-border-brown/20'
                }`}>
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">

            {/* ── PERSONAL INFO ── */}
            {activeTab === 'profile' && (
              <div style={cardStyle} className="overflow-hidden">
                <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Personal Information</h3>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>Update your name, email and phone number.</p>
                </div>
                <form onSubmit={handleSave} className="p-6 space-y-5">
                  {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">{error}</div>}
                  {success && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm border border-green-200 font-medium">✅ Profile updated successfully.</div>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground-muted)' }}>First Name</label>
                      <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} style={inputStyle} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground-muted)' }}>Last Name</label>
                      <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} style={inputStyle} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground-muted)' }}>Email Address</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} style={inputStyle} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--foreground-muted)' }}>Phone Number</label>
                    <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="+91 98765 43210" style={inputStyle} />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button type="submit" disabled={loading}
                      className="bg-primary-red hover:bg-primary-red-hover text-white font-semibold px-6 py-2.5 rounded-lg transition-colors shadow-sm disabled:opacity-70 text-sm">
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── DOCUMENTS ── */}
            {activeTab === 'documents' && (
              <div style={cardStyle} className="overflow-hidden">
                <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>My KYC Documents</h3>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>Documents submitted and verified during eKYC onboarding.</p>
                </div>
                <div className="p-6">
                  {kycLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="w-8 h-8 border-4 border-primary-red/20 border-t-primary-red rounded-full animate-spin" />
                    </div>
                  ) : !kycDoc?.has_kyc ? (
                    <div className="text-center py-12">
                      <div className="text-5xl mb-4">📋</div>
                      <p className="font-semibold text-lg mb-2" style={{ color: 'var(--foreground)' }}>No KYC documents found</p>
                      <p className="text-sm mb-6" style={{ color: 'var(--foreground-muted)' }}>
                        Your account may have been created manually. Complete eKYC to link your documents.
                      </p>
                      <button onClick={() => router.push('/kyc')}
                        className="bg-primary-red text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-red-hover transition-colors text-sm">
                        Start eKYC Verification →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* KYC Status Banner */}
                      <div className={`rounded-xl p-4 flex items-center justify-between ${
                        kycDoc.status === 'APPROVED'
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-yellow-50 border border-yellow-200'
                      }`}>
                        <div>
                          <p className={`font-bold text-sm ${kycDoc.status === 'APPROVED' ? 'text-green-800' : 'text-yellow-800'}`}>
                            KYC Status: {kycDoc.status}
                          </p>
                          <p className={`text-xs mt-0.5 ${kycDoc.status === 'APPROVED' ? 'text-green-600' : 'text-yellow-600'}`}>
                            Submitted {kycDoc.created_at ? new Date(kycDoc.created_at).toLocaleDateString('en-IN') : ''}
                          </p>
                        </div>
                        {kycDoc.status === 'APPROVED' && (
                          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white text-xl font-bold">✓</div>
                        )}
                      </div>

                      {/* Document + Selfie Images */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>
                              {kycDoc.document_type || 'Identity Document'}
                            </p>
                            <StatusBadge ok={!!kycDoc.document_image_url} label={kycDoc.document_image_url ? 'Uploaded' : 'Missing'} />
                          </div>
                          {kycDoc.document_image_url ? (
                            <img src={kycDoc.document_image_url} alt="Identity Document" className="w-full object-contain max-h-48 p-2" style={{ background: 'var(--surface)' }} />
                          ) : (
                            <div className="h-32 flex items-center justify-center" style={{ background: 'var(--surface)' }}>
                              <span className="text-3xl opacity-30">📄</span>
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>
                              Liveness Selfie
                            </p>
                            <StatusBadge ok={!!kycDoc.liveness_passed} label={kycDoc.liveness_passed ? 'Verified' : 'Pending'} />
                          </div>
                          {kycDoc.selfie_image_url ? (
                            <img src={kycDoc.selfie_image_url} alt="Liveness Selfie" className="w-full object-cover max-h-48 rounded-b-xl" style={{ background: 'var(--surface)' }} />
                          ) : (
                            <div className="h-32 flex items-center justify-center" style={{ background: 'var(--surface)' }}>
                              <span className="text-3xl opacity-30">🤳</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* OCR Extracted Fields */}
                      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                        <div className="px-5 py-3" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>AI-Extracted Document Data</p>
                        </div>
                        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                          {[
                            { label: 'Full Name (OCR)', value: kycDoc.ocr_name || '—' },
                            { label: 'Date of Birth (OCR)', value: kycDoc.ocr_dob || '—' },
                            { label: 'Document Number', value: kycDoc.ocr_id_number || '—' },
                          ].map(row => (
                            <div key={row.label} className="px-5 py-3.5 flex justify-between items-center">
                              <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>{row.label}</span>
                              <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Verification Scores */}
                      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                        <div className="px-5 py-3" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--foreground-muted)' }}>Verification Scores</p>
                        </div>
                        <div className="p-5 space-y-4">
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Field Match (Name/DOB vs OCR)</span>
                            </div>
                            <ScoreBar value={kycDoc.field_match_score ?? 0} />
                          </div>
                          <div>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>OCR Confidence</span>
                            </div>
                            <ScoreBar value={kycDoc.ocr_confidence ?? 0} />
                          </div>
                          <div className="pt-2 flex gap-3 flex-wrap">
                            <StatusBadge ok={!!kycDoc.liveness_passed} label="Liveness" />
                            <StatusBadge ok={!!kycDoc.voice_enrolled} label="Voice Enrolled" />
                            <StatusBadge ok={kycDoc.status === 'APPROVED'} label="KYC Approved" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SECURITY ── */}
            {activeTab === 'security' && (
              <div className="space-y-4">
                <div style={cardStyle} className="overflow-hidden">
                  <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Biometric Security</h3>
                  </div>
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0 ${
                        user.is_enrolled ? 'bg-green-100' : 'bg-yellow-100'
                      }`}>
                        {user.is_enrolled ? '🎤' : '⚠️'}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm mb-1" style={{ color: 'var(--foreground)' }}>
                          {user.is_enrolled ? 'Voice Biometrics Active' : 'Voice Enrollment Required'}
                        </p>
                        <p className="text-sm mb-4" style={{ color: 'var(--foreground-muted)' }}>
                          {user.is_enrolled
                            ? 'Your MFCC voiceprint is registered and actively securing all high-risk transactions.'
                            : 'Register your voiceprint to enable step-up authentication for high-value transfers.'}
                        </p>
                        <button onClick={() => router.push('/enroll')}
                          className={`text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors ${
                            user.is_enrolled
                              ? 'border text-secondary-brown hover:bg-border-brown/20'
                              : 'bg-primary-red text-white hover:bg-primary-red-hover shadow-sm'
                          }`}
                          style={user.is_enrolled ? { borderColor: 'var(--border)' } : {}}>
                          {user.is_enrolled ? '↺ Re-record Voiceprint' : 'Enroll Now →'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={cardStyle} className="overflow-hidden">
                  <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Account</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Change Password</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>Update your login credentials</p>
                      </div>
                      <button className="text-sm font-medium text-primary-red hover:underline">Update →</button>
                    </div>
                    <hr style={{ borderColor: 'var(--border)' }} />
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-600">Delete Account</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>Permanently removes all your data</p>
                      </div>
                      <button className="text-sm font-bold text-red-600 border border-red-200 px-4 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {activeTab === 'notifications' && (
              <div style={cardStyle} className="overflow-hidden">
                <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h3 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>Notification Preferences</h3>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--foreground-muted)' }}>Choose how MSAS alerts you about account activity.</p>
                </div>
                <div className="p-6 space-y-0 divide-y" style={{ borderColor: 'var(--border)' }}>
                  {[
                    { key: 'email', label: 'Email Alerts', desc: 'Receive email when a transaction is blocked or approved.', value: notifyEmail, toggle: () => setNotifyEmail(!notifyEmail) },
                    { key: 'sms', label: 'SMS Alerts', desc: 'Receive SMS for biometric challenge events.', value: notifySms, toggle: () => setNotifySms(!notifySms) },
                    { key: 'highrisk', label: 'High-Risk Transaction Alerts', desc: 'Instant notification when a high-risk transaction is initiated.', value: notifyHighRisk, toggle: () => setNotifyHighRisk(!notifyHighRisk) },
                  ].map(item => (
                    <div key={item.key} className="py-4 flex items-center justify-between gap-6">
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{item.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--foreground-muted)' }}>{item.desc}</p>
                      </div>
                      <button onClick={item.toggle} className={`w-11 h-6 rounded-full flex items-center p-1 transition-colors flex-shrink-0 ${item.value ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${item.value ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

type SubTab = 'security' | 'notifications' | 'preferences' | 'privacy';

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={`w-11 h-6 rounded-full flex items-center px-1 transition-colors flex-shrink-0 ${on ? 'bg-green-500' : 'bg-gray-300'}`}>
      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function RowToggle({ label, desc, on, onToggle }: { label: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="py-4 flex items-center justify-between gap-6 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium" style={{ color: '#111827' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: '#374151' }}>{desc}</p>
      </div>
      <Toggle on={on} onToggle={onToggle} />
    </div>
  );
}

export default function UserSettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [subTab, setSubTab] = useState<SubTab>('security');

  // Notification prefs
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [notifyHighRisk, setNotifyHighRisk] = useState(true);
  const [notifyLogin, setNotifyLogin] = useState(true);
  const [notifyKyc, setNotifyKyc] = useState(true);

  // Preferences
  const [darkMode, setDarkMode] = useState(false);
  const [twoFA, setTwoFA] = useState(false);

  // Privacy
  const [dataSharing, setDataSharing] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    const saved = localStorage.getItem('msas_theme');
    setDarkMode(saved === 'dark');
  }, [user]);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('msas_theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
  };

  const links = [
    { name: 'HOME', isActive: false, onClick: () => router.push('/dashboard') },
    { name: 'TRANSACTIONS', isActive: false, onClick: () => router.push('/transaction/new') },
    { name: 'RISKS', isActive: false, onClick: () => router.push('/dashboard') },
    { name: 'DOCUMENTS', isActive: false, onClick: () => router.push('/documents') },
    { name: 'PROFILE', isActive: false, onClick: () => router.push('/profile') },
    { name: 'SETTINGS', isActive: true, onClick: () => {} },
  ];

  const subTabs: { id: SubTab; label: string }[] = [
    { id: 'security', label: '🔒 Security' },
    { id: 'notifications', label: '🔔 Notifications' },
    { id: 'preferences', label: '⚙️ Preferences' },
    { id: 'privacy', label: '🛡️ Privacy' },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f3f4f6' }}>
      <Navbar />
      <div className="flex flex-1 items-stretch">
        <Sidebar links={links} />
        <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">

          <div className="mb-6">
            <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>Settings</h1>
            <p className="text-sm mt-1" style={{ color: '#374151' }}>Manage your security, preferences and privacy.</p>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit shadow-sm">
            {subTabs.map(t => (
              <button key={t.id} onClick={() => setSubTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${subTab === t.id ? 'text-white shadow-sm' : 'hover:bg-gray-50'}`}
                style={{ background: subTab === t.id ? '#d32f2f' : 'transparent', color: subTab === t.id ? '#fff' : '#374151' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── SECURITY ── */}
          {subTab === 'security' && (
            <div className="space-y-4">
              {/* Voice Biometrics */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-semibold" style={{ color: '#111827' }}>Biometric Security</h3>
                  <p className="text-sm mt-0.5" style={{ color: '#374151' }}>MFCC voice fingerprint for step-up authentication.</p>
                </div>
                <div className="p-6 flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0 ${user.is_enrolled ? 'bg-green-100' : 'bg-yellow-100'}`}>
                    {user.is_enrolled ? '🎤' : '⚠️'}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm mb-1" style={{ color: '#111827' }}>
                      {user.is_enrolled ? 'Voice Biometrics Active' : 'Voice Enrollment Required'}
                    </p>
                    <p className="text-sm mb-4" style={{ color: '#374151' }}>
                      {user.is_enrolled
                        ? 'Your MFCC voiceprint is registered and actively securing all high-risk transactions (>₹75,000).'
                        : 'Register your voiceprint to enable step-up authentication for high-value transfers.'}
                    </p>
                    <div className="flex gap-3">
                      <button onClick={() => router.push('/enroll')}
                        className={`text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors ${user.is_enrolled ? 'border border-gray-200 hover:bg-gray-50' : 'text-white shadow-sm hover:opacity-90'}`}
                        style={!user.is_enrolled ? { background: '#d32f2f', color: '#fff' } : { color: '#374151' }}>
                        {user.is_enrolled ? '↺ Re-record Voiceprint' : 'Enroll Now →'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2FA */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-semibold" style={{ color: '#111827' }}>Two-Factor Authentication</h3>
                </div>
                <div className="p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#111827' }}>Enable 2FA</p>
                    <p className="text-xs mt-0.5" style={{ color: '#374151' }}>Add an extra layer of login security via OTP.</p>
                  </div>
                  <Toggle on={twoFA} onToggle={() => setTwoFA(!twoFA)} />
                </div>
                {twoFA && (
                  <div className="px-6 pb-5">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                      📱 2FA setup would be configured via your registered phone number. This feature is coming soon.
                    </div>
                  </div>
                )}
              </div>

              {/* Account */}
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-semibold" style={{ color: '#111827' }}>Account Actions</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#111827' }}>Change Password</p>
                      <p className="text-xs mt-0.5" style={{ color: '#374151' }}>Update your login credentials</p>
                    </div>
                    <button className="text-sm font-medium hover:underline" style={{ color: '#d32f2f' }}>Update →</button>
                  </div>
                  <div className="px-6 py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#111827' }}>Active Sessions</p>
                      <p className="text-xs mt-0.5" style={{ color: '#374151' }}>Current session: {typeof window !== 'undefined' ? navigator.userAgent.split(' ').slice(-1)[0] : 'Browser'}</p>
                    </div>
                    <button className="text-sm font-medium border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50" style={{ color: '#374151' }}>Sign Out All</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {subTab === 'notifications' && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-semibold" style={{ color: '#111827' }}>Notification Preferences</h3>
                <p className="text-sm mt-0.5" style={{ color: '#374151' }}>Choose how MSAS alerts you about account activity.</p>
              </div>
              <div className="px-6 py-2">
                <RowToggle label="Email Alerts" desc="Receive email when a transaction is blocked or approved." on={notifyEmail} onToggle={() => setNotifyEmail(!notifyEmail)} />
                <RowToggle label="SMS Alerts" desc="Receive SMS for biometric challenge events." on={notifySms} onToggle={() => setNotifySms(!notifySms)} />
                <RowToggle label="High-Risk Transaction Alerts" desc="Instant notification when a high-risk transaction is initiated." on={notifyHighRisk} onToggle={() => setNotifyHighRisk(!notifyHighRisk)} />
                <RowToggle label="Login Alerts" desc="Get notified whenever someone logs in to your account." on={notifyLogin} onToggle={() => setNotifyLogin(!notifyLogin)} />
                <RowToggle label="KYC Status Updates" desc="Be notified when your KYC application status changes." on={notifyKyc} onToggle={() => setNotifyKyc(!notifyKyc)} />
              </div>
            </div>
          )}

          {/* ── PREFERENCES ── */}
          {subTab === 'preferences' && (
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-semibold" style={{ color: '#111827' }}>Appearance</h3>
                </div>
                <div className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: '#111827' }}>Dark Mode</p>
                    <p className="text-xs mt-0.5" style={{ color: '#374151' }}>Switch between light and dark theme.</p>
                  </div>
                  <Toggle on={darkMode} onToggle={toggleDark} />
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-semibold" style={{ color: '#111827' }}>Display Preferences</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {[
                    { label: 'Currency', value: 'INR (₹ Indian Rupee)' },
                    { label: 'Language', value: 'English (India)' },
                    { label: 'Date Format', value: 'DD/MM/YYYY' },
                    { label: 'Time Zone', value: 'IST (UTC+5:30)' },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-6 py-4 flex items-center justify-between">
                      <p className="text-sm font-medium" style={{ color: '#111827' }}>{label}</p>
                      <span className="text-sm px-3 py-1 rounded-lg bg-gray-100" style={{ color: '#374151' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-semibold" style={{ color: '#111827' }}>Transaction Limits</h3>
                  <p className="text-sm mt-0.5" style={{ color: '#374151' }}>Current MSAS risk thresholds for your account.</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {[
                    ['Low Risk (Auto-Allowed)', '< ₹35,000'],
                    ['Step-Up Required', '₹35,000 – ₹75,000'],
                    ['High Risk (Biometric)', '> ₹75,000'],
                    ['Blocked by Default', 'Unknown payee + Late night'],
                  ].map(([label, value]) => (
                    <div key={label} className="px-6 py-3.5 flex justify-between items-center">
                      <span className="text-sm" style={{ color: '#374151' }}>{label}</span>
                      <span className="text-sm font-semibold font-mono" style={{ color: '#111827' }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── PRIVACY ── */}
          {subTab === 'privacy' && (
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-semibold" style={{ color: '#111827' }}>Data & Privacy</h3>
                </div>
                <div className="px-6 py-2">
                  <RowToggle label="Data Sharing" desc="Allow MSAS to share anonymised usage data for research." on={dataSharing} onToggle={() => setDataSharing(!dataSharing)} />
                  <RowToggle label="Analytics" desc="Help improve the product by sharing performance metrics." on={analytics} onToggle={() => setAnalytics(!analytics)} />
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h3 className="font-semibold" style={{ color: '#111827' }}>Your Data</h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#111827' }}>Download My Data</p>
                      <p className="text-xs mt-0.5" style={{ color: '#374151' }}>Export all your account data as a JSON file.</p>
                    </div>
                    <button className="text-sm font-semibold border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors" style={{ color: '#374151' }}>
                      Download →
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-red-100">
                  <h3 className="font-semibold text-red-700">Danger Zone</h3>
                </div>
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-red-700">Delete Account</p>
                      <p className="text-xs mt-0.5 text-red-500">Permanently removes all your data, transactions and KYC records. This cannot be undone.</p>
                    </div>
                    {!deleteConfirm ? (
                      <button onClick={() => setDeleteConfirm(true)}
                        className="text-sm font-bold text-red-600 border border-red-300 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0">
                        Delete Account
                      </button>
                    ) : (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => { logout(); router.push('/'); }}
                          className="text-sm font-bold text-white bg-red-600 px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                          Confirm Delete
                        </button>
                        <button onClick={() => setDeleteConfirm(false)}
                          className="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50" style={{ color: '#374151' }}>
                          Cancel
                        </button>
                      </div>
                    )}
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

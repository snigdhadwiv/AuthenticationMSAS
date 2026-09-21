'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, apiFetch } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

export default function ProfilePage() {
  const { user, token, updateUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState<string | null>(null);
  const [memberSince, setMemberSince] = useState('');
  const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', phone: '' });

  useEffect(() => {
    if (!token) { router.replace('/login'); return; }
    apiFetch('/auth/me/', token).then(r => r.json()).then(data => {
      setFormData({ first_name: data.first_name || '', last_name: data.last_name || '', email: data.email || '', phone: data.phone || '' });
      if (data.balance !== undefined) setBalance(data.balance);
      if (data.date_joined) setMemberSince(new Date(data.date_joined).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }));
    });
  }, [token]);

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
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const links = [
    { name: 'HOME', isActive: false, onClick: () => router.push('/dashboard') },
    { name: 'TRANSACTIONS', isActive: false, onClick: () => router.push('/transaction/new') },
    { name: 'RISKS', isActive: false, onClick: () => router.push('/dashboard') },
    { name: 'DOCUMENTS', isActive: false, onClick: () => router.push('/documents') },
    { name: 'PROFILE', isActive: true, onClick: () => {} },
    { name: 'SETTINGS', isActive: false, onClick: () => router.push('/user-settings') },
  ];

  if (!user) return null;
  const displayName = user.first_name ? `${user.first_name} ${user.last_name}` : user.username;
  const avatarLetter = (user.first_name || user.username)[0].toUpperCase();
  const balanceNum = balance !== null ? parseFloat(balance) : null;
  const acctNum = `MSAS-${String(user.id || 0).padStart(5, '0')}`;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f3f4f6' }}>
      <Navbar />
      <div className="flex flex-1 items-stretch">
        <Sidebar links={links} />
        <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">

          {/* Hero Header */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-8 mb-6">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #d32f2f 0%, #7f1d1d 100%)' }}>
                {avatarLetter}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold" style={{ color: '#111827' }}>{displayName}</h1>
                <p className="text-sm mt-1" style={{ color: '#374151' }}>@{user.username}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                    style={{ background: user.is_staff ? '#fef3c7' : '#fee2e2', color: user.is_staff ? '#92400e' : '#991b1b' }}>
                    {user.is_staff ? 'Administrator' : 'Account Holder'}
                  </span>
                  {user.is_enrolled && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                      🎤 Voice Enrolled
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium" style={{ color: '#374151' }}>Available Balance</p>
                <p className="text-2xl font-bold mt-1" style={{ color: '#d32f2f' }}>
                  {balanceNum !== null ? `₹${balanceNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                </p>
                <p className="text-xs mt-1 font-mono" style={{ color: '#6b7280' }}>{acctNum}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Edit Form */}
            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold" style={{ color: '#111827' }}>Personal Information</h2>
                <p className="text-sm mt-0.5" style={{ color: '#374151' }}>Update your name, email and contact details.</p>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-5">
                {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">{error}</div>}
                {success && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm border border-green-200 font-medium">✅ Profile updated successfully.</div>}

                <div className="grid grid-cols-2 gap-4">
                  {[['First Name', 'first_name', 'text'], ['Last Name', 'last_name', 'text']].map(([label, name, type]) => (
                    <div key={name}>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>{label}</label>
                      <input type={type} value={(formData as any)[name]}
                        onChange={e => setFormData(p => ({ ...p, [name]: e.target.value }))}
                        style={{ color: '#111827', background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', width: '100%', fontSize: '14px', outline: 'none' }} />
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Email Address</label>
                  <input type="email" value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                    style={{ color: '#111827', background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', width: '100%', fontSize: '14px', outline: 'none' }} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: '#111827' }}>Phone Number</label>
                  <input type="text" value={formData.phone} placeholder="+91 98765 43210"
                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                    style={{ color: '#111827', background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px 16px', width: '100%', fontSize: '14px', outline: 'none' }} />
                </div>
                <div className="pt-2 flex justify-end">
                  <button type="submit" disabled={loading}
                    className="bg-primary-red hover:bg-primary-red-hover text-white font-semibold px-6 py-2.5 rounded-lg transition-colors shadow-sm disabled:opacity-70 text-sm">
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>

            {/* Account Info sidebar */}
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-sm" style={{ color: '#111827' }}>Account Information</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {[
                    ['Username', `@${user.username}`],
                    ['Account ID', acctNum],
                    ['Status', 'Active'],
                    ['Role', user.is_staff ? 'Administrator' : 'Standard'],
                    ['Member Since', memberSince || '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="px-5 py-3 flex justify-between items-center">
                      <span className="text-xs" style={{ color: '#374151' }}>{k}</span>
                      <span className="text-xs font-semibold" style={{ color: '#111827' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-sm" style={{ color: '#111827' }}>MSAS Virtual Wallet</h3>
                </div>
                <div className="p-5">
                  <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #d32f2f 0%, #7f1d1d 100%)' }}>
                    <p className="text-xs text-red-200 uppercase tracking-widest mb-1">Available Balance</p>
                    <p className="text-2xl font-bold">
                      {balanceNum !== null ? `₹${balanceNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                    </p>
                    <p className="text-xs text-red-200 mt-2 font-mono">{acctNum} · @{user.username}</p>
                  </div>
                  <button onClick={() => router.push('/transaction/new')}
                    className="mt-3 w-full bg-primary-red text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-primary-red-hover transition-colors">
                    + New Transfer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

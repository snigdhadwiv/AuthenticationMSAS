'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, apiFetch } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

export default function EnrollBiometricsPage() {
  const { user, token, updateUser } = useAuth();
  const router = useRouter();

  const [phase, setPhase] = useState<'IDLE' | 'RECORDING' | 'PROCESSING' | 'DONE'>('IDLE');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = processAudio;
      mediaRecorderRef.current.start();
      setPhase('RECORDING');
      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          mediaRecorderRef.current.stop();
          stream.getTracks().forEach(t => t.stop());
        }
      }, 5000);
    } catch (err: any) {
      setError('Could not access microphone. ' + err.message);
    }
  };

  const processAudio = async () => {
    setPhase('PROCESSING');
    if (!token) return;
    const mimeType = audioChunks.current[0]?.type || 'audio/webm';
    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
    const audioBlob = new Blob(audioChunks.current, { type: mimeType });
    const formData = new FormData();
    formData.append('audio', audioBlob, `enrollment.${ext}`);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/enroll-voice/', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to enroll voice');
      setResult('Voice biometrics successfully registered!');
      updateUser({ is_enrolled: true });
      setPhase('DONE');
    } catch (err: any) {
      setError(err.message);
      setPhase('IDLE');
    }
  };

  const links = [
    { name: 'HOME', isActive: false, onClick: () => router.push('/dashboard') },
    { name: 'TRANSACTIONS', isActive: false, onClick: () => router.push('/transactions') },
    { name: 'RISKS', isActive: false, onClick: () => router.push('/dashboard') },
    { name: 'DOCUMENTS', isActive: false, onClick: () => router.push('/documents') },
    { name: 'PROFILE', isActive: false, onClick: () => router.push('/profile') },
    { name: 'SETTINGS', isActive: false, onClick: () => router.push('/user-settings') },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f3f4f6' }}>
      <Navbar />
      <div className="flex flex-1 items-stretch">
        <Sidebar links={links} />

        <main className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">

          {/* Breadcrumb */}
          <button onClick={() => router.push('/user-settings')}
            className="flex items-center gap-1 text-sm mb-6 hover:underline"
            style={{ color: '#374151' }}>
            ← Back to Settings
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"
              style={{ background: user.is_enrolled ? '#dcfce7' : '#fee2e2' }}>
              {user.is_enrolled ? '🎤' : '🔒'}
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#111827' }}>
              {user.is_enrolled ? 'Re-enroll Voice Biometrics' : 'Enroll Voice Biometrics'}
            </h1>
            <p className="text-sm max-w-md mx-auto" style={{ color: '#374151' }}>
              To protect your account with Speaker Verification, please record your voice.
              This generates a mathematical voiceprint that hackers cannot forge.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm mb-5" style={{ color: '#d32f2f' }}>
              {error}
            </div>
          )}

          {/* Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">

            {phase === 'IDLE' && (
              <div className="text-center space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#374151' }}>
                    Please read this phrase aloud when recording starts:
                  </p>
                  <div className="font-mono text-lg rounded-xl px-6 py-4 border border-gray-200"
                    style={{ color: '#111827', background: '#f9fafb' }}>
                    "My voice is my password, verify me."
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    ['🎙️', 'Recording lasts 5 seconds'],
                    ['📊', 'MFCC features extracted from your voice'],
                    ['🔐', 'Voiceprint stored securely, not the raw audio'],
                  ].map(([icon, text]) => (
                    <div key={text} className="flex items-center gap-3 text-sm" style={{ color: '#374151' }}>
                      <span>{icon}</span><span>{text}</span>
                    </div>
                  ))}
                </div>
                <button onClick={startRecording}
                  className="text-white font-semibold px-10 py-3 rounded-full transition-colors shadow-sm hover:opacity-90"
                  style={{ background: '#d32f2f' }}>
                  🎤 Start Recording
                </button>
              </div>
            )}

            {phase === 'RECORDING' && (
              <div className="text-center space-y-5">
                <div className="animate-pulse">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-4"
                    style={{ background: '#fee2e2', border: '3px solid #d32f2f' }}>
                    🎙️
                  </div>
                  <p className="font-bold text-lg mb-1" style={{ color: '#d32f2f' }}>Recording...</p>
                  <p className="text-sm mb-4" style={{ color: '#374151' }}>Please read the phrase aloud:</p>
                </div>
                <div className="font-mono text-xl rounded-xl px-6 py-4 border-2 border-red-200"
                  style={{ color: '#111827', background: '#fff5f5' }}>
                  "My voice is my password, verify me."
                </div>
                <p className="text-xs" style={{ color: '#6b7280' }}>Recording stops automatically after 5 seconds.</p>
              </div>
            )}

            {phase === 'PROCESSING' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-14 h-14 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin" />
                <p className="font-medium" style={{ color: '#111827' }}>Extracting MFCC Voiceprint features...</p>
                <p className="text-sm" style={{ color: '#374151' }}>This may take a few seconds.</p>
              </div>
            )}

            {phase === 'DONE' && (
              <div className="text-center space-y-5">
                <div className="text-5xl mb-2">✅</div>
                <p className="font-bold text-lg" style={{ color: '#111827' }}>Enrollment Successful!</p>
                <p className="text-sm" style={{ color: '#374151' }}>{result}</p>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700">
                  Your voiceprint is now active. High-risk transactions will use biometric step-up authentication.
                </div>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => router.push('/dashboard')}
                    className="text-white font-semibold px-8 py-3 rounded-full transition-colors hover:opacity-90"
                    style={{ background: '#d32f2f' }}>
                    Go to Dashboard
                  </button>
                  <button onClick={() => { setPhase('IDLE'); setResult(''); setError(''); }}
                    className="border border-gray-200 font-medium px-6 py-3 rounded-full hover:bg-gray-50 transition-colors"
                    style={{ color: '#374151' }}>
                    Re-record
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

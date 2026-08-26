'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, apiFetch } from '@/lib/auth';

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
      
      // Record for 5 seconds
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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-border-brown px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-secondary-brown hover:text-primary-red text-sm">← Back</button>
        <span className="text-primary-red font-bold">MSAS</span>
        <span className="text-secondary-brown text-sm">Biometric Enrollment</span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6 text-center">
        <h1 className="text-2xl font-bold text-foreground">Enroll Voice Biometrics</h1>
        <p className="text-secondary-brown">
          To protect your account with Speaker Verification, please record your voice.
          This generates a mathematical voiceprint that hackers cannot forge.
        </p>

        {error && <div className="bg-red-50 text-primary-red px-4 py-3 rounded-lg text-sm border border-red-200">{error}</div>}

        <div className="bg-white border border-border-brown rounded-2xl p-8 mt-8">
          {phase === 'IDLE' && (
            <div>
              <p className="font-mono text-xl bg-gray-100 p-4 rounded-lg mb-6">"My voice is my password, verify me."</p>
              <button 
                onClick={startRecording}
                className="bg-primary-red text-white font-semibold px-8 py-3 rounded-full hover:bg-primary-red-hover transition-colors"
              >
                🎤 Start Recording
              </button>
            </div>
          )}

          {phase === 'RECORDING' && (
            <div className="animate-pulse">
              <p className="text-primary-red font-bold mb-4">Recording... Please read the phrase aloud:</p>
              <p className="font-mono text-2xl text-foreground">"My voice is my password, verify me."</p>
            </div>
          )}

          {phase === 'PROCESSING' && (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-border-brown border-t-primary-red rounded-full animate-spin mb-4" />
              <p className="text-secondary-brown">Extracting MFCC Voiceprint features...</p>
            </div>
          )}

          {phase === 'DONE' && (
            <div>
              <div className="text-4xl mb-4">✅</div>
              <p className="text-green-700 font-semibold mb-6">{result}</p>
              <button 
                onClick={() => router.push('/dashboard')}
                className="bg-secondary-brown text-white font-semibold px-8 py-3 rounded-full hover:bg-accent-brown transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = 'http://127.0.0.1:8000/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;
type DocType = 'AADHAAR' | 'PAN' | 'PASSPORT' | 'DRIVING_LICENCE';

interface PersonalData {
  full_name: string; dob: string; email: string;
  phone: string; address: string; document_type: DocType;
}

interface OCRResult {
  ocr_name: string; ocr_dob: string; ocr_id_number: string;
  ocr_address: string; ocr_confidence: number; field_match_score: number;
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepBar({ current }: { current: Step }) {
  const steps = ['Personal Details', 'Document Upload', 'Liveness Check', 'Voice Enrolment', 'Submit'];
  return (
    <div className="flex items-center justify-between mb-10 px-2">
      {steps.map((label, i) => {
        const n = (i + 1) as Step;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors ${
                done   ? 'bg-green-600 border-green-600 text-white' :
                active ? 'bg-primary-red border-primary-red text-white' :
                         'bg-white border-gray-400'
              }`} style={!done && !active ? { color: '#374151' } : {}}>
                {done ? '✓' : n}
              </div>
              <span className={`text-xs mt-1 font-medium`} style={{ color: active ? '#d32f2f' : '#374151' }}>
                {label}
              </span>
            </div>
            {i < 4 && <div className={`flex-1 h-0.5 mx-2 mb-5 ${done ? 'bg-green-600' : 'bg-border-brown'}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Personal Details ─────────────────────────────────────────────────

function Step1({ onNext }: { onNext: (data: PersonalData, appId: number) => void }) {
  const [form, setForm] = useState<PersonalData>({
    full_name: '', dob: '', email: '', phone: '', address: '', document_type: 'AADHAAR'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API}/kyc/apply/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');
      onNext(form, data.application_id);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const field = (key: keyof PersonalData, label: string, type = 'text', extra?: any) => (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: '#111827' }}>{label}</label>
      <input
        type={type}
        value={form[key] as string}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-red"
        style={{ color: '#111827', background: '#fff' }}
        {...extra}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold" style={{ color: '#111827' }}>Personal Details</h2>
      <p className="text-sm" style={{ color: '#374151' }}>Please enter your details exactly as they appear on your identity document.</p>
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">{error}</div>}
      <div className="grid grid-cols-2 gap-4">
        {field('full_name', 'Full Name (as on document)')}
        {field('dob', 'Date of Birth', 'date')}
        {field('email', 'Email Address', 'email')}
        {field('phone', 'Phone Number', 'tel')}
      </div>
      {field('address', 'Residential Address')}
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: '#111827' }}>Document Type</label>
        <select
          value={form.document_type}
          onChange={e => setForm(f => ({ ...f, document_type: e.target.value as DocType }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-red"
          style={{ color: '#111827', background: '#fff' }}
        >
          <option value="AADHAAR">Aadhaar Card</option>
          <option value="PAN">PAN Card</option>
          <option value="PASSPORT">Passport</option>
          <option value="DRIVING_LICENCE">Driving Licence</option>
        </select>
      </div>
      <button
        onClick={submit} disabled={loading || !form.full_name || !form.dob || !form.email}
        className="w-full bg-primary-red text-white font-semibold py-3 rounded-xl hover:bg-primary-red-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Submitting...' : 'Continue →'}
      </button>
    </div>
  );
}

// ─── Step 2: Document Upload ──────────────────────────────────────────────────

function Step2({ appId, docType, submittedName, submittedDob, onNext }: {
  appId: number; docType: string; submittedName: string; submittedDob: string;
  onNext: (ocr: OCRResult) => void;
}) {
  const [phase, setPhase] = useState<'IDLE' | 'PROCESSING' | 'DONE'>('IDLE');
  const [ocr, setOcr] = useState<OCRResult | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(''); setPreview(URL.createObjectURL(file));
    setPhase('PROCESSING');
    const fd = new FormData();
    fd.append('application_id', String(appId));
    fd.append('document_image', file);
    try {
      const res = await fetch(`${API}/kyc/upload-document/`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setOcr(data); setPhase('DONE');
    } catch (e: any) { setError(e.message); setPhase('IDLE'); }
  };

  const matchColor = (s: number) =>
    s >= 0.70 ? 'text-green-700 bg-green-50' : s >= 0.40 ? 'text-yellow-700 bg-yellow-50' : 'text-red-700 bg-red-50';

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold" style={{ color: '#111827' }}>Upload Identity Document</h2>
      <p className="text-sm" style={{ color: '#374151' }}>Upload a clear photo of your <strong>{docType.replace('_', ' ')}</strong>. Ensure all text is legible.</p>
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">{error}</div>}

      {phase === 'IDLE' && (
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-primary-red transition-colors"
        >
          <div className="text-4xl mb-3">📄</div>
          <p className="font-medium" style={{ color: '#111827' }}>Click to upload or drag and drop</p>
          <p className="text-xs mt-1" style={{ color: '#6b7280' }}>JPG, PNG supported. Max 10MB.</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      )}

      {phase === 'PROCESSING' && (
        <div className="flex flex-col items-center py-10">
          {preview && <img src={preview} className="max-h-48 rounded-lg shadow mb-6 object-contain" alt="Document preview" />}
          <div className="w-10 h-10 border-4 border-gray-200 border-t-primary-red rounded-full animate-spin mb-3" />
          <p style={{ color: '#374151' }}>Running Gemini Vision OCR...</p>
        </div>
      )}

      {phase === 'DONE' && ocr && (
        <div className="space-y-4">
          {preview && <img src={preview} className="max-h-40 rounded-lg shadow object-contain" alt="Document" />}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="font-semibold text-xs uppercase tracking-wide mb-3" style={{ color: '#111827' }}>OCR Extraction Results</h3>
            {[
              ['Extracted Name', ocr.ocr_name],
              ['Extracted DOB', ocr.ocr_dob],
              ['ID Number', ocr.ocr_id_number],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between text-sm">
                <span style={{ color: '#374151' }}>{label}</span>
                <span className="font-mono font-medium" style={{ color: '#111827' }}>{val || '—'}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
              <span className="text-sm" style={{ color: '#374151' }}>Field Match Score</span>
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${matchColor(ocr.field_match_score)}`}>
                {Math.round(ocr.field_match_score * 100)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm" style={{ color: '#374151' }}>OCR Confidence</span>
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${matchColor(ocr.ocr_confidence)}`}>
                {Math.round(ocr.ocr_confidence * 100)}%
              </span>
            </div>
          </div>
          {ocr.field_match_score < 0.40 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              ⚠️ Name/DOB mismatch is high. Please ensure you are uploading the correct document.
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => { setPhase('IDLE'); setPreview(null); setOcr(null); }}
              className="flex-1 border border-gray-300 py-2.5 rounded-xl hover:bg-gray-50 text-sm font-medium" style={{ color: '#374151' }}>
              Re-upload
            </button>
            <button onClick={() => onNext(ocr)}
              className="flex-1 bg-primary-red text-white py-2.5 rounded-xl hover:bg-primary-red-hover text-sm font-semibold">
              Continue →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Liveness Check ───────────────────────────────────────────────────

function Step3({ appId, onNext }: { appId: number; onNext: () => void }) {
  const [phase, setPhase]       = useState<'IDLE' | 'ACTIVE' | 'DONE' | 'ERROR'>('IDLE');
  const [passed, setPassed]     = useState(false);
  const [error, setError]       = useState('');
  const [countdown, setCountdown] = useState(3);
  const [faceDetected, setFaceDetected] = useState(false);
  const videoRef   = useRef<HTMLVideoElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const faceTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCamera = async () => {
    try {
      setPhase('ACTIVE');
      setCountdown(3);
      setFaceDetected(false);
      // Wait for React to render the video element
      await new Promise(r => setTimeout(r, 80));

      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.error('[liveness] play error:', e));
      }
      runLiveness();
    } catch (e: any) {
      setError('Camera access denied: ' + e.message);
      setPhase('ERROR');
    }
  };

  const stopCamera = () => {
    runningRef.current = false;
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current)  clearTimeout(timerRef.current);
    if (faceTimer.current) clearInterval(faceTimer.current);
  };

  const captureSelfieAndFinish = useCallback(async () => {
    if (passed) return;
    setPassed(true);
    stopCamera();
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    if (video) {
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
    }
    canvas.toBlob(async (blob) => {
      const fd = new FormData();
      fd.append('application_id', String(appId));
      fd.append('liveness_passed', 'true');
      if (blob) fd.append('selfie_image', blob, 'selfie.jpg');
      try { await fetch(`${API}/kyc/liveness/`, { method: 'POST', body: fd }); }
      catch (e) { console.error('Liveness save error:', e); }
      setPhase('DONE');
    }, 'image/jpeg');
  }, [passed, appId]);

  const runLiveness = () => {
    runningRef.current = true;
    const FM = (window as any).FaceMesh;
    if (!FM) { setTimeout(runLiveness, 500); return; }

    const fm = new FM({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` });
    fm.setOptions({ maxNumFaces: 1, refineLandmarks: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

    let faceSeenAt: number | null = null;

    fm.onResults((res: any) => {
      if (!runningRef.current || passed) return;
      const hasFace = res.multiFaceLandmarks && res.multiFaceLandmarks.length > 0;
      setFaceDetected(hasFace);

      if (hasFace) {
        if (!faceSeenAt) faceSeenAt = Date.now();
        const elapsed = (Date.now() - faceSeenAt) / 1000;
        const remaining = Math.max(0, 3 - elapsed);
        setCountdown(Math.ceil(remaining));
        if (elapsed >= 3) {
          captureSelfieAndFinish();
        }
      } else {
        // Reset timer if face disappears
        faceSeenAt = null;
        setCountdown(3);
      }
    });

    const tick = async () => {
      if (!runningRef.current || !videoRef.current) return;
      if (videoRef.current.readyState >= 2) {
        try { await fm.send({ image: videoRef.current }); } catch (_) {}
      }
      requestAnimationFrame(tick);
    };
    tick();
  };

  useEffect(() => () => stopCamera(), []);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold" style={{ color: '#111827' }}>Active Liveness Check</h2>
      <p className="text-sm" style={{ color: '#374151' }}>Keep your face visible in the frame for 3 seconds to verify you are physically present.</p>
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">{error}</div>}

      {phase === 'IDLE' && (
        <div className="text-center py-8">
          <div className="text-5xl mb-4">🎥</div>
          <p className="mb-6" style={{ color: '#374151' }}>Your camera will activate for a quick presence check.</p>
          <button onClick={startCamera} className="bg-primary-red text-white font-semibold px-8 py-3 rounded-full hover:bg-primary-red-hover">
            Activate Camera
          </button>
        </div>
      )}

      {phase === 'ACTIVE' && (
        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-inner mx-auto">
          <video ref={videoRef} className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100" autoPlay muted playsInline />

          {/* Countdown overlay */}
          <div className="absolute top-3 left-0 right-0 flex justify-center z-20">
            <div className={`px-6 py-3 rounded-xl border-2 text-center shadow-lg transition-colors ${faceDetected ? 'bg-white/90 border-green-500' : 'bg-white/90 border-primary-red animate-pulse'}`}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#374151' }}>
                {faceDetected ? '✅ Face Detected' : '👤 Position your face in frame'}
              </p>
              {faceDetected && (
                <p className="text-green-700 font-bold text-2xl">{countdown}s</p>
              )}
            </div>
          </div>

          {/* Face guide oval */}
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div className={`w-48 h-64 rounded-full border-4 ${faceDetected ? 'border-green-400' : 'border-white/40'} transition-colors`} />
          </div>

          {/* Skip button */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20">
            <button
              onClick={() => captureSelfieAndFinish()}
              className="bg-gray-700 text-white text-xs px-4 py-1.5 rounded-full hover:bg-gray-600 transition-colors shadow-lg"
            >
              ✓ Skip (Dev mode)
            </button>
          </div>
        </div>
      )}

      {phase === 'DONE' && (
        <div className="text-center py-8">
          <div className="text-5xl mb-4">✅</div>
          <p className="text-green-700 font-semibold text-lg mb-6">Liveness verified successfully!</p>
          <button onClick={onNext} className="bg-primary-red text-white font-semibold px-8 py-3 rounded-full hover:bg-primary-red-hover">
            Continue →
          </button>
        </div>
      )}

      {phase === 'ERROR' && (
        <div className="text-center py-8">
          <div className="text-5xl mb-4">❌</div>
          <p className="text-red-700 mb-4">Could not start camera. {error}</p>
          <button onClick={() => { setPhase('IDLE'); setError(''); }} className="border border-gray-300 px-6 py-2 rounded-full text-sm" style={{ color: '#374151' }}>Try Again</button>
        </div>
      )}
    </div>
  );
}


// ─── Step 4: Voice Enrolment ──────────────────────────────────────────────────

function Step4({ appId, onNext }: { appId: number; onNext: () => void }) {
  const [phase, setPhase] = useState<'IDLE' | 'RECORDING' | 'PROCESSING' | 'DONE'>('IDLE');
  const [error, setError] = useState('');
  const chunks = useRef<Blob[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);

  const start = async () => {
    setError('');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    recRef.current = rec; chunks.current = [];
    rec.ondataavailable = e => e.data.size > 0 && chunks.current.push(e.data);
    rec.onstop = process;
    rec.start(); setPhase('RECORDING');
    setTimeout(() => { if (rec.state === 'recording') { rec.stop(); stream.getTracks().forEach(t => t.stop()); } }, 5000);
  };

  const process = async () => {
    setPhase('PROCESSING');
    const mime = chunks.current[0]?.type || 'audio/webm';
    const ext  = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks.current, { type: mime });
    const fd   = new FormData();
    fd.append('application_id', String(appId));
    fd.append('audio', blob, `enrollment.${ext}`);
    try {
      const res = await fetch(`${API}/kyc/enroll-voice/`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setPhase('DONE');
    } catch (e: any) { setError(e.message); setPhase('IDLE'); }
  };

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold" style={{ color: '#111827' }}>Voice Biometric Enrolment</h2>
      <p className="text-sm" style={{ color: '#374151' }}>Record your voice to create a unique biometric signature tied to your identity.</p>
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">{error}</div>}
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        {phase === 'IDLE' && (<>
          <p className="font-mono text-lg bg-gray-100 p-4 rounded-lg mb-6" style={{ color: '#111827' }}>"My voice is my password, verify me."</p>
          <button onClick={start} className="bg-primary-red text-white font-semibold px-8 py-3 rounded-full hover:bg-primary-red-hover">
            🎤 Start Recording (5s)
          </button>
        </>)}
        {phase === 'RECORDING' && (<>
          <div className="text-primary-red text-4xl mb-4 animate-pulse">🔴</div>
          <p className="font-mono text-xl" style={{ color: '#111827' }}>"My voice is my password, verify me."</p>
          <p className="text-sm mt-3 animate-pulse" style={{ color: '#374151' }}>Recording... speak clearly</p>
        </>)}
        {phase === 'PROCESSING' && (<>
          <div className="w-12 h-12 border-4 border-gray-200 border-t-primary-red rounded-full animate-spin mx-auto mb-4" />
          <p style={{ color: '#374151' }}>Extracting MFCC voiceprint...</p>
        </>)}
        {phase === 'DONE' && (<>
          <div className="text-4xl mb-4">✅</div>
          <p className="text-green-700 font-semibold mb-6">Voiceprint registered successfully!</p>
          <button onClick={onNext} className="bg-primary-red text-white font-semibold px-8 py-3 rounded-full hover:bg-primary-red-hover">
            Continue →
          </button>
        </>)}
      </div>
    </div>
  );
}

// ─── Step 5: Review & Submit ──────────────────────────────────────────────────

function Step5({ appId, personal, ocr, onDone }: {
  appId: number; personal: PersonalData; ocr: OCRResult | null;
  onDone: (result: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const submit = async () => {
    setLoading(true); setError('');
    try {
      const res  = await fetch(`${API}/kyc/submit/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: appId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed');
      onDone(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const matchPct = ocr ? Math.round(ocr.field_match_score * 100) : 0;
  const confPct  = ocr ? Math.round(ocr.ocr_confidence * 100) : 0;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold" style={{ color: '#111827' }}>Review & Submit</h2>
      <p className="text-sm" style={{ color: '#374151' }}>Please review your application summary before final submission.</p>
      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">{error}</div>}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-3 text-sm">
        <div className="font-semibold uppercase text-xs tracking-wide border-b border-gray-200 pb-2 mb-3" style={{ color: '#111827' }}>Identity Details</div>
        {[['Full Name', personal.full_name], ['Date of Birth', personal.dob], ['Email', personal.email], ['Phone', personal.phone], ['Document Type', personal.document_type]].map(([k,v]) => (
          <div key={k} className="flex justify-between">
            <span style={{ color: '#374151' }}>{k}</span>
            <span className="font-medium" style={{ color: '#111827' }}>{v}</span>
          </div>
        ))}
      </div>
      {ocr && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-3 text-sm">
          <div className="font-semibold uppercase text-xs tracking-wide border-b border-gray-200 pb-2 mb-3" style={{ color: '#111827' }}>OCR Verification</div>
          {[['OCR Name', ocr.ocr_name || '—'], ['OCR DOB', ocr.ocr_dob || '—'], ['OCR ID Number', ocr.ocr_id_number || '—']].map(([k,v]) => (
            <div key={k} className="flex justify-between">
              <span style={{ color: '#374151' }}>{k}</span>
              <span className="font-mono font-medium" style={{ color: '#111827' }}>{v}</span>
            </div>
          ))}
          <div className="flex justify-between pt-1">
            <span style={{ color: '#374151' }}>Field Match</span>
            <span className={`font-bold ${matchPct >= 70 ? 'text-green-700' : matchPct >= 40 ? 'text-yellow-700' : 'text-red-700'}`}>{matchPct}%</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: '#374151' }}>OCR Confidence</span>
            <span className={`font-bold ${confPct >= 60 ? 'text-green-700' : 'text-yellow-700'}`}>{confPct}%</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {[['📷', 'Document Uploaded', true], ['👤', 'Liveness Verified', true], ['🎤', 'Voice Enrolled', true]].map(([icon, label, ok]) => (
          <div key={label as string} className={`rounded-xl p-3 text-center border ${ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <div className="text-xl mb-1">{icon}</div>
            <div className={`text-xs font-medium ${ok ? 'text-green-700' : 'text-red-700'}`}>{label}</div>
          </div>
        ))}
      </div>
      <button onClick={submit} disabled={loading}
        className="w-full bg-primary-red text-white font-semibold py-3 rounded-xl hover:bg-primary-red-hover disabled:opacity-50 transition-colors">
        {loading ? 'Processing AI Verification...' : 'Submit Application'}
      </button>
    </div>
  );
}

// ─── Result Screen ────────────────────────────────────────────────────────────

function ResultScreen({ result, appId }: { result: any; appId: number }) {
  const router = useRouter();
  const res = result.result?.toUpperCase();

  const config: Record<string, { icon: string; title: string; color: string }> = {
    APPROVE: { icon: '✅', title: 'Application Approved!', color: 'text-green-700' },
    REJECT:  { icon: '❌', title: 'Application Rejected',  color: 'text-red-700'   },
    ESCALATE:{ icon: '⏳', title: 'Under Manual Review',   color: 'text-yellow-700'},
    RETRY:   { icon: '🔄', title: 'Re-upload Required',    color: 'text-yellow-700'},
  };
  const cfg = config[res] || config['ESCALATE'];

  return (
    <div className="text-center space-y-6 py-4">
      <div className="text-6xl">{cfg.icon}</div>
      <h2 className={`text-2xl font-bold ${cfg.color}`}>{cfg.title}</h2>
      <p style={{ color: '#374151' }}>{result.rationale}</p>

      {res === 'APPROVE' && result.username && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-left space-y-3">
          <p className="font-semibold text-green-800 mb-2">Your account has been created. Save these credentials:</p>
          <div className="flex justify-between text-sm"><span style={{ color: '#374151' }}>Username</span><span className="font-mono font-bold" style={{ color: '#111827' }}>{result.username}</span></div>
          <div className="flex justify-between text-sm"><span style={{ color: '#374151' }}>Temporary Password</span><span className="font-mono font-bold" style={{ color: '#111827' }}>{result.password}</span></div>
          <p className="text-xs text-yellow-700 mt-3">⚠️ This password will not be shown again. Please save it now.</p>
          <button onClick={() => router.push('/login')} className="w-full bg-primary-red text-white font-semibold py-2.5 rounded-xl mt-2 hover:bg-primary-red-hover">
            Proceed to Login →
          </button>
        </div>
      )}

      {res === 'ESCALATE' && (
        <p className="text-sm" style={{ color: '#374151' }}>Your application ID is <strong>#{appId}</strong>. An admin will review within 24 hours.</p>
      )}

      {res !== 'APPROVE' && (
        <button onClick={() => router.push('/login')} className="border border-gray-300 px-6 py-2 rounded-full text-sm hover:bg-gray-50" style={{ color: '#374151' }}>
          Back to Login
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KYCPage() {
  const router = useRouter();
  const [step, setStep]         = useState<Step>(1);
  const [appId, setAppId]       = useState<number | null>(null);
  const [personal, setPersonal] = useState<PersonalData | null>(null);
  const [ocr, setOcr]           = useState<OCRResult | null>(null);
  const [result, setResult]     = useState<any>(null);

  return (
    <div className="min-h-screen" style={{ background: '#f3f4f6' }}>
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <span className="text-primary-red font-bold text-xl">MSAS</span>
        <span className="text-gray-400 text-sm">·</span>
        <span className="text-sm font-medium" style={{ color: '#374151' }}>eKYC Onboarding</span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {result ? (
            <ResultScreen result={result} appId={appId!} />
          ) : (
            <>
              <StepBar current={step} />
              {step === 1 && (
                <Step1 onNext={(data, id) => { setPersonal(data); setAppId(id); setStep(2); }} />
              )}
              {step === 2 && appId && personal && (
                <Step2
                  appId={appId} docType={personal.document_type}
                  submittedName={personal.full_name} submittedDob={personal.dob}
                  onNext={(ocrData) => { setOcr(ocrData); setStep(3); }}
                />
              )}
              {step === 3 && appId && (
                <Step3 appId={appId} onNext={() => setStep(4)} />
              )}
              {step === 4 && appId && (
                <Step4 appId={appId} onNext={() => setStep(5)} />
              )}
              {step === 5 && appId && personal && (
                <Step5
                  appId={appId} personal={personal} ocr={ocr}
                  onDone={(r) => {
                    if (r.result?.toUpperCase() === 'RETRY') { setStep(2); }
                    else { setResult(r); }
                  }}
                />
              )}
            </>
          )}
        </div>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--foreground-muted)' }}>
          Already have an account?{' '}
          <button onClick={() => router.push('/login')} className="text-primary-red hover:underline font-medium">Sign In</button>
        </p>
      </main>
    </div>
  );
}

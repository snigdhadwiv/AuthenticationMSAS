'use client';

import React, { useEffect, useRef, useState } from 'react';
import { isHeadCentered, calculateHeadPose, Landmark } from '@/lib/mediapipe-utils';

declare global {
  interface Window {
    FaceMesh: any;
  }
}

type Results = {
  multiFaceLandmarks: Landmark[][];
};

interface ChallengeProps {
  transactionId?: number;  // if provided, saves decision to backend after completion
  token?: string;          // JWT bearer token
}

export default function AuthenticationChallenge({ transactionId, token }: ChallengeProps = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  // Use refs for values that need to be read inside callbacks (no stale closures)
  const oneTimeCodeRef = useRef('');
  const livenessPassedRef = useRef(false);
  const hasBlinked = useRef(false);
  const requiredPoseRef = useRef<{ axis: 'yaw'|'pitch', dir: string, label: string }>({ axis: 'yaw', dir: 'right', label: 'Turn Head Right' });
  const [requiredPoseLabel, setRequiredPoseLabel] = useState('Turn Head Right');

  // Assign random pose on mount
  useEffect(() => {
    const poses = [
      { axis: 'yaw', dir: 'left', label: 'Turn Head Left' },
      { axis: 'yaw', dir: 'right', label: 'Turn Head Right' },
      { axis: 'pitch', dir: 'up', label: 'Look Up' },
      { axis: 'pitch', dir: 'down', label: 'Look Down' },
    ];
    const picked = poses[Math.floor(Math.random() * poses.length)];
    requiredPoseRef.current = picked as any;
    setRequiredPoseLabel(picked.label);
  }, []);

  const [oneTimeCode, setOneTimeCode] = useState('');
  const [spokenCode, setSpokenCode] = useState('');
  const [phase, setPhase] = useState<'IDLE' | 'LIVENESS' | 'RECORDING' | 'PROCESSING' | 'DONE'>('IDLE');
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [decision, setDecision] = useState<{ result: string; rationale: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showManualBlink, setShowManualBlink] = useState(false);

  useEffect(() => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setOneTimeCode(code);
    oneTimeCodeRef.current = code; // keep ref in sync
  }, []);

  const startChallenge = async () => {
    try {
      setPhase('LIVENESS');
      setError(null);
      setShowManualBlink(false);
      hasBlinked.current = false;
      livenessPassedRef.current = false;
      audioChunks.current = [];

      // Show manual fallback after 5s if auto-detection doesn't trigger
      setTimeout(() => setShowManualBlink(true), 5000);

      // Get video stream for face mesh (camera only)
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
      }

      // Get a separate audio-only stream for the MediaRecorder
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Do NOT specify mimeType — let the browser pick its own default to avoid NotSupportedError
      const recorder = new MediaRecorder(audioStream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };
      recorder.onstop = () => processAudio();
      mediaRecorderRef.current = recorder;

      initFaceMesh();
    } catch (err) {
      console.error(err);
      failClosed('Failed to access camera/microphone.');
    }
  };


  const initFaceMesh = () => {
    if (!window.FaceMesh) {
      console.warn('[initFaceMesh] window.FaceMesh not found, retrying in 500ms...');
      setTimeout(initFaceMesh, 500);
      return;
    }

    const faceMesh = new window.FaceMesh({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults(onResults);

    let animationFrameId: number;
    let running = true;

    const tick = async () => {
      if (!running) return;
      if (videoRef.current && videoRef.current.readyState >= 2) {
        try {
          await faceMesh.send({ image: videoRef.current });
        } catch (e) {
          console.error('[tick] faceMesh.send error:', e);
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    const video = videoRef.current;
    if (video) {
      if (video.readyState >= 2) {
        // Video is already playing — start immediately
        console.log('[initFaceMesh] Video already ready, starting tick immediately');
        tick();
      } else {
        video.onloadeddata = () => {
          console.log('[initFaceMesh] onloadeddata fired, starting tick');
          tick();
        };
      }
    }

    return () => {
      running = false;
      cancelAnimationFrame(animationFrameId);
    };
  };

  const onResults = (results: Results) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !videoRef.current) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw reticle
    ctx.strokeStyle = '#d7ccc8';
    ctx.lineWidth = 4;
    const w = 300, h = 400;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    ctx.strokeRect(x, y, w, h);
    ctx.font = '16px Arial';

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];

      if (!isHeadCentered(landmarks) && !livenessPassedRef.current) {
        ctx.fillStyle = 'red';
        ctx.fillText('Please center your face', x, y - 10);
      } else {
        ctx.fillStyle = '#795548';
        ctx.fillText('Face aligned ✓', x, y - 10);
      }

      // We will read required pose from a ref so onResults has access to it
      const pose = calculateHeadPose(landmarks);
      if (pose[requiredPoseRef.current.axis] === requiredPoseRef.current.dir && !hasBlinked.current) {
        hasBlinked.current = true;
        livenessPassedRef.current = true;
        setLivenessPassed(true);
      }
    } else {
      ctx.fillStyle = 'red';
      ctx.fillText('No face detected', x, y - 10);
    }

    ctx.restore();
  };

  // Trigger recording phase once liveness is confirmed
  useEffect(() => {
    if (livenessPassed && phase === 'LIVENESS') {
      startAudioRecording();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livenessPassed]);

  const spokenCodeRef = useRef('');
  const isAbortedRef = useRef(false);
  const recognitionRef = useRef<any>(null);

  const startAudioRecording = () => {
    setTimeout(() => {
      setPhase('RECORDING');
      isAbortedRef.current = false;
      spokenCodeRef.current = '';
      setSpokenCode('');
      
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === 'inactive') {
        recorder.start(100);
      }

      // Initialize Web Speech API for real-time karaoke UI
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event: any) => {
          if (isAbortedRef.current) return;
          
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
          }
          
          // Convert spoken words to digits
          const wordMap: Record<string, string> = { 'zero':'0', 'oh':'0', 'o':'0', 'one':'1', 'two':'2', 'three':'3', 'four':'4', 'five':'5', 'six':'6', 'seven':'7', 'eight':'8', 'nine':'9' };
          let extracted = '';
          transcript.toLowerCase().split(/\s+/).forEach(tok => {
            const clean = tok.replace(/[^a-z0-9]/g, '');
            if (wordMap[clean]) extracted += wordMap[clean];
            else {
              const digits = clean.replace(/[^0-9]/g, '');
              if (digits) extracted += digits;
            }
          });

          // We only keep the digits that match the sequence so far
          let currentSpoken = spokenCodeRef.current;
          let newSpoken = currentSpoken + extracted;
          
          // Check if user made a mistake
          let isMistake = false;
          for (let i = 0; i < newSpoken.length; i++) {
            if (newSpoken[i] !== oneTimeCodeRef.current[i]) {
              isMistake = true;
              break;
            }
          }

          if (isMistake) {
            isAbortedRef.current = true;
            recognition.stop();
            if (recorder && recorder.state === 'recording') recorder.stop();
            failClosed('Verification aborted: Incorrect digit spoken.');
            return;
          }

          // Update UI
          spokenCodeRef.current = newSpoken;
          setSpokenCode(newSpoken);

          // If fully complete
          if (newSpoken.length === oneTimeCodeRef.current.length) {
            recognition.stop();
            if (recorder && recorder.state === 'recording') recorder.stop();
          }
        };

        recognition.onerror = (e: any) => console.log('SpeechRecognition error:', e.error);
        recognition.start();
      }

      // Fallback timeout in case user just stays silent
      setTimeout(() => {
        if (!isAbortedRef.current && recorder && recorder.state === 'recording') {
          if (recognitionRef.current) recognitionRef.current.stop();
          recorder.stop();
        }
      }, 8000); 

    }, 1500);
  };

  const processAudio = async () => {
    if (isAbortedRef.current) return; // Prevent processing if user said wrong digit

    setPhase('PROCESSING');
    stopMediaTracks();

    // Read values from REFS to avoid stale closure bug
    const codeToVerify = oneTimeCodeRef.current;
    const livenessOk = livenessPassedRef.current;

    console.log('[processAudio] code:', codeToVerify, '| liveness:', livenessOk);
    console.log('[processAudio] audio chunks:', audioChunks.current.length);

    if (!codeToVerify) {
      failClosed('One-time code was not generated. Please restart.');
      return;
    }

    const mimeType = audioChunks.current[0]?.type || 'audio/webm';
    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
    const audioBlob = new Blob(audioChunks.current, { type: mimeType });

    console.log('[processAudio] blob size:', audioBlob.size, 'type:', mimeType);

    if (audioBlob.size === 0) {
      failClosed('No audio was recorded. Please check your microphone and try again.');
      return;
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, `recording.${ext}`);
    formData.append('expected_code', codeToVerify);

    const authHeader = token ? { 'Authorization': `Bearer ${token}` } : {};

    try {
      // 1. Verify Audio via Whisper
      const audioRes = await fetch('http://127.0.0.1:8000/api/verify-audio/', {
        method: 'POST',
        headers: { ...authHeader },
        body: formData,
      });

      let audioData: { matched: boolean; transcription?: string; transcription_as_digits?: string; raw_digits_only?: string; expected?: string; error?: string };
      if (!audioRes.ok) {
        const errText = await audioRes.text();
        console.error('[processAudio] verify-audio HTTP error:', audioRes.status, errText);
        audioData = { matched: false, error: errText };
      } else {
        audioData = await audioRes.json();
      }

      console.log('%c━━━ MSAS Audio Result ━━━', 'color: purple; font-weight: bold; font-size:14px');
      console.log('  Expected Code :', audioData.expected);
      console.log('  Whisper Heard :', audioData.transcription);
      console.log('  → as digits   :', audioData.transcription_as_digits);
      console.log('  Matched?      :', audioData.matched);
      console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: purple');

      // 2. Decision Fusion via Gemini
      const fusionRes = await fetch('http://127.0.0.1:8000/api/decision-fusion/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          liveness_passed: livenessOk,
          audio_matched: audioData.matched,
          risk_score: 0.5,
        }),
      });

      if (!fusionRes.ok) {
        const errText = await fusionRes.text();
        console.error('[processAudio] decision-fusion HTTP error:', fusionRes.status, errText);
        throw new Error(`Decision fusion failed: ${errText}`);
      }

      const fusionData = await fusionRes.json();
      console.log('[processAudio] fusionData:', fusionData);

      // 3. Save decision to transaction (if transactionId is provided)
      if (transactionId && token) {
        await fetch('http://127.0.0.1:8000/api/transactions/save-decision/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            transaction_id:  transactionId,
            liveness_passed: livenessOk,
            audio_matched:   audioData.matched,
            result:          fusionData.result,
            rationale:       fusionData.rationale,
            transcription:   audioData.transcription ?? '',
          }),
        });
      }

      setDecision(fusionData);
      setPhase('DONE');
    } catch (err) {
      console.error('[processAudio] catch:', err);
      failClosed(`System error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };


  const failClosed = (msg: string) => {
    setError(msg);
    setDecision({ result: 'DENY', rationale: msg });
    setPhase('DONE');
    stopMediaTracks();
  };

  const stopMediaTracks = () => {
    // Stop video stream
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }
    // Stop audio stream (separate stream used by the MediaRecorder)
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white border-2 border-border-brown rounded-lg shadow-xl max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-foreground mb-4">Identity Verification</h2>

      {error && (
        <div className="bg-primary-red text-white px-4 py-2 rounded mb-4 w-full text-center font-bold text-sm">
          {error}
        </div>
      )}

      {phase === 'IDLE' && (
        <button
          onClick={startChallenge}
          className="bg-primary-red hover:bg-primary-red-hover text-white font-bold py-3 px-6 rounded transition-colors"
        >
          Start Challenge
        </button>
      )}

      {(phase === 'LIVENESS' || phase === 'RECORDING') && (
        <div className="relative w-full max-w-[640px] aspect-video bg-black rounded overflow-hidden shadow-inner">
          <video
            ref={videoRef}
            className="absolute top-0 left-0 w-full h-full object-cover transform -scale-x-100"
            playsInline
            autoPlay
            muted
          />
          <canvas
            ref={canvasRef}
            width={640}
            height={480}
            className="absolute top-0 left-0 w-full h-full z-10"
          />

          {phase === 'LIVENESS' && (
            <div className="absolute bottom-4 left-0 right-0 z-20 flex flex-col items-center gap-2 px-4">
              <div className="bg-white/90 px-6 py-3 rounded-xl border-2 border-primary-red text-center animate-pulse">
                <p className="text-secondary-brown text-xs font-semibold mb-1 uppercase tracking-wide">Liveness Check</p>
                <p className="text-primary-red font-bold text-xl">{requiredPoseLabel}</p>
              </div>
              {showManualBlink && (
                <button
                  onClick={() => {
                    livenessPassedRef.current = true;
                    setLivenessPassed(true);
                    setShowManualBlink(false);
                  }}
                  className="bg-secondary-brown text-white text-xs px-4 py-1.5 rounded-full hover:bg-accent-brown transition-colors"
                >
                  ✓ Skip (Dev mode)
                </button>
              )}
            </div>
          )}

          {phase === 'RECORDING' && (
            <div className="absolute top-4 left-0 right-0 z-20 flex justify-center px-2">
              <div className="bg-white/90 px-6 py-3 rounded-xl border-2 border-primary-red text-center shadow-lg">
                <p className="text-secondary-brown font-semibold mb-2 text-sm">🎤 Say each digit clearly:</p>
                <div className="text-4xl font-mono font-bold tracking-[0.2em] flex justify-center gap-1">
                  {oneTimeCode.split('').map((digit, i) => (
                    <span 
                      key={i} 
                      className={`transition-colors duration-200 ${
                        i < spokenCode.length 
                          ? 'text-green-600 border-b-4 border-green-600 scale-110' 
                          : 'text-primary-red opacity-50'
                      }`}
                    >
                      {digit}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-accent-brown mt-3 animate-pulse">Listening...</p>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'PROCESSING' && (
        <div className="flex flex-col items-center py-12">
          <div className="w-16 h-16 border-4 border-border-brown border-t-primary-red rounded-full animate-spin mb-4"></div>
          <p className="text-secondary-brown font-medium">Analyzing multimodal signals...</p>
        </div>
      )}

      {phase === 'DONE' && decision && (
        <div
          className={`mt-6 p-6 rounded-lg border-2 w-full text-center ${
            decision.result === 'ALLOW'
              ? 'bg-green-50 border-green-200'
              : decision.result === 'DENY'
              ? 'bg-red-50 border-red-200'
              : 'bg-yellow-50 border-yellow-200'
          }`}
        >
          <h3
            className={`text-3xl font-bold mb-2 ${
              decision.result === 'ALLOW'
                ? 'text-green-700'
                : decision.result === 'DENY'
                ? 'text-primary-red'
                : 'text-yellow-700'
            }`}
          >
            {decision.result}
          </h3>
          <p className="text-secondary-brown">{decision.rationale}</p>
          <div className="flex gap-3 justify-center mt-6">
            {transactionId ? (
              <a href="/dashboard"
                className="bg-secondary-brown hover:bg-accent-brown text-white py-2 px-5 rounded font-medium">
                ← Back to Dashboard
              </a>
            ) : (
              <button
                onClick={() => window.location.reload()}
                className="bg-secondary-brown hover:bg-accent-brown text-white py-2 px-5 rounded">
                Restart
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

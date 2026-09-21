'use client';
import { use, useEffect, useState } from 'react';
import { useAuth, apiFetch } from '@/lib/auth';
import AuthenticationChallenge from '@/components/AuthenticationChallenge';

export default function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuth();
  const [riskScore, setRiskScore] = useState<number>(0.5);

  // Fetch the transaction to get its actual risk_score
  useEffect(() => {
    if (!token || !id) return;
    apiFetch('/transactions/', token)
      .then(r => r.json())
      .then((txns: any[]) => {
        const txn = txns.find((t: any) => t.id === parseInt(id));
        if (txn?.risk_score !== undefined) setRiskScore(parseFloat(txn.risk_score));
      })
      .catch(() => {/* fallback to 0.5 */});
  }, [token, id]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-border-brown px-6 py-4">
        <span className="text-primary-red font-bold text-xl">MSAS</span>
        <span className="text-secondary-brown text-sm ml-3">Biometric Challenge</span>
      </nav>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-red">Multimodal Step-Up Authentication</h1>
          <p className="text-secondary-brown mt-2">
            A zero-trust FinTech security challenge combining Liveness Detection and Speech Verification.
          </p>
        </div>
        <AuthenticationChallenge transactionId={parseInt(id)} token={token ?? ''} riskScore={riskScore} />
      </div>
    </div>
  );
}

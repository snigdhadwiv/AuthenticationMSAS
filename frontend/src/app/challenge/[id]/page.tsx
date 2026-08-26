'use client';
import { use } from 'react';
import { useAuth } from '@/lib/auth';
import AuthenticationChallenge from '@/components/AuthenticationChallenge';

export default function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { token } = useAuth();

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
        <AuthenticationChallenge transactionId={parseInt(id)} token={token ?? ''} />
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Check, IdCard } from 'lucide-react';
import { IDKit, identityCheck, type IDKitResult } from '@worldcoin/idkit';
import { AliveCta } from '@/app/components/agent/AliveCta';

type TestState = 'idle' | 'starting' | 'verifying' | 'complete' | 'failed';
type SignatureResponse = {
  appId: `app_${string}`;
  action: string;
  rpContext: {
    rp_id: string;
    nonce: string;
    created_at: number;
    expires_at: number;
    signature: string;
  };
};

const AGE = 18;

export function IdentityCheckTestClient() {
  const [state, setState] = useState<TestState>('idle');
  const [result, setResult] = useState<IDKitResult | null>(null);
  const [verification, setVerification] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setState('starting');
    setResult(null);
    setVerification(null);
    setError(null);

    try {
      const signatureResponse = await fetch('/api/test/identity_check/signature', { method: 'POST' });
      const signature = (await signatureResponse.json()) as SignatureResponse | { error: string };
      if (!signatureResponse.ok || !('rpContext' in signature)) {
        throw new Error('error' in signature ? signature.error : 'Could not create RP context');
      }

      setState('verifying');
      const request = await IDKit.request({
        app_id: signature.appId,
        action: signature.action,
        rp_context: signature.rpContext,
        allow_legacy_proofs: false,
        require_user_presence: true,
      }).preset(identityCheck({ attributes: [{ type: 'minimum_age', value: AGE }] }));
      const completed = await request.pollUntilCompletion();
      if (!completed.success) throw new Error(`World ID Identity Check failed: ${completed.error}`);

      setResult(completed.result);
      const verifyResponse = await fetch('/api/test/identity_check/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completed.result),
      });
      const verified = (await verifyResponse.json()) as { verification?: unknown; error?: string };
      if (!verifyResponse.ok) throw new Error(verified.error ?? 'Server verification failed');
      setVerification(verified.verification);
      setState('complete');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Identity Check failed';
      console.error('[identity-check] failed', caught);
      setError(message);
      setState('failed');
    }
  };

  return (
    <main className="min-h-screen bg-[#171512] px-5 py-12 text-[#f3eadb]">
      <section className="mx-auto max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-400">Development test</p>
        <h1 className="mt-3 font-serif text-4xl italic">World ID age check</h1>
        <p className="mt-4 text-sm leading-6 text-[#b9ad9b]">
          Requests a World ID 4.0 identity attestation for minimum age {AGE}, then verifies the proof on the server.
        </p>

        <AliveCta onClick={run} disabled={state === 'starting' || state === 'verifying'} className="mt-8 w-full rounded-full px-6 py-4 text-xs tracking-[0.18em]">
          {state === 'starting' ? 'Preparing check' : state === 'verifying' ? 'Opening World ID' : 'Check age over 18'}
        </AliveCta>

        <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">Status</span>
            <span className="font-mono text-xs text-amber-300">{state}</span>
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10">
              {state === 'complete' ? <Check size={16} className="text-emerald-300" /> : <IdCard size={16} className="text-amber-300" />}
            </div>
            <div className="min-w-0 font-mono text-xs">
              <p>preset: IdentityCheck</p>
              <p className="mt-1 text-[#b9ad9b]">attribute: minimum_age = {AGE}</p>
              <p className="mt-1 text-[#8f8372]">proof: World ID 4.0 only</p>
            </div>
          </div>
          {error && <p className="mt-5 break-words text-sm text-red-400">{error}</p>}
          {result && (
            <pre className="mt-5 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 font-mono text-xs text-[#b9ad9b]">
              {JSON.stringify({ protocol_version: result.protocol_version, identity_attested: 'identity_attested' in result ? result.identity_attested : null, responses: result.responses }, null, 2)}
            </pre>
          )}
          {verification !== null && (
            <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-xs text-[#b9ad9b]">
              {JSON.stringify(verification, null, 2)}
            </pre>
          )}
        </div>
      </section>
    </main>
  );
}

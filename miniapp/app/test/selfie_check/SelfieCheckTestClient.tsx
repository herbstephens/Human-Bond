'use client';

import { useState } from 'react';
import { Check, ScanFace } from 'lucide-react';
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';
import { AliveCta } from '@/app/components/agent/AliveCta';
import { useAgentStore } from '@/lib/agent/agentStore';
import { useMarriage } from '@/lib/marriage/context';
import { WORLD_APP_CONFIG } from '@/lib/contracts';
import { isInWorldApp } from '@/lib/worldcoin/initMiniKit';

type TestState = 'idle' | 'verifying' | 'complete' | 'failed';

type SelfieResult = {
  merkleRoot: string;
  nullifierHash: string;
  proof: string;
  verificationLevel?: string;
  signal: string;
};

const SELFIE_ACTION = 'humanbond-propose-selfie';

function short(value: string): string {
  return `${value.slice(0, 18)}...${value.slice(-10)}`;
}

export function SelfieCheckTestClient() {
  const { address } = useMarriage();
  const heartbeatOk = useAgentStore((s) => s.heartbeatOk);
  const heartbeatDaysLeft = useAgentStore((s) => s.heartbeatDaysLeft);
  const [state, setState] = useState<TestState>('idle');
  const [result, setResult] = useState<SelfieResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);

  const log = (message: string) =>
    setEvents((current) => [...current, `${new Date().toLocaleTimeString()} - ${message}`]);

  const run = async () => {
    setState('verifying');
    setResult(null);
    setError(null);
    setEvents([]);
    log('Starting World ID Selfie Check');

    try {
      if (!isInWorldApp()) {
        throw new Error('Open this test inside World App to run MiniKit Selfie Check');
      }
      const signal = `humanbond-selfie-heartbeat:${address ?? 'test-wallet'}`;
      const { finalPayload } = await MiniKit.commandsAsync.verify({
        action: SELFIE_ACTION,
        signal,
        verification_level: VerificationLevel.Device,
      });
      if (finalPayload.status === 'error') {
        const diagnostic = `World App error: ${finalPayload.error_code} (action=${SELFIE_ACTION}, requested_level=${VerificationLevel.Device})`;
        console.error('[selfie-check] World ID verification failed', {
          error_code: finalPayload.error_code,
          action: SELFIE_ACTION,
          requested_level: VerificationLevel.Device,
        });
        log(diagnostic);
        throw new Error(`World ID Selfie Check failed: ${finalPayload.error_code}`);
      }

      setResult({
        merkleRoot: finalPayload.merkle_root,
        nullifierHash: finalPayload.nullifier_hash,
        proof: finalPayload.proof,
        verificationLevel: finalPayload.verification_level,
        signal,
      });
      useAgentStore.getState().heartbeatChecked();
      log('World ID Selfie Check returned a proof');
      log('Heartbeat reset in the local agent store');
      setState('complete');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Selfie Check failed';
      setError(message);
      log(`FAILED: ${message}`);
      setState('failed');
    }
  };

  return (
    <main className="min-h-screen bg-[#171512] px-5 py-12 text-[#f3eadb]">
      <section className="mx-auto max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-400">
          Development test
        </p>
        <h1 className="mt-3 font-serif text-4xl italic">World ID Selfie Check</h1>
        <p className="mt-4 text-sm leading-6 text-[#b9ad9b]">
          Runs MiniKit verify with the Selfie Check action and resets the proof-of-life heartbeat.
        </p>

        <AliveCta
          onClick={run}
          disabled={state === 'verifying'}
          className="mt-8 w-full rounded-full px-6 py-4 text-xs tracking-[0.18em]"
        >
          {state === 'verifying' ? 'Opening World ID' : 'Run Selfie Check'}
        </AliveCta>

        <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
              Status
            </span>
            <span className="font-mono text-xs text-amber-300">{state}</span>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
              Verification
            </p>
            <div className="mt-3 flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10">
                {state === 'complete' ? (
                  <Check size={16} className="text-emerald-300" />
                ) : (
                  <ScanFace size={16} className="text-amber-300" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-mono text-xs text-[#f3eadb]">action: {SELFIE_ACTION}</p>
                <p className="mt-1 font-mono text-xs text-[#b9ad9b]">
                  app: {WORLD_APP_CONFIG.APP_ID} · level: device
                </p>
                <p className="mt-1 break-all font-mono text-xs text-[#8f8372]">
                  signal: humanbond-selfie-heartbeat:{address ?? 'test-wallet'}
                </p>
              </div>
            </div>
          </div>

          {error && <p className="mt-5 break-words text-sm text-red-400">{error}</p>}

          {result && (
            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">
                Proof returned
              </p>
              <dl className="mt-3 space-y-2 font-mono text-xs text-[#b9ad9b]">
                <div>
                  <dt className="text-[#8f8372]">merkle_root</dt>
                  <dd className="break-all">{short(result.merkleRoot)}</dd>
                </div>
                <div>
                  <dt className="text-[#8f8372]">nullifier_hash</dt>
                  <dd className="break-all">{short(result.nullifierHash)}</dd>
                </div>
                <div>
                  <dt className="text-[#8f8372]">proof bytes</dt>
                  <dd>{result.proof.length}</dd>
                </div>
              </dl>
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
              Local heartbeat
            </p>
            <p className="mt-2 text-sm font-semibold text-[#f3eadb]">
              {heartbeatOk ? 'proof of life verified' : 'not verified in this session'}
            </p>
            <p className="mt-1 font-mono text-xs text-[#b9ad9b]">{heartbeatDaysLeft} days left</p>
          </div>

          <ol className="mt-6 space-y-2 border-t border-white/10 pt-5">
            {events.length === 0 ? (
              <li className="font-mono text-xs text-[#6f665a]">No test started.</li>
            ) : (
              events.map((event, index) => (
                <li key={`${index}-${event}`} className="font-mono text-xs text-[#b9ad9b]">
                  {event}
                </li>
              ))
            )}
          </ol>
        </div>
      </section>
    </main>
  );
}

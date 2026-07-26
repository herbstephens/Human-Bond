'use client';

import { useState } from 'react';
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';
import { solidityEncode } from '@worldcoin/idkit-core/hashing';
import { AliveCta } from '@/app/components/agent/AliveCta';

type StartResult = {
  agentAddress: `0x${string}`;
  nonce: string;
  appId: `app_${string}`;
  action: string;
};

type CompleteResult = {
  agentAddress: `0x${string}`;
  txHash: `0x${string}`;
  registered: true;
  humanBacked: true;
};

type TestState = 'idle' | 'starting' | 'verifying' | 'registering' | 'complete' | 'failed';

async function responseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    // The routes answer failures as { error }. Unwrap it so the phone shows the
    // real reason (relay/contract message) instead of a bare status code.
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) detail = parsed.error;
    } catch {
      // Not JSON — the raw text is already the best available detail.
    }
    throw new Error(detail || `Request failed with HTTP ${response.status}`);
  }
  return JSON.parse(text) as T;
}

export function TestAgentCreateClient() {
  const [state, setState] = useState<TestState>('idle');
  const [agentAddress, setAgentAddress] = useState<`0x${string}` | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const log = (message: string) =>
    setEvents((current) => [...current, `${new Date().toLocaleTimeString()} — ${message}`]);

  const run = async () => {
    setState('starting');
    setAgentAddress(null);
    setTxHash(null);
    setEvents([]);
    setError(null);
    log('Creating and encrypting a fresh agent key');

    try {
      const start = await responseJson<StartResult>(
        await fetch('/api/agent/activate/start', { method: 'POST' }),
      );
      setAgentAddress(start.agentAddress);
      log(`Encrypted key stored in 0G KV for ${start.agentAddress}`);

      setState('verifying');
      log('Requesting World ID verification through MiniKit');
      const { finalPayload } = await MiniKit.commandsAsync.verify({
        action: start.action,
        signal: solidityEncode(
          ['address', 'uint256'],
          [start.agentAddress, BigInt(start.nonce)],
        ),
        verification_level: VerificationLevel.Orb,
      });
      if (finalPayload.status === 'error') {
        throw new Error(`World ID verification failed: ${finalPayload.error_code}`);
      }

      setState('registering');
      log('Proof received; submitting AgentKit registration');
      const completed = await responseJson<CompleteResult>(
        await fetch('/api/agent/activate/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentAddress: start.agentAddress,
            nonce: start.nonce,
            merkleRoot: finalPayload.merkle_root,
            nullifierHash: finalPayload.nullifier_hash,
            proof: finalPayload.proof,
          }),
        }),
      );

      setTxHash(completed.txHash);
      setState('complete');
      log('AgentBook confirmed the agent is human-backed');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Agent activation failed';
      setState('failed');
      setError(message);
      log(`FAILED: ${message}`);
    }
  };

  const busy = state === 'starting' || state === 'verifying' || state === 'registering';

  return (
    <main className="min-h-screen bg-[#171512] text-[#f3eadb] px-5 py-12">
      <section className="mx-auto max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-400">
          Development test
        </p>
        <h1 className="mt-3 font-serif text-4xl italic">Activate a human-backed agent</h1>
        <p className="mt-4 text-sm leading-6 text-[#b9ad9b]">
          This runs the real 0G KV, World ID, AgentKit relay, and AgentBook flow.
          Every click creates a new agent wallet.
        </p>

        <AliveCta
          onClick={run}
          disabled={busy}
          className="mt-8 w-full rounded-full px-6 py-4 text-xs tracking-[0.18em]"
        >
          {busy ? state : 'Create test agent'}
        </AliveCta>

        <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
              Status
            </span>
            <span className="font-mono text-xs text-amber-300">{state}</span>
          </div>

          {agentAddress && (
            <div className="mt-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
                Agent address
              </p>
              <p className="mt-1 break-all font-mono text-xs">{agentAddress}</p>
            </div>
          )}

          {txHash && (
            <div className="mt-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#8f8372]">
                Registration transaction
              </p>
              <p className="mt-1 break-all font-mono text-xs">{txHash}</p>
            </div>
          )}

          {error && <p className="mt-5 break-words text-sm text-red-400">{error}</p>}

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

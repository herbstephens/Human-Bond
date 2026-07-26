'use client';

/**
 * First version of the live negotiation room on the bond page.
 *
 * You name a shared expense; the two agents actually negotiate it (real engine,
 * real memory) and the thread + split render here. Profiles + charter are seeded
 * on mount so it runs in the browser today — the live wiring swaps the seeds for
 * the real onboarding profile + the two bond wallets.
 */
import { useCallback, useEffect, useState } from 'react';
import { META } from '@/lib/design';
import { AliveCta } from '@/app/components/agent/AliveCta';
import type { CaseRecord } from '@/lib/agents/case';

// Demo identities for the first version (mock). Live passes the real wallets.
const ME_ADDR = '0x0e1246D10fe4bc96cf5269FF7E53bC9F0cC89ecA';
const PARTNER_ADDR = '0xf8CA23b7913a5c64812EF2271c62E624c7B1a6e3';
const agentId = (human: string) => `agent-${human.toLowerCase().replace(/\s+/g, '-')}`;
const humanOf = (aid: string) => aid.replace(/^agent-/, '').replace(/-/g, ' ');

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `${url} ${res.status}`);
  return json;
}

export function NegotiationRoom({ bondId, myName, partnerName }: { bondId: string; myName: string; partnerName: string }) {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [memo, setMemo] = useState('');
  const [label, setLabel] = useState('Dinner at Ramiro');
  const [amount, setAmount] = useState('120');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myAgent = agentId(myName);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/agent/case?bondId=${bondId}`);
    const json = await res.json();
    setCases(json.cases ?? []);
  }, [bondId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      // Seed both profiles + the charter so a negotiation can load them.
      await Promise.all([
        postJson('/api/agent/profile', {
          address: ME_ADDR,
          profile: { human: myName, monthlyIncomeUsdc: 2000, protectedBudgetUsdc: 300, hitoThresholdUsdc: 200, facts: ['Protects the holiday fund'] },
        }),
        postJson('/api/agent/profile', {
          address: PARTNER_ADDR,
          profile: { human: partnerName, monthlyIncomeUsdc: 8000, protectedBudgetUsdc: 500, hitoThresholdUsdc: 500, facts: ['High earner, long-term minded'] },
        }),
        postJson('/api/agent/charter', {
          bondId, partners: [myName, partnerName], splitRule: 'by-income', jointHitoThresholdUsdc: 200, heirs: [],
        }),
      ]);
      if (!alive) return;
      setReady(true);
      await refresh();
    })().catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [bondId, myName, partnerName, refresh]);

  const openCase = async () => {
    const amt = Number(amount);
    if (!label.trim() || !amt || amt <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const json = await postJson('/api/agent/case', {
        bondId,
        request: { label: label.trim(), recipient: 'recipient.eth', amountUsdc: amt },
        a: { address: ME_ADDR },
        b: { address: PARTNER_ADDR },
      });
      setMemo(json.bondMemo ?? memo);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-2xl font-anton text-black tracking-wide">NEGOTIATION ROOM</h2>
        <p className={`${META} mt-0.5`}>Your agents settle shared money here — live</p>
      </div>

      {/* Trigger */}
      <div className="bg-white rounded-2xl p-4 space-y-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="A shared expense — e.g. dinner, groceries, tickets"
          className="w-full bg-gray-50 rounded-xl px-4 py-3 text-[13px] text-gray-800 font-medium placeholder:text-gray-300 outline-none"
        />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl px-4 py-3">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              className="w-16 bg-transparent text-[13px] font-black font-mono text-gray-800 outline-none"
            />
            <span className={META}>USDC</span>
          </div>
          <AliveCta
            glow={false}
            disabled={busy || !ready}
            onClick={openCase}
            className="flex-1 px-5 py-3 rounded-xl text-[11px] tracking-[0.15em]"
          >
            {busy ? 'Agents negotiating…' : ready ? 'Ask your agents' : 'Preparing…'}
          </AliveCta>
        </div>
        {error && <p className={`${META} text-red-500`}>{error}</p>}
      </div>

      {memo && (
        <p className={`${META} px-1`}>
          Learned: <span className="text-gray-500">{memo}</span>
        </p>
      )}

      {/* Threads — newest first */}
      {cases.map((c) => (
        <div key={c.caseId} className="bg-white rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-anton text-[11px] text-gray-700 uppercase tracking-wide">{c.request.label}</h3>
            <p className={META}>{Math.round(c.request.amountUsdc)} USDC</p>
          </div>

          <div className="space-y-2">
            {c.transcript.messages.map((m, i) => {
              const mine = m.from === myAgent;
              return (
                <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-gray-900 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'}`}>
                    <p className={`${META} ${mine ? 'text-gray-400' : 'text-gray-400'}`}>{humanOf(m.from)}&apos;s agent</p>
                    <p className="text-[13px] font-medium leading-snug mt-0.5">{m.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
            <p className={META}>Settled</p>
            <p className="font-anton text-[11px] text-gray-700 uppercase tracking-wide">
              {Object.entries(c.settlement.shares)
                .map(([aid, usdc]) => `${humanOf(aid)} ${Math.round(Number(usdc))}`)
                .join(' · ')}{' '}
              <span className={META}>USDC</span>
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}

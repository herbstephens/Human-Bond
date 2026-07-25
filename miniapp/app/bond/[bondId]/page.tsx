/**
 * S-A5: Bond profile — a small bank dashboard in crypto terms.
 *
 * The trustee is PROACTIVE: it consults both personal agents against their
 * profiles, scans the market, and when the agents agree something fits, the
 * humans get a push-style OPPORTUNITY card — never a survey. Rules live at
 * the bottom (settings). Will entries need both partners' release.
 */
'use client';

import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowUp, Bell, Check, Landmark, MessageCircle, X } from 'lucide-react';
import { AliveCta } from '@/app/components/agent/AliveCta';
import { useAgentStore, type Heir } from '@/lib/agent/agentStore';
import { USE_MOCKS } from '@/lib/config';
import { useLiveBondSync } from '@/lib/agent/useLiveBondSync';
import { useMarriage } from '@/lib/marriage/context';
import { useBondVault } from '@/lib/hooks/useBondVault';
import { useVaultActions } from '@/lib/hooks/useVaultActions';
import { VaultBalanceCard } from '@/app/components/vault/VaultBalanceCard';
import { SendFundsForm } from '@/app/components/vault/SendFundsForm';

// --- tiny self-contained chat for the trustee room ------------------------

type RoomMsg = { id: number; who: 'trustee' | 'you'; text: string; typed?: boolean };
let rid = 1;

function TypeOnce({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) return;
    const t = setTimeout(() => setN((v) => v + 1), 16);
    return () => clearTimeout(t);
  }, [n, text.length]);
  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="inline-block w-[2px] h-[1em] bg-gray-400 align-middle ml-0.5 animate-pulse" />}
    </>
  );
}

type YieldState = 'none' | 'proposed' | 'you-ok' | 'done';
/** A vault action the LIVE trustee flagged — walks the same dual-hito release as the scripted card. */
type LiveAction = { kind: 'divest' | 'invest'; amount: number; apr: number; stage: 'proposed' | 'you-ok' | 'done' };

export default function BondProfilePage() {
  const router = useRouter();
  // Live mode: mirror the real bond (partner, ENS, on-chain USDC balance) into
  // the store — this page then renders chain truth, starting at zero.
  useLiveBondSync();
  // Live money view: Franco's working vault card (balance · address · send),
  // backed by the same react-query key the sync uses — one chain read.
  const { dashboard: liveDash, marriageView } = useMarriage();
  const livePartnerAddr = (liveDash?.partner ?? null) as `0x${string}` | null;
  const lPartnerA = (marriageView?.partnerA ?? null) as `0x${string}` | null;
  const lPartnerB = (marriageView?.partnerB ?? null) as `0x${string}` | null;
  const lBondId = (marriageView?.bondId ?? null) as `0x${string}` | null;
  const { vault: liveVault, refetch: refetchLiveVault } = useBondVault(lPartnerA, lPartnerB, lBondId);
  const [sendOpen, setSendOpen] = useState(false);
  const {
    state: spendState, error: spendError, txError: spendTxError, proposeSpend, reset: resetSpend,
  } = useVaultActions({
    bondId: lBondId,
    partnerA: lPartnerA,
    partnerB: lPartnerB,
    partner: livePartnerAddr,
    onDone: () => void refetchLiveVault(),
  });
  const params = useParams<{ bondId: string }>();
  const {
    agentReady, answers, payments, heirs, addHeir, requestRemoveHeir,
    vaultBalances, deposits, standingOrders, deposit, setStandingOrder, bondEnsLabel,
    investments, invest, bonds, bondRules, addBondRule, removeBondRule,
  } = useAgentStore();
  const bond = bonds.find((b) => b.id === params.bondId) ?? bonds[0];
  const isInheritance = bond.type === 'inheritance';
  const balance = vaultBalances[bond.id] ?? 0;
  const invested = investments[bond.id];
  const liquid = balance - (invested?.amount ?? 0);

  const [msgs, setMsgs] = useState<RoomMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [yieldState, setYieldState] = useState<YieldState>(() => (invested ? 'done' : 'none'));
  const [liveAction, setLiveAction] = useState<LiveAction | null>(null);
  const [heirName, setHeirName] = useState('');
  const [heirShare, setHeirShare] = useState(100);
  const [confirmRemove, setConfirmRemove] = useState<Heir | null>(null);
  const [panel, setPanel] = useState<'none' | 'deposit' | 'order'>('none');
  const [ruleDraft, setRuleDraft] = useState('');
  const [depositAmount, setDepositAmount] = useState('250');
  const [orderAmount, setOrderAmount] = useState(String(standingOrders[bond.id] ?? 0));
  const endRef = useRef<HTMLDivElement>(null);
  const greeted = useRef(false);
  const rogueShown = useRef(false);
  // Floating "ask the trustee" pill: shown only while the inline chat input is
  // scrolled out of view — tap scrolls back and focuses the field.
  const chatBarRef = useRef<HTMLDivElement>(null);
  const chatFieldRef = useRef<HTMLInputElement>(null);
  const [chatBarVisible, setChatBarVisible] = useState(true);

  useEffect(() => {
    if (!agentReady) router.replace('/home');
  }, [agentReady, router]);

  // PROACTIVE: the trustee consulted both agents overnight — the humans get
  // an opportunity, not a question. Intro line, then the push-style card.
  useEffect(() => {
    if (!agentReady || greeted.current || !isInheritance) return;
    greeted.current = true;
    setBusy(true);
    const alreadyInvested = Boolean(invested);
    const t1 = setTimeout(() => {
      setMsgs([
        {
          id: rid++,
          who: 'trustee',
          text: !USE_MOCKS
            ? `This vault is live on Worldchain — ${balance.toFixed(2)} USDC in it right now. Send USDC to your bond address and it shows up here; ask me for a live market quote anytime.`
            : alreadyInvested
              ? `All quiet. The ${invested!.amount.toFixed(0)} your agents placed are earning at ${invested!.apr}% — projection on track, buffer untouched. I’ll report at month’s end.`
              : 'Your agents and I settled on one package this morning — matched to both profiles, market-checked. It’s on its way to both of you now.',
          typed: true,
        },
      ]);
      setBusy(false);
    }, 700);
    const t2 = USE_MOCKS && !alreadyInvested ? setTimeout(() => setYieldState('proposed'), 2600) : undefined;
    return () => {
      // StrictMode runs effects twice — release the guard so the re-run reschedules.
      greeted.current = false;
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentReady, isInheritance]);

  useEffect(() => {
    const el = chatBarRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => setChatBarVisible(entry.isIntersecting));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Scroll only within reach of the chat — never yank the page to the bottom.
  useEffect(() => {
    if (msgs.length === 0) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [msgs, yieldState, liveAction, busy]);

  if (!agentReady) return null;

  const threshold = answers.threshold?.id === 't50' ? '€50' : answers.threshold?.id === 'unusual' ? 'unusual only' : '€200';

  const pushTrustee = (text: string, after?: () => void) => {
    setBusy(true);
    setTimeout(() => {
      setMsgs((m) => [...m, { id: rid++, who: 'trustee', text, typed: true }]);
      setBusy(false);
      if (after) setTimeout(after, text.length * 16 + 800);
    }, 800);
  };

  const releaseYield = () => {
    setYieldState('you-ok');
    setTimeout(() => {
      setYieldState('done');
      invest(bond.id, 800, 4.1);
      pushTrustee('Alice confirmed too. 800 USDC are earning for the family now — you can see where the money lives right up on the vault card. I’ll report monthly.');
    }, 2600);
  };

  /** The model flagged a vault action → AgentKit door policy first, then the
   *  release track. Amounts are clamped against live store state; the mutation
   *  itself only runs after BOTH hito releases in releaseLiveAction — chat is
   *  model, money is protocol, and only human-backed agents get past the door. */
  const runTrusteeAction = (a: unknown) => {
    const act = a as { type?: string; amountUsdc?: number; aprPct?: number } | null;
    if (!act || (act.type !== 'divest' && act.type !== 'invest')) return;
    if (!USE_MOCKS) {
      // No on-chain yield rail yet: live mode quotes and reports, execution
      // from the Safe is Mischa's wiring — never fake a live investment.
      pushTrustee('On-chain execution from the Safe is still being wired — until it lands I quote and report only. Ask me for a live Uniswap quote.');
      return;
    }
    if (typeof act.amountUsdc !== 'number' || act.amountUsdc <= 0) return;
    const st = useAgentStore.getState();
    const inv = st.investments[bond.id];
    const liq = (st.vaultBalances[bond.id] ?? 0) - (inv?.amount ?? 0);
    if (act.type === 'divest' && !inv) {
      pushTrustee('Nothing is invested right now — the whole vault already sits liquid.');
      return;
    }
    if (act.type === 'invest' && liq <= 0) {
      pushTrustee('There is nothing liquid to invest right now — the vault is fully deployed.');
      return;
    }
    // LIVE World AgentKit check: both personal agents must be human-backed in
    // AgentBook (World Chain) before anything reaches the release track.
    const myName = answers.name?.text?.replace(/^just call me /i, '') || 'Ben';
    const seeds = [myName.toLowerCase(), bond.partner.toLowerCase()];
    setBusy(true);
    fetch('/api/agent/verify-backing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seeds }),
    })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? `verify-backing ${res.status}`);
        setBusy(false);
        const [mine, theirs] = j.agents as { seed: string; address: string; backed: boolean }[];
        if (!mine.backed || !theirs.backed) {
          const failed = [!mine.backed ? `${myName}’s agent (${mine.address.slice(0, 6)}…)` : null, !theirs.backed ? `${bond.partner}’s agent (${theirs.address.slice(0, 6)}…)` : null]
            .filter(Boolean)
            .join(' and ');
          pushTrustee(
            `AgentBook check failed: ${failed} carries no verified human. I don’t put unbacked proposals on the release track — register the agent wallet with World AgentKit first.`,
          );
          return;
        }
        pushTrustee(
          `AgentBook check (World Chain): ${myName}’s agent ✓ human-backed · ${bond.partner}’s agent ✓ human-backed — ${j.distinctHumans ? 'two distinct humans' : 'WARNING: same human behind both'}. Putting it on the release track.`,
          () => {
            if (act.type === 'divest' && inv) {
              setLiveAction({ kind: 'divest', amount: Math.min(act.amountUsdc!, inv.amount), apr: inv.apr, stage: 'proposed' });
            } else {
              setLiveAction({ kind: 'invest', amount: Math.min(act.amountUsdc!, liq), apr: act.aprPct ?? 4.1, stage: 'proposed' });
            }
          },
        );
      })
      .catch((e: Error) => {
        setBusy(false);
        pushTrustee(`AgentBook lookup broke on my side: ${e.message}`);
      });
  };

  /** Once per visit, right after an execution: an unknown agent knocks and is
   *  refused — the same LIVE AgentBook lookup, answering null. The door works. */
  const maybeRogueBeat = () => {
    if (rogueShown.current) return;
    rogueShown.current = true;
    fetch('/api/agent/verify-backing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seeds: ['rogue'] }),
    })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? `verify-backing ${res.status}`);
        const rogue = j.agents[0] as { address: string; backed: boolean };
        if (rogue.backed) return; // someone registered the rogue — then there is no story to tell
        pushTrustee(
          `One more thing: while we settled, an unknown agent (${rogue.address.slice(0, 6)}…${rogue.address.slice(-4)}) proposed a 400 USDC transfer out of this vault. AgentBook lookup: no verified human behind it. Refused at the door — bots don’t get a seat at this table.`,
        );
      })
      .catch(() => {
        rogueShown.current = false; // lookup failed — try again after the next execution
      });
  };

  /** Dual-hito walk for a live action: you → partner → executed → store mutation. */
  const releaseLiveAction = () => {
    const la = liveAction;
    if (!la || la.stage !== 'proposed') return;
    setLiveAction({ ...la, stage: 'you-ok' });
    setTimeout(() => {
      setLiveAction({ ...la, stage: 'done' });
      const st = useAgentStore.getState();
      const inv = st.investments[bond.id];
      if (la.kind === 'divest') {
        st.divest(bond.id, la.amount);
        if (inv && la.amount >= inv.amount) setYieldState('none');
        pushTrustee(
          `Executed. ${la.amount.toFixed(0)} USDC are out of the yield package and sit liquid in the vault again — the vault card is current. Settlement logged; you both hold the receipt.`,
          maybeRogueBeat,
        );
      } else {
        st.invest(bond.id, (inv?.amount ?? 0) + la.amount, la.apr);
        setYieldState('done');
        pushTrustee(
          `Executed. ${la.amount.toFixed(0)} USDC moved into the yield vault at ${la.apr}% — projection updates on the vault card. Settlement logged for both of you.`,
          maybeRogueBeat,
        );
      }
    }, 1500);
  };

  const submitDraft = () => {
    const text = draft.trim();
    if (!text) return;
    const history = msgs.slice(-10).map((m) => ({ role: m.who === 'you' ? ('user' as const) : ('assistant' as const), text: m.text }));
    setMsgs((m) => [...m, { id: rid++, who: 'you', text }]);
    setDraft('');
    setBusy(true);
    const st = useAgentStore.getState();
    fetch('/api/agent/trustee', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        live: !USE_MOCKS,
        humanName: answers.name?.text?.replace(/^just call me /i, '') || 'Ben',
        partner: bond.partner,
        bondType: bond.type,
        vaultBalanceUsdc: st.vaultBalances[bond.id] ?? 0,
        investedUsdc: st.investments[bond.id]?.amount ?? 0,
        investedAprPct: st.investments[bond.id]?.apr ?? null,
        rules: st.bondRules.filter((r) => r.status === 'active').map((r) => r.text),
        heirs: st.heirs.map((h) => ({ name: h.name, sharePct: h.sharePct })),
        history,
        userText: text,
      }),
    })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? `trustee API ${res.status}`);
        setBusy(false);
        pushTrustee(j.say, () => runTrusteeAction(j.action));
      })
      .catch((e: Error) => {
        setBusy(false);
        pushTrustee(`Something broke on my side: ${e.message}`);
      });
  };

  // The will can never allocate more than 100% of the estate.
  const allocatedPct = heirs.reduce((sum, h) => sum + h.sharePct, 0);
  const remainingPct = 100 - allocatedPct;
  const effectiveShare = Math.min(heirShare, remainingPct);

  const submitHeir = () => {
    const name = heirName.trim();
    if (!name || remainingPct < 5) return;
    addHeir(name, effectiveShare);
    setHeirName('');
  };

  const submitRule = () => {
    const text = ruleDraft.trim();
    if (!text) return;
    addBondRule(text);
    setRuleDraft('');
  };

  const activity = [
    ...deposits
      .filter((d) => d.bondId === bond.id)
      .map((d) => ({ id: d.id, text: `Deposit — ${d.amount.toFixed(2)} from you`, tag: 'Deposit' })),
    ...Object.values(payments)
      .filter((p) => p.stage === 'paid' && !p.personal)
      .map((p) => ({ id: p.id, text: `${p.label} — ${p.amountUsdc.toFixed(2)} to ${p.recipientEns}`, tag: 'Agent payment' })),
    ...((standingOrders[bond.id] ?? 0) > 0
      ? [{ id: 'so-1', text: `Standing order — ${(standingOrders[bond.id] ?? 0).toFixed(2)} from you, monthly`, tag: 'Standing order' }]
      : []),
    { id: 'so-2', text: 'Standing order — 500.00 from Alice, monthly', tag: 'Standing order' },
  ];

  const submitDeposit = () => {
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) return;
    deposit(bond.id, amount);
    setPanel('none');
  };

  const submitOrder = () => {
    const amount = Number(orderAmount);
    if (Number.isNaN(amount) || amount < 0) return;
    setStandingOrder(bond.id, amount);
    setPanel('none');
  };

  return (
    <div className="min-h-screen bg-[#E8E8E8] flex flex-col">
      {/* Header */}
      <header className="px-6 pt-4 pb-4 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-black text-gray-900 tracking-tight">You &amp; {bond.partner}</h1>
          <p className="text-[9px] font-bold uppercase tracking-[0.25em]">
            <span className={isInheritance ? 'text-amber-600' : 'text-gray-400'}>
              {isInheritance ? 'Inheritance bond · your estate flows here' : 'Business bond'}
            </span>
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-16 space-y-8 max-w-lg w-full mx-auto">
        {/* Money view. LIVE: the real vault card — balance from chain, bond
            address with copy, real send flow (partner approves above the free
            limit). MOCK: the dark playground bank card below. */}
        {!USE_MOCKS && liveVault?.isCreated ? (
          <section className="space-y-3">
            <VaultBalanceCard vault={liveVault} partnerName={bond.partner} onSend={() => setSendOpen(true)} />
            <SendFundsForm
              open={sendOpen}
              onOpenChange={setSendOpen}
              vault={liveVault}
              partnerName={bond.partner}
              txState={spendState}
              error={spendError}
              txError={spendTxError}
              onSend={proposeSpend}
              onReset={resetSpend}
            />
          </section>
        ) : (
        <section className="bg-[#1A1A1A] rounded-[2rem] p-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/10 blur-[50px]" />
          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.25em] relative z-10">Parked in the vault</p>
          <p className="text-4xl font-black text-white font-mono tracking-tight mt-1 relative z-10">
            {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            <span className="text-sm text-gray-500 ml-2">USDC</span>
          </p>
          {/* Where the money lives — simple and unmissable */}
          {invested && (
            <div className="mt-3 flex gap-2 relative z-10">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Liquid · ready to spend</p>
                <p className="text-sm font-black text-white font-mono">{liquid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="flex-1 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-4 py-2.5">
                <p className="text-[8px] font-black text-emerald-400/80 uppercase tracking-widest flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-400" />
                  Earning · {invested.apr}%
                </p>
                <p className="text-sm font-black text-emerald-300 font-mono">
                  {invested.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Receive · give this to anyone</p>
              <p className="text-[12px] font-mono font-bold text-amber-100">
                {bondEnsLabel ?? `ben-${bond.partner.toLowerCase()}`}.humanbond.eth
              </p>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">fed by standing orders</span>
          </div>
          {/* Money in: the mock playground simulates transfers; live money
              arrives by sending USDC to the address above — no fake deposits. */}
          {USE_MOCKS && (
          <div className="mt-4 flex gap-2 relative z-10">
            <button
              onClick={() => setPanel(panel === 'deposit' ? 'none' : 'deposit')}
              className={`flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] border transition-all ${
                panel === 'deposit' ? 'bg-white text-black border-white' : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
              }`}
            >
              Add money
            </button>
            <button
              onClick={() => setPanel(panel === 'order' ? 'none' : 'order')}
              className={`flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] border transition-all ${
                panel === 'order' ? 'bg-white text-black border-white' : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
              }`}
            >
              Standing order{(standingOrders[bond.id] ?? 0) > 0 ? ` · ${standingOrders[bond.id]}/mo` : ''}
            </button>
          </div>
          )}
          {panel !== 'none' && (
            <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 relative z-10 animate-in fade-in duration-300">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                {panel === 'deposit' ? 'One-time transfer from your wallet' : 'Monthly, from your wallet — cancel anytime'}
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={panel === 'deposit' ? depositAmount : orderAmount}
                  onChange={(e) =>
                    panel === 'deposit' ? setDepositAmount(e.target.value.replace(/[^0-9.]/g, '')) : setOrderAmount(e.target.value.replace(/[^0-9.]/g, ''))
                  }
                  inputMode="decimal"
                  className="flex-1 bg-white/10 rounded-xl px-4 py-3 text-lg font-black font-mono text-white outline-none border border-white/10"
                />
                <span className="text-[10px] font-black text-gray-400 uppercase">USDC</span>
              </div>
              <AliveCta
                onClick={panel === 'deposit' ? submitDeposit : submitOrder}
                className="w-full px-4 py-3 rounded-xl text-[10px] tracking-[0.15em]"
              >
                {panel === 'deposit' ? 'Send to the vault' : 'Set standing order'}
              </AliveCta>
              <p className="text-[9px] text-gray-500 font-medium">
                Your money into the shared vault needs only you — spending it out again follows the bond’s rules.
              </p>
            </div>
          )}
        </section>
        )}

        {/* Trustee room */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 flex items-center gap-1.5">
            <Landmark size={10} className="text-amber-500" />
            The trustee room · it serves the bond, not either of you
          </h2>
          <div className="bg-white rounded-[1.75rem] border border-gray-100 p-4 space-y-3">
            {msgs.map((m) =>
              m.who === 'trustee' ? (
                <div key={m.id} className="bg-amber-50 border border-amber-100 rounded-2xl rounded-bl-md px-4 py-3 max-w-[90%]">
                  <p className="text-[13px] text-gray-800 font-medium leading-relaxed">
                    {m.typed ? <TypeOnce text={m.text} /> : m.text}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="flex justify-end">
                  <div className="bg-[#1A1A1A] text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[90%]">
                    <p className="text-[13px] font-bold">{m.text}</p>
                  </div>
                </div>
              ),
            )}
            {busy && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl rounded-bl-md px-4 py-3 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}

            {/* The OPPORTUNITY — arrives like a push notification, not a survey */}
            {yieldState !== 'none' && (
              <div className="border border-amber-200 rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(245,158,11,0.10)] animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className={`px-4 py-3 ${yieldState === 'done' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                  <div className="flex items-center gap-2">
                    <Bell size={11} className={yieldState === 'done' ? 'text-emerald-500' : 'text-amber-500'} />
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 flex-1">
                      Your agents decided on this package
                    </p>
                    <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">now</span>
                  </div>
                  <p className="text-[13px] font-black text-gray-900 mt-1.5">USDC yield vault · 4.1% · audited · instant exit</p>
                  <p className="text-[11px] font-medium text-gray-500 mt-1 leading-relaxed">
                    Your agent held the line on the emergency buffer → 200 stay liquid.
                    {bond.partner}’s pushed for long-term → {(invested?.amount ?? 800).toFixed(0)} go to work
                    (+{Math.round((invested?.amount ?? 800) * (invested?.apr ?? 4.1) / 100)}/yr).
                    <span className="font-bold text-gray-700"> They agreed — your confirmation is the last word.</span>
                  </p>
                </div>
                <div className="px-4 py-3 space-y-2 bg-white">
                  <div className="flex items-center gap-2 text-[12px] font-medium text-gray-700">
                    <Check size={12} className={yieldState !== 'proposed' ? 'text-emerald-500' : 'text-gray-300'} />
                    You {yieldState !== 'proposed' ? '— released on your hito' : '— your release is the only thing missing'}
                  </div>
                  <div className="flex items-center gap-2 text-[12px] font-medium text-gray-700">
                    <Check size={12} className={yieldState === 'done' ? 'text-emerald-500' : 'text-gray-300'} />
                    {bond.partner} {yieldState === 'done' ? '— released on theirs' : '— gets the same card right now'}
                  </div>
                  {yieldState === 'proposed' && (
                    <AliveCta onClick={releaseYield} className="w-full px-4 py-3 rounded-xl text-[10px] tracking-[0.15em] mt-1">
                      Confirm on your hito
                    </AliveCta>
                  )}
                  {yieldState === 'done' && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 text-center pt-1">
                      Executed · earning for the family
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* LIVE action — the model flagged it, the humans release it. Same
                dual-hito walk as the scripted card; store mutates only on 'done'. */}
            {liveAction && (
              <div className="border border-amber-200 rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(245,158,11,0.10)] animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className={`px-4 py-3 ${liveAction.stage === 'done' ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                  <div className="flex items-center gap-2">
                    <Bell size={11} className={liveAction.stage === 'done' ? 'text-emerald-500' : 'text-amber-500'} />
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 flex-1">
                      Both agents signed this
                    </p>
                    <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">now</span>
                  </div>
                  <p className="text-[13px] font-black text-gray-900 mt-1.5">
                    {liveAction.kind === 'divest'
                      ? `Divest ${liveAction.amount.toFixed(0)} USDC — back to liquid`
                      : `Invest ${liveAction.amount.toFixed(0)} USDC · ${liveAction.apr}% yield vault`}
                  </p>
                  <p className="text-[11px] font-medium text-gray-500 mt-1 leading-relaxed">
                    Your agent and {bond.partner}’s checked it against both profiles and signed.
                    <span className="font-bold text-gray-700"> Your two releases are the last word.</span>
                  </p>
                </div>
                <div className="px-4 py-3 space-y-2 bg-white">
                  <div className="flex items-center gap-2 text-[12px] font-medium text-gray-700">
                    <Check size={12} className={liveAction.stage !== 'proposed' ? 'text-emerald-500' : 'text-gray-300'} />
                    You {liveAction.stage !== 'proposed' ? '— released on your hito' : '— your release is the only thing missing'}
                  </div>
                  <div className="flex items-center gap-2 text-[12px] font-medium text-gray-700">
                    <Check size={12} className={liveAction.stage === 'done' ? 'text-emerald-500' : 'text-gray-300'} />
                    {bond.partner} {liveAction.stage === 'done' ? '— released on theirs' : '— gets the same card right now'}
                  </div>
                  {liveAction.stage === 'proposed' && (
                    <AliveCta onClick={releaseLiveAction} className="w-full px-4 py-3 rounded-xl text-[10px] tracking-[0.15em] mt-1">
                      Confirm on your hito
                    </AliveCta>
                  )}
                  {liveAction.stage === 'done' && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 text-center pt-1">
                      {liveAction.kind === 'divest' ? 'Executed · liquid again in the vault' : 'Executed · earning for the family'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Input */}
            <div ref={chatBarRef} className="flex items-center gap-2 pt-1">
              <input
                ref={chatFieldRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitDraft()}
                placeholder="Ask the trustee anything…"
                className="flex-1 bg-gray-50 rounded-full px-4 py-2.5 text-[13px] text-gray-800 font-medium placeholder:text-gray-300 outline-none border border-gray-100"
              />
              <button
                onClick={submitDraft}
                disabled={!draft.trim()}
                className="w-9 h-9 bg-black rounded-full flex items-center justify-center text-white active:scale-90 transition-all disabled:bg-gray-200 disabled:text-gray-400 shrink-0"
              >
                <ArrowUp size={14} />
              </button>
            </div>
            {/* chat scroll anchor — lives INSIDE the room */}
            <div ref={endRef} />
          </div>
        </section>

        {/* Heirs — the will lives inside this bond */}
        {isInheritance && (
          <section className="space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
              Your will · who claims when you’re both gone
            </h2>
            {heirs.map((h) => (
              <div
                key={h.id}
                className={`bg-white rounded-2xl border px-5 py-4 flex items-center justify-between ${
                  h.status === 'awaiting-partner' ? 'border-amber-200' : 'border-gray-100'
                }`}
              >
                <div>
                  <p className="text-sm font-black text-gray-900">{h.name}</p>
                  <p
                    className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${
                      h.status === 'awaiting-partner' || h.status === 'awaiting-removal' ? 'text-amber-600' : 'text-gray-400'
                    }`}
                  >
                    {h.status === 'awaiting-partner' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Waiting for {bond.partner} to co-sign
                      </span>
                    ) : h.status === 'awaiting-removal' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Removal requested — waiting for {bond.partner}
                      </span>
                    ) : (
                      'In the will · claimable at 18 via NFC'
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-black text-gray-900 font-mono">{h.sharePct}%</p>
                  {h.status !== 'awaiting-removal' && (
                    <button
                      onClick={() => setConfirmRemove(h)}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {remainingPct < 5 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-5">
                <p className="text-[12px] font-medium text-gray-500">
                  <span className="font-black text-gray-700">100% of the estate is allocated.</span> Remove
                  an heir first to redistribute — the will can never promise more than there is.
                </p>
              </div>
            ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-5 space-y-4">
              <input
                value={heirName}
                onChange={(e) => setHeirName(e.target.value)}
                placeholder="Name — e.g. your son Paul"
                className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-800 font-medium placeholder:text-gray-300 outline-none border border-gray-100"
              />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Share of the estate · {remainingPct}% unallocated
                  </p>
                  <p className="text-sm font-black text-gray-900 font-mono">{effectiveShare}%</p>
                </div>
                <input
                  type="range"
                  min={5}
                  max={remainingPct}
                  step={5}
                  value={effectiveShare}
                  onChange={(e) => setHeirShare(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
              <AliveCta onClick={submitHeir} className="w-full px-6 py-3.5 rounded-xl text-[11px] tracking-[0.15em]">
                Write into our will
              </AliveCta>
              <p className="text-[10px] text-gray-400 font-medium">
                A will entry needs both of you — {bond.partner} gets asked to co-sign on her device.
                No wallet needed for the heir: the claim binds to the human, unlocks at 18 via NFC,
                and only after both of you are gone.
              </p>
            </div>
            )}
          </section>
        )}

        {/* Activity */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Activity</h2>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
            {activity.map((a) => (
              <div key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <p className="text-[12px] font-medium text-gray-800 flex-1">{a.text}</p>
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-300 shrink-0">{a.tag}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Rules — settings, at the bottom where settings belong */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Rules · what you two agreed</h2>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
            {[
              { k: 'Split of shared expenses', v: 'By income — currently you 10% · Alice 90%' },
              { k: 'Your hardware threshold', v: `hito above ${threshold}` },
              { k: 'Proof of life', v: 'Profile-level Selfie Check — one check covers all your bonds' },
              { k: 'Will & rules document', v: 'v2 · encrypted on 0G storage' },
            ].map((row) => (
              <div key={row.k} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <p className="text-[12px] font-bold text-gray-500">{row.k}</p>
                <p className="text-[12px] font-medium text-gray-800 text-right">{row.v}</p>
              </div>
            ))}
            {/* Rules YOU TWO wrote — they feed both agents as binding context */}
            {bondRules.map((r) => (
              <div key={r.id} className="px-5 py-3.5 flex items-center gap-3">
                <p className="text-[12px] font-medium text-gray-800 flex-1">{r.text}</p>
                {r.status === 'awaiting-partner' ? (
                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 shrink-0 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                    waiting for {bond.partner}
                  </span>
                ) : (
                  <button
                    onClick={() => removeBondRule(r.id)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {/* Write your own rule — context that makes the agents better */}
          <div className="bg-white rounded-full border border-gray-100 pl-4 pr-1.5 py-1.5 flex items-center gap-2">
            <input
              value={ruleDraft}
              onChange={(e) => setRuleDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitRule()}
              placeholder="Write a rule — e.g. never touch the holiday fund…"
              className="flex-1 bg-transparent text-[13px] text-gray-800 font-medium placeholder:text-gray-300 outline-none"
            />
            <button
              onClick={submitRule}
              disabled={!ruleDraft.trim()}
              className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white hover:bg-gray-900 transition-all active:scale-90 disabled:bg-gray-200 disabled:text-gray-400 shrink-0"
            >
              <ArrowUp size={13} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 font-medium px-1">
            Your rules bind both agents in every negotiation. Adding one needs {bond.partner}&apos;s
            co-sign — changing any rule = a new charter version on 0G.
          </p>
        </section>
      </main>

      {/* Floating hand-off to the trustee — Claude-app-style pill, only while
          the inline chat input is scrolled out of view. Sits left of the mock
          panel toggle in dev so the two never overlap. */}
      {!chatBarVisible && (
        <button
          onClick={() => {
            chatFieldRef.current?.focus({ preventScroll: true });
            chatBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className={`fixed bottom-5 ${USE_MOCKS ? 'right-20' : 'right-5'} z-40 flex items-center gap-2 bg-[#1A1A1A] text-white pl-3.5 pr-4 py-2.5 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.25)] active:scale-95 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300`}
        >
          <MessageCircle size={14} />
          <span className="text-[11px] font-bold">Ask the trustee</span>
        </button>
      )}

      {/* ACHTUNG: removing someone from the will is a two-person decision */}
      {confirmRemove && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => setConfirmRemove(null)} />
          <div className="relative bg-white rounded-[2rem] p-7 max-w-sm w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
                <AlertTriangle size={30} />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-gray-900 tracking-tight">
                Remove {confirmRemove.name} from your will?
              </h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                This changes what you both promised. Nothing happens on your tap alone —{' '}
                {bond.partner} has to co-sign the removal on her device before{' '}
                {confirmRemove.name} loses the {confirmRemove.sharePct}% claim.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 pt-1">
              <button
                onClick={() => {
                  requestRemoveHeir(confirmRemove.id);
                  setConfirmRemove(null);
                }}
                className="w-full py-4 px-6 rounded-2xl text-sm font-black text-white bg-red-500 hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-200"
              >
                Request removal
              </button>
              <button
                onClick={() => setConfirmRemove(null)}
                className="w-full py-3 px-6 rounded-2xl text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
              >
                Keep {confirmRemove.name} in the will
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowUp, Bell, Check, Copy, MessageCircle, Send, X } from 'lucide-react';
import { AliveCta } from '@/app/components/agent/AliveCta';
import { formatUsdc, shortAddress } from '@/lib/vault/usdc';
import { VAULT_ADDRESSES, VAULT_RULES } from '@/lib/contracts/vault';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAgentStore, type Heir } from '@/lib/agent/agentStore';
import { USE_MOCKS } from '@/lib/config';
import { META } from '@/lib/design';
import { useRouteGuard } from '@/lib/hooks/useLiveStage';
import { ENS_PARENT } from '@/lib/contracts/registrar';
import { useLiveBondSync } from '@/lib/agent/useLiveBondSync';
import { useMarriage } from '@/lib/marriage/context';
import { useBondVault } from '@/lib/hooks/useBondVault';
import { useVaultActions } from '@/lib/hooks/useVaultActions';
import { useVaultTransfers } from '@/lib/hooks/useVaultTransfers';
import { SendFundsForm } from '@/app/components/vault/SendFundsForm';

// --- tiny self-contained chat for the trustee room ------------------------

/** `card` markers anchor the opportunity/release cards INSIDE the history —
 *  they scroll up with the conversation instead of sticking below it. */
type RoomMsg = { id: number; who: 'trustee' | 'you'; text: string; typed?: boolean; card?: 'yield' | 'live' };
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

/** "25 Jul, 23:05" — the explorer's ISO timestamp, human-sized. */
const formatTransferTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

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
  const { dashboard: liveDash, marriageView, address: myWallet } = useMarriage();
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
  const handleBondSend = (
    to: `0x${string}`,
    amount: bigint,
    willExecuteImmediately: boolean,
  ) => {
    console.info('[bond-send] proposeSpend parameters', {
      bondId: lBondId,
      partnerA: lPartnerA,
      partnerB: lPartnerB,
      vaultAddress: liveVault?.address ?? null,
      moduleAddress: VAULT_ADDRESSES.BOND_VAULT_MODULE,
      usdcAddress: VAULT_ADDRESSES.USDC,
      recipient: to,
      amountBaseUnits: amount.toString(),
      amountUsdc: Number(amount) / 1_000_000,
      willExecuteImmediately,
    });
    return proposeSpend(to, amount, willExecuteImmediately);
  };
  const params = useParams<{ bondId: string }>();
  const {
    agentReady, answers, payments, heirs, addHeir, requestRemoveHeir,
    vaultBalances, deposits, bondEnsLabel,
    investments, invest, bonds, bondRules, addBondRule, removeBondRule,
  } = useAgentStore();
  // The live store starts EMPTY until useLiveBondSync mirrors the chain — a
  // direct navigation can render before that. The placeholder keeps the first
  // render alive just long enough for the route guard to redirect; it is never
  // shown at the dashboard stage, where sync has always run.
  const bond = bonds.find((b) => b.id === params.bondId) ??
    bonds[0] ??
    ({ id: params.bondId, partner: 'partner', type: 'inheritance', status: 'active' } as const);
  const isInheritance = bond.type === 'inheritance';
  const balance = vaultBalances[bond.id] ?? 0;
  const invested = investments[bond.id];
  const liquid = balance - (invested?.amount ?? 0);
  // The bond's REAL ENS label — set when the couple named the bond, then
  // confirmed by the registrar read. Null until one of those exists.
  const ensLabel = bondEnsLabel ?? liveVault?.ensLabel ?? null;
  // Display-only name for the headline. The `ben-…` fallback is a placeholder,
  // never a payable address — anything that hands a name out to be paid to
  // (the Receive dialog) must use `ensLabel` and render nothing without it.
  const bondName = ensLabel ?? `ben-${bond.partner.toLowerCase()}`;
  const [copiedField, setCopiedField] = useState<'ens' | 'addr' | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  // Real USDC transfer history of the Safe (live only) + how many rows show.
  const {
    transfers,
    isLoading: isTransfersLoading,
    error: transfersError,
    refetch: refetchTransfers,
  } = useVaultTransfers(liveVault?.address ?? null);
  const [shownTransfers, setShownTransfers] = useState(5);
  const copyToClipboard = async (text: string, field: 'ens' | 'addr') => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1600);
  };

  const [msgs, setMsgs] = useState<RoomMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  const [yieldState, setYieldState] = useState<YieldState>(() => (invested ? 'done' : 'none'));
  const [liveAction, setLiveAction] = useState<LiveAction | null>(null);
  const [heirName, setHeirName] = useState('');
  const [heirShare, setHeirShare] = useState(100);
  const [confirmRemove, setConfirmRemove] = useState<Heir | null>(null);
  const [ruleDraft, setRuleDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const greeted = useRef(false);
  const rogueShown = useRef(false);
  // Floating "ask the trustee" pill: shown only while the inline chat input is
  // scrolled out of view — tap scrolls back and focuses the field.
  const chatBarRef = useRef<HTMLDivElement>(null);
  const chatFieldRef = useRef<HTMLInputElement>(null);
  const [chatBarVisible, setChatBarVisible] = useState(true);

  // Live routing belongs to the contract (lib/hooks/useLiveStage.ts) — /bond/*
  // lives on the dashboard surface. Mock keeps its local agent gate.
  useRouteGuard('/bond');
  useEffect(() => {
    if (USE_MOCKS && !agentReady) router.replace('/home');
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
    const t2 = USE_MOCKS && !alreadyInvested
      ? setTimeout(() => {
          setYieldState('proposed');
          setMsgs((m) => [...m, { id: rid++, who: 'trustee', text: '', card: 'yield' }]);
        }, 2600)
      : undefined;
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

  // A new live action re-uses the single liveAction slot — only the NEWEST
  // marker renders the card, older markers stay empty.
  const lastLiveMarkerId = [...msgs].reverse().find((m) => m.card === 'live')?.id;


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
    // With real wallets on hand we check the agents each partner actually
    // registered (wallet → agent via the activation link); the mock flow keeps
    // its demo seeds.
    const myName = answers.name?.text?.replace(/^just call me /i, '') || 'Ben';
    const body =
      !USE_MOCKS && myWallet && livePartnerAddr
        ? { wallets: [myWallet, livePartnerAddr] }
        : { seeds: [myName.toLowerCase(), bond.partner.toLowerCase()] };
    setBusy(true);
    fetch('/api/agent/verify-backing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? `verify-backing ${res.status}`);
        setBusy(false);
        const [mine, theirs] = j.agents as { address: string | null; backed: boolean }[];
        if (!mine.backed || !theirs.backed) {
          const describe = (a: { address: string | null }) =>
            a.address ? `agent ${a.address.slice(0, 6)}… carries no verified human` : 'has no registered agent yet';
          const failed = [!mine.backed ? `${myName}’s ${describe(mine)}` : null, !theirs.backed ? `${bond.partner}’s ${describe(theirs)}` : null]
            .filter(Boolean)
            .join(' and ');
          pushTrustee(
            `AgentBook check failed: ${failed}. I don’t put unbacked proposals on the release track — register the agent with World AgentKit first.`,
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
            setMsgs((m) => [...m, { id: rid++, who: 'trustee', text: '', card: 'live' }]);
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

  // Mock activity: action on the left (black), amount + counterparty on the
  // right. Built from real mock-store events (deposits, agent payments); no
  // standing orders (not supported yet). Falls back to a representative example
  // so the pattern is visible before any mock action. Live mode ignores this.
  const activityFromStore = [
    ...deposits
      .filter((d) => d.bondId === bond.id)
      .map((d) => ({ id: d.id, label: 'Deposit', detail: `${d.amount.toFixed(0)} · from you` })),
    ...Object.values(payments)
      .filter((p) => p.stage === 'paid' && !p.personal)
      .map((p) => ({ id: p.id, label: 'Agent payment', detail: `${p.amountUsdc.toFixed(2)} · to ${p.recipientEns}` })),
  ];
  const activity = activityFromStore.length
    ? activityFromStore
    : [
        { id: 'ex-dep', label: 'Deposit', detail: '250 · from you' },
        { id: 'ex-pay1', label: 'Agent payment', detail: '84.50 · to kalorama.eth' },
        { id: 'ex-pay2', label: 'Agent payment', detail: '12.00 · to sevilla.eth' },
      ];

  // The OPPORTUNITY — arrives like a push notification, not a survey.
  // Rendered inside the history at its marker so it scrolls up like a message.
  const yieldCard = (
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
  );

  // LIVE action — the model flagged it, the humans release it. Same dual-hito
  // walk as the scripted card; store mutates only on 'done'.
  const liveCard = liveAction && (
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
  );

  return (
    <div className="min-h-screen bg-[#E8E8E8] flex flex-col">
      {/* Header */}
      <header className="px-6 pt-4 pb-4 flex items-center gap-4">
        <div className="flex-1">
          {/* Live: the registered name, or plain "YOU & PARTNER" while unnamed —
              never a made-up ENS. Mock keeps the playground name. */}
          <h1 className="text-2xl font-anton text-black tracking-wide truncate">
            {(USE_MOCKS || ensLabel ? bondName : `You & ${bond.partner}`).toUpperCase()}
            {(USE_MOCKS || ensLabel) && (
              <span className="text-sm text-gray-400">.{ENS_PARENT.toUpperCase()}</span>
            )}
          </h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pb-16 space-y-8 max-w-lg w-full mx-auto">
        {/* Money view — ONE card, chain truth: balance from the Safe, the
            bond's ENS name + address with copy, real send flow (partner
            approves above the free limit). */}
        <section className="bg-[#1A1A1A] rounded-[2rem] p-6 relative overflow-hidden">
          <p className={`${META} relative z-10`}>Parked in the vault</p>
          <p className="text-4xl font-anton text-white tracking-wide mt-1 relative z-10">
            {Math.round(balance).toLocaleString('en-US')}
            <span className="text-gray-500 ml-2">USDC</span>
          </p>
          {/* Where the money lives — simple and unmissable */}
          <div className="mt-3 flex gap-2 relative z-10">
            <div className="flex-1 bg-white/5 rounded-xl px-4 py-2.5">
              <p className={META}>Ready to spend</p>
              <p className="text-lg font-anton text-white tracking-wide">{Math.round(liquid).toLocaleString('en-US')}</p>
            </div>
            <div className="flex-1 bg-emerald-500/10 rounded-xl px-4 py-2.5">
              <p className="font-anton text-[11px] text-emerald-400/80 uppercase tracking-wide flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-emerald-400" />
                Earning
              </p>
              <p className="text-lg font-anton text-emerald-300 tracking-wide">
                {Math.round(invested?.amount ?? 0).toLocaleString('en-US')}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-2 relative z-10">
            {liveVault?.isCreated && (
              <button
                onClick={() => setSendOpen(true)}
                className="flex-1 py-3.5 rounded-xl bg-white text-black text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                <Send size={14} />
                Send USDC
              </button>
            )}
            <button
              onClick={() => setReceiveOpen(true)}
              className="flex-1 py-3.5 rounded-xl bg-white/10 text-white text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
            >
              <ArrowDownToLine size={14} />
              Receive USDC
            </button>
          </div>
        </section>

        {/* Receive popup — the bond's ENS name and raw address, both one tap to copy. */}
        <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
          <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Receive USDC</DialogTitle>
              <DialogDescription>
                Anyone can send USDC on World Chain to your bond.{' '}
                {ensLabel ? 'Use the name or the address.' : 'Use the address below.'}{' '}
                Only USDC is accepted at the moment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {/* Only a REGISTERED name is offered to copy — handing out a
                  placeholder here would send someone's USDC into nothing. */}
              {ensLabel && (
                <button
                  onClick={() => copyToClipboard(`${ensLabel}.${ENS_PARENT}`, 'ens')}
                  className="w-full flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3.5 text-left hover:bg-gray-100 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
                      {copiedField === 'ens' ? 'Copied!' : 'ENS name'}
                    </p>
                    <p className="text-xs font-mono font-semibold text-gray-800 truncate">
                      {ensLabel}.{ENS_PARENT}
                    </p>
                  </div>
                  <span className="shrink-0 w-9 h-9 rounded-xl bg-white flex items-center justify-center text-gray-500">
                    {copiedField === 'ens' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  </span>
                </button>
              )}
              {liveVault?.address && (
                <button
                  onClick={() => copyToClipboard(liveVault.address, 'addr')}
                  className="w-full flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-4 py-3.5 text-left hover:bg-gray-100 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
                      {copiedField === 'addr' ? 'Copied!' : 'Wallet address'}
                    </p>
                    <p className="text-sm font-mono font-semibold text-gray-800 truncate">
                      {shortAddress(liveVault.address)}
                    </p>
                  </div>
                  <span className="shrink-0 w-9 h-9 rounded-xl bg-white flex items-center justify-center text-gray-500">
                    {copiedField === 'addr' ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                  </span>
                </button>
              )}
            </div>
          </DialogContent>
        </Dialog>
        {liveVault?.isCreated && (
          <SendFundsForm
            open={sendOpen}
            onOpenChange={setSendOpen}
            vault={liveVault}
            partnerName={bond.partner}
            txState={spendState}
            error={spendError}
            txError={spendTxError}
            onSend={handleBondSend}
            onReset={resetSpend}
          />
        )}

        {/* Trustee room */}
        <section className="space-y-3">
          <div>
            <h2 className="text-2xl font-anton text-black tracking-wide">YOUR BOND AGENT</h2>
            <p className={`${META} mt-0.5`}>
              It serves the bond, not either of you — and only executes what both of you confirm
            </p>
          </div>
          <div className="bg-white rounded-[1.75rem] p-4 space-y-3">
            {/* Constant-height history — the room never grows or shifts the
                page; new messages (and cards) scroll inside. */}
            <div className="h-96 overflow-y-auto space-y-3 pr-1">
            {msgs.map((m) => {
              if (m.card === 'yield') return yieldState !== 'none' ? <div key={m.id}>{yieldCard}</div> : null;
              if (m.card === 'live') return liveAction && m.id === lastLiveMarkerId ? <div key={m.id}>{liveCard}</div> : null;
              return m.who === 'trustee' ? (
                <div key={m.id} className="bg-amber-50 rounded-2xl rounded-bl-md px-4 py-3 max-w-[90%]">
                  <p className="text-[13px] text-gray-800 font-medium leading-relaxed">
                    {m.typed ? <TypeOnce text={m.text} /> : m.text}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="flex justify-end">
                  <div className="bg-gray-500 text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[90%]">
                    <p className="text-[13px] font-bold">{m.text}</p>
                  </div>
                </div>
              );
            })}
            {busy && (
              <div className="bg-amber-50 rounded-2xl rounded-bl-md px-4 py-3 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            {/* chat scroll anchor — lives INSIDE the scroll container */}
            <div ref={endRef} />
            </div>

            {/* Input */}
            <div ref={chatBarRef} className="flex items-center gap-2 pt-1">
              <input
                ref={chatFieldRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitDraft()}
                placeholder="Ask the trustee anything…"
                className="flex-1 bg-gray-50 rounded-full px-4 py-2.5 text-[13px] text-gray-800 font-medium placeholder:text-gray-300 outline-none"
              />
              <button
                onClick={submitDraft}
                disabled={!draft.trim()}
                className="w-9 h-9 bg-black rounded-full flex items-center justify-center text-white active:scale-90 transition-all disabled:bg-gray-200 disabled:text-gray-400 shrink-0"
              >
                <ArrowUp size={14} />
              </button>
            </div>
          </div>
        </section>

        {/* Activity — LIVE: the Safe's real USDC transfers (time shown, tap
            opens the transaction on Worldscan). MOCK: the playground list. */}
        <section className="space-y-3">
          <h2 className="text-2xl font-anton text-black tracking-wide">ACTIVITY</h2>
          <div className="bg-white rounded-2xl divide-y divide-gray-100">
            {!USE_MOCKS ? (
              // Four distinct states, never conflated: still loading, failed,
              // genuinely empty, and the list. An explorer outage rendering as
              // "no transfers yet" would be the page lying about the money.
              isTransfersLoading ? (
                [0, 1, 2].map((i) => (
                  <div key={i} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 w-40 rounded bg-gray-100 animate-pulse" />
                      <div className="h-2 w-20 rounded bg-gray-100 animate-pulse" />
                    </div>
                    <div className="h-2.5 w-12 rounded bg-gray-100 animate-pulse shrink-0" />
                  </div>
                ))
              ) : transfersError ? (
                <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <p className={`${META} text-red-500`}>Could not load activity</p>
                  <button
                    onClick={() => void refetchTransfers()}
                    className={`${META} hover:text-gray-700 transition-colors shrink-0`}
                  >
                    Retry
                  </button>
                </div>
              ) : transfers && transfers.length > 0 ? (
                <>
                  {transfers.slice(0, shownTransfers).map((t, i) => (
                    <a
                      key={`${t.hash}-${i}`}
                      href={`https://worldscan.org/tx/${t.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-anton text-[11px] text-gray-700 uppercase tracking-wide truncate">
                          {t.incoming
                            ? `Received from ${shortAddress(t.from)}`
                            : `Sent to ${shortAddress(t.to)}`}
                        </p>
                        <p className={`${META} mt-0.5`}>{formatTransferTime(t.timestamp)}</p>
                      </div>
                      <span className={`font-anton text-[11px] uppercase tracking-wide shrink-0 ${t.incoming ? 'text-emerald-600' : 'text-gray-700'}`}>
                        {t.incoming ? '+' : '−'}{t.amountUsdc.toFixed(2)}
                      </span>
                    </a>
                  ))}
                  {transfers.length > shownTransfers && (
                    <button
                      onClick={() => setShownTransfers((n) => n + 5)}
                      className={`w-full px-5 py-3 ${META} hover:text-gray-700 transition-colors`}
                    >
                      Show more
                    </button>
                  )}
                </>
              ) : (
                <p className={`px-5 py-3.5 ${META}`}>
                  No transfers yet — send USDC to your bond address and it shows up here
                </p>
              )
            ) : (
              activity.map((a) => (
                <div key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <p className="font-anton text-[11px] text-gray-700 uppercase tracking-wide">{a.label}</p>
                  <p className={`${META} shrink-0 text-right`}>{a.detail}</p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Rules — settings, at the bottom where settings belong */}
        <section className="space-y-3">
          <div>
            <h2 className="text-2xl font-anton text-black tracking-wide">RULES</h2>
            <p className={`${META} mt-0.5`}>What you two agreed</p>
          </div>
          <div className="bg-white rounded-2xl divide-y divide-gray-100">
            {/* The vault's REAL spend rules — live straight from the module,
                mock from the same constants the playground sim enforces. Rows
                that only exist in the demo story (income split, 0G charter doc,
                the hito threshold default) never show in live without data. */}
            {[
              {
                k: 'No approval needed',
                v: `Instant under ${formatUsdc(liveVault?.smallSpendThreshold ?? VAULT_RULES.SMALL_SPEND_THRESHOLD, 0)} USDC`,
              },
              {
                k: 'Shared instant budget',
                v: `${formatUsdc(liveVault?.dailyFreeLimit ?? VAULT_RULES.DAILY_FREE_LIMIT, 0)} USDC per 24h`,
              },
              { k: `${bond.partner} co-signs`, v: 'Above that, both approve' },
              { k: 'Automatic', v: '50/50 split on dissolve' },
              ...(answers.threshold ? [{ k: 'Your hardware threshold', v: `hito above ${threshold}` }] : []),
              { k: 'Proof of life', v: 'Selfie Check' },
              ...(USE_MOCKS
                ? [
                    { k: 'Split of shared expenses', v: 'By income' },
                    { k: 'Will & rules document', v: 'encrypted on 0G storage' },
                  ]
                : []),
            ].map((row) => (
              <div key={row.k} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <p className="font-anton text-[11px] text-gray-700 uppercase tracking-wide">{row.v}</p>
                <p className={`${META} shrink-0 text-right`}>{row.k}</p>
              </div>
            ))}
            {/* Rules YOU TWO wrote — they feed both agents as binding context */}
            {bondRules.map((r) => (
              <div key={r.id} className="px-5 py-3.5 flex items-center gap-3">
                <p className="font-anton text-[11px] text-gray-700 uppercase tracking-wide flex-1">{r.text}</p>
                {r.status === 'awaiting-partner' ? (
                  <span className={`${META} bg-gray-100 rounded-full px-2 py-0.5 shrink-0 flex items-center gap-1`}>
                    <span className="w-1 h-1 rounded-full bg-gray-400 animate-pulse" />
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
          <div className="bg-white rounded-full pl-4 pr-1.5 py-1.5 flex items-center gap-2">
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

        {/* Heirs — the will lives inside this bond, at the very bottom */}
        {isInheritance && (
          <section className="space-y-3">
            <div>
              <h2 className="text-2xl font-anton text-black tracking-wide">YOUR WILL</h2>
              <p className={`${META} mt-0.5`}>
                Who claims when you’re both gone. Adding or removing an heir takes both of you
              </p>
            </div>
            {/* Teaser: recognizable but not live yet — blurred cover + "SOON" */}
            <div className="relative">
              <div className="blur-[1px] opacity-90 pointer-events-none select-none space-y-3">
            {heirs.map((h) => (
              <div
                key={h.id}
                className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-anton text-lg text-black tracking-wide">{h.name.toUpperCase()}</p>
                  <p className={`${META} mt-0.5 ${h.status === 'awaiting-partner' || h.status === 'awaiting-removal' ? 'text-gray-700' : ''}`}>
                    {h.status === 'awaiting-partner' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
                        Waiting for {bond.partner} to co-sign
                      </span>
                    ) : h.status === 'awaiting-removal' ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
                        Removal requested — waiting for {bond.partner}
                      </span>
                    ) : (
                      'In the will · claimable at 18 via NFC'
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-anton text-lg text-black tracking-wide">{h.sharePct}%</p>
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
              <div className="bg-white rounded-2xl p-5">
                <p className="text-[12px] font-medium text-gray-500">
                  <span className="font-black text-gray-700">100% of the estate is allocated.</span> Remove
                  an heir first to redistribute — the will can never promise more than there is.
                </p>
              </div>
            ) : (
            <div className="bg-white rounded-2xl p-5 space-y-4">
              <input
                value={heirName}
                onChange={(e) => setHeirName(e.target.value)}
                placeholder="Name — e.g. your son Paul"
                className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-800 font-medium placeholder:text-gray-300 outline-none"
              />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className={META}>
                    Share of the estate · {remainingPct}% unallocated
                  </p>
                  <p className="font-anton text-lg text-black tracking-wide">{effectiveShare}%</p>
                </div>
                <input
                  type="range"
                  min={5}
                  max={remainingPct}
                  step={5}
                  value={effectiveShare}
                  onChange={(e) => setHeirShare(Number(e.target.value))}
                  className="w-full accent-black"
                />
              </div>
              <AliveCta glow={false} onClick={submitHeir} className="w-full px-6 py-3.5 rounded-xl text-[11px] tracking-[0.15em]">
                Write into our will
              </AliveCta>
              <p className="text-[10px] text-gray-400 font-medium">
                A will entry needs both of you — {bond.partner} gets asked to co-sign on her device.
                No wallet needed for the heir: the claim binds to the human, unlocks at 18 via NFC,
                and only after both of you are gone.
              </p>
            </div>
            )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-anton text-3xl text-black tracking-[0.2em] bg-white/50 backdrop-blur-sm rounded-full px-6 py-2">
                  SOON
                </span>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Floating hand-off to YOUR OWN agent — Claude-app-style pill, only while
          the trustee input is scrolled out of view. Sits left of the mock
          panel toggle in dev so the two never overlap. */}
      {!chatBarVisible && (
        <button
          onClick={() => router.push('/agent')}
          className={`fixed bottom-5 ${USE_MOCKS ? 'right-20' : 'right-5'} z-40 flex items-center gap-2 bg-[#1A1A1A] text-white pl-3.5 pr-4 py-2.5 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.25)] active:scale-95 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300`}
        >
          <MessageCircle size={14} />
          <span className="text-[11px] font-bold">Your agent</span>
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

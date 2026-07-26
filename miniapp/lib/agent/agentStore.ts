/**
 * Personal-agent clickable dummy — state for the interview and the chat.
 *
 * DESIGN RULE (chat pacing): the agent must always feel like someone who is
 * thinking and writing. Everything the agent produces goes through ONE
 * sequential queue: typing indicator → one bubble types out → pause → next.
 * Never two bubbles at once.
 *
 * Payment model: routing first (personal vs shared), the trustee negotiates
 * the fair split, the human releases the proposal on hito, shares are pulled
 * from each wallet (card on file) OR paid from a standing balance.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { USE_MOCKS } from '@/lib/config';

function debugMockAgent(message: string, data?: unknown): void {
  if (process.env.NODE_ENV === 'production') return;
  if (data === undefined) {
    console.info(`[agent-mock] ${message}`);
    return;
  }
  console.info(`[agent-mock] ${message}`, data);
}

// ---------------------------------------------------------------------------
// Interview

export type InterviewAnswerOption = { id: string; label: string };
export type InterviewQuestion = {
  id: string;
  ask: string;
  options: InterviewAnswerOption[];
};

/** An answer: either a picked option (id set) or free text (id null). */
export type InterviewAnswer = { id: string | null; text: string };

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'name',
    ask: 'First things first — what should I call you?',
    options: [
      { id: 'world', label: 'Use my World username' },
      { id: 'ben', label: 'Ben' },
    ],
  },
  {
    id: 'job',
    ask: 'What does your work life look like right now?',
    options: [
      { id: 'employed', label: 'Employed' },
      { id: 'self', label: 'Self-employed' },
      { id: 'between', label: 'Between jobs' },
    ],
  },
  {
    id: 'income',
    ask: 'Roughly, what lands in your account each month?',
    options: [
      { id: 'lt2k', label: 'Under €2k' },
      { id: '2k4k', label: '€2–4k' },
      { id: 'gt4k', label: '€4k+' },
    ],
  },
  {
    id: 'budget',
    ask: 'How much personal spending per month should I protect, no questions asked?',
    options: [
      { id: 'b200', label: '€200' },
      { id: 'b500', label: '€500' },
      { id: 'b1000', label: '€1.000' },
    ],
  },
  {
    id: 'stress',
    ask: 'A big unexpected bill arrives. Honestly — what happens inside you?',
    options: [
      { id: 'calm', label: 'I stay calm' },
      { id: 'stress', label: 'Stress, instantly' },
      { id: 'avoid', label: 'I avoid looking at it' },
    ],
  },
  {
    id: 'fear',
    ask: 'And your biggest money fear?',
    options: [
      { id: 'emergency', label: 'No emergency buffer' },
      { id: 'debt', label: 'Debt' },
      { id: 'conflict', label: 'Fighting about money' },
    ],
  },
  {
    id: 'threshold',
    ask: 'Last one: above which amount should I always check with you before paying?',
    options: [
      { id: 't50', label: 'Everything over €50' },
      { id: 't200', label: 'Over €200' },
      { id: 'unusual', label: 'Only unusual things' },
    ],
  },
];

/** How the agent mirrors the profile back. Custom (typed) answers are quoted verbatim. */
export function profileSummary(answers: Record<string, InterviewAnswer>): string[] {
  const a = (qid: string): InterviewAnswer => answers[qid] ?? { id: null, text: '—' };
  const lines: string[] = [];

  const income = a('income');
  const incomeText =
    income.id === 'lt2k' ? 'under €2k' : income.id === '2k4k' ? '€2–4k' : income.id === 'gt4k' ? '€4k+' : `"${income.text}"`;
  const budget = a('budget');
  const budgetText =
    budget.id === 'b200' ? '€200' : budget.id === 'b500' ? '€500' : budget.id === 'b1000' ? '€1.000' : `"${budget.text}"`;
  lines.push(`You bring in ${incomeText} a month and your protected personal budget is ${budgetText}.`);

  const stress = a('stress');
  lines.push(
    stress.id === 'avoid'
      ? 'Big bills make you look away — so I will open them, summarize them in one line, and never ambush you with numbers.'
      : stress.id === 'stress'
        ? 'Big bills stress you — so I will always lead with "this is handled" before any numbers.'
        : stress.id === 'calm'
          ? 'You keep a level head with big bills — I will give it to you straight.'
          : `About big bills you told me: "${stress.text}" — I will keep that in mind every time one arrives.`,
  );

  const fear = a('fear');
  lines.push(
    fear.id === 'conflict'
      ? 'Your biggest fear is money conflict — I will route anything sensitive through the trustee before it reaches your partner.'
      : fear.id === 'emergency'
        ? 'Your biggest fear is an empty buffer — I will defend the emergency fund before any discretionary spend.'
        : fear.id === 'debt'
          ? 'You fear debt most — I will flag anything that smells like leverage.'
          : `Your biggest money fear, in your words: "${fear.text}". Protecting you from exactly that is my job.`,
  );

  const th = a('threshold');
  lines.push(
    `I ask you first ${
      th.id === 't50' ? 'for everything over €50' : th.id === 't200' ? 'for everything over €200' : th.id === 'unusual' ? 'only when something looks unusual' : `— your rule: "${th.text}"`
    }.`,
  );
  return lines;
}

/** A fact in your second brain — what the agent knows, with provenance. */
export type BrainFact = { id: string; text: string; source: string };

/** Your bonds. One human can hold several; the inheritance bond is the default.
 *  A bond doesn't exist until BOTH humans sign — new ones wait on the partner. */
export type Bond = {
  id: string;
  partner: string;
  type: 'inheritance' | 'business' | 'friends';
  status: 'active' | 'awaiting-partner';
};

/** Playground fixtures. In live mode (USE_MOCKS=0) every fixture below is
 *  EMPTY: the chain seeds the store via useLiveBondSync, never these demo
 *  couples. Mixing them was how Alice's heirs ended up next to a real bond. */
export const BONDS: Bond[] = USE_MOCKS
  ? [
      { id: 'alice', partner: 'Alice', type: 'inheritance', status: 'active' },
      { id: 'mika', partner: 'Mika', type: 'business', status: 'active' },
    ]
  : [];

/** Must match LIVE_BOND_ID in lib/agent/useLiveBondSync.ts — the one real bond. */
const DEFAULT_BOND_ID = USE_MOCKS ? 'alice' : 'main';
const STANDING_ORDERS: Record<string, number> = USE_MOCKS ? { alice: 500, mika: 0 } : {};

/** Proof of life runs on a 90-day dead-man's timer. The demo starts near the
 *  end of a cycle so the reset can be played through once: red → check → 90. */
export const HEARTBEAT_CYCLE_DAYS = 90;
export const HEARTBEAT_START_DAYS_LEFT = 4;

/** Parked vault balances (mock) — fed by standing orders from both partners. */
export const VAULT_BALANCES: Record<string, number> = USE_MOCKS ? { alice: 1000, mika: 0 } : {};

/** An heir inside a bond's charter — claims bind to the human, not a wallet.
 *  awaiting-partner: written by you, waiting for the partner's release.
 *  pending-nfc: in the will; claim unlocks via NFC age verification at 18. */
export type Heir = {
  id: string;
  name: string;
  sharePct: number;
  status: 'awaiting-partner' | 'pending-nfc' | 'active' | 'awaiting-removal';
};

/** Sources the agent can pull an existing self from. */
export const IMPORT_SOURCES = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X / Twitter' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'claude', label: 'Claude' },
] as const;

// ---------------------------------------------------------------------------
// Chat + fair-split payment choreography

export type ChoreoStage = 'proposed' | 'confirmed' | 'pulled' | 'paid';

export type ChatMessage =
  | { id: string; role: 'agent' | 'user'; kind: 'text'; text: string; typed?: boolean; thinking?: boolean }
  | { id: string; role: 'agent'; kind: 'receipt'; vendor: string; amountUsdc: number }
  | { id: string; role: 'system'; kind: 'grant' }
  | { id: string; role: 'system'; kind: 'choreo'; paymentId: string };

export type Payment = {
  id: string;
  label: string;
  recipientEns: string;
  amountUsdc: number;
  shareYouPct: number;
  shareYou: number;
  sharePartner: number;
  stage: ChoreoStage;
  /** Event/context line, e.g. venue + the date the agents found in both calendars. */
  detail?: string;
  note?: string;
  renegotiated?: boolean;
  /** Personal payment: your wallet only. Under your threshold → phone authority (no release); above → your hito alone. */
  personal?: boolean;
  /** Which bond this shared spend runs over — drives every partner label. */
  bondId?: string;
  partnerName?: string;
};

export type AgentSpendProposal = {
  label: string;
  recipient: string;
  amountUsdc: number;
  detail?: string;
  bond: { id: string; partner: string };
};

let nextId = 1;
const mid = () => `m${nextId++}-${Date.now()}`;

/** One sequential production line for everything the agent shows. */
type QueueItem =
  | { type: 'text'; text: string; thinking?: boolean }
  | { type: 'receipt'; vendor: string; amountUsdc: number }
  | { type: 'grant' }
  | { type: 'choreo'; paymentId: string }
  | { type: 'action'; run: () => void };

// Queue lives outside the persisted state — a reload starts calm, not mid-monologue.
let queue: QueueItem[] = [];
let processing = false;

type AgentState = {
  // interview
  step: number;
  answers: Record<string, InterviewAnswer>;
  askedIds: string[];
  importedSources: string[];
  agentReady: boolean;
  bornPending: boolean;
  partnerAgentReady: boolean;

  // chat pacing (transient, not persisted)
  typingIndicator: boolean;
  agentBusy: boolean;

  // second brain
  /** Facts the human added themselves — interview/import facts are derived. */
  customFacts: BrainFact[];
  /** Heirs written into the inheritance bond's charter. */
  heirs: Heir[];
  /** Rules/context you two wrote into the charter — they feed the agents. */
  bondRules: { id: string; text: string; status: 'awaiting-partner' | 'active' }[];
  /** Live vault balances — deposits move them. */
  vaultBalances: Record<string, number>;
  /** One-time deposits you made, per bond (for the activity feed). */
  deposits: { id: string; bondId: string; amount: number }[];
  /** YOUR monthly standing order per bond. */
  standingOrders: Record<string, number>;
  /** Money the agents put to work, per bond — visible where the money lives. */
  investments: Record<string, { amount: number; apr: number }>;
  /** Proof of life: has the agent pinged you, and did you check in? */
  lifePingDone: boolean;
  heartbeatOk: boolean;
  /** Days until the dead-man's timer runs out — green far out, red near zero. */
  heartbeatDaysLeft: number;
  /** All bonds you hold — starts with the two mock bonds, grows via addBond. */
  bonds: Bond[];
  /** The chosen ENS label of the inheritance bond — null until the humans name it. */
  bondEnsLabel: string | null;
  /** Which bond requests route to by default — the inheritance bond, if one exists. */
  defaultBondId: string;

  // payment rails
  pullGranted: boolean;
  pendingReceipt: { vendor: string; amountUsdc: number; recipientEns: string; bond?: { id: string; partner: string } } | null;
  pendingAgentSpend: AgentSpendProposal | null;

  // chat
  messages: ChatMessage[];
  payments: Record<string, Payment>;

  answer: (questionId: string, answer: InterviewAnswer) => void;
  connectSources: (sources: string[]) => void;
  completeInterview: () => void;
  celebrateBorn: () => void;
  scanBill: () => void;
  /** userText: what the human actually typed (falls back to the button label). */
  requestPay: (userText?: string) => void;
  /** The user overrides the routing: this one's on me — personal wallet, no trust. */
  payAlone: () => void;
  grantPull: (userText?: string) => void;
  buyShared: () => void;
  buyPersonal: () => void;
  proposeShared: (label: string, recipientEns: string, amountUsdc: number, detail?: string, bond?: { id: string; partner: string }) => void;
  clearPendingAgentSpend: () => void;
  renegotiate: (paymentId: string) => void;
  confirmOnHito: (paymentId: string) => void;
  say: (text: string) => void;
  /** Free text to the REAL agent: model reply + live routing (personal vs shared). */
  chatLive: (userText: string) => void;
  addFact: (text: string) => void;
  removeFact: (id: string) => void;
  addHeir: (name: string, sharePct: number) => void;
  addBondRule: (text: string) => void;
  removeBondRule: (id: string) => void;
  /** Removal from the will ALSO needs the partner — status walk, then gone. */
  requestRemoveHeir: (id: string) => void;
  deposit: (bondId: string, amount: number) => void;
  setStandingOrder: (bondId: string, amount: number) => void;
  invest: (bondId: string, amount: number, apr: number) => void;
  /** Take money OUT of the invested package, back to liquid. Fails hard beyond the invested amount. */
  divest: (bondId: string, amount: number) => void;
  /** The agent writes YOU first: proof-of-life reminder + trustee heads-up. */
  lifePing: () => void;
  heartbeatChecked: () => void;
  /** Start a new bond — it only comes alive once the partner signs too. */
  addBond: (partner: string, type: Bond['type']) => void;
  setBondEnsLabel: (label: string) => void;
  setDefaultBond: (bondId: string) => void;
  resetAgent: () => void;

  /** Internal: enqueue agent output and run the production line. */
  _enqueue: (items: QueueItem[]) => void;
};

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => {
      /** Sequential processor: indicator → reveal one item → pause → next. */
      const processQueue = () => {
        if (processing) return;
        const item = queue.shift();
        if (!item) {
          set({ agentBusy: false, typingIndicator: false });
          return;
        }
        processing = true;
        set({ agentBusy: true });

        if (item.type === 'action') {
          item.run();
          processing = false;
          setTimeout(processQueue, 250);
          return;
        }

        // Think first…
        set({ typingIndicator: true });
        setTimeout(() => {
          set((s) => {
            const msg: ChatMessage =
              item.type === 'text'
                ? { id: mid(), role: 'agent', kind: 'text', text: item.text, typed: true, thinking: item.thinking }
                : item.type === 'receipt'
                  ? { id: mid(), role: 'agent', kind: 'receipt', vendor: item.vendor, amountUsdc: item.amountUsdc }
                  : item.type === 'grant'
                    ? { id: mid(), role: 'system', kind: 'grant' }
                    : { id: mid(), role: 'system', kind: 'choreo', paymentId: item.paymentId };
            return { typingIndicator: false, messages: [...s.messages, msg] };
          });
          // …then let it finish writing before the next thought.
          const settle = item.type === 'text' ? item.text.length * 18 + 700 : 700;
          setTimeout(() => {
            processing = false;
            processQueue();
          }, settle);
        }, 750);
      };

      return {
        step: 0,
        answers: {},
        askedIds: [],
        importedSources: [],
        agentReady: false,
        bornPending: false,
        partnerAgentReady: true,
        typingIndicator: false,
        agentBusy: false,
        customFacts: [],
        heirs: [],
        bondRules: [],
        vaultBalances: { ...VAULT_BALANCES },
        deposits: [],
        standingOrders: { ...STANDING_ORDERS },
        investments: {},
        lifePingDone: false,
        heartbeatOk: false,
        heartbeatDaysLeft: HEARTBEAT_START_DAYS_LEFT,
        bonds: [...BONDS],
        bondEnsLabel: null,
        defaultBondId: DEFAULT_BOND_ID,
        pullGranted: false,
        pendingReceipt: null,
        pendingAgentSpend: null,
        messages: [],
        payments: {},

        _enqueue: (items) => {
          queue.push(...items);
          processQueue();
        },

        answer: (questionId, a) =>
          set((s) => ({
            answers: { ...s.answers, [questionId]: a },
            askedIds: [...s.askedIds, questionId],
            step: s.step + 1,
          })),

        connectSources: (sources) =>
          set((s) => ({
            importedSources: sources,
            answers: {
              ...s.answers,
              name: { id: null, text: 'Ben' },
              job: { id: 'employed', text: 'Employed' },
              income: { id: 'gt4k', text: '€4k+ (LinkedIn estimate)' },
            },
          })),

        completeInterview: () =>
          set(() => ({ agentReady: true, bornPending: true, messages: [] })),

        celebrateBorn: () => {
          set(() => ({ bornPending: false }));
          get()._enqueue([
            {
              type: 'text',
              text: 'Hey. I’m alive — and I’m yours. I already know what matters to you. So: want me to pay a receipt, buy something, or look at your finances?',
            },
          ]);
        },

        scanBill: () => {
          get().say('Scanned a bill');
          set(() => ({
            pendingReceipt: { vendor: 'Cervejaria Ramiro', amountUsdc: 84.5, recipientEns: 'ramiro.eth' },
          }));
          get()._enqueue([
            { type: 'receipt', vendor: 'Cervejaria Ramiro', amountUsdc: 84.5 },
            {
              type: 'text',
              thinking: true,
              text: 'Reading it… restaurant receipt — Cervejaria Ramiro, Lisbon. Two covers, tonight. For both of you → not your personal budget. One for me and Alice’s agent to settle.',
            },
            { type: 'text', text: 'Want me to settle it fairly between the two of you?' },
          ]);
        },

        requestPay: (userText) => {
          const s = get();
          const receipt = s.pendingReceipt;
          if (!receipt) return;
          debugMockAgent('requestPay handler called (mock flow)', receipt);
          s.say(userText ?? 'Yes — settle it.');
          if (!s.pullGranted) {
            s._enqueue([
              {
                type: 'text',
                text: 'One thing first: our shared account holds no balance yet. Grant the bond pull access to your wallet — like a card on file — and each of you gets charged your fair share, in the moment.',
              },
            ]);
            return;
          }
          s.proposeShared(receipt.vendor, receipt.recipientEns, receipt.amountUsdc, undefined, receipt.bond);
        },

        payAlone: () => {
          const s = get();
          const receipt = s.pendingReceipt;
          if (!receipt) return;
          s.say('I’ll pay this one myself.');
          const id = mid();
          const underRule = receipt.amountUsdc <= 200;
          set((st) => ({
            pendingReceipt: null,
            payments: {
              ...st.payments,
              [id]: {
                id,
                label: receipt.vendor,
                recipientEns: receipt.recipientEns,
                amountUsdc: receipt.amountUsdc,
                shareYouPct: 100,
                shareYou: receipt.amountUsdc,
                sharePartner: 0,
                // Under your rule: phone authority, no release. Above: your hito alone.
                stage: (underRule ? 'confirmed' : 'proposed') as ChoreoStage,
                personal: true,
              },
            },
          }));
          s._enqueue([
            {
              type: 'text',
              thinking: true,
              text: underRule
                ? `Your treat → ${receipt.amountUsdc.toFixed(2)} sits under your €200 rule. Phone authority — I don’t need hardware for this.`
                : `Your treat → ${receipt.amountUsdc.toFixed(2)} is above your €200 rule. I need your hito for this one — yours alone, Alice stays out of it.`,
            },
            { type: 'choreo', paymentId: id },
          ]);
          if (underRule) {
            const advance = (stage: ChoreoStage) =>
              set((st) => {
                const p = st.payments[id];
                if (!p) return st;
                return { payments: { ...st.payments, [id]: { ...p, stage } } };
              });
            setTimeout(() => advance('pulled'), 5200);
            setTimeout(() => advance('paid'), 6600);
            setTimeout(() => {
              get()._enqueue([
                {
                  type: 'text',
                  text: `Paid — ${receipt.amountUsdc.toFixed(2)} USDC from your own wallet to ${receipt.recipientEns}. Nothing logged against the trust — Alice owes you nothing.`,
                },
              ]);
            }, 7200);
          }
        },

        grantPull: (userText) => {
          const s = get();
          if (userText) s.say(userText);
          set(() => ({ pullGranted: true }));
          s._enqueue([{ type: 'grant' }]);
          const receipt = s.pendingReceipt;
          if (receipt) s.proposeShared(receipt.vendor, receipt.recipientEns, receipt.amountUsdc, undefined, receipt.bond);
        },

        buyShared: () => {
          const s = get();
          debugMockAgent('Buy for us button called (mock flow bypasses 0G tools)');
          s.say('Buy two Kalorama festival tickets for us — about 120 USDC.');
          s._enqueue([
            {
              type: 'text',
              thinking: true,
              text: 'Tickets for two → that’s for both of you, not your personal budget. Routing to your default bond — the one with Alice, your inheritance bond. I’ll work this out with her agent.',
            },
            {
              type: 'text',
              thinking: true,
              text: 'Checked both calendars with Alice’s agent: you’re free Friday Sep 4 — Alice has yoga on the Saturday, you fly out the week after. Sep 4 it is. MEO Kalorama, Parque da Bela Vista — you two haven’t been out in six weeks.',
            },
          ]);
          if (!s.pullGranted) {
            set(() => ({
              pendingReceipt: { vendor: 'Kalorama tickets ×2', amountUsdc: 120, recipientEns: 'kalorama-tickets.eth' },
            }));
            s._enqueue([
              {
                type: 'text',
                text: 'Before I can book: our shared account holds no balance yet. Grant the bond pull access to your wallet — like a card on file.',
              },
            ]);
            return;
          }
          s.proposeShared('Kalorama tickets ×2', 'kalorama-tickets.eth', 120, 'MEO Kalorama · Parque da Bela Vista, Lisbon · Fri Sep 4, 19:00');
        },

        buyPersonal: () => {
          const s = get();
          s.say('And buy me new running shoes — about €90.');
          s._enqueue([
            {
              type: 'text',
              thinking: true,
              text: 'For you alone → your wallet, and €90 sits under your €200 rule. No trustee, no Alice.',
            },
            { type: 'text', text: 'Done — ordered, 90 USDC from your own wallet. Alice never hears about this one.' },
          ]);
        },

        proposeShared: (label, recipientEns, amountUsdc, detail, bond) => {
          const id = mid();
          const partner = bond?.partner ?? 'Alice';
          const shareYou = Math.round(amountUsdc * 10) / 100;
          const sharePartner = Math.round(amountUsdc * 90) / 100;
          debugMockAgent('mock proposal created', {
            paymentId: id,
            label,
            recipientEns,
            amountUsdc,
          });
          get()._enqueue([
            {
              type: 'text',
              thinking: true,
              text: `Talking to ${partner}’s agent… I argued your cash flow is tight this month; their side pointed to the income picture — ${partner} earns more right now. On the books it’s you 10%, ${partner} 90% — paid straight from your shared vault, nobody’s personal wallet is touched. The bond manager executes only what we both signed.`,
            },
            {
              type: 'action',
              run: () =>
                set((s) => ({
                  pendingReceipt: null,
                  payments: {
                    ...s.payments,
                    [id]: {
                      id, label, recipientEns, amountUsdc,
                      bondId: bond?.id ?? 'alice', partnerName: partner,
                      shareYouPct: 10, shareYou, sharePartner,
                      stage: 'proposed' as ChoreoStage,
                      detail,
                    },
                  },
                })),
            },
            { type: 'choreo', paymentId: id },
          ]);
        },

        clearPendingAgentSpend: () => set({ pendingAgentSpend: null }),

        renegotiate: (paymentId) => {
          const g = get();
          const partner = g.payments[paymentId]?.partnerName ?? 'Alice';
          g.say('I don’t feel good about this.');
          g._enqueue([
            { type: 'text', text: 'Heard. Your feeling counts as an interest — I’m going back in.' },
            {
              type: 'text',
              thinking: true,
              text: `${partner}’s agent offered: they cover this one fully, you take the next one. New proposal on the table.`,
            },
            {
              type: 'action',
              run: () =>
                set((s) => {
                  const p = s.payments[paymentId];
                  if (!p) return s;
                  return {
                    payments: {
                      ...s.payments,
                      [paymentId]: {
                        ...p,
                        shareYouPct: 0,
                        shareYou: 0,
                        sharePartner: p.amountUsdc,
                        note: `${partner} covers this one — you take the next.`,
                        renegotiated: true,
                      },
                    },
                  };
                }),
            },
          ]);
        },

        confirmOnHito: (paymentId) => {
          debugMockAgent('Release on your hito button called (simulated)', { paymentId });
          const advance = (stage: ChoreoStage) => {
            debugMockAgent(`mock payment advanced to ${stage}`, { paymentId });
            set((s) => {
              const p = s.payments[paymentId];
              if (!p) return s;
              return { payments: { ...s.payments, [paymentId]: { ...p, stage } } };
            });
          };
          advance('confirmed');
          setTimeout(() => advance('pulled'), 1500);
          setTimeout(() => advance('paid'), 3000);
          setTimeout(() => {
            const p = get().payments[paymentId];
            if (!p) return;
            const settled =
              p.shareYou === 0
                ? `Done — ${p.amountUsdc.toFixed(2)} USDC paid in full to ${p.recipientEns}. ${p.partnerName ?? 'Alice'} covered this one; the trustee remembers you take the next.`
                : `Done — ${p.recipientEns} is paid in full: ${p.amountUsdc.toFixed(2)} USDC from your shared vault, booked ${p.shareYou.toFixed(2)} you / ${p.sharePartner.toFixed(2)} ${p.partnerName ?? 'Alice'}.`;
            const delivery = p.detail
              ? ' The two ticket NFTs just landed in your shared vault — you’ll see them in both your World App wallets, and the entry QR generates straight from the NFT at the gate. Sep 4 is in both calendars.'
              : ' The receipt is archived in your charter history on 0G storage — auditable forever.';
            get()._enqueue([{ type: 'text', text: settled + delivery }]);
          }, 3600);
        },

        say: (text) =>
          set((s) => ({ messages: [...s.messages, { id: mid(), role: 'user', kind: 'text', text }] })),

        chatLive: (userText) => {
          const s = get();
          s.say(userText);
          // Model latency IS the thinking moment — indicator on while it works.
          set({ typingIndicator: true, agentBusy: true });
          const lab = (qid: string) => {
            const a = s.answers[qid];
            if (!a) return '—';
            const q = INTERVIEW_QUESTIONS.find((x) => x.id === qid);
            return a.id ? q?.options.find((o) => o.id === a.id)?.label ?? a.text : a.text;
          };
          fetch('/api/agent/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile: {
                name: s.answers.name?.text?.replace(/^just call me /i, '') || 'Ben',
                income: lab('income'), budget: lab('budget'), threshold: lab('threshold'),
                stress: lab('stress'), fear: lab('fear'),
              },
              facts: s.customFacts.map((f) => f.text),
              rules: s.bondRules.filter((r) => r.status === 'active').map((r) => r.text),
              bonds: s.bonds
                .filter((b) => b.status === 'active')
                .map((b) => ({
                  id: b.id, partner: b.partner, type: b.type,
                  isDefault: b.id === s.defaultBondId,
                  vaultBalanceUsdc: s.vaultBalances[b.id] ?? 0,
                })),
              history: s.messages
                .filter((m): m is Extract<ChatMessage, { kind: 'text' }> => m.kind === 'text')
                .slice(-10)
                .map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), text: m.text })),
              userText,
            }),
          })
            .then(async (res) => {
              const j = await res.json();
              if (!res.ok) throw new Error(j.error ?? `chat API ${res.status}`);
              set({ typingIndicator: false });
              get()._enqueue([{ type: 'text', text: j.say }]);
              const a = j.action;
              if (process.env.NODE_ENV !== 'production') {
                console.info('[agent-tools] browser received action', a);
              }
              if (a?.type === 'propose_spend' && typeof a.amountUsdc === 'number') {
                if (process.env.NODE_ENV !== 'production') {
                  console.info('[agent-tools] propose_spend handler called', {
                    recipient: a.recipient,
                    amountUsdc: a.amountUsdc,
                  });
                }
                const st = get();
                const active = st.bonds.filter((b) => b.status === 'active');
                const target =
                  active.find((b) => b.id === a.bondId) ??
                  active.find((b) => b.id === st.defaultBondId) ??
                  active[0];
                if (!target) throw new Error('propose_shared without any active bond');
                const bond = { id: target.id, partner: target.partner };
                set(() => ({
                  pendingAgentSpend: {
                    label: a.label ?? 'Shared purchase',
                    recipient: a.recipient ?? 'merchant.eth',
                    amountUsdc: a.amountUsdc,
                    detail: a.detail ?? undefined,
                    bond,
                  },
                }));
                st._enqueue([
                  {
                    type: 'text',
                    text: `I prepared ${a.label ?? 'this shared spend'} for your review. Approve it with your hito to propose ${a.amountUsdc.toFixed(2)} USDC from the ${target.partner} bond vault.`,
                  },
                ]);
              } else if (a?.type === 'cancel_spend' && typeof a.spendId === 'string') {
                if (process.env.NODE_ENV !== 'production') {
                  console.info('[agent-tools] cancel_spend handler called', {
                    spendId: a.spendId,
                  });
                }
                get()._enqueue([
                  {
                    type: 'text',
                    text: `I prepared cancellation of ${a.spendId.slice(0, 10)}… for your review. No transaction has been sent.`,
                  },
                ]);
              }
            })
            .catch((e: Error) => {
              set({ typingIndicator: false, agentBusy: false });
              get()._enqueue([{ type: 'text', text: `Something broke on my side: ${e.message}` }]);
            });
        },

        addFact: (text) =>
          set((s) => ({ customFacts: [...s.customFacts, { id: mid(), text, source: 'You' }] })),

        removeFact: (id) =>
          set((s) => ({ customFacts: s.customFacts.filter((f) => f.id !== id) })),

        addHeir: (name, sharePct) => {
          const allocated = get().heirs.reduce((sum, h) => sum + h.sharePct, 0);
          if (allocated + sharePct > 100)
            throw new Error(`The will cannot allocate more than 100% — ${allocated}% already assigned.`);
          const id = mid();
          set((s) => ({
            heirs: [...s.heirs, { id, name, sharePct, status: 'awaiting-partner' as const }],
          }));
          // A will entry needs both signatures — Alice releases on her device.
          setTimeout(
            () =>
              set((s) => ({
                heirs: s.heirs.map((h) => (h.id === id ? { ...h, status: 'pending-nfc' as const } : h)),
              })),
            3200,
          );
        },

        addBondRule: (text) => {
          const id = mid();
          set((s) => ({ bondRules: [...s.bondRules, { id, text, status: 'awaiting-partner' as const }] }));
          // Rules bind both of you — Alice co-signs on her device.
          setTimeout(
            () =>
              set((s) => ({
                bondRules: s.bondRules.map((r) => (r.id === id ? { ...r, status: 'active' as const } : r)),
              })),
            3200,
          );
        },

        removeBondRule: (id) =>
          set((s) => ({ bondRules: s.bondRules.filter((r) => r.id !== id) })),

        requestRemoveHeir: (id) => {
          set((s) => ({
            heirs: s.heirs.map((h) => (h.id === id ? { ...h, status: 'awaiting-removal' as const } : h)),
          }));
          // Alice co-signs the removal on her device, then the entry is gone.
          setTimeout(() => set((s) => ({ heirs: s.heirs.filter((h) => h.id !== id) })), 3200);
        },

        deposit: (bondId, amount) =>
          set((s) => ({
            vaultBalances: { ...s.vaultBalances, [bondId]: (s.vaultBalances[bondId] ?? 0) + amount },
            deposits: [...s.deposits, { id: mid(), bondId, amount }],
          })),

        setStandingOrder: (bondId, amount) =>
          set((s) => ({ standingOrders: { ...s.standingOrders, [bondId]: amount } })),

        invest: (bondId, amount, apr) =>
          set((s) => ({ investments: { ...s.investments, [bondId]: { amount, apr } } })),

        divest: (bondId, amount) =>
          set((s) => {
            const inv = s.investments[bondId];
            if (!inv || amount > inv.amount) throw new Error(`divest ${amount} exceeds invested ${inv?.amount ?? 0} on ${bondId}`);
            const investments = { ...s.investments };
            if (amount === inv.amount) delete investments[bondId];
            else investments[bondId] = { ...inv, amount: inv.amount - amount };
            return { investments };
          }),

        lifePing: () => {
          if (get().lifePingDone) return;
          const days = get().heartbeatDaysLeft;
          set(() => ({ lifePingDone: true }));
          get()._enqueue([
            {
              type: 'text',
              text: `One thing from my side today: your proof-of-life timer runs out in ${days} days — ten seconds, look into the camera, and it resets to 90. It keeps every claim and the will exactly as you set them. And a heads-up: the trustee sent you and Alice an opportunity — I already checked it, your buffer stays untouched.`,
            },
          ]);
        },

        heartbeatChecked: () => {
          set(() => ({ heartbeatOk: true, heartbeatDaysLeft: HEARTBEAT_CYCLE_DAYS }));
          get()._enqueue([
            {
              type: 'text',
              text: 'Alive and verified — heartbeat renewed on-chain, Alice can see it’s green. Your timer is back to 90 days; I’ll remind you before it gets tight.',
            },
          ]);
        },

        addBond: (partner, type) => {
          const id = `b-${mid()}`;
          set((s) => ({
            bonds: [...s.bonds, { id, partner, type, status: 'awaiting-partner' as const }],
            vaultBalances: { ...s.vaultBalances, [id]: 0 },
            standingOrders: { ...s.standingOrders, [id]: 0 },
          }));
          // A bond exists only once BOTH humans sign — the partner accepts on their device.
          setTimeout(
            () =>
              set((s) => ({
                bonds: s.bonds.map((b) => (b.id === id ? { ...b, status: 'active' as const } : b)),
              })),
            4200,
          );
        },

        setBondEnsLabel: (label) => set(() => ({ bondEnsLabel: label })),

        setDefaultBond: (bondId) => set(() => ({ defaultBondId: bondId })),

        resetAgent: () => {
          queue = [];
          processing = false;
          set(() => ({
            step: 0,
            answers: {},
            askedIds: [],
            importedSources: [],
            agentReady: false,
            bornPending: false,
            typingIndicator: false,
            agentBusy: false,
            pullGranted: false,
            pendingReceipt: null,
            pendingAgentSpend: null,
            messages: [],
            payments: {},
            customFacts: [],
            heirs: [],
            bondRules: [],
            vaultBalances: { ...VAULT_BALANCES },
            deposits: [],
            standingOrders: { ...STANDING_ORDERS },
            investments: {},
            lifePingDone: false,
            heartbeatOk: false,
            heartbeatDaysLeft: HEARTBEAT_START_DAYS_LEFT,
            bonds: [...BONDS],
            bondEnsLabel: null,
          }));
        },
      };
    },
    {
      // Mode-scoped keys: the live app must never rehydrate playground demo data
      // (heirs, Alice chats, fake payments) persisted by a mock session — and vice versa.
      name: USE_MOCKS ? 'humanbond-agent-dummy-v2' : 'humanbond-agent-live-v1',
      // Transient pacing state never persists — a reload starts calm.
      partialize: (s) => ({
        step: s.step,
        answers: s.answers,
        askedIds: s.askedIds,
        importedSources: s.importedSources,
        agentReady: s.agentReady,
        bornPending: s.bornPending,
        partnerAgentReady: s.partnerAgentReady,
        customFacts: s.customFacts,
        heirs: s.heirs,
        bondRules: s.bondRules,
        vaultBalances: s.vaultBalances,
        deposits: s.deposits,
        standingOrders: s.standingOrders,
        investments: s.investments,
        lifePingDone: s.lifePingDone,
        heartbeatOk: s.heartbeatOk,
        heartbeatDaysLeft: s.heartbeatDaysLeft,
        bonds: s.bonds,
        bondEnsLabel: s.bondEnsLabel,
        defaultBondId: s.defaultBondId,
        pullGranted: s.pullGranted,
        pendingReceipt: s.pendingReceipt,
        pendingAgentSpend: s.pendingAgentSpend,
        // Strip typed flags: after a reload, history renders instantly — only NEW messages type.
        messages: s.messages.map((m) => (m.kind === 'text' && m.typed ? { ...m, typed: false } : m)),
        payments: s.payments,
      }),
    },
  ),
);

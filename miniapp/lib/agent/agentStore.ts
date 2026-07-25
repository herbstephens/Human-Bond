/**
 * Personal-agent clickable dummy — state for the interview and the chat.
 *
 * Payment model (per team decision Sat): the shared account starts EMPTY.
 * Both partners grant the bond pull access to their personal wallets — like
 * a card on file. At payment time the personal agent and the trustee agent
 * compare incomes and split the bill fairly (demo: you 10% / Alice 90%),
 * then each share is pulled from its wallet in the moment, like a card charge.
 *
 * Self-contained on purpose. Integration points for the real build:
 * `grantPull` → ERC-20 approve to the bond module; `startPayment` →
 * trustee backend + BondVaultModule; typing/reasoning → real agent stream.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

// ---------------------------------------------------------------------------
// Chat + fair-split payment choreography

export type ChoreoStage = 'requested' | 'charter' | 'fairness' | 'pulled' | 'paid';

export type ChatMessage =
  | { id: string; role: 'agent' | 'user'; kind: 'text'; text: string; typed?: boolean; thinking?: boolean }
  | { id: string; role: 'agent'; kind: 'receipt'; vendor: string; amountUsdc: number }
  | { id: string; role: 'system'; kind: 'grant' }
  | { id: string; role: 'system'; kind: 'choreo'; paymentId: string };

export type Payment = {
  id: string;
  vendor: string;
  amountUsdc: number;
  /** Fair split, decided by your agent + the trustee from both incomes. */
  shareYouPct: number;
  shareYou: number;
  sharePartner: number;
  stage: ChoreoStage;
};

let nextId = 1;
const mid = () => `m${nextId++}-${Date.now()}`;

/** Sources the agent can pull an existing self from. */
export const IMPORT_SOURCES = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X / Twitter' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'claude', label: 'Claude' },
] as const;

type AgentState = {
  // interview
  step: number;
  answers: Record<string, InterviewAnswer>;
  /** Question ids answered live in the chat (imported ones never appear as Q&A). */
  askedIds: string[];
  /** Sources connected during import — empty means classic interview. */
  importedSources: string[];
  agentReady: boolean;
  /** True right after the interview — the "your agent is alive" celebration is pending. */
  bornPending: boolean;
  partnerAgentReady: boolean;

  // payment rails
  /** Both partners granted the bond pull access to their wallets (card on file). */
  pullGranted: boolean;
  /** A receipt is parsed and waiting for the grant before it can be paid. */
  pendingReceipt: { vendor: string; amountUsdc: number } | null;

  // chat
  messages: ChatMessage[];
  payments: Record<string, Payment>;

  answer: (questionId: string, answer: InterviewAnswer) => void;
  /** Pull what's already out there — prefills name, job and an income estimate. */
  connectSources: (sources: string[]) => void;
  completeInterview: () => void;
  /** Dismiss the born celebration; the agent says hello (one bubble, typed live). */
  celebrateBorn: () => void;
  scanBill: () => void;
  /** User wants the bill settled. Inserts the grant step if pull access is missing. */
  requestPay: () => void;
  grantPull: () => void;
  startPayment: (vendor: string, amountUsdc: number) => void;
  advanceChoreo: (paymentId: string) => void;
  say: (text: string) => void;
  agentSay: (text: string, opts?: { typed?: boolean; thinking?: boolean }) => void;
  resetAgent: () => void;
};

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      step: 0,
      answers: {},
      askedIds: [],
      importedSources: [],
      agentReady: false,
      bornPending: false,
      partnerAgentReady: true,
      pullGranted: false,
      pendingReceipt: null,
      messages: [],
      payments: {},

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
        set(() => ({
          agentReady: true,
          bornPending: true,
          messages: [],
        })),

      celebrateBorn: () => {
        set(() => ({ bornPending: false }));
        // One bubble, typed live — hello, who I am, what next.
        get().agentSay(
          'Hey. I’m alive — and I’m yours. I already know what matters to you. So: want me to pay a receipt, buy something for you, or look at your finances?',
          { typed: true },
        );
      },

      scanBill: () => {
        set((s) => ({
          messages: [
            ...s.messages,
            { id: mid(), role: 'user', kind: 'text', text: 'Scanned a bill' },
            { id: mid(), role: 'agent', kind: 'receipt', vendor: 'Cervejaria Ramiro', amountUsdc: 84.5 },
          ],
          pendingReceipt: { vendor: 'Cervejaria Ramiro', amountUsdc: 84.5 },
        }));
        // The reasoning, visible and typed — then the conclusion.
        setTimeout(
          () =>
            get().agentSay(
              'Reading it… restaurant receipt — Cervejaria Ramiro, Lisbon. Two covers, tonight. That makes it a shared expense under your charter.',
              { typed: true, thinking: true },
            ),
          600,
        );
        setTimeout(
          () => get().agentSay('Want me to settle it fairly between the two of you?', { typed: true }),
          3400,
        );
      },

      requestPay: () => {
        const s = get();
        const receipt = s.pendingReceipt;
        if (!receipt) return;
        s.say('Yes — settle it.');
        if (!s.pullGranted) {
          // The shared account is empty — the funding moment.
          setTimeout(
            () =>
              s.agentSay(
                'One thing first: our shared account is at zero. Grant the bond pull access to your wallet — like a card on file — and I can charge each of you your fair share, in the moment.',
                { typed: true },
              ),
            500,
          );
          return;
        }
        setTimeout(() => s.startPayment(receipt.vendor, receipt.amountUsdc), 400);
      },

      grantPull: () => {
        const s = get();
        set((st) => ({
          pullGranted: true,
          messages: [...st.messages, { id: mid(), role: 'system', kind: 'grant' }],
        }));
        // Alice's agent mirrors the grant on her side, then the payment runs.
        const receipt = s.pendingReceipt;
        if (receipt) {
          setTimeout(() => get().startPayment(receipt.vendor, receipt.amountUsdc), 1600);
        }
      },

      startPayment: (vendor, amountUsdc) => {
        const id = mid();
        const shareYouPct = 10; // trustee compared incomes: Alice earns more right now
        const shareYou = Math.round(amountUsdc * shareYouPct) / 100;
        const sharePartner = Math.round(amountUsdc * (100 - shareYouPct)) / 100;
        set((s) => ({
          pendingReceipt: null,
          payments: {
            ...s.payments,
            [id]: { id, vendor, amountUsdc, shareYouPct, shareYou, sharePartner, stage: 'requested' },
          },
          messages: [...s.messages, { id: mid(), role: 'system', kind: 'choreo', paymentId: id }],
        }));
        // The trustee works through the stages on its own clock.
        setTimeout(() => get().advanceChoreo(id), 1100);
        setTimeout(() => get().advanceChoreo(id), 2300);
        setTimeout(() => get().advanceChoreo(id), 3700);
        setTimeout(() => get().advanceChoreo(id), 5100);
        setTimeout(
          () =>
            get().agentSay(
              `Done — ${vendor} is paid. Settled fairly: ${shareYou.toFixed(2)} USDC pulled from your wallet, ${sharePartner.toFixed(2)} from Alice’s. Filed in your history.`,
              { typed: true },
            ),
          6200,
        );
      },

      advanceChoreo: (paymentId) =>
        set((s) => {
          const p = s.payments[paymentId];
          if (!p) return s;
          const order: ChoreoStage[] = ['requested', 'charter', 'fairness', 'pulled', 'paid'];
          const idx = order.indexOf(p.stage);
          if (idx < 0 || idx >= order.length - 1) return s;
          return { payments: { ...s.payments, [paymentId]: { ...p, stage: order[idx + 1] } } };
        }),

      say: (text) =>
        set((s) => ({ messages: [...s.messages, { id: mid(), role: 'user', kind: 'text', text }] })),

      agentSay: (text, opts) =>
        set((s) => ({
          messages: [
            ...s.messages,
            { id: mid(), role: 'agent', kind: 'text', text, typed: opts?.typed, thinking: opts?.thinking },
          ],
        })),

      resetAgent: () =>
        set(() => ({
          step: 0,
          answers: {},
          askedIds: [],
          importedSources: [],
          agentReady: false,
          bornPending: false,
          pullGranted: false,
          pendingReceipt: null,
          messages: [],
          payments: {},
        })),
    }),
    // v2: key bumped so stale pre-rework chats (the old two-bubble greeting) don't resurface
    { name: 'humanbond-agent-dummy-v2' },
  ),
);

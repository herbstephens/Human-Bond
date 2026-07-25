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

/**
 * A shared payment's life: the agents negotiate → the human SEES the proposal
 * and releases it on hito → shares are pulled → the recipient is paid.
 * Money never moves on agent agreement alone.
 */
export type ChoreoStage = 'proposed' | 'confirmed' | 'pulled' | 'paid';

export type ChatMessage =
  | { id: string; role: 'agent' | 'user'; kind: 'text'; text: string; typed?: boolean; thinking?: boolean }
  | { id: string; role: 'agent'; kind: 'receipt'; vendor: string; amountUsdc: number }
  | { id: string; role: 'system'; kind: 'grant' }
  | { id: string; role: 'system'; kind: 'choreo'; paymentId: string };

export type Payment = {
  id: string;
  /** What is being paid for, human words. */
  label: string;
  /** Who receives the money — the counterparty's ENS. */
  recipientEns: string;
  amountUsdc: number;
  /** Fair split, negotiated by your agent + the trustee from both incomes. */
  shareYouPct: number;
  shareYou: number;
  sharePartner: number;
  stage: ChoreoStage;
  /** Set after a feelings-loop renegotiation ("Alice covers this one…"). */
  note?: string;
  /** Only one renegotiation round in the dummy. */
  renegotiated?: boolean;
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
  /** A shared expense parsed/requested and waiting for the grant before proposal. */
  pendingReceipt: { vendor: string; amountUsdc: number; recipientEns: string } | null;

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
  /** Shared purchase: routed to the trustee, negotiated, proposed. */
  buyShared: () => void;
  /** Internal: negotiation (typed) → proposal card awaiting hito release. */
  proposeShared: (label: string, recipientEns: string, amountUsdc: number, fromReceipt: boolean) => void;
  /** Personal purchase: own wallet, own rule — the partner is never involved. */
  buyPersonal: () => void;
  /** The feelings loop: "I don't feel good about this" → agents renegotiate. */
  renegotiate: (paymentId: string) => void;
  /** The human releases the negotiated proposal on their hito. */
  confirmOnHito: (paymentId: string) => void;
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
          pendingReceipt: { vendor: 'Cervejaria Ramiro', amountUsdc: 84.5, recipientEns: 'ramiro.eth' },
        }));
        // Visible reasoning: read → CLASSIFY (the routing decision) → conclusion.
        setTimeout(
          () =>
            get().agentSay(
              'Reading it… restaurant receipt — Cervejaria Ramiro, Lisbon. Two covers, tonight. For both of you → not your personal budget. This goes to the trustee.',
              { typed: true, thinking: true },
            ),
          600,
        );
        setTimeout(
          () => get().agentSay('Want me to settle it fairly between the two of you?', { typed: true }),
          3600,
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
                'One thing first: our shared account holds no balance yet. Grant the bond pull access to your wallet — like a card on file — and each of you gets charged your fair share, in the moment.',
                { typed: true },
              ),
            500,
          );
          return;
        }
        get().proposeShared(receipt.vendor, receipt.recipientEns, receipt.amountUsdc, true);
      },

      grantPull: () => {
        const s = get();
        set((st) => ({
          pullGranted: true,
          messages: [...st.messages, { id: mid(), role: 'system', kind: 'grant' }],
        }));
        // Alice's agent mirrors the grant on her side, then negotiation starts.
        const receipt = s.pendingReceipt;
        if (receipt) {
          setTimeout(() => get().proposeShared(receipt.vendor, receipt.recipientEns, receipt.amountUsdc, true), 1400);
        }
      },

      buyShared: () => {
        const s = get();
        s.say('Buy two Kalorama festival tickets for us — about 120 USDC.');
        // Routing decision, visible.
        setTimeout(
          () =>
            s.agentSay(
              'Tickets for two → that’s for both of you, not your personal budget. Taking it to the trustee.',
              { typed: true, thinking: true },
            ),
          700,
        );
        if (!s.pullGranted) {
          setTimeout(
            () =>
              get().agentSay(
                'Before I can: our shared account holds no balance yet. Grant the bond pull access to your wallet — like a card on file.',
                { typed: true },
              ),
            2800,
          );
          set(() => ({
            pendingReceipt: { vendor: 'Kalorama tickets ×2', amountUsdc: 120, recipientEns: 'kalorama-tickets.eth' },
          }));
          return;
        }
        get().proposeShared('Kalorama tickets ×2', 'kalorama-tickets.eth', 120, false);
      },

      buyPersonal: () => {
        const s = get();
        s.say('And buy me new running shoes — about €90.');
        setTimeout(
          () =>
            s.agentSay(
              'For you alone → your wallet, and €90 sits under your €200 rule. No trustee, no Alice.',
              { typed: true, thinking: true },
            ),
          700,
        );
        setTimeout(
          () =>
            get().agentSay(
              'Done — ordered, 90 USDC from your own wallet. Alice never hears about this one.',
              { typed: true },
            ),
          3200,
        );
      },

      /** Internal: negotiation (typed, visible) → proposal card awaiting hito release. */
      proposeShared: (label: string, recipientEns: string, amountUsdc: number, fromReceipt: boolean) => {
        const g = get();
        const delay = fromReceipt ? 500 : 2600;
        setTimeout(
          () =>
            g.agentSay(
              'Negotiating with the trustee… I argued your cash flow is tight this month. The trustee compared incomes — Alice earns more right now — and came back with: you 10%, Alice 90%.',
              { typed: true, thinking: true },
            ),
          delay,
        );
        setTimeout(() => {
          const id = mid();
          const shareYou = Math.round(amountUsdc * 10) / 100;
          const sharePartner = Math.round(amountUsdc * 90) / 100;
          set((s) => ({
            pendingReceipt: null,
            payments: {
              ...s.payments,
              [id]: {
                id, label, recipientEns, amountUsdc,
                shareYouPct: 10, shareYou, sharePartner,
                stage: 'proposed' as ChoreoStage,
              },
            },
            messages: [...s.messages, { id: mid(), role: 'system', kind: 'choreo', paymentId: id }],
          }));
        }, delay + 3400);
      },

      renegotiate: (paymentId) => {
        const g = get();
        g.say('I don’t feel good about this.');
        setTimeout(
          () => g.agentSay('Heard. Your feeling counts as an interest — I’m going back in.', { typed: true }),
          600,
        );
        setTimeout(
          () =>
            g.agentSay(
              'Alice’s agent offered: she covers this one fully, you take the next one. New proposal on the table.',
              { typed: true, thinking: true },
            ),
          2600,
        );
        setTimeout(() => {
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
                  note: 'Alice covers this one — you take the next.',
                  renegotiated: true,
                },
              },
            };
          });
        }, 4600);
      },

      confirmOnHito: (paymentId) => {
        const advance = (stage: ChoreoStage) =>
          set((s) => {
            const p = s.payments[paymentId];
            if (!p) return s;
            return { payments: { ...s.payments, [paymentId]: { ...p, stage } } };
          });
        advance('confirmed');
        setTimeout(() => advance('pulled'), 1500);
        setTimeout(() => advance('paid'), 3000);
        setTimeout(() => {
          const p = get().payments[paymentId];
          if (!p) return;
          get().agentSay(
            p.shareYou === 0
              ? `Done — ${p.recipientEns} is paid. Alice covered this one; the trustee remembers you take the next.`
              : `Done — ${p.recipientEns} is paid. ${p.shareYou.toFixed(2)} USDC pulled from your wallet, ${p.sharePartner.toFixed(2)} from Alice’s. Filed in your history.`,
            { typed: true },
          );
        }, 4000);
      },

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

/**
 * Personal-agent clickable dummy — state for the interview and the chat.
 *
 * Self-contained on purpose: the payment choreography simulates the vault
 * spend lifecycle using the same status vocabulary as lib/vault/types
 * (awaiting_partner → executed_approved), but holds its own state so the
 * dummy never imports mock-mode-only modules. Integration point for the
 * real thing: replace `startPayment`/`approveAsPartner` with
 * BondVaultModule proposeSpend/approveSpend + the trustee-agent backend.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Interview

export type InterviewAnswerOption = { id: string; label: string };
export type InterviewQuestion = {
  id: string;
  /** What the agent says when asking. */
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
// Chat + payment choreography

export type ChoreoStage =
  | 'requested'        // your agent → trustee
  | 'charter_checked'  // trustee validated against charter
  | 'proposal_created' // Safe proposal exists
  | 'awaiting_partner' // you approved, partner pending
  | 'paid';            // executed

export type ChatMessage =
  | { id: string; role: 'agent' | 'user'; kind: 'text'; text: string }
  | { id: string; role: 'agent'; kind: 'receipt'; vendor: string; amountUsdc: number }
  | { id: string; role: 'system'; kind: 'choreo'; paymentId: string };

export type Payment = {
  id: string;
  vendor: string;
  amountUsdc: number;
  stage: ChoreoStage;
};

let nextId = 1;
const mid = () => `m${nextId++}-${Date.now()}`;

type AgentState = {
  // interview
  step: number;
  answers: Record<string, InterviewAnswer>;
  agentReady: boolean;
  /** Demo assumption: the partner finished their interview already. */
  partnerAgentReady: boolean;

  // chat
  messages: ChatMessage[];
  payments: Record<string, Payment>;

  /** Answer the current question — via chip (id + label) or typed text (id null). */
  answer: (questionId: string, answer: InterviewAnswer) => void;
  completeInterview: () => void;
  scanBill: () => void;
  /** User taps "Pay from shared account" on the receipt. */
  startPayment: (vendor: string, amountUsdc: number) => void;
  /** Trustee advances automatically; partner approval is the demo control. */
  advanceChoreo: (paymentId: string) => void;
  approveAsPartner: (paymentId: string) => void;
  say: (text: string) => void;
  agentSay: (text: string) => void;
  resetAgent: () => void;
};

export const useAgentStore = create<AgentState>()(
  persist(
    (set, get) => ({
      step: 0,
      answers: {},
      agentReady: false,
      partnerAgentReady: true,
      messages: [],
      payments: {},

      answer: (questionId, a) =>
        set((s) => ({
          answers: { ...s.answers, [questionId]: a },
          step: s.step + 1,
        })),

      completeInterview: () =>
        set(() => ({
          agentReady: true,
          messages: [
            {
              id: mid(),
              role: 'agent',
              kind: 'text',
              text: 'I’m ready. Scan a bill whenever you want — or just ask me something.',
            },
          ],
        })),

      scanBill: () => {
        const receipt: ChatMessage = {
          id: mid(),
          role: 'agent',
          kind: 'receipt',
          vendor: 'Cervejaria Ramiro',
          amountUsdc: 84.5,
        };
        set((s) => ({
          messages: [
            ...s.messages,
            { id: mid(), role: 'user', kind: 'text', text: 'Scanned a bill' },
            receipt,
            {
              id: mid(),
              role: 'agent',
              kind: 'text',
              text: 'Dinner at Cervejaria Ramiro — 84.50 USDC. Per your charter this is a shared expense, paid from the main account. Want me to arrange it?',
            },
          ],
        }));
      },

      startPayment: (vendor, amountUsdc) => {
        const id = mid();
        set((s) => ({
          payments: { ...s.payments, [id]: { id, vendor, amountUsdc, stage: 'requested' } },
          messages: [
            ...s.messages,
            { id: mid(), role: 'user', kind: 'text', text: 'Pay it from the shared account.' },
            { id: mid(), role: 'system', kind: 'choreo', paymentId: id },
          ],
        }));
        // Trustee works on its own clock: request → charter check → proposal.
        setTimeout(() => get().advanceChoreo(id), 1200);
        setTimeout(() => get().advanceChoreo(id), 2400);
        setTimeout(() => get().advanceChoreo(id), 3600);
      },

      advanceChoreo: (paymentId) =>
        set((s) => {
          const p = s.payments[paymentId];
          if (!p) return s;
          const order: ChoreoStage[] = ['requested', 'charter_checked', 'proposal_created', 'awaiting_partner', 'paid'];
          const idx = order.indexOf(p.stage);
          // Stops at awaiting_partner — only approveAsPartner moves past it.
          if (idx < 0 || p.stage === 'awaiting_partner' || p.stage === 'paid') return s;
          const stage = order[idx + 1];
          return { payments: { ...s.payments, [paymentId]: { ...p, stage } } };
        }),

      approveAsPartner: (paymentId) =>
        set((s) => {
          const p = s.payments[paymentId];
          if (!p || p.stage !== 'awaiting_partner') return s;
          return {
            payments: { ...s.payments, [paymentId]: { ...p, stage: 'paid' } },
            messages: [
              ...s.messages,
              {
                id: mid(),
                role: 'agent',
                kind: 'text',
                text: 'Done — Alice confirmed on her device, 84.50 USDC paid from the shared account. The receipt is filed in your charter history.',
              },
            ],
          };
        }),

      say: (text) =>
        set((s) => ({ messages: [...s.messages, { id: mid(), role: 'user', kind: 'text', text }] })),

      agentSay: (text) =>
        set((s) => ({ messages: [...s.messages, { id: mid(), role: 'agent', kind: 'text', text }] })),

      resetAgent: () =>
        set(() => ({ step: 0, answers: {}, agentReady: false, messages: [], payments: {} })),
    }),
    { name: 'humanbond-agent-dummy' },
  ),
);

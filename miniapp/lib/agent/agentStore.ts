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

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'name',
    ask: 'First things first — what should I call you?',
    options: [
      { id: 'world', label: 'Use my World username' },
      { id: 'ben', label: 'Ben' },
      { id: 'boss', label: '"Boss" works' },
    ],
  },
  {
    id: 'job',
    ask: 'What does your work life look like right now?',
    options: [
      { id: 'employed', label: 'Employed' },
      { id: 'self', label: 'Self-employed' },
      { id: 'between', label: 'Between jobs' },
      { id: 'student', label: 'Studying' },
    ],
  },
  {
    id: 'income',
    ask: 'Roughly, what lands in your account each month?',
    options: [
      { id: 'lt2k', label: 'Under €2k' },
      { id: '2k4k', label: '€2–4k' },
      { id: '4k6k', label: '€4–6k' },
      { id: 'gt6k', label: '€6k+' },
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
      { id: 'plan', label: 'I start planning immediately' },
    ],
  },
  {
    id: 'fear',
    ask: 'And your biggest money fear?',
    options: [
      { id: 'emergency', label: 'No emergency buffer' },
      { id: 'dependent', label: 'Being dependent' },
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

/** How the agent mirrors the profile back, per answer. */
export function profileSummary(answers: Record<string, string>): string[] {
  const lines: string[] = [];
  const income =
    answers.income === 'lt2k' ? 'under €2k' :
    answers.income === '2k4k' ? '€2–4k' :
    answers.income === '4k6k' ? '€4–6k' : '€6k+';
  lines.push(`You bring in ${income} a month and your protected personal budget is ${
    answers.budget === 'b200' ? '€200' : answers.budget === 'b500' ? '€500' : '€1.000'
  }.`);
  lines.push(
    answers.stress === 'avoid'
      ? 'Big bills make you look away — so I will open them, summarize them in one line, and never ambush you with numbers.'
      : answers.stress === 'stress'
        ? 'Big bills stress you — so I will always lead with "this is handled" before any numbers.'
        : 'You keep a level head with big bills — I will give it to you straight.',
  );
  lines.push(
    answers.fear === 'conflict'
      ? 'Your biggest fear is money conflict — I will route anything sensitive through the trustee before it reaches your partner.'
      : answers.fear === 'emergency'
        ? 'Your biggest fear is an empty buffer — I will defend the emergency fund before any discretionary spend.'
        : answers.fear === 'debt'
          ? 'You fear debt most — I will flag anything that smells like leverage.'
          : 'You fear dependence most — I will keep your own claims and your own budget visible at all times.',
  );
  lines.push(`I ask you first ${
    answers.threshold === 't50' ? 'for everything over €50' :
    answers.threshold === 't200' ? 'for everything over €200' : 'only when something looks unusual'
  }.`);
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
  answers: Record<string, string>;
  agentReady: boolean;
  /** Demo assumption: the partner finished their interview already. */
  partnerAgentReady: boolean;

  // chat
  messages: ChatMessage[];
  payments: Record<string, Payment>;

  answer: (questionId: string, optionId: string) => void;
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

      answer: (questionId, optionId) =>
        set((s) => ({
          answers: { ...s.answers, [questionId]: optionId },
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
            { id: mid(), role: 'user', kind: 'text', text: '📷 Scanned a bill' },
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

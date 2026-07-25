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

  // payment rails
  pullGranted: boolean;
  pendingReceipt: { vendor: string; amountUsdc: number; recipientEns: string } | null;

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
  grantPull: (userText?: string) => void;
  buyShared: () => void;
  buyPersonal: () => void;
  proposeShared: (label: string, recipientEns: string, amountUsdc: number, detail?: string) => void;
  renegotiate: (paymentId: string) => void;
  confirmOnHito: (paymentId: string) => void;
  say: (text: string) => void;
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
        pullGranted: false,
        pendingReceipt: null,
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
          s.proposeShared(receipt.vendor, receipt.recipientEns, receipt.amountUsdc);
        },

        grantPull: (userText) => {
          const s = get();
          if (userText) s.say(userText);
          set(() => ({ pullGranted: true }));
          s._enqueue([{ type: 'grant' }]);
          const receipt = s.pendingReceipt;
          if (receipt) s.proposeShared(receipt.vendor, receipt.recipientEns, receipt.amountUsdc);
        },

        buyShared: () => {
          const s = get();
          s.say('Buy two Kalorama festival tickets for us — about 120 USDC.');
          s._enqueue([
            {
              type: 'text',
              thinking: true,
              text: 'Tickets for two → that’s for both of you, not your personal budget. I’ll work this out with Alice’s agent.',
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

        proposeShared: (label, recipientEns, amountUsdc, detail) => {
          const id = mid();
          const shareYou = Math.round(amountUsdc * 10) / 100;
          const sharePartner = Math.round(amountUsdc * 90) / 100;
          get()._enqueue([
            {
              type: 'text',
              thinking: true,
              text: 'Talking to Alice’s agent… I argued your cash flow is tight this month; she pointed to the income picture — Alice earns more right now. We agreed: you 10%, Alice 90%. The trustee only executes what we settled.',
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

        renegotiate: (paymentId) => {
          const g = get();
          g.say('I don’t feel good about this.');
          g._enqueue([
            { type: 'text', text: 'Heard. Your feeling counts as an interest — I’m going back in.' },
            {
              type: 'text',
              thinking: true,
              text: 'Alice’s agent offered: she covers this one fully, you take the next one. New proposal on the table.',
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
                        note: 'Alice covers this one — you take the next.',
                        renegotiated: true,
                      },
                    },
                  };
                }),
            },
          ]);
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
            get()._enqueue([
              {
                type: 'text',
                text:
                  (p.shareYou === 0
                    ? `Done — ${p.amountUsdc.toFixed(2)} USDC paid in full to ${p.recipientEns}. Alice covered this one; the trustee remembers you take the next.`
                    : `Done — ${p.recipientEns} is paid in full. ${p.shareYou.toFixed(2)} USDC pulled from your wallet, ${p.sharePartner.toFixed(2)} from Alice’s. Filed in your history.`) +
                  (p.detail ? ' Tickets are in your shared vault — and Sep 4 is in both calendars.' : ''),
              },
            ]);
          }, 3600);
        },

        say: (text) =>
          set((s) => ({ messages: [...s.messages, { id: mid(), role: 'user', kind: 'text', text }] })),

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
            messages: [],
            payments: {},
          }));
        },
      };
    },
    {
      name: 'humanbond-agent-dummy-v2',
      // Transient pacing state never persists — a reload starts calm.
      partialize: (s) => ({
        step: s.step,
        answers: s.answers,
        askedIds: s.askedIds,
        importedSources: s.importedSources,
        agentReady: s.agentReady,
        bornPending: s.bornPending,
        partnerAgentReady: s.partnerAgentReady,
        pullGranted: s.pullGranted,
        pendingReceipt: s.pendingReceipt,
        messages: s.messages,
        payments: s.payments,
      }),
    },
  ),
);

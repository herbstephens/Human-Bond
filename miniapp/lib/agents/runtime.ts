/**
 * The negotiation loop and the trustee executor.
 *
 * negotiate(): two personal agents exchange turns (LLM-driven later; a
 * ScriptedDriver stands in today) until one accepts the other's offer. The
 * result is an UNSIGNED settlement — consent only exists once both agents
 * sign its hash (identity.ts) and the trustee verifies both signatures.
 *
 * TrusteeExecutor.execute() is deliberately mechanical: signature checks,
 * arithmetic, expiry, nonce, threshold. No judgment, no language. If any
 * check fails it throws with the reason — it never "helpfully" proceeds.
 */
import {
  settlementHash,
  transcriptHash,
  type AgentIdentity,
  type NegotiationMessage,
  type NegotiationTranscript,
  type Settlement,
  type SignedSettlement,
} from './protocol';
import { signatureIsValid } from './identity';
import { assertToolAllowed, type PaymentRail, type PullReceipt } from './tools';
import type { HBStorage, StoredCharter, StoredProfile } from './storage';

export type PaymentRequest = {
  kind: Settlement['kind'];
  bondId: string;
  label: string;
  recipient: string;
  amountUsdc: number;
  /** Investment terms — carried into the signed settlement. */
  aprPct?: number;
  /** Swap terms (Uniswap) — carried into the signed settlement. */
  swap?: Settlement['swap'];
  /** The human whose agent opens the negotiation. */
  requestedBy: string;
};

export type Offer = {
  /** agentId -> share in USDC. */
  shares: Record<string, number>;
  rationale: string;
};

export type AgentTurn = {
  say: string;
  offer?: Offer;
  acceptOffer?: boolean;
};

export type NegotiationContext = {
  self: AgentIdentity;
  peer: AgentIdentity;
  profile: StoredProfile;
  request: PaymentRequest;
  transcript: NegotiationMessage[];
  currentOffer: (Offer & { by: string }) | null;
};

/** The brain of one negotiating agent. The production driver runs an LLM with
 *  prompts.ts + tools.ts; the scripted driver replays a fixed choreography so
 *  protocol and executor are testable without a model. */
export interface AgentDriver {
  next(ctx: NegotiationContext): Promise<AgentTurn>;
}

export class ScriptedDriver implements AgentDriver {
  private i = 0;
  constructor(private turns: AgentTurn[]) {}
  async next(): Promise<AgentTurn> {
    const turn = this.turns[this.i++];
    if (!turn) throw new Error('ScriptedDriver ran out of turns — the choreography is incomplete.');
    return turn;
  }
}

export type NegotiationParty = {
  identity: AgentIdentity;
  driver: AgentDriver;
  profile: StoredProfile;
};

const MAX_TURNS = 12;
let nonceCounter = 0;

/** Peer-to-peer negotiation between the two personal agents. The trustee is
 *  not in the room. Returns the transcript and the settled (unsigned) terms. */
export async function negotiate(
  a: NegotiationParty,
  b: NegotiationParty,
  request: PaymentRequest,
): Promise<{ transcript: NegotiationTranscript; settlement: Settlement }> {
  const transcript: NegotiationMessage[] = [];
  let currentOffer: (Offer & { by: string }) | null = null;

  let speaker = a;
  let listener = b;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    assertToolAllowed('personal', 'send_to_peer');
    const action = await speaker.driver.next({
      self: speaker.identity,
      peer: listener.identity,
      profile: speaker.profile,
      request,
      transcript,
      currentOffer,
    });
    transcript.push({ from: speaker.identity.id, to: listener.identity.id, text: action.say, at: Date.now() });

    if (action.offer) currentOffer = { ...action.offer, by: speaker.identity.id };
    if (action.acceptOffer) {
      if (!currentOffer) throw new Error(`${speaker.identity.id} accepted, but no offer is on the table.`);
      if (currentOffer.by === speaker.identity.id)
        throw new Error(`${speaker.identity.id} cannot accept its own offer — the peer must.`);

      const fullTranscript: NegotiationTranscript = { bondId: request.bondId, subject: request.label, messages: transcript };
      const settlement: Settlement = {
        kind: request.kind,
        bondId: request.bondId,
        nonce: `n-${++nonceCounter}-${Date.now()}`,
        expiresAt: Date.now() + 10 * 60 * 1000,
        recipient: request.recipient,
        amountUsdc: request.amountUsdc,
        shares: currentOffer.shares,
        aprPct: request.aprPct,
        swap: request.swap,
        memo: `${request.label} · ${currentOffer.rationale}`,
        transcriptHash: transcriptHash(fullTranscript),
      };
      return { transcript: fullTranscript, settlement };
    }

    [speaker, listener] = [listener, speaker];
  }
  throw new Error(`Negotiation over "${request.label}" did not settle within ${MAX_TURNS} turns.`);
}

// ---------------------------------------------------------------------------

export class HumanReleaseRequired extends Error {
  constructor(amount: number, threshold: number) {
    super(
      `Human release required: ${amount.toFixed(2)} USDC exceeds the joint hito threshold of ${threshold.toFixed(2)}. Agent consent never replaces human consent above threshold.`,
    );
    this.name = 'HumanReleaseRequired';
  }
}

export class TrusteeExecutor {
  private seenNonces = new Set<string>();

  constructor(
    /** The ONLY two agents whose signatures move this bond's money. */
    private bondAgents: [AgentIdentity, AgentIdentity],
    private rail: PaymentRail,
    private storage: HBStorage,
  ) {}

  /**
   * The answer to "how does the trustee know both agents wanted this?":
   * it doesn't trust the submitter and it doesn't re-ask anyone. Both agents
   * signed the same canonical hash — matching signatures over identical bytes
   * ARE the agreement. Whoever hands the order in is irrelevant.
   */
  async execute(order: SignedSettlement, opts: { humansReleased?: boolean } = {}): Promise<PullReceipt[]> {
    assertToolAllowed('trustee', 'verify_settlement');
    const { settlement, signatures } = order;
    const [a, b] = this.bondAgents;

    for (const agent of [a, b]) {
      const sig = signatures.find((s) => s.agentId === agent.id);
      if (!sig)
        throw new Error(`Refused: no signature from ${agent.id} (${agent.human}'s agent). One agent's word is not the bond's word.`);
      if (sig.address.toLowerCase() !== agent.address.toLowerCase())
        throw new Error(`Refused: signature for ${agent.id} comes from an unregistered key ${sig.address}.`);
      if (!(await signatureIsValid(sig, settlement)))
        throw new Error(
          `Refused: ${agent.id}'s signature does not match these terms. The terms were altered after signing, or consent was never given to THIS settlement.`,
        );
    }

    const sum = Object.values(settlement.shares).reduce((acc, v) => acc + v, 0);
    if (Math.abs(sum - settlement.amountUsdc) > 0.005)
      throw new Error(`Refused: shares sum to ${sum.toFixed(2)} but the settlement pays ${settlement.amountUsdc.toFixed(2)}.`);
    if (Date.now() > settlement.expiresAt) throw new Error('Refused: settlement expired — renegotiate.');
    if (this.seenNonces.has(settlement.nonce)) throw new Error(`Refused: nonce ${settlement.nonce} was already executed.`);

    const charter = await this.storage.getJson<StoredCharter>(`charter/${settlement.bondId}`);
    if (settlement.amountUsdc > charter.jointHitoThresholdUsdc && !opts.humansReleased)
      throw new HumanReleaseRequired(settlement.amountUsdc, charter.jointHitoThresholdUsdc);

    this.seenNonces.add(settlement.nonce);
    const receipts: PullReceipt[] = [];
    if (settlement.kind === 'investment') {
      assertToolAllowed('trustee', 'place_investment');
      if (settlement.aprPct === undefined)
        throw new Error('Refused: investment settlement without signed APR terms.');
      await this.rail.invest(settlement.bondId, settlement.amountUsdc, settlement.aprPct);
    } else if (settlement.kind === 'swap') {
      assertToolAllowed('trustee', 'place_investment');
      if (!settlement.swap)
        throw new Error('Refused: swap settlement without signed Uniswap terms (tokenIn/tokenOut/minAmountOut).');
      await this.rail.swap(
        settlement.bondId,
        settlement.swap.tokenIn,
        settlement.swap.tokenOut,
        settlement.amountUsdc,
        settlement.swap.minAmountOut,
      );
    } else {
      assertToolAllowed('trustee', 'execute_payment');
      for (const [agentId, share] of Object.entries(settlement.shares)) {
        if (share <= 0) continue;
        const agent = agentId === a.id ? a : b;
        receipts.push(await this.rail.pull(agent.human, share, settlement.recipient));
      }
    }

    await this.storage.append(`history/${settlement.bondId}`, {
      type: 'execution',
      hash: settlementHash(settlement),
      settlement,
      receipts,
      at: Date.now(),
    });
    return receipts;
  }
}

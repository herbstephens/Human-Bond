/**
 * Agent-to-agent negotiation over 0G-KV — the multi-browser architecture.
 *
 * Every human runs THEIR OWN agent locally (in their browser, thinking via
 * the 0G router). The agents never share a process — they talk through
 * storage keys on one shared stream:
 *
 *   `<caseId>.<pair>`                conversation — append-only turn log
 *   `sig.<agentId>.<caseId>.<pair>`  each agent's settlement signature
 *   `cases.<pair>`                   case registry for a bond pair
 *
 * (pair = e.g. 'ben-alice' / 'herb-agatha'.)
 *
 * No write races by construction: the conversation is strictly turn-based
 * (you only write when it's your turn), signatures live under per-agent
 * keys, the registry is written by the case initiator only.
 *
 * Both sides derive the SAME settlement deterministically from the shared
 * conversation (nonce = caseId, expiry from the case record) — so their
 * signatures land on one identical hash without ever exchanging the
 * settlement object itself.
 */
import type { PrivateKeyAccount } from 'viem/accounts';
import { signSettlement } from './identity';
import { transcriptHash, type AgentIdentity, type NegotiationTranscript, type Settlement, type SettlementSignature, type SignedSettlement } from './protocol';
import type { AgentDriver, AgentTurn, Offer, PaymentRequest } from './runtime';
import type { HBStorage, StoredProfile } from './storage';

export type BusCase = {
  caseId: string;
  pair: string;
  request: PaymentRequest;
  openedBy: string;
  expiresAt: number;
};

export type BusTurn = AgentTurn & { seq: number; from: string; at: number };

const MAX_TURNS = 12;
export const convKey = (caseId: string, pair: string) => `${caseId}.${pair}`;
export const sigKey = (agentId: string, caseId: string, pair: string) => `sig.${agentId}.${caseId}.${pair}`;
export const casesKey = (pair: string) => `cases.${pair}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The initiator registers the case; the peer discovers it via `cases.<pair>`. */
export async function openCase(
  storage: HBStorage,
  pair: string,
  caseId: string,
  openedBy: string,
  request: PaymentRequest,
): Promise<BusCase> {
  const busCase: BusCase = { caseId, pair, request, openedBy, expiresAt: Date.now() + 30 * 60 * 1000 };
  await storage.append(casesKey(pair), busCase);
  return busCase;
}

export async function listCases(storage: HBStorage, pair: string): Promise<BusCase[]> {
  return (await storage.readLog(casesKey(pair))) as BusCase[];
}

/** Both sides rebuild the identical settlement from the shared conversation. */
export function deriveSettlement(busCase: BusCase, turns: BusTurn[]): Settlement {
  const acceptIdx = turns.findIndex((t) => t.acceptOffer);
  if (acceptIdx === -1) throw new Error(`Case ${busCase.caseId}: no accepted offer in the conversation.`);
  const offerTurn = [...turns.slice(0, acceptIdx + 1)].reverse().find((t) => t.offer && t.from !== turns[acceptIdx].from);
  if (!offerTurn?.offer) throw new Error(`Case ${busCase.caseId}: acceptance without a peer offer on the table.`);

  const transcript: NegotiationTranscript = {
    bondId: busCase.request.bondId,
    subject: busCase.request.label,
    messages: turns.map((t) => ({ from: t.from, to: '', text: t.say, at: t.at })),
  };
  return {
    kind: busCase.request.kind,
    bondId: busCase.request.bondId,
    nonce: busCase.caseId,
    expiresAt: busCase.expiresAt,
    recipient: busCase.request.recipient,
    amountUsdc: busCase.request.amountUsdc,
    shares: offerTurn.offer.shares,
    aprPct: busCase.request.aprPct,
    swap: busCase.request.swap,
    memo: `${busCase.request.label} · ${offerTurn.offer.rationale}`,
    transcriptHash: transcriptHash(transcript),
  };
}

export type BusAgentOptions = {
  storage: HBStorage;
  busCase: BusCase;
  /** This agent signs its own settlements — the key never leaves its browser. */
  self: AgentIdentity & { account: PrivateKeyAccount };
  peer: AgentIdentity;
  driver: AgentDriver;
  profile: StoredProfile;
  /** The initiator speaks first. */
  initiator: boolean;
  pollMs?: number;
  onTurn?: (turn: BusTurn) => void;
};

/**
 * One agent's life on the bus: poll the conversation, speak when it's your
 * turn, and once an offer is accepted, sign the derived settlement into your
 * own sig key. Runs in each human's browser — the peers never meet.
 */
export async function runAgentOnBus(opts: BusAgentOptions): Promise<Settlement> {
  const { storage, busCase, self, peer, driver, profile } = opts;
  const pollMs = opts.pollMs ?? 400;
  const cKey = convKey(busCase.caseId, busCase.pair);

  for (;;) {
    const turns = (await storage.readLog(cKey)) as BusTurn[];
    if (turns.some((t) => t.acceptOffer)) break;
    if (turns.length >= MAX_TURNS)
      throw new Error(`Case ${busCase.caseId} did not settle within ${MAX_TURNS} turns.`);

    const myTurn = turns.length === 0 ? opts.initiator : turns[turns.length - 1].from !== self.id;
    if (!myTurn) {
      await sleep(pollMs);
      continue;
    }

    const lastOffer = [...turns].reverse().find((t) => t.offer);
    const action = await driver.next({
      self,
      peer,
      profile,
      request: busCase.request,
      transcript: turns.map((t) => ({ from: t.from, to: t.from === self.id ? peer.id : self.id, text: t.say, at: t.at })),
      currentOffer: lastOffer?.offer ? { ...(lastOffer.offer as Offer), by: lastOffer.from } : null,
    });
    const record: BusTurn = { ...action, seq: turns.length, from: self.id, at: Date.now() };
    await storage.append(cKey, record);
    opts.onTurn?.(record);
    if (action.acceptOffer) break;
  }

  const turns = (await storage.readLog(cKey)) as BusTurn[];
  const settlement = deriveSettlement(busCase, turns);
  const sig = await signSettlement(self, settlement);
  await storage.putJson(sigKey(self.id, busCase.caseId, busCase.pair), sig);
  return settlement;
}

/** The trustee (or any observer) waits until both agents have signed. */
export async function collectSignatures(
  storage: HBStorage,
  busCase: BusCase,
  agents: [AgentIdentity, AgentIdentity],
  settlement: Settlement,
  pollMs = 400,
  timeoutMs = 120_000,
): Promise<SignedSettlement> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const sigs = await Promise.all(
      agents.map((a) => storage.getJsonOrNull<SettlementSignature>(sigKey(a.id, busCase.caseId, busCase.pair))),
    );
    if (sigs.every((s) => s !== null)) return { settlement, signatures: sigs as SettlementSignature[] };
    if (Date.now() > deadline)
      throw new Error(`Case ${busCase.caseId}: not all agents signed within ${timeoutMs / 1000}s.`);
    await sleep(pollMs);
  }
}

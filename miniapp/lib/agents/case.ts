/**
 * A negotiation "case" — one shared money decision and the room it lives in.
 * Client-safe (types + key helpers only): the bond page renders CaseRecords,
 * the /api/agent/case route writes them.
 *
 * The `transcript` IS the protocol's core artifact — the direct agent-to-agent
 * conversation, auditable and human-readable, that produced the settlement.
 */
import type { PaymentRequest } from './runtime';
import type { NegotiationTranscript, Settlement } from './protocol';

export type CaseStatus = 'negotiated' | 'released' | 'executed' | 'failed';

export type CaseRecord = {
  caseId: string;
  bondId: string;
  request: PaymentRequest;
  status: CaseStatus;
  /** The shared thread the two agents chatted through. */
  transcript: NegotiationTranscript;
  /** The signed-shape term sheet the conversation reduced to (shares = the split). */
  settlement: Settlement;
  createdAt: number;
  /** Agent ids whose humans have released this on their hito wallet. */
  releases: string[];
};

export const caseKey = (bondId: string, caseId: string) => `case/${bondId}/${caseId}`;
export const caseIndexKey = (bondId: string) => `caseIndex/${bondId}`;

// --- memory (per bond, per person) -----------------------------------------

/** Append-only ledger of everything that happened in a bond — shared, auditable. */
export const historyKey = (bondId: string) => `history/${bondId}`;
/** The distilled relationship memo BOTH agents can see for this bond. */
export const bondMemoryKey = (bondId: string) => `bondMemory/${bondId}`;
/** One agent's PRIVATE model of the partner, learned by negotiating. Keyed by
 *  the owning human's address so it never leaks to the peer's agent. */
export const partnerModelKey = (address: string, bondId: string) =>
  `partnerModel/${address.toLowerCase()}/${bondId}`;

export type BondMemory = { memo: string; updatedAt: number };
export type PartnerModel = { notes: string; updatedAt: number };

/** What one agent carries into a negotiation beyond its own profile + the charter. */
export type NegotiationMemory = { bondMemo?: string; partnerModel?: string };

/**
 * One place that turns two profiles + a request into a real negotiated
 * settlement — shared by the /negotiate probe and the /case room so the
 * "how a negotiation runs" logic lives once.
 */
import { negotiate, type PaymentRequest } from './runtime';
import { LlmDriver, type LlmConfig } from './llmDriver';
import { personalSystemPrompt } from './prompts';
import type { AgentIdentity, NegotiationTranscript, Settlement } from './protocol';
import type { StoredCharter, StoredProfile } from './storage';
import type { NegotiationMemory } from './case';

export function llmCfgFromEnv(): LlmConfig {
  const apiKey = process.env.ZG_ROUTER_API_KEY;
  if (!apiKey) throw new Error('ZG_ROUTER_API_KEY is not set in miniapp/.env.local');
  return {
    apiKey,
    baseUrl: process.env.ZG_ROUTER_BASE_URL,
    // The engine's own note: 'zai-org/GLM-5-FP8' does not exist on the router;
    // the GLM family is glm-5 / glm-5.1 / glm-5.2. Overridable per deployment.
    model: process.env.ZG_ROUTER_NEGOTIATE_MODEL ?? 'glm-5.2',
    // Low temperature: the by-income split is arithmetic, not vibes. Higher
    // temperatures let the agents anchor on round guesses (60/40) and accept.
    temperature: 0.2,
  };
}

export type NegParty = { identity: AgentIdentity; profile: StoredProfile };

/** Each agent reasons over the shared thread + its OWN private profile + the
 *  charter; the peer never sees the raw profile, only the negotiation messages. */
export async function runCase(
  cfg: LlmConfig,
  a: NegParty,
  b: NegParty,
  charter: StoredCharter | undefined,
  request: PaymentRequest,
  opts: { situationNote?: string; memoryA?: NegotiationMemory; memoryB?: NegotiationMemory } = {},
): Promise<{ transcript: NegotiationTranscript; settlement: Settlement }> {
  const partyA = {
    identity: a.identity,
    profile: a.profile,
    driver: new LlmDriver(cfg, personalSystemPrompt(a.profile, b.identity.human, charter, opts.memoryA), opts.situationNote),
  };
  const partyB = {
    identity: b.identity,
    profile: b.profile,
    driver: new LlmDriver(cfg, personalSystemPrompt(b.profile, a.identity.human, charter, opts.memoryB)),
  };
  return negotiate(partyA, partyB, request);
}

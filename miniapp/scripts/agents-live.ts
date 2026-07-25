/**
 * LIVE run of the three-agent protocol: two GLM-backed personal agents
 * negotiate for real over 0G's model router; signing, verification and
 * execution stay deterministic.
 *
 *   npm run agents:live              — LLM negotiation, in-memory storage
 *   npm run agents:live -- --kv      — persist brain/charter/history on 0G-KV
 *   npm run agents:live -- --uneasy  — after settling, Ben feels bad → renegotiation
 *
 * Env (miniapp/.env.local): ZG_ROUTER_API_KEY required; for --kv also
 * ZG_KV_PRIVATE_KEY (funded Galileo key, faucet.0g.ai).
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { demoAgentIdentity, signSettlement } from '../lib/agents/identity';
import { LlmDriver } from '../lib/agents/llmDriver';
import { settlementHash, type AgentIdentity } from '../lib/agents/protocol';
import { negotiate, TrusteeExecutor, type AgentDriver, type NegotiationContext, type AgentTurn } from '../lib/agents/runtime';
import { MemoryStorage, type HBStorage, type StoredCharter, type StoredProfile } from '../lib/agents/storage';
import { personalSystemPrompt } from '../lib/agents/prompts';
import { MockRail } from '../lib/agents/tools';
import { zeroGKvStorageFromEnv } from '../lib/agents/zeroGKv';

const envFile = resolve(import.meta.dirname, '../.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const h = (title: string) => console.log(`\n\x1b[1m━━ ${title} ━━\x1b[0m`);

/** Print each turn the moment the model produces it. */
class NarratedDriver implements AgentDriver {
  constructor(private inner: AgentDriver, private label: string) {}
  async next(ctx: NegotiationContext): Promise<AgentTurn> {
    const turn = await this.inner.next(ctx);
    console.log(`  \x1b[36m${this.label}\x1b[0m: ${turn.say}`);
    if (turn.offer)
      console.log(
        `    offer: ${Object.entries(turn.offer.shares)
          .map(([id, v]) => `${id}=${v.toFixed(2)}`)
          .join(' · ')} (${turn.offer.rationale})`,
      );
    if (turn.acceptOffer) console.log('    → accepts');
    return turn;
  }
}

async function main() {
  const apiKey = process.env.ZG_ROUTER_API_KEY;
  if (!apiKey)
    throw new Error('ZG_ROUTER_API_KEY is not set — get one for router-api.0g.ai and put it in miniapp/.env.local.');
  const useKv = process.argv.includes('--kv');
  const uneasy = process.argv.includes('--uneasy');

  const storage: HBStorage = useKv ? zeroGKvStorageFromEnv() : new MemoryStorage();
  console.log(`storage: ${useKv ? '0G-KV (Galileo)' : 'in-memory — run with --kv to persist on 0G'}`);
  const rail = new MockRail();

  const ben = demoAgentIdentity('agent-ben', 'Ben');
  const alice = demoAgentIdentity('agent-alice', 'Alice');

  const benProfile: StoredProfile = {
    human: 'Ben',
    monthlyIncomeUsdc: 4200,
    protectedBudgetUsdc: 500,
    hitoThresholdUsdc: 200,
    facts: ['Big bills stress him — lead with "this is handled"', 'Buffer-first: defends the emergency fund', 'Cash flow is tight this month'],
  };
  const aliceProfile: StoredProfile = {
    human: 'Alice',
    monthlyIncomeUsdc: 12800,
    protectedBudgetUsdc: 1000,
    hitoThresholdUsdc: 500,
    facts: ['Long-horizon planner', 'Earns more right now and knows it', 'Values fairness over penny-counting'],
  };
  const charter: StoredCharter = {
    bondId: 'bond-ben-alice',
    partners: ['Ben', 'Alice'],
    splitRule: 'by-income',
    jointHitoThresholdUsdc: 200,
    heirs: [{ name: 'Paul', sharePct: 100 }],
  };

  h('Second brain + charter → storage');
  await storage.putJson('brain/Ben', benProfile);
  await storage.putJson('brain/Alice', aliceProfile);
  await storage.putJson(`charter/${charter.bondId}`, charter);
  const roundtrip = await storage.getJson<StoredProfile>('brain/Ben');
  console.log(`  roundtrip brain/Ben → ${roundtrip.human}, income ${roundtrip.monthlyIncomeUsdc}, ${roundtrip.facts.length} facts`);

  const trustee = new TrusteeExecutor([ben, alice], rail, storage);
  const request = {
    kind: 'payment' as const,
    bondId: charter.bondId,
    label: 'Cervejaria Ramiro — dinner for two',
    recipient: 'ramiro.eth',
    amountUsdc: 84.5,
    requestedBy: 'Ben',
  };

  const driverFor = (self: AgentIdentity, profile: StoredProfile, partner: string, note?: string) =>
    new NarratedDriver(new LlmDriver({ apiKey }, personalSystemPrompt(profile, partner), note), self.id);

  h('LIVE negotiation — GLM via 0G router, trustee not in the room');
  const { settlement } = await negotiate(
    { identity: ben, driver: driverFor(ben, benProfile, 'Alice'), profile: benProfile },
    { identity: alice, driver: driverFor(alice, aliceProfile, 'Ben'), profile: aliceProfile },
    request,
  );
  console.log(`  settled → ${JSON.stringify(settlement.shares)} · hash ${settlementHash(settlement).slice(0, 18)}…`);

  let finalSettlement = settlement;
  if (uneasy) {
    h('Renegotiation — Ben told his agent he does not feel good about this');
    const note = `Your human just said about the settled ${request.label} split (${JSON.stringify(
      settlement.shares,
    )}): "I don't feel good about this." A feeling counts as an interest — reopen and find terms your human is at peace with.`;
    const rerun = await negotiate(
      { identity: ben, driver: driverFor(ben, benProfile, 'Alice', note), profile: benProfile },
      {
        identity: alice,
        driver: driverFor(alice, aliceProfile, 'Ben', 'The peer reopened the last settlement because their human felt uneasy. Feelings count as interests here.'),
        profile: aliceProfile,
      },
      request,
    );
    finalSettlement = rerun.settlement;
    console.log(`  re-settled → ${JSON.stringify(finalSettlement.shares)}`);
  }

  h('Dual signature → trustee verifies → executes');
  const receipts = await trustee.execute({
    settlement: finalSettlement,
    signatures: [await signSettlement(ben, finalSettlement), await signSettlement(alice, finalSettlement)],
  });
  for (const r of receipts) console.log(`  ${r.txRef}: ${r.amountUsdc.toFixed(2)} from ${r.fromHuman} → ${r.to}`);
  const history = await storage.readLog(`history/${charter.bondId}`);
  console.log(`  history on ${useKv ? '0G-KV' : 'memory'}: ${history.length} entr${history.length === 1 ? 'y' : 'ies'}`);

  console.log('\nLive negotiation settled, signed by both agents, executed by the trustee.\n');
}

main();

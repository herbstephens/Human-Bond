/**
 * The multi-browser architecture, headless: two agents that NEVER share a
 * process — they see each other only through storage keys (Leon/Mischa's
 * scheme: `<caseId>.<pair>`, `sig.<agent>.<caseId>.<pair>`, `cases.<pair>`).
 *
 *   npm run agents:bus            — scripted brains, in-memory storage
 *   npm run agents:bus -- --llm   — GLM brains via 0G router
 *   npm run agents:bus -- --kv    — the bus runs over REAL 0G-KV (funded key)
 *
 * Both sides independently derive the settlement from the shared
 * conversation and sign it into their own key — the run asserts both
 * arrived at the identical hash. Trustee collects both signatures,
 * stops at the hito gate (demo rule: everything releases on hito),
 * executes after release.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { demoAgentIdentity } from '../lib/agents/identity';
import { collectSignatures, openCase, runAgentOnBus, type BusTurn } from '../lib/agents/kvBus';
import { LlmDriver } from '../lib/agents/llmDriver';
import { settlementHash } from '../lib/agents/protocol';
import { HumanReleaseRequired, ScriptedDriver, TrusteeExecutor, type AgentDriver } from '../lib/agents/runtime';
import { MemoryStorage, type HBStorage, type StoredCharter, type StoredProfile } from '../lib/agents/storage';
import { personalSystemPrompt } from '../lib/agents/prompts';
import { MockRail } from '../lib/agents/tools';
import { zeroGKvStorageFromEnv } from '../lib/agents/zeroGKv';

const envFile = resolve(import.meta.dirname, '../.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const h = (title: string) => console.log(`\n\x1b[1m━━ ${title} ━━\x1b[0m`);
const narrate = (turn: BusTurn) => {
  console.log(`  \x1b[36m${turn.from}\x1b[0m: ${turn.say}`);
  if (turn.offer)
    console.log(
      `    offer: ${Object.entries(turn.offer.shares).map(([id, v]) => `${id}=${v.toFixed(2)}`).join(' · ')}`,
    );
  if (turn.acceptOffer) console.log('    → accepts');
};

async function main() {
  const useKv = process.argv.includes('--kv');
  const useLlm = process.argv.includes('--llm');
  const storage: HBStorage = useKv ? zeroGKvStorageFromEnv() : new MemoryStorage();
  const pollMs = useKv ? 3000 : 150;
  console.log(`bus: ${useKv ? 'REAL 0G-KV (Galileo)' : 'in-memory'} · brains: ${useLlm ? 'GLM via 0G router' : 'scripted'}`);

  const ben = demoAgentIdentity('agent-ben', 'Ben');
  const alice = demoAgentIdentity('agent-alice', 'Alice');
  const benProfile: StoredProfile = {
    human: 'Ben',
    monthlyIncomeUsdc: 4200,
    protectedBudgetUsdc: 500,
    hitoThresholdUsdc: 200,
    facts: ['Cash flow is tight this month'],
  };
  const aliceProfile: StoredProfile = {
    human: 'Alice',
    monthlyIncomeUsdc: 12800,
    protectedBudgetUsdc: 1000,
    hitoThresholdUsdc: 500,
    facts: ['Earns more right now and knows it'],
  };
  const charter: StoredCharter = {
    bondId: 'bond-ben-alice',
    partners: ['Ben', 'Alice'],
    splitRule: 'by-income',
    jointHitoThresholdUsdc: 0, // DEMO RULE: everything releases on hito
    heirs: [{ name: 'Paul', sharePct: 100 }],
  };
  await storage.putJson(`charter/${charter.bondId}`, charter);

  const pair = 'ben-alice';
  const caseId = `case-${Date.now()}`;
  h(`Case opens on the bus — cases.${pair} / ${caseId}.${pair}`);
  const busCase = await openCase(storage, pair, caseId, ben.id, {
    kind: 'payment',
    bondId: charter.bondId,
    label: 'Cervejaria Ramiro — dinner for two',
    recipient: 'ramiro.eth',
    amountUsdc: 84.5,
    requestedBy: 'Ben',
  });

  const apiKey = process.env.ZG_ROUTER_API_KEY;
  if (useLlm && !apiKey) throw new Error('--llm needs ZG_ROUTER_API_KEY in miniapp/.env.local');
  const driverFor = (profile: StoredProfile, partner: string, scripted: AgentDriver): AgentDriver =>
    useLlm
      ? new LlmDriver(
          { apiKey: apiKey as string, model: process.env.ZG_ROUTER_MODEL, baseUrl: process.env.ZG_ROUTER_BASE_URL },
          personalSystemPrompt(profile, partner, charter),
        )
      : scripted;

  const benScripted = new ScriptedDriver([
    {
      say: 'Dinner at Ramiro, 84.50 — charter says by income. Ben 4,200 vs Alice 12,800 → I propose 21.00 / 63.50.',
      offer: { shares: { [ben.id]: 21, [alice.id]: 63.5 }, rationale: 'income-proportional per charter' },
    },
  ]);
  const aliceScripted = new ScriptedDriver([
    { say: 'Income-proportional checks out. Agreed.', acceptOffer: true },
  ]);

  h('Two agents, two loops, no shared process — only the bus');
  const [benSettlement, aliceSettlement] = await Promise.all([
    runAgentOnBus({
      storage, busCase, self: ben, peer: alice, profile: benProfile,
      driver: driverFor(benProfile, 'Alice', benScripted), initiator: true, pollMs, onTurn: narrate,
    }),
    runAgentOnBus({
      storage, busCase, self: alice, peer: ben, profile: aliceProfile,
      driver: driverFor(aliceProfile, 'Ben', aliceScripted), initiator: false, pollMs, onTurn: narrate,
    }),
  ]);

  const hashBen = settlementHash(benSettlement);
  const hashAlice = settlementHash(aliceSettlement);
  if (hashBen !== hashAlice)
    throw new Error(`Settlement derivation diverged: ${hashBen} vs ${hashAlice}`);
  console.log(`  both sides derived the SAME settlement independently → ${hashBen.slice(0, 18)}…`);

  h('Trustee collects both signatures from the bus');
  const rail = new MockRail();
  const trustee = new TrusteeExecutor([ben, alice], rail, storage);
  const signed = await collectSignatures(storage, busCase, [ben, alice], benSettlement, pollMs);
  console.log(`  ${signed.signatures.length} signatures collected from sig.* keys`);

  let gate: Error | null = null;
  try {
    await trustee.execute(signed);
  } catch (e) {
    gate = e as Error;
  }
  if (!(gate instanceof HumanReleaseRequired)) throw new Error('GUARDRAIL HOLE: executed without hito release');
  console.log(`  \x1b[33mhito gate\x1b[0m: ${gate.message.split('.')[0]} → both humans release`);
  const receipts = await trustee.execute(signed, { humansReleased: true });
  for (const r of receipts) console.log(`  ${r.txRef}: ${r.amountUsdc.toFixed(2)} from ${r.fromHuman} → ${r.to}`);

  console.log('\nBus negotiation settled, dual-signed via storage keys, hito-released, executed.\n');
}

main();

/**
 * Headless run of the three-agent protocol — no UI, no model, no chain.
 *
 *   npm run agents:demo
 *
 * Plays the Ramiro receipt end to end (negotiate → dual-sign → trustee
 * verifies → executes), then proves the guardrails by attacking them:
 * one-signature submission, tampered terms, replay, personal agent trying
 * to execute, and the hito gate on an above-threshold investment.
 */
import { demoAgentIdentity, signSettlement } from '../lib/agents/identity';
import { settlementHash } from '../lib/agents/protocol';
import { negotiate, ScriptedDriver, TrusteeExecutor, HumanReleaseRequired } from '../lib/agents/runtime';
import { MemoryStorage, type StoredCharter, type StoredProfile } from '../lib/agents/storage';
import { assertToolAllowed, MockRail } from '../lib/agents/tools';
import { personalSystemPrompt, trusteeSystemPrompt } from '../lib/agents/prompts';

const h = (title: string) => console.log(`\n\x1b[1m━━ ${title} ━━\x1b[0m`);
const ok = (msg: string) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);

/** A guardrail only counts if attacking it fails loudly. */
async function expectRefusal(label: string, fn: () => Promise<unknown>) {
  let refused: Error | null = null;
  try {
    await fn();
  } catch (e) {
    refused = e as Error;
  }
  if (!refused) throw new Error(`GUARDRAIL HOLE: "${label}" was NOT refused`);
  ok(`${label}\n      → ${refused.message.split('\n')[0]}`);
}

async function main() {
  // --- world setup ---------------------------------------------------------
  const storage = new MemoryStorage();
  const rail = new MockRail();

  const ben = demoAgentIdentity('agent-ben', 'Ben');
  const alice = demoAgentIdentity('agent-alice', 'Alice');
  const mallory = demoAgentIdentity('agent-mallory', 'Mallory'); // not part of the bond

  const benProfile: StoredProfile = {
    human: 'Ben',
    monthlyIncomeUsdc: 4200,
    protectedBudgetUsdc: 500,
    hitoThresholdUsdc: 200,
    facts: ['Big bills stress him — lead with "this is handled"', 'Buffer-first: defends the emergency fund'],
  };
  const aliceProfile: StoredProfile = {
    human: 'Alice',
    monthlyIncomeUsdc: 12800,
    protectedBudgetUsdc: 1000,
    hitoThresholdUsdc: 500,
    facts: ['Long-horizon planner', 'Earns more right now and knows it'],
  };
  const charter: StoredCharter = {
    bondId: 'bond-ben-alice',
    partners: ['Ben', 'Alice'],
    splitRule: 'by-income',
    // DEMO RULE: every transaction is released on hito — threshold 0.
    jointHitoThresholdUsdc: 0,
    heirs: [{ name: 'Paul', sharePct: 100 }],
  };
  await storage.putJson('brain/Ben', benProfile);
  await storage.putJson('brain/Alice', aliceProfile);
  await storage.putJson(`charter/${charter.bondId}`, charter);

  const trustee = new TrusteeExecutor([ben, alice], rail, storage);

  h('Prompts (rendered from the second brain)');
  console.log(`  personal(${benProfile.human}): ${personalSystemPrompt(benProfile, 'Alice').length} chars`);
  console.log(`  trustee: ${trusteeSystemPrompt(charter).length} chars`);

  // --- happy path: the Ramiro receipt --------------------------------------
  h('Negotiation — agent ↔ agent, trustee not in the room');
  const request = {
    kind: 'payment' as const,
    bondId: charter.bondId,
    label: 'Cervejaria Ramiro',
    recipient: 'ramiro.eth',
    amountUsdc: 84.5,
    requestedBy: 'Ben',
  };
  // Scripted stand-in for the LLM drivers — protocol and executor are real.
  const benDriver = new ScriptedDriver([
    {
      say: 'Dinner for both at Ramiro, 84.50. Ben’s cash flow is tight this month — I propose income-weighted: Ben 10%, Alice 90%.',
      offer: { shares: { [ben.id]: 8.45, [alice.id]: 76.05 }, rationale: 'split by income, Ben’s flow tight' },
    },
  ]);
  const aliceDriver = new ScriptedDriver([
    { say: 'Income picture supports it — Alice earns more right now. Agreed: 10/90.', acceptOffer: true },
  ]);
  const { transcript, settlement } = await negotiate(
    { identity: ben, driver: benDriver, profile: benProfile },
    { identity: alice, driver: aliceDriver, profile: aliceProfile },
    request,
  );
  for (const m of transcript.messages) console.log(`  ${m.from}: ${m.text}`);
  console.log(`  settled → hash ${settlementHash(settlement)}`);

  h('Dual signature — consent is a hash both keys signed');
  const sigBen = await signSettlement(ben, settlement);
  const sigAlice = await signSettlement(alice, settlement);
  ok(`agent-ben signed   (${sigBen.address})`);
  ok(`agent-alice signed (${sigAlice.address})`);

  h('Trustee verifies — and stops at the hito gate (demo rule: EVERYTHING releases on hito)');
  let ramiroGate: Error | null = null;
  try {
    await trustee.execute({ settlement, signatures: [sigBen, sigAlice] });
  } catch (e) {
    ramiroGate = e as Error;
  }
  if (!(ramiroGate instanceof HumanReleaseRequired))
    throw new Error('GUARDRAIL HOLE: payment executed without hito release');
  ok(`blocked without humans: ${ramiroGate.message.split('.')[0]}`);
  const receipts = await trustee.execute({ settlement, signatures: [sigBen, sigAlice] }, { humansReleased: true });
  ok('released on both hitos → executed');
  for (const r of receipts) console.log(`  ${r.txRef}: ${r.amountUsdc.toFixed(2)} from ${r.fromHuman} → ${r.to}`);
  const history = await storage.readLog(`history/${charter.bondId}`);
  ok(`archived to history (${history.length} entry) — transcriptHash links the chat`);

  // --- the guardrails, attacked --------------------------------------------
  h('Guardrails under attack');

  await expectRefusal('Only ONE agent signed (Ben submits alone)', async () => {
    const solo = { ...settlement, nonce: 'n-solo' };
    await trustee.execute({ settlement: solo, signatures: [await signSettlement(ben, solo)] });
  });

  await expectRefusal('Terms tampered AFTER signing (amount 84.50 → 840.50)', async () => {
    const agreed = { ...settlement, nonce: 'n-tamper' };
    const sigs = [await signSettlement(ben, agreed), await signSettlement(alice, agreed)];
    const tampered = { ...agreed, amountUsdc: 840.5, shares: { [ben.id]: 84.05, [alice.id]: 756.45 } };
    await trustee.execute({ settlement: tampered, signatures: sigs });
  });

  await expectRefusal('Outsider key forges a signature (Mallory as agent-alice)', async () => {
    const forged = { ...settlement, nonce: 'n-forge' };
    const malSig = await signSettlement(mallory, forged);
    await trustee.execute({
      settlement: forged,
      signatures: [await signSettlement(ben, forged), { ...malSig, agentId: alice.id }],
    });
  });

  await expectRefusal('Replay — the same settled nonce a second time', async () => {
    await trustee.execute({ settlement, signatures: [sigBen, sigAlice] });
  });

  await expectRefusal('Personal agent reaches for execute_payment', async () => {
    assertToolAllowed('personal', 'execute_payment');
  });

  h('Hito gate — 8,000 USDC investment, both agents agree, humans still rule');
  const investReq = {
    kind: 'investment' as const,
    bondId: charter.bondId,
    label: 'USDC yield vault 4.1%',
    recipient: 'vault',
    amountUsdc: 8000,
    aprPct: 4.1,
    requestedBy: 'trustee-scan',
  };
  const { settlement: investment } = await negotiate(
    {
      identity: ben,
      driver: new ScriptedDriver([
        {
          say: 'Yield package fits Ben’s buffer-first profile — vault stays instant-exit.',
          offer: { shares: { [ben.id]: 4000, [alice.id]: 4000 }, rationale: 'joint vault money, equal deployment' },
        },
      ]),
      profile: benProfile,
    },
    {
      identity: alice,
      driver: new ScriptedDriver([{ say: 'Matches Alice’s long horizon. Agreed.', acceptOffer: true }]),
      profile: aliceProfile,
    },
    investReq,
  );
  const investSigs = [await signSettlement(ben, investment), await signSettlement(alice, investment)];

  let gate: Error | null = null;
  try {
    await trustee.execute({ settlement: investment, signatures: investSigs });
  } catch (e) {
    gate = e as Error;
  }
  if (!(gate instanceof HumanReleaseRequired)) throw new Error('GUARDRAIL HOLE: hito gate did not trigger');
  ok(`blocked without humans: ${gate.message.split('.')[0]}`);
  await trustee.execute({ settlement: investment, signatures: investSigs }, { humansReleased: true });
  ok('released on both hitos → executed');

  h('THE example — Ben asks, agents decide a Uniswap swap, trustee executes after release');
  // Ben: "put 1,000 of our vault to work" → the trustee pulls a Uniswap quote,
  // the agents vet it and sign the EXACT terms incl. the slippage floor.
  const swapReq = {
    kind: 'swap' as const,
    bondId: charter.bondId,
    label: 'USDC → WLD via Uniswap · diversify 1,000 of the vault',
    recipient: 'uniswap-router',
    amountUsdc: 1000,
    swap: { tokenIn: 'USDC', tokenOut: 'WLD', minAmountOut: 940 },
    requestedBy: 'Ben',
  };
  const { settlement: swapSettlement } = await negotiate(
    {
      identity: ben,
      driver: new ScriptedDriver([
        {
          say: 'Trustee quoted ~952 WLD for 1,000 USDC. Floor at 940 protects Ben’s buffer-first profile. Joint vault money → equal attribution.',
          offer: { shares: { [ben.id]: 500, [alice.id]: 500 }, rationale: 'vault diversification, equal attribution, minOut 940' },
        },
      ]),
      profile: benProfile,
    },
    {
      identity: alice,
      driver: new ScriptedDriver([{ say: 'Quote is fresh, floor is sane, fits Alice’s horizon. Agreed.', acceptOffer: true }]),
      profile: aliceProfile,
    },
    swapReq,
  );
  const swapSigs = [await signSettlement(ben, swapSettlement), await signSettlement(alice, swapSettlement)];
  let swapGate: Error | null = null;
  try {
    await trustee.execute({ settlement: swapSettlement, signatures: swapSigs });
  } catch (e) {
    swapGate = e as Error;
  }
  if (!(swapGate instanceof HumanReleaseRequired)) throw new Error('GUARDRAIL HOLE: swap executed without hito release');
  ok(`blocked without humans: ${swapGate.message.split('.')[0]}`);
  await trustee.execute({ settlement: swapSettlement, signatures: swapSigs }, { humansReleased: true });
  ok('released on both hitos → swap executed with the SIGNED minAmountOut floor');

  h('Rail log');
  for (const line of rail.log) console.log(`  ${line}`);
  console.log('\nAll paths green. The protocol, not the prompt, is the boundary.\n');
}

main();

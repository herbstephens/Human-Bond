/**
 * Agent signing identities.
 *
 * DEMO ONLY: keys are derived from public strings — deterministic, public,
 * worthless. Never fund these addresses. In production each agent is an
 * ERC-7857 identity whose key lives inside the 0G TEE, authorized for use by
 * both bond partners via authorizeUsage.
 */
import { keccak256, stringToHex, recoverMessageAddress } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import {
  settlementHash,
  type AgentIdentity,
  type Settlement,
  type SettlementSignature,
} from './protocol';

export function demoAgentAccount(seed: string): PrivateKeyAccount {
  return privateKeyToAccount(keccak256(stringToHex(`humanbond-demo-${seed}`)));
}

export function demoAgentIdentity(id: string, human: string): AgentIdentity & { account: PrivateKeyAccount } {
  const account = demoAgentAccount(id);
  return { id, human, address: account.address, account };
}

export async function signSettlement(
  agent: AgentIdentity & { account: PrivateKeyAccount },
  settlement: Settlement,
): Promise<SettlementSignature> {
  const signature = await agent.account.signMessage({ message: { raw: settlementHash(settlement) } });
  return { agentId: agent.id, address: agent.address, signature };
}

/** True iff the signature recovers to the claimed address over THIS settlement's hash. */
export async function signatureIsValid(
  sig: SettlementSignature,
  settlement: Settlement,
): Promise<boolean> {
  const recovered = await recoverMessageAddress({
    message: { raw: settlementHash(settlement) },
    signature: sig.signature,
  });
  return recovered.toLowerCase() === sig.address.toLowerCase();
}

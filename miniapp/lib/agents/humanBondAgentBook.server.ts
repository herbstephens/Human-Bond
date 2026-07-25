import { getAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

type CodeReader = {
  getCode(args: { address: `0x${string}` }): Promise<`0x${string}` | undefined>;
};

export function humanBondAgentBookAddress(): `0x${string}` {
  const value = process.env.HUMANBOND_AGENT_BOOK_ADDRESS;
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error('HUMANBOND_AGENT_BOOK_ADDRESS must be set to the deployed HumanBondAgentBook address');
  }
  return getAddress(value as `0x${string}`);
}

export function agentRegistrarAccount() {
  const privateKey = process.env.AGENT_REGISTRAR_PRIVATE_KEY;
  if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error('AGENT_REGISTRAR_PRIVATE_KEY must be set to a funded World Chain registrar key');
  }
  return privateKeyToAccount(privateKey as `0x${string}`);
}

export async function assertHumanBondAgentBookDeployed(
  client: CodeReader,
  address: `0x${string}`,
): Promise<void> {
  const code = await client.getCode({ address });
  if (!code || code === '0x') {
    throw new Error(`HUMANBOND_AGENT_BOOK_ADDRESS ${address} has no deployed contract code`);
  }
}

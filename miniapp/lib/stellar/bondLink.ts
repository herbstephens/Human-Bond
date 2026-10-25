/**
 * The link between a bond on World Chain and its vault on Stellar.
 *
 * The vault contract stores the bondId, the bond Safe and the ENS label in its config, set once
 * by its constructor. That is the Stellar side's claim. On its own anyone could deploy a vault
 * saying so, which is why name resolution only trusts it when World Chain points back
 * (see lib/stellar/directory.ts).
 */
import { createPublicClient, http, type Hex } from 'viem';
import { worldchain } from '@/lib/wagmi/worldchain';
import { BOND_REGISTRAR_ABI, BOND_REGISTRAR_ADDRESS } from '@/lib/contracts/registrar';
import { BOND_VAULT_MODULE_ABI, VAULT_ADDRESSES } from '@/lib/contracts/vault';

export type BondLink = {
  bondId: Hex;
  safe: `0x${string}`;
  label: string;
};

const ZERO = '0x0000000000000000000000000000000000000000';

export const worldchainClient = createPublicClient({
  chain: worldchain,
  transport: http(process.env.NEXT_PUBLIC_WORLDCHAIN_RPC),
});

/** Read a bond's Safe and ENS label from World Chain. Throws if the bond has neither yet. */
export async function fetchBondLink(bondId: Hex): Promise<BondLink> {
  const [safe, label] = await Promise.all([
    worldchainClient.readContract({
      address: VAULT_ADDRESSES.BOND_VAULT_MODULE,
      abi: BOND_VAULT_MODULE_ABI,
      functionName: 'vaultOf',
      args: [bondId],
    }) as Promise<`0x${string}`>,
    worldchainClient.readContract({
      address: BOND_REGISTRAR_ADDRESS,
      abi: BOND_REGISTRAR_ABI,
      functionName: 'labelOf',
      args: [bondId],
    }),
  ]);
  if (safe === ZERO) throw new Error(`Bond ${bondId} has no shared wallet on World Chain yet`);
  if (!label) throw new Error(`Bond ${bondId} has no ENS name yet`);
  return { bondId, safe, label };
}

/**
 * The link between a bond on World Chain and its joint account on Stellar.
 *
 * The joint account carries three data entries, written in the same transaction that creates it:
 *   humanbond.bond   32 raw bytes — the bondId
 *   humanbond.safe   20 raw bytes — the bond Safe on World Chain
 *   humanbond.label  utf-8        — the ENS label (`<label>.humanbond.eth`)
 *
 * These entries are the Stellar side's claim. On their own anyone could write them, so the
 * federation server only trusts them when World Chain points back (see lib/stellar/directory.ts).
 */
import { Buffer } from 'buffer';
import { createPublicClient, http, type Hex } from 'viem';
import { worldchain } from '@/lib/wagmi/worldchain';
import { BOND_REGISTRAR_ABI, BOND_REGISTRAR_ADDRESS } from '@/lib/contracts/registrar';
import { BOND_VAULT_MODULE_ABI, VAULT_ADDRESSES } from '@/lib/contracts/vault';

export const DATA_KEYS = {
  bond: 'humanbond.bond',
  safe: 'humanbond.safe',
  label: 'humanbond.label',
} as const;

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

/** The three data-entry values, as the bytes Stellar stores. */
export function encodeBondLink(link: BondLink): Record<keyof typeof DATA_KEYS, Buffer> {
  return {
    bond: Buffer.from(link.bondId.slice(2), 'hex'),
    safe: Buffer.from(link.safe.slice(2), 'hex'),
    label: Buffer.from(link.label, 'utf8'),
  };
}

/** Decode the data entries Horizon returns (base64 values). Returns null if any is missing. */
export function decodeBondLink(data: Record<string, string>): BondLink | null {
  const bond = data[DATA_KEYS.bond];
  const safe = data[DATA_KEYS.safe];
  const label = data[DATA_KEYS.label];
  if (!bond || !safe || !label) return null;
  return {
    bondId: `0x${Buffer.from(bond, 'base64').toString('hex')}`,
    safe: `0x${Buffer.from(safe, 'base64').toString('hex')}`,
    label: Buffer.from(label, 'base64').toString('utf8'),
  };
}

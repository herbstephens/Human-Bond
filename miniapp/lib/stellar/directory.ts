/**
 * Name → vault resolution for /pay/<label> and /vault/<label>. Runs server-side.
 *
 * A vault's config (bondId, Safe, label) is a claim anyone could make: a squatter could deploy a
 * vault saying "I belong to alice-ben's Safe" with themselves as partners, and catch the couple's
 * payments. So a name only resolves when something the couple controls points at the vault:
 *
 *   1. ENS (the real proof). The bond Safe owns `<label>.humanbond.eth`; only the two partners
 *      together can set its `com.humanbond.stellar` text record. If it is set, it wins, and the
 *      vault's Safe must equal the name's address record.
 *   2. Testnet allowlist (a stand-in). STELLAR_TESTNET_DIRECTORY="label=C…,label=C…", for demos
 *      until the Safe transaction that writes the text record exists. Refused on mainnet.
 *
 * Either way the vault must carry the same label.
 */
import { StrKey } from '@stellar/stellar-sdk';
import { STELLAR_NETWORK } from './config';
import { readVaultConfig, type VaultConfig } from './vault';
import { worldchainClient } from './bondLink';
import { BOND_REGISTRAR_ADDRESS } from '@/lib/contracts/registrar';

export const ENS_STELLAR_TEXT_KEY = 'com.humanbond.stellar';

const REGISTRAR_REGISTRY_ABI = [
  { type: 'function', name: 'registry', inputs: [], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'baseNode', inputs: [], outputs: [{ name: '', type: 'bytes32' }], stateMutability: 'view' },
] as const;

const L2_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'makeNode',
    inputs: [{ name: 'parentNode', type: 'bytes32' }, { name: 'label', type: 'string' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'text',
    inputs: [{ name: 'node', type: 'bytes32' }, { name: 'key', type: 'string' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'addr',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

export type Resolution =
  | { ok: true; vaultId: string; config: VaultConfig; proof: 'ens' | 'testnet-allowlist' }
  | { ok: false; reason: string };

async function readEnsRecords(label: string): Promise<{ stellar: string; safe: `0x${string}` }> {
  const [registry, baseNode] = await Promise.all([
    worldchainClient.readContract({ address: BOND_REGISTRAR_ADDRESS, abi: REGISTRAR_REGISTRY_ABI, functionName: 'registry' }),
    worldchainClient.readContract({ address: BOND_REGISTRAR_ADDRESS, abi: REGISTRAR_REGISTRY_ABI, functionName: 'baseNode' }),
  ]);
  const node = await worldchainClient.readContract({
    address: registry,
    abi: L2_REGISTRY_ABI,
    functionName: 'makeNode',
    args: [baseNode, label],
  });
  const [stellar, safe] = await Promise.all([
    worldchainClient.readContract({ address: registry, abi: L2_REGISTRY_ABI, functionName: 'text', args: [node, ENS_STELLAR_TEXT_KEY] }),
    worldchainClient.readContract({ address: registry, abi: L2_REGISTRY_ABI, functionName: 'addr', args: [node] }),
  ]);
  return { stellar, safe };
}

function readAllowlist(): Map<string, string> {
  const raw = process.env.STELLAR_TESTNET_DIRECTORY;
  if (!raw) return new Map();
  if (STELLAR_NETWORK !== 'testnet') {
    throw new Error('STELLAR_TESTNET_DIRECTORY is set on mainnet. It is a testnet stand-in; remove it.');
  }
  return new Map(
    raw.split(',').map((pair) => {
      const [label, vaultId] = pair.trim().split('=');
      if (!label || !vaultId) throw new Error(`Malformed STELLAR_TESTNET_DIRECTORY entry: "${pair}"`);
      return [label, vaultId] as const;
    }),
  );
}

export async function resolveLabel(label: string): Promise<Resolution> {
  const ens = await readEnsRecords(label);

  let vaultId: string;
  let proof: 'ens' | 'testnet-allowlist';
  if (ens.stellar) {
    vaultId = ens.stellar;
    proof = 'ens';
  } else {
    const listed = readAllowlist().get(label);
    if (!listed) return { ok: false, reason: `no Stellar vault recorded for "${label}"` };
    vaultId = listed;
    proof = 'testnet-allowlist';
  }
  if (!StrKey.isValidContract(vaultId)) return { ok: false, reason: `${vaultId} is not a contract address` };

  const config = await readVaultConfig(vaultId);
  if (config.link.label !== label) {
    return { ok: false, reason: `${vaultId} is linked to "${config.link.label}", not "${label}"` };
  }
  if (proof === 'ens' && config.link.safe.toLowerCase() !== ens.safe.toLowerCase()) {
    return { ok: false, reason: `${vaultId} points at Safe ${config.link.safe}, but the ENS name resolves to ${ens.safe}` };
  }
  return { ok: true, vaultId, config, proof };
}

/**
 * Name → joint account resolution for the federation server. Server-side only.
 *
 * The Stellar account's own data entries are a claim anyone could write: a squatter could create
 * an account saying "I belong to alice-ben's Safe" and catch the couple's payments. So a name
 * only resolves when something the couple controls points at the account:
 *
 *   1. ENS (the real proof). The bond Safe owns `<label>.humanbond.eth`; only the two partners
 *      together can set its `com.humanbond.stellar` text record. If it is set, it wins, and the
 *      account's humanbond.safe entry must equal the name's address record.
 *   2. Testnet allowlist (a stand-in). STELLAR_TESTNET_DIRECTORY="label=G…,label=G…", for demos
 *      until the Safe transaction that writes the text record exists. Refused on mainnet.
 *
 * Either way the account must also pass inspectJointAccount and carry the same label.
 */
import { STELLAR_NETWORK } from './config';
import { inspectJointAccount, type JointAccount } from './jointAccount';
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
  | { ok: true; account: JointAccount; proof: 'ens' | 'testnet-allowlist' }
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
      const [label, accountId] = pair.trim().split('=');
      if (!label || !accountId) throw new Error(`Malformed STELLAR_TESTNET_DIRECTORY entry: "${pair}"`);
      return [label, accountId] as const;
    }),
  );
}

export async function resolveLabel(label: string): Promise<Resolution> {
  const ens = await readEnsRecords(label);

  let accountId: string;
  let proof: 'ens' | 'testnet-allowlist';
  if (ens.stellar) {
    accountId = ens.stellar;
    proof = 'ens';
  } else {
    const listed = readAllowlist().get(label);
    if (!listed) return { ok: false, reason: `no Stellar account recorded for "${label}"` };
    accountId = listed;
    proof = 'testnet-allowlist';
  }

  const check = await inspectJointAccount(accountId);
  if (!check.ok) return { ok: false, reason: `${accountId}: ${check.reason}` };
  const { account } = check;

  if (account.link.label !== label) {
    return { ok: false, reason: `${accountId} is linked to "${account.link.label}", not "${label}"` };
  }
  if (proof === 'ens' && account.link.safe.toLowerCase() !== ens.safe.toLowerCase()) {
    return { ok: false, reason: `${accountId} points at Safe ${account.link.safe}, but the ENS name resolves to ${ens.safe}` };
  }
  return { ok: true, account, proof };
}

/**
 * HumanBondRegistrar — the ENS subname layer.
 *
 * Deployed to Worldchain mainnet 2026-07-24. Gives every bond's shared Safe a
 * `<label>.humanbond.eth` subname, owned by the Safe and resolving to it.
 *
 * The mini app calls `register(label)` as the THIRD entry in the vault-creation
 * batch — after the Safe is created and registered with the module. The registrar
 * reads the caller's active bond and its vault on-chain, so no owner/address
 * argument is needed: the name always follows the bond's wallet.
 *
 * One name per bond instance, no renames. A pair who dissolves and re-bonds may
 * claim a new one; their old name stays with their old Safe.
 */
import { CONTRACT_ADDRESSES } from './index';

export const BOND_REGISTRAR_ADDRESS = CONTRACT_ADDRESSES.BOND_REGISTRAR;

/** The parent every subname hangs off. */
// The parent the LIVE registrar actually registers under: its `baseNode` equals
// namehash('humandbond.eth'), confirmed on-chain. The old default ('humanbond.eth')
// hashed to a node this registrar knows nothing about.
export const ENS_PARENT = (process.env.NEXT_PUBLIC_ENS_PARENT ?? 'humandbond.eth') as string;

/** The Durin L2Registry that holds the records under ENS_PARENT. The registrar
 *  writes names here; resolving one back to an address reads `addr(node)`. */
// Read straight off the live registrar (`registry()`), so name resolution and
// name registration can never point at different registries. The previous value
// was the registry for `humanbond.eth`, where every `humandbond.eth` name
// resolves to the zero address — i.e. "nobody owns that name", always.
export const L2_REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_L2_REGISTRY ??
  '0x0ce4122CA2f0466891f0A8c023ef8091585aDfc8') as `0x${string}`;

export const L2_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'addr',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const;

export const BOND_REGISTRAR_ABI = [
  {
    type: 'function',
    name: 'register',
    inputs: [{ name: 'label', type: 'string' }],
    outputs: [{ name: 'node', type: 'bytes32' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'available',
    inputs: [{ name: 'label', type: 'string' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'labelOf',
    inputs: [{ name: 'bondId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nodeOfBond',
    inputs: [{ name: 'bondId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'markDissolved',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

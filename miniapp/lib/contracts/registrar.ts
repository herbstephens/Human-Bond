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

/** The parent every subname hangs off. Default is production (humanbond.eth); the TEST
 *  environment overrides it to humandbond.eth via NEXT_PUBLIC_ENS_PARENT (see .env.local). */
export const ENS_PARENT = (process.env.NEXT_PUBLIC_ENS_PARENT ?? 'humanbond.eth') as string;

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

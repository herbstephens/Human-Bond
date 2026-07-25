/**
 * Builds the transaction batch that brings a bond vault into existence.
 *
 * Three calls in one MiniKit transaction, executed in order:
 *   1. SafeProxyFactory.createProxyWithNonce — deploys the Safe, and via the
 *      setup() delegatecall enables our module in the same transaction.
 *   2. BondVaultModule.registerVault — links the Safe to the bond.
 *   3. HumanBondRegistrar.register — claims the couple's ENS subname, pointing
 *      it at the Safe. Always present: every vault is born with a name (chosen
 *      by the couple or auto-generated, see lib/ens/autoLabel.ts). register()
 *      requires the vault from step 2 to already exist, which the batch order
 *      guarantees — wallet and name come into existence together, or not at all.
 *
 * All three entrypoints must be whitelisted in the World Developer Portal.
 * ModuleSetup does not: it is reached by delegatecall, never called directly.
 */
import {
  BOND_VAULT_MODULE_ABI,
  SAFE_PROXY_FACTORY_ABI,
  VAULT_ADDRESSES,
} from '@/lib/contracts/vault';
import { BOND_REGISTRAR_ADDRESS, BOND_REGISTRAR_ABI } from '@/lib/contracts/registrar';
import {
  buildSafeInitializer,
  fetchBondEpoch,
  predictVaultAddress,
  vaultSaltNonce,
} from './safeAddress';

export type CreateVaultTx = {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args: unknown[];
};

export async function buildCreateVaultTx(
  partnerA: `0x${string}`,
  partnerB: `0x${string}`,
  bondId: `0x${string}`,
  /** Normalised ENS label — mandatory, every vault is created with its subname. */
  ensLabel: string,
): Promise<{ transaction: CreateVaultTx[]; vaultAddress: `0x${string}` }> {
  if (!ensLabel) throw new Error('An ENS label is required to create the vault');
  const initializer = buildSafeInitializer(partnerA, partnerB);

  // Read the epoch once and reuse it, so the address we predict and the address the factory
  // actually deploys cannot diverge if the pair re-bonds between the two calls.
  const epoch = await fetchBondEpoch(bondId);
  const vaultAddress = await predictVaultAddress(partnerA, partnerB, bondId, epoch);

  const transaction: CreateVaultTx[] = [
    {
      address: VAULT_ADDRESSES.SAFE_PROXY_FACTORY,
      abi: SAFE_PROXY_FACTORY_ABI,
      functionName: 'createProxyWithNonce',
      args: [
        VAULT_ADDRESSES.SAFE_SINGLETON,
        initializer,
        vaultSaltNonce(bondId, epoch),
      ],
    },
    {
      address: VAULT_ADDRESSES.BOND_VAULT_MODULE,
      abi: BOND_VAULT_MODULE_ABI,
      functionName: 'registerVault',
      args: [bondId, vaultAddress],
    },
    {
      address: BOND_REGISTRAR_ADDRESS,
      abi: BOND_REGISTRAR_ABI,
      functionName: 'register',
      args: [ensLabel],
    },
  ];

  return { vaultAddress, transaction };
}

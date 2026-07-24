/**
 * Counterfactual Safe address derivation.
 *
 * The vault's address is a pure function of (owners, bondId), so both partners
 * compute the same one and the UI can show it before the Safe exists on-chain.
 * We derive it locally rather than pulling in @safe-global/protocol-kit for one
 * CREATE2 computation.
 *
 * Mirrors SafeProxyFactory.createProxyWithNonce:
 *   salt         = keccak256(keccak256(initializer) ++ saltNonce)
 *   initCode     = proxyCreationCode ++ uint256(singleton)
 *   address      = CREATE2(factory, salt, keccak256(initCode))
 *
 * The salt nonce mixes in the bond's epoch, not just its id. A bond id is a pure function of the
 * two addresses, so a couple who dissolves and bonds again would otherwise derive the exact same
 * Safe address as last time — and createProxyWithNonce reverts when something already lives
 * there, leaving them permanently unable to create a shared wallet again.
 */
import {
  encodeFunctionData,
  encodePacked,
  getContractAddress,
  keccak256,
} from 'viem';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi/config';
import { CONTRACT_ADDRESSES, HUMAN_BOND_ABI } from '@/lib/contracts';
import {
  MODULE_SETUP_ABI,
  SAFE_ABI,
  SAFE_PROXY_FACTORY_ABI,
  VAULT_ADDRESSES,
} from '@/lib/contracts/vault';

const ZERO = '0x0000000000000000000000000000000000000000' as const;

/**
 * Sort the two partners so both clients build byte-identical initializers.
 *
 * The Safe's address depends on the exact initializer bytes, so if Ana derived
 * [Ana, Bruno] and Bruno derived [Bruno, Ana] they would compute two different
 * vaults for the same bond. Same ordering rule the contract uses for bondId.
 */
export function sortOwners(a: `0x${string}`, b: `0x${string}`): [`0x${string}`, `0x${string}`] {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}

/**
 * Build the Safe `setup()` initializer, including the delegatecall that enables
 * our module in the same transaction that creates the Safe.
 *
 * Enabling the module afterwards would need a full 2-of-2 owner transaction,
 * meaning both partners would have to act before the vault did anything.
 */
export function buildSafeInitializer(partnerA: `0x${string}`, partnerB: `0x${string}`): `0x${string}` {
  const owners = sortOwners(partnerA, partnerB);

  const enableModuleData = encodeFunctionData({
    abi: MODULE_SETUP_ABI,
    functionName: 'enableModule',
    args: [VAULT_ADDRESSES.BOND_VAULT_MODULE],
  });

  return encodeFunctionData({
    abi: SAFE_ABI,
    functionName: 'setup',
    args: [
      owners,
      BigInt(2), // threshold: both partners for anything outside the module
      VAULT_ADDRESSES.MODULE_SETUP,
      enableModuleData,
      VAULT_ADDRESSES.SAFE_FALLBACK_HANDLER,
      ZERO, // paymentToken
      BigInt(0), // payment
      ZERO, // paymentReceiver
    ],
  });
}

/**
 * The salt nonce for a bond instance: (bondId, epoch).
 *
 * Must match `registerVault`'s view of which bond instance a Safe belongs to,
 * so both sides derive from the epoch the contract reports.
 */
export function vaultSaltNonce(bondId: `0x${string}`, epoch: bigint): bigint {
  return BigInt(
    keccak256(encodePacked(['bytes32', 'uint256'], [bondId, epoch])),
  );
}

/** Reads how many times this pair has bonded. 0 means never. */
export async function fetchBondEpoch(bondId: `0x${string}`): Promise<bigint> {
  return (await readContract(wagmiConfig, {
    address: CONTRACT_ADDRESSES.HUMAN_BOND,
    abi: HUMAN_BOND_ABI,
    functionName: 'bondEpoch',
    args: [bondId],
  })) as bigint;
}

/**
 * Derive the vault address for the pair's CURRENT bond.
 *
 * Reads `proxyCreationCode` (immutable, cacheable) and the bond epoch, which
 * changes only when the pair bonds again.
 */
export async function predictVaultAddress(
  partnerA: `0x${string}`,
  partnerB: `0x${string}`,
  bondId: `0x${string}`,
  epoch?: bigint,
): Promise<`0x${string}`> {
  const initializer = buildSafeInitializer(partnerA, partnerB);

  const [proxyCreationCode, resolvedEpoch] = await Promise.all([
    readContract(wagmiConfig, {
      address: VAULT_ADDRESSES.SAFE_PROXY_FACTORY,
      abi: SAFE_PROXY_FACTORY_ABI,
      functionName: 'proxyCreationCode',
    }) as Promise<`0x${string}`>,
    epoch === undefined ? fetchBondEpoch(bondId) : Promise.resolve(epoch),
  ]);

  const salt = keccak256(
    encodePacked(
      ['bytes32', 'uint256'],
      [keccak256(initializer), vaultSaltNonce(bondId, resolvedEpoch)],
    ),
  );

  const initCode = encodePacked(
    ['bytes', 'uint256'],
    [proxyCreationCode, BigInt(VAULT_ADDRESSES.SAFE_SINGLETON)],
  );

  return getContractAddress({
    opcode: 'CREATE2',
    from: VAULT_ADDRESSES.SAFE_PROXY_FACTORY,
    salt,
    bytecodeHash: keccak256(initCode),
  });
}

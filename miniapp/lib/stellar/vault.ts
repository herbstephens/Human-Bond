/**
 * Client for the BondVault Soroban contract (contracts-stellar/contracts/bond-vault).
 *
 * Same rules as the EVM BondVaultModule: one partner alone for small spends (per-spend threshold
 * and a shared rolling 24h budget), both partners for anything larger, and a 50/50 split on
 * dissolution after a delay. One contract instance per bond; its address is where the couple
 * receives.
 *
 * Every write here is a transaction whose source is the acting partner, so the contract's
 * `require_auth` is satisfied by the ordinary transaction signature — the wallet signs once.
 */
import { Buffer } from 'buffer';
import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  Keypair,
  Operation,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  type xdr,
} from '@stellar/stellar-sdk';
import { STELLAR, sorobanRpc } from './config';
import type { BondLink } from './bondLink';
import { fromStroops, toStroops } from './payment';

/** Defaults mirror the EVM module: 10 USDC per spend, 25 USDC per day, 3-day dissolution delay. */
export const DEFAULT_VAULT_RULES = {
  smallSpendThreshold: '10',
  dailyFreeLimit: '25',
  dissolutionDelaySeconds: 3 * 24 * 60 * 60,
};

export type VaultConfig = {
  partnerA: string;
  partnerB: string;
  token: string;
  link: BondLink;
  smallSpendThreshold: string;
  dailyFreeLimit: string;
  dissolutionDelaySeconds: number;
};

export type SpendStatus = 'Pending' | 'Executed' | 'Cancelled';

export type VaultSpend = {
  id: number;
  to: string;
  amount: string;
  proposer: string;
  createdAt: Date;
  approvedA: boolean;
  approvedB: boolean;
  status: SpendStatus;
};

export type VaultState = {
  vaultId: string;
  config: VaultConfig;
  balance: string;
  remainingFreeAllowance: string;
  spends: VaultSpend[];
  dissolution: { requester: string; requestedAt: Date; executableAt: Date } | null;
  dissolved: boolean;
};

const addr = (a: string) => nativeToScVal(Address.fromString(a), { type: 'address' });
const i128 = (amount: string) => nativeToScVal(toStroops(amount), { type: 'i128' });
const u64 = (n: number | bigint) => nativeToScVal(BigInt(n), { type: 'u64' });

/** Simulate, then assemble with the footprint and fees the simulation found. */
async function prepare(tx: ReturnType<TransactionBuilder['build']>) {
  const sim = await sorobanRpc.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error(`Simulation failed: ${'error' in sim ? sim.error : JSON.stringify(sim)}`);
  }
  return { prepared: rpc.assembleTransaction(tx, sim).build(), retval: sim.result?.retval };
}

async function invokeTx(source: string, contractId: string, method: string, args: xdr.ScVal[]): Promise<string> {
  const account = await sorobanRpc.getAccount(source);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: STELLAR.passphrase })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(300)
    .build();
  return (await prepare(tx)).prepared.toXDR();
}

/** Read-only call: simulated with a throwaway source, never submitted. */
async function view(contractId: string, method: string, args: xdr.ScVal[] = []) {
  const source = new Account(Keypair.random().publicKey(), '0');
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: STELLAR.passphrase })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await sorobanRpc.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error(`${method} on ${contractId} failed: ${'error' in sim ? sim.error : 'no result'}`);
  }
  return scValToNative(sim.result.retval);
}

/** Submit a signed Soroban transaction and wait for it. Throws with the result if it fails. */
export async function submitSoroban(signedXdr: string): Promise<string> {
  const tx = TransactionBuilder.fromXDR(signedXdr, STELLAR.passphrase);
  const sent = await sorobanRpc.sendTransaction(tx);
  if (sent.status === 'ERROR') throw new Error(`Rejected: ${JSON.stringify(sent.errorResult ?? sent)}`);
  const final = await sorobanRpc.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Transaction ${sent.hash} ended as ${final.status}`);
  }
  return sent.hash;
}

/* --------------------------------- deploy --------------------------------- */

/**
 * Build the transaction that deploys a new vault for this bond, constructor included. Returns the
 * vault's future contract id (from simulation) alongside the unsigned XDR.
 */
export async function buildDeployVaultTx(params: {
  deployer: string;
  partnerA: string;
  partnerB: string;
  link: BondLink;
  smallSpendThreshold?: string;
  dailyFreeLimit?: string;
  dissolutionDelaySeconds?: number;
}): Promise<{ xdr: string; vaultId: string }> {
  const { deployer, partnerA, partnerB, link } = params;
  for (const key of [deployer, partnerA, partnerB]) {
    if (!StrKey.isValidEd25519PublicKey(key)) throw new Error(`Not a Stellar account: ${key}`);
  }
  if (partnerA === partnerB) throw new Error('The two partners must use different Stellar accounts');

  const salt = crypto.getRandomValues(new Uint8Array(32));
  const account = await sorobanRpc.getAccount(deployer);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: STELLAR.passphrase })
    .addOperation(
      Operation.createCustomContract({
        address: Address.fromString(deployer),
        wasmHash: Buffer.from(STELLAR.vaultWasmHash, 'hex'),
        salt: Buffer.from(salt),
        constructorArgs: [
          addr(partnerA),
          addr(partnerB),
          addr(STELLAR.usdcContractId),
          nativeToScVal(Buffer.from(link.bondId.slice(2), 'hex'), { type: 'bytes' }),
          nativeToScVal(Buffer.from(link.safe.slice(2), 'hex'), { type: 'bytes' }),
          nativeToScVal(link.label, { type: 'string' }),
          i128(params.smallSpendThreshold ?? DEFAULT_VAULT_RULES.smallSpendThreshold),
          i128(params.dailyFreeLimit ?? DEFAULT_VAULT_RULES.dailyFreeLimit),
          u64(params.dissolutionDelaySeconds ?? DEFAULT_VAULT_RULES.dissolutionDelaySeconds),
        ],
      }),
    )
    .setTimeout(300)
    .build();
  const { prepared, retval } = await prepare(tx);
  if (!retval) throw new Error('Deploy simulation returned no contract id');
  return { xdr: prepared.toXDR(), vaultId: scValToNative(retval) as string };
}

/* --------------------------------- writes --------------------------------- */

export const buildProposeSpendTx = (vaultId: string, proposer: string, to: string, amount: string) =>
  invokeTx(proposer, vaultId, 'propose_spend', [addr(proposer), addr(to), i128(amount)]);

export const buildApproveSpendTx = (vaultId: string, approver: string, id: number) =>
  invokeTx(approver, vaultId, 'approve_spend', [addr(approver), u64(id)]);

export const buildCancelSpendTx = (vaultId: string, caller: string, id: number) =>
  invokeTx(caller, vaultId, 'cancel_spend', [addr(caller), u64(id)]);

export const buildRequestDissolutionTx = (vaultId: string, requester: string) =>
  invokeTx(requester, vaultId, 'request_dissolution', [addr(requester)]);

export const buildCancelDissolutionTx = (vaultId: string, requester: string) =>
  invokeTx(requester, vaultId, 'cancel_dissolution', [addr(requester)]);

/** Permissionless: anyone may finalize a matured dissolution, or split late arrivals. */
export const buildExecuteDissolutionTx = (vaultId: string, caller: string) =>
  invokeTx(caller, vaultId, 'execute_dissolution', []);

/** Pay USDC into the vault: a plain transfer on the USDC token contract. */
export const buildDepositTx = (vaultId: string, payer: string, amount: string) =>
  invokeTx(payer, STELLAR.usdcContractId, 'transfer', [addr(payer), addr(vaultId), i128(amount)]);

/* ---------------------------------- reads --------------------------------- */

type RawConfig = {
  partner_a: string;
  partner_b: string;
  token: string;
  bond_id: Buffer;
  safe: Buffer;
  label: string;
  small_spend_threshold: bigint;
  daily_free_limit: bigint;
  dissolution_delay: bigint;
};

type RawSpend = {
  to: string;
  amount: bigint;
  proposer: string;
  created_at: bigint;
  approved_a: boolean;
  approved_b: boolean;
  status: [SpendStatus];
};

export async function readVaultConfig(vaultId: string): Promise<VaultConfig> {
  const raw = (await view(vaultId, 'config')) as RawConfig;
  return {
    partnerA: raw.partner_a,
    partnerB: raw.partner_b,
    token: raw.token,
    link: {
      bondId: `0x${Buffer.from(raw.bond_id).toString('hex')}`,
      safe: `0x${Buffer.from(raw.safe).toString('hex')}`,
      label: raw.label,
    },
    smallSpendThreshold: fromStroops(raw.small_spend_threshold),
    dailyFreeLimit: fromStroops(raw.daily_free_limit),
    dissolutionDelaySeconds: Number(raw.dissolution_delay),
  };
}

export async function readVaultState(vaultId: string): Promise<VaultState> {
  const [config, balance, remaining, count, dissolution, dissolved] = await Promise.all([
    readVaultConfig(vaultId),
    view(vaultId, 'balance') as Promise<bigint>,
    view(vaultId, 'remaining_free_allowance') as Promise<bigint>,
    view(vaultId, 'spend_count') as Promise<bigint>,
    view(vaultId, 'dissolution') as Promise<{ requester: string; requested_at: bigint } | undefined>,
    view(vaultId, 'is_dissolved') as Promise<boolean>,
  ]);
  const ids = Array.from({ length: Number(count) }, (_, i) => i);
  const rawSpends = (await Promise.all(ids.map((id) => view(vaultId, 'get_spend', [u64(id)])))) as RawSpend[];
  return {
    vaultId,
    config,
    balance: fromStroops(balance),
    remainingFreeAllowance: fromStroops(remaining),
    spends: rawSpends.map((s, id) => ({
      id,
      to: s.to,
      amount: fromStroops(s.amount),
      proposer: s.proposer,
      createdAt: new Date(Number(s.created_at) * 1000),
      approvedA: s.approved_a,
      approvedB: s.approved_b,
      status: s.status[0],
    })),
    dissolution: dissolution
      ? {
          requester: dissolution.requester,
          requestedAt: new Date(Number(dissolution.requested_at) * 1000),
          executableAt: new Date((Number(dissolution.requested_at) + config.dissolutionDelaySeconds) * 1000),
        }
      : null,
    dissolved,
  };
}

/**
 * Client for the BondVault Soroban contract (contracts-stellar/contracts/bond-vault).
 *
 * Same rules as the EVM BondVaultModule: one partner alone for small spends (per-spend threshold
 * and a shared rolling 24h budget), both partners for anything larger, and a 50/50 split on
 * dissolution after a delay. One contract instance per bond; its address is where the couple
 * receives. The split is pull-based: dissolution books each half, `claim_share` delivers it, so
 * one partner who can't receive never holds up the other.
 *
 * Inheritance: both partners write a will (heirs, shares, unlock dates); every signed action is a
 * check-in; a partner who stops checking in can be reported, and after a challenge window
 * confirmed dead. First death → the survivor owns the vault; second death → heirs claim.
 *
 * Every write here is a transaction whose source is the acting partner, so the contract's
 * `require_auth` is satisfied by the ordinary transaction signature — the wallet signs once.
 * The exceptions need BOTH partners (`set_will`, `rescue`): see the co-signing helpers.
 */
import { Buffer } from 'buffer';
import {
  Account,
  Address,
  BASE_FEE,
  authorizeEntry,
  Contract,
  Keypair,
  Operation,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  type SigningCallback,
  xdr,
} from '@stellar/stellar-sdk';
import { STELLAR, sorobanRpc } from './config';
import type { BondLink } from './bondLink';
import { fromStroops, toStroops } from './payment';

const DAY = 24 * 60 * 60;

/**
 * Defaults mirror the EVM module (10 USDC per spend, 25 per day, 3-day dissolution delay) and
 * the team's inheritance design (90-day check-in, as the Selfie Check heartbeat; 30-day challenge).
 */
export const DEFAULT_VAULT_RULES = {
  smallSpendThreshold: '10',
  dailyFreeLimit: '25',
  dissolutionDelaySeconds: 3 * DAY,
  heartbeatIntervalSeconds: 90 * DAY,
  challengeWindowSeconds: 30 * DAY,
};

export type Heir = { heir: string; bps: number; unlockAt: number };

export type VaultConfig = {
  partnerA: string;
  partnerB: string;
  token: string;
  link: BondLink;
  smallSpendThreshold: string;
  dailyFreeLimit: string;
  dissolutionDelaySeconds: number;
  heartbeatIntervalSeconds: number;
  challengeWindowSeconds: number;
};

export type PartnerLife = {
  lastSeen: Date;
  /** Missed check-in reported: the challenge window ends at this time. */
  lapseEndsAt: Date | null;
  deceased: boolean;
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
  /** Booked, not yet delivered shares after dissolution ("0.0000000" before). */
  owedA: string;
  owedB: string;
  lifeA: PartnerLife;
  lifeB: PartnerLife;
  will: (Heir & { owed: string })[];
};

const addr = (a: string) => nativeToScVal(Address.fromString(a), { type: 'address' });
const i128 = (amount: string) => nativeToScVal(toStroops(amount), { type: 'i128' });
const u64 = (n: number | bigint) => nativeToScVal(BigInt(n), { type: 'u64' });
const heirsArg = (heirs: Heir[]) =>
  xdr.ScVal.scvVec(
    heirs.map((h) =>
      nativeToScVal(
        { heir: Address.fromString(h.heir), bps: h.bps, unlock_at: BigInt(h.unlockAt) },
        { type: { heir: ['symbol', 'address'], bps: ['symbol', 'u32'], unlock_at: ['symbol', 'u64'] } },
      ),
    ),
  );

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
  heartbeatIntervalSeconds?: number;
  challengeWindowSeconds?: number;
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
          u64(params.heartbeatIntervalSeconds ?? DEFAULT_VAULT_RULES.heartbeatIntervalSeconds),
          u64(params.challengeWindowSeconds ?? DEFAULT_VAULT_RULES.challengeWindowSeconds),
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

/** Permissionless: anyone may finalize a matured dissolution (booking the split), or book late arrivals. */
export const buildExecuteDissolutionTx = (vaultId: string, caller: string) =>
  invokeTx(caller, vaultId, 'execute_dissolution', []);

/** Permissionless: deliver `partner`'s booked share to `partner`. `caller` only pays the fee. */
export const buildClaimShareTx = (vaultId: string, caller: string, partner: string) =>
  invokeTx(caller, vaultId, 'claim_share', [addr(partner)]);

/** A transfer on any Stellar token contract (7-decimal amounts, as every classic asset has). */
export const buildTokenTransferTx = (token: string, from: string, to: string, amount: string) =>
  invokeTx(from, token, 'transfer', [addr(from), addr(to), i128(amount)]);

/** Pay USDC into the vault: a plain transfer on the USDC token contract. */
export const buildDepositTx = (vaultId: string, payer: string, amount: string) =>
  buildTokenTransferTx(STELLAR.usdcContractId, payer, vaultId, amount);

/* ------------------------- calls needing both partners ------------------------- */

/**
 * Two-step co-signing for `set_will` and `rescue`. Step 1: the FIRST partner signs their
 * authorization entry (the transaction will come from the other partner, `source`). The result
 * is plain base64 XDR, safe to pass in a link — it only authorizes this exact call, until
 * `validForLedgers` ledgers from now. Step 2 (`finishCoSignTx`): `source` builds the transaction
 * with those entries, re-simulates, and signs it as usual.
 */
export async function coSignFirst(params: {
  vaultId: string;
  method: 'set_will' | 'rescue';
  args: xdr.ScVal[];
  source: string;
  firstSigner: Keypair | SigningCallback;
  validForLedgers?: number;
}): Promise<string[]> {
  const { vaultId, method, args, source, firstSigner } = params;
  const account = await sorobanRpc.getAccount(source);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: STELLAR.passphrase })
    .addOperation(new Contract(vaultId).call(method, ...args))
    .setTimeout(300)
    .build();
  const sim = await sorobanRpc.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error(`Simulation failed: ${'error' in sim ? sim.error : JSON.stringify(sim)}`);
  }
  const { sequence } = await sorobanRpc.getLatestLedger();
  const entries = await Promise.all(
    (sim.result?.auth ?? []).map((entry) =>
      // The source partner is covered by the transaction signature. Every address-credential
      // variant needs signing (protocol 29 simulation returns AddressV2).
      entry.credentials.type === 'sorobanCredentialsSourceAccount'
        ? entry
        : authorizeEntry(entry, firstSigner, sequence + (params.validForLedgers ?? 1000), STELLAR.passphrase),
    ),
  );
  return entries.map((e) => e.toXdr('base64'));
}

/**
 * Step 2: build the call with the first partner's signed entries and re-simulate WITH them (the
 * first simulation did not include verifying that signature; its resources fail on-chain —
 * INVOKE_HOST_FUNCTION_RESOURCE_LIMIT_EXCEEDED, seen on testnet). Returns XDR for `source` to sign.
 */
export async function finishCoSignTx(params: {
  vaultId: string;
  method: 'set_will' | 'rescue';
  args: xdr.ScVal[];
  source: string;
  signedEntries: string[];
}): Promise<string> {
  const { vaultId, method, args, source, signedEntries } = params;
  const call = new Contract(vaultId).call(method, ...args);
  const decoded = Operation.fromXDRObject(call);
  if (decoded.type !== 'invokeHostFunction') throw new Error('expected an invokeHostFunction operation');
  const auth = signedEntries.map((e) => xdr.SorobanAuthorizationEntry.fromXdr(e, 'base64'));
  const account = await sorobanRpc.getAccount(source);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: STELLAR.passphrase })
    .addOperation(Operation.invokeHostFunction({ func: decoded.func, auth }))
    .setTimeout(300)
    .build();
  return (await prepare(tx)).prepared.toXDR();
}

export const willArgs = (heirs: Heir[]) => [heirsArg(heirs)];
export const rescueArgs = (token: string, to: string, amount: string) => [addr(token), addr(to), i128(amount)];

/** One-shot rescue when both keys are at hand (scripts): first signer signs, `source` finishes. */
export async function buildRescueTx(params: {
  vaultId: string;
  source: string;
  token: string;
  to: string;
  amount: string;
  otherSigner: Keypair | SigningCallback;
}): Promise<string> {
  const args = rescueArgs(params.token, params.to, params.amount);
  const signedEntries = await coSignFirst({ vaultId: params.vaultId, method: 'rescue', args, source: params.source, firstSigner: params.otherSigner });
  return finishCoSignTx({ vaultId: params.vaultId, method: 'rescue', args, source: params.source, signedEntries });
}

/* ------------------------------- inheritance ------------------------------- */

export const buildHeartbeatTx = (vaultId: string, partner: string) =>
  invokeTx(partner, vaultId, 'heartbeat', [addr(partner)]);

/** Permissionless: report a partner who missed their check-in. */
export const buildReportLapseTx = (vaultId: string, caller: string, partner: string) =>
  invokeTx(caller, vaultId, 'report_lapse', [addr(partner)]);

/** Permissionless: confirm a death once the challenge window passed without a check-in. */
export const buildConfirmDeathTx = (vaultId: string, caller: string, partner: string) =>
  invokeTx(caller, vaultId, 'confirm_death', [addr(partner)]);

/** Permissionless: deliver an heir's unlocked part of the estate to that heir. */
export const buildClaimInheritanceTx = (vaultId: string, caller: string, heir: string) =>
  invokeTx(caller, vaultId, 'claim_inheritance', [addr(heir)]);

/** Permissionless: after both deaths, book late arrivals to the heirs. */
export const buildBookLateEstateTx = (vaultId: string, caller: string) =>
  invokeTx(caller, vaultId, 'book_late_estate', []);

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
  heartbeat_interval: bigint;
  challenge_window: bigint;
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
    heartbeatIntervalSeconds: Number(raw.heartbeat_interval),
    challengeWindowSeconds: Number(raw.challenge_window),
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
  const [owedA, owedB] = (await Promise.all([
    view(vaultId, 'owed', [addr(config.partnerA)]),
    view(vaultId, 'owed', [addr(config.partnerB)]),
  ])) as [bigint, bigint];
  const life = async (partner: string): Promise<PartnerLife> => {
    const [lastSeen, lapse, deceased] = (await Promise.all([
      view(vaultId, 'last_seen', [addr(partner)]),
      view(vaultId, 'lapse', [addr(partner)]),
      view(vaultId, 'is_deceased', [addr(partner)]),
    ])) as [bigint, bigint | null, boolean];
    return {
      lastSeen: new Date(Number(lastSeen) * 1000),
      // Option::None arrives as null.
      lapseEndsAt: lapse == null ? null : new Date((Number(lapse) + config.challengeWindowSeconds) * 1000),
      deceased,
    };
  };
  const [lifeA, lifeB, rawWill] = await Promise.all([
    life(config.partnerA),
    life(config.partnerB),
    view(vaultId, 'will') as Promise<{ heir: string; bps: number; unlock_at: bigint }[]>,
  ]);
  const will = await Promise.all(
    rawWill.map(async (h) => ({
      heir: h.heir,
      bps: Number(h.bps),
      unlockAt: Number(h.unlock_at),
      owed: fromStroops((await view(vaultId, 'estate_owed', [addr(h.heir)])) as bigint),
    })),
  );
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
    owedA: fromStroops(owedA),
    owedB: fromStroops(owedB),
    lifeA,
    lifeB,
    will,
  };
}

/**
 * Stellar network configuration for the bond vault.
 *
 * Each bond's vault is an instance of the BondVault Soroban contract (contracts-stellar/). Its
 * contract address is the couple's receiving address. Testnet is the default; set
 * NEXT_PUBLIC_STELLAR_NETWORK=public to run against mainnet, which also needs
 * NEXT_PUBLIC_STELLAR_RPC_URL (there is no default public mainnet RPC) and
 * NEXT_PUBLIC_STELLAR_VAULT_WASM_HASH (the vault wasm uploaded to mainnet).
 */
import { Asset, Horizon, Networks, rpc } from '@stellar/stellar-sdk';

type StellarNetwork = 'testnet' | 'public';

const NETWORKS = {
  testnet: {
    passphrase: Networks.TESTNET,
    horizonUrl: 'https://horizon-testnet.stellar.org',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    explorerUrl: 'https://stellar.expert/explorer/testnet',
    // Circle's testnet USDC.
    usdc: new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'),
    // contracts-stellar/contracts/bond-vault, uploaded 2026-10-25 (pull-based split + rescue).
    vaultWasmHash: 'b19fcd27089a2128f2e7c99d314c01fa4c70371c703d48b8e9f59e72bacd2a53',
  },
  public: {
    passphrase: Networks.PUBLIC,
    horizonUrl: 'https://horizon.stellar.org',
    rpcUrl: undefined,
    explorerUrl: 'https://stellar.expert/explorer/public',
    // Circle's mainnet USDC.
    usdc: new Asset('USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'),
    vaultWasmHash: undefined,
  },
} as const;

function readNetwork(): StellarNetwork {
  const value = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';
  if (value !== 'testnet' && value !== 'public') {
    throw new Error(`NEXT_PUBLIC_STELLAR_NETWORK must be "testnet" or "public", got "${value}"`);
  }
  return value;
}

export const STELLAR_NETWORK = readNetwork();

const base = NETWORKS[STELLAR_NETWORK];
const rpcUrl = process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? base.rpcUrl;
const vaultWasmHash = process.env.NEXT_PUBLIC_STELLAR_VAULT_WASM_HASH ?? base.vaultWasmHash;
if (!rpcUrl) throw new Error('NEXT_PUBLIC_STELLAR_RPC_URL is required on mainnet');
if (!vaultWasmHash) throw new Error('NEXT_PUBLIC_STELLAR_VAULT_WASM_HASH is required on mainnet');

export const STELLAR = {
  passphrase: base.passphrase,
  horizonUrl: base.horizonUrl,
  explorerUrl: base.explorerUrl,
  usdc: base.usdc,
  rpcUrl,
  vaultWasmHash,
  /** The USDC Stellar Asset Contract — what the vault holds and payers transfer through. */
  usdcContractId: base.usdc.contractId(base.passphrase),
};

export const horizon = new Horizon.Server(STELLAR.horizonUrl);
export const sorobanRpc = new rpc.Server(STELLAR.rpcUrl);

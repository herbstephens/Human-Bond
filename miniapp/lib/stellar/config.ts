/**
 * Stellar network configuration for the bond's joint account.
 *
 * The joint account is the Stellar twin of the bond Safe: a native Stellar account whose only
 * signers are the two partners (2-of-2, master key removed). Testnet is the default; set
 * NEXT_PUBLIC_STELLAR_NETWORK=public to run against mainnet.
 *
 * NEXT_PUBLIC_STELLAR_HOME_DOMAIN is the domain that serves /.well-known/stellar.toml and the
 * federation endpoint. It is written into every joint account's home_domain, so payers'
 * wallets can resolve `<label>*<domain>` and verify the reverse lookup.
 */
import { Asset, Horizon, Networks } from '@stellar/stellar-sdk';

type StellarNetwork = 'testnet' | 'public';

const NETWORKS = {
  testnet: {
    passphrase: Networks.TESTNET,
    horizonUrl: 'https://horizon-testnet.stellar.org',
    explorerUrl: 'https://stellar.expert/explorer/testnet',
    // Circle's testnet USDC.
    usdc: new Asset('USDC', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'),
  },
  public: {
    passphrase: Networks.PUBLIC,
    horizonUrl: 'https://horizon.stellar.org',
    explorerUrl: 'https://stellar.expert/explorer/public',
    // Circle's mainnet USDC.
    usdc: new Asset('USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'),
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
export const STELLAR = NETWORKS[STELLAR_NETWORK];

export const horizon = new Horizon.Server(STELLAR.horizonUrl);

export function stellarHomeDomain(): string {
  const domain = process.env.NEXT_PUBLIC_STELLAR_HOME_DOMAIN;
  if (!domain) throw new Error('NEXT_PUBLIC_STELLAR_HOME_DOMAIN is not set');
  return domain;
}

/** `<label>*<domain>` — the address payers type into any Stellar wallet. */
export function federationAddress(label: string): string {
  return `${label}*${stellarHomeDomain()}`;
}

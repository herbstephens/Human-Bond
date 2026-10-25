/**
 * Stellar Wallets Kit (Freighter, xBull, Lobstr, Albedo…), loaded on first use.
 * The kit touches `window`, so it must never be imported during SSR — call loadKit() from
 * event handlers only.
 */
import { STELLAR_NETWORK } from './config';

export type Kit = typeof import('@creit.tech/stellar-wallets-kit/sdk').StellarWalletsKit;

let kitPromise: Promise<Kit> | null = null;

export function loadKit(): Promise<Kit> {
  kitPromise ??= (async () => {
    const [{ StellarWalletsKit }, { defaultModules }, { Networks }] = await Promise.all([
      import('@creit.tech/stellar-wallets-kit/sdk'),
      import('@creit.tech/stellar-wallets-kit/modules/utils'),
      import('@creit.tech/stellar-wallets-kit/types'),
    ]);
    StellarWalletsKit.init({
      modules: defaultModules(),
      network: STELLAR_NETWORK === 'testnet' ? Networks.TESTNET : Networks.PUBLIC,
    });
    return StellarWalletsKit;
  })();
  return kitPromise;
}

/**
 * Purpose: Worldchain network configuration for wagmi
 * Defines the Worldchain Mainnet chain configuration
 * Used by wagmi for blockchain interactions
 */

import { defineChain } from 'viem'

/**
 * Worldchain Mainnet
 * 
 * Official mainnet for Worldchain - an Ethereum L2 optimized for World ID
 * 
 * Network Details:
 * - Chain ID: 480
 * - Native Currency: ETH
 * - RPC: Public Alchemy endpoint
 * - Explorer: Worldscan
 */
export const worldchain = defineChain({
  id: 480,
  name: 'Worldchain',
  network: 'worldchain',
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://worldchain-mainnet.g.alchemy.com/public'],
    },
    public: {
      http: ['https://worldchain-mainnet.g.alchemy.com/public'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Worldscan',
      url: 'https://worldchain.explorer.alchemy.com',
    },
  },
  testnet: false,
})


/**
 * Purpose: Wagmi configuration for HumanBond
 * Configures wagmi to work with Worldchain Mainnet
 * This config is used by WagmiProvider in the app layout
 */

'use client'

import { http, createConfig } from 'wagmi'
import { worldchain } from './worldchain'

/**
 * Wagmi Configuration
 * 
 * Sets up:
 * - Worldchain Mainnet as the supported network
 * - HTTP transport for RPC calls
 * 
 * Note: For wallet connection in World App, we use MiniKit.walletAuth
 * command instead of traditional wagmi connectors
 * 
 * Usage:
 * - Wrap your app with <WagmiProvider config={wagmiConfig}>
 * - Use for reading contract data with useReadContract()
 * - Use for writing with useWriteContract()
 */
export const wagmiConfig = createConfig({
  chains: [worldchain],
  transports: {
    [worldchain.id]: http(),
  },
})

/**
 * Helper: Get the current chain
 */
export const getCurrentChain = () => worldchain

/**
 * Helper: Check if on correct network
 */
export const isCorrectNetwork = (chainId?: number) => {
  return chainId === worldchain.id
}


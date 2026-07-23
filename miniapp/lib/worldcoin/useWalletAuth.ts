/**
 * Purpose: Custom hook for World App wallet authentication
 * Uses MiniKit walletAuth command to get wallet address
 * 
 * For ON-CHAIN verification, we don't need to verify SIWE signature on backend.
 * We just use walletAuth to get the user's wallet address from World App.
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { MiniKit } from '@worldcoin/minikit-js'
import { isInWorldApp } from './initMiniKit'
import { useAuthStore } from '@/state/authStore'

/**
 * Generate a simple nonce for walletAuth
 * We don't need to verify it on backend for on-chain verification
 */
const generateNonce = (): string => {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15)
}

/**
 * Custom hook for wallet authentication
 * 
 * For ON-CHAIN verification, backend SIWE verification is NOT needed.
 * The smart contract verifies the World ID proof directly.
 * 
 * Usage:
 * ```tsx
 * const { address, isConnected, connect, disconnect } = useWalletAuth()
 * ```
 */
export const useWalletAuth = () => {
  // Get wallet address from Zustand store (persisted)
  const { walletAddress, setWalletAddress, clearWallet, manuallyDisconnected } = useAuthStore()
  
  // Local loading/error state
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Check if MiniKit.user has wallet address on mount
   * This can be available if user already authenticated in this session
   * BUT only if user didn't manually disconnect
   */
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Don't auto-reconnect if user manually disconnected
    if (manuallyDisconnected) {
      console.log('🚫 Skipping auto-reconnect: user manually disconnected')
      return
    }

    const timer = setTimeout(() => {
      // Check if wallet is already available from previous session/action
      if (isInWorldApp() && MiniKit.user?.walletAddress && !walletAddress) {
        setWalletAddress(MiniKit.user.walletAddress)
        console.log('✅ Auto-detected wallet from MiniKit.user:', MiniKit.user.walletAddress)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [walletAddress, setWalletAddress, manuallyDisconnected])

  /**
   * Connect wallet using MiniKit walletAuth command
   * No backend SIWE verification needed for on-chain verification
   */
  const connect = useCallback(async () => {
    setIsConnecting(true)
    setError(null)

    try {
      // Check if running in World App
      if (!isInWorldApp()) {
        const errorMsg = 'This app must be opened in World App'
        setIsConnecting(false)
        setError(errorMsg)
        return { success: false, error: errorMsg }
      }

      // Check if already have wallet from MiniKit.user
      if (MiniKit.user?.walletAddress) {
        setWalletAddress(MiniKit.user.walletAddress)
        setIsConnecting(false)
        return { success: true, address: MiniKit.user.walletAddress }
      }

      // Generate a simple nonce (we won't verify it on backend)
      const nonce = generateNonce()

      // Request wallet authentication from MiniKit
      // This prompts the user to approve in World App
      const { finalPayload } = await MiniKit.commandsAsync.walletAuth({
        nonce,
        requestId: '0',
        expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        notBefore: new Date(Date.now() - 60 * 1000), // 1 minute ago
        statement: 'Connect to HumanBond',
      })

      // Check if user cancelled or error occurred
      if (finalPayload.status === 'error') {
        const errorMessage = 'Wallet connection cancelled or failed'
        setIsConnecting(false)
        setError(errorMessage)
        return { success: false, error: errorMessage }
      }

      // Get address from payload
      // Note: For on-chain verification, we trust the address from World App
      // The actual verification happens on-chain with the World ID proof
      const address = finalPayload.address

      if (!address) {
        const errorMessage = 'No wallet address received'
        setIsConnecting(false)
        setError(errorMessage)
        return { success: false, error: errorMessage }
      }

      // Success! Save wallet address to Zustand (persisted)
      setWalletAddress(address)
      setIsConnecting(false)
      setError(null)

      console.log('✅ Wallet connected via walletAuth:', address)
      return { success: true, address }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Wallet connection failed'
      setIsConnecting(false)
      setError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }, [setWalletAddress])

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(() => {
    clearWallet()
    setError(null)
  }, [clearWallet])

  return {
    address: walletAddress,
    isConnected: !!walletAddress,
    isConnecting,
    error,
    connect,
    disconnect,
  }
}

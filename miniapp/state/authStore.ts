/**
 * Purpose: Global state store for user authentication and verification
 * Manages World ID verification status across the application
 * Uses Zustand for simple, efficient state management
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * User verification data
 * Includes all World ID proof data needed for on-chain verification
 */
export type VerificationData = {
  proof: string                    // Zero-knowledge proof for on-chain verification
  merkle_root: string              // Merkle root of the identity tree
  nullifier_hash: string           // Unique identifier for this verification
  verification_level: string       // 'orb' or 'device'
  verified_at: number              // timestamp
}

/**
 * Auth store state
 */
type AuthState = {
  isVerified: boolean
  verificationData: VerificationData | null
  walletAddress: string | null
  manuallyDisconnected: boolean // Flag to prevent auto-reconnect

  // Actions
  setVerified: (data: VerificationData) => void
  setWalletAddress: (address: string) => void
  clearWallet: () => void
  clearVerification: () => void
  checkVerificationExpiry: () => boolean
}

/**
 * Auth Store
 * Persists verification status to localStorage
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isVerified: false,
      verificationData: null,
      walletAddress: null,
      manuallyDisconnected: false,

      /**
       * Set user as verified
       */
      setVerified: (data: VerificationData) => {
        set({
          isVerified: true,
          verificationData: data,
        })
      },

      /**
       * Set wallet address
       */
      setWalletAddress: (address: string) => {
        set({
          walletAddress: address,
          manuallyDisconnected: false, // Reset flag when connecting
        })
      },

      /**
       * Clear wallet connection
       */
      clearWallet: () => {
        set({
          walletAddress: null,
          manuallyDisconnected: true, // Set flag to prevent auto-reconnect
        })
      },

      /**
       * Clear verification (logout)
       */
      clearVerification: () => {
        set({
          isVerified: false,
          verificationData: null,
          walletAddress: null,
          manuallyDisconnected: true, // Set flag to prevent auto-reconnect
        })
      },

      /**
       * Check if verification has expired (24 hours)
       * Returns true if still valid, false if expired
       */
      checkVerificationExpiry: () => {
        const { verificationData } = get()

        if (!verificationData) {
          return false
        }

        const now = Date.now()
        const hoursSinceVerification = (now - verificationData.verified_at) / (1000 * 60 * 60)

        // Expire after 24 hours
        if (hoursSinceVerification > 24
        ) {
          get().clearVerification()
          return false
        }

        return true
      },
    }),
    {
      name: 'humanbond-auth',
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Partial<AuthState>
        if (version === 0) {
          return {
            ...state,
            manuallyDisconnected: state.manuallyDisconnected ?? false,
          } as AuthState
        }
        return state as AuthState
      },
    }
  )
)


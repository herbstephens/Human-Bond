/**
 * Purpose: Initialize and configure MiniKit for World App integration
 * This file provides the configuration and types needed for World ID verification
 * and Mini App functionality within World App
 */

import { MiniKit } from '@worldcoin/minikit-js'

/**
 * MiniKit Configuration
 * APP_ID must match your app ID from the Developer Portal
 * Format: app_staging_xxxxx or app_xxxxx for production
 */
export const MINIKIT_CONFIG = {
  app_id: process.env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}`,
  // Optional: You can add more config here as needed
}

/**
 * Initialize MiniKit
 * This should be called once when the app loads
 * The MiniKitProvider handles this automatically
 */
export const initMiniKit = () => {
  if (typeof window === 'undefined') {
    return // Only initialize on client side
  }

  // MiniKit is automatically initialized by MiniKitProvider
  // This function is here for any additional setup you might need
  console.log('MiniKit initialized:', MiniKit.isInstalled())
}

/**
 * Check if running inside World App
 * Returns true only if app is opened inside World App
 * IMPORTANT: Only call this function after component mount (in useEffect)
 * to avoid SSR/hydration issues
 */
export const isInWorldApp = (): boolean => {
  // Only run on client side
  if (typeof window === 'undefined') {
    return false
  }

  try {
    // Check multiple indicators that we're in World App

    // 1. Check user agent for World App
    const userAgent = navigator.userAgent || ''
    if (userAgent.includes('MiniKit') || userAgent.includes('WorldApp')) {
      return true
    }

    // 2. Check if MiniKit is injected into window
    const windowWithMiniKit = window as unknown as { MiniKit?: unknown }
    if (windowWithMiniKit.MiniKit) {
      return true
    }

    // 3. Check if MiniKit exists and is properly initialized
    if (!MiniKit || typeof MiniKit.isInstalled !== 'function') {
      return false
    }

    return MiniKit.isInstalled()
  } catch (error) {
    // MiniKit throws an error when not running in World App
    // This is expected behavior, not an actual error
    console.log('isInWorldApp check:', error)
    return false
  }
}

/**
 * World ID Verification Levels
 * - Orb: Verified with World ID orb (highest verification)
 * - Device: Verified with device (lower verification, more accessible)
 */
export enum WorldVerificationLevel {
  Orb = 'orb',
  Device = 'device',
}

/**
 * Action IDs for World ID verification
 * These must be created in the Developer Portal as Incognito Actions
 * Format: action-name-in-kebab-case
 * 
 * Actions created:
 * - propose-bond: For creating marriage proposals (on-chain verification)
 * - accept-bond: For accepting marriage proposals (on-chain verification)
 */
export const WORLD_ACTIONS = {
  APP_ACCESS: 'app-access',
  PROPOSE_BOND: 'propose-bond',
  ACCEPT_BOND: 'accept-bond',
} as const

export type WorldAction = typeof WORLD_ACTIONS[keyof typeof WORLD_ACTIONS]


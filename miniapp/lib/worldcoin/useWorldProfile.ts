'use client'

import { useQuery } from '@tanstack/react-query'
import { MiniKit } from '@worldcoin/minikit-js'
import { isInWorldApp } from './initMiniKit'

export type WorldProfile = {
  username: string | null
  profilePictureUrl: string | null
}

/**
 * Open a direct 1:1 World Chat with a specific person.
 * Uses the World profile deep link with action=chat so the user lands
 * directly in the conversation, not the generic chat list.
 *
 * Accepts a World username OR a 0x wallet address.
 */
export function triggerDirectChat(usernameOrAddress: string) {
  if (typeof window === 'undefined') return
  const isAddress = /^0x[a-fA-F0-9]{40}$/i.test(usernameOrAddress)
  const param = isAddress
    ? `address=${usernameOrAddress}`
    : `username=${encodeURIComponent(usernameOrAddress)}`
  window.location.href = `https://world.org/profile?${param}&action=chat`
}

/**
 * Open the native World profile card for a given wallet address.
 * No-ops silently if the API is unavailable (e.g. outside World App).
 */
export function triggerProfileCard(walletAddress: string) {
  const mk = MiniKit as unknown as {
    showProfileCard?: (args: { walletAddress: string }) => void
  }
  if (typeof mk.showProfileCard === 'function') {
    mk.showProfileCard({ walletAddress })
  }
}

/**
 * Resolve a user input (username or 0x address) to a wallet address.
 *
 * Accepts:
 *   - "0x1234…"  — returned as-is after format validation
 *   - "@alice"   — strips the @, resolves via MiniKit SDK or World REST API
 *   - "alice"    — same as @alice
 *
 * Throws with a user-readable message if the username is not found.
 */
export async function resolveToAddress(
  input: string
): Promise<{ address: `0x${string}`; username: string | null }> {
  const trimmed = input.trim()

  // Direct address — validate and return
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return { address: trimmed as `0x${string}`, username: null }
  }

  const username = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
  if (!username) throw new Error('Enter a username or wallet address')

  // 1. Probe MiniKit SDK (available in newer versions)
  const mk = MiniKit as unknown as {
    getUserByUsername?: (username: string) => Promise<{ walletAddress?: string; username?: string } | null>
  }
  if (typeof mk.getUserByUsername === 'function') {
    try {
      const result = await mk.getUserByUsername(username)
      if (result?.walletAddress && /^0x[a-fA-F0-9]{40}$/.test(result.walletAddress)) {
        return { address: result.walletAddress as `0x${string}`, username: result.username ?? username }
      }
    } catch { /* not available — fall through */ }
  }

  // 2. World REST API fallback
  const res = await fetch(`https://usernames.worldcoin.org/api/v1/${encodeURIComponent(username)}`)
  if (!res.ok) throw new Error(`@${username} not found`)
  const data = await res.json()
  const addr: string = data.address ?? data.walletAddress ?? ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) throw new Error(`@${username} not found`)
  return { address: addr as `0x${string}`, username }
}

/**
 * Resolves a 0x wallet address to a World username + profile picture.
 * Returns null values when the address has no World profile.
 * Only queries when inside World App — returns nulls in a regular browser.
 *
 * React Query deduplicates parallel calls for the same address,
 * so multiple components can call this hook without extra requests.
 *
 * Usage:
 *   const { profile, isLoading } = useWorldProfile(proposer)
 *   // profile.username → "alice" | null
 */
export function useWorldProfile(address: string | null | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: ['worldProfile', address?.toLowerCase()],
    queryFn: async (): Promise<WorldProfile> => {
      if (!isInWorldApp()) return { username: null, profilePictureUrl: null }
      try {
        const result = await MiniKit.getUserByAddress(address!)
        return {
          username: result?.username ?? null,
          profilePictureUrl: result?.profilePictureUrl ?? null,
        }
      } catch {
        // getUserByAddress throws for unknown addresses — treat as no profile
        return { username: null, profilePictureUrl: null }
      }
    },
    enabled: !!address,
    staleTime: 5 * 60_000, // 5 min — usernames are stable
    retry: false,          // don't hammer the endpoint for unknown addresses
  })

  return {
    profile: data ?? { username: null, profilePictureUrl: null },
    isLoading: !!address && isLoading,
  }
}

/**
 * Returns "@username" when available, otherwise a truncated address.
 * Pure function — safe to use in render without hooks.
 *
 * Example: displayName("0xabc...123", "alice") → "@alice"
 *          displayName("0xabc...123", null)    → "0xabc...123"
 */
export function displayName(address: string, username: string | null): string {
  if (username) return `@${username}`
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

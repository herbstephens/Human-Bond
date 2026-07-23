/**
 * Purpose: Reusable Header component for HumanBond
 * Displays the logo in the top-left corner
 * Shows wallet connection button and address in the top-right
 *
 * Uses walletAuth from MiniKit - NO backend SIWE verification needed
 */

'use client'

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useWalletAuth } from "@/lib/worldcoin/useWalletAuth";
import { isInWorldApp } from "@/lib/worldcoin/initMiniKit";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { useWorldProfile, displayName } from "@/lib/worldcoin/useWorldProfile";
import { Info, X } from "lucide-react";

export function Header() {
  const { address, isConnected, isConnecting, connect, disconnect, error } = useWalletAuth();
  const { profile } = useWorldProfile(isConnected ? address : null);
  const [isWorldApp, setIsWorldApp] = useState(false);
  const [showWalletInfo, setShowWalletInfo] = useState(false);
  const mounted = useHydrated();

  useEffect(() => {
    if (!mounted) return;
    const timer = setTimeout(() => {
      setIsWorldApp(isInWorldApp());
    }, 300);
    return () => clearTimeout(timer);
  }, [mounted]);

  /**
   * Handle connect button click
   */
  const handleConnect = async () => {
    const result = await connect();
    if (result.success) {
      console.log('✅ Wallet connected:', result.address);
    } else {
      console.error('❌ Connection failed:', result.error);
    }
  };

  // Don't render wallet section until mounted (prevents hydration mismatch)
  if (!mounted) {
    return (
      <header className="fixed top-0 left-0 right-0 w-full z-50 bg-[#E8E8E8]/90 backdrop-blur-md border-b border-black/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="inline-block">
            <Image
              src="/Isotype.png"
              alt="HumanBond Logo"
              width={60}
              height={60}
              priority
              className="hover:opacity-80 transition-opacity"
              style={{ width: "auto", height: "auto" }}
            />
          </Link>
          <div className="px-4 py-2 bg-black/5 rounded-full">
            <p className="text-sm text-black/40">...</p>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 bg-[#E8E8E8]/90 backdrop-blur-md border-b border-black/10">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo - Left */}
        <Link href="/" className="inline-block">
          <Image
            src="/Isotype.png"
            alt="HumanBond Logo"
            width={60}
            height={60}
            priority
            className="hover:opacity-80 transition-opacity"
            style={{ width: "auto", height: "auto" }}
          />
        </Link>

        {/* Wallet Connection - Right */}
        <div className="flex items-center gap-3">
          {isConnected && address ? (
            // Connected state
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-black/5 rounded-full" title={address}>
                <p className="text-sm font-mono text-black">
                  {displayName(address, profile.username)}
                </p>
              </div>
              <button
                onClick={disconnect}
                className="text-sm text-black/60 hover:text-black transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : isWorldApp ? (
            // In World App - show connect button + info
            <div className="flex items-center gap-2">
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="px-6 py-2 bg-black text-white rounded-full text-sm hover:bg-black/90 transition-colors disabled:opacity-50"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
              <button
                onClick={() => setShowWalletInfo(true)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors"
                aria-label="What is Connect Wallet?"
              >
                <Info size={14} className="text-black/60" />
              </button>
            </div>
          ) : (
            // Not in World App
            <div className="px-4 py-2 bg-amber-100 rounded-full">
              <p className="text-sm text-amber-700">Open in World App</p>
            </div>
          )}
        </div>

        {/* Error toast */}
        {error && (
          <div className="absolute top-full mt-2 right-6 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm shadow-lg">
            {error}
          </div>
        )}
      </div>

      {/* Connect Wallet info modal — portal escapes backdrop-blur stacking context */}
      {showWalletInfo && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowWalletInfo(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-black">Connect Wallet</h2>
              <button
                onClick={() => setShowWalletInfo(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Tapping <strong>Connect Wallet</strong> links your <strong>World App wallet</strong> to HumanBond so the app knows which address to use for on-chain actions like creating proposals and minting NFTs.
            </p>
            <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-black uppercase tracking-wider">Why it&apos;s safe</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Your private key never leaves World App</li>
                <li>• The app only receives your public wallet address</li>
                <li>• No funds are moved without your explicit approval</li>
                <li>• You can disconnect at any time</li>
              </ul>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}

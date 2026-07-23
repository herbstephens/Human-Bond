/**
 * Purpose: Create Marriage Proposal Form
 * Integrates World ID verification + MiniKit sendTransaction
 * Calls HumanBond.propose() on Worldchain
 * 
 * ON-CHAIN VERIFICATION:
 * - NO SIWE or backend API needed
 * - World ID proof is verified directly on the smart contract
 * - MiniKit provides wallet address automatically via MiniKit.user
 */

"use client";

import { useState, useEffect } from "react";
import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";
import { CONTRACT_ADDRESSES, HUMAN_BOND_ABI, WORLD_APP_CONFIG } from "@/lib/contracts";
import { useAuthStore } from "@/state/authStore";
import { isInWorldApp } from "@/lib/worldcoin/initMiniKit";
import { Sparkles, ScanFace, MessageCircle } from "lucide-react";
import { decodeProof } from "@/lib/utils/decodeProof";
import { useWorldProfile, resolveToAddress, triggerDirectChat } from "@/lib/worldcoin/useWorldProfile";
import { sendNotification } from "@/lib/hooks/useNotify";
import { USE_MOCKS } from "@/lib/config";
import { simulateTx } from "@/lib/mocks/mockTx";
import dynamic from "next/dynamic";

const PrenupModal = dynamic(() => import("./PrenupModal").then(m => m.PrenupModal), { ssr: false });

type ProposalState = "idle" | "verifying" | "sending" | "success" | "error";

export function CreateProposalForm() {
  // Raw value the user types — can be "@alice", "alice", or "0x..."
  const [rawInput, setRawInput] = useState("");
  // Resolved 0x address ready for the on-chain tx
  const [resolvedAddress, setResolvedAddress] = useState("");
  // Username from resolution (used in the chat remind message)
  const [resolvedUsername, setResolvedUsername] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [state, setState] = useState<ProposalState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isWorldApp, setIsWorldApp] = useState(false);
  const [showPrenup, setShowPrenup] = useState(false);

  const { walletAddress, setWalletAddress } = useAuthStore();

  // Warm the partner's World profile cache once the proposal succeeds
  useWorldProfile(state === 'success' ? resolvedAddress : null);

  // Live username/address resolution — debounced 600ms after user stops typing
  useEffect(() => {
    const trimmed = rawInput.trim();

    if (!trimmed) {
      setResolvedAddress("");
      setResolvedUsername(null);
      setResolveError(null);
      return;
    }

    // Direct 0x address — instant, no API call needed
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setResolvedAddress(trimmed);
      setResolvedUsername(null);
      setResolveError(null);
      return;
    }

    // Username — debounce then hit the API
    setResolvedAddress("");
    setResolveError(null);
    setIsResolving(true);

    const timer = setTimeout(async () => {
      try {
        const { address, username } = await resolveToAddress(trimmed);
        setResolvedAddress(address);
        setResolvedUsername(username);
        setResolveError(null);
      } catch (err) {
        setResolvedAddress("");
        setResolvedUsername(null);
        setResolveError(err instanceof Error ? err.message : "Username not found");
      } finally {
        setIsResolving(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [rawInput]);

  // Check if running in World App on mount
  useEffect(() => {
    const checkWorldApp = () => {
      const inWorld = isInWorldApp();
      setIsWorldApp(USE_MOCKS || inWorld);

      // Auto-update wallet address from MiniKit if available
      if (inWorld && MiniKit.user?.walletAddress && !walletAddress) {
        setWalletAddress(MiniKit.user.walletAddress);
      }
    };

    // Give MiniKit time to initialize
    const timer = setTimeout(checkWorldApp, 300);
    return () => clearTimeout(timer);
  }, [walletAddress, setWalletAddress]);

  /**
   * Step 1: Handle initial form submission
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTxHash(null);

    if (!resolvedAddress) {
      setError(isResolving ? "Still resolving, please wait" : "Enter a valid address or @username");
      return;
    }

    if (!isWorldApp) {
      setError("This app must be opened in World App");
      return;
    }

    // Show prenup modal before proceeding
    setShowPrenup(true);
  };

  /**
   * Step 2: Main flow after prenup confirmation: Verify with World ID → Send Transaction
   */
  const handlePrenupConfirm = async () => {
    setShowPrenup(false);

    try {
      setState("verifying");

      if (USE_MOCKS) {
        await simulateTx();
        setState("sending");
        await simulateTx("proposalSent");
        setState("success");
        setTxHash("0xmocktransactionhash");
        return;
      }

      const userWallet = MiniKit.user?.walletAddress || walletAddress;

      if (!userWallet) {
        throw new Error("Wallet address not available. Please try again.");
      }

      const { finalPayload: verifyPayload } = await MiniKit.commandsAsync.verify({
        action: WORLD_APP_CONFIG.ACTIONS.PROPOSE_BOND,
        signal: userWallet,
        verification_level: VerificationLevel.Orb,
      });

      if (verifyPayload.status === "error") {
        const errPayload = verifyPayload as { error_code?: string };
        throw new Error(`Verification error: ${errPayload.error_code || "cancelled"}`);
      }

      const merkleRoot = verifyPayload.merkle_root;
      const nullifierHash = verifyPayload.nullifier_hash;
      const proofArray = decodeProof(verifyPayload.proof);

      setState("sending");
      const { finalPayload: txPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: CONTRACT_ADDRESSES.HUMAN_BOND,
            abi: HUMAN_BOND_ABI,
            functionName: "propose",
            args: [
              resolvedAddress,
              merkleRoot,
              nullifierHash,
              proofArray,
            ],
          },
        ],
      });

      if (txPayload.status === "error") {
        const errPayload = txPayload as { error_code?: string; message?: string };
        const errorMsg = errPayload.error_code || errPayload.message || "Unknown error";
        throw new Error(`Transaction failed: ${errorMsg}`);
      }

      setState("success");
      setTxHash(txPayload.transaction_id || null);
      sendNotification(resolvedAddress, 'proposal_received');

    } catch (err: unknown) {
      console.error("Proposal error:", err);
      setState("error");
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      setError(errorMsg);
    }
  };

  const handleRemindInChat = () => {
    if (!isWorldApp) return
    // Prefer the username from input resolution; fall back to resolved address
    triggerDirectChat(resolvedUsername ?? resolvedAddress)
  }

  const isLoading = state === "verifying" || state === "sending";

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-[2.5rem] p-10 shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-black/[0.03] space-y-8 animate-in fade-in zoom-in duration-500">

        {/* Header Section */}
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 bg-black rounded-3xl flex items-center justify-center shadow-lg transform -rotate-3">
            <Sparkles size={32} className="text-white" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-black text-black tracking-tighter">
              Create Bond
            </h1>
            <p className="text-sm font-medium text-gray-400">
              Propose a digital union on Worldchain
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-4">
                Partner
              </label>
              <input
                type="text"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="@username or 0x..."
                className="w-full px-6 py-5 rounded-3xl bg-gray-50 text-black text-base font-medium placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black/5 border border-transparent focus:border-black/5 transition-all"
                disabled={isLoading}
              />
              {/* Resolution feedback */}
              {isResolving && (
                <div className="flex items-center gap-2 px-4">
                  <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Resolving…</span>
                </div>
              )}
              {resolvedUsername && resolvedAddress && !isResolving && (
                <div className="flex items-center justify-between px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                      @{resolvedUsername} → {resolvedAddress.slice(0, 6)}…{resolvedAddress.slice(-4)}
                    </span>
                  </div>
                  {isWorldApp && (
                    <button
                      type="button"
                      onClick={handleRemindInChat}
                      className="flex items-center gap-1 text-[10px] font-black text-gray-400 hover:text-gray-700 uppercase tracking-widest transition-colors"
                    >
                      <MessageCircle size={12} />
                      <span>Chat</span>
                    </button>
                  )}
                </div>
              )}
              {resolveError && (
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest px-4">
                  {resolveError}
                </p>
              )}
            </div>

            {/* Connected Info */}
            {walletAddress && (
              <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                  Signer: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="group w-full bg-black text-white px-8 py-5 rounded-3xl text-sm font-black uppercase tracking-widest hover:bg-gray-900 transition-all duration-300 shadow-xl shadow-gray-100 flex items-center justify-center gap-3 hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!resolvedAddress || isResolving || isLoading || !isWorldApp}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <ScanFace size={20} className="group-hover:text-emerald-400 transition-colors" />
                <span>Send Proposal</span>
              </>
            )}
          </button>
        </form>

        {/* Status Messages */}
        <div className="space-y-4">
          {state === "success" && (
            <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2rem] text-center space-y-3 animate-in fade-in slide-in-from-bottom-4">
              <div className="w-10 h-10 bg-emerald-500 rounded-full mx-auto flex items-center justify-center shadow-lg shadow-emerald-200">
                <Sparkles size={20} className="text-white" />
              </div>
              <p className="text-sm font-black text-emerald-900 tracking-tight">Bond Proposed Successfully!</p>
              {txHash && (
                <a
                  href={`https://worldscan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  View on WorldScan →
                </a>
              )}
              {isWorldApp && (
                <button
                  onClick={handleRemindInChat}
                  className="mt-3 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                  <MessageCircle size={14} />
                  Remind them in World Chat
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl animate-in fade-in slide-in-from-bottom-2">
              <p className="text-[10px] font-bold text-red-500 text-center uppercase tracking-widest leading-relaxed">
                {error}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Prenup Agreement Modal */}
      <PrenupModal
        isOpen={showPrenup}
        onClose={() => setShowPrenup(false)}
        onConfirm={handlePrenupConfirm}
        title="Binding Prenuptial Agreement"
      />
    </div>
  );
}


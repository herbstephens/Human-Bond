"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";
import { CONTRACT_ADDRESSES, HUMAN_BOND_ABI, WORLD_APP_CONFIG } from "@/lib/contracts";
import { useMarriage } from "@/lib/marriage/context";
import { USE_MOCKS } from "@/lib/config";
import { simulateTx } from "@/lib/mocks/mockTx";
import { useWorldProfile, displayName, triggerDirectChat, triggerProfileCard } from "@/lib/worldcoin/useWorldProfile";
import { isInWorldApp } from "@/lib/worldcoin/initMiniKit";
import { decodeProof } from "@/lib/utils/decodeProof";
import dynamic from "next/dynamic";
import {
    ChevronLeft,
    UserPlus,
    Clock,
    Copy,
    Check,
    MessageCircle,
    Users,
    XCircle,
} from "lucide-react";
import type { ProposalInfo } from "@/lib/hooks/useProposals";
import { sendNotification } from "@/lib/hooks/useNotify";
import { setBondCelebrationFlag } from "@/lib/bondCelebration";
import { BondCelebrationOverlay } from "@/app/components/marriage/BondCelebrationOverlay";

const PrenupModal = dynamic(() => import("@/app/components/marriage/PrenupModal").then(m => m.PrenupModal), { ssr: false });

type CardState = "idle" | "verifying" | "sending_accept" | "sending_reject" | "confirm_reject" | "success_reject" | "error";
type HandleResult = "accept" | "reject";

function ProposalDetailCard({
    proposal,
    onHandled,
}: {
    proposal: ProposalInfo;
    onHandled: (action: HandleResult) => void;
}) {
    const { address: walletAddress } = useMarriage();
    const { profile, isLoading: isProfileLoading } = useWorldProfile(proposal.proposer);
    const name = displayName(proposal.proposer, profile.username);

    const [cardState, setCardState] = useState<CardState>("idle");
    const [showPrenup, setShowPrenup] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isWorldApp, setIsWorldApp] = useState(false);
    // Celebration overlay — appears immediately on prenup confirm
    const [celebratingName, setCelebratingName] = useState<string | null>(null);

    useEffect(() => { setIsWorldApp(isInWorldApp()); }, []);

    const isLoading = cardState === "verifying" || cardState === "sending_accept" || cardState === "sending_reject";

    const handleCopyAddress = async () => {
        try {
            await navigator.clipboard.writeText(proposal.proposer);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {}
    };

    const handleAcceptClick = () => {
        setError(null);
        setShowPrenup(true);
    };

    const handlePrenupConfirm = async () => {
        setShowPrenup(false);
        // Show overlay immediately (waiting phase) — tx runs behind it
        setCelebratingName(name);
        try {
            setCardState("verifying");
            setError(null);

            if (USE_MOCKS) {
                await simulateTx();
                setCardState("sending_accept");
                await simulateTx("married");
                onHandled("accept");
                return;
            }

            const userWallet = MiniKit.user?.walletAddress || walletAddress;
            if (!userWallet) throw new Error("Wallet not available");

            const { finalPayload: verifyPayload } = await MiniKit.commandsAsync.verify({
                action: WORLD_APP_CONFIG.ACTIONS.ACCEPT_BOND,
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

            setCardState("sending_accept");
            const { finalPayload: txPayload } = await MiniKit.commandsAsync.sendTransaction({
                transaction: [{
                    address: CONTRACT_ADDRESSES.HUMAN_BOND,
                    abi: HUMAN_BOND_ABI,
                    functionName: "accept",
                    args: [proposal.proposer, merkleRoot, nullifierHash, proofArray],
                }],
            });

            if (txPayload.status === "error") {
                const errPayload = txPayload as { error_code?: string; message?: string };
                throw new Error(errPayload.error_code || errPayload.message || "Transaction failed");
            }

            onHandled("accept");
            sendNotification(proposal.proposer, 'proposal_accepted');
        } catch (err) {
            // Hide overlay and surface error in the card
            setCelebratingName(null);
            setCardState("error");
            setError(err instanceof Error ? err.message : "Something went wrong");
        }
    };

    const handleRejectConfirm = async () => {
        try {
            setCardState("sending_reject");
            setError(null);

            if (USE_MOCKS) {
                await simulateTx("single");
                setCardState("success_reject");
                onHandled("reject");
                return;
            }

            const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
                transaction: [{
                    address: CONTRACT_ADDRESSES.HUMAN_BOND,
                    abi: HUMAN_BOND_ABI,
                    functionName: "rejectProposal",
                    args: [proposal.proposer],
                }],
            });

            if (finalPayload.status === "error") throw new Error("Transaction failed");

            setCardState("success_reject");
            onHandled("reject");
            sendNotification(proposal.proposer, 'proposal_rejected');
        } catch (err) {
            setCardState("error");
            setError(err instanceof Error ? err.message : "Failed to reject proposal");
        }
    };

    if (cardState === "success_reject") {
        return (
            <div className="bg-gray-100 border border-gray-200 rounded-[2rem] p-6 text-center space-y-2 animate-in fade-in duration-500">
                <XCircle size={28} className="text-gray-400 mx-auto" />
                <p className="text-sm font-black text-gray-600">Proposal Rejected</p>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 space-y-5 animate-in fade-in duration-300">
                {/* Proposer info */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => triggerProfileCard(proposal.proposer)}
                        className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center shrink-0 hover:bg-gray-200 transition-colors"
                    >
                        <UserPlus size={22} className="text-gray-500" />
                    </button>

                    <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">From</p>
                        {isProfileLoading ? (
                            <span className="block h-3.5 w-32 bg-gray-100 rounded animate-pulse" />
                        ) : (
                            <p className="text-sm font-mono font-bold text-gray-900 truncate" title={proposal.proposer}>
                                {name}
                            </p>
                        )}
                        <div className="flex items-center gap-1 mt-0.5 text-[9px] font-medium text-gray-400">
                            <Clock size={9} />
                            {new Date(Number(proposal.timestamp) * 1000).toLocaleDateString("en-US", {
                                month: "short", day: "numeric", year: "numeric"
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleCopyAddress}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all active:scale-90"
                        >
                            {copied ? <Check size={15} /> : <Copy size={15} />}
                        </button>
                        {isWorldApp && (
                            <button
                                onClick={() => triggerDirectChat(profile.username ?? proposal.proposer)}
                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all active:scale-90"
                            >
                                <MessageCircle size={15} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">{error}</p>
                    </div>
                )}

                {/* Actions */}
                {cardState === "confirm_reject" ? (
                    <div className="space-y-2 animate-in fade-in duration-200">
                        <p className="text-xs text-gray-500 font-medium text-center">Reject this proposal? This cannot be undone.</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCardState("idle")}
                                className="flex-1 py-3 rounded-2xl text-xs font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRejectConfirm}
                                disabled={isLoading}
                                className="flex-1 py-3 rounded-2xl text-xs font-black text-white bg-red-500 hover:bg-red-600 transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {isLoading ? "Processing..." : "Confirm Reject"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-3">
                        <button
                            onClick={() => setCardState("confirm_reject")}
                            disabled={isLoading}
                            className="flex-1 py-3.5 rounded-2xl text-xs font-black text-red-400 border border-red-100 hover:bg-red-50 hover:text-red-500 transition-all active:scale-[0.98] disabled:opacity-40"
                        >
                            Reject
                        </button>
                        <button
                            onClick={handleAcceptClick}
                            disabled={isLoading}
                            className="flex-[2] py-3.5 rounded-2xl text-xs font-black text-white bg-gray-900 hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
                        >
                            {cardState === "verifying" ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Verifying...</span>
                                </>
                            ) : cardState === "sending_accept" ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Signing...</span>
                                </>
                            ) : (
                                <>
                                    <Users size={14} />
                                    <span>Accept</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            <PrenupModal
                isOpen={showPrenup}
                onClose={() => { setShowPrenup(false); setCardState("idle"); }}
                onConfirm={handlePrenupConfirm}
                title="Binding Agreement"
            />

            {/* Celebration overlay — appears immediately, tx runs behind it */}
            {celebratingName !== null && (
                <BondCelebrationOverlay
                    isReady={false}
                    partnerName={celebratingName}
                    onComplete={() => {}}
                />
            )}
        </>
    );
}

export default function ProposalsPage() {
    const router = useRouter();
    const {
        incomingProposals,
        isProposalsLoading: isLoading,
        refetchProposals: refetch,
        refetchDashboard,
    } = useMarriage();
    const [handledProposers, setHandledProposers] = useState<Set<string>>(new Set());

    const visibleProposals = incomingProposals.filter(
        p => !handledProposers.has(p.proposer.toLowerCase())
    );

    // Clean up handled set once on-chain data confirms the proposals are gone.
    // Functional setState keyed off incomingProposals is intentional here; the
    // update is a no-op when nothing changed, so it can't loop.
    useEffect(() => {
        if (handledProposers.size === 0) return;
        const currentProposers = new Set(incomingProposals.map(p => p.proposer.toLowerCase()));
        setHandledProposers(prev => {
            const stillNeeded = new Set([...prev].filter(p => currentProposers.has(p)));
            return stillNeeded.size < prev.size ? stillNeeded : prev;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [incomingProposals]);

    const handleProposalHandled = (proposer: string, action: HandleResult) => {
        setHandledProposers(prev => new Set([...prev, proposer.toLowerCase()]));

        if (action === "accept") {
            setBondCelebrationFlag();
            void refetchDashboard();
            void refetch();
            router.replace("/home");
            return;
        }

        setTimeout(() => refetch(), 2000);
    };

    return (
        <main className="min-h-screen bg-[#E8E8E8] pb-24">
            {/* Slim back row */}
            <div className="px-5 pt-3 pb-1 flex items-center gap-3">
                <button
                    onClick={() => router.push("/home")}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-gray-600 hover:text-black active:scale-95 transition-all"
                >
                    <ChevronLeft size={18} />
                </button>
                <span className="font-black text-base text-gray-900 tracking-tight">Proposals</span>
                {incomingProposals.length > 0 && (
                    <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                        · {incomingProposals.length} pending
                    </span>
                )}
            </div>

            <div className="max-w-2xl mx-auto px-6 pt-3 pb-5 space-y-4">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-black" />
                        <p className="text-sm text-gray-500 font-medium">Loading proposals...</p>
                    </div>
                ) : visibleProposals.length === 0 ? (
                    <div className="p-12 bg-white rounded-[2rem] border border-gray-100 shadow-sm text-center space-y-4 animate-in fade-in duration-500">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                            <Users size={32} className="text-gray-200" />
                        </div>
                        <div className="space-y-1">
                            <p className="font-black text-gray-900">No Pending Proposals</p>
                            <p className="text-xs text-gray-400 font-medium">
                                When someone sends you a bond proposal, it will appear here.
                            </p>
                        </div>
                    </div>
                ) : (
                    visibleProposals.map((proposal, index) => (
                        <ProposalDetailCard
                            key={`${proposal.proposer}-${index}`}
                            proposal={proposal}
                            onHandled={(action) => handleProposalHandled(proposal.proposer, action)}
                        />
                    ))
                )}
            </div>
        </main>
    );
}

"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { MiniKit } from "@worldcoin/minikit-js";
import { CONTRACT_ADDRESSES, HUMAN_BOND_ABI } from "@/lib/contracts";
import { useMarriage } from "@/lib/marriage/context";
import { USE_MOCKS } from "@/lib/config";
import { simulateTx } from "@/lib/mocks/mockTx";
import { sendNotification } from "@/lib/hooks/useNotify";
import { UserDashboard } from "@/lib/worldcoin/useUserDashboard";
import { useMarriageDetails, BondView, DissolutionRequest } from "@/lib/hooks/useMarriageDetails";
import {
    Coins,
    TrendingUp,
    Handshake,
    Calendar,
    Image as ImageIcon,
    Clock,
    ChevronRight,
    Sparkles,
    MessageCircle,
    AlertTriangle,
    Timer,
} from "lucide-react";
import { useWorldProfile, displayName, triggerDirectChat, triggerProfileCard } from "@/lib/worldcoin/useWorldProfile";
import { isInWorldApp } from "@/lib/worldcoin/initMiniKit";

type ClaimState = "idle" | "sending" | "success" | "error";
type DissolutionTxState = "idle" | "sending" | "success" | "error";

interface MarriageDashboardProps {
    dashboard: UserDashboard;
    onRefresh?: () => void;
    onDissolved?: (partnerName?: string) => void;
    onDissolutionFailed?: () => void;
    marriageView?: BondView | null;
    dissolutionRequest?: DissolutionRequest | null;
    isMarriageLoading?: boolean;
}

export function MarriageDashboard({
    dashboard,
    onRefresh,
    onDissolved,
    onDissolutionFailed,
    marriageView: propsMarriageView,
    dissolutionRequest: propsDissolutionRequest,
    isMarriageLoading: propsIsMarriageLoading
}: MarriageDashboardProps) {
    const router = useRouter();
    // Self address — same value as the persisted wallet in real mode, and the
    // mock self-address in mock mode (so isRequester works in the playground).
    const { address: walletAddress } = useMarriage();

    const { profile: partnerProfile, isLoading: isPartnerLoading } = useWorldProfile(dashboard.partner)
    const partnerDisplayName = displayName(dashboard.partner, partnerProfile.username)

    const [isWorldApp, setIsWorldApp] = useState(false)
    useEffect(() => { setIsWorldApp(isInWorldApp()) }, [])

    const [dissolutionTxState, setDissolutionTxState] = useState<DissolutionTxState>("idle");
    const [lastDissolutionAction, setLastDissolutionAction] = useState<'request' | 'cancel' | 'execute' | null>(null);
    const [localDissolutionRequested, setLocalDissolutionRequested] = useState(false);
    const [localDissolutionCancelled, setLocalDissolutionCancelled] = useState(false);
    const [claimState, setClaimState] = useState<ClaimState>("idle");
    const [error, setError] = useState<string | null>(null);
    const [claimError, setClaimError] = useState<string | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);

    const { marriageView: internalMarriageView, dissolutionRequest: internalDissolutionRequest, isLoading: internalIsMarriageLoading } = useMarriageDetails(
        !propsMarriageView ? (dashboard.partner as `0x${string}` | null) : null
    );

    const marriageView = propsMarriageView || internalMarriageView;
    const dissolutionRequest = propsDissolutionRequest ?? internalDissolutionRequest;
    const isMarriageLoading = propsIsMarriageLoading ?? internalIsMarriageLoading;

    // Once on-chain data catches up, clear local optimistic flags
    useEffect(() => {
        if (dissolutionRequest?.active && localDissolutionRequested) {
            setLocalDissolutionRequested(false);
        }
    }, [dissolutionRequest?.active, localDissolutionRequested]);

    useEffect(() => {
        if (!dissolutionRequest?.active && localDissolutionCancelled) {
            setLocalDissolutionCancelled(false);
        }
    }, [dissolutionRequest?.active, localDissolutionCancelled]);

    const [interpolatedYield, setInterpolatedYield] = useState<number>(0);

    const marriageStats = useMemo(() => {
        if (!marriageView) return null;

        const bondStartDate = new Date(Number(marriageView.bondStart) * 1000);
        const now = new Date();
        const msInDay = 1000 * 60 * 60 * 24;
        const msInYear = msInDay * 365.25;

        const daysTogether = Math.floor((now.getTime() - bondStartDate.getTime()) / msInDay);
        const yearsTogether = Math.floor((now.getTime() - bondStartDate.getTime()) / msInYear);

        const lastMilestone = Number(marriageView.lastMilestoneYear);
        const nextMilestone = lastMilestone + 1;

        const nextAnniversary = new Date(bondStartDate);
        nextAnniversary.setFullYear(bondStartDate.getFullYear() + nextMilestone);
        const daysToAnniversary = Math.ceil((nextAnniversary.getTime() - now.getTime()) / msInDay);

        return {
            bondStartDate,
            daysTogether,
            yearsTogether,
            lastMilestone,
            nextMilestone,
            daysToAnniversary,
            bondId: marriageView.bondId,
        };
    }, [marriageView]);

    useEffect(() => {
        if (!marriageView) return;

        const interval = setInterval(() => {
            const now = Date.now() / 1000;
            const lastClaim = Number(marriageView.lastClaim);
            const secondsSinceClaim = now - lastClaim;
            const currentYield = Math.max(0, secondsSinceClaim * (1 / 86400));
            setInterpolatedYield(currentYield);
        }, 100);

        return () => clearInterval(interval);
    }, [marriageView]);

    // Dissolution helpers — 3 days on-chain, 10s in mock so the full flow is testable
    const dissolutionDelaySeconds = USE_MOCKS ? 10 : 3 * 24 * 60 * 60;
    const isDissolutionPending = !localDissolutionCancelled &&
        ((dissolutionRequest?.active ?? false) || localDissolutionRequested);
    const isRequester = isDissolutionPending && (
        localDissolutionRequested ||
        dissolutionRequest?.requester?.toLowerCase() === walletAddress?.toLowerCase()
    );
    const requestedAt = isDissolutionPending
        ? (dissolutionRequest?.requestedAt ? Number(dissolutionRequest.requestedAt) : Math.floor(Date.now() / 1000))
        : 0;
    const executeAvailableAt = requestedAt + dissolutionDelaySeconds;
    const canExecute = isDissolutionPending && Date.now() / 1000 >= executeAvailableAt;

    const [nowTs, setNowTs] = useState(Date.now() / 1000);
    useEffect(() => {
        if (!isDissolutionPending) return;
        const id = setInterval(() => setNowTs(Date.now() / 1000), 1000);
        return () => clearInterval(id);
    }, [isDissolutionPending]);

    const secondsRemaining = Math.max(0, executeAvailableAt - nowTs);
    const daysRemaining = Math.floor(secondsRemaining / 86400);
    const hoursRemaining = Math.floor((secondsRemaining % 86400) / 3600);
    const minutesRemaining = Math.floor((secondsRemaining % 3600) / 60);
    const secsRemaining = Math.floor(secondsRemaining % 60);

    const handleClaim = async () => {
        if (!dashboard.partner || !walletAddress) {
            setClaimError("Missing partner or wallet information");
            return;
        }

        if (Number(dashboard.pendingYield) === 0) {
            setClaimError("No pending tokens to claim");
            return;
        }

        try {
            setClaimState("sending");
            setClaimError(null);

            if (USE_MOCKS) {
                await simulateTx();
                setClaimState("success");
                setTimeout(() => onRefresh?.(), 2000);
                return;
            }

            const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
                transaction: [{
                    address: CONTRACT_ADDRESSES.HUMAN_BOND,
                    abi: HUMAN_BOND_ABI,
                    functionName: "claimYield",
                    args: [dashboard.partner],
                }],
            });

            if (finalPayload.status === "error") throw new Error("Claim transaction failed");

            setClaimState("success");
            setTimeout(() => onRefresh?.(), 2000);
        } catch (err) {
            setClaimState("error");
            setClaimError(err instanceof Error ? err.message : "Failed to claim tokens");
        }
    };

    const handleRequestDissolution = async () => {
        if (!dashboard.partner || !walletAddress) {
            setError("Missing partner or wallet information");
            return;
        }
        try {
            setDissolutionTxState("sending");
            setError(null);

            if (USE_MOCKS) {
                await simulateTx("dissolutionPending");
                setDissolutionTxState("success");
                setLastDissolutionAction('request');
                setLocalDissolutionRequested(true);
                return;
            }

            const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
                transaction: [{
                    address: CONTRACT_ADDRESSES.HUMAN_BOND,
                    abi: HUMAN_BOND_ABI,
                    functionName: "requestDissolution",
                    args: [dashboard.partner],
                }],
            });

            if (finalPayload.status === "error") throw new Error("Transaction failed");

            setDissolutionTxState("success");
            setLastDissolutionAction('request');
            setLocalDissolutionRequested(true);
            setTimeout(() => onRefresh?.(), 2000);
            sendNotification(dashboard.partner, 'dissolution_requested');
        } catch (err) {
            setDissolutionTxState("error");
            setError(err instanceof Error ? err.message : "Failed to request dissolution");
        }
    };

    const handleCancelDissolution = async () => {
        if (!dashboard.partner || !walletAddress) return;
        try {
            setDissolutionTxState("sending");
            setError(null);

            if (USE_MOCKS) {
                await simulateTx("married");
                setDissolutionTxState("idle");
                setLastDissolutionAction('cancel');
                setLocalDissolutionRequested(false);
                setLocalDissolutionCancelled(true);
                setShowConfirm(false);
                return;
            }

            const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
                transaction: [{
                    address: CONTRACT_ADDRESSES.HUMAN_BOND,
                    abi: HUMAN_BOND_ABI,
                    functionName: "cancelDissolutionRequest",
                    args: [dashboard.partner],
                }],
            });

            if (finalPayload.status === "error") throw new Error("Transaction failed");

            setDissolutionTxState("idle");
            setLastDissolutionAction('cancel');
            setLocalDissolutionRequested(false);
            setLocalDissolutionCancelled(true);
            setShowConfirm(false);
            setTimeout(() => onRefresh?.(), 2000);
            sendNotification(dashboard.partner, 'dissolution_cancelled');
        } catch (err) {
            setDissolutionTxState("error");
            setError(err instanceof Error ? err.message : "Failed to cancel dissolution");
        }
    };

    const handleExecuteDissolution = async () => {
        if (!dashboard.partner || !walletAddress) return;
        // Show overlay immediately (waiting phase) — tx runs behind it
        setShowConfirm(false);
        onDissolved?.(partnerDisplayName);
        try {
            setDissolutionTxState("sending");
            setError(null);

            if (USE_MOCKS) {
                await simulateTx("single");
                sendNotification(dashboard.partner, "dissolution_executed");
                return;
            }

            const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
                transaction: [{
                    address: CONTRACT_ADDRESSES.HUMAN_BOND,
                    abi: HUMAN_BOND_ABI,
                    functionName: "executeDissolution",
                    args: [dashboard.partner],
                }],
            });

            if (finalPayload.status === "error") throw new Error("Transaction failed");

            sendNotification(dashboard.partner, "dissolution_executed");
        } catch (err) {
            // Hide overlay and surface error back in modal
            onDissolutionFailed?.();
            setShowConfirm(true);
            setDissolutionTxState("error");
            setError(err instanceof Error ? err.message : "Failed to execute dissolution");
        }
    };

    const handleOpenPartnerProfile = () => {
        if (!isWorldApp) return;
        triggerProfileCard(dashboard.partner);
    };

    const handleChatWithPartner = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isWorldApp) return;
        triggerDirectChat(partnerProfile.username ?? dashboard.partner);
    };

    const timeBalance = Number(dashboard.timeBalance) / 1e18;
    const pendingYield = Number(dashboard.pendingYield) / 1e18;

    if (isMarriageLoading && !propsMarriageView) {
        return (
            <div className="w-full max-w-2xl flex items-center justify-center py-12">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
                    <p className="text-black/70">Loading bond details...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl space-y-6">
            {/* Dissolution Pending Banner */}
            {isDissolutionPending && (
                <div className={`rounded-2xl p-4 border flex items-start gap-3 ${
                    isRequester
                        ? canExecute
                            ? "bg-red-50 border-red-200"
                            : "bg-amber-50 border-amber-200"
                        : "bg-orange-50 border-orange-200"
                }`}>
                    <AlertTriangle size={18} className={canExecute ? "text-red-500 mt-0.5" : "text-amber-500 mt-0.5"} />
                    <div className="flex-1 min-w-0">
                        {isRequester ? (
                            canExecute ? (
                                <>
                                    <p className="text-xs font-bold text-red-700">Your dissolution is ready to finalize.</p>
                                    <p className="text-[10px] text-red-600/80 mt-0.5 leading-relaxed">
                                        The 3-day wait is over. Tap Execute to end the bond, or Cancel to keep it.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-xs font-bold text-amber-800">You started a dissolution.</p>
                                    <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                                        You&apos;re still bonded during the 3-day wait. You can cancel anytime before finalizing.
                                    </p>
                                    <p className="text-[10px] font-bold text-amber-800 mt-1 flex items-center gap-1">
                                        <Timer size={10} />
                                        {daysRemaining}d {hoursRemaining}h {minutesRemaining}m {secsRemaining}s until you can finalize
                                    </p>
                                </>
                            )
                        ) : (
                            <>
                                <p className="text-xs font-bold text-orange-800">Your partner wants to end the bond.</p>
                                {canExecute ? (
                                    <p className="text-[10px] text-orange-700 mt-0.5 leading-relaxed">
                                        You&apos;re still bonded — but they can finalize it at any moment now. Only they can complete or cancel the dissolution, so reach out if you want to keep the bond.
                                    </p>
                                ) : (
                                    <>
                                        <p className="text-[10px] text-orange-700 mt-0.5 leading-relaxed">
                                            You&apos;re still bonded. They can finalize it once the wait ends — only they can complete or cancel it.
                                        </p>
                                        <p className="text-[10px] font-bold text-orange-800 mt-1 flex items-center gap-1">
                                            <Timer size={10} />
                                            {daysRemaining}d {hoursRemaining}h {minutesRemaining}m {secsRemaining}s until they can finalize
                                        </p>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                    {isRequester && !canExecute && (
                        <button
                            onClick={() => setShowConfirm(true)}
                            className="text-[10px] font-black text-amber-600 uppercase tracking-widest whitespace-nowrap"
                        >
                            Cancel
                        </button>
                    )}
                    {isRequester && canExecute && (
                        <button
                            onClick={() => setShowConfirm(true)}
                            className="text-[10px] font-black text-red-600 uppercase tracking-widest whitespace-nowrap"
                        >
                            Execute
                        </button>
                    )}
                </div>
            )}

            {/* Bond Status Card */}
            <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 space-y-8 relative overflow-hidden">
                <div className="absolute top-10 right-0 p-4 opacity-[0.03]">
                    <Handshake size={120} className="text-gray-900 rotate-12" />
                </div>

                {/* Header */}
                <div className="text-center space-y-3 relative">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-2 overflow-hidden">
                        <Image src="/Isotype.png" alt="HumanBond" width={56} height={56} className="h-14 w-14 object-contain" />
                    </div>
                    <h3 className="text-3xl font-bold tracking-tight text-gray-900">You are Bonded!</h3>
                    {marriageStats && (
                        <div className="flex items-center justify-center gap-2 text-gray-500">
                            <Calendar size={16} />
                            <span className="text-sm font-medium">{marriageStats.daysTogether} days of shared life</span>
                        </div>
                    )}
                </div>

                {/* Partner Info */}
                <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between group hover:bg-gray-100 transition-colors">
                    <button
                        onClick={handleOpenPartnerProfile}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm shrink-0">
                            <Handshake size={20} className="text-gray-400" strokeWidth={2} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Partner</p>
                            {isPartnerLoading ? (
                                <span className="block h-3 w-24 bg-gray-200 rounded animate-pulse mt-1" />
                            ) : (
                                <p className="text-sm font-mono font-medium text-gray-700 truncate" title={dashboard.partner}>
                                    {partnerDisplayName}
                                </p>
                            )}
                        </div>
                    </button>
                    {isWorldApp && (
                        <button
                            onClick={handleChatWithPartner}
                            title="Chat with partner"
                            className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-white hover:bg-gray-900 text-gray-400 hover:text-white transition-all shadow-sm ml-2"
                        >
                            <MessageCircle size={18} />
                        </button>
                    )}
                </div>

                {/* Shared Wealth */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <Sparkles size={18} className="text-amber-500" />
                        <h4 className="text-base font-bold text-gray-800">Shared Wealth</h4>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Harvested balance */}
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-5 border border-amber-100/50 shadow-sm relative overflow-hidden group">
                            <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                                <Coins size={100} className="text-amber-600" />
                            </div>
                            <div className="relative space-y-1">
                                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-700/70">Harvested Time</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black text-amber-900 tracking-tighter">
                                        {timeBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-lg font-bold text-amber-700">TIME</span>
                                </div>
                                <p className="text-xs text-amber-700/60 font-medium">Available in your wallet</p>
                            </div>
                        </div>

                        {/* Growing yield */}
                        <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm relative overflow-hidden group">
                            <div className="flex justify-between items-start mb-6">
                                <div className="space-y-1">
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600">Growing Future</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-black text-gray-900 tracking-tighter tabular-nums">
                                            {interpolatedYield.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                                        </span>
                                        <span className="text-lg font-bold text-gray-400">TIME</span>
                                    </div>
                                </div>
                                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center animate-pulse">
                                    <TrendingUp size={24} className="text-emerald-500" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-linear"
                                        style={{ width: `${(interpolatedYield % 1) * 100}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] font-bold text-gray-400 px-1">
                                    <span>HARVESTING...</span>
                                    <span>+1.00 TIME / DAY</span>
                                </div>
                            </div>

                            {pendingYield > 0 && (
                                <div className="mt-6 pt-6 border-t border-gray-50">
                                    <button
                                        onClick={handleClaim}
                                        disabled={claimState === "sending"}
                                        className="w-full py-4 px-6 rounded-2xl text-sm font-bold text-white bg-gray-900 hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
                                    >
                                        {claimState === "sending" ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Withdrawing...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Coins size={18} />
                                                <span>Withdraw Joint Yield</span>
                                            </>
                                        )}
                                    </button>

                                    {claimState === "success" && (
                                        <div className="mt-3 py-2 px-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                                            <Sparkles size={14} className="text-emerald-500" />
                                            <p className="text-[11px] font-semibold text-emerald-700">
                                                Tokens claimed! Divided between both partners.
                                            </p>
                                        </div>
                                    )}

                                    {claimError && (
                                        <p className="mt-2 text-center text-[10px] font-medium text-red-500">{claimError}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-4 space-y-3">
                    <button
                        onClick={() => router.push("/marriage/gallery")}
                        className="w-full py-4 px-6 rounded-2xl text-sm font-bold text-gray-700 bg-white border-2 border-gray-100 hover:bg-gray-50 transition-all flex items-center justify-between group"
                    >
                        <div className="flex items-center gap-3">
                            <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                                <ImageIcon size={18} className="text-gray-500 group-hover:text-amber-600" />
                            </span>
                            <span>View Memories & Gallery</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-300" />
                    </button>

                    {!isDissolutionPending && (
                        <button
                            onClick={() => setShowConfirm(true)}
                            className="w-full py-3 text-xs font-bold text-red-400 hover:text-red-500 transition-colors uppercase tracking-widest h-12"
                        >
                            Dissolve Bond
                        </button>
                    )}
                </div>
            </div>

            {/* Next Milestone Card */}
            {marriageStats && (
                <div className="bg-[#1A1A1A] rounded-[2rem] p-6 space-y-4 relative overflow-hidden">
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/10 blur-[60px]" />

                    <div className="flex items-center justify-between relative">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Sparkles className="text-purple-400" size={14} />
                                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400">Next Milestone</h4>
                            </div>
                            <p className="text-2xl font-black text-white">Year {marriageStats.nextMilestone} NFT</p>
                        </div>
                        <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                            <Sparkles size={24} className="text-purple-300" />
                        </div>
                    </div>

                    <div className="space-y-3 relative">
                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-gray-400">Time remaining</p>
                                <p className="text-lg font-bold text-white tabular-nums">
                                    {marriageStats.daysToAnniversary} <span className="text-gray-500 font-medium text-sm">Days</span>
                                </p>
                            </div>
                            {marriageStats.lastMilestone > 0 && (
                                <div className="text-[10px] bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full font-bold border border-emerald-500/20">
                                    YEAR {marriageStats.lastMilestone} COLLECTED
                                </div>
                            )}
                        </div>

                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                                style={{ width: `${100 - (marriageStats.daysToAnniversary / 365.25) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
                    <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center">
                        <Coins size={16} className="text-amber-500" />
                    </div>
                    <p className="text-xs font-bold text-gray-800 leading-tight">Shared<br />1 TIME / Day</p>
                </div>
                <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden p-1">
                        <Image src="/Isotype.png" alt="" width={24} height={24} className="h-6 w-6 object-contain" />
                    </div>
                    <p className="text-xs font-bold text-gray-800 leading-tight">Unique<br />Bond NFTs</p>
                </div>
            </div>

            {/* Bond ID Footer */}
            {marriageStats && (
                <div className="px-6 py-4 bg-gray-50/50 rounded-2xl border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock size={14} className="text-gray-400" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bond ID</span>
                    </div>
                    <p className="text-[10px] font-mono text-gray-400 truncate max-w-[150px]">{marriageStats.bondId}</p>
                </div>
            )}

            {/* Dissolution Modal */}
            {showConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity"
                        onClick={() => dissolutionTxState !== "sending" && dissolutionTxState !== "success" && setShowConfirm(false)}
                    />

                    <div className="relative bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl space-y-6 animate-in fade-in zoom-in duration-300">
                        <div className="flex justify-center">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                                dissolutionTxState === "success" ? "bg-emerald-50 text-emerald-500"
                                : (isDissolutionPending && isRequester && canExecute) ? "bg-red-50 text-red-500"
                                : "bg-amber-50 text-amber-500"
                            }`}>
                                {dissolutionTxState === "success" ? <Sparkles size={40} />
                                    : isDissolutionPending ? <Timer size={40} />
                                    : <Handshake size={40} strokeWidth={2} />}
                            </div>
                        </div>

                        <div className="text-center space-y-2">
                            {dissolutionTxState === "success" ? (
                                <>
                                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Done</h3>
                                    <p className="text-sm text-emerald-600 font-bold">
                                        {lastDissolutionAction === 'execute'
                                            ? "Bond dissolved. Pending yield distributed."
                                            : lastDissolutionAction === 'cancel'
                                            ? "Dissolution request cancelled."
                                            : "Request sent. 3-day waiting period started."}
                                    </p>
                                </>
                            ) : isDissolutionPending && isRequester && canExecute ? (
                                <>
                                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Execute Dissolution?</h3>
                                    <p className="text-sm text-gray-500 font-medium leading-relaxed">
                                        The 3-day waiting period has passed. Confirming dissolves the bond and distributes all pending TIME tokens. If you&apos;ve changed your mind, you can still cancel the request and keep the bond.
                                    </p>
                                </>
                            ) : isDissolutionPending && isRequester && !canExecute ? (
                                <>
                                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Cancel Request?</h3>
                                    <p className="text-sm text-gray-500 font-medium leading-relaxed">
                                        Your dissolution request is pending. You have {daysRemaining}d {hoursRemaining}h {minutesRemaining}m {secsRemaining}s left to cancel.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Start Dissolution?</h3>
                                    <p className="text-sm text-gray-500 font-medium leading-relaxed">
                                        This starts a 3-day waiting period. After 3 days, you can execute the dissolution. You can cancel anytime before executing.
                                    </p>
                                </>
                            )}
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                                <p className="text-xs font-bold text-red-600 text-center uppercase tracking-wider">{error}</p>
                            </div>
                        )}

                        <div className="flex flex-col gap-3 pt-2">
                            {dissolutionTxState === "success" ? (
                                <button
                                    onClick={() => {
                                        setShowConfirm(false);
                                        setDissolutionTxState("idle");
                                        setTimeout(() => onRefresh?.(), 2000);
                                    }}
                                    className="w-full py-4 px-6 rounded-2xl text-sm font-black text-white bg-gray-900 hover:bg-black transition-all active:scale-95 shadow-lg shadow-gray-200"
                                >
                                    Close
                                </button>
                            ) : isDissolutionPending && isRequester && canExecute ? (
                                <>
                                    <button
                                        onClick={handleExecuteDissolution}
                                        disabled={dissolutionTxState === "sending"}
                                        className="w-full py-4 px-6 rounded-2xl text-sm font-black text-white bg-red-500 hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-200 disabled:opacity-50"
                                    >
                                        {dissolutionTxState === "sending" ? "Processing..." : "Confirm Dissolution"}
                                    </button>
                                    <button
                                        onClick={handleCancelDissolution}
                                        disabled={dissolutionTxState === "sending"}
                                        className="w-full py-4 px-6 rounded-2xl text-sm font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-all disabled:opacity-50"
                                    >
                                        Cancel request — keep the bond
                                    </button>
                                    <button
                                        onClick={() => setShowConfirm(false)}
                                        disabled={dissolutionTxState === "sending"}
                                        className="w-full py-3 px-6 rounded-2xl text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
                                    >
                                        Not yet
                                    </button>
                                </>
                            ) : isDissolutionPending && isRequester && !canExecute ? (
                                <>
                                    <button
                                        onClick={handleCancelDissolution}
                                        disabled={dissolutionTxState === "sending"}
                                        className="w-full py-4 px-6 rounded-2xl text-sm font-black text-white bg-amber-500 hover:bg-amber-600 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {dissolutionTxState === "sending" ? "Processing..." : "Cancel Request"}
                                    </button>
                                    <button
                                        onClick={() => setShowConfirm(false)}
                                        disabled={dissolutionTxState === "sending"}
                                        className="w-full py-4 px-6 rounded-2xl text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
                                    >
                                        Keep waiting
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={handleRequestDissolution}
                                        disabled={dissolutionTxState === "sending"}
                                        className="w-full py-4 px-6 rounded-2xl text-sm font-black text-white bg-red-500 hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-200 disabled:opacity-50"
                                    >
                                        {dissolutionTxState === "sending" ? "Processing..." : "Start 3-Day Process"}
                                    </button>
                                    <button
                                        onClick={() => setShowConfirm(false)}
                                        disabled={dissolutionTxState === "sending"}
                                        className="w-full py-4 px-6 rounded-2xl text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
                                    >
                                        Keep the bond
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

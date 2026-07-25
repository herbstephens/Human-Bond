/**
 * Approval screen — the landing spot for the "your signature is needed"
 * notification deep link.
 *
 * Deliberately single-purpose: someone arriving here was pulled out of whatever
 * they were doing, so it shows one payment and two choices, not the whole vault.
 */

'use client'

import { useRouter } from "next/navigation";
import { use, useCallback, useEffect } from "react";
import { ArrowLeft, Check, Clock, Shield, Users, X } from "lucide-react";
import { useAuthStore } from "@/state/authStore";
import { useMarriage } from "@/lib/marriage/context";
import { USE_MOCKS } from "@/lib/config";
import { useVaultSpends } from "@/lib/hooks/useVaultSpends";
import { useBondVault } from "@/lib/hooks/useBondVault";
import { useVaultActions } from "@/lib/hooks/useVaultActions";
import { TxErrorNotice } from "@/app/components/TxErrorNotice";
import { useWorldProfile, displayName } from "@/lib/worldcoin/useWorldProfile";
import { spendStatus } from "@/lib/vault/types";
import { formatUsdc, shortAddress } from "@/lib/vault/usdc";

export default function PendingSpendPage({ params }: { params: Promise<{ spendId: string }> }) {
    const { spendId } = use(params);
    const router = useRouter();
    const { isVerified, checkVerificationExpiry } = useAuthStore();
    const { address, dashboard, marriageView } = useMarriage();

    useEffect(() => {
        checkVerificationExpiry();
        if (!USE_MOCKS && !isVerified) router.replace("/");
    }, [isVerified, checkVerificationExpiry, router]);

    const isAuthed = USE_MOCKS || isVerified;

    const partner = (dashboard?.partner ?? null) as `0x${string}` | null;
    const { profile: partnerProfile } = useWorldProfile(partner ?? "");
    const partnerName = displayName(partner ?? "", partnerProfile.username);

    const partnerA = (marriageView?.partnerA ?? null) as `0x${string}` | null;
    const partnerB = (marriageView?.partnerB ?? null) as `0x${string}` | null;
    const bondId = (marriageView?.bondId ?? null) as `0x${string}` | null;

    const { spends, isLoading: isSpendsLoading, refetch } = useVaultSpends(bondId, partnerA, partnerB);
    const { refetch: refetchVault } = useBondVault(partnerA, partnerB, bondId);

    const handleDone = useCallback(() => {
        void refetch();
        void refetchVault();
    }, [refetch, refetchVault]);

    const { state, error, txError, approveSpend, cancelSpend } = useVaultActions({
        bondId,
        partnerA,
        partnerB,
        partner,
        onDone: handleDone,
    });

    const spend = spends.find((s) => s.spendId.toLowerCase() === spendId.toLowerCase()) ?? null;
    const status = spend ? spendStatus(spend, address) : null;
    const isBusy = state === "sending";

    if (!isAuthed || isSpendsLoading) {
        return (
            <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4" />
                    <p className="text-black/70">Loading payment…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] px-4 py-6 flex flex-col">
            <div className="max-w-md mx-auto w-full space-y-6">
                <button
                    onClick={() => router.push("/vault")}
                    className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest"
                >
                    <ArrowLeft size={16} />
                    Shared wallet
                </button>

                {!spend ? (
                    <div className="bg-white rounded-[2rem] p-8 border border-gray-100 text-center space-y-2">
                        <h3 className="text-xl font-bold text-gray-900">Payment not found</h3>
                        <p className="text-sm text-gray-500 font-medium">
                            It may have already been handled, or it belongs to a different bond.
                        </p>
                    </div>
                ) : null}

                {spend ? (
                    <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
                        <div
                            className={`px-6 pt-8 pb-6 text-center space-y-4 ${
                                status === "awaiting_you"
                                    ? "bg-gradient-to-br from-amber-50 to-orange-50"
                                    : "bg-gray-50"
                            }`}
                        >
                            <div className="flex justify-center">
                                <div
                                    className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-sm bg-white ${
                                        status === "awaiting_you"
                                            ? "border-amber-200 text-amber-500"
                                            : status === "cancelled"
                                              ? "border-gray-200 text-gray-400"
                                              : "border-gray-200 text-gray-700"
                                    }`}
                                >
                                    {status === "awaiting_you" ? (
                                        <Users size={32} />
                                    ) : status === "cancelled" ? (
                                        <X size={32} />
                                    ) : status === "awaiting_partner" ? (
                                        <Clock size={32} />
                                    ) : (
                                        <Check size={32} />
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                                    {status === "awaiting_you"
                                        ? `${partnerName} wants to send`
                                        : status === "awaiting_partner"
                                          ? "Waiting for approval"
                                          : status === "cancelled"
                                            ? "Cancelled"
                                            : "Payment sent"}
                                </p>
                                <div className="flex items-baseline justify-center gap-2">
                                    <span
                                        className={`text-5xl font-black tracking-tighter tabular-nums ${
                                            status === "cancelled" ? "text-gray-400 line-through" : "text-gray-900"
                                        }`}
                                    >
                                        {formatUsdc(spend.amount)}
                                    </span>
                                    <span className="text-xl font-bold text-gray-400">USDC</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="rounded-2xl bg-gray-50 border border-gray-100 divide-y divide-gray-100">
                                <div className="flex items-center justify-between gap-3 px-4 py-3">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        To
                                    </span>
                                    <span className="text-xs font-mono font-semibold text-gray-700" title={spend.to}>
                                        {shortAddress(spend.to)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-3 px-4 py-3">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        From
                                    </span>
                                    <span className="text-xs font-semibold text-gray-700">Shared wallet</span>
                                </div>
                                <div className="flex items-center justify-between gap-3 px-4 py-3">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        Requested by
                                    </span>
                                    <span className="text-xs font-semibold text-gray-700">
                                        {status === "awaiting_you" ? partnerName : "You"}
                                    </span>
                                </div>
                            </div>

                            {status === "awaiting_you" ? (
                                <>
                                    <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 flex items-start gap-3">
                                        <Shield size={16} className="text-amber-500 mt-0.5 shrink-0" />
                                        <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                                            This is above the instant limit, so it needs both of you. Approving sends
                                            the money right away from your shared wallet.
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-2.5">
                                        <button
                                            onClick={() => approveSpend(spend.spendId)}
                                            disabled={isBusy}
                                            className="w-full py-4 px-6 rounded-2xl text-sm font-black text-white bg-gray-900 hover:bg-black transition-all active:scale-[0.98] shadow-lg shadow-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isBusy ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Confirm in wallet…
                                                </>
                                            ) : (
                                                <>
                                                    <Check size={18} />
                                                    Approve & send
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => cancelSpend(spend.spendId)}
                                            disabled={isBusy}
                                            className="w-full py-3.5 px-6 rounded-2xl text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-50"
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </>
                            ) : null}

                            {status === "awaiting_partner" ? (
                                <p className="text-center text-sm text-gray-500 font-medium leading-relaxed">
                                    Waiting for {partnerName} to approve. You can cancel from the shared wallet if you
                                    change your mind.
                                </p>
                            ) : null}

                            {status === "executed_approved" || status === "executed_immediately" ? (
                                <p className="text-center text-sm font-bold text-gray-800">
                                    Sent — the money has left the shared wallet.
                                </p>
                            ) : null}

                            {status === "cancelled" ? (
                                <p className="text-center text-sm font-bold text-gray-400">
                                    This payment was cancelled.
                                </p>
                            ) : null}

                            {txError ? (
                                <TxErrorNotice error={txError} />
                            ) : error ? (
                                <p className="text-center text-[10px] font-medium text-red-500">{error}</p>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

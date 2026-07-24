"use client";

import { Check, Clock, X, Zap, Users } from "lucide-react";
import { formatUsdc, shortAddress } from "@/lib/vault/usdc";
import { spendStatus, type VaultSpend } from "@/lib/vault/types";
import type { TxState } from "@/lib/hooks/useVaultActions";

interface SpendCardProps {
    spend: VaultSpend;
    viewer: `0x${string}` | null;
    partnerName: string;
    txState?: TxState;
    onApprove?: (spendId: `0x${string}`) => void;
    onCancel?: (spendId: `0x${string}`) => void;
}

function relativeTime(timestamp: bigint): string {
    const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(timestamp));
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

export function SpendCard({ spend, viewer, partnerName, txState, onApprove, onCancel }: SpendCardProps) {
    const status = spendStatus(spend, viewer);
    const isPending = status === "awaiting_you" || status === "awaiting_partner";
    const isBusy = txState === "sending";

    const meta = {
        executed_immediately: {
            icon: <Zap size={16} className="text-gray-500" />,
            label: "Sent instantly",
            tone: "bg-white border-gray-100",
        },
        executed_approved: {
            icon: <Check size={16} className="text-gray-700" />,
            label: "Sent — both approved",
            tone: "bg-white border-gray-100",
        },
        awaiting_you: {
            icon: <Users size={16} className="text-amber-500" />,
            label: "Needs your approval",
            tone: "bg-amber-50 border-amber-200",
        },
        awaiting_partner: {
            icon: <Clock size={16} className="text-gray-400" />,
            label: `Waiting for ${partnerName}`,
            tone: "bg-white border-gray-100",
        },
        cancelled: {
            icon: <X size={16} className="text-gray-300" />,
            label: "Cancelled",
            tone: "bg-gray-50 border-gray-100",
        },
    }[status];

    return (
        <div className={`rounded-2xl p-4 border ${meta.tone} space-y-3`}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0 border border-gray-100">
                        {meta.icon}
                    </div>
                    <div className="min-w-0">
                        <p
                            className={`text-lg font-black tracking-tight tabular-nums ${
                                status === "cancelled" ? "text-gray-400 line-through" : "text-gray-900"
                            }`}
                        >
                            {formatUsdc(spend.amount)} <span className="text-xs font-bold text-gray-400">USDC</span>
                        </p>
                        <p className="text-[10px] font-medium text-gray-400 truncate" title={spend.to}>
                            to {shortAddress(spend.to)} · {relativeTime(spend.createdAt)}
                        </p>
                    </div>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 text-right shrink-0 pt-1">
                    {meta.label}
                </span>
            </div>

            {status === "awaiting_you" ? (
                <div className="flex gap-2 pt-1">
                    <button
                        onClick={() => onApprove?.(spend.spendId)}
                        disabled={isBusy}
                        className="flex-1 py-3 px-4 rounded-xl text-xs font-black text-white bg-gray-900 hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {isBusy ? "Approving…" : "Approve & send"}
                    </button>
                    <button
                        onClick={() => onCancel?.(spend.spendId)}
                        disabled={isBusy}
                        className="py-3 px-4 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all disabled:opacity-50"
                    >
                        Decline
                    </button>
                </div>
            ) : null}

            {status === "awaiting_partner" && isPending ? (
                <button
                    onClick={() => onCancel?.(spend.spendId)}
                    disabled={isBusy}
                    className="w-full py-2.5 text-[10px] font-black text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest disabled:opacity-50"
                >
                    Cancel request
                </button>
            ) : null}
        </div>
    );
}

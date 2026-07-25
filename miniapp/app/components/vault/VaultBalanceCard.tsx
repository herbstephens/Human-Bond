"use client";

import { useState } from "react";
import {
    AtSign,
    Check,
    Copy,
    Gauge,
    Heart,
    Scale,
    Send,
    Shield,
    Users,
    Wallet,
    Zap,
} from "lucide-react";
import { formatUsdc, shortAddress } from "@/lib/vault/usdc";
import { toFullName } from "@/lib/ens/label";
import type { BondVault } from "@/lib/vault/types";

interface VaultBalanceCardProps {
    vault: BondVault;
    partnerName: string;
    onSend: () => void;
}

export function VaultBalanceCard({ vault, partnerName, onSend }: VaultBalanceCardProps) {
    const [copied, setCopied] = useState(false);
    const [copiedName, setCopiedName] = useState(false);

    const handleCopyName = async () => {
        if (!vault.ensLabel) return;
        try {
            await navigator.clipboard.writeText(toFullName(vault.ensLabel));
            setCopiedName(true);
            setTimeout(() => setCopiedName(false), 1600);
        } catch {
            // Clipboard can fail in private browsing / non-secure contexts.
        }
    };

    const freeRatio =
        vault.dailyFreeLimit > BigInt(0)
            ? Number((vault.remainingFreeAllowance * BigInt(100)) / vault.dailyFreeLimit)
            : 0;

    const spentToday = vault.dailyFreeLimit - vault.remainingFreeAllowance;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(vault.address);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            // Clipboard can fail in private browsing / non-secure contexts.
        }
    };

    return (
        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 space-y-6 relative overflow-hidden">
            <div className="absolute top-10 right-0 p-4 opacity-[0.03]">
                <Wallet size={120} className="text-gray-900 rotate-12" />
            </div>

            <div className="relative space-y-5">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                            <Heart size={18} className="text-gray-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                Shared wallet
                            </p>
                            <p className="text-sm font-semibold text-gray-800">You & {partnerName}</p>
                        </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        <Shield size={11} />
                        2-of-2 Safe
                    </span>
                </div>

                {vault.ensLabel ? (
                    <button
                        type="button"
                        onClick={handleCopyName}
                        title={`Copy ${toFullName(vault.ensLabel)}`}
                        className="w-full flex items-center gap-2 rounded-2xl bg-indigo-50 border border-indigo-100 px-4 py-3 hover:bg-indigo-100/70 transition-colors group text-left"
                    >
                        <div className="w-8 h-8 rounded-xl bg-white border border-indigo-100 flex items-center justify-center shrink-0">
                            <AtSign size={15} className="text-indigo-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                                {copiedName ? "Copied!" : "Your ENS name"}
                            </p>
                            <p className="text-sm font-bold text-indigo-900 truncate">
                                {toFullName(vault.ensLabel)}
                            </p>
                        </div>
                        <span className="shrink-0 w-8 h-8 rounded-lg bg-white border border-indigo-100 flex items-center justify-center text-indigo-400 group-hover:text-indigo-600 transition-colors">
                            {copiedName ? <Check size={15} className="text-indigo-600" /> : <Copy size={15} />}
                        </span>
                    </button>
                ) : null}

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-5 border border-amber-100/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                        <Wallet size={100} className="text-amber-600" />
                    </div>
                    <div className="relative space-y-1">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-amber-700/70">
                            Available balance
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-amber-900 tracking-tighter tabular-nums">
                                {formatUsdc(vault.balance)}
                            </span>
                            <span className="text-lg font-bold text-amber-700">USDC</span>
                        </div>
                        <p className="text-xs text-amber-700/60 font-medium">
                            Belongs to both of you · only USDC moves from here
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={handleCopy}
                    className="w-full flex items-center justify-between gap-3 rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3.5 hover:bg-gray-100 transition-colors group"
                    title={vault.address}
                >
                    <div className="min-w-0 text-left">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
                            Bond address
                        </p>
                        <p className="text-sm font-mono font-semibold text-gray-800 truncate">
                            <span className="sm:hidden">{shortAddress(vault.address)}</span>
                            <span className="hidden sm:inline">{vault.address}</span>
                        </p>
                    </div>
                    <span className="shrink-0 w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 group-hover:text-gray-800 transition-colors">
                        {copied ? <Check size={16} className="text-gray-900" /> : <Copy size={16} />}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={onSend}
                    className="w-full py-4 px-6 rounded-2xl text-sm font-bold text-white bg-gray-900 hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
                >
                    <Send size={18} />
                    Send USDC
                </button>

                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3.5 space-y-2">
                        <div className="w-8 h-8 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
                            <Zap size={15} className="text-gray-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Instant</p>
                            <p className="text-sm font-black text-gray-900 tabular-nums">
                                ≤ {formatUsdc(vault.smallSpendThreshold)} USDC
                            </p>
                            <p className="text-[10px] text-gray-500 font-medium leading-snug mt-0.5">
                                Goes through without waiting for {partnerName}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3.5 space-y-2">
                        <div className="w-8 h-8 rounded-xl bg-white border border-amber-100 flex items-center justify-center">
                            <Users size={15} className="text-amber-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700/70">
                                Needs both
                            </p>
                            <p className="text-sm font-black text-amber-900 tabular-nums">
                                &gt; {formatUsdc(vault.smallSpendThreshold)} USDC
                            </p>
                            <p className="text-[10px] text-amber-700/70 font-medium leading-snug mt-0.5">
                                {partnerName} must approve before it sends
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                                <Gauge size={15} className="text-gray-500" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-800">Today without approval</p>
                                <p className="text-[10px] text-gray-500 font-medium">
                                    Shared rolling 24h budget for instant sends
                                </p>
                            </div>
                        </div>
                        <p className="text-xs font-black text-gray-800 tabular-nums shrink-0 pt-0.5">
                            {formatUsdc(vault.remainingFreeAllowance)}
                            <span className="text-gray-400 font-bold"> / {formatUsdc(vault.dailyFreeLimit)}</span>
                        </p>
                    </div>

                    <div className="h-2.5 w-full bg-white rounded-full overflow-hidden border border-gray-100">
                        <div
                            className="h-full bg-gray-900 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(0, Math.min(100, freeRatio))}%` }}
                        />
                    </div>

                    <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                        {spentToday > BigInt(0) ? (
                            <>
                                You&apos;ve used{" "}
                                <span className="font-bold text-gray-700">{formatUsdc(spentToday)} USDC</span> of
                                today&apos;s free allowance. Once it runs out, every send needs both of you.
                            </>
                        ) : (
                            <>
                                Full allowance available. Small payments (up to{" "}
                                {formatUsdc(vault.smallSpendThreshold)} USDC) go through instantly until the{" "}
                                {formatUsdc(vault.dailyFreeLimit)} USDC daily cap is hit.
                            </>
                        )}
                    </p>
                </div>

                <div className="rounded-2xl bg-white border border-gray-100 p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                        <Scale size={15} className="text-gray-500" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800">Split 50/50 if the bond ends</p>
                        <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed font-medium">
                            If you dissolve the bond, the USDC in this wallet is divided equally — automatically —
                            regardless of who deposited it.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

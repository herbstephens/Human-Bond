"use client";

/**
 * Read-only view of the bond's Stellar vault (contracts-stellar/), shown under the World Chain
 * wallet on /vault. Nothing here signs: Stellar wallets don't run inside World App, so moving
 * money happens on the web pages this card links to — the pay page (to share with payers) and
 * the vault page (for the partners).
 */
import { useState } from "react";
import { Check, Copy, ExternalLink, Gauge, Hourglass, Inbox, Orbit } from "lucide-react";
import { useStellarVault } from "@/lib/hooks/useStellarVault";

interface StellarVaultCardProps {
    ensLabel: string | null;
}

/** "14.5000000" → "14.50" */
function usdc(amount: string): string {
    const [whole, fraction = ""] = amount.split(".");
    return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

function openOutside(path: string) {
    window.open(`${window.location.origin}${path}`, "_blank", "noopener");
}

export function StellarVaultCard({ ensLabel }: StellarVaultCardProps) {
    const { summary, isLoading, error } = useStellarVault(ensLabel);
    const [copied, setCopied] = useState(false);

    if (!ensLabel || isLoading) return null;

    if (error) {
        return (
            <div className="rounded-2xl p-4 border border-red-100 bg-red-50 text-xs font-mono text-red-700 whitespace-pre-wrap">
                {error.message}
            </div>
        );
    }

    if (!summary) {
        return (
            <div className="bg-white rounded-[2rem] p-6 border border-gray-100 space-y-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                        <Orbit size={18} className="text-gray-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Stellar vault</p>
                        <p className="text-sm font-semibold text-gray-800">Not set up yet</p>
                    </div>
                </div>
                <p className="text-xs text-gray-500 font-medium">
                    Receive from anyone on Stellar, under the same rules as this wallet. Set it up on the web with a
                    Stellar wallet.
                </p>
                <button
                    type="button"
                    onClick={() => openOutside("/stellar")}
                    className="w-full py-3 px-6 rounded-2xl text-xs font-bold uppercase tracking-widest text-white bg-gray-900 hover:bg-black flex items-center justify-center gap-2"
                >
                    <ExternalLink size={14} />
                    Set up on the web
                </button>
            </div>
        );
    }

    const payPath = `/pay/${ensLabel}`;
    const freeRatio =
        Number(summary.dailyFreeLimit) > 0
            ? Math.round((Number(summary.remainingFreeAllowance) / Number(summary.dailyFreeLimit)) * 100)
            : 0;

    const copyPayLink = async () => {
        await navigator.clipboard.writeText(`${window.location.origin}${payPath}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
    };

    return (
        <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 space-y-5">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                        <Orbit size={18} className="text-gray-500" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Stellar vault</p>
                        <p className="text-sm font-semibold text-gray-800">Same rules, on Stellar</p>
                    </div>
                </div>
                <span className="rounded-full bg-gray-50 border border-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    {summary.network === "testnet" ? "Testnet" : "Soroban"}
                </span>
            </div>

            {summary.dissolved ? (
                <p className="text-xs font-bold text-gray-700">
                    This vault was dissolved. Each of you claims your half on the vault page.
                </p>
            ) : null}

            {summary.dissolution && !summary.dissolved ? (
                <div className="rounded-2xl p-3 border border-gray-200 bg-gray-50 flex items-center gap-2.5">
                    <Hourglass size={16} className="text-gray-500 shrink-0" />
                    <p className="text-xs font-semibold text-gray-700">
                        Dissolution requested. Splits 50/50 from {new Date(summary.dissolution.executableAt).toLocaleDateString()}.
                    </p>
                </div>
            ) : null}

            <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Balance</span>
                <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-gray-900 tracking-tighter tabular-nums">{usdc(summary.balance)}</span>
                    <span className="text-lg font-bold text-gray-500">USDC</span>
                </div>
            </div>

            {!summary.dissolved ? (
                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Gauge size={15} className="text-gray-500" />
                            <p className="text-xs font-bold text-gray-800">Today without approval</p>
                        </div>
                        <p className="text-xs font-black text-gray-900 tabular-nums">
                            {usdc(summary.remainingFreeAllowance)} / {usdc(summary.dailyFreeLimit)}
                        </p>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full bg-gray-900 rounded-full" style={{ width: `${freeRatio}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium">
                        Up to {usdc(summary.smallSpendThreshold)} USDC per spend alone · more needs both of you
                    </p>
                </div>
            ) : null}

            {summary.pendingCount > 0 ? (
                <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                    <Inbox size={15} className="text-gray-500" />
                    {summary.pendingCount === 1 ? "1 spend is waiting for approval" : `${summary.pendingCount} spends are waiting for approval`}
                </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={copyPayLink}
                    className="py-3 px-4 rounded-2xl text-xs font-bold text-gray-800 bg-gray-50 border border-gray-100 hover:bg-gray-100 flex items-center justify-center gap-2"
                >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Copied" : "Pay link"}
                </button>
                <button
                    type="button"
                    onClick={() => openOutside(`/stellar/${ensLabel}`)}
                    className="py-3 px-4 rounded-2xl text-xs font-bold text-white bg-gray-900 hover:bg-black flex items-center justify-center gap-2"
                >
                    <ExternalLink size={14} />
                    Open vault
                </button>
            </div>

            <p className="text-[10px] text-gray-400 font-medium">
                {summary.proof === "ens" ? "Verified through your ENS name" : "Testnet allowlist — not yet verified through ENS"} ·{" "}
                <a className="underline" href={summary.explorerUrl} target="_blank" rel="noreferrer">contract</a>
            </p>
        </div>
    );
}

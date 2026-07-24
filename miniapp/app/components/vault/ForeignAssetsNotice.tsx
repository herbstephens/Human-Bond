"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import { SAFE_APP_URL } from "@/lib/contracts/vault";
import { formatTokenAmount } from "@/lib/vault/usdc";
import type { ForeignAsset } from "@/lib/vault/types";

interface ForeignAssetsNoticeProps {
    assets: ForeignAsset[];
    vaultAddress: `0x${string}`;
}

/**
 * Surfaces assets sitting in the Safe that this app cannot move.
 *
 * The Safe accepts any token, but our module only handles USDC. Showing a clean
 * "Balance: 120 USDC" while 50 WLD sits in the same account makes those tokens
 * look lost when they are simply unmanaged — and they are NOT included in the
 * 50/50 split, so the couple needs to know before a dissolution, not after.
 */
export function ForeignAssetsNotice({ assets, vaultAddress }: ForeignAssetsNoticeProps) {
    if (assets.length === 0) return null;

    return (
        <div className="rounded-2xl p-4 border border-amber-200 bg-amber-50 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
                <div>
                    <p className="text-xs font-bold text-amber-800">Other assets in this wallet</p>
                    <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                        HumanBond can only move USDC. These are yours and they are safe, but you can&apos;t send them
                        from here — and they are <span className="font-bold">not included in the 50/50 split</span> if
                        the bond ends.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {assets.map((asset) => (
                        <span
                            key={asset.address}
                            className="text-[11px] font-bold text-amber-900 bg-amber-100 border border-amber-200 rounded-lg px-2.5 py-1 tabular-nums"
                        >
                            {formatTokenAmount(asset.balance, asset.decimals)} {asset.symbol}
                        </span>
                    ))}
                </div>

                <a
                    href={`${SAFE_APP_URL}/home?safe=wc:${vaultAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[10px] font-black text-amber-700 hover:text-amber-800 uppercase tracking-widest"
                >
                    Withdraw via Safe
                    <ExternalLink size={11} />
                </a>
            </div>
        </div>
    );
}

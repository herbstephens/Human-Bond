"use client";

import { useState } from "react";
import { Wallet, Zap, Users, Scale, ShieldCheck, Check, X, Loader2, AtSign } from "lucide-react";
import { formatUsdc, shortAddress } from "@/lib/vault/usdc";
import { VAULT_RULES } from "@/lib/contracts/vault";
import type { TxState } from "@/lib/hooks/useVaultActions";
import { useEnsAvailability } from "@/lib/hooks/useEnsAvailability";
import { toFullName } from "@/lib/ens/label";
import { ENS_PARENT } from "@/lib/contracts/registrar";
import { TxErrorNotice } from "@/app/components/TxErrorNotice";
import type { FriendlyTxError } from "@/lib/worldcoin/txErrors";

interface CreateVaultOnboardingProps {
    predictedAddress: `0x${string}` | null;
    partnerName: string;
    txState: TxState;
    error: string | null;
    /** Rich, actionable version of a failed transaction (gas, rejection, …). Preferred over `error`. */
    txError?: FriendlyTxError | null;
    /** True once the create tx is submitted and we're waiting for the Safe to appear on-chain. */
    isConfirming?: boolean;
    /** Auto-generated label the field starts with, already checked available. Null while resolving. */
    suggestedLabel?: string | null;
    /** ENS label to claim in the batch. Undefined means "pick one automatically" — the name is
     *  always claimed; the caller resolves the automatic label before building the transaction. */
    onCreate: (ensLabel?: string) => void;
}

/**
 * First-run screen. Every rule that governs the money is stated here, before a
 * single cent goes in — especially the 50/50 split and the USDC-only limit.
 * Finding those out at a dissolution would be the worst possible time.
 *
 * The couple's shared ENS name is claimed in the same transaction as the wallet,
 * always: the field is pre-filled from their World usernames and they can edit
 * it, but leaving it empty just means the automatic name is used. Owned by the
 * Safe and never renameable — so the choice is surfaced up front, with a live
 * availability check.
 */
export function CreateVaultOnboarding({
    predictedAddress,
    partnerName,
    txState,
    error,
    txError,
    isConfirming = false,
    suggestedLabel = null,
    onCreate,
}: CreateVaultOnboardingProps) {
    const isSending = txState === "sending";
    // Either waiting for the World App signature (isSending) or for the Safe to be mined (isConfirming).
    const busy = isSending || isConfirming;

    // null = untouched: the field tracks the async suggestion until the user types.
    const [nameInput, setNameInput] = useState<string | null>(null);
    const shownInput = nameInput ?? suggestedLabel ?? "";
    const availability = useEnsAvailability(shownInput);

    const hasName = shownInput.trim().length > 0;
    const nameReady = availability.status === "available";
    // A typed-but-not-yet-valid name blocks submission; an empty field is fine — the
    // name is then generated automatically, never skipped.
    const blockedByName = hasName && !nameReady;

    const handleCreate = () => {
        onCreate(nameReady ? availability.label ?? undefined : undefined);
    };

    const rules = [
        {
            icon: <Zap size={18} className="text-gray-500" />,
            title: `Up to ${formatUsdc(VAULT_RULES.SMALL_SPEND_THRESHOLD)} USDC, no approval`,
            body: `Either of you can spend small amounts on the spot, up to ${formatUsdc(VAULT_RULES.DAILY_FREE_LIMIT)} USDC per day between you.`,
        },
        {
            icon: <Users size={18} className="text-amber-500" />,
            title: "Anything bigger needs both",
            body: `Larger payments wait until ${partnerName} approves. They get a notification.`,
        },
        {
            icon: <Scale size={18} className="text-gray-500" />,
            title: "Split 50/50 if the bond ends",
            body: "The USDC is divided equally between you both, automatically — no matter who put it in.",
        },
        {
            icon: <ShieldCheck size={18} className="text-gray-500" />,
            title: "USDC only",
            body: "It's a Safe wallet, so it can receive any token — but HumanBond can only move USDC. Anything else needs both of you to withdraw it from Safe directly.",
        },
    ];

    return (
        <div className="w-full max-w-2xl space-y-6">
            <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 space-y-6 relative overflow-hidden">
                <div className="absolute top-10 right-0 p-4 opacity-[0.03]">
                    <Wallet size={120} className="text-gray-900 rotate-12" />
                </div>

                <div className="text-center space-y-3 relative">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-2">
                        <Wallet size={36} className="text-gray-400" strokeWidth={2} />
                    </div>
                    <h3 className="text-3xl font-bold tracking-tight text-gray-900">A wallet you both own</h3>
                    <p className="text-sm text-gray-500 font-medium leading-relaxed max-w-sm mx-auto">
                        A shared account for you and {partnerName}. Neither of you can empty it alone.
                    </p>
                </div>

                <div className="space-y-3">
                    {rules.map((rule) => (
                        <div key={rule.title} className="bg-gray-50 rounded-2xl p-4 flex items-start gap-3">
                            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm shrink-0">
                                {rule.icon}
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-800">{rule.title}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{rule.body}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* --- ENS name --- */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                        <AtSign size={14} className="text-gray-400" />
                        <p className="text-xs font-bold text-gray-800">Your shared name</p>
                        <span className="text-[10px] font-medium text-gray-400">edit it if you like</span>
                    </div>
                    <div
                        className={`flex items-center rounded-2xl border px-4 py-3 transition-colors ${
                            blockedByName
                                ? "border-red-200 bg-red-50/40"
                                : nameReady
                                ? "border-emerald-200 bg-emerald-50/40"
                                : "border-gray-200 bg-gray-50"
                        }`}
                    >
                        <input
                            value={shownInput}
                            onChange={(e) => setNameInput(e.target.value)}
                            placeholder="franco-maria"
                            spellCheck={false}
                            autoCapitalize="none"
                            disabled={busy}
                            className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-gray-900 placeholder:text-gray-300 focus:outline-none"
                        />
                        <span className="text-sm font-medium text-gray-400 shrink-0">.{ENS_PARENT}</span>
                        <span className="ml-2 shrink-0">
                            {availability.status === "checking" && <Loader2 size={16} className="text-gray-400 animate-spin" />}
                            {availability.status === "available" && <Check size={16} className="text-emerald-500" />}
                            {(availability.status === "taken" || availability.status === "invalid") && (
                                <X size={16} className="text-red-400" />
                            )}
                        </span>
                    </div>
                    <p className="text-[10px] font-medium px-1 min-h-[13px]">
                        {availability.status === "invalid" && <span className="text-red-500">{availability.reason}</span>}
                        {availability.status === "taken" && <span className="text-red-500">That name is taken</span>}
                        {availability.status === "available" && (
                            <span className="text-emerald-600">{toFullName(availability.label!)} is available</span>
                        )}
                        {availability.status === "error" && (
                            <span className="text-amber-500">Couldn&apos;t check — you can still try</span>
                        )}
                        {(availability.status === "idle" || availability.status === "checking") && (
                            <span className="text-gray-400">
                                Owned by your shared wallet. Chosen once — it can&apos;t be renamed later.
                                Left empty, one is picked for you.
                            </span>
                        )}
                    </p>
                </div>

                {predictedAddress ? (
                    <div className="px-5 py-4 bg-gray-50/50 rounded-2xl border border-gray-100 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Its address will be
                        </span>
                        <p className="text-[10px] font-mono text-gray-400" title={predictedAddress}>
                            {shortAddress(predictedAddress)}
                        </p>
                    </div>
                ) : null}

                <button
                    onClick={handleCreate}
                    disabled={busy || blockedByName}
                    className="w-full py-4 px-6 rounded-2xl text-sm font-bold text-white bg-gray-900 hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-gray-200"
                >
                    {busy ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>{isConfirming ? "Confirming on the network…" : "Creating…"}</span>
                        </>
                    ) : (
                        <>
                            <Wallet size={18} />
                            <span>Create wallet & claim name</span>
                        </>
                    )}
                </button>

                {isConfirming ? (
                    <p className="text-center text-[10px] font-medium text-gray-500 leading-relaxed px-2">
                        Your wallet is being created on-chain — this takes a few seconds. It’ll open
                        automatically when it’s ready; you don’t need to do anything.
                    </p>
                ) : null}

                {txError ? (
                    <TxErrorNotice error={txError} />
                ) : error ? (
                    <p className="text-center text-[10px] font-medium text-red-500">{error}</p>
                ) : null}
            </div>
        </div>
    );
}

"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Send, Users, Wallet, Zap } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { formatUsdc, parseUsdc } from "@/lib/vault/usdc";
import type { BondVault } from "@/lib/vault/types";
import type { TxState } from "@/lib/hooks/useVaultActions";
import { TxErrorNotice } from "@/app/components/TxErrorNotice";
import type { FriendlyTxError } from "@/lib/worldcoin/txErrors";
import { useResolveRecipient } from "@/lib/hooks/useResolveRecipient";
import { ENS_PARENT } from "@/lib/contracts/registrar";

interface SendFundsFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    vault: BondVault;
    partnerName: string;
    txState: TxState;
    error: string | null;
    /** Rich, actionable version of a failed transaction (gas, rejection, …). Preferred over `error`. */
    txError?: FriendlyTxError | null;
    /** Resolves true when the payment went through. */
    onSend: (
        to: `0x${string}`,
        amount: bigint,
        willExecuteImmediately: boolean,
    ) => Promise<boolean>;
    onReset?: () => void;
}

export function SendFundsForm({
    open,
    onOpenChange,
    vault,
    partnerName,
    txState,
    error,
    txError,
    onSend,
    onReset,
}: SendFundsFormProps) {
    const [recipient, setRecipient] = useState("");
    const [amountInput, setAmountInput] = useState("");

    const amount = useMemo(() => parseUsdc(amountInput), [amountInput]);
    // A bond has a name people can be told — the field takes it, not just 0x.
    const resolved = useResolveRecipient(recipient);
    const recipientValid = resolved.address !== null;

    const preview = useMemo(() => {
        if (amount === null) return null;
        if (amount > vault.balance) return "insufficient" as const;
        const withinThreshold = amount <= vault.smallSpendThreshold;
        const withinBudget = amount <= vault.remainingFreeAllowance;
        return withinThreshold && withinBudget ? ("instant" as const) : ("needs_approval" as const);
    }, [amount, vault.balance, vault.smallSpendThreshold, vault.remainingFreeAllowance]);

    const isSending = txState === "sending";
    const canSubmit = recipientValid && amount !== null && preview !== "insufficient" && !isSending;

    // Cleanup lives in the handler, not an effect: closing the sheet is a
    // response to the send finishing, not synchronization with external state.
    const handleSubmit = async () => {
        if (!canSubmit || amount === null) return;
        const sent = await onSend(resolved.address!, amount, preview === "instant");
        if (!sent) return; // keep the form filled so they can retry
        setRecipient("");
        setAmountInput("");
        onOpenChange(false);
        onReset?.();
    };

    const handleOpenChange = (next: boolean) => {
        if (isSending) return;
        onOpenChange(next);
        if (!next) onReset?.();
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md rounded-[1.75rem] p-0 gap-0 overflow-hidden border-gray-100">
                <div className="px-6 pt-6 pb-4 border-b border-gray-100 bg-white relative overflow-hidden">
                    <div className="absolute top-2 right-2 opacity-[0.04]">
                        <Wallet size={80} className="text-gray-900" />
                    </div>
                    <DialogHeader className="relative space-y-3">
                        <DialogTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
                            <Send size={18} className="text-gray-500" />
                            Send USDC
                        </DialogTitle>
                        <DialogDescription asChild>
                            <div className="space-y-1">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-black tracking-tighter tabular-nums text-gray-900">
                                        {formatUsdc(vault.balance)}
                                    </span>
                                    <span className="text-sm font-bold text-gray-400">USDC available</span>
                                </div>
                                <p className="text-[11px] text-gray-500 font-medium">
                                    {formatUsdc(vault.remainingFreeAllowance)} USDC left today without{" "}
                                    {partnerName}&apos;s approval
                                </p>
                            </div>
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-6 py-5 space-y-5">
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">
                                Recipient — address or bond name
                            </label>
                            <input
                                value={recipient}
                                onChange={(e) => setRecipient(e.target.value)}
                                placeholder={`0x… or alice-ben.${ENS_PARENT}`}
                                spellCheck={false}
                                disabled={isSending}
                                className="w-full px-4 py-3.5 rounded-2xl bg-gray-50 border-2 border-gray-100 text-sm font-mono text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-gray-300 transition-colors disabled:opacity-60"
                            />
                            {/* Say WHICH of the three failure modes it is: a typo in an
                                address, a name nobody registered, and "still checking"
                                are different problems with different fixes. */}
                            {resolved.state === "resolving" ? (
                                <p className="text-[10px] font-medium text-gray-400 px-1">Looking up {resolved.name}…</p>
                            ) : resolved.state === "resolved" ? (
                                <p className="text-[10px] font-medium text-emerald-600 px-1">
                                    {resolved.name} → {resolved.address!.slice(0, 6)}…{resolved.address!.slice(-4)}
                                </p>
                            ) : resolved.state === "unregistered" ? (
                                <p className="text-[10px] font-medium text-red-500 px-1">
                                    Nobody owns {resolved.name} — check the spelling.
                                </p>
                            ) : resolved.state === "invalid" ? (
                                <p className="text-[10px] font-medium text-red-500 px-1">
                                    Not an address, and not a valid bond name.
                                </p>
                            ) : null}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">
                                Amount
                            </label>
                            <div className="relative">
                                <input
                                    value={amountInput}
                                    onChange={(e) => setAmountInput(e.target.value)}
                                    placeholder="0.00"
                                    inputMode="decimal"
                                    disabled={isSending}
                                    className="w-full px-4 py-3.5 pr-20 rounded-2xl bg-gray-50 border-2 border-gray-100 text-2xl font-black text-gray-900 tabular-nums placeholder:text-gray-300 focus:outline-none focus:border-gray-300 transition-colors disabled:opacity-60"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                                    USDC
                                </span>
                            </div>
                            <div className="flex gap-2 px-1 pt-0.5">
                                {["10", "25", "50"].map((preset) => (
                                    <button
                                        key={preset}
                                        type="button"
                                        disabled={isSending}
                                        onClick={() => setAmountInput(preset)}
                                        className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors disabled:opacity-50"
                                    >
                                        {preset}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    disabled={isSending}
                                    onClick={() => {
                                        const whole = vault.balance / BigInt(1_000_000);
                                        const frac = (vault.balance % BigInt(1_000_000))
                                            .toString()
                                            .padStart(6, "0")
                                            .replace(/0+$/, "");
                                        setAmountInput(frac ? `${whole}.${frac}` : whole.toString());
                                    }}
                                    className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors disabled:opacity-50"
                                >
                                    Max
                                </button>
                            </div>
                        </div>
                    </div>

                    {preview === "instant" ? (
                        <div className="rounded-2xl p-4 bg-gray-50 flex items-start gap-3">
                            <Zap size={16} className="text-gray-500 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-[11px] font-bold text-gray-800">Sends instantly</p>
                                <p className="text-[11px] font-medium text-gray-500 leading-relaxed mt-0.5">
                                    Within your daily free allowance. {partnerName} gets a notification, but doesn&apos;t
                                    need to sign.
                                </p>
                            </div>
                        </div>
                    ) : null}

                    {preview === "needs_approval" ? (
                        <div className="rounded-2xl p-4 bg-gray-50 flex items-start gap-3">
                            <Users size={16} className="text-gray-500 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-[11px] font-bold text-gray-800">Needs {partnerName}&apos;s approval</p>
                                <p className="text-[11px] font-medium text-gray-500 leading-relaxed mt-0.5">
                                    Above the instant threshold or today&apos;s free budget. We&apos;ll notify them — money
                                    moves when they sign.
                                </p>
                            </div>
                        </div>
                    ) : null}

                    {preview === "insufficient" ? (
                        <div className="rounded-2xl p-4 bg-red-50 flex items-start gap-3">
                            <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                            <p className="text-[11px] font-semibold text-red-600 leading-relaxed">
                                Not enough USDC in the shared wallet.
                            </p>
                        </div>
                    ) : null}

                    {!preview ? (
                        <div className="rounded-2xl p-4 bg-gray-50 border border-gray-100">
                            <p className="text-[11px] font-medium text-gray-500 leading-relaxed">
                                ≤ {formatUsdc(vault.smallSpendThreshold)} USDC and within today&apos;s allowance →
                                instant. Anything larger waits for {partnerName}.
                            </p>
                        </div>
                    ) : null}

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="w-full py-4 px-6 rounded-2xl text-sm font-bold text-white bg-gray-900 hover:bg-black transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2"
                    >
                        {isSending ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Confirm in wallet…</span>
                            </>
                        ) : (
                            <>
                                <Send size={18} />
                                <span>{preview === "needs_approval" ? "Request approval" : "Send"}</span>
                            </>
                        )}
                    </button>

                    {txError ? (
                        <TxErrorNotice error={txError} />
                    ) : error ? (
                        <p className="text-center text-[10px] font-medium text-red-500">{error}</p>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}

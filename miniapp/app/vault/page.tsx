/**
 * Shared Wallet — the bond's third wallet (Protected Route)
 *
 * A Safe smart account owned 2-of-2 by the couple. Small USDC payments go
 * through instantly; anything larger waits for the partner's approval.
 */

'use client'

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, History, Inbox } from "lucide-react";
import { useAuthStore } from "@/state/authStore";
import { useMarriage } from "@/lib/marriage/context";
import { USE_MOCKS } from "@/lib/config";
import { useBondVault } from "@/lib/hooks/useBondVault";
import { useVaultSpends } from "@/lib/hooks/useVaultSpends";
import { useVaultActions } from "@/lib/hooks/useVaultActions";
import { useWorldProfile, displayName } from "@/lib/worldcoin/useWorldProfile";
import { resolveAutoLabel, useSuggestedLabel } from "@/lib/ens/autoLabel";
import { needsYourSignature } from "@/lib/vault/types";
import { VaultBalanceCard } from "@/app/components/vault/VaultBalanceCard";
import { SendFundsForm } from "@/app/components/vault/SendFundsForm";
import { SpendCard } from "@/app/components/vault/SpendCard";
import { CreateVaultOnboarding } from "@/app/components/vault/CreateVaultOnboarding";
import { ForeignAssetsNotice } from "@/app/components/vault/ForeignAssetsNotice";

export default function VaultPage() {
    const router = useRouter();
    const { isVerified, checkVerificationExpiry } = useAuthStore();
    const { address, dashboard, marriageView, isMarriageLoading } = useMarriage();
    const [sendOpen, setSendOpen] = useState(false);

    // The redirect is the only side effect here. Gating on `isVerified` directly
    // avoids a redundant loading flag that would just mirror it one render later.
    // Mock mode skips the World ID gate, same as the other protected routes.
    useEffect(() => {
        checkVerificationExpiry();
        if (!USE_MOCKS && !isVerified) router.replace("/");
    }, [isVerified, checkVerificationExpiry, router]);

    const isAuthed = USE_MOCKS || isVerified;

    const partner = (dashboard?.partner ?? null) as `0x${string}` | null;
    const { profile: partnerProfile } = useWorldProfile(partner ?? "");
    const { profile: myProfile } = useWorldProfile(address ?? "");
    const partnerName = displayName(partner ?? "", partnerProfile.username);

    const partnerA = (marriageView?.partnerA ?? null) as `0x${string}` | null;
    const partnerB = (marriageView?.partnerB ?? null) as `0x${string}` | null;
    const bondId = (marriageView?.bondId ?? null) as `0x${string}` | null;

    // Usernames in bond order (partner A first), so both partners' devices derive
    // the same automatic ENS label regardless of who is looking at the screen.
    const iAmPartnerA = !!address && !!partnerA && address.toLowerCase() === partnerA.toLowerCase();
    const usernameA = iAmPartnerA ? myProfile.username : partnerProfile.username;
    const usernameB = iAmPartnerA ? partnerProfile.username : myProfile.username;
    const suggestedLabel = useSuggestedLabel(usernameA, usernameB, bondId);

    const { vault, isLoading: isVaultLoading, refetch: refetchVault } = useBondVault(partnerA, partnerB, bondId);
    const { spends, refetch: refetchSpends } = useVaultSpends(bondId, partnerA, partnerB);

    const handleDone = useCallback(() => {
        void refetchVault();
        void refetchSpends();
    }, [refetchVault, refetchSpends]);

    const { state, error, txError, createVault, proposeSpend, approveSpend, cancelSpend, reset } = useVaultActions({
        bondId,
        partnerA,
        partnerB,
        partner,
        onDone: handleDone,
    });

    // After the create tx is submitted, the Safe still needs a few blocks to deploy before
    // vaultOf(bondId) returns it. Poll until it appears so the view flips to the created wallet on
    // its own — instead of looking frozen on the onboarding screen and needing an app restart.
    const [awaitingCreation, setAwaitingCreation] = useState(false);
    // Confirming only while we've submitted AND the Safe hasn't shown up yet — deriving it (rather
    // than clearing the flag in an effect) keeps the success path free of setState-in-effect.
    const isConfirming = awaitingCreation && !!vault && !vault.isCreated;

    // The name is mandatory: when the couple left the field empty, resolve an
    // automatic label (usernames first, bondId fallback) before building the batch.
    const handleCreateVault = useCallback(
        async (ensLabel?: string) => {
            if (!bondId) return;
            const label = ensLabel ?? (await resolveAutoLabel(usernameA, usernameB, bondId));
            const ok = await createVault(label);
            if (ok && !USE_MOCKS) setAwaitingCreation(true);
        },
        [createVault, bondId, usernameA, usernameB],
    );

    useEffect(() => {
        if (!isConfirming) return;
        let attempts = 0;
        const id = setInterval(() => {
            attempts += 1;
            void refetchVault();
            // Give up after ~2 min so a dropped tx never leaves the form stuck confirming.
            if (attempts >= 40) {
                clearInterval(id);
                setAwaitingCreation(false);
            }
        }, 3000);
        return () => clearInterval(id);
    }, [isConfirming, refetchVault]);

    const { pending, history, awaitingYou } = useMemo(() => {
        const pendingList = spends.filter((s) => !s.executed && !s.cancelled);
        return {
            pending: pendingList,
            history: spends.filter((s) => s.executed || s.cancelled),
            awaitingYou: needsYourSignature(pendingList, address),
        };
    }, [spends, address]);

    const isBonded = dashboard?.isBonded ?? false;

    if (!isAuthed || isMarriageLoading || isVaultLoading) {
        return (
            <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4" />
                    <p className="text-black/70">Loading shared wallet…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] px-4 py-6 pb-24">
            <div className="max-w-2xl mx-auto space-y-6">
                <button
                    onClick={() => router.push("/home")}
                    className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest"
                >
                    <ArrowLeft size={16} />
                    Back
                </button>

                {!isBonded ? (
                    <div className="bg-white rounded-[2rem] p-8 border border-gray-100 text-center space-y-2">
                        <h3 className="text-xl font-bold text-gray-900">No active bond</h3>
                        <p className="text-sm text-gray-500 font-medium">
                            A shared wallet belongs to a bond. Create one first.
                        </p>
                    </div>
                ) : null}

                {isBonded && vault && !vault.isCreated ? (
                    <CreateVaultOnboarding
                        predictedAddress={vault.address}
                        partnerName={partnerName}
                        txState={state}
                        error={error}
                        txError={txError}
                        isConfirming={isConfirming}
                        suggestedLabel={suggestedLabel}
                        onCreate={handleCreateVault}
                    />
                ) : null}

                {isBonded && vault && vault.isCreated ? (
                    <>
                        {awaitingYou.length > 0 ? (
                            <div className="rounded-2xl p-4 border border-amber-200 bg-amber-50 flex items-center gap-3">
                                <Inbox size={18} className="text-amber-500 shrink-0" />
                                <p className="text-xs font-bold text-amber-800">
                                    {awaitingYou.length === 1
                                        ? "1 payment is waiting for your approval."
                                        : `${awaitingYou.length} payments are waiting for your approval.`}
                                </p>
                            </div>
                        ) : null}

                        <VaultBalanceCard
                            vault={vault}
                            partnerName={partnerName}
                            onSend={() => setSendOpen(true)}
                        />

                        <ForeignAssetsNotice assets={vault.foreignAssets} vaultAddress={vault.address} />

                        <SendFundsForm
                            open={sendOpen}
                            onOpenChange={setSendOpen}
                            vault={vault}
                            partnerName={partnerName}
                            txState={state}
                            error={error}
                            txError={txError}
                            onSend={proposeSpend}
                            onReset={reset}
                        />

                        {pending.length > 0 ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <Inbox size={18} className="text-amber-500" />
                                    <h4 className="text-base font-bold text-gray-800">Pending</h4>
                                </div>
                                {pending.map((spend) => (
                                    <SpendCard
                                        key={spend.spendId}
                                        spend={spend}
                                        viewer={address}
                                        partnerName={partnerName}
                                        txState={state}
                                        onApprove={approveSpend}
                                        onCancel={cancelSpend}
                                    />
                                ))}
                            </div>
                        ) : null}

                        {history.length > 0 ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 px-1">
                                    <History size={18} className="text-gray-400" />
                                    <h4 className="text-base font-bold text-gray-800">History</h4>
                                </div>
                                {history.map((spend) => (
                                    <SpendCard
                                        key={spend.spendId}
                                        spend={spend}
                                        viewer={address}
                                        partnerName={partnerName}
                                    />
                                ))}
                            </div>
                        ) : null}

                        {spends.length === 0 ? (
                            <div className="bg-white rounded-[2rem] p-8 border border-gray-100 text-center space-y-1">
                                <p className="text-sm font-bold text-gray-700">No payments yet</p>
                                <p className="text-xs text-gray-400 font-medium">
                                    Copy the bond address above and send USDC to fund this wallet.
                                </p>
                            </div>
                        ) : null}
                    </>
                ) : null}
            </div>
        </div>
    );
}

/**
 * The bond's memory — its VowNFT certificate and every anniversary milestone.
 *
 * Reached from the bond dashboard (`/bond/[bondId]` → MEMORY), which is what
 * makes these soulbound tokens part of the product instead of orphaned code.
 * Back goes to the bond, not to /home: this page belongs to a bond.
 *
 * Design CI (docs/design-system.md): borderless cards, two Anton type roles,
 * black CTAs without glow, no amber.
 */
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useVowNFT } from "@/lib/hooks/useVowNFT";
import { useMilestoneNFTs } from "@/lib/hooks/useMilestoneNFTs";
import { useMarriage } from "@/lib/marriage/context";
import { NFTCard } from "@/app/components/marriage/NFTCard";
import { MiniKit } from "@worldcoin/minikit-js";
import { CONTRACT_ADDRESSES, HUMAN_BOND_ABI } from "@/lib/contracts";
import { USE_MOCKS } from "@/lib/config";
import { simulateTx } from "@/lib/mocks/mockTx";
import { META } from "@/lib/design";
import { ChevronLeft } from "lucide-react";

/** `useSearchParams` opts the tree into client rendering, so it needs its own
 *  Suspense boundary — otherwise the whole route refuses to prerender. */
export default function GalleryPage() {
    return (
        <Suspense
            fallback={
                <main className="min-h-screen bg-[#E8E8E8] flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-black/5 border-t-black" />
                </main>
            }
        >
            <GalleryContent />
        </Suspense>
    );
}

function GalleryContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const { vowNFTs, isLoading: loadingVow, error: vowError } = useVowNFT();
    const { milestones, isLoading: loadingMilestones, error: milestonesError } = useMilestoneNFTs();
    const { dashboard } = useMarriage();

    // The bond that sent us here, so Back returns to it instead of dumping the
    // user on /home. Absent (deep link) → the dashboard surface.
    const fromBond = searchParams.get("bond");
    const back = fromBond ? `/bond/${fromBond}` : "/profile";

    const [mintingState, setMintingState] = useState<"idle" | "sending" | "success" | "error">("idle");
    const [showNotAvailableModal, setShowNotAvailableModal] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const handleMintMilestones = async () => {
        // manualCheckAndMint requires the partner address — without an active
        // bond there is nothing to mint, so surface the friendly modal instead
        // of sending a tx that would revert.
        const partner = dashboard?.partner;
        if (!dashboard?.isBonded || !partner || partner === "0x0000000000000000000000000000000000000000") {
            setShowNotAvailableModal(true);
            return;
        }

        try {
            setMintingState("sending");

            if (USE_MOCKS) {
                await simulateTx(undefined, "Check & mint milestones");
                setMintingState("success");
                setShowSuccessModal(true);
                return;
            }

            const { finalPayload } = await MiniKit.commandsAsync.sendTransaction({
                transaction: [
                    {
                        address: CONTRACT_ADDRESSES.HUMAN_BOND,
                        abi: HUMAN_BOND_ABI,
                        functionName: "manualCheckAndMint",
                        args: [partner],
                    },
                ],
            });

            if (finalPayload.status === "error") {
                // Any error means no milestones available - show friendly modal
                setMintingState("idle");
                setShowNotAvailableModal(true);
                return;
            }

            setMintingState("success");
            setShowSuccessModal(true);
        } catch {
            // Any error means no milestones available - show friendly modal
            setMintingState("idle");
            setShowNotAvailableModal(true);
        }
    };

    const isLoading = loadingVow || loadingMilestones;

    return (
        <main className="min-h-screen bg-[#E8E8E8] pb-24">
            <div className="px-5 pt-3 pb-1 flex items-center gap-3">
                <button
                    onClick={() => router.push(back)}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-white text-gray-500 hover:text-black active:scale-95 transition-all"
                    aria-label="Back to the bond"
                >
                    <ChevronLeft size={18} />
                </button>
                <span className="font-anton text-xl text-black tracking-wide">MEMORY</span>
            </div>

            <div className="max-w-2xl mx-auto px-6 pt-3 pb-5 space-y-8">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-black/5 border-t-black" />
                        <p className={META}>Loading your memories</p>
                    </div>
                ) : (
                    <>
                        {(vowError || milestonesError) && (
                            <div className="bg-white rounded-2xl px-5 py-4 space-y-1">
                                <p className="font-anton text-[11px] text-red-600 uppercase tracking-wide">
                                    Could not load the certificates
                                </p>
                                {vowError && <p className="text-[12px] text-gray-500 font-medium">Bond NFT: {vowError}</p>}
                                {milestonesError && (
                                    <p className="text-[12px] text-gray-500 font-medium">Milestones: {milestonesError}</p>
                                )}
                            </div>
                        )}

                        <section className="space-y-3">
                            <div>
                                <h2 className="text-2xl font-anton text-black tracking-wide">THE CERTIFICATE</h2>
                                <p className={`${META} mt-0.5`}>Proof the two of you bonded, signed by the chain</p>
                            </div>

                            {vowNFTs.length > 0 ? (
                                <div className="flex overflow-x-auto snap-x snap-mandatory pb-4 -mx-6 px-6 space-x-5 no-scrollbar">
                                    {vowNFTs.map((nft, index) => {
                                        const attrs = nft.metadata?.attributes || [];
                                        const partnerA = attrs.find((a) => a.trait_type === 'partnerA')?.value?.toString();
                                        const partnerB = attrs.find((a) => a.trait_type === 'partnerB')?.value?.toString();
                                        const bondDate = attrs.find((a) => a.trait_type === 'bondDate' || a.trait_type === 'marriageDate')?.value?.toString();
                                        const bondId = attrs.find((a) => a.trait_type === 'bondId' || a.trait_type === 'marriageId')?.value?.toString();

                                        let formattedDate = '';
                                        if (bondDate) {
                                            const date = new Date(parseInt(bondDate) * 1000);
                                            formattedDate = date.toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            });
                                        }

                                        const customDescription = formattedDate
                                            ? `Verified on ${formattedDate}. Perpetual proof of human commitment.`
                                            : nft.metadata?.description;

                                        const MOCK_IMAGE_URL = "https://ipfs.io/ipfs/bafkreigg2jeevy3rhgzgnhk22vsbclszceos3jlzg4otuqal62vwokzwai";

                                        // A dissolved bond keeps its certificate — the past is not deleted,
                                        // it is just no longer the current one.
                                        const isLatest = index === 0;

                                        return (
                                            <div key={nft.tokenId.toString()} className="min-w-[85%] sm:min-w-[400px] snap-center">
                                                <NFTCard
                                                    image={MOCK_IMAGE_URL}
                                                    name={isLatest ? "Current bond" : "A bond that ended"}
                                                    description={customDescription}
                                                    tokenId={nft.tokenId.toString()}
                                                    customMetadata={{
                                                        partnerA,
                                                        partnerB,
                                                        bondDate: formattedDate,
                                                        bondId: bondId ? bondId.substring(0, 12) + '…' : undefined
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl px-5 py-6">
                                    <p className="font-anton text-lg text-black tracking-wide">NOTHING HERE YET</p>
                                    <p className={`${META} mt-0.5`}>
                                        Your first bond mints the certificate — it cannot be sold or moved
                                    </p>
                                </div>
                            )}
                        </section>

                        <section className="space-y-3">
                            <div className="flex items-end justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-anton text-black tracking-wide">ANNIVERSARIES</h2>
                                    <p className={`${META} mt-0.5`}>One for every year you stayed</p>
                                </div>
                                <button
                                    onClick={handleMintMilestones}
                                    disabled={mintingState === "sending"}
                                    className="shrink-0 px-5 py-2.5 rounded-xl bg-black text-white font-anton text-[11px] uppercase tracking-[0.15em] hover:bg-gray-900 transition-colors active:scale-[0.98] disabled:opacity-50"
                                >
                                    {mintingState === "sending" ? "Checking…" : "Check & mint"}
                                </button>
                            </div>

                            {milestones.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    {milestones.map((nft) => (
                                        <NFTCard
                                            key={nft.tokenId.toString()}
                                            image={nft.metadata?.image?.replace('ipfs://', 'https://ipfs.io/ipfs/') || ''}
                                            name={`Year ${nft.year}`}
                                            description={`Celebrating year ${nft.year} of verified human partnership.`}
                                            tokenId={nft.tokenId.toString()}
                                            year={nft.year.toString()}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl px-5 py-6">
                                    <p className="font-anton text-lg text-black tracking-wide">NO ANNIVERSARIES YET</p>
                                    <p className={`${META} mt-0.5`}>
                                        The first one mints on the anniversary of the day you bonded
                                    </p>
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>

            {showNotAvailableModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-md"
                        onClick={() => setShowNotAvailableModal(false)}
                    />
                    <div className="relative bg-white rounded-[2rem] p-7 max-w-sm w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-300">
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-black text-gray-900 tracking-tight">Not yet</h3>
                            <p className="text-sm text-gray-500 font-medium leading-relaxed">
                                Anniversary NFTs unlock on each anniversary of your bond. Come back after the next one
                                and this button will mint it.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowNotAvailableModal(false)}
                            className="w-full py-4 px-6 rounded-xl bg-black text-white font-anton text-[11px] uppercase tracking-[0.15em] hover:bg-gray-900 transition-colors active:scale-[0.98]"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}

            {showSuccessModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-md"
                        onClick={() => setShowSuccessModal(false)}
                    />
                    <div className="relative bg-white rounded-[2rem] p-7 max-w-sm w-full shadow-2xl space-y-5 animate-in fade-in zoom-in duration-300">
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-black text-gray-900 tracking-tight">Another year, on-chain</h3>
                            <p className="text-sm text-gray-500 font-medium leading-relaxed">
                                Your anniversary NFT is being minted. Soulbound, like the bond itself.
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setShowSuccessModal(false);
                                queryClient.invalidateQueries({ queryKey: ['milestoneNFTs'] });
                                queryClient.invalidateQueries({ queryKey: ['bondNFTs'] });
                            }}
                            className="w-full py-4 px-6 rounded-xl bg-black text-white font-anton text-[11px] uppercase tracking-[0.15em] hover:bg-gray-900 transition-colors active:scale-[0.98]"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            )}
        </main>
    );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useVowNFT } from "@/lib/hooks/useVowNFT";
import { useMilestoneNFTs } from "@/lib/hooks/useMilestoneNFTs";
import { useMarriage } from "@/lib/marriage/context";
import { NFTCard } from "@/app/components/marriage/NFTCard";
import { MiniKit } from "@worldcoin/minikit-js";
import { CONTRACT_ADDRESSES, HUMAN_BOND_ABI } from "@/lib/contracts";
import { USE_MOCKS } from "@/lib/config";
import { simulateTx } from "@/lib/mocks/mockTx";
import {
    ChevronLeft,
    Sparkles,
    Trophy,
    Heart,
    Calendar,
    ArrowRight
} from "lucide-react";

export default function GalleryPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { vowNFTs, isLoading: loadingVow, error: vowError } = useVowNFT();
    const { milestones, isLoading: loadingMilestones, error: milestonesError } = useMilestoneNFTs();
    const { dashboard } = useMarriage();

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
                await simulateTx();
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
            {/* Slim back row */}
            <div className="px-5 pt-3 pb-1 flex items-center gap-3">
                <button
                    onClick={() => router.push('/home')}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-gray-600 hover:text-black active:scale-95 transition-all"
                >
                    <ChevronLeft size={18} />
                </button>
                <span className="font-black text-base text-gray-900 tracking-tight">Gallery</span>
            </div>

            <div className="max-w-2xl mx-auto px-6 pt-3 pb-5 space-y-8">

                {/* Loading State */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-black"></div>
                        <p className="text-sm text-gray-600">Loading your memories...</p>
                    </div>
                ) : (
                    <>
                        {/* Errors */}
                        {(vowError || milestonesError) && (
                            <div className="bg-white rounded-2xl p-4 shadow-lg border border-red-300">
                                <div className="font-bold mb-2 text-sm text-black">Error Loading NFTs</div>
                                {vowError && <div className="text-sm text-gray-600">Bond NFT: {vowError}</div>}
                                {milestonesError && <div className="text-sm text-gray-600">Milestones: {milestonesError}</div>}
                            </div>
                        )}

                        {/* Vow NFT Section */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-2 px-1">
                                <Heart size={20} className="text-pink-500 fill-pink-500" />
                                <h2 className="text-xl font-black text-gray-900 tracking-tight">Bond Certificates</h2>
                            </div>

                            {vowNFTs.length > 0 ? (
                                <div className="flex overflow-x-auto snap-x snap-mandatory pb-8 -mx-6 px-6 space-x-5 no-scrollbar">
                                    {vowNFTs.map((nft, index) => {
                                        // Extract marriage details from attributes
                                        const attrs = nft.metadata?.attributes || [];
                                        const partnerA = attrs.find((a) => a.trait_type === 'partnerA')?.value?.toString();
                                        const partnerB = attrs.find((a) => a.trait_type === 'partnerB')?.value?.toString();
                                        const bondDate = attrs.find((a) => a.trait_type === 'bondDate' || a.trait_type === 'marriageDate')?.value?.toString();
                                        const bondId = attrs.find((a) => a.trait_type === 'bondId' || a.trait_type === 'marriageId')?.value?.toString();

                                        // Format date if available
                                        let formattedDate = '';
                                        if (bondDate) {
                                            const date = new Date(parseInt(bondDate) * 1000);
                                            formattedDate = date.toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            });
                                        }

                                        // Create custom description
                                        const customDescription = formattedDate
                                            ? `Sacred bond verified on ${formattedDate}. Perpetual proof of human commitment.`
                                            : nft.metadata?.description;

                                        // Mock image for demo purposes
                                        const MOCK_IMAGE_URL = "https://ipfs.io/ipfs/bafkreigg2jeevy3rhgzgnhk22vsbclszceos3jlzg4otuqal62vwokzwai";

                                        // Add a visual indicator for the latest marriage
                                        const isLatest = index === 0;

                                        return (
                                            <div key={nft.tokenId.toString()} className="min-w-[85%] sm:min-w-[400px] snap-center relative">
                                                <NFTCard
                                                    image={MOCK_IMAGE_URL}
                                                    name={isLatest ? "Current Bond Certificate" : "Past Bond Evidence"}
                                                    description={customDescription}
                                                    tokenId={nft.tokenId.toString()}
                                                    customMetadata={{
                                                        partnerA,
                                                        partnerB,
                                                        bondDate: formattedDate,
                                                        bondId: bondId ? bondId.substring(0, 12) + '...' : undefined
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-10 bg-white rounded-[2rem] border border-gray-100 shadow-sm text-center space-y-4">
                                    <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto">
                                        <Heart size={32} className="text-pink-200" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-black text-gray-900">No Vows Yet</p>
                                        <p className="text-xs text-gray-400 font-medium">Your first bond will grant you<br />an eternal digital certificate.</p>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Milestones Section */}
                        <section className="space-y-6">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <Trophy size={20} className="text-amber-500" />
                                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Milestones</h2>
                                </div>
                                <button
                                    onClick={handleMintMilestones}
                                    disabled={mintingState === "sending"}
                                    className="flex items-center gap-2 px-6 py-2.5 text-xs font-black text-white bg-gray-900 hover:bg-black rounded-full transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-gray-200"
                                >
                                    {mintingState === "sending" ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>CHECKING...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles size={14} />
                                            <span>CHECK & MINT</span>
                                        </>
                                    )}
                                </button>
                            </div>


                            {milestones.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {milestones.map((nft) => {
                                        // Custom name and description
                                        const customName = `Anniversary Year ${nft.year}`;
                                        const customDesc = `Celebrating year ${nft.year} of verified human partnership.`;

                                        return (
                                            <NFTCard
                                                key={nft.tokenId.toString()}
                                                image={nft.metadata?.image?.replace('ipfs://', 'https://ipfs.io/ipfs/') || ''}
                                                name={customName}
                                                description={customDesc}
                                                tokenId={nft.tokenId.toString()}
                                                year={nft.year.toString()}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="p-16 bg-[#1A1A1A] rounded-[2.5rem] text-center space-y-6 relative overflow-hidden">
                                    {/* Background Glow */}
                                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 blur-[60px]" />

                                    <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mx-auto rotate-12">
                                        <Trophy size={40} className="text-amber-400 opacity-50" />
                                    </div>
                                    <div className="space-y-2 relative">
                                        <p className="font-black text-white text-lg">No Achievements Yet</p>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] leading-relaxed px-8">
                                            Milestones are earned on every anniversary of your shared life.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleMintMilestones}
                                        className="relative z-10 mx-auto flex items-center gap-2 text-[10px] font-black text-amber-500 bg-amber-500/10 py-3 px-6 rounded-full border border-amber-500/20 hover:bg-amber-500/20 transition-all uppercase tracking-widest"
                                    >
                                        Check Eligibility <ArrowRight size={12} />
                                    </button>
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>

            {/* Not Available Modal */}
            {showNotAvailableModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Overlay */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity"
                        onClick={() => setShowNotAvailableModal(false)}
                    />

                    {/* Modal */}
                    <div className="relative bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl space-y-6 animate-in fade-in zoom-in duration-300">
                        {/* Status Icon */}
                        <div className="flex justify-center">
                            <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center text-gray-400">
                                <Calendar size={40} />
                            </div>
                        </div>

                        {/* Text Content */}
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Not Yet Available</h3>
                            <p className="text-sm text-gray-500 font-medium leading-relaxed">
                                Milestone NFTs are unlocked on each anniversary of your bond. Come back after your next anniversary to claim your reward!
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 pt-2">
                            <button
                                onClick={() => setShowNotAvailableModal(false)}
                                className="w-full py-4 px-6 rounded-2xl text-sm font-black text-white bg-gray-900 hover:bg-black transition-all active:scale-95 shadow-lg shadow-gray-200"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Overlay */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity"
                        onClick={() => setShowSuccessModal(false)}
                    />

                    {/* Modal */}
                    <div className="relative bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl space-y-6 animate-in fade-in zoom-in duration-300">
                        {/* Status Icon */}
                        <div className="flex justify-center">
                            <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                                <Sparkles size={40} />
                            </div>
                        </div>

                        {/* Text Content */}
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Milestone Unlocked!</h3>
                            <p className="text-sm text-emerald-600 font-bold leading-relaxed px-4">
                                Your milestone NFT is being minted. It represents another year of certified human bond.
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 pt-2">
                            <button
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    queryClient.invalidateQueries({ queryKey: ['milestoneNFTs'] });
                                    queryClient.invalidateQueries({ queryKey: ['bondNFTs'] });
                                }}
                                className="w-full py-4 px-6 rounded-2xl text-sm font-black text-white bg-gray-900 hover:bg-black transition-all active:scale-95 shadow-lg shadow-gray-200"
                            >
                                Refresh Gallery
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

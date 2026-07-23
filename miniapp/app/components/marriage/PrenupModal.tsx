'use client'

import { ShieldCheck, Scale, Users, Coins, Heart } from "lucide-react";
import { type ReactNode } from "react";

const PRENUP_POINTS: { icon: ReactNode; title: string; description: string }[] = [
    {
        icon: <Coins size={20} className="text-amber-500" />,
        title: "Assets & Property",
        description: "Division of all property and assets will be shared 50/50."
    },
    {
        icon: <Scale size={20} className="text-emerald-500" />,
        title: "Common Income",
        description: "All income generated during the bond is considered common capital."
    },
    {
        icon: <Users size={20} className="text-blue-500" />,
        title: "Shared Decisions",
        description: "Major life and financial decisions must be made by unanimous agreement."
    },
    {
        icon: <Heart size={20} className="text-rose-500" />,
        title: "Mutual Separation",
        description: "In case of dissolution, all accumulated wealth is divided equally (50/50)."
    },
    {
        icon: <ShieldCheck size={20} className="text-purple-500" />,
        title: "Fair Arbitration",
        description: "Irreconcilable disputes will be settled via neutral third-party arbitration."
    }
];

interface PrenupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
}

export function PrenupModal({ isOpen, onClose, onConfirm, title = "Prenuptial Agreement" }: PrenupModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-xl animate-in fade-in duration-500"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-[340px] bg-white rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-500">
                {/* Header */}
                <div className="p-6 pb-2 text-center">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck size={24} className="text-black" />
                    </div>
                    <h2 className="text-2xl font-black text-black tracking-tighter">
                        {title}
                    </h2>
                    <p className="text-[11px] font-bold text-gray-400 mt-1 uppercase tracking-widest">
                        Standard Digital Union Terms
                    </p>
                </div>

                {/* Content */}
                <div className="px-6 space-y-4 max-h-[50vh] overflow-y-auto py-4 custom-scrollbar">
                    {PRENUP_POINTS.map((point, index) => (
                        <div key={index} className="flex gap-3 group">
                            <div className="w-8 h-8 shrink-0 bg-gray-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                                {point.icon}
                            </div>
                            <div className="space-y-0.5">
                                <h3 className="text-[12px] font-black text-gray-900 tracking-tight">
                                    {point.title}
                                </h3>
                                <p className="text-[10px] leading-tight text-gray-500 font-medium">
                                    {point.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-6 pt-4 bg-gray-50/50 border-t border-gray-100 flex flex-col gap-2">
                    <button
                        onClick={onConfirm}
                        className="w-full bg-black text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-gray-900 transition-all duration-300 shadow-lg shadow-gray-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        <span>I Accept & Sign</span>
                        <ShieldCheck size={14} className="text-emerald-400" />
                    </button>

                    <button
                        onClick={onClose}
                        className="w-full text-gray-400 hover:text-gray-600 px-6 py-2 text-[9px] font-black uppercase tracking-widest transition-colors"
                    >
                        Decline
                    </button>
                </div>
            </div>
        </div>
    );
}

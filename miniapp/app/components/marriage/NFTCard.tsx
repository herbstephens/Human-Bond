import { useState } from 'react';
import Image from 'next/image';
import {
    Calendar,
    User,
    Sparkles,
    ShieldCheck,
    Clock
} from 'lucide-react';

interface NFTCardProps {
    image: string;
    name: string;
    description?: string;
    tokenId: string;
    year?: string;
    customMetadata?: {
        partnerA?: string;
        partnerB?: string;
        bondDate?: string;
        bondId?: string;
    };
}

export function NFTCard({ image, name, description, tokenId, year, customMetadata }: NFTCardProps) {
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);

    // Convert IPFS URL to HTTP gateway if needed
    const resolvedImageUrl = image
        ? image.replace('ipfs://', 'https://ipfs.io/ipfs/')
        : '';

    return (
        <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all duration-300 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 border border-gray-100 group">
            {/* Image Section */}
            <div className="relative aspect-square w-full bg-gray-50 overflow-hidden">
                {resolvedImageUrl && !imageError ? (
                    <>
                        {/* Loading Skeleton */}
                        {imageLoading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-10 h-10 border-4 border-gray-100 border-t-pink-500 rounded-full animate-spin" />
                            </div>
                        )}

                        <Image
                            src={resolvedImageUrl}
                            alt={name}
                            fill
                            sizes="(max-width: 640px) 85vw, 400px"
                            className={`object-cover transition-all duration-700 group-hover:scale-110 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                            onLoad={() => setImageLoading(false)}
                            onError={() => {
                                setImageError(true);
                                setImageLoading(false);
                            }}
                            unoptimized
                        />

                        {/* Glass Overlay for Token ID */}
                        <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/20">
                            <span className="text-[10px] font-black text-white tracking-widest uppercase">
                                #{tokenId.padStart(4, '0')}
                            </span>
                        </div>

                        {/* Year Badge */}
                        {year && (
                            <div className="absolute top-3 right-3 px-4 py-1.5 bg-amber-400 rounded-full shadow-lg flex items-center gap-1.5 border border-amber-300">
                                <Sparkles size={12} className="text-amber-900" />
                                <span className="text-[10px] font-black text-amber-900">YEAR {year}</span>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-300 p-6 bg-gray-50">
                        <ShieldCheck size={48} strokeWidth={1} />
                        <p className="text-[10px] font-bold mt-2 uppercase tracking-widest italic">Digital Certificate</p>
                    </div>
                )}
            </div>

            {/* Info Section */}
            <div className="p-6 space-y-4">
                <div className="space-y-1">
                    <h3 className="font-black text-lg text-gray-900 tracking-tight leading-none group-hover:text-pink-600 transition-colors">
                        {name}
                    </h3>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <ShieldCheck size={10} className="text-emerald-500" />
                        Verified Human Bond
                    </div>
                </div>

                {description && (
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 font-medium">
                        {description}
                    </p>
                )}

                {/* Custom Metadata for Marriage NFTs */}
                {customMetadata && (
                    <div className="space-y-2.5 pt-4 border-t border-gray-50">
                        {customMetadata.bondDate && (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-gray-400">
                                    <Calendar size={12} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Bond Date</span>
                                </div>
                                <span className="text-[11px] text-gray-800 font-black">{customMetadata.bondDate}</span>
                            </div>
                        )}
                        {(customMetadata.partnerA || customMetadata.partnerB) && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                                    <User size={12} />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Certified Partners</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {customMetadata.partnerA && (
                                        <div className="bg-gray-50 rounded-lg py-1.5 px-2 flex flex-col">
                                            <span className="text-[8px] font-bold text-gray-400 uppercase">Partner I</span>
                                            <span className="text-[10px] font-mono font-medium text-gray-600">
                                                {customMetadata.partnerA.substring(0, 6)}...{customMetadata.partnerA.substring(38)}
                                            </span>
                                        </div>
                                    )}
                                    {customMetadata.partnerB && (
                                        <div className="bg-gray-50 rounded-lg py-1.5 px-2 flex flex-col">
                                            <span className="text-[8px] font-bold text-gray-400 uppercase">Partner II</span>
                                            <span className="text-[10px] font-mono font-medium text-gray-600">
                                                {customMetadata.partnerB.substring(0, 6)}...{customMetadata.partnerB.substring(38)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {customMetadata.bondId && (
                            <div className="flex items-center justify-between pt-1 border-t border-gray-50/50">
                                <div className="flex items-center gap-1.5 text-gray-300">
                                    <Clock size={10} />
                                    <span className="text-[9px] font-bold uppercase tracking-wider">Proof ID</span>
                                </div>
                                <span className="text-[9px] font-mono text-gray-400 truncate max-w-[120px]">
                                    {customMetadata.bondId}
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * One soulbound certificate — the bond's VowNFT or an anniversary milestone.
 *
 * Design CI (docs/design-system.md): borderless white card, Anton for every
 * label and number, no amber, and the metadata rows follow the one row pattern
 * used by Rules and Activity — value left in dark Anton, label right in META.
 */
import { useState } from 'react';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
import { META } from '@/lib/design';

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

/** The one row pattern, shared with Rules and Activity. */
function MetaRow({ value, label }: { value: string; label: string }) {
    return (
        <div className="px-5 py-3.5 flex items-center justify-between gap-4">
            <p className="font-anton text-[11px] text-gray-700 uppercase tracking-wide truncate">{value}</p>
            <p className={`${META} shrink-0 text-right`}>{label}</p>
        </div>
    );
}

const short = (addr: string) => `${addr.substring(0, 6)}…${addr.substring(38)}`;

export function NFTCard({ image, name, description, tokenId, year, customMetadata }: NFTCardProps) {
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);

    const resolvedImageUrl = image ? image.replace('ipfs://', 'https://ipfs.io/ipfs/') : '';

    return (
        <div className="bg-white rounded-[1.75rem] overflow-hidden">
            <div className="relative aspect-square w-full bg-gray-50 overflow-hidden">
                {resolvedImageUrl && !imageError ? (
                    <>
                        {imageLoading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-10 h-10 border-4 border-gray-100 border-t-black rounded-full animate-spin" />
                            </div>
                        )}

                        <Image
                            src={resolvedImageUrl}
                            alt={name}
                            fill
                            sizes="(max-width: 640px) 85vw, 400px"
                            className={`object-cover transition-opacity duration-700 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                            onLoad={() => setImageLoading(false)}
                            onError={() => {
                                setImageError(true);
                                setImageLoading(false);
                            }}
                            unoptimized
                        />

                        <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-full">
                            <span className="font-anton text-[11px] text-white uppercase tracking-wide">
                                #{tokenId.padStart(4, '0')}
                            </span>
                        </div>

                        {year && (
                            <div className="absolute top-3 right-3 px-4 py-1.5 bg-black rounded-full">
                                <span className="font-anton text-[11px] text-white uppercase tracking-wide">
                                    Year {year}
                                </span>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-300 p-6">
                        <ShieldCheck size={48} strokeWidth={1} />
                        <p className={`${META} mt-2`}>Digital certificate</p>
                    </div>
                )}
            </div>

            <div className="px-5 pt-5 pb-1">
                <h3 className="font-anton text-xl text-black tracking-wide">{name.toUpperCase()}</h3>
                <p className={`${META} mt-0.5`}>Soulbound · cannot be sold or moved</p>
                {description && (
                    <p className="text-[12px] text-gray-500 font-medium leading-relaxed mt-2">{description}</p>
                )}
            </div>

            {customMetadata && (
                <div className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
                    {customMetadata.bondDate && <MetaRow value={customMetadata.bondDate} label="Bonded on" />}
                    {customMetadata.partnerA && <MetaRow value={short(customMetadata.partnerA)} label="Partner I" />}
                    {customMetadata.partnerB && <MetaRow value={short(customMetadata.partnerB)} label="Partner II" />}
                    {customMetadata.bondId && <MetaRow value={customMetadata.bondId} label="Proof ID" />}
                </div>
            )}
        </div>
    );
}

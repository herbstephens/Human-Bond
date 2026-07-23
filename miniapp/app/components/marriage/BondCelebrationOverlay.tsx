"use client";

import { useEffect } from "react";
import { Heart, Sparkles } from "lucide-react";

interface BondCelebrationOverlayProps {
  isReady: boolean;
  partnerName?: string;
  onComplete: () => void;
}

const FLOATING_HEARTS = [
  { left: "12%", delay: "0ms", size: 14 },
  { left: "28%", delay: "400ms", size: 10 },
  { left: "72%", delay: "200ms", size: 12 },
  { left: "88%", delay: "600ms", size: 9 },
  { left: "50%", delay: "300ms", size: 11 },
] as const;

export function BondCelebrationOverlay({
  isReady,
  partnerName,
  onComplete,
}: BondCelebrationOverlayProps) {
  const phase = isReady ? "celebrate" : "waiting";

  useEffect(() => {
    if (!isReady) return;
    const timer = setTimeout(onComplete, 2800);
    return () => clearTimeout(timer);
  }, [isReady, onComplete]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300"
      onClick={phase === "celebrate" ? onComplete : undefined}
      role="dialog"
      aria-live="polite"
      aria-label={phase === "celebrate" ? "Bond celebration" : "Confirming bond"}
    >
      <div className="absolute inset-0 bg-[#E8E8E8]/95 backdrop-blur-md" />

      {/* Floating hearts — only during celebration */}
      {phase === "celebrate" && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {FLOATING_HEARTS.map((heart, i) => (
            <Heart
              key={i}
              size={heart.size}
              className="absolute bottom-0 text-rose-400/70 fill-rose-400/40 animate-[bond-heart-float_2.8s_ease-out_forwards]"
              style={{ left: heart.left, animationDelay: heart.delay }}
            />
          ))}
        </div>
      )}

      <div className="relative w-full max-w-sm text-center space-y-6 animate-in zoom-in duration-500">
        <div className="relative mx-auto w-28 h-28">
          <div
            className={`absolute inset-0 rounded-full border-2 ${
              phase === "celebrate" ? "border-rose-200 animate-ping" : "border-gray-200"
            }`}
          />
          <div
            className={`absolute inset-2 rounded-full flex items-center justify-center shadow-2xl transition-all duration-700 ${
              phase === "celebrate"
                ? "bg-rose-500 scale-100 shadow-rose-200"
                : "bg-white scale-95 shadow-gray-200"
            }`}
          >
            {phase === "celebrate" ? (
              <Heart size={44} className="text-white fill-white animate-[bond-heart-beat_0.9s_ease-in-out_infinite]" />
            ) : (
              <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            )}
          </div>
          {phase === "celebrate" && (
            <Sparkles
              size={22}
              className="absolute -top-1 -right-1 text-amber-400 animate-in zoom-in duration-500"
            />
          )}
        </div>

        <div className="space-y-2">
          {phase === "celebrate" ? (
            <>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight animate-in slide-in-from-bottom-2 duration-500">
                You&apos;re Bonded!
              </h2>
              {partnerName ? (
                <p className="text-sm font-medium text-gray-500 animate-in fade-in duration-700 delay-150">
                  Forever linked with{" "}
                  <span className="font-bold text-rose-500">{partnerName}</span>
                </p>
              ) : (
                <p className="text-sm font-medium text-gray-500 animate-in fade-in duration-700 delay-150">
                  Your bond is now live on Worldchain.
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">
                Sealing your bond…
              </h2>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">
                Confirming on Worldchain
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

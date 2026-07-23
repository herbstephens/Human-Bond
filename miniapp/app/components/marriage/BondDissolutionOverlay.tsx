"use client";

import { useEffect } from "react";
import { HeartCrack, Minus } from "lucide-react";

interface BondDissolutionOverlayProps {
  isReady: boolean;
  partnerName?: string;
  onComplete: () => void;
}

const FALLING_FRAGMENTS = [
  { left: "12%", delay: "0ms", size: 6 },
  { left: "28%", delay: "400ms", size: 4 },
  { left: "50%", delay: "200ms", size: 5 },
  { left: "72%", delay: "300ms", size: 6 },
  { left: "88%", delay: "600ms", size: 4 },
] as const;

export function BondDissolutionOverlay({
  isReady,
  partnerName,
  onComplete,
}: BondDissolutionOverlayProps) {
  const phase = isReady ? "complete" : "waiting";

  useEffect(() => {
    if (!isReady) return;
    const timer = setTimeout(onComplete, 2800);
    return () => clearTimeout(timer);
  }, [isReady, onComplete]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300"
      onClick={phase === "complete" ? onComplete : undefined}
      role="dialog"
      aria-live="polite"
      aria-label={phase === "complete" ? "Bond dissolved" : "Finalizing dissolution"}
    >
      <div className="absolute inset-0 bg-[#E8E8E8]/95 backdrop-blur-md" />

      {/* Falling fragments — only during complete */}
      {phase === "complete" && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {FALLING_FRAGMENTS.map((fragment, i) => (
            <span
              key={i}
              className="absolute top-8 rounded-sm bg-gray-500/40 animate-[bond-fragment-fall_2.8s_ease-in_forwards]"
              style={{
                left: fragment.left,
                width: fragment.size,
                height: fragment.size * 1.4,
                animationDelay: fragment.delay,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative w-full max-w-sm text-center space-y-6 animate-in zoom-in duration-500">
        <div className="relative mx-auto w-28 h-28">
          <div
            className={`absolute inset-0 rounded-full border-2 ${
              phase === "complete" ? "border-gray-400 animate-ping" : "border-gray-200"
            }`}
          />
          <div
            className={`absolute inset-2 rounded-full flex items-center justify-center shadow-2xl transition-all duration-700 ${
              phase === "complete"
                ? "bg-gray-800 scale-100 shadow-gray-400"
                : "bg-white scale-95 shadow-gray-200"
            }`}
          >
            {phase === "complete" ? (
              <HeartCrack size={44} className="text-white animate-in zoom-in duration-500" />
            ) : (
              <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            )}
          </div>
          {phase === "complete" && (
            <Minus
              size={18}
              className="absolute -top-1 -right-1 text-gray-500 bg-gray-200 rounded-full p-0.5 animate-in zoom-in duration-500"
            />
          )}
        </div>

        <div className="space-y-2">
          {phase === "complete" ? (
            <>
              <h2 className="text-3xl font-black text-gray-900 tracking-tight animate-in slide-in-from-bottom-2 duration-500">
                Bond Dissolved
              </h2>
              {partnerName ? (
                <p className="text-sm font-medium text-gray-500 animate-in fade-in duration-700 delay-150">
                  Your bond with{" "}
                  <span className="font-bold text-gray-700">{partnerName}</span>{" "}
                  has ended on Worldchain.
                </p>
              ) : (
                <p className="text-sm font-medium text-gray-500 animate-in fade-in duration-700 delay-150">
                  Your bond has ended. Pending yield was distributed.
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">
                Finalizing dissolution…
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

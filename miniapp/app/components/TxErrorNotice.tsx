"use client";

/**
 * Renders a MiniKit transaction/verification failure as a friendly, actionable card.
 * Feed it the output of `explainTxError()`. Reused across the bond and vault flows so every
 * transaction error looks the same and tells the user what to do next.
 */
import { Fuel, XCircle, ShieldAlert, ScanFace, AlertTriangle, RotateCw } from "lucide-react";
import type { FriendlyTxError, TxErrorKind } from "@/lib/worldcoin/txErrors";

const STYLES: Record<TxErrorKind, { icon: typeof Fuel; ring: string; iconBg: string; iconText: string; accent: string }> = {
  funds:        { icon: Fuel,          ring: "border-amber-200 bg-amber-50",   iconBg: "bg-amber-100",  iconText: "text-amber-600",   accent: "text-amber-900" },
  rejected:     { icon: XCircle,       ring: "border-gray-200 bg-gray-50",     iconBg: "bg-gray-100",   iconText: "text-gray-500",    accent: "text-gray-900" },
  contract:     { icon: ShieldAlert,   ring: "border-red-200 bg-red-50",       iconBg: "bg-red-100",    iconText: "text-red-600",     accent: "text-red-900" },
  verification: { icon: ScanFace,      ring: "border-indigo-200 bg-indigo-50", iconBg: "bg-indigo-100", iconText: "text-indigo-600",  accent: "text-indigo-900" },
  network:      { icon: AlertTriangle, ring: "border-red-200 bg-red-50",       iconBg: "bg-red-100",    iconText: "text-red-600",     accent: "text-red-900" },
  unknown:      { icon: AlertTriangle, ring: "border-red-200 bg-red-50",       iconBg: "bg-red-100",    iconText: "text-red-600",     accent: "text-red-900" },
};

interface TxErrorNoticeProps {
  error: FriendlyTxError;
  onRetry?: () => void;
  className?: string;
}

export function TxErrorNotice({ error, onRetry, className = "" }: TxErrorNoticeProps) {
  const s = STYLES[error.kind];
  const Icon = s.icon;

  return (
    <div
      role="alert"
      className={`rounded-2xl border ${s.ring} p-4 animate-in fade-in slide-in-from-bottom-2 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl ${s.iconBg} flex items-center justify-center shrink-0`}>
          <Icon size={18} className={s.iconText} />
        </div>
        <div className="min-w-0 space-y-1">
          <p className={`text-sm font-bold ${s.accent}`}>{error.title}</p>
          <p className="text-xs text-gray-600 leading-relaxed">{error.message}</p>
          {error.action && (
            <p className="text-xs text-gray-500 leading-relaxed pt-0.5">
              <span className="font-semibold text-gray-700">What to do: </span>
              {error.action}
            </p>
          )}
        </div>
      </div>

      {(error.retryable && onRetry) && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gray-900 hover:bg-black transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <RotateCw size={14} />
          Try again
        </button>
      )}

      <p className="mt-2 text-[9px] font-mono text-gray-400 text-right">{error.code}</p>
    </div>
  );
}

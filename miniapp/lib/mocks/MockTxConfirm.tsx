"use client";

/**
 * Dev-only sheet that simulates the World App wallet confirm for sendTransaction.
 * Accept → tx succeeds; Reject → throws "User rejected transaction".
 *
 * Uses a Dialog portal so it stacks above whatever triggered the mock tx
 * (e.g. the Send modal) and wins the focus trap.
 */
import { Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMockTxStore } from "./mockTx";

export function MockTxConfirm() {
  const pending = useMockTxStore((s) => s.pending);
  const accept = useMockTxStore((s) => s.accept);
  const reject = useMockTxStore((s) => s.reject);

  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) reject();
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[10000]"
        className="sm:max-w-sm rounded-[1.75rem] bg-[#1A1A1A] text-white border-white/10 p-0 gap-0 overflow-hidden z-[10001]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          reject();
        }}
      >
        <DialogHeader className="px-5 pt-5 pb-2 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
            Mock · sendTransaction
          </p>
          <DialogTitle className="text-lg font-bold text-white">
            {pending?.label ?? "Confirm transaction"}
          </DialogTitle>
          <DialogDescription className="text-xs text-white/50 font-medium leading-relaxed">
            Simulates the World App confirm sheet. Accept to continue, or reject to abort.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 flex gap-2">
          <button
            type="button"
            onClick={reject}
            className="flex-1 py-3.5 rounded-2xl text-sm font-bold bg-white/5 text-white/70 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
          >
            <X size={16} />
            Reject
          </button>
          <button
            type="button"
            onClick={accept}
            className="flex-1 py-3.5 rounded-2xl text-sm font-bold bg-amber-500 text-black hover:bg-amber-400 transition-colors flex items-center justify-center gap-2"
          >
            <Check size={16} />
            Accept
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

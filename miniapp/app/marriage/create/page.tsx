'use client'

import { CreateProposalForm } from "../../components/marriage/CreateProposalForm";
import { useMarriage } from "@/lib/marriage/context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ChevronLeft } from "lucide-react";

export default function CreateProposalPage() {
  const { hasPendingProposal, isProposalsLoading: isLoading } = useMarriage();
  const router = useRouter();

  // Redirect away if the user already has a pending proposal
  useEffect(() => {
    if (!isLoading && hasPendingProposal) {
      router.replace("/home");
    }
  }, [hasPendingProposal, isLoading, router]);

  // Derived during render — no state needed
  const showContent = !isLoading && !hasPendingProposal;

  if (isLoading || !showContent) {
    return (
      <div className="min-h-screen bg-[#E8E8E8] flex flex-col">
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-black mx-auto" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E8E8E8] flex flex-col">
      {/* Slim back row — no sticky, no extra spacing */}
      <div className="px-5 pt-3 pb-1 flex items-center gap-3">
        <button
          onClick={() => router.push("/home")}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-sm border border-gray-100 text-gray-600 hover:text-black active:scale-95 transition-all"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="font-black text-base text-gray-900 tracking-tight">New Proposal</span>
      </div>

      <main className="flex-1 flex flex-col items-center justify-start px-6 pt-3 pb-8">
        <CreateProposalForm />
      </main>
    </div>
  );
}

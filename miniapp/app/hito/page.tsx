/**
 * Temporary standalone page for the Hito handoff probe.
 *
 * Deliberately unguarded — no World ID check, no bond required — so the probe is
 * reachable by URL in any state, including from a phone that has never used the
 * app. The same component also renders on /home and inside MarriageDashboard.
 *
 * Delete this route along with HitoLinkTest.tsx once the integration is settled.
 */

'use client'

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HitoLinkTest } from "../components/marriage/HitoLinkTest";

export default function HitoTestPage() {
  return (
    <main className="min-h-screen bg-[#FAFAFA] px-4 py-8">
      <div className="w-full max-w-lg mx-auto space-y-4">
        <Link
          href="/home"
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft size={12} />
          <span>Back</span>
        </Link>

        <HitoLinkTest />
      </div>
    </main>
  );
}

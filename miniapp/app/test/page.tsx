import Link from 'next/link';
import { notFound } from 'next/navigation';

export default function TestIndexPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <main className="min-h-screen bg-[#171512] px-5 py-12 text-[#f3eadb]">
      <section className="mx-auto max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-amber-400">
          Development
        </p>
        <h1 className="mt-3 font-serif text-4xl italic">Test flows</h1>

        <Link
          href="/test/agent_create"
          className="mt-8 block rounded-3xl border border-white/10 bg-black/20 p-5 transition-colors hover:border-amber-400/50 hover:bg-black/30"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
            AgentKit
          </p>
          <p className="mt-2 text-lg font-semibold">Create and verify an agent</p>
          <p className="mt-1 text-sm text-[#b9ad9b]">
            Test 0G key storage, World ID verification, and AgentBook registration.
          </p>
        </Link>

        <Link
          href="/test/agent_bridge"
          className="mt-4 block rounded-3xl border border-white/10 bg-black/20 p-5 transition-colors hover:border-amber-400/50 hover:bg-black/30"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
            AgentKit · bridge
          </p>
          <p className="mt-2 text-lg font-semibold">Register in the global AgentBook</p>
          <p className="mt-1 text-sm text-[#b9ad9b]">
            Mints the proof under AgentKit&apos;s app via the World ID bridge and hands off through
            the world.org universal link — the path MiniKit cannot take.
          </p>
        </Link>

        <Link
          href="/test/0g_hooks_test"
          className="mt-4 block rounded-3xl border border-white/10 bg-black/20 p-5 transition-colors hover:border-amber-400/50 hover:bg-black/30"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
            0G router
          </p>
          <p className="mt-2 text-lg font-semibold">Trigger propose_spend</p>
          <p className="mt-1 text-sm text-[#b9ad9b]">
            Sends one shared-spend prompt through the personal agent chat route.
          </p>
        </Link>

        <Link
          href="/test/selfie_check"
          className="mt-4 block rounded-3xl border border-white/10 bg-black/20 p-5 transition-colors hover:border-amber-400/50 hover:bg-black/30"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
            World ID
          </p>
          <p className="mt-2 text-lg font-semibold">Run Selfie Check</p>
          <p className="mt-1 text-sm text-[#b9ad9b]">
            Tests the Device-level proof-of-life check and resets the heartbeat.
          </p>
        </Link>

        <Link
          href="/test/identity_check"
          className="mt-4 block rounded-3xl border border-white/10 bg-black/20 p-5 transition-colors hover:border-amber-400/50 hover:bg-black/30"
        >
          <p className="font-mono text-[10px] uppercase tracking-widest text-amber-300">
            World ID 4.0
          </p>
          <p className="mt-2 text-lg font-semibold">Check age over 18</p>
          <p className="mt-1 text-sm text-[#b9ad9b]">
            Requests a minimum-age identity attestation and verifies the returned proof server-side.
          </p>
        </Link>
      </section>
    </main>
  );
}

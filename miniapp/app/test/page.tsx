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
      </section>
    </main>
  );
}

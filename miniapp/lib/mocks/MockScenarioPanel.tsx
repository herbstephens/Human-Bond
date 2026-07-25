'use client'

/**
 * Floating dev-only panel to drive the mock playground live. Mounted only when
 * USE_MOCKS is true (via a conditional dynamic import in Providers.tsx), so it
 * never ships to production.
 *
 * Two sections: the marriage scenario (static snapshots) and the vault, which is
 * a live simulation. The "acting as" toggle is what makes the two-partner
 * approval flow testable by one person.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useMockStore } from "./mockStore";
import { SCENARIOS, type Scenario } from "./scenarios";
import { useMockVaultStore, MOCK_VAULT } from "./vaultStore";
import { formatUsdc, shortAddress } from "@/lib/vault/usdc";
import { useAgentStore } from "@/lib/agent/agentStore";

export function MockScenarioPanel() {
  const router = useRouter();
  const scenario = useMockStore((s) => s.scenario);
  const setScenario = useMockStore((s) => s.setScenario);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"bond" | "vault">("bond");

  const vault = useMockVaultStore();

  const select = (id: Scenario) => {
    setScenario(id);
    queryClient.invalidateQueries({ queryKey: ["milestoneNFTs"] });
    queryClient.invalidateQueries({ queryKey: ["bondNFTs"] });
  };

  const isSelf = vault.actingAs.toLowerCase() === MOCK_VAULT.SELF.toLowerCase();
  const pendingSpends = vault.spends.filter((s) => !s.executed && !s.cancelled);

  const openAsApprover = (spendId: `0x${string}`) => {
    // The notification lands on the *other* partner. Switch identity first so
    // the pending page shows Approve / Decline instead of "waiting".
    const spend = vault.spends.find((s) => s.spendId === spendId);
    if (spend) {
      const approver =
        spend.proposer.toLowerCase() === MOCK_VAULT.SELF.toLowerCase()
          ? MOCK_VAULT.PARTNER
          : MOCK_VAULT.SELF;
      vault.setActingAs(approver);
    }
    setTab("vault");
    router.push(`/vault/pending/${spendId}`);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] font-mono">
      {open ? (
        <div className="w-72 rounded-2xl bg-[#1A1A1A] text-white shadow-2xl border border-white/10 overflow-hidden max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Mock · playground
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-white/40 hover:text-white text-xs leading-none"
              aria-label="Close mock panel"
            >
              ✕
            </button>
          </div>

          <div className="flex border-b border-white/10 shrink-0">
            <button
              onClick={() => setTab("bond")}
              className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-2 transition-colors ${
                tab === "bond" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              Bond
            </button>
            <button
              onClick={() => setTab("vault")}
              className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-2 transition-colors ${
                tab === "vault" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              Vault{pendingSpends.length > 0 ? ` (${pendingSpends.length})` : ""}
            </button>
          </div>

          <div className="overflow-y-auto">
            {tab === "bond" ? (
              <div className="p-2 flex flex-col gap-1">
                {SCENARIOS.map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => select(id)}
                    className={`text-left text-[11px] font-bold px-3 py-2 rounded-lg transition-colors ${
                      scenario === id
                        ? "bg-amber-500 text-black"
                        : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {/* Jump into the FULL demo: bonded + agent ready → bond dashboard */}
                <button
                  onClick={() => {
                    select("married");
                    const s = useAgentStore.getState();
                    useAgentStore.setState({
                      agentReady: true,
                      answers: {
                        ...s.answers,
                        name: s.answers.name ?? { id: null, text: "Ben" },
                        threshold: s.answers.threshold ?? { id: "t200", text: "Over €200" },
                      },
                    });
                    router.push("/bond/alice");
                  }}
                  className="text-left text-[11px] font-bold px-3 py-2 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors"
                >
                  → Open bond dashboard (full demo state)
                </button>
              </div>
            ) : (
              <div className="p-2 flex flex-col gap-2">
                <div className="px-1 py-1 space-y-0.5">
                  <p className="text-[9px] uppercase tracking-widest text-white/40">Balance</p>
                  <p className="text-sm font-black text-emerald-400 tabular-nums">
                    {formatUsdc(vault.balance)} USDC
                  </p>
                  <p className="text-[9px] text-white/40">
                    free spend today: {formatUsdc(vault.freeWindowSpent)} / 25.00
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-widest text-white/40 px-1">Acting as</p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => vault.setActingAs(MOCK_VAULT.SELF)}
                      className={`flex-1 text-[10px] font-bold px-2 py-2 rounded-lg transition-colors ${
                        isSelf ? "bg-amber-500 text-black" : "bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      You
                    </button>
                    <button
                      onClick={() => vault.setActingAs(MOCK_VAULT.PARTNER)}
                      className={`flex-1 text-[10px] font-bold px-2 py-2 rounded-lg transition-colors ${
                        !isSelf ? "bg-amber-500 text-black" : "bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      Partner
                    </button>
                  </div>
                  <p className="text-[9px] text-white/30 px-1 leading-relaxed">
                    Switch to &quot;Partner&quot; to see Approve on /vault, or use the deep link below.
                  </p>
                </div>

                {pendingSpends.length > 0 ? (
                  <div className="space-y-1.5 pt-1 border-t border-white/10">
                    <p className="text-[9px] uppercase tracking-widest text-amber-400/80 px-1">
                      Pending · simulate notification
                    </p>
                    {pendingSpends.map((spend) => {
                      const proposedBySelf =
                        spend.proposer.toLowerCase() === MOCK_VAULT.SELF.toLowerCase();
                      return (
                        <button
                          key={spend.spendId}
                          onClick={() => openAsApprover(spend.spendId)}
                          className="w-full text-left px-3 py-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 transition-colors space-y-0.5"
                        >
                          <p className="text-[11px] font-bold text-amber-300 tabular-nums">
                            {formatUsdc(spend.amount)} USDC → {shortAddress(spend.to)}
                          </p>
                          <p className="text-[9px] text-white/40">
                            Proposed by {proposedBySelf ? "you" : "partner"} · open as{" "}
                            {proposedBySelf ? "partner" : "you"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[9px] text-white/30 px-1 pt-1 border-t border-white/10 leading-relaxed">
                    Send &gt;10 USDC (or over the allowance) to generate a pending request.
                  </p>
                )}

                <div className="flex flex-col gap-1 pt-1 border-t border-white/10">
                  <button
                    onClick={() => vault.fund(BigInt(100_000_000))}
                    className="text-left text-[11px] font-bold px-3 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
                  >
                    + 100 USDC
                  </button>
                  <button
                    onClick={vault.toggleForeignAsset}
                    className={`text-left text-[11px] font-bold px-3 py-2 rounded-lg transition-colors ${
                      vault.foreignAssets.length > 0
                        ? "bg-amber-500 text-black"
                        : "bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {vault.foreignAssets.length > 0 ? "Remove 50 WLD" : "Add 50 WLD"}
                  </button>
                  <button
                    onClick={() =>
                      useMockVaultStore.setState(
                        vault.isCreated
                          ? { isCreated: false, ensLabel: null } // back to onboarding: re-test naming
                          : { isCreated: true },
                      )
                    }
                    className="text-left text-[11px] font-bold px-3 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
                  >
                    {vault.isCreated ? "Back to onboarding" : "Mark as created"}
                  </button>
                  <button
                    onClick={vault.reset}
                    className="text-left text-[11px] font-bold px-3 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                  >
                    Reset vault
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-12 h-12 rounded-full bg-amber-500 text-black font-black shadow-2xl flex items-center justify-center text-xs"
          aria-label="Open mock panel"
        >
          MK
        </button>
      )}
    </div>
  );
}

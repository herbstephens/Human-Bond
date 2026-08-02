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
import { useAgentStore, DISSOLUTION_DELAY_MS } from "@/lib/agent/agentStore";
import { useNow } from "@/lib/hooks/useNow";

export function MockScenarioPanel() {
  const router = useRouter();
  const scenario = useMockStore((s) => s.scenario);
  const setScenario = useMockStore((s) => s.setScenario);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"bond" | "vault" | "agent" | "end">("bond");

  const vault = useMockVaultStore();

  // --- dissolution playground ------------------------------------------------
  // Every state of the exit is one tap away: requested by either partner, mid
  // wait, past the 3 days, and dissolved. Nobody waits 72h to see a screen.
  const bonds = useAgentStore((s) => s.bonds);
  const dissolutions = useAgentStore((s) => s.dissolutions);
  const [endBondId, setEndBondId] = useState("alice");
  const endBond = bonds.find((b) => b.id === endBondId) ?? bonds[0];
  const endDissolution = endBond ? dissolutions[endBond.id] : undefined;
  // The panel has to know whether the delay elapsed, and that answer changes
  // with the clock — so it ticks instead of reading Date.now() during render.
  const now = useNow(Boolean(endDissolution));
  const endReady = Boolean(endDissolution) && now - endDissolution!.requestedAt >= DISSOLUTION_DELAY_MS;

  // --- personal agent -------------------------------------------------------
  // Deliberately NOT a marriage scenario: `agentReady` is local/0G state, not a
  // chain read, and it is orthogonal to whether you are bonded. Folding it into
  // the scenario snapshots would mean 5 scenarios x 2 agent states and a second
  // source of truth for the same flag — the trap `dissolutionPending` was.
  const agentReady = useAgentStore((s) => s.agentReady);
  const answers = useAgentStore((s) => s.answers);
  const importedSources = useAgentStore((s) => s.importedSources);
  const answeredCount = Object.keys(answers).length;

  /** Back to "bonded, but the agent was never trained" — the gate before the bond. */
  const untrainAgent = () => {
    useAgentStore.setState({
      agentReady: false,
      bornPending: false,
      step: 0,
      answers: {},
      askedIds: [],
      importedSources: [],
      messages: [],
    });
    router.push("/home");
  };

  /** Skip the interview — the agent exists and the bond opens. */
  const trainAgent = () => {
    useAgentStore.setState({ agentReady: true, bornPending: false });
  };

  /** Back-date the open request so the delay has elapsed → the finalize state. */
  const skipDelay = () => {
    if (!endBond) return;
    const open = useAgentStore.getState().dissolutions[endBond.id];
    if (!open) return;
    useAgentStore.setState((s) => ({
      dissolutions: {
        ...s.dissolutions,
        [endBond.id]: { ...open, requestedAt: Date.now() - DISSOLUTION_DELAY_MS - 1000 },
      },
    }));
  };

  /** Put the bond back on its feet — clears the request and the dissolved flag.
   *  Also rewinds the marriage scenario: executing left it on 'cooldown', and a
   *  restored bond next to an unbonded dashboard is a state that cannot exist. */
  const restoreBond = () => {
    if (!endBond) return;
    useAgentStore.setState((s) => {
      const next = { ...s.dissolutions };
      delete next[endBond.id];
      return {
        dissolutions: next,
        bonds: s.bonds.map((b) => (b.id === endBond.id ? { ...b, status: "active" as const } : b)),
      };
    });
    // The vault sim is the source the dashboard mirrors — refill THAT, not the
    // mirrored copy, or the balance would snap back to 0 on the next tick.
    vault.reset();
    select("married");
  };

  const select = (id: Scenario) => {
    setScenario(id);
    queryClient.invalidateQueries({ queryKey: ["milestoneNFTs"] });
    queryClient.invalidateQueries({ queryKey: ["bondNFTs"] });
  };

  const isSelf = vault.actingAs.toLowerCase() === MOCK_VAULT.SELF.toLowerCase();
  const pendingSpends = vault.spends.filter((s) => !s.executed && !s.cancelled);

  const openAsApprover = (spendId: `0x${string}`) => {
    // The notification lands on the *other* partner. Switch identity first so
    // the list shows Approve / Decline instead of "waiting".
    const spend = vault.spends.find((s) => s.spendId === spendId);
    if (spend) {
      const approver =
        spend.proposer.toLowerCase() === MOCK_VAULT.SELF.toLowerCase()
          ? MOCK_VAULT.PARTNER
          : MOCK_VAULT.SELF;
      vault.setActingAs(approver);
    }
    // The bond dashboard is where pending money lives now — not the legacy
    // /vault screen, which nothing in the current flow links to.
    router.push(`/bond/${useAgentStore.getState().defaultBondId}`);
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
            <button
              onClick={() => setTab("agent")}
              className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-2 transition-colors ${
                tab === "agent" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              Agent
            </button>
            <button
              onClick={() => setTab("end")}
              className={`flex-1 text-[10px] font-bold uppercase tracking-widest py-2 transition-colors ${
                tab === "end" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              End
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
            ) : tab === "vault" ? (
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
            ) : tab === "agent" ? (
              <div className="p-2 flex flex-col gap-2">
                <div className="px-1 py-1 space-y-0.5">
                  <p className="text-[9px] uppercase tracking-widest text-white/40">State</p>
                  <p className="text-[11px] font-bold text-white">
                    {agentReady
                      ? "Trained · the bond opens"
                      : answeredCount > 0 || importedSources.length > 0
                        ? `Interview in progress · ${answeredCount}/7 answered`
                        : "Not trained · bond is gated"}
                  </p>
                </div>

                <div className="flex flex-col gap-1 pt-1 border-t border-white/10">
                  {agentReady ? (
                    <button
                      onClick={untrainAgent}
                      className="text-left text-[11px] font-bold px-3 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
                    >
                      Untrain → back to the gate
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => router.push("/agent/create")}
                        className="text-left text-[11px] font-bold px-3 py-2 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors"
                      >
                        → Play the interview
                      </button>
                      <button
                        onClick={trainAgent}
                        className="text-left text-[11px] font-bold px-3 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
                      >
                        Skip it — mark as trained
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => router.push("/agent")}
                    className="text-left text-[11px] font-bold px-3 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
                  >
                    → Open the agent chat
                  </button>
                  {agentReady && (
                    <button
                      onClick={() => {
                        // The agents negotiate a shared spend and hand it to the
                        // humans — it must surface on the bond, not only in chat.
                        const s = useAgentStore.getState();
                        const b = s.bonds.find((x) => x.id === s.defaultBondId);
                        s.proposeShared(
                          "Anniversary dinner",
                          "restaurant.eth",
                          120,
                          "Both calendars were free — table for two, Saturday",
                          b ? { id: b.id, partner: b.partner } : undefined,
                        );
                        router.push(`/bond/${s.defaultBondId}`);
                      }}
                      className="text-left text-[11px] font-bold px-3 py-2 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors"
                    >
                      → Agent proposes a shared spend
                    </button>
                  )}
                </div>

                <p className="text-[9px] text-white/30 px-1 leading-relaxed">
                  Untrained + bonded is the gate: /home offers &quot;Create your agent&quot; and
                  /bond/* sends you back. This is NOT a marriage scenario — the agent axis is
                  independent of whether you are bonded.
                </p>
              </div>
            ) : (
              <div className="p-2 flex flex-col gap-2">
                {/* Which bond we are ending — the inheritance one by default. */}
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-widest text-white/40 px-1">Bond</p>
                  <div className="flex gap-1">
                    {bonds.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setEndBondId(b.id)}
                        className={`flex-1 text-[10px] font-bold px-2 py-2 rounded-lg transition-colors ${
                          endBond?.id === b.id
                            ? "bg-amber-500 text-black"
                            : "bg-white/5 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {b.partner}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="px-1 py-1 space-y-0.5 border-t border-white/10 pt-2">
                  <p className="text-[9px] uppercase tracking-widest text-white/40">State</p>
                  <p className="text-[11px] font-bold text-white">
                    {endBond?.status === "dissolved"
                      ? "Dissolved"
                      : !endDissolution
                        ? "Active · no request"
                        : endReady
                          ? `Ready to finalize (${endDissolution.requester})`
                          : `Pending · requested by ${endDissolution.requester}`}
                  </p>
                </div>

                {!endDissolution && endBond?.status !== "dissolved" ? (
                  <div className="flex flex-col gap-1 pt-1 border-t border-white/10">
                    <button
                      onClick={() => endBond && useAgentStore.getState().requestDissolution(endBond.id, "you")}
                      className="text-left text-[11px] font-bold px-3 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
                    >
                      Request — as you
                    </button>
                    <button
                      onClick={() => endBond && useAgentStore.getState().requestDissolution(endBond.id, "partner")}
                      className="text-left text-[11px] font-bold px-3 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
                    >
                      Request — as {endBond?.partner} (no cancel for you)
                    </button>
                  </div>
                ) : endDissolution ? (
                  <div className="flex flex-col gap-1 pt-1 border-t border-white/10">
                    <button
                      onClick={skipDelay}
                      className="text-left text-[11px] font-bold px-3 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
                    >
                      Skip the 3 days → finalize state
                    </button>
                    <button
                      onClick={() => {
                        if (!endBond) return;
                        // Same two steps as useDissolution: settle the vault sim
                        // FIRST, or the mirror puts the money back a tick later.
                        vault.settle();
                        useAgentStore.getState().executeDissolution(endBond.id);
                      }}
                      disabled={!endReady}
                      className="text-left text-[11px] font-bold px-3 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-30 disabled:hover:bg-red-500/20 transition-colors"
                    >
                      Execute now (splits the vault)
                    </button>
                  </div>
                ) : null}

                <div className="pt-1 border-t border-white/10">
                  <button
                    onClick={restoreBond}
                    className="w-full text-left text-[11px] font-bold px-3 py-2 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 transition-colors"
                  >
                    Reset bond to active
                  </button>
                </div>

                <p className="text-[9px] text-white/30 px-1 leading-relaxed">
                  The exit lives at the bottom of /bond/{endBond?.id ?? "alice"}. Requesting as{" "}
                  {endBond?.partner ?? "the partner"} is the case with no cancel button — leaving is
                  never gated.
                </p>
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

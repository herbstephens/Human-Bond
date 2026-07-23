'use client'

/**
 * Floating dev-only panel to jump between mock scenarios live. Mounted only when
 * USE_MOCKS is true (via a conditional dynamic import in Providers.tsx), so it
 * never ships to production.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMockStore } from "./mockStore";
import { SCENARIOS, type Scenario } from "./scenarios";

export function MockScenarioPanel() {
  const scenario = useMockStore((s) => s.scenario);
  const setScenario = useMockStore((s) => s.setScenario);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);

  const select = (id: Scenario) => {
    setScenario(id);
    // NFT hooks read the scenario non-reactively inside their queryFn, so nudge
    // them to refetch the new scenario's data.
    queryClient.invalidateQueries({ queryKey: ["milestoneNFTs"] });
    queryClient.invalidateQueries({ queryKey: ["bondNFTs"] });
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] font-mono">
      {open ? (
        <div className="w-56 rounded-2xl bg-[#1A1A1A] text-white shadow-2xl border border-white/10 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
              Mock · escenarios
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-white/40 hover:text-white text-xs leading-none"
              aria-label="Cerrar panel mock"
            >
              ✕
            </button>
          </div>
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
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-12 h-12 rounded-full bg-amber-500 text-black font-black shadow-2xl flex items-center justify-center text-xs"
          aria-label="Abrir panel mock"
        >
          MK
        </button>
      )}
    </div>
  );
}

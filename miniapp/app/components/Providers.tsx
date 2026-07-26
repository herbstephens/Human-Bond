'use client'

import { useState } from "react";
import dynamic from "next/dynamic";
import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi/config";
import { WORLD_APP_CONFIG } from "@/lib/contracts";
import { USE_MOCKS } from "@/lib/config";
import { MarriageProvider } from "@/lib/marriage/MarriageProvider";
import { Header } from "./Header";
import { usePathname } from "next/navigation";

// Dev-only mock scenario panel. The conditional dynamic import keeps it (and the
// mock store) out of the production bundle entirely.
const MockScenarioPanel = USE_MOCKS
  ? dynamic(() => import("@/lib/mocks/MockScenarioPanel").then((m) => m.MockScenarioPanel), {
      ssr: false,
    })
  : null;

const MockTxConfirm = USE_MOCKS
  ? dynamic(() => import("@/lib/mocks/MockTxConfirm").then((m) => m.MockTxConfirm), {
      ssr: false,
    })
  : null;

export function Providers({ children }: { children: React.ReactNode }) {
  // Inside World App every MiniKit popup blurs/refocuses the webview; the React
  // Query default (refetchOnWindowFocus: true) then refires EVERY query at once,
  // right after each user action — perceived as the whole app "reloading".
  // Polling where freshness matters is explicit (home/vault/onboarding), so the
  // focus refetch adds nothing but churn. retry: 1 keeps a failing public RPC
  // from snowballing into a 3x-retry error storm across all queries.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  const pathname = usePathname();
  // Two routes bring their own chrome and must not get the app header or its
  // 80px offset: the gallery, and the landing (which has its own sticky nav).
  const isFullBleedPage = pathname === '/marriage/gallery' || pathname === '/';

  return (
    // Without appId MiniKit installs anonymously ("App ID not provided during
    // install") and commands can misbehave inside World App. Sourced from
    // WORLD_APP_CONFIG so the id lives in exactly one place.
    <MiniKitProvider props={{ appId: WORLD_APP_CONFIG.APP_ID }}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <MarriageProvider>
            {!isFullBleedPage && <Header />}
            <div className={isFullBleedPage ? "pt-0" : "pt-20"}>
              {children}
            </div>
            {MockScenarioPanel && <MockScenarioPanel />}
            {MockTxConfirm && <MockTxConfirm />}
          </MarriageProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </MiniKitProvider>
  );
}

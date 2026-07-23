'use client'

import { useState } from "react";
import dynamic from "next/dynamic";
import { MiniKitProvider } from "@worldcoin/minikit-js/minikit-provider";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi/config";
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

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const pathname = usePathname();
  const isGalleryPage = pathname === '/marriage/gallery';

  return (
    <MiniKitProvider>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <MarriageProvider>
            {!isGalleryPage && <Header />}
            <div className={isGalleryPage ? "pt-0" : "pt-20"}>
              {children}
            </div>
            {MockScenarioPanel && <MockScenarioPanel />}
          </MarriageProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </MiniKitProvider>
  );
}

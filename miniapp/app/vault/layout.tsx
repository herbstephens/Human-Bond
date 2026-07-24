import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shared Wallet | HumanBond",
  description: "A USDC wallet you and your partner own together, split 50/50 if the bond ends.",
};

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return children;
}

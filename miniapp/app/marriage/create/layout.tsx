import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Proposal | HumanBond",
  description: "Propose a digital union on Worldchain. Verified by World ID.",
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children;
}

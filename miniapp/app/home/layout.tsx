import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home | HumanBond",
  description: "Create or accept a bond proposal on Worldchain.",
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}

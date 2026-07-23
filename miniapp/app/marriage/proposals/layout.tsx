import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Proposals | HumanBond",
    description: "Review and respond to incoming bond proposals on Worldchain.",
};

export default function ProposalsLayout({ children }: { children: React.ReactNode }) {
    return children;
}

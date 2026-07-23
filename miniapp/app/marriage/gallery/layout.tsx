import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gallery | HumanBond",
  description: "View your bond NFTs, milestone achievements, and eternal memories.",
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return children;
}

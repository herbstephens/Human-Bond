import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "./components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for headlines — always uppercase, via the `font-anton` utility.
const anton = localFont({
  src: "./fonts/Anton-Regular.ttf",
  variable: "--font-anton-loaded",
});

// iOS zooms the page when a focused input renders under 16px and never zooms
// back — inside World App there is no pinch-out to recover. Pinning the scale
// kills that zoom entirely.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "HumanBond",
  description: "The first protocol for eternalizing relationships on Worldchain. Verify your love, earn TIME.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

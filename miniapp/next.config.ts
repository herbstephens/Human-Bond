import type { NextConfig } from "next";

// Safety net: never ship a production build with mock data enabled.
if (
  process.env.VERCEL_ENV === "production" &&
  process.env.NEXT_PUBLIC_USE_MOCKS === "1"
) {
  throw new Error(
    "🚨 Refusing to build production with NEXT_PUBLIC_USE_MOCKS=1. Unset it before deploying.",
  );
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.ngrok-free.dev', '*.ngrok.io'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ipfs.io',
        pathname: '/ipfs/**',
      },
    ],
  },
};

export default nextConfig;

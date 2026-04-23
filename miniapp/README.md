# HumanBond Mini App

> **Status:** Live prototype under rebrand from `marriagePROOF`.
> Hosted at: <https://tim-edao-marriage-proof.vercel.app>

This directory is a placeholder for the World App Mini App source. The current production Mini App is maintained in a separate Vercel-deployed Next.js repo and is in the process of being folded into this mono-repo structure as part of Seoul Build Week work.

---

## Current Stack

- **Next.js 14** (App Router)
- **MiniKit 2.0** (World App integration)
- **viem** + **wagmi** for World Chain RPC and contract reads/writes
- **TanStack Query** for data caching
- **Tailwind CSS** + **shadcn/ui** for styling
- Deployed on **Vercel**

## What the Mini App Exposes

- **Propose** — trigger World ID proof (action: `propose-bond`), submit `HumanBond.propose()`
- **Incoming Proposals** — list proposals where the connected user is the `proposed` party
- **Accept** — trigger World ID proof (action: `accept-bond`), submit `HumanBond.accept()`
- **Dashboard** — `getUserDashboard(user)` for marriage status, pending yield, TIME balance
- **Claim Yield** — `claimYield(partner)` with optimistic UI
- **Milestones** — view owned Milestone NFTs and trigger `manualCheckAndMint(partner)` when eligible
- **Divorce** — `divorce(partner)` with 2-step confirmation

## Environment

```
NEXT_PUBLIC_WORLDCHAIN_RPC=...
NEXT_PUBLIC_HUMANBOND_ADDRESS=0xB3cbCB0294995FE1aCD7187B94aEDBD4555c5A63
NEXT_PUBLIC_VOWNFT_ADDRESS=0x8c64c304854F9284ddb976918dF37Bd4f5949F22
NEXT_PUBLIC_MILESTONE_ADDRESS=0x566c4a366625F08A714dd092f8bD2F0E86f906f5
NEXT_PUBLIC_TIME_ADDRESS=0x39e629681a9db65D9352961d8dCD4C96C4A1169a
NEXT_PUBLIC_WORLD_APP_ID=app_bfc3261816aeadc589f9c6f80a98f5df
NEXT_PUBLIC_ACTION_PROPOSE=propose-bond
NEXT_PUBLIC_ACTION_ACCEPT=accept-bond
```

## Roadmap

See [`../docs/ROADMAP.md`](../docs/ROADMAP.md). Highlights:

- Full HumanBond brand rollout (from `marriagePROOF`)
- Dating-app Registry API dashboard for B2B customers
- Multi-chain UX (read from World Chain canonical, write always to canonical)
- WorkNFT submission flow for V2 TIME minting

---

**Front-end lead:** Franco Amicone ([team](../README.md#team))

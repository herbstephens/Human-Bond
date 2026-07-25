# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

For local testing with World App, use ngrok to expose the dev server — the config already allows `*.ngrok-free.dev` and `*.ngrok.io` origins.

## Architecture

**HumanBond** is a blockchain-based matrimonial protocol on **Worldchain Mainnet** (Chain ID: 480). Users verify their identity via World ID, then create/accept marriage proposals on-chain, mint Vow NFTs as marriage certificates, and earn TIME tokens through milestone NFTs.

### Tech Stack
- **Framework:** Next.js (App Router), React 19, TypeScript
- **Blockchain:** wagmi 3 + viem 2 for contract reads/writes
- **Identity:** `@worldcoin/minikit-js` — World ID verification + wallet auth via World App
- **State:** Zustand with localStorage persistence (`state/authStore.ts`)
- **UI:** Tailwind CSS v4, shadcn/ui (new-york style), lucide-react icons
- **Data Fetching:** TanStack React Query

### Smart Contracts (Worldchain Mainnet) — V5
Addresses in `lib/contracts/index.ts`, vault layer in `lib/contracts/vault.ts`, ENS registrar in
`lib/contracts/registrar.ts`. Deployed 2026-07-24 — see `contracts/DEPLOYMENT-v5.md` for verification.
- **HumanBond Proxy** `0x7822e66B3597424424AA62d765E29eC89b9fD541` — always use this address for txs (UUPS proxy)
- **BondNFT** `0x95deecB32F60B8b5BE45cd9F2c3D44ED8579Ad3e` — soulbound bond certificate NFTs
- **MilestoneNFT** `0xe308AdC4bb0a39A6266D79f25Ac0BCbDA252cDBE` — yearly anniversary NFTs
- **TIME Token** `0x8d292a670a41923CE99Ac9bc11EF8FFB87a04E84` — rewards token
- **BondVaultModule** `0xb94d2178c6530899a9b275A2b1F9663d4B4F2d65` — shared-wallet entrypoint
- **HumanBondRegistrar** `0xEea00940991d31b7a39c0A24BD8fcf259aAC839A` — ENS subname registrar

World App config: App ID `app_bfc3261816aeadc589f9c6f80a98f5df` (production), actions: `propose-bond`, `accept-bond`.

### Environment switching (production ⇄ test)

The addresses/app_id/ENS parent above are the **production defaults, hardcoded** in
`lib/contracts/index.ts`, `vault.ts`, `registrar.ts`. Every one is overridable by a `NEXT_PUBLIC_*`
env var (see the `?? '0x…'` fallbacks). The **TEST** environment (app `HumanBondMultisig`
`app_925d0aaa…`, ENS `humandbond.eth`, separate contract set deployed 2026-07-25) is selected by
the block in `.env.local` — which is gitignored, so the test config never travels with the code.
Comment that block out to run against production. TEST contract addresses live in
`../worldid-humanbond-protocol/DEPLOYMENT-test.md`.

**Developer Portal whitelist** (blocking — txs fail with `invalid_contract` without it):
HumanBond proxy, BondVaultModule, HumanBondRegistrar, and SafeProxyFactory
`0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` as contract entrypoints; USDC
`0x79A02482A880bCE3F13e09Da970dC34db4CD24d1` as a Permit2 token.

### ENS subnames (Bond names)

Every shared wallet is created with a `<label>.humanbond.eth` subname, owned by the Safe and
resolving to it. It is the (mandatory) third call of the vault-creation batch
(`lib/vault/createVault.ts`). The onboarding field is pre-filled with an auto-generated label —
`<usernameA>-<usernameB>` from the couple's World usernames, with numbered variants and a
`bond-<bondId hex>` fallback (`lib/ens/autoLabel.ts`) — so a couple that never touches the field
still gets a name. Naming UI + live availability are in `CreateVaultOnboarding` via
`useEnsAvailability`; label rules in `lib/ens/label.ts`. One name per bond instance, no renames. Registry lives on Worldchain (Durin L2Registry
`0x3DbB5CE73f3C1cb63D61A6Db73668D4cE10f371B` under `humanbond.eth`).

### Shared Wallet (Bond Vault)

Each bond can create a **Safe smart account** owned 2-of-2 by the partners. `BondVaultModule` is a
Safe *module* enabled on it, so it can move funds without owner signatures — that is what makes
small payments instant. **The module never holds funds; the money lives in the couple's Safe.**

- **USDC only.** The token is immutable in the module, so it can never move anything else. The Safe
  can still *receive* any token — `ForeignAssetsNotice` surfaces those, since they are invisible to
  the app and excluded from the 50/50 split.
- **≤10 USDC** executes immediately, capped at **25 USDC per bond per 24h** (shared, not per person).
  Above either limit, both partners must approve.
- **Dissolution splits the USDC 50/50** automatically, via a `try/catch` so a vault failure can never
  block a divorce.
- Vault address is counterfactual — derived from `(owners, bondId)` in `lib/vault/safeAddress.ts`,
  so it is known before the Safe is deployed. Verified against a real Safe on a mainnet fork.

Key files: `app/vault/`, `app/components/vault/`, `lib/vault/`, `lib/hooks/useBondVault.ts`,
`useVaultSpends.ts`, `useVaultActions.ts`.

### Mock mode

`NEXT_PUBLIC_USE_MOCKS=1 npm run dev` — skips World ID and serves fake data. The floating panel has
two tabs: **Bond** (static marriage scenarios) and **Vault**, which is a *live simulation*
replicating the contract's threshold and budget rules. The "acting as" toggle switches between
partners so the two-signature approval flow is testable by one person.

### Authentication & State Flow
1. `app/page.tsx` — landing page gated by World ID verification
2. User verifies → MiniKit proof stored in Zustand `authStore` with 24-hour expiry
3. Wallet connected via `useWalletAuth()` (MiniKit `walletAuth` command)
4. Protected routes in `app/home/` and `app/marriage/` redirect to `/` if not verified
5. `WorldAppChecker` component prompts redirect to World App if MiniKit is unavailable

### Key Directories
- `app/components/marriage/` — all marriage-flow UI components (create/accept proposal, dashboard, NFT display)
- `lib/hooks/` — contract data hooks (`useProposals`, `useMarriageDetails`, `useVowNFT`, `useMilestoneNFTs`)
- `lib/worldcoin/` — World ID + wallet integration hooks
- `lib/wagmi/` — wagmi config and Worldchain network definition
- `components/ui/` — shadcn/ui base components (Button, Dialog, Input)

### Path Alias
`@/*` maps to the project root. Use `@/lib/...`, `@/app/...`, `@/components/...`, etc.
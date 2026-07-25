# HumanBond — Session Handoff

**Date:** 2026-07-25
**Scope of this session:** V5 redesign — mandatory-ish shared wallet, ENS subnames, re-bond
bug fixes, full mainnet redeploy, and the frontend wiring (multisig + ENS naming). Next up:
World ID verification tiers.

This file is the portable summary. Deep design lives in [`docs/v5/`](./docs/v5/README.md); deployed
addresses in [`contracts/DEPLOYMENT-v5.md`](./contracts/DEPLOYMENT-v5.md).

---

## 1. What is live on Worldchain (V5, deployed 2026-07-24)

All verified on-chain. Production app_id `app_bfc3261816aeadc589f9c6f80a98f5df`, actions
`propose-bond` / `accept-bond` (nullifiers checked against this app_id — they match).

| Contract | Address |
|---|---|
| HumanBond (proxy) | `0x7822e66B3597424424AA62d765E29eC89b9fD541` |
| BondNFT | `0x95deecB32F60B8b5BE45cd9F2c3D44ED8579Ad3e` |
| MilestoneNFT | `0xe308AdC4bb0a39A6266D79f25Ac0BCbDA252cDBE` |
| TimeToken | `0x8d292a670a41923CE99Ac9bc11EF8FFB87a04E84` |
| BondVaultModule | `0xb94d2178c6530899a9b275A2b1F9663d4B4F2d65` |
| ModuleSetup | `0x0786ab6d36308d1E2f456ee9fb3Cf42b4cc27349` |
| HumanBondRegistrar (ENS) | `0xEea00940991d31b7a39c0A24BD8fcf259aAC839A` |
| Durin L2Registry (`humanbond.eth`) | `0x3DbB5CE73f3C1cb63D61A6Db73668D4cE10f371B` |

Owner of HumanBond + registry: deployer EOA `0xa4adD6FC2CcCE9aED19C5b38Dc08C01174C45ce4`.

Developer Portal is set: entrypoints (proxy, module, registrar, SafeProxyFactory) + USDC as a
Permit2 token; app switched to production.

---

## 2. What was done this session

**Contracts** (`contracts/`, 212 tests passing + fork tests against real Safe & real Durin):
- Shared wallet layer (`BondVaultModule`, `ModuleSetup`) — moved into git, deployed.
- ENS registrar (`HumanBondRegistrar`) — deployed, authorised on the real registry (`addRegistrar`).
- **Two re-bond defects fixed** (both were live on V4): CREATE2 salt collision and silent
  split-failure. See [`docs/v5/06-known-defects.md`](./docs/v5/06-known-defects.md).
- Fork tests prove ENS `register()` mints a real subname against the real Durin bytecode, and the
  `ModuleSetup` delegatecall doesn't corrupt a real Safe.

**Frontend** (`miniapp/`, builds clean):
- Contract addresses → V5, app_id → production.
- ENS naming at wallet creation: label input + live availability, `register()` as the 3rd batch
  call, name shown on the vault card. Mockable locally.
- Files: `lib/contracts/registrar.ts`, `lib/ens/label.ts`, `lib/hooks/useEnsAvailability.ts`, plus
  edits to `createVault.ts`, `CreateVaultOnboarding.tsx`, `VaultBalanceCard.tsx`, `useBondVault.ts`,
  `useVaultActions.ts`, `vaultStore.ts`.

**ENS infra** (one-time, done): `humanbond.eth` on mainnet → Durin L2Registry on Worldchain →
L1↔L2 bridge wired and verified. See [`docs/ens/ENS-stages.md`](./docs/ens/ENS-stages.md).

---

## 3. The identity model — DECISION CONFIRMED

Three World ID credentials, three jobs. Full spec: [`docs/v5/02-identity-model.md`](./docs/v5/02-identity-model.md).

| Credential | Tier | What it unlocks |
|---|---|---|
| **Selfie Check** (`selfieCheckLegacy`) | lowest, beta | **create a bond + do the 90-day life proof.** Nothing financial. |
| **Orb** (`proofOfHuman`) | high | everything above **+ the shared wallet + ENS name** |
| **Identity Check** (`identityCheck`) | document-backed | same as Orb for wallet — via a `minimum_age: 18` attestation |

**The rule (confirmed by the team):**
- To **create a bond** and keep it alive (life proof): Selfie Check is enough.
- To **create the shared wallet**: the partner needs **Orb OR Identity Check (18+)** — because the
  wallet is a financial instrument and needs legal majority. Required from **both** partners.
- TIME stays personal (minted to each partner), no liquidity — decided, no change to `TimeToken`.

Why age is justified and how we minimise data (only `minimum_age: 18`, never a birthdate or
document number): [`docs/v5/02-identity-model.md`](./docs/v5/02-identity-model.md#why-minimum_age-is-necessary-here--and-how-we-minimise-data).

---

## 4. NEXT: World ID verification tiers (the current task)

Goal: implement the tier gating above. The contract-side plan is in
[`docs/v5/05-contract-changes.md`](./docs/v5/05-contract-changes.md) (`CredentialRegistry` +
`ICredentialVerifier` seam) and life proof in [`docs/v5/03-life-proof.md`](./docs/v5/03-life-proof.md).

### 🚨 The one question that decides the architecture — ask World on day one

**Can Selfie Check and Identity Check proofs be verified ON-CHAIN, or only via the cloud API?**
See [`docs/v5/07-open-questions.md#q0`](./docs/v5/07-open-questions.md). Not answerable from public
docs. Two outcomes, both survivable if built behind the `ICredentialVerifier` interface:

- **On-chain** → verify inside the contract like Orb is today. Trustless, no new infra.
- **Cloud-only** → we need a backend **attester** signing EIP-712 attestations the contract checks.
  This introduces a trusted server into a protocol that currently has none — must be disclosed, not
  buried.

Relevant credential identifiers (from `docs.world.org/world-id/idkit/credentials`): `proofOfHuman`,
`passport`, `selfieCheckLegacy`, `identityCheck`. Identity Check attributes available:
`document_type`, `document_number`, `issuing_country`, `full_name`, `minimum_age`, `nationality` —
**we request only `minimum_age`**. The NFC/document credential (id `9303`) is the underlying
document rail: https://docs.world.org/world-id/credentials/9303.

### Build order (recommended)
1. `CredentialRegistry` (per-address: `orbVerified`, `ageVerifiedUntil`, `lifeProofUntil`) behind
   the swappable verifier. This is the piece everything else reads.
2. Gate `registerVault` on `hasStrongCredential(both partners)` — **on-chain**, not client-side.
3. Life proof: 90-day `lifeProofUntil`, dormancy pauses TIME yield, dissolution **never** gated.
4. Frontend: tier states, the "your partner needs to verify" invite moment, life-proof reminders.

### Still-open product decisions (in `07-open-questions.md`)
- Q2 survivorship (what happens to the vault if a partner never returns) — the most compelling and
  most dangerous piece.
- Q8 dormant yield forfeited vs retroactive · Q9 freeze vault spends when a partner lapses.
- Q12 where user-feedback data lives (both beta tracks REQUIRE documented user + dev feedback).

---

## 5. How to run

**Contracts** (`contracts/`):
```bash
forge test                              # 212 unit tests
forge test --fork-url $WORLDCHAIN_RPC \ # fork tests (real Safe + real Durin)
  --match-path "test/{vault,ens}/*ForkIntegration*.t.sol"
```
Deps are restored with `forge install` (lib/ is gitignored — not committed).

**Frontend** (`miniapp/`):
```bash
npm install                             # node_modules was broken; reinstall from scratch
NEXT_PUBLIC_USE_MOCKS=1 npm run dev      # mock mode: skip World ID, floating panel → Vault tab
```
In mock mode, the Vault tab → "Volver a onboarding" lets you test ENS naming: try `franco-maria`
(available), `taken` (rejected), empty (wallet without a name).

---

## 6. Repo layout & git notes

`Human-Bond` (this repo, `herbstephens/Human-Bond`) vendors two nested repos as plain trees:
- `contracts/` == `leticarolina/worldid-humanbond-protocol`
- `miniapp/` == `FrancoAmicone/marriageDao`

You can commit at the parent (competition repo) or in the nested repos. `.gitignore` now excludes
`contracts/lib`, `out`, `cache`, `miniapp/node_modules`, `.next`, and secrets — an earlier
`git add contracts/` had wrongly committed forge libs as empty gitlinks (fixed).

**Never commit:** `contracts/.env`, any `signing-key-*.json` (a private key file exists locally,
gitignored — rotate it if it was ever shared).

---

## 7. Resuming the working session

This conversation is scoped to the `HumanBond - Multisig working` directory. To reopen it, run
`claude --continue` (or `--resume`) **from that directory** — not from here. From this repo, Claude
starts fresh; this file is the bridge.

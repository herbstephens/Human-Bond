# HumanBond V5 — Deployment (Worldchain mainnet, chain 480)

**Date:** 2026-07-24
**Deployer / owner:** `0xa4adD6FC2CcCE9aED19C5b38Dc08C01174C45ce4`
**App ID (production):** `app_bfc3261816aeadc589f9c6f80a98f5df` — actions `propose-bond`, `accept-bond`

## Protocol

| Contract | Address |
|---|---|
| **HumanBond (proxy)** | `0x7822e66B3597424424AA62d765E29eC89b9fD541` |
| HumanBond (impl) | same tx — behind proxy, do not call directly |
| BondNFT | `0x95deecB32F60B8b5BE45cd9F2c3D44ED8579Ad3e` |
| MilestoneNFT | `0xe308AdC4bb0a39A6266D79f25Ac0BCbDA252cDBE` |
| TimeToken | `0x8d292a670a41923CE99Ac9bc11EF8FFB87a04E84` |

## Vault (Safe multisig)

| Contract | Address |
|---|---|
| **BondVaultModule** | `0xb94d2178c6530899a9b275A2b1F9663d4B4F2d65` |
| ModuleSetup | `0x0786ab6d36308d1E2f456ee9fb3Cf42b4cc27349` |

## ENS

| Contract | Address |
|---|---|
| **HumanBondRegistrar** | `0xEea00940991d31b7a39c0A24BD8fcf259aAC839A` |
| L2Registry (Durin) | `0x3DbB5CE73f3C1cb63D61A6Db73668D4cE10f371B` |
| L1Resolver (Durin) | `0x8A968aB9eb8C084FBC44c531058Fc9ef945c3D61` |

## External (already on-chain)

| Contract | Address |
|---|---|
| World ID Router | `0x17B354dD2595411ff79041f930e491A4Df39A278` |
| USDC | `0x79A02482A880bCE3F13e09Da970dC34db4CD24d1` |
| SafeProxyFactory v1.4.1 | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67` |
| Safe singleton v1.4.1 | `0x41675C099F32341bf84BFc5382aF534df5C7461a` |
| CompatibilityFallbackHandler | `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99` |

## Verified on-chain

- ✅ `externalNullifierPropose` / `externalNullifierAccept` match the production app_id derivation
- ✅ `proxy.bondVaultModule` → module; `module.humanBond` → proxy; `module.token` → USDC
- ✅ `registrar.baseNode` → namehash("humanbond.eth") (reads the real Durin registry)
- ✅ `registry.registrars(registrar)` == true (addRegistrar done)
- ✅ ENS L1→L2 bridge: resolver → Durin L1Resolver, l2Registry → (480, registry)

## Still to verify

- ✅ **ENS `register()` against the REAL Durin registry** — proven on a Worldchain fork:
  `test/ens/RegistrarForkIntegration.t.sol` (3 tests). A real subname mints, is owned by the Safe,
  resolves to the vault, and all 9 resolver records land. Closes the createSubnode / interface /
  Safe-receives-NFT risks.
- ⏳ An actual mainnet mint through the app (two World ID verified users bond → create vault →
  `register()` runs as the 3rd batch call). This is the demo path; the contract behaviour above is
  already proven on real bytecode.
- ⏳ `ModuleSetup` fork test against the deployed bytecode (existing `VaultForkIntegration.t.sol`,
  run with `--fork-url`).

## Pending (not contract work)

- Developer Portal: switch app to these contracts; whitelist entrypoints (proxy, module,
  registrar, SafeProxyFactory) + USDC as Permit2 token; confirm actions `propose-bond`/`accept-bond`.
- Frontend: new addresses into `miniapp/lib/contracts/index.ts` + `vault.ts`.

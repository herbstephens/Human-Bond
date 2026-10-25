# HumanBond on Stellar — HackMeridian Lisbon 2026

**Path:** Genesis (Prototype → Product) · **Event:** 25–26 Oct 2026, Warehouse ONE16, Lisbon
**Status:** working on Stellar **testnet**. Contract not audited. Details on what is real and what is not are at the end.

> **A couple's shared money, with rules both of them wrote — now on Stellar.**
> Small things, either of you. Big things, both of you. If it ends, half each.

---

## The problem

When two people share a life, their money lives in systems that don't know the relationship exists: two separate accounts, or one joint account where either person can empty it. Nothing in between. The partner who does the unpaid work — care, the home — has no standing in either.

## What HumanBond is (before this weekend)

A proof-of-humanity partnership protocol, **live on World Chain mainnet** and in the World App store. Two World ID–verified humans form an on-chain bond. Each bond gets a **shared wallet** (a 2-of-2 Safe plus our `BondVaultModule`) and an ENS name like `alice-ben.humanbond.eth`:

- either partner can spend **small** amounts alone (≤ 10 USDC, max 25 USDC per rolling 24h, shared)
- anything larger needs **both** partners
- if the bond is dissolved, the wallet **splits 50/50**

## What we built at HackMeridian

We brought the shared wallet to Stellar, with the same rules, as a Soroban contract.

| | Built this weekend |
|---|---|
| **BondVault** Soroban contract | One instance per bond. Same rules as the EVM module: solo small spends inside a rolling daily budget, two-partner approval above it, cancel by either, dissolution with a 3-day delay then a permissionless 50/50 split. 9 unit tests. |
| **Pay page** `/pay/<label>` | Anyone pays the couple's vault. Has USDC → one transfer. Has XLM or another asset → Stellar's built-in exchange converts to the exact USDC amount, then transfers. |
| **Vault page** `/stellar/<label>` | Partners spend, approve, decline, request or cancel dissolution, and split, with any Stellar wallet (Stellar Wallets Kit: Freighter, xBull, Lobstr, Albedo…). |
| **Create page** `/stellar` | Reads the real bond from World Chain (Safe address, ENS label) and deploys the couple's vault with that link baked into the contract. |
| **World App card** on `/vault` | Read-only view of the Stellar vault inside the existing mini app: balance, today's budget, pending approvals, pay link. |
| **Name → vault trust** | A name only resolves to a vault if World Chain points back (ENS text record `com.humanbond.stellar`, plus the vault's stored Safe must match). Stops squatters from catching a couple's payments. |
| **Testnet scripts** | `stellar:smoke` runs the whole lifecycle headless; `stellar:demo-seed` creates a live demo vault. |

```mermaid
flowchart LR
    subgraph WC[World Chain · live]
        B[HumanBond<br/>World ID bond] --> S[Shared Safe<br/>+ BondVaultModule]
        S --> E[alice-ben.humanbond.eth]
    end
    subgraph ST[Stellar · this weekend]
        V[(BondVault<br/>Soroban contract)]
    end
    E -.->|text record com.humanbond.stellar| V
    V -.->|stores bondId · Safe · label| S
    P[Payer · any Stellar wallet] -->|USDC, or XLM → USDC via path payment| V
    V -->|≤10 alone · more with both| R[Recipients]
    V ==>|dissolution: 3-day delay → 50/50| AB[Partner A · Partner B]
    MA[World App mini app] -->|read-only card| V
```

## How it works — the contract spec

`contracts-stellar/contracts/bond-vault/src/lib.rs`

| Function | Who | What |
|---|---|---|
| `__constructor(partner_a, partner_b, token, bond_id, safe, label, small_spend_threshold, daily_free_limit, dissolution_delay)` | deployer | Bounds: threshold ≤ 100 USDC, daily ≤ 250 USDC (the EVM module's hard caps), delay 1 s – 30 days, partners distinct. Immutable after. |
| `propose_spend(proposer, to, amount)` | a partner | Executes immediately if `amount ≤ threshold` and fits the rolling 24h budget (shared by both). Otherwise pending, proposer's approval recorded. |
| `approve_spend(approver, id)` | the other partner | Executes when both approved. Proposer cannot approve twice. Blocked after dissolution. |
| `cancel_spend(caller, id)` | either partner | "No, and stop asking." |
| `request_dissolution(requester)` | a partner | Starts the delay. Spending still works meanwhile, as on World Chain. |
| `cancel_dissolution(requester)` | requester only | Only while the delay runs. After it, the outcome is fixed. |
| `execute_dissolution()` | **anyone** | After the delay: splits the balance 50/50 (odd unit to B), closes the vault. Callable again later to split late arrivals, so money is never trapped. |
| `config / balance / remaining_free_allowance / get_spend / spend_count / dissolution / is_dissolved` | anyone | Views. |

Paying in needs no contract function: it is a plain transfer on the USDC Stellar Asset Contract to the vault's address.

### Stellar features used

- **Soroban** contract with constructor, `require_auth`, typed errors and events
- **Stellar Asset Contract** for USDC (Circle) held by a contract
- **Path payments** (strict receive) through the built-in DEX / AMM pools: pay in XLM, the couple receives exact USDC
- **Stellar RPC** simulation and assembly; **Horizon** for classic paths and balances
- **Stellar Wallets Kit** for multi-wallet signing

## Try it (testnet)

| | |
|---|---|
| Vault wasm (testnet) | `0fb2bb5f4d3d97dab6430f2ed413b098f3b555e8b328a2982d550ff6b743a017` |
| Demo vault `demo-bond` | `CDOIEH5GDUUDWZ4DEA7PENDNC4UVBYFN6P2HOQIQ4QYFBT6STRH3TGYV` |
| Full lifecycle run (example) | vault `CCEWJLTWEOM6Y2RPTKX232KZHASVLH56BD6USTOWLNY46JIXQYGXS53E` on [stellar.expert](https://stellar.expert/explorer/testnet/contract/CCEWJLTWEOM6Y2RPTKX232KZHASVLH56BD6USTOWLNY46JIXQYGXS53E) |

```bash
# contract
cd contracts-stellar && cargo test && stellar contract build

# app (testnet is the default)
cd miniapp && npm install
STELLAR_TESTNET_DIRECTORY=demo-bond=<vault id> npm run dev   # then /pay/demo-bond, /stellar/demo-bond

# end-to-end on testnet, headless: deploy → pay in from XLM → solo spend → approved spend
# → over-budget spend held and cancelled → dissolution delay → 50/50 split
npm run stellar:smoke synthetic

# seed a live demo vault and print throwaway testnet keys for Freighter
npm run stellar:demo-seed demo-bond
```

## Honest status

**Real and tested on testnet:** the contract and every rule above (unit tests + the smoke run), deploying a vault, paying in with USDC or XLM, spending, approving, cancelling, dissolution and the split, the API route and the World App card (rendered against a live testnet vault).

**Not done or not verified:**

- **Not audited.** Testnet only. Do not hold real value in it.
- **Wallet signing in the browser pages** has been built but not yet clicked through with Freighter; the same transactions are signed and submitted headless in the smoke test.
- **The ENS proof is read but not yet written.** Setting the `com.humanbond.stellar` text record needs a Safe transaction signed by both partners, which isn't built. Until then, names resolve through a testnet-only allowlist, and the pages say so.
- **Dissolution is not synced with World Chain.** A Stellar contract can't see World Chain; the vault runs its own request → delay → split. A relay is roadmap.
- **No contract-side TTL extension.** Extending storage from inside each call cost thousands of XLM in rent on testnet. Vault state lives the network default (~7 days on testnet today) and then must be restored through RPC; funds are never lost, but the app doesn't automate the restore yet.
- **Recipients need a USDC trustline** — a shop being paid, and both partners for their half.
- **No federation address or SEP-7 pay link**: classic payments can't target a contract address, so payers use the pay page.
- **Partner B is set by the deployer** without B signing on Stellar.

## Built during the event

Branch `feat/stellar-joint-wallet`, from `main` at `e75207a`:

| Commit | |
|---|---|
| `629da74` | first version: 2-of-2 classic joint account, federation |
| `90dbf8f` | pay page, SEP-7, path payments |
| `8f34db2` | **Soroban BondVault** replacing the joint account, matching the EVM rules |
| `efb2500` | World App card, demo seed |

(A pull-based claims variant with claimable balances and a survivor clause was built and tested, then parked on `feat/stellar-claims-survivor` in favour of matching the live EVM behaviour.)

## Roadmap

1. Write the ENS text record from the Safe (both partners sign in World App) and drop the allowlist.
2. Relay World Chain dissolution to the Stellar vault.
3. Automate archived-state restore in the app.
4. Mainnet, after an audit.

## Team

Herb Stephens — lead, protocol, pitch. *[add the HackMeridian team members before submitting]*

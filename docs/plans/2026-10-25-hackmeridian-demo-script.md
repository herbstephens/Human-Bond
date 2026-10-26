---
date: 2026-10-25
topic: demo-script
event: HackMeridian Lisbon (Genesis path — Stellar Unlocked + Stellar Composed)
status: v1 draft — not yet rehearsed or timed
input: HACKMERIDIAN.md
---

# HumanBond on Stellar — Demo Video Script

**Target length:** about 2:50. Judging is async from the video, deck, repo and answers, so the video must stand on its own.

**The one sentence:** *Small things, either of you. Big things, both of you. If it ends, half each — now on Stellar.*

**What the video must prove, in judging order (Genesis):**
1. Track alignment (20%): **Unlocked** — the built-in exchange converts XLM to exact USDC, native USDC via the Stellar Asset Contract, Soroban multi-party auth; **Composed** — Soroban + Circle USDC + Stellar Wallets Kit + RPC/Horizon, linked to World ID and ENS. Say both track names out loud.
2. Problem clarity (User Value 20%): shared lives, separate money; nothing that executes a couple's will.
3. MVP quality (Technical Execution 15%): real testnet transactions on screen; 20 tests; a one-command lifecycle run.
4. Continued development: honest about what is next (World ID check-ins, ENS link from the Safe, audit).

Framing: the Stellar vault, the pay flow and inheritance are the MVP built at this event; HumanBond's existing World Chain app supplies the bond (who the couple is). Don't present the World Chain app as weekend work.

## Before recording

1. `cd miniapp && npm run stellar:demo-seed demo-bond` → note the vault id and both partners' **testnet** secret keys.
2. Import partner A and partner B into Freighter (network: **Testnet**), as two accounts.
3. Start the app with the vault on the allowlist, on a public HTTPS URL (Vercel preview or ngrok):
   `STELLAR_TESTNET_DIRECTORY=demo-bond=<vault id> npm run dev`
4. A third Freighter account with testnet XLM only (no USDC) to play the payer. Fund it with Friendbot.
5. Tabs ready: `/pay/demo-bond`, `/stellar/demo-bond`, stellar.expert on the vault contract, World App on the phone (or the mini app in the simulator) on `/vault`.
6. Rehearse once: every wallet popup costs seconds. Cut the waits in editing.

## Act 1 · The problem (0:00–0:20)

**On screen:** two hands, one phone. Then the HumanBond mini app home in World App.

**Voice:**
> When two people share a life, their money lives in systems that don't know the relationship exists. Two separate accounts. Or one joint account where either of you can empty it. Nothing in between.
> HumanBond is in between. It's live today on World Chain: two verified humans form a bond, and the bond gets a shared wallet with rules.

## Act 2 · The rules (0:20–0:40)

**On screen:** `/vault` in World App — the World Chain wallet card, scroll to the **Stellar vault** card (balance, "Today without approval", "1 spend is waiting").

**Voice:**
> Small things, either of you: up to ten dollars, alone. Big things, both of you. And if the bond ends, the money splits fifty-fifty — no lawyers.
> This weekend we brought that wallet to Stellar. Same rules, enforced by a Soroban contract. Here it is inside World App.

## Act 3 · Anyone can pay the couple (0:40–1:15)

**On screen:** `/pay/demo-bond` on desktop. Enter **20 USDC**. Connect the payer wallet (XLM only). "Find rate" → "45.xx XLM, via 1 hop" → Pay → two Freighter popups (convert, then send) → "Paid". Cut to stellar.expert showing the transfer into the contract.

**Voice:**
> A friend wants to send the couple twenty dollars. She only holds XLM.
> Stellar's built-in exchange converts it on the way — she pays forty-something XLM, the couple receives exactly twenty USDC. No bridge, no swap app.
> The vault is a contract address. Anyone can pay it; nobody can take from it alone.

## Act 4 · Spending together (1:15–1:50)

**On screen:** `/stellar/demo-bond` as **partner A**: send 5 USDC to a shop → "Goes through now, on your signature alone" → executes. Then ask for 40 → "Needs your partner to approve" → pending. Switch Freighter to **partner B** → Approve → executed. History updates.

**Voice:**
> Alex buys groceries: five dollars, his signature alone. Done.
> Forty dollars for a new chair is different. It waits — until Sam approves from her own wallet.
> The rolling daily budget is shared, so ten small payments can't get around the rule.

## Act 5 · If it ends (1:50–2:10)

**On screen:** "Request dissolution" as partner A → banner "It can be executed from <date>". Cut to a pre-recorded vault with a 30-second delay (from `npm run stellar:smoke synthetic`): "Close and split 50/50" → the Halves list shows 14.50 / 14.50 → each partner claims.

**Voice:**
> If the relationship ends, either partner can start a dissolution. Three days to change your mind. Then anyone can finish it: each half is set aside, and each of you takes your own. One of you can't hold up the other — we tested exactly that.

## Act 6 · When you're gone (2:10–2:35)

**On screen:** `/stellar/demo-bond` → **Proof of life** (both partners, "next check-in by …") and **Will** (70% / 30%, the second share "from" a date a year out). Then terminal clips from the smoke run's inheritance phase: `veto  lapse reported for A, cancelled by A checking in` → `death  A confirmed` → `survivor  B spent 15 USDC alone` → `estate  booked 3 · 2` → `heirs  minor refused (locked)` → `minor claimed 2 after the unlock date`.

**Voice:**
> And when you're gone, the will you wrote together runs itself. Every action you take proves you're alive. Go silent for ninety days and anyone can report it — then thirty days to answer. The survivor keeps everything, and the will can no longer be changed. When the second partner dies, the heirs claim — a child's share waits until its date. Heirs inherit claims, not keys.

## Act 7 · What's real, what's next (2:35–2:50)

**On screen:** `HACKMERIDIAN.md` "Track alignment" table, then "Honest status", then the repo.

**Voice:**
> Built this weekend for Stellar Unlocked and Stellar Composed: native USDC, the built-in exchange, Soroban multi-party signatures, Wallets Kit. All on testnet, with tests. Next: World ID check-ins as proof of life, the vault written into the couple's ENS name, an audit, then mainnet.
> HumanBond. Shared money, with rules both of you wrote.

## Notes for editing

- Do not claim mainnet, audited, or "automatic sync with World Chain". See the honest status list in `HACKMERIDIAN.md`.
- Acts 5 and 6 use different vaults (short delays, from the smoke run) than the rest. Say "here's one we ran earlier" or show them as cuts, so they aren't presented as the same vault.
- Act 6: don't say "World ID proves you're alive" — today check-ins are wallet signatures; World ID is the next step. Don't call it a legal will.
- The pay page shows "Testnet allowlist — not yet verified through ENS". Leave it in shot; it's honest and judges will look.
- Names in the voice-over ("Alex", "Sam") are personas, not real users.

---
date: 2026-10-25
topic: demo-script
event: HackMeridian Lisbon (Scale path)
status: v1 draft — not yet rehearsed or timed
input: HACKMERIDIAN.md
---

# HumanBond on Stellar — Demo Video Script

**Target length:** about 2:30. Judging is async from the video, deck, repo and answers, so the video must stand on its own.

**The one sentence:** *Small things, either of you. Big things, both of you. If it ends, half each — now on Stellar.*

**What the video must prove, in judging order:**
1. A real problem and a product that already exists (User Value 20%).
2. It is *Stellar-native*, not a port in name only: Soroban contract, Stellar Asset Contract, path payments through the built-in exchange (Ecosystem Alignment 20%).
3. It works — real testnet transactions on screen (Technical Execution 15%).
4. Honest about what is next (Production readiness for Scale).

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

## Act 5 · If it ends (1:50–2:15)

**On screen:** "Request dissolution" as partner A → banner "It can be executed from <date>". Cut to a pre-recorded vault with a 30-second delay (from `npm run stellar:smoke synthetic`) showing "Split 50/50" → 14.50 / 14.50 on stellar.expert.

**Voice:**
> If the relationship ends, either partner can start a dissolution. Three days to change your mind. Then anyone can finish it, and the vault splits exactly in half. Nobody can stall it, and nobody can run off with it.

## Act 6 · What's real, what's next (2:15–2:30)

**On screen:** `HACKMERIDIAN.md` "Honest status" section, then the repo.

**Voice:**
> All of this runs on Stellar testnet today, with tests. Next: write the vault into the couple's ENS name from their Safe, relay dissolutions from World Chain, an audit, then mainnet.
> HumanBond. Shared money, with rules both of you wrote.

## Notes for editing

- Do not claim mainnet, audited, or "automatic sync with World Chain". See the honest status list in `HACKMERIDIAN.md`.
- Act 5 uses a different vault (30-second delay) than the rest. Say "here's one we ended earlier" or show it as a cut, so it isn't presented as the same vault.
- The pay page shows "Testnet allowlist — not yet verified through ENS". Leave it in shot; it's honest and judges will look.
- Names in the voice-over ("Alex", "Sam") are personas, not real users.

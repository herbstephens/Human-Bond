# contracts-stellar — the bond vault on Stellar

`contracts/bond-vault` is a Soroban contract: the couple's shared USDC vault on Stellar, one instance per bond. It follows the same rules as the EVM `BondVaultModule` (`../contracts/src/vault/BondVaultModule.sol`):

| Rule | EVM module | Stellar vault |
|---|---|---|
| Small spend, one partner alone | ≤ threshold and within a rolling 24h budget shared by both | same |
| Larger spend | proposed by one, executes on the other's approval | same |
| Cancel a pending spend | either partner | same |
| Limits | owner-tunable within 100 / 250 USDC hard caps | set once at creation, same caps, no owner |
| Dissolution | HumanBond: request → 3-day delay (cancellable) → anyone executes → 50/50, odd unit to B (try/catch so it can't be blocked) | same request → delay → anyone executes, enforced locally; the split is **pull-based**: each half is booked, then paid out on its own (`claim_share`), so one partner who can't receive never blocks the other |
| Other tokens sent by mistake | the 2-of-2 Safe can move anything | `rescue(token, to, amount)` with both partners' signatures; refuses USDC |

Its contract address is the couple's receiving address: anyone pays in with a USDC transfer on the USDC token contract.

## Known limitations (honest list)

- **Dissolution is not synced with World Chain.** A Stellar contract cannot read World Chain, so dissolving the bond there does not dissolve this vault. Planned: a relay. Today the vault runs its own request → delay → split.
- **Classic payments cannot target a contract**, so there is no federation address or SEP-7 `pay` link for the vault. A payer without USDC converts first (path payment to themselves), then transfers: two signatures.
- **Recipients need a USDC trustline**: a shop being paid, and each partner to claim their half at dissolution (a partner without one only delays their own half).
- **No TTL extension in the contract.** Extending entries from inside each call cost thousands of XLM in rent on testnet. Entries live for the network default (~7 days on testnet today); after that the vault must be restored through RPC before use. Funds are never lost. The app does not run the restore step yet.
- **Partner B is set by whoever deploys the vault**, without B signing. B can't lose anything by it, but B also didn't consent on-chain.
- **Not audited.**

## Commands

```bash
cargo test                       # 12 unit tests: spend rules, budget, cancel, dissolution, claims, rescue, bounds
stellar contract build           # → target/wasm32v1-none/release/bond_vault.wasm
stellar contract upload --wasm target/wasm32v1-none/release/bond_vault.wasm --source <key> --network testnet
```

The uploaded wasm hash goes in `miniapp/lib/stellar/config.ts` (testnet) or `NEXT_PUBLIC_STELLAR_VAULT_WASM_HASH` (mainnet). End-to-end check against testnet: `cd ../miniapp && npm run stellar:smoke synthetic`.

/**
 * Bond Vault (Safe multisig) contract layer.
 *
 * Deployed to Worldchain mainnet 2026-07-20 — see docs/07-deployment.md.
 *
 * The vault is a real Safe Smart Account, one per bond. BondVaultModule is a Safe
 * *module* enabled on it: it can order the Safe to move funds without owner
 * signatures, which is what powers the "small spends go straight through" path.
 * The module never holds funds itself — the money always lives in the couple's Safe.
 */

// Worldchain mainnet (chain 480). Defaults are the LIVE, whitelisted deployment
// (see lib/contracts/index.ts for how they were verified); NEXT_PUBLIC_* still
// overrides. Safe canonical + USDC are the same across every environment.
export const VAULT_ADDRESSES = {
  /** Our Safe module. The only vault contract the mini app calls directly. */
  // The module the LIVE proxy is wired to and the Developer Portal whitelists.
  // Verified on-chain 2026-08-02: humanBond() -> the proxy, token() -> USDC,
  // smallSpendThreshold() = 10 USDC, dailyFreeLimit() = 25 USDC.
  BOND_VAULT_MODULE: (process.env.NEXT_PUBLIC_BOND_VAULT_MODULE ?? '0x86a2b943c17A9d1EA8C86ec45C2e7650BDdE1617') as `0x${string}`,
  /** Delegatecall helper that enables the module during the Safe's setup(). Never called from the app. */
  MODULE_SETUP: (process.env.NEXT_PUBLIC_MODULE_SETUP ?? '0x0786ab6d36308d1E2f456ee9fb3Cf42b4cc27349') as `0x${string}`,
  /** Canonical Safe v1.4.1 deployments (deployed by Safe, not by us). */
  SAFE_PROXY_FACTORY: '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67' as const,
  SAFE_SINGLETON: '0x41675C099F32341bf84BFc5382aF534df5C7461a' as const,
  SAFE_FALLBACK_HANDLER: '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99' as const,
  /** USDC on Worldchain. Reports symbol "USDC" on-chain (explorers label it USDC.e). */
  USDC: '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1' as const,
} as const

/** USDC has 6 decimals, so $10 is exactly 10_000_000 — no oracle needed. */
export const USDC_DECIMALS = 6

/**
 * Spend rules, mirroring the values set on-chain at deploy time.
 *
 * These are display/preview values only — the contract is the authority and
 * useBondVault() reads the live ones. They exist so the UI can explain the rules
 * before any contract read resolves.
 */
export const VAULT_RULES = {
  /** At or below this, a spend executes immediately with one partner. */
  SMALL_SPEND_THRESHOLD: BigInt(10_000_000), // 10 USDC
  /** Shared cap on those unilateral spends, per bond, per rolling 24h. */
  DAILY_FREE_LIMIT: BigInt(25_000_000), // 25 USDC
  FREE_WINDOW_SECONDS: 86_400,
} as const

export const BOND_VAULT_MODULE_ABI = [
  {"type": "constructor", "inputs": [{"name": "_humanBond", "type": "address", "internalType": "address"}, {"name": "_token", "type": "address", "internalType": "address"}, {"name": "_smallSpendThreshold", "type": "uint256", "internalType": "uint256"}, {"name": "_dailyFreeLimit", "type": "uint256", "internalType": "uint256"}], "stateMutability": "nonpayable"},
  {"type": "function", "name": "FREE_WINDOW", "inputs": [], "outputs": [{"name": "", "type": "uint256", "internalType": "uint256"}], "stateMutability": "view"},
  {"type": "function", "name": "MAX_DAILY_FREE_LIMIT", "inputs": [], "outputs": [{"name": "", "type": "uint256", "internalType": "uint256"}], "stateMutability": "view"},
  {"type": "function", "name": "MAX_SMALL_SPEND_THRESHOLD", "inputs": [], "outputs": [{"name": "", "type": "uint256", "internalType": "uint256"}], "stateMutability": "view"},
  {"type": "function", "name": "approveSpend", "inputs": [{"name": "spendId", "type": "bytes32", "internalType": "bytes32"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "approvedBy", "inputs": [{"name": "", "type": "bytes32", "internalType": "bytes32"}, {"name": "", "type": "address", "internalType": "address"}], "outputs": [{"name": "", "type": "bool", "internalType": "bool"}], "stateMutability": "view"},
  {"type": "function", "name": "bondOfVault", "inputs": [{"name": "", "type": "address", "internalType": "address"}], "outputs": [{"name": "", "type": "bytes32", "internalType": "bytes32"}], "stateMutability": "view"},
  {"type": "function", "name": "cancelSpend", "inputs": [{"name": "spendId", "type": "bytes32", "internalType": "bytes32"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "dailyFreeLimit", "inputs": [], "outputs": [{"name": "", "type": "uint256", "internalType": "uint256"}], "stateMutability": "view"},
  {"type": "function", "name": "freeWindowOf", "inputs": [{"name": "", "type": "bytes32", "internalType": "bytes32"}], "outputs": [{"name": "windowStart", "type": "uint64", "internalType": "uint64"}, {"name": "spent", "type": "uint256", "internalType": "uint256"}], "stateMutability": "view"},
  {"type": "function", "name": "getSpend", "inputs": [{"name": "spendId", "type": "bytes32", "internalType": "bytes32"}], "outputs": [{"name": "", "type": "tuple", "internalType": "struct BondVaultModule.Spend", "components": [{"name": "bondId", "type": "bytes32", "internalType": "bytes32"}, {"name": "to", "type": "address", "internalType": "address"}, {"name": "amount", "type": "uint256", "internalType": "uint256"}, {"name": "proposer", "type": "address", "internalType": "address"}, {"name": "createdAt", "type": "uint64", "internalType": "uint64"}, {"name": "executed", "type": "bool", "internalType": "bool"}, {"name": "cancelled", "type": "bool", "internalType": "bool"}]}], "stateMutability": "view"},
  {"type": "function", "name": "humanBond", "inputs": [], "outputs": [{"name": "", "type": "address", "internalType": "contract IHumanBond"}], "stateMutability": "view"},
  {"type": "function", "name": "owner", "inputs": [], "outputs": [{"name": "", "type": "address", "internalType": "address"}], "stateMutability": "view"},
  {"type": "function", "name": "proposeSpend", "inputs": [{"name": "to", "type": "address", "internalType": "address"}, {"name": "amount", "type": "uint256", "internalType": "uint256"}], "outputs": [{"name": "spendId", "type": "bytes32", "internalType": "bytes32"}], "stateMutability": "nonpayable"},
  {"type": "function", "name": "registerVault", "inputs": [{"name": "bondId", "type": "bytes32", "internalType": "bytes32"}, {"name": "safe", "type": "address", "internalType": "address"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "remainingFreeAllowance", "inputs": [{"name": "bondId", "type": "bytes32", "internalType": "bytes32"}], "outputs": [{"name": "", "type": "uint256", "internalType": "uint256"}], "stateMutability": "view"},
  {"type": "function", "name": "renounceOwnership", "inputs": [], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "setDailyFreeLimit", "inputs": [{"name": "v", "type": "uint256", "internalType": "uint256"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "setSmallSpendThreshold", "inputs": [{"name": "v", "type": "uint256", "internalType": "uint256"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "settleAndSplit", "inputs": [{"name": "bondId", "type": "bytes32", "internalType": "bytes32"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "settled", "inputs": [{"name": "", "type": "bytes32", "internalType": "bytes32"}], "outputs": [{"name": "", "type": "bool", "internalType": "bool"}], "stateMutability": "view"},
  {"type": "function", "name": "smallSpendThreshold", "inputs": [], "outputs": [{"name": "", "type": "uint256", "internalType": "uint256"}], "stateMutability": "view"},
  {"type": "function", "name": "spendNonce", "inputs": [{"name": "", "type": "bytes32", "internalType": "bytes32"}], "outputs": [{"name": "", "type": "uint256", "internalType": "uint256"}], "stateMutability": "view"},
  {"type": "function", "name": "spends", "inputs": [{"name": "", "type": "bytes32", "internalType": "bytes32"}], "outputs": [{"name": "bondId", "type": "bytes32", "internalType": "bytes32"}, {"name": "to", "type": "address", "internalType": "address"}, {"name": "amount", "type": "uint256", "internalType": "uint256"}, {"name": "proposer", "type": "address", "internalType": "address"}, {"name": "createdAt", "type": "uint64", "internalType": "uint64"}, {"name": "executed", "type": "bool", "internalType": "bool"}, {"name": "cancelled", "type": "bool", "internalType": "bool"}], "stateMutability": "view"},
  {"type": "function", "name": "token", "inputs": [], "outputs": [{"name": "", "type": "address", "internalType": "contract IERC20"}], "stateMutability": "view"},
  {"type": "function", "name": "transferOwnership", "inputs": [{"name": "newOwner", "type": "address", "internalType": "address"}], "outputs": [], "stateMutability": "nonpayable"},
  {"type": "function", "name": "vaultBalance", "inputs": [{"name": "bondId", "type": "bytes32", "internalType": "bytes32"}], "outputs": [{"name": "", "type": "uint256", "internalType": "uint256"}], "stateMutability": "view"},
  {"type": "function", "name": "vaultOf", "inputs": [{"name": "", "type": "bytes32", "internalType": "bytes32"}], "outputs": [{"name": "", "type": "address", "internalType": "address"}], "stateMutability": "view"},
  {"type": "function", "name": "wouldExecuteImmediately", "inputs": [{"name": "bondId", "type": "bytes32", "internalType": "bytes32"}, {"name": "amount", "type": "uint256", "internalType": "uint256"}], "outputs": [{"name": "", "type": "bool", "internalType": "bool"}], "stateMutability": "view"},
  {"type": "event", "name": "DailyFreeLimitUpdated", "inputs": [{"name": "newLimit", "type": "uint256", "indexed": false, "internalType": "uint256"}], "anonymous": false},
  {"type": "event", "name": "OwnershipTransferred", "inputs": [{"name": "previousOwner", "type": "address", "indexed": true, "internalType": "address"}, {"name": "newOwner", "type": "address", "indexed": true, "internalType": "address"}], "anonymous": false},
  {"type": "event", "name": "SmallSpendThresholdUpdated", "inputs": [{"name": "newThreshold", "type": "uint256", "indexed": false, "internalType": "uint256"}], "anonymous": false},
  {"type": "event", "name": "SpendApproved", "inputs": [{"name": "spendId", "type": "bytes32", "indexed": true, "internalType": "bytes32"}, {"name": "approver", "type": "address", "indexed": true, "internalType": "address"}], "anonymous": false},
  {"type": "event", "name": "SpendCancelled", "inputs": [{"name": "spendId", "type": "bytes32", "indexed": true, "internalType": "bytes32"}, {"name": "canceller", "type": "address", "indexed": true, "internalType": "address"}], "anonymous": false},
  {"type": "event", "name": "SpendExecuted", "inputs": [{"name": "spendId", "type": "bytes32", "indexed": true, "internalType": "bytes32"}, {"name": "bondId", "type": "bytes32", "indexed": true, "internalType": "bytes32"}, {"name": "to", "type": "address", "indexed": false, "internalType": "address"}, {"name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256"}, {"name": "wasFreeSpend", "type": "bool", "indexed": false, "internalType": "bool"}], "anonymous": false},
  {"type": "event", "name": "SpendProposed", "inputs": [{"name": "spendId", "type": "bytes32", "indexed": true, "internalType": "bytes32"}, {"name": "bondId", "type": "bytes32", "indexed": true, "internalType": "bytes32"}, {"name": "proposer", "type": "address", "indexed": true, "internalType": "address"}, {"name": "to", "type": "address", "indexed": false, "internalType": "address"}, {"name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256"}], "anonymous": false},
  {"type": "event", "name": "VaultRegistered", "inputs": [{"name": "bondId", "type": "bytes32", "indexed": true, "internalType": "bytes32"}, {"name": "safe", "type": "address", "indexed": true, "internalType": "address"}, {"name": "partnerA", "type": "address", "indexed": false, "internalType": "address"}, {"name": "partnerB", "type": "address", "indexed": false, "internalType": "address"}], "anonymous": false},
  {"type": "event", "name": "VaultSplit", "inputs": [{"name": "bondId", "type": "bytes32", "indexed": true, "internalType": "bytes32"}, {"name": "partnerA", "type": "address", "indexed": false, "internalType": "address"}, {"name": "partnerB", "type": "address", "indexed": false, "internalType": "address"}, {"name": "amountA", "type": "uint256", "indexed": false, "internalType": "uint256"}, {"name": "amountB", "type": "uint256", "indexed": false, "internalType": "uint256"}], "anonymous": false},
  {"type": "error", "name": "BondVault__AlreadyApproved", "inputs": []},
  {"type": "error", "name": "BondVault__BadThreshold", "inputs": []},
  {"type": "error", "name": "BondVault__BondStillActive", "inputs": []},
  {"type": "error", "name": "BondVault__ExecutionFailed", "inputs": []},
  {"type": "error", "name": "BondVault__InvalidAddress", "inputs": []},
  {"type": "error", "name": "BondVault__ModuleNotEnabled", "inputs": []},
  {"type": "error", "name": "BondVault__NoActiveBond", "inputs": []},
  {"type": "error", "name": "BondVault__NotBondOwners", "inputs": []},
  {"type": "error", "name": "BondVault__NotYourSpend", "inputs": []},
  {"type": "error", "name": "BondVault__ParamOutOfBounds", "inputs": []},
  {"type": "error", "name": "BondVault__SpendNotPending", "inputs": []},
  {"type": "error", "name": "BondVault__VaultAlreadyRegistered", "inputs": []},
  {"type": "error", "name": "BondVault__VaultNotRegistered", "inputs": []},
  {"type": "error", "name": "BondVault__ZeroAmount", "inputs": []},
  {"type": "error", "name": "OwnableInvalidOwner", "inputs": [{"name": "owner", "type": "address", "internalType": "address"}]},
  {"type": "error", "name": "OwnableUnauthorizedAccount", "inputs": [{"name": "account", "type": "address", "internalType": "address"}]}
] as const

/** Minimal ERC-20 surface: balances for the vault, and metadata for foreign assets. */
export const ERC20_ABI = [
  { "type": "function", "name": "balanceOf", "inputs": [{ "name": "account", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
  { "type": "function", "name": "decimals", "inputs": [], "outputs": [{ "name": "", "type": "uint8" }], "stateMutability": "view" },
  { "type": "function", "name": "symbol", "inputs": [], "outputs": [{ "name": "", "type": "string" }], "stateMutability": "view" },
  { "type": "function", "name": "transfer", "inputs": [{ "name": "to", "type": "address" }, { "name": "value", "type": "uint256" }], "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "nonpayable" },
] as const

/** Safe surface the app needs: creating a vault and inspecting an existing one. */
export const SAFE_PROXY_FACTORY_ABI = [
  { "type": "function", "name": "createProxyWithNonce", "inputs": [{ "name": "_singleton", "type": "address" }, { "name": "initializer", "type": "bytes" }, { "name": "saltNonce", "type": "uint256" }], "outputs": [{ "name": "proxy", "type": "address" }], "stateMutability": "nonpayable" },
  { "type": "function", "name": "proxyCreationCode", "inputs": [], "outputs": [{ "name": "", "type": "bytes" }], "stateMutability": "pure" },
] as const

export const SAFE_ABI = [
  { "type": "function", "name": "setup", "inputs": [{ "name": "_owners", "type": "address[]" }, { "name": "_threshold", "type": "uint256" }, { "name": "to", "type": "address" }, { "name": "data", "type": "bytes" }, { "name": "fallbackHandler", "type": "address" }, { "name": "paymentToken", "type": "address" }, { "name": "payment", "type": "uint256" }, { "name": "paymentReceiver", "type": "address" }], "outputs": [], "stateMutability": "nonpayable" },
  { "type": "function", "name": "isModuleEnabled", "inputs": [{ "name": "module", "type": "address" }], "outputs": [{ "name": "", "type": "bool" }], "stateMutability": "view" },
  { "type": "function", "name": "getOwners", "inputs": [], "outputs": [{ "name": "", "type": "address[]" }], "stateMutability": "view" },
  { "type": "function", "name": "getThreshold", "inputs": [], "outputs": [{ "name": "", "type": "uint256" }], "stateMutability": "view" },
] as const

export const MODULE_SETUP_ABI = [
  { "type": "function", "name": "enableModule", "inputs": [{ "name": "module", "type": "address" }], "outputs": [], "stateMutability": "nonpayable" },
] as const

/** Where a partner can manage the Safe directly if they ever disable our module. */
export const SAFE_APP_URL = 'https://app.safe.global' as const

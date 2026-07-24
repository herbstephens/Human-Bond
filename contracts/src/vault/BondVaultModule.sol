// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ISafe} from "./interfaces/ISafe.sol";
import {IHumanBond} from "./interfaces/IHumanBond.sol";

/**
 * @title BondVaultModule
 * @notice Safe module powering the shared "bond wallet": a Safe owned 2-of-2 by a bonded couple,
 *         where small spends go through immediately and larger ones need both partners.
 *
 * @dev Design notes worth reading before changing anything here:
 *
 *      1. ONE module, MANY Safes. Every bond gets its own Safe but they all share this single
 *         module instance. That is deliberate: World App only lets a mini app call whitelisted
 *         contract entrypoints, and a per-bond Safe address could never be pre-whitelisted. With
 *         this shape the mini app only ever calls this contract, which is whitelisted once.
 *
 *      2. NO SIGNATURES. Partners are identified by msg.sender, not by signing a SafeTx. World App
 *         wallets are ERC-4337 smart accounts with no ECDSA key we could use, so the usual Safe
 *         signing flow (or EIP-1271, or approveHash) does not apply. Everything here is a plain
 *         transaction, which is what MiniKit does natively.
 *
 *      3. NOT UPGRADEABLE, on purpose. This contract can move user funds. An upgradeable version
 *         would mean whoever controls the proxy admin could drain every couple's vault. The owner
 *         here can only nudge two spend parameters inside hardcoded bounds, and can never move
 *         funds or change who the partners are.
 *
 *      4. The Safe itself remains 2-of-2. If this module ever misbehaves, the partners can disable
 *         it from the Safe UI and move their funds with a normal execTransaction. Funds are never
 *         trapped behind this contract.
 */
contract BondVaultModule is Ownable {
    /* ----------------------------- ERRORS ----------------------------- */
    error BondVault__InvalidAddress();
    error BondVault__NoActiveBond();
    error BondVault__VaultAlreadyRegistered();
    error BondVault__VaultNotRegistered();
    error BondVault__ModuleNotEnabled();
    error BondVault__NotBondOwners();
    error BondVault__BadThreshold();
    error BondVault__ZeroAmount();
    error BondVault__NotYourSpend();
    error BondVault__SpendNotPending();
    error BondVault__AlreadyApproved();
    error BondVault__BondStillActive();
    error BondVault__ExecutionFailed();
    error BondVault__ParamOutOfBounds();

    /* ----------------------------- TYPES ------------------------------ */
    struct Spend {
        bytes32 bondId;
        address to;
        uint256 amount;
        address proposer;
        uint64 createdAt;
        bool executed;
        bool cancelled;
    }

    /// @dev Rolling 24h budget for spends that skip the two-signature requirement.
    struct FreeWindow {
        uint64 windowStart;
        uint256 spent;
    }

    /* --------------------------- CONSTANTS ---------------------------- */
    /// @dev Bounds on the owner-tunable parameters. The owner can adapt to price/UX changes but
    ///      can never open the free-spend path wide enough to matter.
    uint256 public constant MAX_SMALL_SPEND_THRESHOLD = 100e6; // 100 USDC
    uint256 public constant MAX_DAILY_FREE_LIMIT = 250e6; // 250 USDC
    uint256 public constant FREE_WINDOW = 1 days;

    /* --------------------------- IMMUTABLES --------------------------- */
    IHumanBond public immutable humanBond;

    /// @notice The only token this vault moves. USDC on Worldchain, 6 decimals.
    /// @dev Single-token by design: it makes "$10" mean exactly 10e6 with no oracle, and an
    ///      oracle would add both an attack surface and a way for the vault to seize up.
    IERC20 public immutable token;

    /* --------------------------- STATE VARS --------------------------- */
    uint256 public smallSpendThreshold; // spends at or below this skip the second signature
    uint256 public dailyFreeLimit; // cap on those skipped spends per bond per 24h

    mapping(bytes32 => address) public vaultOf; // bondId => the CURRENT bond instance's Safe
    mapping(address => bytes32) public bondOfVault; // Safe => bondId
    mapping(address => uint256) public epochOfVault; // Safe => the bond epoch this Safe belongs to
    mapping(address => bool) public settled; // Safe => already split

    mapping(bytes32 => uint256) public spendNonce; // bondId => monotonic counter for spend ids
    mapping(bytes32 => Spend) public spends; // spendId => Spend
    mapping(bytes32 => mapping(address => bool)) public approvedBy; // spendId => partner => approved
    mapping(bytes32 => FreeWindow) public freeWindowOf; // bondId => rolling budget

    /* ----------------------------- EVENTS ----------------------------- */
    event VaultRegistered(bytes32 indexed bondId, address indexed safe, address partnerA, address partnerB);
    event SpendProposed(
        bytes32 indexed spendId, bytes32 indexed bondId, address indexed proposer, address to, uint256 amount
    );
    event SpendApproved(bytes32 indexed spendId, address indexed approver);
    event SpendExecuted(bytes32 indexed spendId, bytes32 indexed bondId, address to, uint256 amount, bool wasFreeSpend);
    event SpendCancelled(bytes32 indexed spendId, address indexed canceller);
    event VaultSplit(bytes32 indexed bondId, address partnerA, address partnerB, uint256 amountA, uint256 amountB);
    /// @dev Emitted instead of VaultSplit when there is nothing to do. Without a distinct event a
    ///      no-op settlement is indistinguishable from a real one in the log.
    event VaultAlreadySettled(bytes32 indexed bondId, address indexed safe);
    event SmallSpendThresholdUpdated(uint256 newThreshold);
    event DailyFreeLimitUpdated(uint256 newLimit);

    /* --------------------------- CONSTRUCTOR -------------------------- */
    constructor(address _humanBond, address _token, uint256 _smallSpendThreshold, uint256 _dailyFreeLimit)
        Ownable(msg.sender)
    {
        if (_humanBond == address(0) || _token == address(0)) revert BondVault__InvalidAddress();
        humanBond = IHumanBond(_humanBond);
        token = IERC20(_token);
        _setSmallSpendThreshold(_smallSpendThreshold);
        _setDailyFreeLimit(_dailyFreeLimit);
    }

    /* ------------------------- VAULT LIFECYCLE ------------------------ */

    /// @notice Link a freshly created Safe to a bond so it can be used as that couple's vault.
    /// @dev Permissionless: everything that matters is verified on-chain, so it does not matter
    ///      who sends this. The Safe must already have this module enabled — which the frontend
    ///      does in the same batch, via ModuleSetup during the Safe's setup() call.
    ///
    ///      A pair keeps the same bond id for life, so a vault registered during an EARLIER bond
    ///      must not block the current one — otherwise a couple that dissolves and bonds again
    ///      could never have a shared wallet again. Re-registration is allowed exactly once per
    ///      bond instance, gated on the epoch having moved forward, and always onto a Safe that
    ///      has never been registered before.
    /// @param bondId The bond this vault belongs to.
    /// @param safe The Safe to register.
    function registerVault(bytes32 bondId, address safe) external {
        if (safe == address(0)) revert BondVault__InvalidAddress();

        (address partnerA, address partnerB,,,, bool active) = humanBond.bonds(bondId);
        if (!active) revert BondVault__NoActiveBond();

        uint256 epoch = humanBond.bondEpoch(bondId);
        address current = vaultOf[bondId];
        // Already have a vault for THIS bond instance.
        if (current != address(0) && epochOfVault[current] >= epoch) {
            revert BondVault__VaultAlreadyRegistered();
        }
        // Each bond instance needs its own Safe. Reusing one would inherit its settled flag and
        // silently make the next dissolution a no-op.
        if (bondOfVault[safe] != bytes32(0)) revert BondVault__VaultAlreadyRegistered();

        // The Safe must be able to take orders from us, or the vault would be dead on arrival.
        if (!ISafe(safe).isModuleEnabled(address(this))) revert BondVault__ModuleNotEnabled();

        // And it must be genuinely joint: exactly the two partners, needing both to act directly.
        // Without this check anyone could register a Safe they solely control and then have the
        // module happily move funds out of it.
        if (ISafe(safe).getThreshold() != 2) revert BondVault__BadThreshold();
        address[] memory owners = ISafe(safe).getOwners();
        if (owners.length != 2) revert BondVault__NotBondOwners();
        bool matches = (owners[0] == partnerA && owners[1] == partnerB)
            || (owners[0] == partnerB && owners[1] == partnerA);
        if (!matches) revert BondVault__NotBondOwners();

        vaultOf[bondId] = safe;
        bondOfVault[safe] = bondId;
        epochOfVault[safe] = epoch;

        emit VaultRegistered(bondId, safe, partnerA, partnerB);
    }

    /* ---------------------------- SPENDING ---------------------------- */

    /// @notice Propose a spend from the caller's bond vault.
    /// @dev Executes immediately when the amount is within both the per-spend threshold and the
    ///      bond's remaining 24h free budget. Otherwise it is parked until the other partner
    ///      approves. The proposer's own approval is recorded either way.
    /// @param to Recipient of the funds.
    /// @param amount Amount in token units (USDC has 6 decimals, so 10 USDC == 10_000_000).
    /// @return spendId Identifier of the spend, also emitted in events.
    function proposeSpend(address to, uint256 amount) external returns (bytes32 spendId) {
        if (to == address(0)) revert BondVault__InvalidAddress();
        if (amount == 0) revert BondVault__ZeroAmount();

        bytes32 bondId = humanBond.activeBondOf(msg.sender);
        if (bondId == bytes32(0)) revert BondVault__NoActiveBond();

        address safe = vaultOf[bondId];
        if (safe == address(0)) revert BondVault__VaultNotRegistered();

        spendId = keccak256(abi.encodePacked(bondId, spendNonce[bondId]++));

        spends[spendId] = Spend({
            bondId: bondId,
            to: to,
            amount: amount,
            proposer: msg.sender,
            createdAt: uint64(block.timestamp),
            executed: false,
            cancelled: false
        });
        approvedBy[spendId][msg.sender] = true;

        emit SpendProposed(spendId, bondId, msg.sender, to, amount);

        if (_consumeFreeAllowance(bondId, amount)) {
            _execute(spendId, true);
        }
    }

    /// @notice Approve a pending spend proposed by your partner.
    /// @dev Executes as soon as both partners have approved. The proposer cannot call this to
    ///      double-count themselves — they are already recorded, and the second approval must
    ///      come from a different address that is also a partner of this bond.
    function approveSpend(bytes32 spendId) external {
        Spend storage s = spends[spendId];
        if (s.proposer == address(0) || s.executed || s.cancelled) revert BondVault__SpendNotPending();

        (address partnerA, address partnerB,,,, bool active) = humanBond.bonds(s.bondId);
        // A dissolved bond must not be able to move money: whatever is left belongs to the split.
        if (!active) revert BondVault__NoActiveBond();
        if (msg.sender != partnerA && msg.sender != partnerB) revert BondVault__NotYourSpend();
        if (approvedBy[spendId][msg.sender]) revert BondVault__AlreadyApproved();

        approvedBy[spendId][msg.sender] = true;
        emit SpendApproved(spendId, msg.sender);

        if (approvedBy[spendId][partnerA] && approvedBy[spendId][partnerB]) {
            _execute(spendId, false);
        }
    }

    /// @notice Cancel a pending spend. Either partner may cancel.
    /// @dev The non-proposing partner can cancel too — that is the "no, and stop asking" path,
    ///      so a rejected request does not linger as a pending item forever.
    function cancelSpend(bytes32 spendId) external {
        Spend storage s = spends[spendId];
        if (s.proposer == address(0) || s.executed || s.cancelled) revert BondVault__SpendNotPending();

        (address partnerA, address partnerB,,,,) = humanBond.bonds(s.bondId);
        if (msg.sender != partnerA && msg.sender != partnerB) revert BondVault__NotYourSpend();

        s.cancelled = true;
        emit SpendCancelled(spendId, msg.sender);
    }

    /* --------------------------- SETTLEMENT --------------------------- */

    /// @notice Split the vault 50/50 between the partners after their bond has been dissolved.
    /// @dev Called by HumanBond inside a try/catch during executeDissolution, and also callable
    ///      permissionlessly afterwards so a failed in-line attempt can always be retried —
    ///      otherwise a hiccup during the divorce would strand the money.
    ///
    ///      Deliberately requires the bond to be INACTIVE: by the time this runs the dissolution
    ///      has already flipped the flag. Checking for an active bond here would revert every
    ///      single time.
    ///
    ///      Idempotent: a second call for an already-settled bond is a no-op rather than a revert,
    ///      so HumanBond's try/catch cannot be made to emit a spurious failure.
    function settleAndSplit(bytes32 bondId) external {
        address safe = vaultOf[bondId];
        if (safe == address(0)) {
            // This couple never created a vault. Nothing to do, and nothing to remember.
            emit VaultAlreadySettled(bondId, address(0));
            return;
        }
        _settle(safe);
    }

    /// @notice Settle a specific Safe. Permissionless retry path, addressed by Safe rather than
    ///         by bond.
    /// @dev Needed because `vaultOf[bondId]` only ever points at the CURRENT bond instance's Safe.
    ///      If a settlement failed and the pair then bonded again, the old Safe would no longer be
    ///      reachable through settleAndSplit and its balance would be stranded for good. This is
    ///      the door back to it.
    function settleVault(address safe) external {
        if (safe == address(0)) revert BondVault__InvalidAddress();
        if (bondOfVault[safe] == bytes32(0)) revert BondVault__VaultNotRegistered();
        _settle(safe);
    }

    /// @dev Settlement is keyed by SAFE, not by bond id. A bond id repeats every time the same
    ///      pair bonds, so a bondId-keyed flag would stay set from the first dissolution and make
    ///      every later one a silent no-op. Each Safe, on the other hand, settles exactly once —
    ///      which is the invariant we actually mean.
    function _settle(address safe) internal {
        bytes32 bondId = bondOfVault[safe];

        if (settled[safe]) {
            emit VaultAlreadySettled(bondId, safe);
            return;
        }

        (address partnerA, address partnerB,,,, bool active) = humanBond.bonds(bondId);
        if (partnerA == address(0)) revert BondVault__NoActiveBond();

        // This Safe's own bond instance must be over. A pair who already bonded again has a live
        // `active` flag on the same bond id, so the epoch is what tells us whether THIS Safe's
        // chapter is closed.
        bool thisBondEnded = !active || epochOfVault[safe] < humanBond.bondEpoch(bondId);
        if (!thisBondEnded) revert BondVault__BondStillActive();

        settled[safe] = true;

        uint256 balance = token.balanceOf(safe);
        if (balance == 0) {
            emit VaultSplit(bondId, partnerA, partnerB, 0, 0);
            return;
        }

        // Odd amounts leave a dust unit; partnerB takes it, matching how HumanBond already splits
        // yield (`split` to A, `reward - split` to B).
        uint256 amountA = balance / 2;
        uint256 amountB = balance - amountA;

        _safeTransfer(safe, partnerA, amountA);
        _safeTransfer(safe, partnerB, amountB);

        emit VaultSplit(bondId, partnerA, partnerB, amountA, amountB);
    }

    /* ---------------------------- INTERNALS --------------------------- */

    /// @dev Returns true and books the amount if this spend qualifies for the no-second-signature
    ///      path. The per-spend threshold alone would be trivially defeated by making many
    ///      just-under-threshold transfers, so the rolling 24h budget is what actually bounds how
    ///      much one partner can move unilaterally.
    function _consumeFreeAllowance(bytes32 bondId, uint256 amount) internal returns (bool) {
        if (amount > smallSpendThreshold) return false;

        FreeWindow storage w = freeWindowOf[bondId];
        uint256 spent = w.spent;

        if (block.timestamp >= w.windowStart + FREE_WINDOW) {
            // Window expired: start a fresh one.
            w.windowStart = uint64(block.timestamp);
            spent = 0;
        }

        if (spent + amount > dailyFreeLimit) return false;

        w.spent = spent + amount;
        return true;
    }

    function _execute(bytes32 spendId, bool wasFreeSpend) internal {
        Spend storage s = spends[spendId];
        s.executed = true; // set before the external call

        address safe = vaultOf[s.bondId];
        _safeTransfer(safe, s.to, s.amount);

        emit SpendExecuted(spendId, s.bondId, s.to, s.amount, wasFreeSpend);
    }

    /// @dev Drives an ERC-20 transfer out of the Safe and insists it actually happened. Checks
    ///      both that the Safe's inner call did not revert and that the token did not quietly
    ///      return false.
    function _safeTransfer(address safe, address to, uint256 amount) internal {
        (bool success, bytes memory ret) = ISafe(safe).execTransactionFromModuleReturnData(
            address(token), 0, abi.encodeCall(IERC20.transfer, (to, amount)), 0
        );
        if (!success) revert BondVault__ExecutionFailed();
        if (ret.length != 0 && !abi.decode(ret, (bool))) revert BondVault__ExecutionFailed();
    }

    /* ---------------------------- PARAMETERS -------------------------- */

    function setSmallSpendThreshold(uint256 v) external onlyOwner {
        _setSmallSpendThreshold(v);
    }

    function setDailyFreeLimit(uint256 v) external onlyOwner {
        _setDailyFreeLimit(v);
    }

    function _setSmallSpendThreshold(uint256 v) internal {
        if (v > MAX_SMALL_SPEND_THRESHOLD) revert BondVault__ParamOutOfBounds();
        smallSpendThreshold = v;
        emit SmallSpendThresholdUpdated(v);
    }

    function _setDailyFreeLimit(uint256 v) internal {
        if (v > MAX_DAILY_FREE_LIMIT) revert BondVault__ParamOutOfBounds();
        dailyFreeLimit = v;
        emit DailyFreeLimitUpdated(v);
    }

    /* ----------------------------- GETTERS ---------------------------- */

    /// @notice Current USDC balance of a couple's vault, or 0 if they never created one.
    function vaultBalance(bytes32 bondId) external view returns (uint256) {
        address safe = vaultOf[bondId];
        return safe == address(0) ? 0 : token.balanceOf(safe);
    }

    /// @notice How much more can still be spent without the partner's approval in this window.
    function remainingFreeAllowance(bytes32 bondId) external view returns (uint256) {
        FreeWindow memory w = freeWindowOf[bondId];
        if (block.timestamp >= w.windowStart + FREE_WINDOW) return dailyFreeLimit;
        return w.spent >= dailyFreeLimit ? 0 : dailyFreeLimit - w.spent;
    }

    /// @notice Whether a spend of this size would execute immediately for this bond right now.
    function wouldExecuteImmediately(bytes32 bondId, uint256 amount) external view returns (bool) {
        if (amount == 0 || amount > smallSpendThreshold) return false;
        FreeWindow memory w = freeWindowOf[bondId];
        uint256 spent = block.timestamp >= w.windowStart + FREE_WINDOW ? 0 : w.spent;
        return spent + amount <= dailyFreeLimit;
    }

    function getSpend(bytes32 spendId) external view returns (Spend memory) {
        return spends[spendId];
    }
}

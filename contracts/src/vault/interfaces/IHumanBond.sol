// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IHumanBond
/// @notice Read-only subset of HumanBond that BondVaultModule depends on.
/// @dev The module never writes to HumanBond — the bond protocol stays the single source of
///      truth for who is bonded to whom, and the vault only reads it.
interface IHumanBond {
    /// @notice Raw bond record by id.
    /// @dev Note that partnerA/partnerB survive dissolution (only `active` flips to false), which
    ///      is what lets settleAndSplit still know where to send the money after a divorce.
    function bonds(bytes32 bondId)
        external
        view
        returns (
            address partnerA,
            address partnerB,
            uint256 bondStart,
            uint256 lastClaim,
            uint256 lastMilestoneYear,
            bool active
        );

    /// @notice Active bond id for a user, or bytes32(0) if they are not currently bonded.
    /// @dev Zeroed on dissolution, which is what stops new spends from being proposed afterwards.
    function activeBondOf(address user) external view returns (bytes32);

    /// @notice Deterministic, order-independent bond id for a pair.
    function getBondId(address a, address b) external pure returns (bytes32);

    /// @notice How many times this pair has bonded. 0 = never, 1 = first bond.
    /// @dev Survives dissolution, so it stays a monotonic counter across the pair's whole history.
    ///      The module uses it to tell one bond instance's vault from the next one's.
    function bondEpoch(bytes32 bondId) external view returns (uint256);
}

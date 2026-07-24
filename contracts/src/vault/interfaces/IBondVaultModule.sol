// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IBondVaultModule
/// @notice Minimal interface HumanBond uses to notify the vault module that a bond ended.
/// @dev Kept deliberately small: HumanBond must never depend on vault internals, and a
///      misbehaving module must never be able to block a dissolution.
interface IBondVaultModule {
    /// @notice Split the bond vault's balances 50/50 between the two partners and close it.
    /// @dev Called by HumanBond inside a try/catch during executeDissolution. Implementations
    ///      MUST be idempotent (a second call for an already-settled bond is a no-op) and MUST
    ///      NOT assume they are only ever called by HumanBond — settlement is also permissionless
    ///      so it can be retried if the in-line call runs out of gas or reverts.
    /// @param bondId The dissolved bond's deterministic id.
    function settleAndSplit(bytes32 bondId) external;
}

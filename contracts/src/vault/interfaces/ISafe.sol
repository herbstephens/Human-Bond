// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ISafe
/// @notice Minimal subset of the Safe Smart Account interface used by BondVaultModule.
/// @dev Hand-written instead of pulling in safe-contracts as a submodule: we only need four
///      functions and safe-contracts targets an older solc, which would force a second compiler
///      profile for no benefit.
interface ISafe {
    /// @notice Execute a transaction from an enabled module, bypassing owner signatures.
    /// @dev Operation 0 = Call, 1 = DelegateCall. This module only ever uses Call.
    function execTransactionFromModule(address to, uint256 value, bytes calldata data, uint8 operation)
        external
        returns (bool success);

    /// @notice Same as execTransactionFromModule but also returns the inner call's return data.
    /// @dev Needed to inspect an ERC-20 transfer's boolean return value. Plain
    ///      execTransactionFromModule only reports whether the call reverted, so a token that
    ///      returns false instead of reverting would look like a success.
    function execTransactionFromModuleReturnData(address to, uint256 value, bytes calldata data, uint8 operation)
        external
        returns (bool success, bytes memory returnData);

    function isModuleEnabled(address module) external view returns (bool);

    function getOwners() external view returns (address[] memory);

    function getThreshold() external view returns (uint256);
}

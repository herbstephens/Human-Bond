// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ModuleSetup
/// @notice Delegatecall target used during a Safe's setup() to enable a module at creation time.
/// @dev Safe.setup() takes a `to`/`data` pair that it DELEGATECALLs into. That is the only hook
///      available to enable a module in the same transaction that creates the Safe — otherwise
///      enabling one would need a full 2-of-2 owner transaction afterwards, meaning both partners
///      would have to act before the vault was usable at all.
///
///      Because this runs as a delegatecall in the Safe's own context, `enableModule` here writes
///      to the SAFE's module list, not to this contract's storage. This contract holds no state
///      and must never hold funds.
contract ModuleSetup {
    /// @dev STORAGE LAYOUT MUST MATCH SAFE EXACTLY — this runs as a delegatecall in the Safe's
    ///      context, so these declarations are just a typed view over the Safe's own slots.
    ///
    ///      Safe v1.4.1 inherits Singleton first, which declares `address private singleton` at
    ///      slot 0. ModuleManager's `modules` mapping is therefore at slot 1. This padding is what
    ///      lines them up; without it `modules` would land on slot 0 and this contract would
    ///      overwrite the Safe's singleton pointer — bricking the Safe and everything in it.
    address private __singletonSlot0; // Safe: singleton
    mapping(address => address) internal modules; // Safe: ModuleManager.modules

    address internal constant SENTINEL_MODULES = address(0x1);

    error ModuleSetup__InvalidModule();
    error ModuleSetup__AlreadyEnabled();

    event EnabledModule(address indexed module);

    /// @notice Enable `module` on the calling Safe. Intended to be reached only via delegatecall.
    function enableModule(address module) external {
        if (module == address(0) || module == SENTINEL_MODULES) revert ModuleSetup__InvalidModule();
        if (modules[module] != address(0)) revert ModuleSetup__AlreadyEnabled();

        // Insert at the head of the sentinel-terminated linked list, exactly as Safe does.
        modules[module] = modules[SENTINEL_MODULES];
        modules[SENTINEL_MODULES] = module;

        emit EnabledModule(module);
    }
}

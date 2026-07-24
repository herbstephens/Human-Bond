// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {BondVaultModule} from "../src/vault/BondVaultModule.sol";
import {ModuleSetup} from "../src/vault/ModuleSetup.sol";
import {HumanBond} from "../src/HumanBond.sol";

/// @title Deploy script for the Bond Vault (Safe multisig) layer
/// @notice Run AFTER Deploy.s.sol — it needs the HumanBond proxy address.
///
/// @dev Usage:
///   HUMAN_BOND_PROXY=0x... forge script script/DeployVault.s.sol \
///     --rpc-url $WORLDCHAIN_RPC --broadcast --verify
///
/// The deployer must be HumanBond's owner, otherwise the final wiring call reverts.
contract DeployVaultScript is Script {
    /// @dev USDC on Worldchain mainnet, 6 decimals. Verified on-chain: name/symbol both "USDC".
    address constant USDC_WORLDCHAIN = 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1;

    uint256 constant SMALL_SPEND_THRESHOLD = 10e6; // 10 USDC — below this, no partner signature
    uint256 constant DAILY_FREE_LIMIT = 25e6; // 25 USDC per bond per 24h of those spends

    function run() external {
        address humanBondProxy = vm.envAddress("HUMAN_BOND_PROXY");

        vm.startBroadcast();

        ModuleSetup moduleSetup = new ModuleSetup();

        BondVaultModule vaultModule =
            new BondVaultModule(humanBondProxy, USDC_WORLDCHAIN, SMALL_SPEND_THRESHOLD, DAILY_FREE_LIMIT);

        // Close the loop: dissolutions now auto-split the couple's Safe.
        HumanBond(humanBondProxy).setBondVaultModule(address(vaultModule));

        vm.stopBroadcast();

        console.log("ModuleSetup deployed at:      ", address(moduleSetup));
        console.log("BondVaultModule deployed at:  ", address(vaultModule));
        console.log("Wired into HumanBond proxy:   ", humanBondProxy);
        console.log("");
        console.log("Whitelist these in the World Developer Portal (contract entrypoints):");
        console.log("  HumanBond proxy:   ", humanBondProxy);
        console.log("  BondVaultModule:   ", address(vaultModule));
        console.log("  SafeProxyFactory:   0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67");
        console.log("  USDC (Permit2):     0x79A02482A880bCE3F13e09Da970dC34db4CD24d1");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {HumanBondRegistrar} from "../src/ens/HumanBondRegistrar.sol";

/// @title Deploy script for the ENS subname layer (HumanBondRegistrar)
/// @notice Run AFTER Deploy.s.sol and DeployVault.s.sol — it needs the proxy, the vault module
///         and the BondNFT. It also needs the Durin L2Registry to already exist on Worldchain.
///
/// @dev Usage:
///   HUMAN_BOND_PROXY=0x... \
///   BOND_VAULT_MODULE=0x... \
///   BOND_NFT=0x... \
///   L2_REGISTRY=0x3DbB5CE73f3C1cb63D61A6Db73668D4cE10f371B \
///   forge script script/DeployRegistrar.s.sol --rpc-url $WORLDCHAIN_RPC --broadcast --verify
///
/// AFTER deploying, authorise the registrar on the registry (from the registry OWNER — the same
/// EOA that deployed the L2Registry on durin.dev):
///
///   cast send $L2_REGISTRY "addRegistrar(address)" <REGISTRAR> \
///     --private-key $PRIVATE_KEY --rpc-url $WORLDCHAIN_RPC
///
/// Without addRegistrar, register() reverts — the registrar cannot mint subnodes.
contract DeployRegistrarScript is Script {
    /// @dev Durin L2Registry for humanbond.eth on Worldchain. Deployed 2026-07-24 via durin.dev.
    ///      Verified on-chain: owner = deployer EOA, baseNode = namehash("humanbond.eth").
    ///      Overridable by env in case of a re-deploy.
    address constant L2_REGISTRY_DEFAULT = 0x3DbB5CE73f3C1cb63D61A6Db73668D4cE10f371B;

    function run() external {
        address humanBondProxy = vm.envAddress("HUMAN_BOND_PROXY");
        address vaultModule = vm.envAddress("BOND_VAULT_MODULE");
        address bondNft = vm.envAddress("BOND_NFT");
        address registry = vm.envOr("L2_REGISTRY", L2_REGISTRY_DEFAULT);

        vm.startBroadcast();

        HumanBondRegistrar registrar = new HumanBondRegistrar(registry, humanBondProxy, vaultModule, bondNft);

        vm.stopBroadcast();

        console.log("HumanBondRegistrar deployed at:", address(registrar));
        console.log("  L2Registry:  ", registry);
        console.log("  HumanBond:   ", humanBondProxy);
        console.log("  VaultModule: ", vaultModule);
        console.log("  BondNFT:     ", bondNft);
        console.log("");
        console.log("NEXT - authorise it on the registry (from the registry owner EOA):");
        console.log("  cast send", registry);
        console.log("    'addRegistrar(address)'", address(registrar));
        console.log("");
        console.log("Then whitelist the registrar as a contract entrypoint in the Developer Portal.");
    }
}

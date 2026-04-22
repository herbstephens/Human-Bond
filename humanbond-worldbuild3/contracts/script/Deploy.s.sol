// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {VowNFT} from "../src/VowNFT.sol";
import {HumanBond} from "../src/HumanBond.sol";
import {MilestoneNFT} from "../src/MilestoneNFT.sol";
import {TimeToken} from "../src/TimeToken.sol";

/// @title Deploy Script for HumanBond Protocol
/// @notice Deploys TimeToken, VowNFT, MilestoneNFT and HumanBond logic contract, sets up linkage, and prints addresses.
contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy contract and tokens
        VowNFT vowNFT = new VowNFT();
        MilestoneNFT milestoneNFT = new MilestoneNFT();
        TimeToken timeToken = new TimeToken();
        address WORLD_ID_ROUTER_REAL = 0x17B354dD2595411ff79041f930e491A4Df39A278; // World ID Router mainnet address

        //Set milestones metadata URIs BEFORE ownership transfer
        milestoneNFT.setMilestoneURI(1, "ipfs://QmPAVmWBuJnNgrGrAp34CqTa13VfKkEZkZak8d6E4MJio8");
        milestoneNFT.setMilestoneURI(2, "ipfs://QmPTuKXg64EaeyreUFe4PJ1istspMd4G2oe2ArRYrtBGYn");

        // Compute external nullifiers and app ID
        string memory appId = "app_bfc3261816aeadc589f9c6f80a98f5df";
        string memory actionPropose = "propose-bond";
        string memory actionAccept = "accept-bond";

        //Deploy HumanBond main contract
        HumanBond humanBond = new HumanBond(
            WORLD_ID_ROUTER_REAL, // replace w/ chosen network WORLD ID ROUTER
            address(vowNFT),
            address(timeToken),
            address(milestoneNFT),
            appId,
            actionPropose,
            actionAccept,
            1 days,
            365 days,
            30 days
        );

        //Link contracts
        milestoneNFT.setHumanBondContract(address(humanBond)); //Link MilestoneNFT to HumanBond
        vowNFT.setHumanBondContract(address(humanBond));
        timeToken.setHumanBondContract(address(humanBond));

        vm.stopBroadcast();

        // Logs
        console.log("VowNFT deployed at:", address(vowNFT));
        console.log("MilestoneNFT deployed at:", address(milestoneNFT));
        console.log("HumanBond deployed at:", address(humanBond));
        console.log("Time Token deployed at:", address(timeToken));
        console.log("Deployment complete!");
    }
}

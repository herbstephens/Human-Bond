// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {BondNFT} from "../src/BondNFT.sol";
import {HumanBond} from "../src/HumanBond.sol";
import {MilestoneNFT} from "../src/MilestoneNFT.sol";
import {TimeToken} from "../src/TimeToken.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title Deploy Script for HumanBond Protocol
/// @notice Deploys TimeToken, BondNFT, MilestoneNFT and HumanBond logic contract behind a UUPS proxy.
contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy contracts
        BondNFT bondNft = new BondNFT();
        MilestoneNFT milestoneNft = new MilestoneNFT();
        TimeToken timeToken = new TimeToken();
        address worldIdRouterReal = 0x17B354dD2595411ff79041f930e491A4Df39A278; // World ID Router mainnet address

        // Compute actions and appId
        string memory appId = "app_bfc3261816aeadc589f9c6f80a98f5df";
        string memory actionPropose = "propose-bond";
        string memory actionAccept = "accept-bond";

        // Deploy implementation (logic contract)
        HumanBond implementation = new HumanBond();

        // Encode initialize() call for proxy constructor
        bytes memory initData = abi.encodeWithSelector(
            HumanBond.initialize.selector,
            worldIdRouterReal,
            address(bondNft),
            address(timeToken),
            address(milestoneNft),
            appId,
            actionPropose,
            actionAccept
        );

        // Deploy proxy pointing to implementation with initData
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        // Cast proxy to HumanBond for linking
        HumanBond humanBond = HumanBond(address(proxy));

        //Link contracts to proxy address
        milestoneNft.setHumanBondContract(address(humanBond)); //Link MilestoneNFT to HumanBond
        bondNft.setHumanBondContract(address(humanBond));
        bondNft.setImageURI("ipfs://bafkreieeq6mqrapuwa5uceqcno6xn5cryicidq6z27xpmdlw5l3z5v2dsu");
        timeToken.setMinter(address(humanBond), true);

        vm.stopBroadcast();

        console.log("Time Token deployed at:", address(timeToken));
        console.log("BondNFT deployed at:", address(bondNft));
        console.log("MilestoneNFT deployed at:", address(milestoneNft));
        console.log("HumanBond deployed at:", address(humanBond));
        console.log("Proxy at:", address(proxy));
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {VowNFT} from "../../src/VowNFT.sol";
import {MilestoneNFT} from "../../src/MilestoneNFT.sol";
import {HumanBond} from "../../src/HumanBond.sol";
import {TimeToken} from "../../src/TimeToken.sol";

contract DeployTest is Test {
    function test_deploymentFlow() public {
        address deployer = address(0x1234);
        vm.startPrank(deployer);

        // Deploy contracts manually (same as script)
        VowNFT vow = new VowNFT();
        MilestoneNFT mile = new MilestoneNFT();
        TimeToken time = new TimeToken();

        HumanBond hb = new HumanBond(
            0x17B354dD2595411ff79041f930e491A4Df39A278,
            address(vow),
            address(time),
            address(mile),
            "app_bfc3261816aeadc589f9c6f80a98f5df",
            "propose-bond",
            "accept-bond",
            1 minutes,
            3 minutes,
            5 minutes
        );

        // Set milestone URIs
        mile.setMilestoneURI(1, "ipfs://QmPAVmWBuJnNgrGrAp34CqTa13VfKkEZkZak8d6E4MJio8");

        // Link contracts just like in script
        mile.setHumanBondContract(address(hb));
        vow.setHumanBondContract(address(hb));

        // Transfer ownership
        vow.transferOwnership(address(hb));
        time.transferOwnership(address(hb));
        mile.transferOwnership(address(hb));

        vm.stopPrank();

        // VALIDATION

        assertEq(vow.owner(), address(hb));
        assertEq(time.owner(), address(hb));
        assertEq(mile.owner(), address(hb));

        assertEq(vow.humanBondContract(), address(hb));
        assertEq(mile.humanBondContract(), address(hb));

        assertTrue(bytes(mile.milestoneURIs(1)).length > 0);

        console.log("Deployment logic works exactly as expected!");
    }
}

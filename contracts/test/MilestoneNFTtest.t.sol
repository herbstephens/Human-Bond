// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MilestoneNFT.sol";

contract MilestoneNFTTest is Test {
    MilestoneNFT milestone;
    address owner = address(this);
    address hb = address(0xBEEF);
    address user = address(0xA1);

    function setUp() public {
        milestone = new MilestoneNFT();
        milestone.setHumanBondContract(hb);
    }

    /* -------------------------------------------------------------- */
    /*                          ADMIN TESTS                           */
    /* -------------------------------------------------------------- */

    function test_SetMilestoneURI_onlyOwnerCanSet() public {
        milestone.setMilestoneURI(1, "ipfs://CID1");
        assertEq(milestone.milestoneURIs(1), "ipfs://CID1");
    }

    function test_revert_setMilestoneURI_nonOwner() public {
        vm.prank(user);
        vm.expectRevert();
        milestone.setMilestoneURI(1, "ipfs://CID1");
    }

    function test_revert_setMilestoneURI_zeroYear() public {
        vm.expectRevert(abi.encodeWithSelector(MilestoneNFT.MilestoneNFT__URI_NotFound.selector, 0));
        milestone.setMilestoneURI(0, "ipfs://BAD");
    }

    function test_freezeBlocksFurtherChanges() public {
        milestone.setMilestoneURI(1, "ipfs://CID1");
        milestone.freezeMilestones();

        vm.expectRevert(MilestoneNFT.MilestoneNFT__Frozen.selector);
        milestone.setMilestoneURI(2, "ipfs://CID2");
    }

    /* -------------------------------------------------------------- */
    /*                          MINT TESTS                            */
    /* -------------------------------------------------------------- */

    function test_mintMilestone_onlyHumanBond() public {
        milestone.setMilestoneURI(1, "ipfs://CID1");

        vm.prank(hb);
        uint256 tokenId = milestone.mintMilestone(user, 1);

        assertEq(tokenId, 1);
        assertEq(milestone.totalSupply(), 1);
        assertEq(milestone.ownerOf(1), user);
        assertEq(milestone.tokenYear(1), 1);
    }

    function test_revert_mintMilestone_wrongCaller() public {
        milestone.setMilestoneURI(1, "ipfs://CID1");

        vm.expectRevert(MilestoneNFT.MilestoneNFT__NotAuthorized.selector);
        milestone.mintMilestone(user, 1); //msg.sender is calling and not humanBond
    }

    function test_revert_mintMilestone_missingURI() public {
        vm.prank(hb);
        vm.expectRevert(abi.encodeWithSelector(MilestoneNFT.MilestoneNFT__URI_NotFound.selector, 1));
        milestone.mintMilestone(user, 1);
    }

    /* -------------------------------------------------------------- */
    /*                      tokenURI Tests                            */
    /* -------------------------------------------------------------- */

    function test_tokenURI_returnsCorrectURI() public {
        milestone.setMilestoneURI(1, "ipfs://CID1");

        vm.prank(hb);
        milestone.mintMilestone(user, 1);

        string memory uri = milestone.tokenURI(1);
        assertEq(uri, "ipfs://CID1");
    }

    function test_revert_tokenURI_notMinted() public {
        vm.expectRevert();
        milestone.tokenURI(10);
    }

    /* -------------------------------------------------------------- */
    /*                    Soulbound Tests                              */
    /* -------------------------------------------------------------- */

    function test_revert_transfer_soulbound() public {
        milestone.setMilestoneURI(1, "ipfs://CID1");
        vm.prank(hb);
        milestone.mintMilestone(user, 1);

        vm.prank(user);
        vm.expectRevert(MilestoneNFT.MilestoneNFT__TransfersDisabled.selector);
        milestone.transferFrom(user, address(0x22), 1);
    }
}

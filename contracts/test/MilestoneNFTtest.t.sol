// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MilestoneNFT} from "../src/MilestoneNFT.sol";

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
    function test_revert_setHumanBondContract_zeroAddress() public {
        vm.expectRevert(MilestoneNFT.MilestoneNFT__InvalidAddress.selector);
        milestone.setHumanBondContract(address(0));
    }

    function test_SetMilestoneURI_onlyOwnerCanSet() public {
        milestone.setMilestoneURI(1, "ipfs://CID1");
        assertEq(milestone.milestoneUrIs(1), "ipfs://CID1");
    }

    function test_revert_setMilestoneURI_emptyURI() public {
        vm.expectRevert(abi.encodeWithSelector(MilestoneNFT.MilestoneNFT__URI_NotFound.selector, 1));
        milestone.setMilestoneURI(1, "");
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

    function test_revert_freezeMilestones_alreadyFrozen() public {
        milestone.freezeMilestones();
        vm.expectRevert(MilestoneNFT.MilestoneNFT__Frozen.selector);
        milestone.freezeMilestones();
    }

    /* -------------------------------------------------------------- */
    /*                          MINT TESTS                            */
    /* -------------------------------------------------------------- */

    function test_mintMilestone_onlyHumanBond() public {
        milestone.setMilestoneURI(1, "ipfs://CID1");

        vm.prank(hb);
        uint256 tokenId = milestone.mintMilestone(user, 1, user, address(0xA2), bytes32(0), 0);

        assertEq(tokenId, 1);
        assertEq(milestone.totalSupply(), 1);
        assertEq(milestone.ownerOf(1), user);
        assertEq(milestone.tokenYear(1), 1);
    }

    function test_revert_mintMilestone_wrongCaller() public {
        milestone.setMilestoneURI(1, "ipfs://CID1");

        vm.expectRevert(MilestoneNFT.MilestoneNFT__NotAuthorized.selector);
        milestone.mintMilestone(user, 1, user, address(0xA2), bytes32(0), 0); //msg.sender is calling and not humanBond
    }

    function test_revert_mintMilestone_missingURI() public {
        vm.prank(hb);
        vm.expectRevert(abi.encodeWithSelector(MilestoneNFT.MilestoneNFT__URI_NotFound.selector, 1));
        milestone.mintMilestone(user, 1, user, address(0xA2), bytes32(0), 0);
    }

    function test_mintMilestone_storesTokenDataCorrectly() public {
        milestone.setMilestoneURI(1, "ipfs://CID1");
        address partnerA = address(0xA1);
        address partnerB = address(0xA2);
        bytes32 bondId = bytes32(uint256(1));
        uint256 bondStart = 1000;

        vm.prank(hb);
        milestone.mintMilestone(user, 1, partnerA, partnerB, bondId, bondStart);

        (
            address storedPartnerA,
            address storedPartnerB,
            bytes32 storedbondId,
            uint256 storedBondStart,
            uint256 storedClaimedAt
        ) = milestone.tokenData(1);

        assertEq(storedPartnerA, partnerA);
        assertEq(storedPartnerB, partnerB);
        assertEq(storedbondId, bondId);
        assertEq(storedBondStart, bondStart);
        assertTrue(storedClaimedAt > 0);
    }

    /* -------------------------------------------------------------- */
    /*                      tokenURI Tests                            */
    /* -------------------------------------------------------------- */

    function _startsWith(string memory str, string memory prefix) internal pure returns (bool) {
        bytes memory s = bytes(str);
        bytes memory p = bytes(prefix);
        if (s.length < p.length) return false;
        for (uint256 i = 0; i < p.length; i++) {
            if (s[i] != p[i]) return false;
        }
        return true;
    }

    function test_tokenURI_returnsCorrectURI() public {
        milestone.setMilestoneURI(1, "ipfs://CID1");

        vm.prank(hb);
        milestone.mintMilestone(user, 1, user, address(0xA2), bytes32(0), 0);

        string memory uri = milestone.tokenURI(1);
        assertTrue(_startsWith(uri, "data:application/json;base64,"));
    }

    function test_revert_tokenURI_notMinted() public {
        vm.expectRevert();
        milestone.tokenURI(10);
    }

    function test_revert_burn_soulbound() public {
        milestone.setMilestoneURI(1, "ipfs://CID1");
        vm.prank(hb);
        milestone.mintMilestone(user, 1, user, address(0xA2), bytes32(0), 0);

        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("ERC721InvalidReceiver(address)")), address(0)));
        milestone.transferFrom(user, address(0), 1);
    }

    function test_tokenURI_worksAfterFreeze() public {
        milestone.setMilestoneURI(1, "ipfs://CID1");
        milestone.freezeMilestones();

        vm.prank(hb);
        milestone.mintMilestone(user, 1, user, address(0xA2), bytes32(0), 0);

        string memory uri = milestone.tokenURI(1);
        assertTrue(_startsWith(uri, "data:application/json;base64,"));
    }

    /* -------------------------------------------------------------- */
    /*                    Soulbound Tests                              */
    /* -------------------------------------------------------------- */

    function test_revert_transfer_soulbound() public {
        milestone.setMilestoneURI(1, "ipfs://CID1");
        vm.prank(hb);
        milestone.mintMilestone(user, 1, user, address(0xA2), bytes32(0), 0);

        vm.prank(user);
        vm.expectRevert(MilestoneNFT.MilestoneNFT__TransfersDisabled.selector);
        milestone.transferFrom(user, address(0x22), 1);
    }
}

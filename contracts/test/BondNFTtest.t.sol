// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {BondNFT} from "../src/BondNFT.sol";

contract BondNFTTest is Test {
    BondNFT public bond;
    address public alice = address(0xA1);
    address public bob = address(0xB2);
    address public stranger = address(0xC3);
    bytes32 public bondId;

    function setUp() public {
        // deploy and set this test contract as the authorized minter (humanBondContract)
        bond = new BondNFT();
        bond.setHumanBondContract(address(this));
        bondId = keccak256(abi.encodePacked("bond-1"));
    }

    /* ---------------------------
       Helpers
       --------------------------- */
    function _startsWith(string memory what, string memory prefix) internal pure returns (bool) {
        bytes memory w = bytes(what);
        bytes memory p = bytes(prefix);
        if (w.length < p.length) return false;
        for (uint256 i = 0; i < p.length; i++) {
            if (w[i] != p[i]) return false;
        }
        return true;
    }

    /* ---------------------------
       Minting / metadata tests
       --------------------------- */

    function test_mint_recordsMetadataAndMapping_slot0() public {
        uint256 tid1 = bond.mintBondNft(alice, alice, bob, 1_610_000_000, bondId);
        assertEq(tid1, 1);

        uint256[] memory tokens = bond.getTokensByBond(bondId);
        assertEq(tokens.length, 1);
        assertEq(tokens[0], 1);

        (address pA, address pB, uint256 bondStart, bytes32 mid) = bond.getTokenMetadata(1);
        assertEq(pA, alice);
        assertEq(pB, bob);
        assertEq(bondStart, 1_610_000_000);
        assertEq(mid, bondId);
    }

    function test_secondMint_fillsSlot1() public {
        uint256 t1 = bond.mintBondNft(alice, alice, bob, 1, bondId);
        uint256 t2 = bond.mintBondNft(bob, alice, bob, 1, bondId);

        assertEq(t1, 1);
        assertEq(t2, 2);

        uint256[] memory tokens = bond.getTokensByBond(bondId);
        assertEq(tokens[0], 1);
        assertEq(tokens[1], 2);
    }

    function test_tokenURI_hasDataPrefixAndImageCID() public {
        bond.mintBondNft(alice, alice, bob, 1_610_000_000, bondId);
        string memory uri = bond.tokenURI(1);

        assertTrue(_startsWith(uri, "data:application/json;base64,"), "must return data URI");
        // check the contract stores the expected imageCID (tokenURI is built from this)
        assertEq(bond.imageURI(), "ipfs://bafkreieeq6mqrapuwa5uceqcno6xn5cryicidq6z27xpmdlw5l3z5v2dsu");
    }

    function test_console_log_tokenURI_for_manual_inspection() public {
        uint256 t1 = bond.mintBondNft(alice, alice, bob, 1_610_000_000, bondId);
        string memory uri = bond.tokenURI(t1);

        // prints during `forge test -vv` so you can copy/paste to a browser or base64 decoder
        console.log("tokenURI(1) =>");
        console.log(uri);

        // basic sanity asserts
        assertTrue(bytes(uri).length > 0);
        assertTrue(_startsWith(uri, "data:application/json;base64,"));
    }

    /* ---------------------------
       Access control tests
       --------------------------- */

    function test_setImageURI_onlyOwner() public {
        bond.setImageURI("ipfs://12345"); // owner (this contract) can set
        assertEq(bond.imageURI(), "ipfs://12345");

        // non-owner cannot
        vm.prank(address(0x999));
        vm.expectRevert(); // Ownable reverts
        bond.setImageURI("ipfs://54321");
    }

    function test_setHumanBondContract_onlyOwner() public {
        // owner (this) can set
        bond.setHumanBondContract(address(0x111));
        // restore to this
        bond.setHumanBondContract(address(this));

        vm.prank(address(0x999)); // non-owner cannot
        vm.expectRevert();
        bond.setHumanBondContract(address(0x123));
    }

    function test_setHumanBondContract_reverts_ifZeroAddress() public {
        vm.expectRevert(BondNFT.BondNFT__InvalidAddress.selector);
        bond.setHumanBondContract(address(0));
    }

    function test_mintBondNft_reverts_ifNotAuthorizedHumanBond() public {
        bond.setHumanBondContract(address(0x111));

        vm.prank(address(0x222));
        vm.expectRevert(BondNFT.BondNFT__UnauthorizedMinter.selector);
        bond.mintBondNft(alice, alice, bob, 1, bondId);
    }

    /* ---------------------------
       Soulbound / transfer prevention
       --------------------------- */

    function test_transfer_reverts_with_BondNFT__TransfersDisabled() public {
        // mint token id 1 to alice
        bond.mintBondNft(alice, alice, bob, 1, bondId);

        // attempt to transfer from alice -> stranger, should revert with custom error
        vm.prank(alice);
        vm.expectRevert(BondNFT.BondNFT__TransfersDisabled.selector);
        bond.transferFrom(alice, stranger, 1);
    }

    function test_selfTransfer_reverts_soulbound() public {
        bond.mintBondNft(alice, alice, bob, 1, bondId);

        vm.prank(alice);
        vm.expectRevert(BondNFT.BondNFT__TransfersDisabled.selector);
        bond.transferFrom(alice, alice, 1);
    }
}

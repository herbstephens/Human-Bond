// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ByteHasher} from "../../src/helpers/ByteHasher.sol";
import {IWorldID} from "../../src/helpers/IWorldID.sol";
import {HumanBondAgentBook} from "../../src/agents/HumanBondAgentBook.sol";

contract RecordingWorldID is IWorldID {
    uint256 public signalHash;
    uint256 public externalNullifierHash;

    function verifyProof(
        uint256,
        uint256,
        uint256 _signalHash,
        uint256,
        uint256 _externalNullifierHash,
        uint256[8] calldata
    ) external {
        signalHash = _signalHash;
        externalNullifierHash = _externalNullifierHash;
    }
}

contract HumanBondAgentBookTest is Test {
    using ByteHasher for bytes;

    string constant APP_ID = "app_bfc3261816aeadc589f9c6f80a98f5df";
    string constant ACTION = "agentbook-registration";

    RecordingWorldID worldId;
    HumanBondAgentBook agentBook;
    address agent = makeAddr("agent");
    uint256[8] proof;

    function setUp() public {
        worldId = new RecordingWorldID();
        agentBook = new HumanBondAgentBook(IWorldID(address(worldId)), 1, APP_ID, ACTION);
    }

    function test_registerBindsProofToAgentAndNonce() public {
        agentBook.register(agent, 1, 0, 42, proof);

        assertEq(agentBook.lookupHuman(agent), 42);
        assertEq(agentBook.getNextNonce(agent), 1);
        assertEq(worldId.signalHash(), abi.encodePacked(agent, uint256(0)).hashToField());
        assertEq(
            worldId.externalNullifierHash(),
            abi.encodePacked(abi.encodePacked(APP_ID).hashToField(), ACTION).hashToField()
        );
    }

    function test_registerRejectsWrongNonce() public {
        vm.expectRevert(HumanBondAgentBook.InvalidNonce.selector);
        agentBook.register(agent, 1, 1, 42, proof);
    }

    function test_registerRejectsZeroAgent() public {
        vm.expectRevert(HumanBondAgentBook.InvalidAddress.selector);
        agentBook.register(address(0), 1, 0, 42, proof);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ByteHasher} from "../helpers/ByteHasher.sol";
import {IWorldID} from "../helpers/IWorldID.sol";

/// @title HumanBond AgentBook
/// @notice Links agent wallets to humans verified through the HumanBond Mini App.
/// @dev AgentKit supports custom AgentBook deployments through
///      createAgentBookVerifier({ contractAddress }).
contract HumanBondAgentBook {
    using ByteHasher for bytes;

    error InvalidAddress();
    error InvalidNonce();

    IWorldID public immutable worldIdRouter;
    uint256 public immutable groupId;
    uint256 public immutable externalNullifierHash;

    mapping(address agent => uint256 humanId) public lookupHuman;
    mapping(address agent => uint256 nonce) public getNextNonce;

    event AgentRegistered(address indexed agent, uint256 indexed humanId, uint256 nonce);

    constructor(IWorldID _worldIdRouter, uint256 _groupId, string memory appId, string memory action) {
        if (address(_worldIdRouter) == address(0)) revert InvalidAddress();

        worldIdRouter = _worldIdRouter;
        groupId = _groupId;
        externalNullifierHash =
            abi.encodePacked(abi.encodePacked(appId).hashToField(), action).hashToField();
    }

    function register(
        address agent,
        uint256 root,
        uint256 nonce,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external {
        if (agent == address(0)) revert InvalidAddress();
        if (nonce != getNextNonce[agent]) revert InvalidNonce();

        worldIdRouter.verifyProof(
            root,
            groupId,
            abi.encodePacked(agent, nonce).hashToField(),
            nullifierHash,
            externalNullifierHash,
            proof
        );

        getNextNonce[agent] = nonce + 1;
        lookupHuman[agent] = nullifierHash;

        emit AgentRegistered(agent, nullifierHash, nonce);
    }
}

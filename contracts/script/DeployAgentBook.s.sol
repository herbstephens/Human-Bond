// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IWorldID} from "../src/helpers/IWorldID.sol";
import {HumanBondAgentBook} from "../src/agents/HumanBondAgentBook.sol";

/// @notice Deploys a new AgentBook; it does not modify any live HumanBond contract.
///
/// WORLD_APP_ID=app_bfc3261816aeadc589f9c6f80a98f5df \
/// AGENT_ACTION=agentbook-registration \
/// forge script script/DeployAgentBook.s.sol \
///   --rpc-url $WORLDCHAIN_RPC --private-key $PRIVATE_KEY --broadcast
contract DeployAgentBookScript is Script {
    address constant WORLD_ID_ROUTER = 0x17B354dD2595411ff79041f930e491A4Df39A278;
    uint256 constant ORB_GROUP_ID = 1;

    function run() external {
        string memory appId = vm.envString("WORLD_APP_ID");
        string memory action = vm.envOr("AGENT_ACTION", string("agentbook-registration"));

        vm.startBroadcast();
        HumanBondAgentBook agentBook =
            new HumanBondAgentBook(IWorldID(WORLD_ID_ROUTER), ORB_GROUP_ID, appId, action);
        vm.stopBroadcast();

        console.log("HumanBondAgentBook deployed at:", address(agentBook));
        console.log("  World app:", appId);
        console.log("  Action:   ", action);
        console.log("  Set HUMANBOND_AGENT_BOOK_ADDRESS to the deployed address.");
    }
}

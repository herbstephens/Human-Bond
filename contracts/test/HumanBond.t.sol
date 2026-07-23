// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, Vm, console} from "forge-std/Test.sol";
import {HumanBond} from "../src/HumanBond.sol";
import {BondNFT} from "../src/BondNFT.sol";
import {MilestoneNFT} from "../src/MilestoneNFT.sol";
import {TimeToken} from "../src/TimeToken.sol";
import {BondIdHelper} from "./utils/BondHelper.sol";
import {MockWorldID} from "./utils/MockWorldId.sol";
import {DeployScript} from "../script/Deploy.s.sol";

contract AutomationFlowTest is Test {
    BondNFT bondNft;
    MilestoneNFT milestoneNft;
    TimeToken timeToken;
    MockWorldID worldId;
    HumanBond humanBond;
    DeployScript deployer;

    address leticia = makeAddr("leticia");
    address bob = makeAddr("bob");

    // Mock World ID parameters
    uint256 constant ROOT = 1;
    uint256 constant NULLIFIER_PROPOSE = 1111;
    uint256 constant NULLIFIER_ACCEPT = 2222;
    uint256[8] proof = [uint256(0), 0, 0, 0, 0, 0, 0, 0];

    function setUp() public {
        // Deploy mock WorldID
        worldId = new MockWorldID();

        // Deploy the other contracts
        bondNft = new BondNFT();
        milestoneNft = new MilestoneNFT();
        timeToken = new TimeToken();

        // Setup milestone years (same as deploy script)
        milestoneNft.setMilestoneURI(1, "ipfs://dummy1");
        milestoneNft.setMilestoneURI(2, "ipfs://dummy2");
        milestoneNft.setMilestoneURI(3, "ipfs://dummy3");
        milestoneNft.setMilestoneURI(4, "ipfs://dummy4");
        milestoneNft.freezeMilestones();

        // Deploy HumanBond and initialize
        humanBond = new HumanBond();
        humanBond.initialize(
            address(worldId),
            address(bondNft),
            address(timeToken),
            address(milestoneNft),
            "app_test",
            "propose-bond",
            "accept-bond"
        );

        humanBond.setDayDuration(1 minutes);
        humanBond.setYearDuration(3 minutes);
        humanBond.setRebondCooldown(5 minutes);
        // Make dissolution timelock instant so tests don't accumulate extra yield
        humanBond.setDissolutionDelay(0);

        // Wire up
        milestoneNft.setHumanBondContract(address(humanBond));
        bondNft.setHumanBondContract(address(humanBond));
        timeToken.setMinter(address(humanBond), true);

        // Give ETH
        vm.deal(leticia, 10 ether);
        vm.deal(bob, 10 ether);

        // Push block.timestamp past rebondCooldown so fresh users (lastDissolutionTimestamp=0)
        // don't hit HumanBond__CooldownActive. Foundry starts at timestamp=1 which is < cooldown.
        vm.warp(humanBond.rebondCooldown() + 1);
    }

    //============================ MODIFIERS ============================//

    modifier bondedCouple() {
        vm.startPrank(leticia);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);
        vm.stopPrank();

        vm.startPrank(bob);
        humanBond.accept(leticia, ROOT, NULLIFIER_ACCEPT, proof);
        vm.stopPrank();
        _;
    }

    modifier proposalSent() {
        vm.prank(leticia);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);
        _;
    }

    function _dissolution(address requester, address partner) internal {
        vm.prank(requester);
        humanBond.requestDissolution(partner);
        vm.prank(requester);
        humanBond.executeDissolution(partner);
    }

    //test_<unitUnderTest>_<stateOrCondition>_<expectedOutcome/Behaviour>

    //============================ PROPOSAL TESTS =========================================//
    //=====================================================================================//

    function test_propose_reverts_ifCooldownActive() public bondedCouple {
        // Leticia dissolutions Bob to trigger cooldown
        _dissolution(leticia, bob);

        // Attempt to propose during cooldown
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__CooldownActive.selector);
        humanBond.propose(address(0x03), ROOT, NULLIFIER_PROPOSE, proof);
    }

    function test_propose_reverts_whenProposeToYourself() public {
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__CannotProposeToSelf.selector);
        humanBond.propose(leticia, ROOT, NULLIFIER_PROPOSE, proof);
    }

    function test_propose_reverts_ifProposeToInvalidAddress() public {
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__InvalidAddress.selector);
        humanBond.propose(address(0), ROOT, NULLIFIER_PROPOSE, proof);
    }

    function test_propose_reverts_ifAlreadyHasProposalOpen() public proposalSent {
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__ProposalAlreadyExists.selector);
        humanBond.propose(address(0x01), NULLIFIER_PROPOSE + 1, 111, proof);
    }

    function test_propose_reverts_ifAlreadyBonded() public bondedCouple {
        vm.startPrank(leticia);
        vm.expectRevert(HumanBond.HumanBond__UserAlreadyBonded.selector);
        humanBond.propose(address(0x01), NULLIFIER_PROPOSE + 1, 111, proof);

        vm.startPrank(bob);
        vm.expectRevert(HumanBond.HumanBond__UserAlreadyBonded.selector);
        humanBond.propose(address(0x02), NULLIFIER_PROPOSE + 2, 111, proof);
    }

    function test_propose_works_afterDissolution() public bondedCouple {
        _dissolution(leticia, bob);

        // Wait out the dissolution cooldown before rebonding
        skip(humanBond.rebondCooldown() + 1);

        vm.startPrank(leticia);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);
        vm.stopPrank();

        vm.prank(bob);
        humanBond.accept(leticia, ROOT, NULLIFIER_ACCEPT, proof);
    }

    function test_propose_sucessfully_storeProposal() public proposalSent {
        uint256 timeStamp = block.timestamp;
        HumanBond.Proposal memory letisProposal = humanBond.getProposal(leticia);
        assertEq(letisProposal.proposer, leticia);
        assertEq(letisProposal.proposed, bob);
        assertEq(letisProposal.timestamp, timeStamp);
    }

    function test_propose_emits_ProposalCreated() public {
        // Expect ProposalCreated
        vm.expectEmit(address(humanBond));
        emit HumanBond.ProposalCreated(leticia, bob, block.timestamp);

        vm.prank(leticia);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);
    }

    //============================ ACCEPTANCE TESTS =======================================//
    //=====================================================================================//

    function test_accept_reverts_ifNotCorrectPartnerAccept() public proposalSent {
        vm.expectRevert(HumanBond.HumanBond__NotProposedToYou.selector);
        humanBond.accept(leticia, ROOT, NULLIFIER_ACCEPT, proof);
    }

    function test_accept_reverts_ifCooldownActive() public bondedCouple {
        // Leticia dissolutions Bob to trigger cooldown
        _dissolution(leticia, bob);

        // Attempt to accept during cooldown
        vm.startPrank(address(0x04));
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE + 1, proof);
        vm.stopPrank();

        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__CooldownActive.selector);
        humanBond.accept(address(0x04), ROOT, NULLIFIER_ACCEPT, proof);
    }

    function test_accept_reverts_ifAcceptorAlreadyBonded() public proposalSent {
        // leticia already proposed to bob (proposalSent modifier)
        // carol also proposes to bob and bob accepts first — bob is now bonded
        address carol = makeAddr("carol");
        vm.prank(carol);
        humanBond.propose(bob, ROOT, 9001, proof);

        vm.prank(bob);
        humanBond.accept(carol, ROOT, 9002, proof);

        // bob tries to accept leticia's still-pending proposal while already bonded
        vm.prank(bob);
        vm.expectRevert(HumanBond.HumanBond__UserAlreadyBonded.selector);
        humanBond.accept(leticia, ROOT, NULLIFIER_ACCEPT, proof);
    }

    function test_accept_getBondId_recordsBondIdSymmetryAndPushToArray() public bondedCouple {
        BondIdHelper helper = new BondIdHelper();

        bytes32 id1 = helper.exposedGetBondId(leticia, bob);
        bytes32 id2 = helper.exposedGetBondId(bob, leticia);
        bytes32 recordedBond = humanBond.bondIds(0);

        assertEq(id1, id2, "Bond IDs should be symmetric");
        assertEq(recordedBond, id1);
    }

    function test_accept_changeAcceptToTrue() public bondedCouple {
        bool currentStatus = humanBond.isBonded(leticia, bob);

        assertEq(currentStatus, true);
    }

    function test_accept_deletes_allPreviousProposals() public proposalSent {
        vm.startPrank(bob);
        humanBond.propose(address(0x01), ROOT, NULLIFIER_PROPOSE + 1, proof);
        humanBond.accept(leticia, ROOT, NULLIFIER_ACCEPT, proof);
        vm.stopPrank();
        HumanBond.Proposal memory bobsProposal = humanBond.getProposal(bob);
        assertEq(bobsProposal.proposer, address(0));
        assertEq(bobsProposal.proposed, address(0));
    }

    function test_accept_clearsIncomingProposalCorrectly() public {
        vm.prank(leticia);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);

        vm.prank(bob);
        humanBond.accept(leticia, ROOT, NULLIFIER_ACCEPT, proof);

        HumanBond.Proposal[] memory incoming = humanBond.getIncomingProposals(bob);
        assertEq(incoming.length, 0);

        HumanBond.Proposal memory p = humanBond.getProposal(leticia);
        assertEq(p.proposer, address(0));
    }

    function test_accept_crossProposal_cleansUpBothSides() public {
        // Both propose to each other before either accepts
        vm.prank(leticia);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);

        vm.prank(bob);
        humanBond.propose(leticia, ROOT, NULLIFIER_ACCEPT, proof);

        // Bob's proposal should appear in leticia's incoming list
        HumanBond.Proposal[] memory leticiaIncoming = humanBond.getIncomingProposals(leticia);
        assertEq(leticiaIncoming.length, 1);
        assertEq(leticiaIncoming[0].proposer, bob);

        // Bob accepts leticia's proposal → crossProposed = true, both sides cleaned up
        vm.prank(bob);
        humanBond.accept(leticia, ROOT, NULLIFIER_ACCEPT, proof);

        // Neither outgoing proposal should remain
        HumanBond.Proposal memory leticiaProposal = humanBond.getProposal(leticia);
        HumanBond.Proposal memory bobProposal = humanBond.getProposal(bob);
        assertEq(leticiaProposal.proposer, address(0));
        assertEq(bobProposal.proposer, address(0));

        // Neither should appear in the other's incoming list
        HumanBond.Proposal[] memory bobIncoming = humanBond.getIncomingProposals(bob);
        leticiaIncoming = humanBond.getIncomingProposals(leticia);
        assertEq(bobIncoming.length, 0);
        assertEq(leticiaIncoming.length, 0);

        // And they are bonded
        assertEq(humanBond.isBonded(leticia, bob), true);
    }

    function test_accpet_MintsBondNFTandSendTokens() public bondedCouple {
        assertEq(bondNft.ownerOf(1), leticia);
        assertEq(bondNft.ownerOf(2), bob);
        assertEq(timeToken.balanceOf(leticia), 1 ether);
        assertEq(timeToken.balanceOf(bob), 1 ether);
    }

    //======================================= YIELD TESTS ===============================//
    //===================================================================================//

    function test_pendingYield_returnsZeroWhenBondInactive() public bondedCouple {
        // Kill bond
        _dissolution(leticia, bob);

        uint256 pending = humanBond.getPendingYield(leticia, bob);
        assertEq(pending, 0);
    }

    function test_pendingYield_recordsBalanceCorrectly() public bondedCouple {
        // warp minutes (100 TIME)
        skip(100 minutes);
        uint256 expectedBalance = humanBond.getPendingYield(leticia, bob);
        assertEq(expectedBalance, 100 ether);
    }

    function test_claimYield_reverts_ifNoYield() public bondedCouple {
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__NothingToClaim.selector);
        humanBond.claimYield(bob);
    }

    function test_claimYield_reverts_ifBondInactive() public {
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__NoActiveBond.selector);
        humanBond.claimYield(bob);
    }

    function test_claimYield_splitsTokensEvenlyAndResetsCounter() public bondedCouple {
        skip(10 minutes);

        vm.prank(leticia);
        humanBond.claimYield(bob);

        // both receive 5 TIME token + 1 initial mint
        assertEq(timeToken.balanceOf(leticia), 1 ether + 5 ether);
        assertEq(timeToken.balanceOf(bob), 1 ether + 5 ether);

        // pending yield resets to 0
        uint256 pendingAfterClaim = humanBond.getPendingYield(leticia, bob);
        assertEq(pendingAfterClaim, 0);
    }

    //==================================  MILESTONES NFTS ===============================//
    //===================================================================================//
    function test_manualCheckAndMint_reverts_ifNoActiveBond() public {
        // Leticia is NOT bonded
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__NoActiveBond.selector);
        humanBond.manualCheckAndMint(bob);
    }

    function test_manualCheckAndMint_reverts_ifYearNotReached() public bondedCouple {
        // bond just started
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__NothingToClaim.selector);
        humanBond.manualCheckAndMint(bob);
    }

    function test_manualCheckAndMint_reverts_ifYearExceedsMax() public bondedCouple {
        uint256 max = milestoneNft.latestYear();

        // warp to year = 5
        skip((max + 1));

        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__NothingToClaim.selector);
        humanBond.manualCheckAndMint(bob);
    }

    function test_manualCheckAndMint_mintsWhenYearReached() public bondedCouple {
        // warp just over 1 year (YEAR = 3 minutes)
        skip(3 minutes + 1);

        vm.prank(leticia);
        humanBond.manualCheckAndMint(bob);

        // tokenId 0 and 1 minted (soulbound)
        assertEq(milestoneNft.ownerOf(1), leticia);
        assertEq(milestoneNft.ownerOf(2), bob);

        uint256 currentYear = humanBond.getCurrentMilestoneYear(leticia, bob);
        assertEq(currentYear, 1);
    }

    function test_manualCheckAndMint_reverts_ifAlreadyMintedForYear() public bondedCouple {
        // reach year = 1
        skip(3 minutes + 1);

        vm.prank(leticia);
        humanBond.manualCheckAndMint(bob);

        // attempt again
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__NothingToClaim.selector);
        humanBond.manualCheckAndMint(bob);
    }

    function test_manualCheckAndMint_mintsMultipleYears() public bondedCouple {
        // skip 3 years → YEAR = 3 minutes
        skip(3 * 3 minutes + 1);

        vm.prank(leticia);
        humanBond.manualCheckAndMint(bob);

        // EXPECT minted years 1, 2, 3 for both
        assertEq(milestoneNft.ownerOf(1), leticia);
        assertEq(milestoneNft.ownerOf(2), bob);

        assertEq(milestoneNft.ownerOf(3), leticia);
        assertEq(milestoneNft.ownerOf(4), bob);

        assertEq(milestoneNft.ownerOf(5), leticia);
        assertEq(milestoneNft.ownerOf(6), bob);

        // state updated to latest year
        uint256 currentYear = humanBond.getCurrentMilestoneYear(leticia, bob);
        assertEq(currentYear, 3);
    }

    function test_manualCheckAndMint_capsToLatestYear() public bondedCouple {
        uint256 max = milestoneNft.latestYear(); // suppose = 4

        // warp far beyond the max (simulate 10 years)
        skip(10 * 3 minutes + 1);

        vm.prank(leticia);
        humanBond.manualCheckAndMint(bob);

        // should only mint up to max year
        assertEq(humanBond.getCurrentMilestoneYear(leticia, bob), max);

        // verify token existence
        assertEq(milestoneNft.ownerOf(1), leticia);
        assertEq(milestoneNft.ownerOf(2), bob);

        assertEq(milestoneNft.ownerOf(3), leticia);
        assertEq(milestoneNft.ownerOf(4), bob);

        assertEq(milestoneNft.ownerOf(5), leticia);
        assertEq(milestoneNft.ownerOf(6), bob);

        assertEq(milestoneNft.ownerOf(7), leticia);
        assertEq(milestoneNft.ownerOf(8), bob);

        // should NOT mint year 3 or beyond
        vm.expectRevert();
        milestoneNft.ownerOf(9);
    }

    function test_manualCheckAndMint_updatesStateCorrectly() public bondedCouple {
        // warp 2 years
        skip(2 * 3 minutes + 1);

        vm.prank(leticia);
        humanBond.manualCheckAndMint(bob);

        // state should reflect latest year minted
        assertEq(humanBond.getCurrentMilestoneYear(leticia, bob), 2);

        // calling again should revert
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__NothingToClaim.selector);
        humanBond.manualCheckAndMint(bob);
    }

    function test_manualCheckAndMint_partialYears() public bondedCouple {
        // Only milestone up to 4 years exists
        assertEq(milestoneNft.latestYear(), 4);

        // skip 5 years
        skip(5 * 3 minutes + 1);

        vm.prank(leticia);
        humanBond.manualCheckAndMint(bob);

        // should mint up to 4 years only
        assertEq(humanBond.getCurrentMilestoneYear(leticia, bob), 4);

        // year 3 should NOT exist
        vm.expectRevert();
        milestoneNft.ownerOf(9);
    }

    function test_manualCheckAndMint_emitsEventsForAllYears() public bondedCouple {
        skip(2 * 3 minutes + 1);

        vm.startPrank(leticia);
        vm.recordLogs();
        humanBond.manualCheckAndMint(bob);
        Vm.Log[] memory entries = vm.getRecordedLogs();
        vm.stopPrank();

        // should emit 2 AnniversaryAchieved events (one per year)
        uint256 count;
        for (uint256 i; i < entries.length; i++) {
            if (entries[i].topics[0] == keccak256("AnniversaryAchieved(address,address,uint256,uint256)")) {
                count++;
            }
        }
        assertEq(count, 2);
    }

    function test_tokenURI_decodesCorrectly() public bondedCouple {
        skip(3 minutes + 1);
        vm.prank(leticia);
        humanBond.manualCheckAndMint(bob);

        string memory uri = milestoneNft.tokenURI(1);
        // just log it so you can inspect it
        console.log(uri);
    }

    //=============================  DISSOLUTIONS TESTS ===============================//
    //=================================================================================//

    function test_dissolution_reverts_ifNotActiveBond() public {
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__NoActiveBond.selector);
        humanBond.requestDissolution(bob);
    }

    function test_dissolution_reverts_ifNotYourBond() public bondedCouple {
        // attacker tries to dissolution them
        address attacker = makeAddr("attacker");

        vm.prank(attacker);
        vm.expectRevert(HumanBond.HumanBond__NoActiveBond.selector);
        humanBond.requestDissolution(leticia);
    }

    function test_dissolution_claimsPendingYieldAndSplitsEvenly() public bondedCouple {
        // simulate 20 minutes (20 TIME)
        skip(20 minutes);

        uint256 expectedSplit = (20 ether) / 2;

        _dissolution(leticia, bob);

        // each receives initial 1 + 10
        assertEq(timeToken.balanceOf(leticia), 1 ether + expectedSplit);
        assertEq(timeToken.balanceOf(bob), 1 ether + expectedSplit);

        // bond should now be inactive
        bool active = humanBond.isBonded(leticia, bob);
        assertEq(active, false);
    }

    function test_dissolution_resetsActiveBondMapping() public bondedCouple {
        _dissolution(leticia, bob);

        assertEq(humanBond.activeBondOf(leticia), bytes32(0));
        assertEq(humanBond.activeBondOf(bob), bytes32(0));
    }

    function test_requestDissolution_reverts_ifAlreadyRequested() public bondedCouple {
        vm.prank(leticia);
        humanBond.requestDissolution(bob);

        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__DissolutionAlreadyRequested.selector);
        humanBond.requestDissolution(bob);
    }

    function test_executeDissolution_reverts_ifNoActiveBond() public {
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__NoActiveBond.selector);
        humanBond.executeDissolution(bob);
    }

    function test_executeDissolution_reverts_ifNoDissolutionRequest() public bondedCouple {
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__NoDissolutionRequest.selector);
        humanBond.executeDissolution(bob);
    }

    function test_executeDissolution_reverts_ifNotRequester() public bondedCouple {
        vm.prank(leticia);
        humanBond.requestDissolution(bob);

        vm.prank(bob);
        vm.expectRevert(HumanBond.HumanBond__NotYourBond.selector);
        humanBond.executeDissolution(leticia);
    }

    function test_executeDissolution_reverts_ifDelayNotMet() public bondedCouple {
        vm.expectEmit(address(humanBond));
        emit HumanBond.DissolutionDelayUpdated(3 days);
        humanBond.setDissolutionDelay(3 days);

        vm.prank(leticia);
        humanBond.requestDissolution(bob);

        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__DissolutionDelayNotMet.selector);
        humanBond.executeDissolution(bob);
    }

    function test_cancelDissolutionRequest_cancelsSuccessfully() public bondedCouple {
        vm.prank(leticia);
        humanBond.requestDissolution(bob);

        HumanBond.DissolutionRequest memory req = humanBond.getDissolutionRequest(leticia, bob);
        assertEq(req.active, true);
        assertEq(req.requester, leticia);

        vm.prank(leticia);
        humanBond.cancelDissolutionRequest(bob);

        HumanBond.DissolutionRequest memory reqAfter = humanBond.getDissolutionRequest(leticia, bob);
        assertEq(reqAfter.active, false);
        assertEq(humanBond.isBonded(leticia, bob), true);
    }

    function test_cancelDissolutionRequest_reverts_ifNoRequest() public bondedCouple {
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__NoDissolutionRequest.selector);
        humanBond.cancelDissolutionRequest(bob);
    }

    function test_cancelDissolutionRequest_reverts_ifNotRequester() public bondedCouple {
        vm.prank(leticia);
        humanBond.requestDissolution(bob);

        vm.prank(bob);
        vm.expectRevert(HumanBond.HumanBond__NotYourBond.selector);
        humanBond.cancelDissolutionRequest(leticia);
    }

    //============================ PROPOSAL MANAGEMENT TESTS ============================//
    //===================================================================================//

    function test_cancelProposal_reverts_ifNoProposal() public {
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__InvalidAddress.selector);
        humanBond.cancelProposal();
    }

    function test_cancelProposal_clearsProposalCorrectly() public proposalSent {
        vm.prank(leticia);
        humanBond.cancelProposal();

        HumanBond.Proposal memory p = humanBond.getProposal(leticia);
        assertEq(p.proposer, address(0));
        assertEq(p.proposed, address(0));
    }

    function test_addProposal_tracksIncomingCorrectly() public {
        // Leticia proposes to Bob
        vm.prank(leticia);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);

        // Check via the getter
        HumanBond.Proposal[] memory incoming = humanBond.getIncomingProposals(bob);

        assertEq(incoming.length, 1);
        assertEq(incoming[0].proposer, leticia);
        assertEq(incoming[0].proposed, bob);

        // Check that index mapping was set
        assertEq(humanBond.proposerIndex(leticia), 0);
    }

    function test_addProposal_multipleIncoming() public {
        address alice = makeAddr("alice");

        vm.prank(leticia);
        humanBond.propose(bob, ROOT, 9001, proof);

        vm.prank(alice);
        humanBond.propose(bob, ROOT, 9002, proof);

        HumanBond.Proposal[] memory incoming = humanBond.getIncomingProposals(bob);

        assertEq(incoming.length, 2);

        // check proposers (order not guaranteed but initial mapping preserves push order)
        assertEq(incoming[0].proposer, leticia);
        assertEq(incoming[1].proposer, alice);
    }

    function test_getIncomingProposals_returnsCorrectStructures() public {
        vm.prank(leticia);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);

        HumanBond.Proposal[] memory incoming = humanBond.getIncomingProposals(bob);

        assertEq(incoming.length, 1);
        assertEq(incoming[0].proposer, leticia);
        assertEq(incoming[0].proposed, bob);
    }

    function test_removeProposal_removesCorrectly_singleEntry() public {
        vm.prank(leticia);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);

        vm.prank(leticia);
        humanBond.cancelProposal();

        HumanBond.Proposal[] memory incoming = humanBond.getIncomingProposals(bob);
        assertEq(incoming.length, 0);

        // proposal struct cleared
        HumanBond.Proposal memory p = humanBond.getProposal(leticia);
        assertEq(p.proposer, address(0));
    }

    function test_removeProposal_swapsCorrectly_whenMiddleElement() public {
        address alice = makeAddr("alice");
        address carol = makeAddr("carol");

        vm.prank(leticia);
        humanBond.propose(bob, ROOT, 9001, proof);

        vm.prank(alice);
        humanBond.propose(bob, ROOT, 9002, proof);

        vm.prank(carol);
        humanBond.propose(bob, ROOT, 9003, proof);

        // Alice cancels (middle element)
        vm.prank(alice);
        humanBond.cancelProposal();

        HumanBond.Proposal[] memory incoming = humanBond.getIncomingProposals(bob);

        assertEq(incoming.length, 2);

        // ensure Alice is removed
        for (uint256 i = 0; i < incoming.length; i++) {
            assert(incoming[i].proposer != alice);
        }
    }

    //============================ REJECT PROPOSAL TESTS ================================//
    //===================================================================================//

    function test_rejectProposal_reverts_ifNotProposedToYou() public proposalSent {
        // Carol tries to reject a proposal not directed to her
        address carol = makeAddr("carol");
        vm.prank(carol);
        vm.expectRevert(HumanBond.HumanBond__NotProposedToYou.selector);
        humanBond.rejectProposal(leticia);
    }

    function test_rejectProposal_reverts_ifProposalDoesNotExist() public {
        // Bob tries to reject a proposal from leticia that was never made
        vm.prank(bob);
        vm.expectRevert(HumanBond.HumanBond__NotProposedToYou.selector);
        humanBond.rejectProposal(leticia);
    }

    function test_rejectProposal_clearsProposalStruct() public proposalSent {
        vm.prank(bob);
        humanBond.rejectProposal(leticia);

        HumanBond.Proposal memory p = humanBond.getProposal(leticia);
        assertEq(p.proposer, address(0));
        assertEq(p.proposed, address(0));
    }

    function test_rejectProposal_removesFromIncomingProposals() public proposalSent {
        vm.prank(bob);
        humanBond.rejectProposal(leticia);

        HumanBond.Proposal[] memory incoming = humanBond.getIncomingProposals(bob);
        assertEq(incoming.length, 0);
    }

    function test_rejectProposal_emits_ProposalRejected() public proposalSent {
        vm.expectEmit(address(humanBond));
        emit HumanBond.ProposalRejected(leticia, bob, block.timestamp);

        vm.prank(bob);
        humanBond.rejectProposal(leticia);
    }

    function test_rejectProposal_allowsProposerToReproposeAfterRejection() public proposalSent {
        vm.prank(bob);
        humanBond.rejectProposal(leticia);

        // Leticia should be able to propose again (no ProposalAlreadyExists revert)
        vm.prank(leticia);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);

        HumanBond.Proposal memory p = humanBond.getProposal(leticia);
        assertEq(p.proposer, leticia);
        assertEq(p.proposed, bob);
    }

    function test_rejectProposal_removesCorrectProposal_fromMultipleIncoming() public {
        address alice = makeAddr("alice");

        vm.prank(leticia);
        humanBond.propose(bob, ROOT, 9001, proof);

        vm.prank(alice);
        humanBond.propose(bob, ROOT, 9002, proof);

        // Bob rejects only leticia's proposal
        vm.prank(bob);
        humanBond.rejectProposal(leticia);

        HumanBond.Proposal[] memory incoming = humanBond.getIncomingProposals(bob);
        assertEq(incoming.length, 1);
        assertEq(incoming[0].proposer, alice);
    }

    //================================ GETTERS TESTS ==================================//
    //=================================================================================//
    function test_getBondView_returnsCorrectData() public bondedCouple {
        HumanBond.BondView memory v = humanBond.getBondView(leticia, bob);

        assertEq(v.partnerA, leticia);
        assertEq(v.partnerB, bob);
        assertEq(v.active, true);
        assertEq(v.lastMilestoneYear, 0);
        assertEq(v.pendingYield, 0); // just bonded
        assertEq(v.bondId, humanBond.activeBondOf(leticia));
    }

    function test_getCurrentMilestoneYear_returnsCorrectYear() public bondedCouple {
        skip(6 minutes + 1); // warp to year = 2

        vm.prank(leticia);
        humanBond.manualCheckAndMint(bob);

        uint256 year = humanBond.getCurrentMilestoneYear(leticia, bob);
        assertEq(year, 2);
    }

    function test_getPendingYield_returnsCorrectValue() public bondedCouple {
        // Elapsed = 10 minutes → 10 ether (because DAY = 1 minute in test)
        skip(10 minutes);

        uint256 pending = humanBond.getPendingYield(leticia, bob);
        assertEq(pending, 10 ether);
    }

    function test_getBondStart_returnsCorrectTimestamp() public bondedCouple {
        HumanBond.Bond memory m = humanBond.getBond(leticia, bob);
        uint256 stored = humanBond.getBondStart(leticia, bob);

        assertEq(stored, m.bondStart);
        assertTrue(stored > 0);
    }

    function test_getProposal_returnsCorrectData() public {
        vm.prank(leticia);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);

        HumanBond.Proposal memory p = humanBond.getProposal(leticia);

        assertEq(p.proposer, leticia);
        assertEq(p.proposed, bob);
        assertEq(p.timestamp, block.timestamp);
    }

    function test_getUserDashboard_unbondedUser() public view {
        HumanBond.UserDashboard memory d = humanBond.getUserDashboard(leticia);

        assertEq(d.isBonded, false);
        assertEq(d.partner, address(0));
        assertEq(d.pendingYield, 0);
    }

    function test_getUserDashboard_bondedUser() public bondedCouple {
        // warp 5 minutes to accumulate yield
        skip(5 minutes);

        HumanBond.UserDashboard memory d = humanBond.getUserDashboard(leticia);

        assertEq(d.isBonded, true);
        assertEq(d.partner, bob);
        assertEq(d.pendingYield, 5 ether);
    }

    function test_getBondId_isSymmetric() public view {
        bytes32 id1 = humanBond.getBondId(leticia, bob);
        bytes32 id2 = humanBond.getBondId(bob, leticia);
        assertEq(id1, id2);
        assertTrue(id1 != bytes32(0));
    }

    function test_hasPendingProposal_returnsCorrectly() public {
        assertEq(humanBond.hasPendingProposal(leticia), false);

        vm.prank(leticia);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);

        assertEq(humanBond.hasPendingProposal(leticia), true);
    }

    function test_getDissolutionRequest_returnsCorrectData() public bondedCouple {
        HumanBond.DissolutionRequest memory req = humanBond.getDissolutionRequest(leticia, bob);
        assertEq(req.active, false);

        vm.prank(leticia);
        humanBond.requestDissolution(bob);

        req = humanBond.getDissolutionRequest(leticia, bob);
        assertEq(req.active, true);
        assertEq(req.requester, leticia);
    }

    //============================== PROTOCOL COUNTERS ==================================//
    //===================================================================================//

    function test_activeBondCount_incrementsOnAccept() public bondedCouple {
        assertEq(humanBond.activeBondCount(), 1);
    }

    function test_activeBondCount_decrementsOnDissolution() public bondedCouple {
        _dissolution(leticia, bob);

        assertEq(humanBond.activeBondCount(), 0);
    }

    function test_activeBondCount_multipleCouplces() public {
        address alice = makeAddr("alice");
        address carol = makeAddr("carol");

        // Couple 1: leticia + bob
        vm.prank(leticia);
        humanBond.propose(bob, ROOT, 1001, proof);
        vm.prank(bob);
        humanBond.accept(leticia, ROOT, 1002, proof);

        // Couple 2: alice + carol
        vm.prank(alice);
        humanBond.propose(carol, ROOT, 2001, proof);
        vm.prank(carol);
        humanBond.accept(alice, ROOT, 2002, proof);

        assertEq(humanBond.activeBondCount(), 2);

        // One dissolution → count drops to 1
        _dissolution(alice, carol);

        assertEq(humanBond.activeBondCount(), 1);
    }

    function test_totalDissolutionCount_incrementsOnDissolution() public bondedCouple {
        assertEq(humanBond.totalDissolutionCount(), 0);

        _dissolution(leticia, bob);

        assertEq(humanBond.totalDissolutionCount(), 1);
    }

    function test_totalDissolutionCount_doesNotDecrementOnRebond() public bondedCouple {
        _dissolution(leticia, bob);

        // Wait out cooldown and rebond
        skip(humanBond.rebondCooldown() + 1);

        vm.prank(leticia);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);
        vm.prank(bob);
        humanBond.accept(leticia, ROOT, NULLIFIER_ACCEPT, proof);

        // Dissolution count stays at 1; bond count is back to 1
        assertEq(humanBond.totalDissolutionCount(), 1);
        assertEq(humanBond.activeBondCount(), 1);
    }

    function test_counters_accumulateAcrossMultipleDissolutions() public {
        address alice = makeAddr("alice");
        address carol = makeAddr("carol");

        address[3] memory proposers = [leticia, alice, carol];
        address[3] memory acceptors = [bob, makeAddr("dave"), makeAddr("eve")];
        uint256 nullBase = 3000;

        // bond 3 couples
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(proposers[i]);
            humanBond.propose(acceptors[i], ROOT, nullBase + i * 2, proof);
            vm.prank(acceptors[i]);
            humanBond.accept(proposers[i], ROOT, nullBase + i * 2 + 1, proof);
        }

        assertEq(humanBond.activeBondCount(), 3);
        assertEq(humanBond.totalDissolutionCount(), 0);

        // Dissolution all 3
        for (uint256 i = 0; i < 3; i++) {
            _dissolution(proposers[i], acceptors[i]);
        }

        assertEq(humanBond.activeBondCount(), 0);
        assertEq(humanBond.totalDissolutionCount(), 3);
    }

    //====================================TIME TOKEN ====================================//
    //===================================================================================//
    function test_timetoken_onlyOwnerAndContractCanMint() public {
        timeToken.mint(leticia, 10 ether); // owner mint
        assertEq(timeToken.balanceOf(leticia), 10 ether);

        vm.prank(address(humanBond));
        timeToken.mint(bob, 5 ether); // humanBond mint
        assertEq(timeToken.balanceOf(bob), 5 ether);

        vm.prank(address(0x999));
        vm.expectRevert(TimeToken.NotAuthorized.selector);
        timeToken.mint(bob, 1 ether); // unauthorized mint
    }

    function test_timetoken_setMinter_reverts_ifZeroAddress() public {
        vm.expectRevert(TimeToken.InvalidAddress.selector);
        timeToken.setMinter(address(0), true);
    }

    function test_timetoken_setBurner_reverts_ifZeroAddress() public {
        vm.expectRevert(TimeToken.InvalidAddress.selector);
        timeToken.setBurner(address(0), true);
    }

    function test_timetoken_setBurner_setsAuthorization() public {
        timeToken.setBurner(address(humanBond), true);
        assertEq(timeToken.authorizedBurners(address(humanBond)), true);
    }

    function test_timetoken_setBurner_revokesAuthorization() public {
        timeToken.setBurner(address(humanBond), true);
        timeToken.setBurner(address(humanBond), false);
        assertEq(timeToken.authorizedBurners(address(humanBond)), false);
    }

    function test_timetoken_setBurner_emits_BurnerSet() public {
        vm.expectEmit(address(timeToken));
        emit TimeToken.BurnerSet(address(humanBond), true);
        timeToken.setBurner(address(humanBond), true);
    }

    function test_timetoken_authorizedBurn_reverts_ifNotAuthorized() public {
        timeToken.mint(leticia, 10 ether);

        vm.prank(address(0x999));
        vm.expectRevert(TimeToken.NotAuthorized.selector);
        timeToken.authorizedBurn(leticia, 5 ether);
    }

    function test_timetoken_authorizedBurn_ownerCanBurn() public {
        timeToken.mint(leticia, 10 ether);
        timeToken.authorizedBurn(leticia, 5 ether);
        assertEq(timeToken.balanceOf(leticia), 5 ether);
    }

    function test_timetoken_authorizedBurn_authorizedContractCanBurn() public {
        timeToken.mint(leticia, 10 ether);
        timeToken.setBurner(address(humanBond), true);

        vm.prank(address(humanBond));
        timeToken.authorizedBurn(leticia, 4 ether);

        assertEq(timeToken.balanceOf(leticia), 6 ether);
    }

    function test_timetoken_authorizedBurn_burnsCorrectAmount() public {
        timeToken.mint(bob, 20 ether);
        timeToken.setBurner(address(humanBond), true);

        vm.prank(address(humanBond));
        timeToken.authorizedBurn(bob, 15 ether);

        assertEq(timeToken.balanceOf(bob), 5 ether);
    }

    function test_timetoken_authorizedBurn_unauthorizedAfterRevoke() public {
        timeToken.mint(leticia, 10 ether);
        timeToken.setBurner(address(humanBond), true);
        timeToken.setBurner(address(humanBond), false);

        vm.prank(address(humanBond));
        vm.expectRevert(TimeToken.NotAuthorized.selector);
        timeToken.authorizedBurn(leticia, 5 ether);
    }

    //============================== SETTERS MANAGEMENT =================================//
    //===================================================================================//

    // ---- setWorldId ----

    function test_setWorldId_reverts_ifNotOwner() public {
        vm.prank(leticia);
        vm.expectRevert();
        humanBond.setWorldId(address(0x99));
    }

    function test_setWorldId_reverts_ifZeroAddress() public {
        vm.expectRevert(HumanBond.HumanBond__InvalidAddress.selector);
        humanBond.setWorldId(address(0));
    }

    function test_setWorldId_updatesWorldId() public {
        address newWorldId = address(0xBEEF);
        humanBond.setWorldId(newWorldId);
        assertEq(address(humanBond.worldId()), newWorldId);
    }

    function test_setWorldId_emits_WorldIdUpdated() public {
        address newWorldId = address(0xBEEF);
        vm.expectEmit(address(humanBond));
        emit HumanBond.WorldIdUpdated(newWorldId);
        humanBond.setWorldId(newWorldId);
    }

    // ---- setRebondCooldown ----

    function test_setRebondCooldown_reverts_ifNotOwner() public {
        vm.prank(leticia);
        vm.expectRevert();
        humanBond.setRebondCooldown(1 days);
    }

    function test_setRebondCooldown_updatesValue() public {
        humanBond.setRebondCooldown(7 days);
        assertEq(humanBond.rebondCooldown(), 7 days);
    }

    function test_setRebondCooldown_emits_RebondCooldownUpdated() public {
        vm.expectEmit(address(humanBond));
        emit HumanBond.RebondCooldownUpdated(7 days);
        humanBond.setRebondCooldown(7 days);
    }

    function test_setRebondCooldown_zero_allowsImmediateRebond() public bondedCouple {
        _dissolution(leticia, bob);

        // Set cooldown to zero — leticia can propose immediately
        humanBond.setRebondCooldown(0);

        vm.prank(leticia);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);
    }

    function test_setRebondCooldown_enforcesNewPeriod() public bondedCouple {
        _dissolution(leticia, bob);

        // Extend cooldown to 30 days — leticia should be blocked
        humanBond.setRebondCooldown(30 days);

        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__CooldownActive.selector);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);

        // After waiting the full new cooldown she can propose again
        skip(30 days + 1);
        vm.prank(leticia);
        humanBond.propose(bob, ROOT, NULLIFIER_PROPOSE, proof);
    }

    // ---- setDayDuration ----

    function test_setDayDuration_reverts_ifNotOwner() public {
        vm.prank(leticia);
        vm.expectRevert();
        humanBond.setDayDuration(2 minutes);
    }

    function test_setDayDuration_updatesValue() public {
        humanBond.setDayDuration(2 minutes);
        assertEq(humanBond.dayDuration(), 2 minutes);
    }

    function test_setDayDuration_emits_DayDurationUpdated() public {
        vm.expectEmit(address(humanBond));
        emit HumanBond.DayDurationUpdated(2 minutes);
        humanBond.setDayDuration(2 minutes);
    }

    function test_setDayDuration_affectsYieldCalculation() public bondedCouple {
        // Change day duration to 2 minutes (double the default 1 minute)
        humanBond.setDayDuration(2 minutes);

        // After 10 minutes with a 2-minute day → 5 days → 5 ether
        skip(10 minutes);
        uint256 pending = humanBond.getPendingYield(leticia, bob);
        assertEq(pending, 5 ether);
    }

    // ---- setYearDuration ----

    function test_setYearDuration_reverts_ifNotOwner() public {
        vm.prank(leticia);
        vm.expectRevert();
        humanBond.setYearDuration(10 minutes);
    }

    function test_setYearDuration_updatesValue() public {
        humanBond.setYearDuration(10 minutes);
        assertEq(humanBond.yearDuration(), 10 minutes);
    }

    function test_setYearDuration_emits_YearDurationUpdated() public {
        vm.expectEmit(address(humanBond));
        emit HumanBond.YearDurationUpdated(10 minutes);
        humanBond.setYearDuration(10 minutes);
    }

    function test_setYearDuration_affectsMilestoneEligibility() public bondedCouple {
        // Set year duration to 10 minutes (longer than default 3 minutes)
        humanBond.setYearDuration(10 minutes);

        // After only 5 minutes — not yet a full year with new duration
        skip(5 minutes);
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__NothingToClaim.selector);
        humanBond.manualCheckAndMint(bob);

        // After 10 minutes — one year has passed with the new duration
        skip(5 minutes + 1);
        vm.prank(leticia);
        humanBond.manualCheckAndMint(bob);
        assertEq(humanBond.getCurrentMilestoneYear(leticia, bob), 1);
    }

    // ---- setDissolutionDelay ----

    function test_setDissolutionDelay_reverts_ifNotOwner() public {
        vm.prank(leticia);
        vm.expectRevert();
        humanBond.setDissolutionDelay(7 days);
    }

    function test_setDissolutionDelay_updatesValue() public {
        humanBond.setDissolutionDelay(7 days);
        assertEq(humanBond.dissolutionDelay(), 7 days);
    }

    function test_setDissolutionDelay_enforcesNewDelay() public bondedCouple {
        humanBond.setDissolutionDelay(10 days);

        vm.prank(leticia);
        humanBond.requestDissolution(bob);

        // Attempting execution before the new delay elapses should revert
        skip(5 days);
        vm.prank(leticia);
        vm.expectRevert(HumanBond.HumanBond__DissolutionDelayNotMet.selector);
        humanBond.executeDissolution(bob);

        // After the full delay it succeeds
        skip(5 days + 1);
        vm.prank(leticia);
        humanBond.executeDissolution(bob);
        assertEq(humanBond.isBonded(leticia, bob), false);
    }

    // ---- setBondNft ----

    function test_setBondNft_reverts_ifNotOwner() public {
        vm.prank(leticia);
        vm.expectRevert();
        humanBond.setBondNft(address(0x99));
    }

    function test_setBondNft_reverts_ifZeroAddress() public {
        vm.expectRevert(HumanBond.HumanBond__InvalidAddress.selector);
        humanBond.setBondNft(address(0));
    }

    function test_setBondNft_updatesValue() public {
        address newBondNft = address(new BondNFT());
        humanBond.setBondNft(newBondNft);
        assertEq(address(humanBond.bondNft()), newBondNft);
    }

    function test_setBondNft_emits_BondNftUpdated() public {
        address newBondNft = address(new BondNFT());
        vm.expectEmit(address(humanBond));
        emit HumanBond.BondNftUpdated(newBondNft);
        humanBond.setBondNft(newBondNft);
    }

    // ---- setMilestoneNft ----

    function test_setMilestoneNft_reverts_ifNotOwner() public {
        vm.prank(leticia);
        vm.expectRevert();
        humanBond.setMilestoneNft(address(0x99));
    }

    function test_setMilestoneNft_reverts_ifZeroAddress() public {
        vm.expectRevert(HumanBond.HumanBond__InvalidAddress.selector);
        humanBond.setMilestoneNft(address(0));
    }

    function test_setMilestoneNft_updatesValue() public {
        address newMilestoneNft = address(new MilestoneNFT());
        humanBond.setMilestoneNft(newMilestoneNft);
        assertEq(address(humanBond.milestoneNft()), newMilestoneNft);
    }

    function test_setMilestoneNft_emits_MilestoneNftUpdated() public {
        address newMilestoneNft = address(new MilestoneNFT());
        vm.expectEmit(address(humanBond));
        emit HumanBond.MilestoneNftUpdated(newMilestoneNft);
        humanBond.setMilestoneNft(newMilestoneNft);
    }
}

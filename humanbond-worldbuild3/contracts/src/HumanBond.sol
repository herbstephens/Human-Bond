// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {VowNFT} from "./VowNFT.sol";
import {TimeToken} from "./TimeToken.sol";
import {MilestoneNFT} from "./MilestoneNFT.sol";
import {ByteHasher} from "./helpers/ByteHasher.sol";
import {IWorldID} from "./helpers/IWorldID.sol";

/**
 * @title HumanBond
 * @author Leticia Azevedo (@letiweb3)
 * @notice Main contract managing verified marriages
 *  @dev Uses World ID verification to confirm both users are real humans,
 *      then mints dynamic metadata NFTs and TIME ERC-20 tokens for a verified bond.
 */
contract HumanBond is Ownable {
    using ByteHasher for bytes;

    error HumanBond__UserAlreadyMarried();
    error HumanBond__InvalidAddress();
    error HumanBond__ProposalAlreadyExists();
    error HumanBond__NotYourMarriage();
    error HumanBond__NoActiveMarriage();
    error HumanBond__CannotProposeToSelf();
    error HumanBond__NotProposedToYou();
    error HumanBond__AlreadyAccepted();
    error HumanBond__NothingToClaim();
    error HumanBond__CooldownActive();

    /* ----------------------------- STRUCTS ----------------------------- */
    //Represents a pending bond request:
    struct Proposal {
        address proposer;
        address proposed;
        uint256 proposerNullifier;
        bool accepted;
        uint256 timestamp;
    }

    //Represents an active relationship between two verified humans
    struct Marriage {
        address partnerA;
        address partnerB;
        uint256 nullifierA; //represent human identities from World ID
        uint256 nullifierB;
        uint256 bondStart;
        uint256 lastClaim;
        uint256 lastMilestoneYear;
        bool active;
    }

    // View struct for external read-only access
    struct MarriageView {
        address partnerA;
        address partnerB;
        uint256 nullifierA;
        uint256 nullifierB;
        uint256 bondStart;
        uint256 lastClaim;
        uint256 lastMilestoneYear;
        bool active;
        uint256 pendingYield;
        bytes32 marriageId;
    }

    // View struct for user dashboard
    struct UserDashboard {
        bool isMarried;
        bool hasProposal;
        address partner;
        uint256 pendingYield;
        uint256 timeBalance;
    }

    /* --------------------------- STATE VARS --------------------------- */
    mapping(address => Proposal) public proposals;
    mapping(address => address[]) public proposalsFor; // proposed address => array of proposers
    mapping(address => uint256) public proposerIndex; // proposer address => index in proposalsFor[proposed]
    mapping(bytes32 => Marriage) public marriages;
    mapping(address => bytes32) public activeMarriageOf; // quick lookup of active marriage ID by user address
    mapping(address => uint256) public lastDivorceTimestamp;

    bytes32[] public marriageIds; //So every couple has a unique “marriage fingerprint”

    IWorldID public immutable worldId;
    VowNFT public immutable vowNFT;
    TimeToken public immutable timeToken;
    MilestoneNFT public immutable milestoneNFT;
    uint256 public immutable externalNullifierPropose;
    uint256 public immutable externalNullifierAccept;
    uint256 public immutable DAY; // 1 day = 1 TIME token reward shared
    uint256 public immutable YEAR; // 1 YEAR = new milestone NFT eligibility
    uint256 public immutable DIVORCE_COOLDOWN;
    uint256 public constant GROUP_ID = 1; // World ID Orb-only group. Required by World ID Route

    uint256 public activeMarriageCount;
    uint256 public totalDivorceCount;

    /* ----------------------------- EVENTS ----------------------------- */
    event ProposalCreated(address indexed proposer, address indexed proposed);
    event ProposalAccepted(address indexed partnerA, address indexed partnerB);
    event YieldClaimed(address indexed partnerA, address indexed partnerB, uint256 rewardEach);
    event AnniversaryAchieved(address indexed partnerA, address indexed partnerB, uint256 year, uint256 timestamp);
    event MarriageDissolved(address indexed partnerA, address indexed partnerB, uint256 timestamp);
    event ProposalCancelled(address indexed proposer, address indexed proposed);

    /* --------------------------- CONSTRUCTOR -------------------------- */
    constructor(
        address _worldIdRouter,
        address _VowNFT,
        address _TimeToken,
        address _milestoneNFT,
        string memory _appId,
        string memory _actionPropose,
        string memory _actionAccept,
        uint256 _day,
        uint256 _year,
        uint256 _DivorceCooldown
    ) Ownable(msg.sender) {
        worldId = IWorldID(_worldIdRouter);
        vowNFT = VowNFT(_VowNFT);
        timeToken = TimeToken(_TimeToken);
        milestoneNFT = MilestoneNFT(_milestoneNFT);

        // Compute external nullifiers exactly as World ID expects, define action domain for proofs
        externalNullifierPropose =
            abi.encodePacked(abi.encodePacked(_appId).hashToField(), _actionPropose).hashToField();

        externalNullifierAccept = abi.encodePacked(abi.encodePacked(_appId).hashToField(), _actionAccept).hashToField();
        DAY = _day;
        YEAR = _year;
        DIVORCE_COOLDOWN = _DivorceCooldown;
    }

    /* ---------------------------- FUNCTIONS --------------------------- */

    /// @notice Propose a bond to another verified human using World ID.
    /// @param proposed The address of the person being proposed to.
    /// @param root The World ID root from the proof.
    /// @param proposerNullifier The unique nullifier preventing proof re-use.
    /// @param proof The zero-knowledge proof array.
    function propose(address proposed, uint256 root, uint256 proposerNullifier, uint256[8] calldata proof) external {
        uint256 signalHash = abi.encodePacked(msg.sender).hashToField(); //prove msg.sender is signer
        // in propose(), add this check early:
        if (block.timestamp - lastDivorceTimestamp[msg.sender] < DIVORCE_COOLDOWN) {
            revert HumanBond__CooldownActive();
        }
        if (proposed == address(0)) {
            revert HumanBond__InvalidAddress();
        }
        if (proposed == msg.sender) {
            revert HumanBond__CannotProposeToSelf();
        }
        if (proposals[msg.sender].proposer != address(0)) {
            revert HumanBond__ProposalAlreadyExists();
        }
        if (activeMarriageOf[msg.sender] != bytes32(0) || activeMarriageOf[proposed] != bytes32(0)) {
            revert HumanBond__UserAlreadyMarried();
        }

        // Verify proposer is a real human via World ID
        worldId.verifyProof(root, GROUP_ID, signalHash, proposerNullifier, externalNullifierPropose, proof);

        //Store proposal
        proposals[msg.sender] = Proposal({
            proposer: msg.sender,
            proposed: proposed,
            proposerNullifier: proposerNullifier,
            accepted: false,
            timestamp: block.timestamp
        });

        _addProposal(msg.sender, proposed); //track who proposed to whom

        emit ProposalCreated(msg.sender, proposed);
    }

    /// @notice Accept an existing proposal, verify humanity, and mint NFTs + ERC-20.
    /// @param proposer The address of the original proposer.
    /// @param root The World ID root from the proof.
    /// @param acceptorNullifier The unique nullifier preventing proof re-use.
    /// @param proof The zero-knowledge proof array.
    function accept(address proposer, uint256 root, uint256 acceptorNullifier, uint256[8] calldata proof) external {
        Proposal storage proposalOfProposer = proposals[proposer]; // the struct stored, previously created in propose()
        uint256 signalHash = abi.encodePacked(msg.sender).hashToField();

        if (proposalOfProposer.proposed != msg.sender) {
            revert HumanBond__NotProposedToYou();
        }
        if (activeMarriageOf[proposer] != bytes32(0) || activeMarriageOf[msg.sender] != bytes32(0)) {
            revert HumanBond__UserAlreadyMarried();
        } //not reaching, propose function reverts before

        // Verify acceptor is also a real human
        worldId.verifyProof(
            root,
            GROUP_ID,
            signalHash, // signal = sender address
            acceptorNullifier,
            externalNullifierAccept,
            proof
        );

        // Create marriage ID
        bytes32 marriageId = _getMarriageId(proposer, msg.sender);
        if (marriages[marriageId].active) {
            revert HumanBond__UserAlreadyMarried();
        }

        // proposalOfProposer.accepted = true;

        // Record bond data
        marriages[marriageId] = Marriage({
            partnerA: proposer,
            partnerB: msg.sender,
            nullifierA: proposalOfProposer.proposerNullifier,
            nullifierB: acceptorNullifier,
            bondStart: block.timestamp,
            lastClaim: block.timestamp,
            lastMilestoneYear: 0,
            active: true
        });

        activeMarriageOf[proposer] = marriageId; //active marriage ID by user address
        activeMarriageOf[msg.sender] = marriageId;
        activeMarriageCount++;

        delete proposals[proposer]; // Clear previous proposals — for remarrying
        delete proposals[msg.sender];
        _removeProposal(proposer, msg.sender); //remove proposal from tracking mappings

        marriageIds.push(marriageId);

        // Mint identical NFTs for both partners
        vowNFT.mintVowNFT(proposer, proposer, msg.sender, block.timestamp, marriageId);
        vowNFT.mintVowNFT(msg.sender, proposer, msg.sender, block.timestamp, marriageId);

        // Reward both parties with 1 TOKEN immediately
        timeToken.mint(proposer, 1 ether);
        timeToken.mint(msg.sender, 1 ether);

        emit ProposalAccepted(proposer, msg.sender);
    }

    /**
     * @notice Allows either partner to dissolve the marriage.
     *         Pending yield is distributed evenly, and both are marked unmarried.
     */
    function divorce(address partner) external {
        bytes32 marriageId = _getMarriageId(msg.sender, partner); //reuses deterministic pair ID system.
        Marriage storage marriage = marriages[marriageId];

        if (marriage.active == false) {
            revert HumanBond__NoActiveMarriage();
        }
        if (msg.sender != marriage.partnerA && msg.sender != marriage.partnerB) {
            revert HumanBond__NotYourMarriage();
        }

        uint256 reward = _pendingYield(marriageId); //calculates how much tokens they earned since the last claim.
        // Claim pending yield (1 token/day shared) before divorce
        if (reward > 0) {
            uint256 split = reward / 2;
            timeToken.mint(marriage.partnerA, split);
            // timeToken.mint(marriage.partnerB, split);
            timeToken.mint(marriage.partnerB, reward - split); // captures remainder
        }

        // Mark marriage as inactive
        marriage.active = false;
        marriage.lastClaim = block.timestamp;
        lastDivorceTimestamp[marriage.partnerA] = block.timestamp;
        lastDivorceTimestamp[marriage.partnerB] = block.timestamp;
        activeMarriageCount--;
        totalDivorceCount++;

        // Allow remarriage
        activeMarriageOf[marriage.partnerA] = bytes32(0);
        activeMarriageOf[marriage.partnerB] = bytes32(0);

        emit MarriageDissolved(marriage.partnerA, marriage.partnerB, block.timestamp);
    }

    /* ---------------------------- YIELD LOGIC --------------------------- */
    /// @dev Calculate pending yield for a marriage, 1 token per day shared.
    /// @param marriageId The unique ID representing the marriage.
    function _pendingYield(bytes32 marriageId) internal view returns (uint256) {
        Marriage storage marriage = marriages[marriageId];
        if (!marriage.active) return 0;
        uint256 daysElapsed = (block.timestamp - marriage.lastClaim) / DAY;
        return daysElapsed * 1 ether;
    }

    /// @notice Claim accumulated yield for the calling user's marriage.
    /// @param partner The address of the calling user's partner.
    function claimYield(address partner) external {
        bytes32 marriageId = _getMarriageId(msg.sender, partner);
        Marriage storage marriage = marriages[marriageId];
        if (!marriage.active) revert HumanBond__NoActiveMarriage();

        uint256 reward = _pendingYield(marriageId);
        if (reward == 0) {
            revert HumanBond__NothingToClaim();
        }

        uint256 split = reward / 2;

        timeToken.mint(marriage.partnerA, split);
        timeToken.mint(marriage.partnerB, reward - split); // captures remainder

        marriage.lastClaim = block.timestamp;
        emit YieldClaimed(marriage.partnerA, marriage.partnerB, split);
    }

    /* ---------------------------- NFT's MINTING LOGIC --------------------------- */

    /// @notice Manually check and mint milestone NFTs for both partners based on years together.
    ///         if they missed previous years, mint all missing years up to current.
    function manualCheckAndMint(address partner) external {
        bytes32 id = _getMarriageId(msg.sender, partner); //get the deterministic marriageId of the couple
        Marriage storage m = marriages[id]; // get the marriage struct based on the id

        if (!m.active) revert HumanBond__NoActiveMarriage();

        address a = m.partnerA;
        address b = m.partnerB;
        if (msg.sender != a && msg.sender != b) {
            revert HumanBond__NotYourMarriage();
        }

        uint256 bondStart = m.bondStart; // when the marriage started
        uint256 yearsTogether = (block.timestamp - bondStart) / YEAR; // how many years together
        uint256 lastClaimed = m.lastMilestoneYear; // the last milestone year they claimed NFTs for
        uint256 highestYearSet = milestoneNFT.latestYear(); // the max year defined by MilestoneNFT

        // If no milestones set since last claim or zero years together, revert
        if (yearsTogether <= lastClaimed || yearsTogether == 0) {
            revert HumanBond__NothingToClaim();
        }

        // if yearsTogether exceeds highestYearSet, cap it to highestYearSet
        uint256 endYear = yearsTogether > highestYearSet ? highestYearSet : yearsTogether;
        uint256 startYear = lastClaimed + 1; // the year after the last claimed milestone, +1 to avoid double minting

        // if the last claimed year is already the highest year set, nothing to mint
        if (startYear > endYear) revert HumanBond__NothingToClaim();

        // Mint all missing years
        for (uint256 y = startYear; y <= endYear;) {
            milestoneNFT.mintMilestone(a, y);
            milestoneNFT.mintMilestone(b, y);

            emit AnniversaryAchieved(a, b, y, block.timestamp);

            unchecked {
                y++; // gas saving
            }
        }

        m.lastMilestoneYear = endYear;
    }

    /* --------------------------- PROPOSALS ------------------------------- */

    /// @notice Cancel an existing proposal made by the caller.
    function cancelProposal() external {
        Proposal memory proposalOfProposer = proposals[msg.sender];
        if (proposalOfProposer.proposer == address(0)) {
            revert HumanBond__InvalidAddress();
        }
        delete proposals[msg.sender];
        _removeProposal(msg.sender, proposalOfProposer.proposed);

        emit ProposalCancelled(msg.sender, proposalOfProposer.proposed);
    }

    /* --------------------------- INTERNAL HELPER -------------------------- */

    /// @dev Internal function to add a proposal to the tracking mappings.
    function _addProposal(address proposer, address proposed) internal {
        proposalsFor[proposed].push(proposer);
        proposerIndex[proposer] = proposalsFor[proposed].length - 1;
    }

    /// @dev Internal function to remove a proposal from the tracking mappings.
    function _removeProposal(address proposer, address proposed) internal {
        uint256 idx = proposerIndex[proposer];
        uint256 lastIdx = proposalsFor[proposed].length - 1;

        if (idx != lastIdx) {
            // swap with last element
            address lastProposer = proposalsFor[proposed][lastIdx];
            proposalsFor[proposed][idx] = lastProposer;
            proposerIndex[lastProposer] = idx;
        }

        proposalsFor[proposed].pop();
        delete proposerIndex[proposer];
    }

    /// @dev Generate a unique marriage ID for a couple based on their addresses.
    ///      Order of addresses does not matter.
    function _getMarriageId(address a, address b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    /* --------------------------- GETTERS FUNCTIONS -------------------------- */

    /// @dev Get all incoming proposals for a user, meaning proposals made to them.
    function getIncomingProposals(address user) external view returns (Proposal[] memory) {
        address[] memory proposers = proposalsFor[user];
        Proposal[] memory incoming = new Proposal[](proposers.length);

        for (uint256 i = 0; i < proposers.length; i++) {
            incoming[i] = proposals[proposers[i]];
        }

        return incoming;
    }

    /// @dev Get active marriage struct for a couple, e.g. addresses, timestamps, status.
    function getMarriage(address a, address b) external view returns (Marriage memory) {
        return marriages[_getMarriageId(a, b)];
    }

    /// @dev Get deterministic marriage ID for a couple.
    function getMarriageId(address a, address b) external pure returns (bytes32) {
        return _getMarriageId(a, b);
    }

    /// @dev Check if two addresses are currently married
    function isMarried(address a, address b) external view returns (bool) {
        return marriages[_getMarriageId(a, b)].active;
    }

    /// @dev Get proposal info for a proposer
    function getProposal(address proposer) external view returns (Proposal memory) {
        return proposals[proposer];
    }

    /// @dev Get proposal info for a proposer
    function hasPendingProposal(address proposer) external view returns (bool) {
        return proposals[proposer].proposer != address(0);
    }

    /// @dev Get the current pending yield for a couple
    function getPendingYield(address a, address b) external view returns (uint256) {
        return _pendingYield(_getMarriageId(a, b));
    }

    /// @dev Get the current milestone year for a couple
    function getCurrentMilestoneYear(address a, address b) external view returns (uint256) {
        return marriages[_getMarriageId(a, b)].lastMilestoneYear;
    }

    /// @dev Get the bond start timestamp for a couple
    function getBondStart(address a, address b) external view returns (uint256) {
        return marriages[_getMarriageId(a, b)].bondStart;
    }

    /// @dev Get a read-only view struct for a couple's marriage details
    function getMarriageView(address a, address b) external view returns (MarriageView memory v) {
        bytes32 id = _getMarriageId(a, b);
        Marriage memory m = marriages[id];

        v = MarriageView({
            partnerA: m.partnerA,
            partnerB: m.partnerB,
            nullifierA: m.nullifierA,
            nullifierB: m.nullifierB,
            bondStart: m.bondStart,
            lastClaim: m.lastClaim,
            lastMilestoneYear: m.lastMilestoneYear,
            active: m.active,
            pendingYield: _pendingYield(id),
            marriageId: _getMarriageId(a, b)
        });
    }

    /// @dev Get user dashboard info: marriage status, pending yield, TIME balance, proposal status
    function getUserDashboard(address user) external view returns (UserDashboard memory d) {
        bytes32 marriageId = activeMarriageOf[user]; //Read active marriage

        if (marriageId == bytes32(0)) {
            // User is NOT married
            d.isMarried = false;
            d.partner = address(0);
            d.pendingYield = 0;
            d.hasProposal = proposals[user].proposer != address(0);
            d.timeBalance = timeToken.balanceOf(user);
            return d;
        }

        // User IS married
        Marriage storage m = marriages[marriageId];
        d.isMarried = m.active;
        d.partner = (m.partnerA == user) ? m.partnerB : m.partnerA;
        d.pendingYield = _pendingYield(marriageId);
    }
}

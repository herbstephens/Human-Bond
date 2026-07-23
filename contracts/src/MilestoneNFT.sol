// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {Base64} from "openzeppelin-contracts/contracts/utils/Base64.sol";

/**
 * @title MilestoneNFT
 * @author Leticia Azevedo (@letiweb3)
 * @notice Soulbound-style NFT collection that represents yearly milestones of a verified Human Bond.
 *         Each milestone has its own unique metadata and image.
 */
contract MilestoneNFT is ERC721, Ownable {
    using Strings for uint256;

    error MilestoneNFT__TransfersDisabled();
    error MilestoneNFT__NotAuthorized();
    error MilestoneNFT__Frozen();
    error MilestoneNFT__URI_NotFound(uint256 year);
    error MilestoneNFT__InvalidAddress();

    struct TokenMetadata {
        address partnerA;
        address partnerB;
        bytes32 bondId;
        uint256 bondStart;
        uint256 claimedAt;
    }

    /* -------------------------------------------------------------------------- */
    /*                                 STATE VARS                                 */
    /* -------------------------------------------------------------------------- */

    uint256 public totalSupply; // Counter for minted NFTs
    address public humanBondContract; // Authorized minter
    mapping(uint256 => string) public milestoneUrIs; // year => IPFS URI of the image
    mapping(uint256 tokenId => uint256 year) public tokenYear; // tokenId => milestone year
    mapping(uint256 tokenId => TokenMetadata) public tokenData; // tokenId => metadata about the bond
    uint256 public latestYear; // Highest milestone year set
    bool public frozen; // Freeze further edits

    /* -------------------------------------------------------------------------- */
    /*                                    EVENTS                                  */
    /* -------------------------------------------------------------------------- */

    event MilestoneURISet(uint256 indexed year, string uri);
    event MilestoneMinted(address indexed user, uint256 year, uint256 tokenId, uint256 timestamp);
    event MilestonesFrozen();
    event HumanBondContractSet(address indexed contractAddress);

    /* -------------------------------------------------------------------------- */
    /*                                 CONSTRUCTOR                                */
    /* -------------------------------------------------------------------------- */

    constructor() ERC721("Milestone NFT", "MILE") Ownable(msg.sender) {}

    /* -------------------------------------------------------------------------- */
    /*                                MODIFIERS                                   */
    /* -------------------------------------------------------------------------- */

    modifier onlyHumanBond() {
        _onlyHumanBond();
        _;
    }

    function _onlyHumanBond() internal view {
        if (msg.sender != humanBondContract) {
            revert MilestoneNFT__NotAuthorized();
        }
    }

    modifier notFrozen() {
        _notFrozen();
        _;
    }

    function _notFrozen() internal view {
        if (frozen) revert MilestoneNFT__Frozen();
    }

    /* -------------------------------------------------------------------------- */
    /*                              ADMIN FUNCTIONS                               */
    /* -------------------------------------------------------------------------- */

    /// @notice Sets the address of the HumanBond contract authorized to mint NFTs.
    function setHumanBondContract(address contractAddress) external onlyOwner {
        if (contractAddress == address(0)) {
            revert MilestoneNFT__InvalidAddress();
        }
        humanBondContract = contractAddress;
        emit HumanBondContractSet(contractAddress);
    }

    /// @notice Define or update the metadata URI for a specific milestone year.
    /// @dev Example: setMilestoneURI(1, "ipfs://QmCID1");
    function setMilestoneURI(uint256 year, string calldata uri) external onlyOwner notFrozen {
        if (year == 0) revert MilestoneNFT__URI_NotFound(year);
        if (bytes(uri).length == 0) revert MilestoneNFT__URI_NotFound(year);
        milestoneUrIs[year] = uri;
        if (year > latestYear) latestYear = year;
        emit MilestoneURISet(year, uri);
    }

    /// @notice Lock milestone URIs to prevent further modification.
    function freezeMilestones() external onlyOwner notFrozen {
        frozen = true;
        emit MilestonesFrozen();
    }

    /* -------------------------------------------------------------------------- */
    /*                               MINT FUNCTION                                */
    /* -------------------------------------------------------------------------- */

    /// @notice Mint the NFT corresponding to a specific milestone year. Only the HumanBond contract can call this.
    /// @dev Minting is intentionally NOT gated by the `frozen` flag — freeze only locks URI updates.
    ///      Any milestone year whose URI was not configured before freezing will permanently revert with URI_NotFound.
    /// @param to Recipient of the NFT.
    /// @param year The milestone year being claimed.
    /// @param partnerA Address of the first partner.
    /// @param partnerB Address of the second partner.
    /// @param bondId Unique identifier for the bond.
    /// @param bondStart Timestamp when the bond was created.
    /// @return tokenId The ID of the newly minted token.
    function mintMilestone(
        address to,
        uint256 year,
        address partnerA,
        address partnerB,
        bytes32 bondId,
        uint256 bondStart
    ) external onlyHumanBond returns (uint256) {
        string memory uri = milestoneUrIs[year];
        if (bytes(uri).length == 0) revert MilestoneNFT__URI_NotFound(year);

        totalSupply++;
        uint256 tokenId = totalSupply;
        tokenYear[tokenId] = year;
        tokenData[tokenId] = TokenMetadata({
            partnerA: partnerA, partnerB: partnerB, bondId: bondId, bondStart: bondStart, claimedAt: block.timestamp
        });
        _safeMint(to, tokenId);

        emit MilestoneMinted(to, year, tokenId, block.timestamp);
        return tokenId;
    }

    /* -------------------------------------------------------------------------- */
    /*                                 VIEW LOGIC                                 */
    /* -------------------------------------------------------------------------- */

    /// @notice Returns the on-chain base64-encoded JSON metadata URI for a token.
    /// @param tokenId The token ID to query.
    /// @return Base64-encoded data URI containing the token's JSON metadata and attributes.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        uint256 year = tokenYear[tokenId];
        TokenMetadata memory m = tokenData[tokenId];

        string memory image = milestoneUrIs[year];
        if (bytes(image).length == 0) revert MilestoneNFT__URI_NotFound(year);

        string memory attrs = string(
            abi.encodePacked(
                '[{"trait_type":"Milestone Year","value":"',
                Strings.toString(year),
                '"},',
                '{"trait_type":"Partner A","value":"',
                Strings.toHexString(uint256(uint160(m.partnerA)), 20),
                '"},',
                '{"trait_type":"Partner B","value":"',
                Strings.toHexString(uint256(uint160(m.partnerB)), 20),
                '"},',
                '{"trait_type":"Bond ID","value":"',
                Strings.toHexString(uint256(m.bondId), 32),
                '"},',
                '{"trait_type":"Bond Start","value":"',
                Strings.toString(m.bondStart),
                '"},',
                '{"trait_type":"Claimed At","value":"',
                Strings.toString(m.claimedAt),
                '"},',
                '{"trait_type":"Verification","value":"World ID Proof"}]'
            )
        );

        string memory name = string.concat("Human Bond Milestone - Year ", Strings.toString(year));
        string memory description =
            string.concat("Year ", Strings.toString(year), " milestone of a verified human bond on World Chain.");

        string memory json = string(
            abi.encodePacked(
                '{"name":"', name, '","description":"', description, '","image":"', image, '","attributes":', attrs, "}"
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(json))));
    }

    /* -------------------------------------------------------------------------- */
    /*                             SOULBOUND OVERRIDES                             */
    /* -------------------------------------------------------------------------- */

    /// @dev Soulbound: blocks all post-mint operations (transfers and burns). Only minting (from == address(0)) is allowed.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert MilestoneNFT__TransfersDisabled();
        return super._update(to, tokenId, auth);
    }
}

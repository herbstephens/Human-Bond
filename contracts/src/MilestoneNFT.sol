// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title MilestoneNFT
 * @author Leticia Azevedo (@letiweb3)
 * @notice Soulbound-style NFT collection that represents relationship anniversaries.
 *         Each year milestone can have its own metadata URI defined by the owner.
 *         Only the HumanBond contract can mint new NFTs.
 */
contract MilestoneNFT is ERC721, Ownable {
    error MilestoneNFT__TransfersDisabled();
    error MilestoneNFT__NotAuthorized();
    error MilestoneNFT__Frozen();
    error MilestoneNFT__URI_NotFound(uint256 year);

    /* -------------------------------------------------------------------------- */
    /*                                 STATE VARS                                 */
    /* -------------------------------------------------------------------------- */

    uint256 public totalSupply; // Also Counter for minted NFTs
    address public humanBondContract; // Authorized minter
    mapping(uint256 => string) public milestoneURIs; // year => IPFS URI of the
    mapping(uint256 tokenId => uint256 year) public tokenYear; // tokenId => milestone year
    uint256 public latestYear; // Highest milestone year set
    bool public frozen; // Prevents further edits once locked

    /* -------------------------------------------------------------------------- */
    /*                                    EVENTS                                  */
    /* -------------------------------------------------------------------------- */

    event MilestoneURISet(uint256 indexed year, string uri);
    event MilestoneMinted(address indexed user, uint256 year, uint256 tokenId, uint256 timestamp);
    event MilestonesFrozen();

    /* -------------------------------------------------------------------------- */
    /*                                 CONSTRUCTOR                                */
    /* -------------------------------------------------------------------------- */

    constructor() ERC721("Milestone NFT", "MILE") Ownable(msg.sender) {
        totalSupply = 0;
    }

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
        humanBondContract = contractAddress;
    }

    /// @notice Define or update the metadata URI for a specific milestone year.
    /// @dev Example: setMilestoneURI(1, "ipfs://QmCID1");
    function setMilestoneURI(uint256 year, string calldata uri) external onlyOwner notFrozen {
        if (year == 0) revert MilestoneNFT__URI_NotFound(year);
        milestoneURIs[year] = uri;
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

    /// @notice Mint the NFT corresponding to a specific milestone year.
    /// @dev Can only be called by the HumanBond contract.
    function mintMilestone(address to, uint256 year) external onlyHumanBond returns (uint256) {
        string memory uri = milestoneURIs[year];
        if (bytes(uri).length == 0) revert MilestoneNFT__URI_NotFound(year);

        totalSupply++;
        uint256 tokenId = totalSupply;
        tokenYear[tokenId] = year;
        _safeMint(to, tokenId);

        emit MilestoneMinted(to, year, tokenId, block.timestamp);
        return tokenId;
    }

    /* -------------------------------------------------------------------------- */
    /*                                 VIEW LOGIC                                 */
    /* -------------------------------------------------------------------------- */

    /// @notice Returns the token URI based on the milestone year of the token.
    /// @dev Reverts if the URI for the token's year is not set.
    /// @param tokenId The ID of the token.
    /// @return The metadata URI associated with the token's milestone year.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        uint256 year = tokenYear[tokenId];
        if (bytes(milestoneURIs[year]).length == 0) {
            revert MilestoneNFT__URI_NotFound(year);
        }
        return milestoneURIs[year];
    }

    /* -------------------------------------------------------------------------- */
    /*                             SOULBOUND OVERRIDES                             */
    /* -------------------------------------------------------------------------- */

    /// @dev Override to disable transfers, making the NFT soulbound.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        // Allow mint (from == 0x0)
        address from = _ownerOf(tokenId);

        // If NOT minting and NOT burning, forbid transfers
        if (from != address(0) && to != from) {
            revert MilestoneNFT__TransfersDisabled();
        }

        return super._update(to, tokenId, auth);
    }
}

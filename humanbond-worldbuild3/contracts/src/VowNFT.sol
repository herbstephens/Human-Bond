// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {Base64} from "openzeppelin-contracts/contracts/utils/Base64.sol";

/**
 * @title VowNFT
 * @author Leticia Azevedo (@letiweb3)
 * @dev ERC-721 token representing a verified human bond.
 *      Each NFT stores metadata about the two partners and a unique marriage ID.
 */
contract VowNFT is ERC721, Ownable {
    using Strings for uint256;

    error VowNFT__UnauthorizedMinter();
    error VowNFT__TransfersDisabled();
    uint256 public totalSupply;
    string public imageCID = "ipfs://bafkreigg2jeevy3rhgzgnhk22vsbclszceos3jlzg4otuqal62vwokzwai"; //placeholder image CID

    address public humanBondContract; //authorized minter address
    mapping(uint256 => TokenMetadata) public tokenMetadata;
    mapping(bytes32 => uint256[2]) public marriageToToken; // marriageId -> two tokenIds (0 if not set)

    event VowMinted(bytes32 indexed marriageId, uint256 indexed tokenId, address indexed to);

    struct TokenMetadata {
        address partnerA;
        address partnerB;
        uint256 bondStart;
        bytes32 marriageId;
    }

    modifier onlyHumanBond() {
        _onlyHumanBond();
        _;
    }

    function _onlyHumanBond() internal view {
        if (msg.sender != humanBondContract) {
            revert VowNFT__UnauthorizedMinter();
        }
    }

    constructor() ERC721("Vows", "VOW") Ownable(msg.sender) {
        totalSupply = 0;
    }

    /// @notice Set the HumanBond contract address
    function setHumanBondContract(address contractAddress) external onlyOwner {
        humanBondContract = contractAddress;
    }

    /// @notice Set the image CID for all NFTs
    function setImageCID(string calldata newCid) external onlyOwner {
        imageCID = newCid;
    }

    /// @notice Mint a Bond NFT to a given address.
    //only HumanBond contract can mint
    function mintVowNFT(address to, address _partnerA, address _partnerB, uint256 _bondStart, bytes32 _marriageId)
        external
        onlyHumanBond
        returns (uint256)
    {
        totalSupply++;

        tokenMetadata[totalSupply] =
            TokenMetadata({partnerA: _partnerA, partnerB: _partnerB, bondStart: _bondStart, marriageId: _marriageId});

        _safeMint(to, totalSupply);

        if (marriageToToken[_marriageId][0] == 0) {
            marriageToToken[_marriageId][0] = totalSupply;
        } else {
            marriageToToken[_marriageId][1] = totalSupply;
        }

        emit VowMinted(_marriageId, totalSupply, to);

        return totalSupply;
    }

    /// @notice Returns the static IPFS metadata URI for all tokens.
    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);

        TokenMetadata memory m = tokenMetadata[id];

        // Build attributes JSON (addresses and bytes32 encoded to hex strings)
        string memory attrs = string(
            abi.encodePacked(
                "[",
                '{"trait_type":"partnerA","value":"',
                Strings.toHexString(uint256(uint160(m.partnerA)), 20),
                '"},',
                '{"trait_type":"partnerB","value":"',
                Strings.toHexString(uint256(uint160(m.partnerB)), 20),
                '"},',
                '{"trait_type":"marriageDate","value":"',
                Strings.toString(m.bondStart),
                '"},',
                '{"trait_type":"marriageId","value":"',
                Strings.toHexString(uint256(m.marriageId), 32),
                '"}',
                "]"
            )
        );

        string memory json = string(
            abi.encodePacked(
                '{"name":"Human Bond NFT #',
                id.toString(),
                '","description":"Human verified bond recorded on-chain. Each token represents a unique commitment between two verified humans.",',
                '"image":"',
                imageCID,
                '",',
                '"attributes":',
                attrs,
                "}"
            )
        );

        string memory encoded = Base64.encode(bytes(json));
        return string(abi.encodePacked("data:application/json;base64,", encoded));
    }

    /* -------------------------------------------------------------------------- */
    /*                             SOULBOUND OVERRIDES                             */
    /* -------------------------------------------------------------------------- */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);

        if (from != address(0) && to != from) {
            revert VowNFT__TransfersDisabled();
        }

        return super._update(to, tokenId, auth);
    }

    /// @notice Getter for token metadata
    function getTokenMetadata(uint256 id)
        external
        view
        returns (address partnerA, address partnerB, uint256 bondStart, bytes32 marriageId)
    {
        _requireOwned(id);
        TokenMetadata memory m = tokenMetadata[id];
        return (m.partnerA, m.partnerB, m.bondStart, m.marriageId);
    }

    /// @notice Get token ids for a marriage (returns [tokenA, tokenB], 0 if slot not set)
    function getTokensByMarriage(bytes32 marriageId) external view returns (uint256[2] memory) {
        return marriageToToken[marriageId];
    }
}

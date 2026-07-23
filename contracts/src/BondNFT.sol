// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";
import {Base64} from "openzeppelin-contracts/contracts/utils/Base64.sol";

/**
 * @title BondNFT
 * @author Leticia Azevedo (@letiweb3)
 * @dev ERC-721 token representing a verified human bond.
 *      Each NFT stores metadata about the two partners and a unique Bond ID.
 */
contract BondNFT is ERC721, Ownable {
    using Strings for uint256;

    error BondNFT__UnauthorizedMinter();
    error BondNFT__TransfersDisabled();
    error BondNFT__InvalidAddress();
    uint256 public totalSupply;

    string public imageURI = "ipfs://bafkreieeq6mqrapuwa5uceqcno6xn5cryicidq6z27xpmdlw5l3z5v2dsu";

    address public humanBondContract; //authorized minter address
    mapping(uint256 => TokenMetadata) public tokenMetadata;
    mapping(bytes32 => uint256[]) public bondToToken; // bondId -> tokenIds (0 if not set)

    event BondMinted(bytes32 indexed bondId, uint256 indexed tokenId, address indexed to);
    event HumanBondContractSet(address indexed contractAddress);
    event ImageURISet(string newURI);

    struct TokenMetadata {
        address partnerA;
        address partnerB;
        uint256 bondStart;
        bytes32 bondId;
    }

    modifier onlyHumanBond() {
        _onlyHumanBond();
        _;
    }

    function _onlyHumanBond() internal view {
        if (msg.sender != humanBondContract) {
            revert BondNFT__UnauthorizedMinter();
        }
    }

    constructor() ERC721("Human Bond NFT", "HB") Ownable(msg.sender) {}

    /// @notice Set the HumanBond contract address
    function setHumanBondContract(address contractAddress) external onlyOwner {
        if (contractAddress == address(0)) revert BondNFT__InvalidAddress();
        humanBondContract = contractAddress;
        emit HumanBondContractSet(contractAddress);
    }

    /// @notice Set the image URI for all NFTs
    /// @dev e.g. "ipfs://bafkreigg2jeevy3rhgzgnhk22vsbclszceos3jlzg4otuqal62vwokzwai"
    function setImageURI(string calldata newURI) external onlyOwner {
        imageURI = newURI;
        emit ImageURISet(newURI);
    }

    /// @notice Mint a Bond NFT to a given address.
    function mintBondNft(address to, address _partnerA, address _partnerB, uint256 _bondStart, bytes32 _bondId)
        external
        onlyHumanBond
        returns (uint256)
    {
        totalSupply++;
        uint256 tokenId = totalSupply;

        tokenMetadata[tokenId] =
            TokenMetadata({partnerA: _partnerA, partnerB: _partnerB, bondStart: _bondStart, bondId: _bondId});

        bondToToken[_bondId].push(tokenId);

        _safeMint(to, tokenId);

        emit BondMinted(_bondId, tokenId, to);

        return tokenId;
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
                '{"trait_type":"bondDate","value":"',
                Strings.toString(m.bondStart),
                '"},',
                '{"trait_type":"bondId","value":"',
                Strings.toHexString(uint256(m.bondId), 32),
                '"}',
                "]"
            )
        );

        string memory json = string(
            abi.encodePacked(
                '{"name":"Human Bond NFT #',
                id.toString(),
                '","description":"A Human Bond recorded on-chain. Each token represents a unique commitment between two World ID verified humans.",',
                '"image":"',
                imageURI,
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
    /*                             SOULBOUND OVERRIDES                            */
    /* -------------------------------------------------------------------------- */
    /// @dev Fully soulbound — tokens can only be minted. Transfers and burns are permanently disabled.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);

        if (from != address(0)) revert BondNFT__TransfersDisabled();

        return super._update(to, tokenId, auth);
    }

    /* -------------------------------------------------------------------------- */
    /*                                  GETTERS                                   */
    /* -------------------------------------------------------------------------- */
    /// @notice Getter for token metadata
    function getTokenMetadata(uint256 id)
        external
        view
        returns (address partnerA, address partnerB, uint256 bondStart, bytes32 bondId)
    {
        _requireOwned(id);
        TokenMetadata memory m = tokenMetadata[id];
        return (m.partnerA, m.partnerB, m.bondStart, m.bondId);
    }

    /// @notice Get token ids for a bond (returns [tokenA, tokenB], 0 if slot not set)
    function getTokensByBond(bytes32 bondId) external view returns (uint256[] memory) {
        return bondToToken[bondId];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @notice Stand-in for Durin's L2Registry, faithful on the parts HumanBondRegistrar depends on.
 *
 * @dev Deliberately reproduces three behaviours that are easy to get wrong and that a looser
 *      mock would hide:
 *
 *      1. `_safeMint`, so a subname owner that cannot receive ERC-721s makes registration revert.
 *         That is the real failure mode for a Safe without a fallback handler.
 *      2. `_multicall` via `delegatecall` to self, so `msg.sender` stays the registrar and the
 *         record writes inherit registrar authorisation — same as ENS's Multicallable.
 *      3. The namehash check on each multicall entry: every record write must target the node
 *         being created.
 *
 *      Real-registry behaviour is covered separately by the fork test.
 */
contract MockL2Registry is ERC721 {
    error Unauthorized(bytes32 node);
    error NotAvailable(string label, bytes32 parentNode);

    bytes32 public baseNode;
    mapping(address => bool) public registrars;

    mapping(bytes32 => address) public addrOf; // node => coinType-60 address
    mapping(bytes32 => mapping(uint256 => bytes)) public coinAddrOf; // node => coinType => addr
    mapping(bytes32 => mapping(string => string)) public textOf; // node => key => value

    constructor(bytes32 _baseNode, address admin) ERC721("humanbond.eth", "HB") {
        baseNode = _baseNode;
        _safeMint(admin, uint256(_baseNode));
    }

    function addRegistrar(address registrar) external {
        registrars[registrar] = true;
    }

    function removeRegistrar(address registrar) external {
        registrars[registrar] = false;
    }

    function owner(bytes32 node) public view returns (address) {
        return _ownerOf(uint256(node));
    }

    function makeNode(bytes32 parentNode, string calldata label) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(parentNode, keccak256(bytes(label))));
    }

    function createSubnode(bytes32 node, string calldata label, address _owner, bytes[] calldata data)
        external
        returns (bytes32)
    {
        if (owner(node) != msg.sender && !registrars[msg.sender]) revert Unauthorized(node);

        bytes32 subnode = makeNode(node, label);
        if (owner(subnode) != address(0)) revert NotAvailable(label, node);

        _safeMint(_owner, uint256(subnode));
        _multicall(subnode, data);
        return subnode;
    }

    /* --------------------------- RESOLVER ---------------------------- */

    function setAddr(bytes32 node, address a) external {
        _auth(node);
        addrOf[node] = a;
    }

    function setAddr(bytes32 node, uint256 coinType, bytes calldata a) external {
        _auth(node);
        coinAddrOf[node][coinType] = a;
    }

    function setText(bytes32 node, string calldata key, string calldata value) external {
        _auth(node);
        textOf[node][key] = value;
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return textOf[node][key];
    }

    /* ---------------------------- INTERNAL --------------------------- */

    /// @dev Durin authorises any registrar on any node; otherwise the node owner.
    function _auth(bytes32 node) private view {
        if (registrars[msg.sender]) return;
        if (owner(node) != msg.sender) revert Unauthorized(node);
    }

    function _multicall(bytes32 nodehash, bytes[] calldata data) private {
        for (uint256 i = 0; i < data.length; i++) {
            bytes32 txNamehash = bytes32(data[i][4:36]);
            require(txNamehash == nodehash, "multicall: All records must have a matching namehash");
            (bool ok,) = address(this).delegatecall(data[i]);
            require(ok, "multicall: call failed");
        }
    }
}

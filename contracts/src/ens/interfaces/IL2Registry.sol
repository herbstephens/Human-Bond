// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IL2Registry
 * @notice Minimal view of Durin's L2Registry — the subset HumanBondRegistrar needs.
 * @dev Mirrors namestonehq/durin `src/interfaces/IL2Registry.sol`. Kept local rather than
 *      pulling in the whole Durin dependency tree for four functions.
 *
 *      The registry is both an ERC-721 (one token per name, tokenId == uint256(node)) and a
 *      full ENS resolver, so `setAddr`/`setText` live on the same contract as `createSubnode`.
 */
interface IL2Registry {
    /// @notice namehash of the parent name this registry serves, e.g. namehash("humanbond.eth").
    function baseNode() external view returns (bytes32);

    /// @notice True if `registrar` may mint subnodes and write records on any node.
    function registrars(address registrar) external view returns (bool);

    /// @notice Owner of a node, or address(0) if the name does not exist.
    function owner(bytes32 node) external view returns (address);

    /// @notice Deterministic child node. Pure — safe to call in a view context.
    function makeNode(bytes32 parentNode, string calldata label) external pure returns (bytes32);

    /**
     * @notice Mint a subname and apply its records in one call.
     * @param node Parent node.
     * @param label Label to mint under it.
     * @param _owner Receiver of the subname NFT.
     * @param data Encoded resolver calls applied to the new subnode.
     * @dev `data` runs through ENS's Multicallable, which delegatecalls each entry and requires
     *      every call's first 32-byte argument to equal the new subnode. Because it delegatecalls,
     *      `msg.sender` stays this registrar — which is why registrar authorisation carries over.
     *
     *      Note `_safeMint` is used internally: `_owner` must accept ERC-721 transfers.
     */
    function createSubnode(bytes32 node, string calldata label, address _owner, bytes[] calldata data)
        external
        returns (bytes32);

    /// @notice Sets the coinType-60 (mainnet ETH) address record.
    function setAddr(bytes32 node, address addr) external;

    /// @notice Sets a chain-specific address record (ENSIP-11 coinType).
    function setAddr(bytes32 node, uint256 coinType, bytes calldata a) external;

    /// @notice Sets a text record.
    function setText(bytes32 node, string calldata key, string calldata value) external;
}

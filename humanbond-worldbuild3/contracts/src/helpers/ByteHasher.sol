// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library ByteHasher {
    /// @dev Creates a keccak256 hash of a bytestring and shifts right 8 bits
    ///      so it's inside the SNARK field.
    function hashToField(bytes memory value) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(value))) >> 8;
    }
}

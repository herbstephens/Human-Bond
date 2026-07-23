// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HumanBond} from "../../src/HumanBond.sol";

contract BondIdHelper is HumanBond {
    constructor() HumanBond() {}

    /// @notice Expose internal function for testing
    function exposedGetBondId(address a, address b) external pure returns (bytes32) {
        return _getBondId(a, b);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HumanBond} from "../../src/HumanBond.sol";

contract MarriageIdHelper is HumanBond {
    constructor() HumanBond(address(0), address(0), address(0), address(0), "", "", "", 0, 0, 0) {}

    /// @notice Expose internal function for testing
    function exposed_getMarriageId(address a, address b) external pure returns (bytes32) {
        return _getMarriageId(a, b);
    }
}

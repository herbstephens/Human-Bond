// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal stand-in for a Safe: just enough to exercise BondVaultModule without pulling
///         in safe-contracts. Real-Safe behaviour is covered separately by the fork test.
contract MockSafe {
    mapping(address => bool) public enabledModules;
    address[] internal owners;
    uint256 internal threshold;

    /// @dev Lets tests simulate a Safe whose inner call fails, to check the module surfaces it.
    bool public failNextCall;

    constructor(address[] memory _owners, uint256 _threshold) {
        owners = _owners;
        threshold = _threshold;
    }

    function enableModule(address module) external {
        enabledModules[module] = true;
    }

    function disableModule(address module) external {
        enabledModules[module] = false;
    }

    function setFailNextCall(bool v) external {
        failNextCall = v;
    }

    function setOwners(address[] memory _owners) external {
        owners = _owners;
    }

    function setThreshold(uint256 _t) external {
        threshold = _t;
    }

    function isModuleEnabled(address module) external view returns (bool) {
        return enabledModules[module];
    }

    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    function getThreshold() external view returns (uint256) {
        return threshold;
    }

    function execTransactionFromModule(address to, uint256 value, bytes calldata data, uint8)
        external
        returns (bool)
    {
        require(enabledModules[msg.sender], "MockSafe: not a module");
        if (failNextCall) return false;
        (bool ok,) = to.call{value: value}(data);
        return ok;
    }

    function execTransactionFromModuleReturnData(address to, uint256 value, bytes calldata data, uint8)
        external
        returns (bool, bytes memory)
    {
        require(enabledModules[msg.sender], "MockSafe: not a module");
        if (failNextCall) return (false, "");
        (bool ok, bytes memory ret) = to.call{value: value}(data);
        return (ok, ret);
    }

    /// @dev Real Safes accept ERC-721s via CompatibilityFallbackHandler, which the bond vault
    ///      wires up in its setup() call. Mirrored here because the ENS subname is an ERC-721
    ///      minted straight to the vault — without this the registration reverts.
    ///      `setRejectsNfts(true)` reproduces a Safe deployed with no fallback handler.
    bool public rejectsNfts;

    function setRejectsNfts(bool v) external {
        rejectsNfts = v;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external view returns (bytes4) {
        if (rejectsNfts) return bytes4(0);
        return this.onERC721Received.selector;
    }

    receive() external payable {}
}

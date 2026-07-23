// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20, ERC20Burnable} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title TIME Token
 * @author Leticia Azevedo (@letiweb3)
 * @notice ERC20 token representing time for World ID Verified Humans.
 */
contract TimeToken is ERC20, ERC20Burnable, Ownable {
    mapping(address => bool) public authorizedMinters;
    mapping(address => bool) public authorizedBurners;

    error NotAuthorized();
    error InvalidAddress();

    event MinterSet(address indexed minter, bool authorized);
    event BurnerSet(address indexed burner, bool authorized);

    constructor() ERC20("TIME", "TIME") Ownable(msg.sender) {}

    /// @notice Set or revoke minter authorization for an address.
    function setMinter(address minter, bool authorized) external onlyOwner {
        if (minter == address(0)) revert InvalidAddress();
        authorizedMinters[minter] = authorized;
        emit MinterSet(minter, authorized);
    }

    /// @notice Set or revoke burner authorization for an address.
    function setBurner(address burner, bool authorized) external onlyOwner {
        if (burner == address(0)) revert InvalidAddress();
        authorizedBurners[burner] = authorized;
        emit BurnerSet(burner, authorized);
    }

    /// @notice Mint new tokens to a specified address.
    function mint(address to, uint256 amount) external {
        if (msg.sender != owner() && !authorizedMinters[msg.sender]) {
            revert NotAuthorized();
        }
        _mint(to, amount);
    }

    // authorized contract burning (no approve() needed)
    function authorizedBurn(address from, uint256 amount) external {
        if (msg.sender != owner() && !authorizedBurners[msg.sender]) {
            revert NotAuthorized();
        }
        _burn(from, amount);
    }
}

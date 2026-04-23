// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20, ERC20Burnable} from "openzeppelin-contracts/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title TIME Token
 * @author Leticia Azevedo (@letiweb3)
 * @dev A basic ERC20 token used for rewarding married users.
 */
contract TimeToken is ERC20, ERC20Burnable, Ownable {
    address public humanBondContract;

    error NotAuthorized();

    constructor() ERC20("TIME", "TIME") Ownable(msg.sender) {}

    function setHumanBondContract(address _hb) external onlyOwner {
        humanBondContract = _hb;
    }

    /// @notice Mint new DAY tokens to a specified address.
    function mint(address to, uint256 amount) external {
        if (msg.sender != owner() && msg.sender != humanBondContract) {
            revert NotAuthorized();
        }

        _mint(to, amount);
    }
}

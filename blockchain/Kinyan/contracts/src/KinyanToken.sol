// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title KinyanToken (KNY)
/// @notice ERC20 token used as the payment currency in the Kinyan dApp.
contract KinyanToken is ERC20, Ownable {
    constructor(uint256 initialSupply) ERC20("KinyanToken", "KNY") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    /// @notice Owner can mint more tokens.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

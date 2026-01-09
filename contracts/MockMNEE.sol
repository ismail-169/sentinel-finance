// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockMNEE is ERC20, Ownable {
    mapping(address => uint256) public lastFaucetClaim;
    uint256 public faucetAmount = 1000 * 10**18;
    uint256 public faucetCooldown = 1 hours;

    constructor() ERC20("Mock MNEE", "MNEE") Ownable(msg.sender) {
        _mint(msg.sender, 1000000 * 10**18);
    }

    function faucet() external {
        require(
            block.timestamp > lastFaucetClaim[msg.sender] + faucetCooldown,
            "Wait for cooldown"
        );
        lastFaucetClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, faucetAmount);
    }

    function canClaimFaucet(address user) external view returns (bool) {
        return block.timestamp > lastFaucetClaim[user] + faucetCooldown;
    }

    function timeUntilNextClaim(address user) external view returns (uint256) {
        uint256 nextClaim = lastFaucetClaim[user] + faucetCooldown;
        if (block.timestamp >= nextClaim) return 0;
        return nextClaim - block.timestamp;
    }

    function setFaucetAmount(uint256 amount) external onlyOwner {
        faucetAmount = amount;
    }

    function setFaucetCooldown(uint256 cooldown) external onlyOwner {
        faucetCooldown = cooldown;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

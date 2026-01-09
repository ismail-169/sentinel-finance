// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./SentinelVault.sol";

contract VaultFactory {
    address public mneeToken;
    address public admin;
    
    mapping(address => address) public userVaults;
    address[] public allVaults;
    
    event VaultCreated(address indexed user, address indexed vault);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor(address _mneeToken) {
        mneeToken = _mneeToken;
        admin = msg.sender;
    }

    function createVault() external returns (address) {
        require(userVaults[msg.sender] == address(0), "Vault already exists");
        
        SentinelVault vault = new SentinelVault(msg.sender, mneeToken);
        
        userVaults[msg.sender] = address(vault);
        allVaults.push(address(vault));
        
        emit VaultCreated(msg.sender, address(vault));
        return address(vault);
    }

    function getUserVault(address user) external view returns (address) {
        return userVaults[user];
    }

    function hasVault(address user) external view returns (bool) {
        return userVaults[user] != address(0);
    }

    function getTotalVaults() external view returns (uint256) {
        return allVaults.length;
    }

    function setMneeToken(address _mneeToken) external onlyAdmin {
        mneeToken = _mneeToken;
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid address");
        admin = newAdmin;
    }
}

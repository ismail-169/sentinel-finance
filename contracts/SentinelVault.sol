// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SentinelVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public owner;
    IERC20 public mneeToken;
    
    uint256 public dailyLimit;
    uint256 public transactionLimit;
    uint256 public timeLockDuration;
    uint256 public dailySpent;
    uint256 public lastDayReset;
    uint256 public txCounter;

    struct Transaction {
        address agent;
        address vendor;
        uint256 amount;
        uint256 timestamp;
        uint256 executeAfter;
        bool executed;
        bool revoked;
        string reason;
    }

    mapping(uint256 => Transaction) public transactions;
    mapping(address => bool) public trustedVendors;
    mapping(address => bool) public approvedAgents;

    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event PaymentRequested(uint256 indexed txId, address indexed agent, address indexed vendor, uint256 amount, uint256 executeAfter);
    event PaymentExecuted(uint256 indexed txId);
    event PaymentRevoked(uint256 indexed txId, string reason);
    event VendorUpdated(address indexed vendor, bool trusted);
    event AgentUpdated(address indexed agent, bool approved);
    event LimitsUpdated(uint256 dailyLimit, uint256 transactionLimit, uint256 timeLockDuration);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyApprovedAgent() {
        require(approvedAgents[msg.sender] || msg.sender == owner, "Not approved agent");
        _;
    }

    constructor(address _owner, address _mneeToken) {
        owner = _owner;
        mneeToken = IERC20(_mneeToken);
        dailyLimit = 10000 * 10**18;
        transactionLimit = 1000 * 10**18;
        timeLockDuration = 60;
        lastDayReset = block.timestamp;
        approvedAgents[_owner] = true;
    }

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        mneeToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(amount <= getVaultBalance(), "Insufficient balance");
        mneeToken.safeTransfer(owner, amount);
        emit Withdrawn(owner, amount);
    }

    function withdrawAll() external onlyOwner nonReentrant {
        uint256 balance = getVaultBalance();
        require(balance > 0, "No balance");
        mneeToken.safeTransfer(owner, balance);
        emit Withdrawn(owner, balance);
    }

    function getVaultBalance() public view returns (uint256) {
        return mneeToken.balanceOf(address(this));
    }

    function requestPayment(address vendor, uint256 amount, address agent) external onlyApprovedAgent returns (uint256) {
        require(amount > 0, "Amount must be > 0");
        require(amount <= getVaultBalance(), "Insufficient balance");
        require(amount <= transactionLimit, "Exceeds transaction limit");

        if (block.timestamp > lastDayReset + 1 days) {
            dailySpent = 0;
            lastDayReset = block.timestamp;
        }
        require(dailySpent + amount <= dailyLimit, "Exceeds daily limit");

        uint256 lockTime = trustedVendors[vendor] ? 0 : timeLockDuration;

        transactions[txCounter] = Transaction({
            agent: agent,
            vendor: vendor,
            amount: amount,
            timestamp: block.timestamp,
            executeAfter: block.timestamp + lockTime,
            executed: false,
            revoked: false,
            reason: ""
        });

        emit PaymentRequested(txCounter, agent, vendor, amount, block.timestamp + lockTime);
        
        txCounter++;
        return txCounter - 1;
    }

    function executePayment(uint256 txId) external nonReentrant {
        Transaction storage txn = transactions[txId];
        require(!txn.executed, "Already executed");
        require(!txn.revoked, "Transaction revoked");
        require(block.timestamp >= txn.executeAfter, "Timelock not passed");
        require(txn.amount <= getVaultBalance(), "Insufficient balance");

        if (block.timestamp > lastDayReset + 1 days) {
            dailySpent = 0;
            lastDayReset = block.timestamp;
        }

        txn.executed = true;
        dailySpent += txn.amount;
        
        mneeToken.safeTransfer(txn.vendor, txn.amount);
        emit PaymentExecuted(txId);
    }

    function revokeTransaction(uint256 txId, string calldata reason) external onlyOwner {
        Transaction storage txn = transactions[txId];
        require(!txn.executed, "Already executed");
        require(!txn.revoked, "Already revoked");
        
        txn.revoked = true;
        txn.reason = reason;
        emit PaymentRevoked(txId, reason);
    }

    function setTrustedVendor(address vendor, bool trusted) external onlyOwner {
        trustedVendors[vendor] = trusted;
        emit VendorUpdated(vendor, trusted);
    }

    function setApprovedAgent(address agent, bool approved) external onlyOwner {
        approvedAgents[agent] = approved;
        emit AgentUpdated(agent, approved);
    }

    function setLimits(uint256 _dailyLimit, uint256 _transactionLimit, uint256 _timeLockDuration) external onlyOwner {
        dailyLimit = _dailyLimit;
        transactionLimit = _transactionLimit;
        timeLockDuration = _timeLockDuration;
        emit LimitsUpdated(_dailyLimit, _transactionLimit, _timeLockDuration);
    }

    function getTransaction(uint256 txId) external view returns (Transaction memory) {
        return transactions[txId];
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        approvedAgents[owner] = false;
        owner = newOwner;
        approvedAgents[newOwner] = true;
    }
}

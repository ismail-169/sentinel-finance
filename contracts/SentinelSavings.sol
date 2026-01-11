// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SentinelSavings
 * @notice Time-locked savings contract for MNEE token
 * @dev Funds can ONLY be withdrawn to the user's registered vault address after unlock
 */
contract SentinelSavings is ReentrancyGuard {
    
    IERC20 public immutable mneeToken;
    
    struct SavingsPlan {
        address owner;              // Plan owner (user's wallet)
        address vaultAddress;       // ONLY destination for withdrawals
        string name;                // Plan name (e.g., "Emergency Fund")
        uint256 totalDeposited;     // Total amount deposited
        uint256 unlockTime;         // Timestamp when funds unlock
        uint256 createdAt;          // Plan creation timestamp
        bool withdrawn;             // Whether funds have been withdrawn
        bool isRecurring;           // Is this a recurring deposit plan
    }
    
    // Plan ID => SavingsPlan
    mapping(uint256 => SavingsPlan) public savingsPlans;
    
    // User address => Array of their plan IDs
    mapping(address => uint256[]) public userPlanIds;
    
    // Total plans created (used as ID counter)
    uint256 public totalPlans;
    
    // Events
    event PlanCreated(
        uint256 indexed planId,
        address indexed owner,
        address indexed vaultAddress,
        string name,
        uint256 unlockTime,
        bool isRecurring
    );
    
    event DepositMade(
        uint256 indexed planId,
        address indexed depositor,
        uint256 amount,
        uint256 newTotal
    );
    
    event Withdrawn(
        uint256 indexed planId,
        address indexed owner,
        address indexed vaultAddress,
        uint256 amount
    );
    
    event PlanCancelled(
        uint256 indexed planId,
        address indexed owner,
        uint256 amountReturned
    );
    
    // Errors
    error NotPlanOwner();
    error PlanNotFound();
    error PlanAlreadyWithdrawn();
    error StillLocked(uint256 unlockTime, uint256 currentTime);
    error InvalidVaultAddress();
    error InvalidAmount();
    error InvalidLockDuration();
    error TransferFailed();
    error NothingToWithdraw();
    
    constructor(address _mneeToken) {
        require(_mneeToken != address(0), "Invalid token address");
        mneeToken = IERC20(_mneeToken);
    }
    
    /**
     * @notice Create a new savings plan
     * @param _vaultAddress The ONLY address funds can be withdrawn to (user's vault)
     * @param _name Human-readable name for the plan
     * @param _lockDays Number of days to lock funds
     * @param _isRecurring Whether this is a recurring deposit plan
     * @return planId The ID of the created plan
     */
    function createPlan(
        address _vaultAddress,
        string calldata _name,
        uint256 _lockDays,
        bool _isRecurring
    ) external returns (uint256 planId) {
        if (_vaultAddress == address(0)) revert InvalidVaultAddress();
        if (_lockDays == 0) revert InvalidLockDuration();
        
        planId = totalPlans++;
        
        uint256 unlockTime = block.timestamp + (_lockDays * 1 days);
        
        savingsPlans[planId] = SavingsPlan({
            owner: msg.sender,
            vaultAddress: _vaultAddress,
            name: _name,
            totalDeposited: 0,
            unlockTime: unlockTime,
            createdAt: block.timestamp,
            withdrawn: false,
            isRecurring: _isRecurring
        });
        
        userPlanIds[msg.sender].push(planId);
        
        emit PlanCreated(
            planId,
            msg.sender,
            _vaultAddress,
            _name,
            unlockTime,
            _isRecurring
        );
    }
    
    /**
     * @notice Create plan and deposit in one transaction
     * @param _vaultAddress The ONLY address funds can be withdrawn to
     * @param _name Human-readable name for the plan
     * @param _lockDays Number of days to lock funds
     * @param _isRecurring Whether this is a recurring deposit plan
     * @param _initialDeposit Amount to deposit initially
     * @return planId The ID of the created plan
     */
    function createPlanWithDeposit(
        address _vaultAddress,
        string calldata _name,
        uint256 _lockDays,
        bool _isRecurring,
        uint256 _initialDeposit
    ) external nonReentrant returns (uint256 planId) {
        if (_vaultAddress == address(0)) revert InvalidVaultAddress();
        if (_lockDays == 0) revert InvalidLockDuration();
        if (_initialDeposit == 0) revert InvalidAmount();
        
        planId = totalPlans++;
        
        uint256 unlockTime = block.timestamp + (_lockDays * 1 days);
        
        savingsPlans[planId] = SavingsPlan({
            owner: msg.sender,
            vaultAddress: _vaultAddress,
            name: _name,
            totalDeposited: _initialDeposit,
            unlockTime: unlockTime,
            createdAt: block.timestamp,
            withdrawn: false,
            isRecurring: _isRecurring
        });
        
        userPlanIds[msg.sender].push(planId);
        
        // Transfer tokens from sender
        bool success = mneeToken.transferFrom(msg.sender, address(this), _initialDeposit);
        if (!success) revert TransferFailed();
        
        emit PlanCreated(planId, msg.sender, _vaultAddress, _name, unlockTime, _isRecurring);
        emit DepositMade(planId, msg.sender, _initialDeposit, _initialDeposit);
    }
    
    /**
     * @notice Deposit more funds into an existing plan
     * @param _planId The plan to deposit into
     * @param _amount Amount to deposit
     */
    function deposit(uint256 _planId, uint256 _amount) external nonReentrant {
        SavingsPlan storage plan = savingsPlans[_planId];
        
        if (plan.owner == address(0)) revert PlanNotFound();
        if (plan.owner != msg.sender) revert NotPlanOwner();
        if (plan.withdrawn) revert PlanAlreadyWithdrawn();
        if (_amount == 0) revert InvalidAmount();
        
        plan.totalDeposited += _amount;
        
        bool success = mneeToken.transferFrom(msg.sender, address(this), _amount);
        if (!success) revert TransferFailed();
        
        emit DepositMade(_planId, msg.sender, _amount, plan.totalDeposited);
    }
    
    /**
     * @notice Deposit from agent wallet (allows agent to deposit on behalf of owner)
     * @dev Agent must have approved this contract to spend tokens
     * @param _planId The plan to deposit into
     * @param _amount Amount to deposit
     * @param _agentWallet The agent wallet depositing funds
     */
    function depositFromAgent(
        uint256 _planId, 
        uint256 _amount,
        address _agentWallet
    ) external nonReentrant {
        SavingsPlan storage plan = savingsPlans[_planId];
        
        if (plan.owner == address(0)) revert PlanNotFound();
        if (plan.withdrawn) revert PlanAlreadyWithdrawn();
        if (_amount == 0) revert InvalidAmount();
        
        plan.totalDeposited += _amount;
        
        // Transfer from agent wallet (agent must have approved this contract)
        bool success = mneeToken.transferFrom(_agentWallet, address(this), _amount);
        if (!success) revert TransferFailed();
        
        emit DepositMade(_planId, _agentWallet, _amount, plan.totalDeposited);
    }
    
    /**
     * @notice Withdraw funds after unlock period
     * @dev Funds ONLY go to the registered vault address
     * @param _planId The plan to withdraw from
     */
    function withdraw(uint256 _planId) external nonReentrant {
        SavingsPlan storage plan = savingsPlans[_planId];
        
        if (plan.owner == address(0)) revert PlanNotFound();
        if (plan.owner != msg.sender) revert NotPlanOwner();
        if (plan.withdrawn) revert PlanAlreadyWithdrawn();
        if (plan.totalDeposited == 0) revert NothingToWithdraw();
        if (block.timestamp < plan.unlockTime) {
            revert StillLocked(plan.unlockTime, block.timestamp);
        }
        
        uint256 amount = plan.totalDeposited;
        plan.withdrawn = true;
        plan.totalDeposited = 0;
        
        // CRITICAL: Funds ONLY go to the vault address, nowhere else
        bool success = mneeToken.transfer(plan.vaultAddress, amount);
        if (!success) revert TransferFailed();
        
        emit Withdrawn(_planId, msg.sender, plan.vaultAddress, amount);
    }
    
    /**
     * @notice Emergency cancel - returns funds to vault (only before unlock)
     * @dev Can only be called by owner, funds go to vault
     * @param _planId The plan to cancel
     */
    function cancelPlan(uint256 _planId) external nonReentrant {
        SavingsPlan storage plan = savingsPlans[_planId];
        
        if (plan.owner == address(0)) revert PlanNotFound();
        if (plan.owner != msg.sender) revert NotPlanOwner();
        if (plan.withdrawn) revert PlanAlreadyWithdrawn();
        
        uint256 amount = plan.totalDeposited;
        plan.withdrawn = true;
        plan.totalDeposited = 0;
        
        if (amount > 0) {
            // Funds return to vault, not to caller
            bool success = mneeToken.transfer(plan.vaultAddress, amount);
            if (!success) revert TransferFailed();
        }
        
        emit PlanCancelled(_planId, msg.sender, amount);
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get all plan IDs for a user
     */
    function getUserPlans(address _user) external view returns (uint256[] memory) {
        return userPlanIds[_user];
    }
    
    /**
     * @notice Get plan details
     */
    function getPlan(uint256 _planId) external view returns (
        address owner,
        address vaultAddress,
        string memory name,
        uint256 totalDeposited,
        uint256 unlockTime,
        uint256 createdAt,
        bool withdrawn,
        bool isRecurring
    ) {
        SavingsPlan storage plan = savingsPlans[_planId];
        return (
            plan.owner,
            plan.vaultAddress,
            plan.name,
            plan.totalDeposited,
            plan.unlockTime,
            plan.createdAt,
            plan.withdrawn,
            plan.isRecurring
        );
    }
    
    /**
     * @notice Check if plan is unlocked
     */
    function isUnlocked(uint256 _planId) external view returns (bool) {
        return block.timestamp >= savingsPlans[_planId].unlockTime;
    }
    
    /**
     * @notice Get time remaining until unlock
     */
    function timeUntilUnlock(uint256 _planId) external view returns (uint256) {
        SavingsPlan storage plan = savingsPlans[_planId];
        if (block.timestamp >= plan.unlockTime) return 0;
        return plan.unlockTime - block.timestamp;
    }
    
    /**
     * @notice Get total locked amount for a user across all plans
     */
    function getTotalLocked(address _user) external view returns (uint256 total) {
        uint256[] storage planIds = userPlanIds[_user];
        for (uint256 i = 0; i < planIds.length; i++) {
            SavingsPlan storage plan = savingsPlans[planIds[i]];
            if (!plan.withdrawn) {
                total += plan.totalDeposited;
            }
        }
    }
    
    /**
     * @notice Get count of active (non-withdrawn) plans for user
     */
    function getActivePlanCount(address _user) external view returns (uint256 count) {
        uint256[] storage planIds = userPlanIds[_user];
        for (uint256 i = 0; i < planIds.length; i++) {
            if (!savingsPlans[planIds[i]].withdrawn) {
                count++;
            }
        }
    }
}

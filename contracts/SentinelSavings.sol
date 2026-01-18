// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SentinelSavings is ReentrancyGuard {
    
    IERC20 public immutable mneeToken;
    
    enum LockType {
        SOFT,
        HARD
    }
    
    struct SavingsPlan {
        address owner;
        address vaultAddress;
        string name;
        uint256 totalDeposited;
        uint256 unlockTime;
        uint256 createdAt;
        bool withdrawn;
        bool isRecurring;
        LockType lockType;
    }
    
    mapping(uint256 => SavingsPlan) public savingsPlans;
    
    mapping(address => uint256[]) public userPlanIds;
    
    uint256 public totalPlans;
    
    event PlanCreated(
        uint256 indexed planId,
        address indexed owner,
        address indexed vaultAddress,
        string name,
        uint256 unlockTime,
        bool isRecurring,
        LockType lockType
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
    
    error NotPlanOwner();
    error PlanNotFound();
    error PlanAlreadyWithdrawn();
    error StillLocked(uint256 unlockTime, uint256 currentTime);
    error HardLockCannotCancel(uint256 unlockTime, uint256 currentTime);
    error InvalidVaultAddress();
    error InvalidAmount();
    error InvalidLockDuration();
    error TransferFailed();
    error NothingToWithdraw();
    
    constructor(address _mneeToken) {
        require(_mneeToken != address(0), "Invalid token address");
        mneeToken = IERC20(_mneeToken);
    }
    
    function createPlan(
        address _vaultAddress,
        string calldata _name,
        uint256 _lockDays,
        bool _isRecurring,
        LockType _lockType
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
            isRecurring: _isRecurring,
            lockType: _lockType
        });
        
        userPlanIds[msg.sender].push(planId);
        
        emit PlanCreated(
            planId,
            msg.sender,
            _vaultAddress,
            _name,
            unlockTime,
            _isRecurring,
            _lockType
        );
    }
    
    function createPlanWithDeposit(
        address _vaultAddress,
        string calldata _name,
        uint256 _lockDays,
        bool _isRecurring,
        LockType _lockType,
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
            isRecurring: _isRecurring,
            lockType: _lockType
        });
        
        userPlanIds[msg.sender].push(planId);
        
        bool success = mneeToken.transferFrom(msg.sender, address(this), _initialDeposit);
        if (!success) revert TransferFailed();
        
        emit PlanCreated(planId, msg.sender, _vaultAddress, _name, unlockTime, _isRecurring, _lockType);
        emit DepositMade(planId, msg.sender, _initialDeposit, _initialDeposit);
    }
    
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
        
        bool success = mneeToken.transferFrom(_agentWallet, address(this), _amount);
        if (!success) revert TransferFailed();
        
        emit DepositMade(_planId, _agentWallet, _amount, plan.totalDeposited);
    }
    
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
        
        bool success = mneeToken.transfer(plan.vaultAddress, amount);
        if (!success) revert TransferFailed();
        
        emit Withdrawn(_planId, msg.sender, plan.vaultAddress, amount);
    }
    
    function cancelPlan(uint256 _planId) external nonReentrant {
        SavingsPlan storage plan = savingsPlans[_planId];
        
        if (plan.owner == address(0)) revert PlanNotFound();
        if (plan.owner != msg.sender) revert NotPlanOwner();
        if (plan.withdrawn) revert PlanAlreadyWithdrawn();
        
        if (plan.lockType == LockType.HARD && block.timestamp < plan.unlockTime) {
            revert HardLockCannotCancel(plan.unlockTime, block.timestamp);
        }
        
        uint256 amount = plan.totalDeposited;
        plan.withdrawn = true;
        plan.totalDeposited = 0;
        
        if (amount > 0) {
            bool success = mneeToken.transfer(plan.vaultAddress, amount);
            if (!success) revert TransferFailed();
        }
        
        emit PlanCancelled(_planId, msg.sender, amount);
    }
    
    function getUserPlans(address _user) external view returns (uint256[] memory) {
        return userPlanIds[_user];
    }
    
    function getPlan(uint256 _planId) external view returns (
        address owner,
        address vaultAddress,
        string memory name,
        uint256 totalDeposited,
        uint256 unlockTime,
        uint256 createdAt,
        bool withdrawn,
        bool isRecurring,
        LockType lockType
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
            plan.isRecurring,
            plan.lockType
        );
    }
    
    function isUnlocked(uint256 _planId) external view returns (bool) {
        return block.timestamp >= savingsPlans[_planId].unlockTime;
    }
    
    function canCancelNow(uint256 _planId) external view returns (bool) {
        SavingsPlan storage plan = savingsPlans[_planId];
        
        if (plan.withdrawn) return false;
        
        if (plan.lockType == LockType.SOFT) return true;
        
        return block.timestamp >= plan.unlockTime;
    }
    
    function timeUntilUnlock(uint256 _planId) external view returns (uint256) {
        SavingsPlan storage plan = savingsPlans[_planId];
        if (block.timestamp >= plan.unlockTime) return 0;
        return plan.unlockTime - block.timestamp;
    }
    
    function getTotalLocked(address _user) external view returns (uint256 total) {
        uint256[] storage planIds = userPlanIds[_user];
        for (uint256 i = 0; i < planIds.length; i++) {
            SavingsPlan storage plan = savingsPlans[planIds[i]];
            if (!plan.withdrawn) {
                total += plan.totalDeposited;
            }
        }
    }
    
    function getActivePlanCount(address _user) external view returns (uint256 count) {
        uint256[] storage planIds = userPlanIds[_user];
        for (uint256 i = 0; i < planIds.length; i++) {
            if (!savingsPlans[planIds[i]].withdrawn) {
                count++;
            }
        }
    }
}
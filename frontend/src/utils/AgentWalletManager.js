import { ethers } from 'ethers';

const STORAGE_PREFIX = 'sentinel_agent_';

const MNEE_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const SAVINGS_ABI = [
  "function createPlanWithDeposit(address _vaultAddress, string _name, uint256 _lockDays, bool _isRecurring, uint8 _lockType, uint256 _initialDeposit) returns (uint256 planId)",
  "function depositFromAgent(uint256 _planId, uint256 _amount, address _agentWallet)",
  "function deposit(uint256 _planId, uint256 _amount)",
  "function getUserPlans(address _user) view returns (uint256[])",
  "function getPlan(uint256 _planId) view returns (address owner, address vaultAddress, string name, uint256 totalDeposited, uint256 unlockTime, uint256 createdAt, bool withdrawn, bool isRecurring, uint8 lockType)",
  "function isUnlocked(uint256 _planId) view returns (bool)",
  "function canCancelNow(uint256 _planId) view returns (bool)",
  "function timeUntilUnlock(uint256 _planId) view returns (uint256)",
  "function getTotalLocked(address _user) view returns (uint256)",
  "function withdraw(uint256 _planId)",
  "function cancelPlan(uint256 _planId)",
  "event PlanCreated(uint256 indexed planId, address indexed owner, address indexed vaultAddress, string name, uint256 unlockTime, bool isRecurring, uint8 lockType)",
  "event DepositMade(uint256 indexed planId, address indexed depositor, uint256 amount, uint256 newTotal)",
  "event Withdrawn(uint256 indexed planId, address indexed owner, address indexed vaultAddress, uint256 amount)"
];

class AgentWalletManager {
  constructor(userAddress, vaultAddress, networkConfig) {
    this.userAddress = userAddress?.toLowerCase();
    this.vaultAddress = vaultAddress?.toLowerCase();
    this.networkConfig = networkConfig;
    this.agentWallet = null;
    this.trustedDestinations = new Set();
    
    
    if (this.vaultAddress) {
      this.trustedDestinations.add(this.vaultAddress);
    }
    

    if (networkConfig?.savingsContract) {
      this.trustedDestinations.add(networkConfig.savingsContract.toLowerCase());
    }
  }

  /**
   * Get network-aware transaction options
   * Testnets use legacy gasPrice, mainnet uses EIP-1559
   * @param {ethers.Provider} provider - Network provider
   * @param {number} gasLimit - Gas limit for transaction
   * @returns {Promise<Object>} Transaction options
   */
  async getTransactionOptions(provider, gasLimit = 100000) {
    const txOptions = { gasLimit };
    
   
    if (this.networkConfig?.isTestnet) {
      try {
        const feeData = await provider.getFeeData();
        txOptions.gasPrice = feeData.gasPrice || ethers.parseUnits('10', 'gwei');
      } catch (e) {
        txOptions.gasPrice = ethers.parseUnits('10', 'gwei');
      }
    }
    
    return txOptions;
  }

  /**
   * Check if error is "already known" (tx in mempool)
   * @param {Error} error - The error to check
   * @returns {boolean}
   */
  isAlreadyKnownError(error) {
    const msg = error?.message?.toLowerCase() || '';
    return msg.includes('already known') || 
           msg.includes('nonce too low') ||
           msg.includes('replacement transaction underpriced');
  }
  getSigningMessage() {
    return `Sentinel Finance Agent Wallet Authorization\n\nThis signature creates your Agent Wallet for automated payments.\n\nWallet: ${this.userAddress}\nTimestamp: SENTINEL_AGENT_V1`;
  }

  /**
   * Initialize or recover agent wallet from signature
   * @param {ethers.Signer} signer - Connected MetaMask signer
   * @returns {Promise<{address: string, isNew: boolean}>}
   */
  async initializeWallet(signer) {
    try {
      const cached = this.loadFromStorage();
      if (cached && cached.address) {
        const verified = await this.verifyCachedWallet(cached, signer);
        if (verified) {
          this.agentWallet = new ethers.Wallet(cached.privateKey);
          return { address: this.agentWallet.address, isNew: false };
        }
      }

      const message = this.getSigningMessage();
      const signature = await signer.signMessage(message);
      
      const privateKey = ethers.keccak256(signature);
      
      this.agentWallet = new ethers.Wallet(privateKey);
      
      
      this.saveToStorage(privateKey, this.agentWallet.address);
      
      return { address: this.agentWallet.address, isNew: true };
      
    } catch (error) {
      console.error('Failed to initialize agent wallet:', error);
      throw error;
    }
  }

  
  async verifyCachedWallet(cached, signer) {
    try {
      return cached.userAddress === this.userAddress;
    } catch {
      return false;
    }
  }

  
  saveToStorage(privateKey, address) {
    const data = {
      userAddress: this.userAddress,
      vaultAddress: this.vaultAddress,
      address: address,
      privateKey: privateKey, 
      createdAt: new Date().toISOString(),
      version: 1
    };
    
    localStorage.setItem(
      `${STORAGE_PREFIX}${this.userAddress}`,
      JSON.stringify(data)
    );
  }

 
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${this.userAddress}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load agent wallet from storage:', error);
    }
    return null;
  }

ensureWalletLoaded() {
  if (this.agentWallet) {
    return true;
  }
  
  const cached = this.loadFromStorage();
  if (cached?.privateKey) {
    try {
      this.agentWallet = new ethers.Wallet(cached.privateKey);
      return true; 
    } catch (e) {
      console.error('Wallet reconstruction failed:', e);
    }
  }
  
  return false;
}

  getAddress() {
    if (this.agentWallet) {
      return this.agentWallet.address;
    }
    const cached = this.loadFromStorage();
    return cached?.address || null;
  }

 
  hasWallet() {
    const cached = this.loadFromStorage();
    return !!cached?.address;
  }

  
  addTrustedVendor(address) {
    this.trustedDestinations.add(address.toLowerCase());
  }

  
  setTrustedVendors(vendors) {
    vendors.forEach(v => {
      if (v.address && v.trusted) {
        this.trustedDestinations.add(v.address.toLowerCase());
      }
    });
  }

  
  isValidDestination(address) {
    const normalized = address.toLowerCase();
    
   
    if (normalized === this.vaultAddress) {
      return { valid: true, reason: 'Own vault' };
    }
    
   
    if (this.trustedDestinations.has(normalized)) {
      return { valid: true, reason: 'Trusted destination' };
    }
    
    return { 
      valid: false, 
      reason: 'BLOCKED: Agent wallet can only send to Vault, Savings, or Trusted Vendors' 
    };
  }

  
  async getBalance(provider) {
    const address = this.getAddress();
    if (!address) return '0';
    
    try {
      const mneeContract = new ethers.Contract(
        this.networkConfig.mneeToken,
        MNEE_ABI,
        provider
      );
      const balance = await mneeContract.balanceOf(address);
      return ethers.formatUnits(balance, 18);
    } catch (error) {
      console.error('Failed to get agent balance:', error);
      return '0';
    }
  }

  async getEthBalance(provider) {
    const address = this.getAddress();
    if (!address) return '0';
    
    try {
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Failed to get ETH balance:', error);
      return '0';
    }
  }

  /**
   * Send MNEE to destination (with validation)
   * @param {ethers.Provider} provider - Network provider
   * @param {string} to - Destination address
   * @param {string} amount - Amount in MNEE
   * @param {string} reason - Transaction reason
   * @returns {Promise<{success: boolean, txHash?: string, error?: string}>}
   */
  async sendMNEE(provider, to, amount, reason = '') {
  
    const validation = this.isValidDestination(to);
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

   
    const gasCheck = await this.checkGasBalance(provider);
    if (gasCheck.empty) {
      return { success: false, error: 'No ETH for gas. Fund agent with ETH first.', needsGas: true };
    }

    if (!this.ensureWalletLoaded()) {
      return { success: false, error: 'Agent wallet not set up' };
    }


    try {
      const connectedWallet = this.agentWallet.connect(provider);
      
      const mneeContract = new ethers.Contract(
        this.networkConfig.mneeToken,
        MNEE_ABI,
        connectedWallet
      );

      const amountWei = ethers.parseUnits(amount.toString(), 18);
      
     
      const balance = await mneeContract.balanceOf(this.agentWallet.address);
      if (balance < amountWei) {
        return { 
          success: false, 
          error: `Insufficient balance. Have: ${ethers.formatUnits(balance, 18)} MNEE, Need: ${amount} MNEE` 
        };
      }

    
     const txOptions = await this.getTransactionOptions(provider);
      const tx = await mneeContract.transfer(to, amountWei, txOptions);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        to,
        amount,
        reason
      };

    } catch (error) {
      console.error('Send MNEE failed:', error);
      
     
      if (this.isAlreadyKnownError(error)) {
        console.log('Transaction already in mempool, treating as pending success');
        return {
          success: true,
          txHash: 'pending',
          to,
          amount,
          reason,
          note: 'Transaction already submitted'
        };
      }
      
      return { 
        success: false, 
        error: error.reason || error.message || 'Transaction failed' 
      };
    }
  }

 
  async withdrawToVault(provider) {
    const balance = await this.getBalance(provider);
    if (parseFloat(balance) <= 0) {
      return { success: false, error: 'No balance to withdraw' };
    }

    return this.sendMNEE(provider, this.vaultAddress, balance, 'Withdraw to Vault');
  }

  
  async withdrawAmountToVault(provider, amount) {
    return this.sendMNEE(provider, this.vaultAddress, amount, 'Partial withdraw to Vault');
  }

  /**
   * Create a new savings plan with initial deposit
   * @param {ethers.Provider} provider - Network provider
   * @param {string} name - Plan name
   * @param {number} lockDays - Lock duration in days
   * @param {string} amount - Initial deposit amount
   * @param {boolean} isRecurring - Is this a recurring plan
   * @returns {Promise<{success: boolean, planId?: number, error?: string}>}
   */
async createSavingsPlan(provider, name, lockDays, amount, isRecurring = false, lockType = 0) {
    if (!this.ensureWalletLoaded()) {
      return { success: false, error: 'Agent wallet not set up' };
    }


    
    const gasCheck = await this.checkGasBalance(provider);
    if (gasCheck.empty) {
      return { success: false, error: 'No ETH for gas', needsGas: true };
    }

    if (!this.networkConfig.savingsContract) {
      return { success: false, error: 'Savings contract not configured' };
    }

    try {
      const connectedWallet = this.agentWallet.connect(provider);
      const amountWei = ethers.parseUnits(amount.toString(), 18);

     
      const mneeContract = new ethers.Contract(
        this.networkConfig.mneeToken,
        MNEE_ABI,
        connectedWallet
      );

      
      const balance = await mneeContract.balanceOf(this.agentWallet.address);
      if (balance < amountWei) {
        return { 
          success: false, 
          error: `Insufficient balance. Have: ${ethers.formatUnits(balance, 18)} MNEE, Need: ${amount} MNEE` 
        };
      }

     
    const approveTxOptions = await this.getTransactionOptions(provider);
      const approveTx = await mneeContract.approve(this.networkConfig.savingsContract, amountWei, approveTxOptions);
      await approveTx.wait();


     
      const savingsContract = new ethers.Contract(
        this.networkConfig.savingsContract,
        SAVINGS_ABI,
        connectedWallet
      );

      const createTxOptions = await this.getTransactionOptions(provider, 300000); 
     const createTx = await savingsContract.createPlanWithDeposit(
        this.vaultAddress,
        name,
        lockDays,
        isRecurring,
        lockType,
        amountWei,
        createTxOptions
      );
      
      const receipt = await createTx.wait();
      
      
     let planId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = savingsContract.interface.parseLog(log);
          if (parsed && (parsed.name === 'PlanCreated' || parsed.name === 'PlanCreatedWithDeposit')) {
            planId = Number(parsed.args.planId || parsed.args[0]);
            break;
          }
        } catch (e) {
         
          if (log.topics && log.topics.length > 1) {
            try {
              const possiblePlanId = parseInt(log.topics[1], 16);
              if (!isNaN(possiblePlanId) && possiblePlanId < 1000000) {
                planId = possiblePlanId;
                break;
              }
            } catch (e2) {}
          }
        }
      }
      
     
      if (planId === null) {
        try {
          const userPlans = await savingsContract.getUserPlans(this.userAddress);
          if (userPlans.length > 0) {
            planId = Number(userPlans[userPlans.length - 1]);
            console.log('PlanId recovered from getUserPlans:', planId);
          }
        } catch (e) {
          console.warn('Could not recover planId:', e);
        }
      }

      return {
        success: true,
        planId,
        txHash: receipt.hash,
        name,
        lockDays,
        amount,
        isRecurring,
        lockType
      };
      
    } catch (error) {
      console.error('Create savings plan failed:', error);
      return { 
        success: false, 
        error: error.reason || error.message || 'Failed to create savings plan' 
      };
    }
  }

  /**
   * Deposit to existing savings plan
   * @param {ethers.Provider} provider - Network provider
   * @param {number} planId - The plan ID to deposit to
   * @param {string} amount - Amount to deposit
   * @returns {Promise<{success: boolean, error?: string}>}
   */
 async depositToSavings(provider, planId, amount) {
    if (!this.ensureWalletLoaded()) {
      return { success: false, error: 'Agent wallet not set up' };
    }

    
    const gasCheck = await this.checkGasBalance(provider);
    if (gasCheck.empty) {
      return { success: false, error: 'No ETH for gas', needsGas: true };
    }

    if (!this.networkConfig.savingsContract) {
      return { success: false, error: 'Savings contract not configured' };
    }

    try {
      const connectedWallet = this.agentWallet.connect(provider);
      const amountWei = ethers.parseUnits(amount.toString(), 18);

      
      const mneeContract = new ethers.Contract(
        this.networkConfig.mneeToken,
        MNEE_ABI,
        connectedWallet
      );

      const balance = await mneeContract.balanceOf(this.agentWallet.address);
      if (balance < amountWei) {
        return { 
          success: false, 
          error: `Insufficient balance. Have: ${ethers.formatUnits(balance, 18)} MNEE, Need: ${amount} MNEE` 
        };
      }

      
     const approveTxOptions = await this.getTransactionOptions(provider);
      const approveTx = await mneeContract.approve(this.networkConfig.savingsContract, amountWei, approveTxOptions);
      await approveTx.wait();

      
      const savingsContract = new ethers.Contract(
        this.networkConfig.savingsContract,
        SAVINGS_ABI,
        connectedWallet
      );

     const depositTxOptions = await this.getTransactionOptions(provider, 150000);
      const depositTx = await savingsContract.depositFromAgent(
        planId,
        amountWei,
        this.agentWallet.address,
        depositTxOptions
      );
      
      const receipt = await depositTx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        planId,
        amount
      };

    } catch (error) {
      console.error('Deposit to savings failed:', error);
      return { 
        success: false, 
        error: error.reason || error.message || 'Failed to deposit to savings' 
      };
    }
  }

  /**
   * Get all savings plans for the agent wallet owner
   * @param {ethers.Provider} provider - Network provider
   * @returns {Promise<Array>}
   */
  async getSavingsPlans(provider) {
    if (!this.networkConfig.savingsContract) {
      return [];
    }

    try {
      const savingsContract = new ethers.Contract(
        this.networkConfig.savingsContract,
        SAVINGS_ABI,
        provider
      );

     
      const planIds = await savingsContract.getUserPlans(this.userAddress);
      
      const plans = [];
      for (const planId of planIds) {
        const plan = await savingsContract.getPlan(planId);
        const timeUntil = await savingsContract.timeUntilUnlock(planId);
        
        plans.push({
          planId: Number(planId),
          owner: plan.owner,
          vaultAddress: plan.vaultAddress,
          name: plan.name,
          totalDeposited: ethers.formatUnits(plan.totalDeposited, 18),
          unlockTime: Number(plan.unlockTime),
          createdAt: Number(plan.createdAt),
          withdrawn: plan.withdrawn,
          isRecurring: plan.isRecurring,
          timeUntilUnlock: Number(timeUntil),
          isUnlocked: Number(timeUntil) === 0
        });
      }

     return plans.filter(p => !p.withdrawn);
    } catch (error) {
      console.error('Failed to get savings plans:', error);
      return [];
    }
  }

  
  async withdrawFromSavings(provider, planId) {
    if (!this.ensureWalletLoaded()) {
      return { success: false, error: 'Agent wallet not set up' };
    }

    if (!this.networkConfig.savingsContract) {
      return { success: false, error: 'Savings contract not configured' };
    }

    try {
      const connectedWallet = this.agentWallet.connect(provider);
      
      const savingsContract = new ethers.Contract(
        this.networkConfig.savingsContract,
        SAVINGS_ABI,
        connectedWallet
      );

    
      const isUnlocked = await savingsContract.isUnlocked(planId);
      if (!isUnlocked) {
        const timeLeft = await savingsContract.timeUntilUnlock(planId);
        const daysLeft = Math.ceil(Number(timeLeft) / 86400);
        return { 
          success: false, 
          error: `Plan still locked. ${daysLeft} days remaining.`,
          daysRemaining: daysLeft
        };
      }

     
      const gasCheck = await this.checkGasBalance(provider);
      if (gasCheck.empty) {
        return { success: false, error: 'No ETH for gas', needsGas: true };
      }

  
    const txOptions = await this.getTransactionOptions(provider, 150000);
      const tx = await savingsContract.withdraw(planId, txOptions);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        planId
      };

    } catch (error) {
      console.error('Withdraw from savings failed:', error);
      return { 
        success: false, 
        error: error.reason || error.message || 'Withdrawal failed' 
      };
    }
  }

 
  async cancelSavingsPlan(provider, planId) {
    if (!this.ensureWalletLoaded()) {
      return { success: false, error: 'Agent wallet not set up' };
    }

    if (!this.networkConfig.savingsContract) {
      return { success: false, error: 'Savings contract not configured' };
    }

    try {
      const connectedWallet = this.agentWallet.connect(provider);
      
      const savingsContract = new ethers.Contract(
        this.networkConfig.savingsContract,
        SAVINGS_ABI,
        connectedWallet
      );

     
      const gasCheck = await this.checkGasBalance(provider);
      if (gasCheck.empty) {
        return { success: false, error: 'No ETH for gas', needsGas: true };
      }

      const txOptions = await this.getTransactionOptions(provider, 150000);
      const tx = await savingsContract.cancelPlan(planId, txOptions);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        planId
      };

    } catch (error) {
      console.error('Cancel savings plan failed:', error);
      return { 
        success: false, 
        error: error.reason || error.message || 'Cancellation failed' 
      };
    }
  }

  /**
   * Get total locked in savings
   * @param {ethers.Provider} provider - Network provider
   * @returns {Promise<string>}
   */
  async getTotalLockedSavings(provider) {
    if (!this.networkConfig.savingsContract) {
      return '0';
    }

    try {
      const savingsContract = new ethers.Contract(
        this.networkConfig.savingsContract,
        SAVINGS_ABI,
        provider
      );

      const total = await savingsContract.getTotalLocked(this.userAddress);
      return ethers.formatUnits(total, 18);
    } catch (error) {
      console.error('Failed to get total locked:', error);
      return '0';
    }
  }

 
  async approveSavingsContract(provider, amount) {
   if (!this.ensureWalletLoaded()) {
      return { success: false, error: 'Agent wallet not set up' };
    }

    if (!this.networkConfig.savingsContract) {
      return { success: false, error: 'Savings contract not configured' };
    }

    try {
      const connectedWallet = this.agentWallet.connect(provider);
      
      const mneeContract = new ethers.Contract(
        this.networkConfig.mneeToken,
        MNEE_ABI,
        connectedWallet
      );

    const amountWei = ethers.parseUnits(amount.toString(), 18);
      const txOptions = await this.getTransactionOptions(provider);
      const tx = await mneeContract.approve(this.networkConfig.savingsContract, amountWei, txOptions);
      await tx.wait();

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  
  async getTransactionHistory(apiUrl) {
    const address = this.getAddress();
    if (!address) return [];

    try {
      const response = await fetch(`${apiUrl}/api/v1/agent-transactions/${address}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch transaction history:', error);
    }
    return [];
  }

  
  clearWallet() {
    localStorage.removeItem(`${STORAGE_PREFIX}${this.userAddress}`);
    this.agentWallet = null;
  }

  
  getWalletInfo() {
    const cached = this.loadFromStorage();
    if (!cached) return null;

    return {
      address: cached.address,
      userAddress: cached.userAddress,
      vaultAddress: cached.vaultAddress,
      createdAt: cached.createdAt,
      hasPrivateKey: !!cached.privateKey
    };
  }

  
  async needsGas(provider, minEth = 0.001) {
    const ethBalance = await this.getEthBalance(provider);
    return parseFloat(ethBalance) < minEth;
  }

  async checkGasBalance(provider, minEth = 0.001) {
    const ethBalance = await this.getEthBalance(provider);
    const balance = parseFloat(ethBalance);
    return {
      balance: ethBalance,
      sufficient: balance >= minEth,
      low: balance > 0 && balance < minEth,
      empty: balance < 0.0001
    };
  }

  
  async fundWithEth(signer, amount) {
    if (!this.hasWallet()) {
      return { success: false, error: 'Agent wallet not initialized' };
    }
    try {
      const amountWei = ethers.parseEther(amount.toString());
      
      const tx = await signer.sendTransaction({
        to: this.getAddress(),
        value: amountWei
      });
      
      const receipt = await tx.wait();
      return { 
        success: true, 
        txHash: receipt.hash,
        amount: amount
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  
  async signMessage(message) {
   if (!this.ensureWalletLoaded()) {
      throw new Error('Agent wallet not set up');
    }
    return this.agentWallet.signMessage(message);
  }
}

export default AgentWalletManager;
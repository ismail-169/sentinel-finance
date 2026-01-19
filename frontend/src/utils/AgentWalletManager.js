import { ethers } from 'ethers';

const STORAGE_PREFIX = 'sentinel_agent_';
const API_URL = process.env.REACT_APP_API_URL || 'https://api.sentinelfinance.xyz';
const API_KEY = process.env.REACT_APP_API_KEY || '';
const ENCRYPTION_SALT = 'sentinel_agent_v2_';

async function deriveEncryptionKey(userAddress) {
  const encoder = new TextEncoder();
  const data = encoder.encode(ENCRYPTION_SALT + userAddress.toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return await crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptForBackend(privateKey, userAddress) {
  try {
    const key = await deriveEncryptionKey(userAddress);
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(privateKey)
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    return 'enc_' + btoa(String.fromCharCode(...combined));
  } catch (e) {
    console.error('Encryption failed, using raw key');
    return privateKey;
  }
}

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
    this.syncInProgress = false;
    
    if (this.vaultAddress) {
      this.trustedDestinations.add(this.vaultAddress);
    }
    
    if (networkConfig?.savingsContract) {
      this.trustedDestinations.add(networkConfig.savingsContract.toLowerCase());
    }
  }

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

  isAlreadyKnownError(error) {
    const msg = error?.message?.toLowerCase() || '';
    return msg.includes('already known') || 
           msg.includes('nonce too low') ||
           msg.includes('replacement transaction underpriced');
  }

  getSigningMessage() {
    return `Sentinel Finance Agent Wallet Authorization\n\nThis signature creates your Agent Wallet for automated payments.\n\nWallet: ${this.userAddress}\nTimestamp: SENTINEL_AGENT_V1`;
  }

  async initializeWallet(signer) {
    try {
      const cached = this.loadFromStorage();
      if (cached && cached.address) {
        const verified = await this.verifyCachedWallet(cached, signer);
        if (verified) {
          this.agentWallet = new ethers.Wallet(cached.privateKey);
          await this.syncToBackend(cached.privateKey, this.agentWallet.address);
          return { address: this.agentWallet.address, isNew: false };
        }
      }

      const backendWallet = await this.loadFromBackend();
      if (backendWallet && backendWallet.agent_address) {
        const message = this.getSigningMessage();
        const signature = await signer.signMessage(message);
        const privateKey = ethers.keccak256(signature);
        const derivedWallet = new ethers.Wallet(privateKey);
        
        if (derivedWallet.address.toLowerCase() === backendWallet.agent_address.toLowerCase()) {
          this.agentWallet = derivedWallet;
          this.saveToStorage(privateKey, derivedWallet.address, false);
          return { address: derivedWallet.address, isNew: false, restoredFromBackend: true };
        }
      }

      const message = this.getSigningMessage();
      const signature = await signer.signMessage(message);
      const privateKey = ethers.keccak256(signature);
      
      this.agentWallet = new ethers.Wallet(privateKey);
      
      this.saveToStorage(privateKey, this.agentWallet.address, true);
      
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

  saveToStorage(privateKey, address, syncBackend = true) {
    const data = {
      userAddress: this.userAddress,
      vaultAddress: this.vaultAddress,
      address: address,
      privateKey: privateKey,
      createdAt: new Date().toISOString(),
      version: 2
    };
    
    localStorage.setItem(
      `${STORAGE_PREFIX}${this.userAddress}`,
      JSON.stringify(data)
    );

    if (syncBackend) {
      this.syncToBackend(privateKey, address).catch(err => {
        console.error('Background sync to backend failed:', err);
      });
    }
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

  async syncToBackend(privateKey, address) {
    if (this.syncInProgress) {
      return { success: false, reason: 'Sync already in progress' };
    }

    this.syncInProgress = true;

    try {
      const encryptedKey = await encryptForBackend(privateKey, this.userAddress);
      
      const response = await fetch(`${API_URL}/api/v1/agent-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({
          user_address: this.userAddress,
          agent_address: address,
          vault_address: this.vaultAddress,
          encrypted_key: encryptedKey,
          network: this.networkConfig?.name || 'mainnet'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to sync agent wallet to backend:', errorText);
        return { success: false, error: errorText };
      }

      const result = await response.json();
      console.log('✅ Agent wallet synced to backend');
      return { success: true, ...result };

    } catch (error) {
      console.error('Error syncing agent wallet to backend:', error);
      return { success: false, error: error.message };
    } finally {
      this.syncInProgress = false;
    }
  }

  async loadFromBackend() {
    try {
      const network = this.networkConfig?.name || 'mainnet';
      const response = await fetch(
        `${API_URL}/api/v1/agent-wallet/${this.userAddress}?network=${network}`,
        {
          headers: {
            'X-API-Key': API_KEY
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data && data.agent_address) {
          console.log('✅ Found agent wallet in backend');
          return data;
        }
      }
    } catch (error) {
      console.error('Failed to load agent wallet from backend:', error);
    }
    return null;
  }

  async deleteFromBackend() {
    try {
      const network = this.networkConfig?.name || 'mainnet';
      const response = await fetch(
        `${API_URL}/api/v1/agent-wallet/${this.userAddress}?network=${network}`,
        {
          method: 'DELETE',
          headers: {
            'X-API-Key': API_KEY
          }
        }
      );

      return response.ok;
    } catch (error) {
      console.error('Failed to delete agent wallet from backend:', error);
      return false;
    }
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
      const approveTx = await mneeContract.approve(
        this.networkConfig.savingsContract,
        amountWei,
        approveTxOptions
      );
      await approveTx.wait();

      const savingsContract = new ethers.Contract(
        this.networkConfig.savingsContract,
        SAVINGS_ABI,
        connectedWallet
      );

      const createTxOptions = await this.getTransactionOptions(provider, 300000);
      const tx = await savingsContract.createPlanWithDeposit(
        this.vaultAddress,
        name,
        lockDays,
        isRecurring,
        lockType,
        amountWei,
        createTxOptions
      );

      const receipt = await tx.wait();

      let planId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = savingsContract.interface.parseLog(log);
          if (parsed && parsed.name === 'PlanCreated') {
            planId = Number(parsed.args.planId);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      return {
        success: true,
        txHash: receipt.hash,
        planId,
        name,
        amount,
        lockDays,
        isRecurring
      };

    } catch (error) {
      console.error('Create savings plan failed:', error);
      
      if (this.isAlreadyKnownError(error)) {
        return {
          success: true,
          txHash: 'pending',
          note: 'Transaction already submitted'
        };
      }

      return { 
        success: false, 
        error: error.reason || error.message || 'Failed to create savings plan' 
      };
    }
  }

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
      const approveTx = await mneeContract.approve(
        this.networkConfig.savingsContract,
        amountWei,
        approveTxOptions
      );
      await approveTx.wait();

      const savingsContract = new ethers.Contract(
        this.networkConfig.savingsContract,
        SAVINGS_ABI,
        connectedWallet
      );

      const depositTxOptions = await this.getTransactionOptions(provider, 150000);
      const tx = await savingsContract.deposit(planId, amountWei, depositTxOptions);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        planId,
        amount
      };

    } catch (error) {
      console.error('Deposit to savings failed:', error);
      
      if (this.isAlreadyKnownError(error)) {
        return {
          success: true,
          txHash: 'pending',
          note: 'Transaction already submitted'
        };
      }

      return { 
        success: false, 
        error: error.reason || error.message || 'Deposit failed' 
      };
    }
  }

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
    this.deleteFromBackend().catch(err => {
      console.error('Failed to delete wallet from backend:', err);
    });
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
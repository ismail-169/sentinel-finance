
import { ethers } from 'ethers';

const STORAGE_PREFIX = 'sentinel_agent_';
const MNEE_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)"
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
      // Simple verification - check if wallet was created for this user
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
      privateKey: privateKey, // In production: encrypt this properly
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

    if (!this.agentWallet) {
      return { success: false, error: 'Agent wallet not initialized' };
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

     
      const tx = await mneeContract.transfer(to, amountWei);
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

  
  async approveSavingsContract(provider, amount) {
    if (!this.agentWallet) {
      return { success: false, error: 'Agent wallet not initialized' };
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
      const tx = await mneeContract.approve(this.networkConfig.savingsContract, amountWei);
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

  
  async signMessage(message) {
    if (!this.agentWallet) {
      throw new Error('Agent wallet not initialized');
    }
    return this.agentWallet.signMessage(message);
  }
}

export default AgentWalletManager;
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Wallet, Activity, AlertTriangle, CheckCircle, 
  XCircle, Clock, TrendingUp, Users, Zap, RefreshCw,
  ChevronRight, ExternalLink, Bell, Settings, Moon, Bot, Code,
  LogOut, ArrowDownToLine, ArrowUpFromLine, Coins, Menu, X, Github
} from 'lucide-react';
import sentinelLogo from './sentinel-logo.png';
import NetworkSelector from './components/NetworkSelector';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import AlertPanel from './components/AlertPanel';
import VaultStats from './components/VaultStats';
import AIAgentChat from './components/AIAgentChat';
import DepositModal from './components/DepositModal';
import WithdrawModal from './components/WithdrawModal';
import AgentWalletPanel from './components/AgentWalletPanel';
import RecurringPaymentsTab from './components/RecurringPaymentsTab';
import AgentWalletManager from './utils/AgentWalletManager';
import RecurringScheduler from './utils/RecurringScheduler';

const NETWORKS = {
  sepolia: {
    chainId: '0xaa36a7',
    chainIdDecimal: 11155111,
    name: 'Sepolia',
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/demo',
    explorer: 'https://sepolia.etherscan.io',
    mneeToken: '0x250ff89cf1518F42F3A4c927938ED73444491715',
    vaultFactory: '0xfD3af9554C45211c228B8E7498B26A325669A484',
    savingsContract: '0x21955e81ca4063f41080d12d3113F6ec54E7b692',
    isTestnet: true
  },
  mainnet: {
    chainId: '0x1',
    chainIdDecimal: 1,
    name: 'Mainnet',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/your-key',
    explorer: 'https://etherscan.io',
    mneeToken: '0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF',
    vaultFactory: '0x0000000000000000000000000000000000000000',
    savingsContract: '', // Not deployed yet
    isTestnet: false
  }
};

const MNEE_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function faucet() external",
  "function canClaimFaucet(address) view returns (bool)",
  "function timeUntilNextClaim(address) view returns (uint256)"
];

const FACTORY_ABI = [
  "function createVault() returns (address)",
  "function getUserVault(address) view returns (address)",
  "function hasVault(address) view returns (bool)",
  "event VaultCreated(address indexed user, address indexed vault)"
];

const VAULT_ABI = [
  "function getVaultBalance() view returns (uint256)",
  "function dailyLimit() view returns (uint256)",
  "function transactionLimit() view returns (uint256)",
  "function timeLockDuration() view returns (uint256)",
  "function txCounter() view returns (uint256)",
  "function owner() view returns (address)",
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function withdrawAll()",
  "function getTransaction(uint256) view returns (tuple(address agent, address vendor, uint256 amount, uint256 timestamp, uint256 executeAfter, bool executed, bool revoked, string reason))",
  "function trustedVendors(address) view returns (bool)",
  "function setTrustedVendor(address, bool)",
  "function revokeTransaction(uint256, string)",
  "function executePayment(uint256)",
  "function requestPayment(address, uint256, address)",
  "function setLimits(uint256, uint256, uint256)",
  "event PaymentRequested(uint256 indexed txId, address indexed agent, address indexed vendor, uint256 amount, uint256 executeAfter)",
  "event PaymentExecuted(uint256 indexed txId)",
  "event PaymentRevoked(uint256 indexed txId, string reason)",
  "event Deposited(address indexed from, uint256 amount)",
  "event Withdrawn(address indexed to, uint256 amount)"
];

const API_URL = process.env.REACT_APP_API_URL || 'https://api.sentinelfinance.xyz';
const API_KEY = process.env.REACT_APP_API_KEY || '';

const apiCall = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(API_KEY && { 'x-api-key': API_KEY }),
    ...options.headers
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }
    return response.json();
  } catch (err) {
    console.error(`API call failed: ${endpoint}`, err);
    return null;
  }
};

export default function App() {
  const [appState, setAppState] = useState('network-select');
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [mneeContract, setMneeContract] = useState(null);
  const [factoryContract, setFactoryContract] = useState(null);
  const [vault, setVault] = useState(null);
  const [vaultAddress, setVaultAddress] = useState(null);
  const [vaultData, setVaultData] = useState(null);
  const [walletBalance, setWalletBalance] = useState('0');
  const [transactions, setTransactions] = useState([]);
  const [agentTransactions, setAgentTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [networkName, setNetworkName] = useState('');
  const [apiConnected, setApiConnected] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [forceNewWallet, setForceNewWallet] = useState(false);
  const [agentManager, setAgentManager] = useState(null);
  const [agentWalletAddress, setAgentWalletAddress] = useState(null);
  const [agentBalance, setAgentBalance] = useState('0');
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [scheduler, setScheduler] = useState(null);

  const handleNetworkSelect = async (network) => {
    setSelectedNetwork(network);
    setAppState('connecting');
    await connectWallet(network);
  };

  const connectWallet = async (network) => {
    // Check if on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!window.ethereum) {
      if (isMobile) {
        // Deep link to MetaMask app
        const dappUrl = window.location.href.replace('https://', '').replace('http://', '');
        const metamaskDeepLink = `https://metamask.app.link/dapp/${dappUrl}`;
        window.location.href = metamaskDeepLink;
        return;
      } else {
        alert('Please install MetaMask');
        setAppState('network-select');
        return;
      }
    }

    const networkConfig = NETWORKS[network];

    try {
      setLoading(true);

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: networkConfig.chainId }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: networkConfig.chainId,
              chainName: networkConfig.name,
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [networkConfig.rpcUrl],
              blockExplorerUrls: [networkConfig.explorer]
            }]
          });
        } else {
          throw switchError;
        }
      }

      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      
      let accounts;
      if (forceNewWallet) {
        try {
          await window.ethereum.request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }]
          });
        } catch (permErr) {
          console.log('Permission request cancelled:', permErr);
          setForceNewWallet(false);
          setAppState('network-select');
          setLoading(false);
          return;
        }
        setForceNewWallet(false);
      }
      
      accounts = await browserProvider.send('eth_requestAccounts', []);
      
      if (!accounts || accounts.length === 0) {
        alert('No account selected');
        setAppState('network-select');
        setLoading(false);
        return;
      }
      
      const userSigner = await browserProvider.getSigner();
      const chainNetwork = await browserProvider.getNetwork();

      const chainId = Number(chainNetwork.chainId);
      if (chainId !== networkConfig.chainIdDecimal) {
        alert(`Please switch to ${networkConfig.name} network`);
        setAppState('network-select');
        return;
      }

      setProvider(browserProvider);
      setSigner(userSigner);
      setAccount(accounts[0]);
      setNetworkName(networkConfig.name);

      const mnee = new ethers.Contract(networkConfig.mneeToken, MNEE_ABI, userSigner);
      setMneeContract(mnee);

      if (networkConfig.vaultFactory !== '0x0000000000000000000000000000000000000000') {
        const factory = new ethers.Contract(networkConfig.vaultFactory, FACTORY_ABI, userSigner);
        setFactoryContract(factory);

        const userVault = await factory.getUserVault(accounts[0]);
        if (userVault !== '0x0000000000000000000000000000000000000000') {
          setVaultAddress(userVault);
          const vaultContract = new ethers.Contract(userVault, VAULT_ABI, userSigner);
          setVault(vaultContract);
          setAppState('dashboard');
        } else {
          setAppState('onboarding');
        }
      } else {
        const legacyVaultAddress = '0x4061A452CE5927C2420060Eb7A680798B86e0117';
        setVaultAddress(legacyVaultAddress);
        const vaultContract = new ethers.Contract(legacyVaultAddress, VAULT_ABI, userSigner);
        setVault(vaultContract);
        setAppState('dashboard');
      }

    } catch (err) {
      console.error('Connection error:', err);
      alert('Failed to connect: ' + (err.message || 'Unknown error'));
      setAppState('network-select');
    } finally {
      setLoading(false);
    }
  };

  const handleOnboardingComplete = (newVaultAddress) => {
    setVaultAddress(newVaultAddress);
    const vaultContract = new ethers.Contract(newVaultAddress, VAULT_ABI, signer);
    setVault(vaultContract);
    setAppState('dashboard');
  };

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setVault(null);
    setVaultAddress(null);
    setVaultData(null);
    setMneeContract(null);
    setFactoryContract(null);
    setWalletBalance('0');
    setTransactions([]);
    setAlerts([]);
    setVendors([]);
    setSelectedNetwork(null);
    setForceNewWallet(true); // Force wallet picker on next connect
    setAppState('network-select');
  };

  const checkApiHealth = useCallback(async () => {
    const health = await apiCall('/health');
    setApiConnected(health?.status === 'healthy');
    return health;
  }, []);

  const loadAlertsFromApi = useCallback(async () => {
    const data = await apiCall('/api/v1/alerts?acknowledged=0');
    if (data?.alerts) {
      setAlerts(data.alerts.map(alert => ({
        id: alert.id,
        severity: alert.severity === 'critical' ? 'critical' : 
                  alert.severity === 'warning' ? 'high' : 'medium',
        title: alert.alert_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        message: alert.message,
        timestamp: new Date(alert.created_at).getTime(),
        transactionId: alert.tx_id,
        acknowledged: alert.acknowledged === 1
      })));
    }
  }, []);

  const loadVendorsFromApi = useCallback(async () => {
    const localVendors = JSON.parse(localStorage.getItem(`vendors_${account}`) || '[]');
    
    const data = await apiCall('/api/v1/vendors');
    if (data?.vendors && data.vendors.length > 0) {
      setVendors(data.vendors.map(v => ({
        address: v.address,
        name: v.name || 'Unknown',
        trusted: v.trusted === 1,
        txCount: v.transaction_count,
        volume: ethers.formatUnits(v.total_received_wei || '0', 18)
      })));
    } else if (localVendors.length > 0) {
      setVendors(localVendors);
    }
  }, [account]);

  const saveVendorToStorage = useCallback((newVendor) => {
    if (!account) return;
    const key = `vendors_${account}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = existing.filter(v => v.address.toLowerCase() !== newVendor.address.toLowerCase());
    const updated = [...filtered, newVendor];
    localStorage.setItem(key, JSON.stringify(updated));
    setVendors(updated);
  }, [account]);

  const removeVendorFromStorage = useCallback((address) => {
    if (!account) return;
    const key = `vendors_${account}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = existing.filter(v => v.address.toLowerCase() !== address.toLowerCase());
    localStorage.setItem(key, JSON.stringify(updated));
    setVendors(updated);
  }, [account]);

  const loadWalletBalance = useCallback(async () => {
    if (!mneeContract || !account) return;
    try {
      const balance = await mneeContract.balanceOf(account);
      setWalletBalance(ethers.formatUnits(balance, 18));
    } catch (err) {
      console.error('Load wallet balance error:', err);
    }
  }, [mneeContract, account]);

  const getAgentTxLabel = (type) => {
  const labels = {
    'payment': '🤖 AGENT PAYMENT',
    'savings_deposit': '💰 SAVINGS DEPOSIT', 
    'withdrawal': '📤 AGENT WITHDRAWAL',
    'funding': '📥 AGENT FUNDED',
    'schedule': '📅 SCHEDULED PAYMENT'
  };
  return labels[type] || '🤖 AGENT TX';
};

 const loadVaultData = useCallback(async () => {
  if (!vault) return;

  try {
    const [balance, dailyLimit, txLimit, timeLock, txCount] = await Promise.all([
      vault.getVaultBalance(),
      vault.dailyLimit(),
      vault.transactionLimit(),
      vault.timeLockDuration(),
      vault.txCounter()
    ]);

    setVaultData({
      address: vaultAddress,
      balance: ethers.formatUnits(balance, 18),
      dailyLimit: ethers.formatUnits(dailyLimit, 18),
      txLimit: ethers.formatUnits(txLimit, 18),
      timeLockDuration: Number(timeLock),
      totalTransactions: Number(txCount)
    });

    // Load vault transactions from API
    const apiTxData = await apiCall('/api/v1/transactions/history?limit=20');
    const apiTxMap = new Map();
    if (apiTxData?.transactions) {
      apiTxData.transactions.forEach(tx => {
        apiTxMap.set(tx.tx_id, {
          riskScore: tx.risk_score,
          riskFactors: JSON.parse(tx.risk_factors || '[]')
        });
      });
    }

    // Load on-chain vault transactions
    const txs = [];
    const count = Math.min(Number(txCount), 20);
    for (let i = Number(txCount) - 1; i >= Math.max(0, Number(txCount) - count); i--) {
      const tx = await vault.getTransaction(i);
      const apiData = apiTxMap.get(i) || {};
      
      txs.push({
        id: i,
        isAgentTx: false, // Vault transaction
        txType: 'vault',
        agent: tx.agent,
        vendor: tx.vendor,
        amount: ethers.formatUnits(tx.amount, 18),
        timestamp: Number(tx.timestamp),
        executeAfter: Number(tx.executeAfter),
        executed: tx.executed,
        revoked: tx.revoked,
        reason: tx.reason,
        riskScore: apiData.riskScore ? Math.round(apiData.riskScore * 100) : null,
        riskFactors: apiData.riskFactors || [],
        trustedVendor: await vault.trustedVendors(tx.vendor).catch(() => false)
      });
    }
    setTransactions(txs);

    // Load agent wallet transactions
    if (account) {
      try {
        const agentResponse = await apiCall(`/api/v1/agent/transactions/${account}?limit=20`);
        if (agentResponse?.transactions) {
          const agentTxs = agentResponse.transactions.map(tx => ({
            id: tx.id,
            isAgentTx: true,
            txType: 'agent',
            executionType: tx.execution_type,
            agent: tx.agent,
            vendor: tx.destination,
            amount: tx.amount,
            timestamp: tx.timestamp ? new Date(tx.timestamp).getTime() / 1000 : Date.now() / 1000,
            txHash: tx.tx_hash,
            status: tx.status,
            executed: tx.status === 'success',
            revoked: tx.status === 'failed',
            displayLabel: getAgentTxLabel(tx.execution_type)
          }));
          setAgentTransactions(agentTxs);
        }
      } catch (err) {
        console.error('Load agent transactions error:', err);
      }
    }

    await Promise.all([
      loadAlertsFromApi(),
      loadVendorsFromApi(),
      loadWalletBalance()
    ]);

  } catch (err) {
    console.error('Load vault data error:', err);
  }
}, [vault, vaultAddress, account, loadAlertsFromApi, loadVendorsFromApi, loadWalletBalance]);


const loadAgentTransactions = useCallback(async () => {
  if (!account) return;
  
  try {
    const response = await apiCall(`/api/v1/agent/transactions/${account}?limit=50`);
    if (response?.transactions) {
      // Format agent transactions for display
      const formattedTxs = response.transactions.map(tx => ({
        id: tx.id,
        isAgentTx: true, // IMPORTANT: Flag for styling
        txType: 'agent',
        executionType: tx.execution_type,
        agent: tx.agent,
        vendor: tx.destination,
        amount: tx.amount,
        timestamp: tx.timestamp ? new Date(tx.timestamp).getTime() / 1000 : Date.now() / 1000,
        txHash: tx.tx_hash,
        status: tx.status,
        executed: tx.status === 'success',
        revoked: tx.status === 'failed',
        scheduleId: tx.schedule_id,
        savingsPlanId: tx.savings_plan_id,
        // Display labels based on execution type
        displayLabel: getAgentTxLabel(tx.execution_type)
      }));
      
      setAgentTransactions(formattedTxs);
    }
  } catch (err) {
    console.error('Load agent transactions error:', err);
  }
}, [account]);


  useEffect(() => {
    if (appState === 'dashboard' && vault) {
      checkApiHealth();
      loadVaultData();

      const interval = setInterval(() => {
        loadVaultData();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [appState, vault, checkApiHealth, loadVaultData]);

 useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          window.location.reload();
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }, []);

  useEffect(() => {
    if (account && vaultAddress && selectedNetwork) {
      const networkConfig = NETWORKS[selectedNetwork];
      const manager = new AgentWalletManager(account, vaultAddress, networkConfig);
      setAgentManager(manager);
      
           if (manager.hasWallet()) {
        setAgentWalletAddress(manager.getAddress());
      
        if (provider) {
          manager.getBalance(provider).then(balance => {
            setAgentBalance(balance);
          });
        }
      }
      
           const sched = new RecurringScheduler(account, API_URL);
      sched.load();
      setScheduler(sched);
    }
  }, [account, vaultAddress, selectedNetwork, provider]);

    const loadAgentBalance = async (manager) => {
    if (manager && provider) {
      const balance = await manager.getBalance(provider);
      setAgentBalance(balance);
    }
  };

  const refreshAgentData = async () => {
    if (agentManager) {
      await loadAgentBalance(agentManager);
    }
    loadVaultData();
    loadWalletBalance();
  };

  if (appState === 'network-select') {
    return <NetworkSelector onSelectNetwork={handleNetworkSelect} />;
  }

  if (appState === 'connecting') {
    return (
      <div className="loading-screen">
       <div className="loader-box">
  <img 
    src={sentinelLogo} 
    className="spin" 
    alt="Loading..." 
    style={{ height: '48px', width: 'auto', marginBottom: '16px' }} 
  />
  <p>ESTABLISHING UPLINK TO {selectedNetwork === 'sepolia' ? 'SEPOLIA' : 'MAINNET'}...</p>
</div>
        <style jsx>{`
          .loading-screen {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--bg-primary, #1a1a1a);
          }
          .loader-box {
            text-align: center;
            border: 4px solid var(--border-color, #ffcc00);
            padding: 40px;
            background: var(--bg-card, #2a2a2a);
            box-shadow: 8px 8px 0px 0px var(--border-color, #ffcc00);
            color: var(--text-primary, #ffcc00);
          }
          .loader-box p {
            margin-top: 16px;
            font-family: var(--font-pixel);
            font-size: 12px;
          }
          .spin { animation: spin 2s linear infinite; }
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (appState === 'onboarding') {
    return (
      <Onboarding
        account={account}
        network={selectedNetwork}
        mneeContract={mneeContract}
        factoryContract={factoryContract}
        onComplete={handleOnboardingComplete}
        onBack={() => setAppState('network-select')}
      />
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-left">
       <div className="logo-box">
  <img 
    src={sentinelLogo} 
    alt="Sentinel Logo" 
    className="site-logo" 
  />
  <span className="logo-text">SENTINEL</span>
</div>
          <div className={`network-tag ${selectedNetwork}`}>
            <div className="dot"></div>
            <span className="net-name">{networkName || selectedNetwork.toUpperCase()}</span>
          </div>
        </div>

        <nav className="nav-bar">
          {[
            { id: 'dashboard', label: 'DASHBOARD', icon: Activity },
            { id: 'agent', label: 'AI AGENT', icon: Bot },
            { id: 'transactions', label: 'LOGS', icon: Clock },
            { id: 'alerts', label: 'ALERTS', icon: Bell, badge: alerts.filter(a => !a.acknowledged).length },
            { id: 'settings', label: 'CONFIG', icon: Settings },
            { id: 'api', label: 'DEV API', icon: Code, external: true }
          ].map(tab => (
            <button
              key={tab.id}
              className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                if (tab.external) {
                  window.open('https://docs.sentinelfinance.xyz', '_blank');
                } else {
                  setActiveTab(tab.id);
                }
              }}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
              {tab.badge > 0 && <span className="badge">{tab.badge}</span>}
              {tab.external && <ExternalLink size={10} />}
            </button>
          ))}
        </nav>

        <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {mobileMenuOpen && (
          <div className="mobile-nav">
            {[
              { id: 'dashboard', label: 'DASHBOARD', icon: Activity },
              { id: 'agent', label: 'AI AGENT', icon: Bot },
              { id: 'transactions', label: 'LOGS', icon: Clock },
              { id: 'alerts', label: 'ALERTS', icon: Bell, badge: alerts.filter(a => !a.acknowledged).length },
              { id: 'settings', label: 'CONFIG', icon: Settings },
              { id: 'api', label: 'DEV API', icon: Code, external: true }
            ].map(tab => (
              <button
                key={tab.id}
                className={`mobile-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => { 
                  if (tab.external) {
                    window.open('https://docs.sentinelfinance.xyz', '_blank');
                  } else {
                    setActiveTab(tab.id);
                  }
                  setMobileMenuOpen(false); 
                }}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
                {tab.badge > 0 && <span className="badge">{tab.badge}</span>}
                {tab.external && <ExternalLink size={12} />}
              </button>
            ))}
          </div>
        )}

        <div className="header-right">
          <button 
            className="agent-btn"
            onClick={() => setShowAgentPanel(true)}
            title="Agent Wallet"
          >
            <Bot size={18} />
            {agentWalletAddress && (
              <span className="agent-balance">{parseFloat(agentBalance).toFixed(0)}</span>
            )}
          </button>
          
          <div className="balance-group">
            <div className="bal-item">
              <span className="label">WALLET</span>
              <span className="val">{parseFloat(walletBalance).toFixed(2)}</span>
            </div>
            <div className="bal-item vault">
              <span className="label">VAULT</span>
              <span className="val">{vaultData ? parseFloat(vaultData.balance).toFixed(2) : '0.00'}</span>
            </div>
          </div>
          
          <div className="action-group">
            <a href="https://github.com/ismail-169/sentinel-finance" target="_blank" rel="noopener noreferrer" className="icon-btn github" title="GITHUB">
              <Github size={16} />
            </a>
            <button className="icon-btn" onClick={() => setShowDepositModal(true)} title="DEPOSIT">
              <ArrowDownToLine size={16} />
            </button>
            <button className="icon-btn" onClick={() => setShowWithdrawModal(true)} title="WITHDRAW">
              <ArrowUpFromLine size={16} />
            </button>
          </div>

          <div className="account-box">
            <div className="addr">{account?.slice(0, 6)}...{account?.slice(-4)}</div>
            <button className="logout-btn" onClick={disconnectWallet} title="DISCONNECT WALLET">
              <LogOut size={14} />
              <span className="logout-text">EXIT</span>
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              style={{ width: '100%' }}
            >
             <Dashboard
  vaultData={vaultData}
  vaultBalance={vaultData?.balance || '0'}
  transactions={[...transactions, ...agentTransactions].sort((a, b) => b.timestamp - a.timestamp)}
  account={account}
  onRefresh={loadVaultData}
/>
            </motion.div>
          )}

          {activeTab === 'agent' && (
            <motion.div
              key="agent"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              style={{ width: '100%' }}
            >
         <AIAgentChat 
  contract={vault}
  account={account}
  onTransactionCreated={loadVaultData}
  trustedVendors={vendors}
  agentManager={agentManager}
  scheduler={scheduler}
  provider={provider}
  signer={signer}
  networkConfig={NETWORKS[selectedNetwork]}
  vaultAddress={vaultAddress}
  onAgentWalletUpdate={refreshAgentData}
/>
            </motion.div>
          )}

          {activeTab === 'transactions' && (
            <motion.div
              key="transactions"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              style={{ width: '100%' }}
            >
              <TransactionList
  key="transactions"
  transactions={[...transactions, ...agentTransactions].sort((a, b) => b.timestamp - a.timestamp)}
  contract={vault}
  account={account}
  onRevoke={loadVaultData}
  onExecute={loadVaultData}
/>
            </motion.div>
          )}

          {activeTab === 'alerts' && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              style={{ width: '100%' }}
            >
              <AlertPanel 
                alerts={alerts}
                onAcknowledge={async (id) => {
                  await apiCall('/api/v1/alerts/acknowledge', {
                    method: 'POST',
                    body: JSON.stringify({ alert_id: id })
                  });
                  loadAlertsFromApi();
                }}
                onRefresh={loadAlertsFromApi}
                account={account}
              />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              style={{ width: '100%' }}
            >
            <VaultStats 
  vaultData={vaultData}
  vendors={vendors}
  contract={vault}
  onRefresh={loadVaultData}
  onSaveVendor={saveVendorToStorage}
  onRemoveVendor={removeVendorFromStorage}
  account={account}
  scheduler={scheduler}
/>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        walletBalance={walletBalance}
        mneeContract={mneeContract}
        vaultAddress={vaultAddress}
        onSuccess={() => {
          loadVaultData();
          loadWalletBalance();
        }}
      />

      <WithdrawModal
        isOpen={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        vaultBalance={vaultData?.balance || '0'}
        vaultContract={vault}
        onSuccess={() => {
          loadVaultData();
          loadWalletBalance();
        }}
      />

      <AgentWalletPanel
        agentManager={agentManager}
        provider={provider}
        signer={signer}
        vaultBalance={vaultData?.balance || '0'}
        vaultContract={vault}
        networkConfig={NETWORKS[selectedNetwork]}
        onRefresh={refreshAgentData}
        isOpen={showAgentPanel}
        onClose={() => setShowAgentPanel(false)}
      />

      <style jsx>{`
        .app-container {
          min-height: 100vh;
          background: var(--bg-primary, #1a1a1a);
          display: flex;
          flex-direction: column;
        }

        .header {
          background: var(--bg-card, #2a2a2a);
          border-bottom: 4px solid var(--border-color, #ffcc00);
          padding: 0 32px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
          width: 100%;
          gap: 24px;
        }

        .header-left { 
          display: flex; 
          align-items: center; 
          gap: 24px; 
          flex-shrink: 0; 
        }
        
        .logo-box { 
          display: flex; 
          align-items: center; 
          gap: 12px; 
          color: var(--text-primary, #ffcc00);
        }
        .logo-text { 
          font-family: var(--font-pixel); 
          font-size: 24px; 
          letter-spacing: -1px; 
          color: var(--text-primary, #ffcc00);
        }

        .network-tag { 
          display: flex; 
          align-items: center; 
          gap: 8px; 
          padding: 6px 12px; 
          border: 2px solid var(--border-color, #ffcc00); 
          background: var(--bg-secondary, #252525); 
        }
        .network-tag.mainnet .dot { background: var(--accent-red); box-shadow: 0 0 5px var(--accent-red); }
        .network-tag.sepolia .dot { background: var(--accent-amber, #ffcc00); }
        .dot { width: 8px; height: 8px; border-radius: 50%; border: 1px solid var(--border-color, #ffcc00); }
        .net-name { font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--text-primary, #ffcc00); }

        .nav-bar { 
          display: flex; 
          gap: 4px; 
          height: 100%; 
          align-items: flex-end; 
          flex: 0 0 auto;
        }
        
        .nav-btn {
          height: 60%;
          min-height: 48px;
          display: flex; 
          align-items: center; 
          gap: 6px;
          padding: 0 16px;
          background: transparent;
          border: 2px solid transparent;
          border-bottom: none;
          font-family: var(--font-geo); 
          font-size: 12px; 
          font-weight: 700;
          cursor: pointer;
          transition: background 0.1s, border-color 0.1s;
          white-space: nowrap;
          box-sizing: border-box;
          color: var(--text-secondary, #e6b800);
        }
        
        .nav-btn:hover { 
          background: var(--bg-secondary, #252525); 
          color: var(--text-primary, #ffcc00);
        }
        
        .nav-btn.active {
          background: var(--bg-primary, #1a1a1a);
          border: 2px solid var(--border-color, #ffcc00);
          border-bottom: 4px solid var(--bg-primary, #1a1a1a); 
          margin-bottom: -4px; 
          z-index: 10;
          color: var(--text-primary, #ffcc00);
        }
        
        .badge {
          background: var(--accent-red); 
          color: white; 
          font-size: 10px; 
          padding: 2px 6px; 
          border: 1px solid var(--accent-red); 
          font-family: var(--font-mono);
        }

        .header-right { 
          display: flex; 
          align-items: center; 
          gap: 16px; 
          flex-shrink: 0; 
        }

        .balance-group { display: flex; }
        .bal-item {
          border: 2px solid var(--border-color, #ffcc00); 
          padding: 8px 16px; 
          background: var(--bg-card, #2a2a2a);
          display: flex; 
          flex-direction: column; 
          align-items: flex-end; 
          justify-content: center;
        }
        .bal-item.vault { 
          background: var(--bg-secondary, #252525); 
          border-left: none; 
        }
        .label { 
          font-size: 9px; 
          font-weight: 700; 
          color: var(--text-muted, #b38f00); 
        }
        .val { 
          font-family: var(--font-mono); 
          font-size: 14px; 
          font-weight: 700; 
          color: var(--text-primary, #ffcc00);
        }

        .action-group { display: flex; gap: 8px; }
        .icon-btn {
          width: 40px; 
          height: 40px; 
          border: 2px solid var(--border-color, #ffcc00); 
          background: var(--bg-card, #2a2a2a);
          display: flex; 
          align-items: center; 
          justify-content: center;
          cursor: pointer; 
          transition: transform 0.1s;
          box-shadow: 2px 2px 0px 0px var(--border-color, #ffcc00);
          color: var(--text-primary, #ffcc00);
        }
        .icon-btn:active { transform: translate(2px, 2px); box-shadow: none; }
        .icon-btn:hover { background: var(--text-primary, #ffcc00); color: var(--bg-primary, #1a1a1a); }

        .account-box { 
          display: flex; 
          align-items: center; 
          border: 2px solid var(--border-color, #ffcc00); 
          padding-left: 12px; 
          background: var(--bg-secondary, #252525);
        }
        .addr { 
          font-family: var(--font-mono); 
          font-size: 12px; 
          margin-right: 12px; 
          color: var(--text-primary, #ffcc00);
        }
        .logout-btn {
          padding: 8px 12px; 
          background: var(--text-primary, #ffcc00); 
          color: var(--bg-primary, #1a1a1a); 
          border: none;
          cursor: pointer; 
          display: flex; 
          align-items: center; 
          justify-content: center;
          gap: 6px;
          font-family: var(--font-pixel);
          font-size: 10px;
          font-weight: 700;
          transition: all 0.2s;
        }
        .logout-text { display: inline; }
        .logout-btn:hover { background: var(--accent-red); color: white; }

        .main-content {
          flex: 1;
          padding: 40px;
          max-width: 1400px;
          margin: 0 auto;
          width: 100%;
        }

        .mobile-menu-btn {
          display: none;
          background: none;
          border: 2px solid var(--border-color, #ffcc00);
          padding: 8px;
          cursor: pointer;
          color: var(--text-primary, #ffcc00);
          margin-left: auto;
        }

        .mobile-nav {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--bg-card, #2a2a2a);
          border-bottom: 2px solid var(--border-color, #ffcc00);
          flex-direction: column;
          z-index: 100;
        }

        .mobile-nav-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 24px;
          background: none;
          border: none;
          border-bottom: 1px solid var(--bg-secondary, #252525);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          text-align: left;
          color: var(--text-primary, #ffcc00);
        }

        .mobile-nav-btn.active {
          background: var(--text-primary, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
        }

        .mobile-nav-btn .badge {
          margin-left: auto;
        }

        @media (max-width: 1200px) {
          .nav-bar { display: none; }
          .mobile-menu-btn { display: flex; }
          .mobile-nav { display: flex; }
        }

        @media (max-width: 768px) {
          .header { height: auto; flex-wrap: wrap; padding: 16px; gap: 12px; position: relative; }
          .header-left { width: auto; }
          .header-right { width: auto; gap: 8px; }
          .balance-group { display: none; }
          .main-content { padding: 16px; }
          .action-group { gap: 4px; }
          .icon-btn { padding: 8px; width: 36px; height: 36px; }
          .account-box { padding-left: 8px; }
          .addr { font-size: 10px; margin-right: 8px; }
          .logout-btn { padding: 6px 10px; }
        }

        @media (max-width: 480px) {
          .logo-text { display: none; }
          .network-tag .net-name { display: none; }
          .logout-text { display: none; }
          .logout-btn { padding: 8px; }
          .icon-btn { width: 32px; height: 32px; }
          .icon-btn svg { width: 14px; height: 14px; }
        }

        .agent-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: #60a5fa;
          border: 2px solid #60a5fa;
          color: white;
          font-family: var(--font-pixel);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .agent-btn:hover {
          background: #3b82f6;
          transform: translate(-2px, -2px);
          box-shadow: 4px 4px 0 #60a5fa;
        }
        .agent-balance {
          background: rgba(0,0,0,0.3);
          padding: 2px 6px;
          font-family: var(--font-mono);
          font-size: 10px;
        }
      `}</style>
    </div>
  );
}
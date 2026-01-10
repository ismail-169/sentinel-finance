import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { 
  Shield, Wallet, Droplets, Plus, ArrowRight, Check, 
  Loader, AlertCircle, Coins, ChevronLeft, ExternalLink, Copy, Fuel
} from 'lucide-react';

export default function Onboarding({ 
  account,
  network,
  mneeContract,
  factoryContract,
  onComplete,
  onBack
}) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [walletBalance, setWalletBalance] = useState('0');
  const [ethBalance, setEthBalance] = useState('0');
  const [canClaim, setCanClaim] = useState(true);
  const [vaultAddress, setVaultAddress] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [wrongChain, setWrongChain] = useState(false);

  const NETWORK_CONFIG = {
    sepolia: {
      chainId: '0xaa36a7',
      chainIdDecimal: 11155111,
      name: 'Sepolia',
      rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/demo',
      explorer: 'https://sepolia.etherscan.io'
    },
    mainnet: {
      chainId: '0x1',
      chainIdDecimal: 1,
      name: 'Mainnet',
      rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/demo',
      explorer: 'https://etherscan.io'
    }
  };

  const switchToCorrectChain = async () => {
    const config = NETWORK_CONFIG[network];
    if (!config || !window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: config.chainId }],
      });
      setWrongChain(false);
      setError('');
      await loadBalanceAndStatus();
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: config.chainId,
              chainName: config.name,
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [config.rpcUrl],
              blockExplorerUrls: [config.explorer]
            }]
          });
          setWrongChain(false);
          setError('');
        } catch (addError) {
          setError('Failed to add network. Please add it manually.');
        }
      } else {
        setError('Failed to switch network. Please switch manually.');
      }
    }
  };

  const ETH_FAUCETS = [
    { name: 'GOOGLE CLOUD', url: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia' },
    { name: 'ALCHEMY', url: 'https://www.alchemy.com/faucets/ethereum-sepolia' },
    { name: 'INFURA', url: 'https://www.infura.io/faucet/sepolia' }
  ];

  useEffect(() => {
    if (mneeContract && account) {
      loadBalanceAndStatus();
    }
  }, [mneeContract, account]);

  const loadBalanceAndStatus = async () => {
    setRefreshing(true);
    try {
      // Check if on correct chain first
      if (window.ethereum) {
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        const expectedChainId = NETWORK_CONFIG[network]?.chainId;
        
        if (currentChainId !== expectedChainId) {
          setWrongChain(true);
          setError(`Please switch to ${NETWORK_CONFIG[network]?.name || network} network`);
          setRefreshing(false);
          return;
        }
        setWrongChain(false);
      }

      const balance = await mneeContract.balanceOf(account);
      setWalletBalance(ethers.formatUnits(balance, 18));
      
      const provider = mneeContract.runner.provider;
      const eth = await provider.getBalance(account);
      setEthBalance(ethers.formatEther(eth));
      
      if (network === 'sepolia') {
        try {
          const canClaimFaucet = await mneeContract.canClaimFaucet(account);
          setCanClaim(canClaimFaucet);
        } catch (e) {
          setCanClaim(true);
        }
      }
      setError('');
    } catch (err) {
      console.error('Load balance error:', err);
      if (err.message?.includes('network') || err.message?.includes('chain')) {
        setWrongChain(true);
        setError(`Please switch to ${NETWORK_CONFIG[network]?.name || network} network`);
      }
    } finally {
      setRefreshing(false);
    }
  };

  const claimFaucet = async () => {
    if (!mneeContract) return;
    setLoading(true);
    setError('');
    
    try {
      const tx = await mneeContract.faucet();
      await tx.wait();
      await loadBalanceAndStatus();
      setStep(2);
    } catch (err) {
      setError(err.reason || err.message || 'Failed to claim tokens');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(account);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const createVault = async () => {
    if (!factoryContract) return;
    setLoading(true);
    setError('');
    
    try {
      const tx = await factoryContract.createVault();
      const receipt = await tx.wait();
      
      const event = receipt.logs.find(log => {
        try {
          const parsed = factoryContract.interface.parseLog(log);
          return parsed.name === 'VaultCreated';
        } catch {
          return false;
        }
      });
      
      if (event) {
        const parsed = factoryContract.interface.parseLog(event);
        setVaultAddress(parsed.args.vault);
      } else {
        const vault = await factoryContract.getUserVault(account);
        setVaultAddress(vault);
      }
      
      setStep(3);
    } catch (err) {
      setError(err.reason || err.message || 'Failed to create vault');
    } finally {
      setLoading(false);
    }
  };

  const depositToVault = async () => {
    if (!vaultAddress || !depositAmount) return;
    setLoading(true);
    setError('');
    
    try {
      const amount = ethers.parseUnits(depositAmount, 18);
      
      const approveTx = await mneeContract.approve(vaultAddress, amount);
      await approveTx.wait();
      
      const vaultAbi = ["function deposit(uint256 amount)"];
      const vaultContract = new ethers.Contract(
        vaultAddress, 
        vaultAbi, 
        mneeContract.runner
      );
      
      const depositTx = await vaultContract.deposit(amount);
      await depositTx.wait();
      
      onComplete(vaultAddress);
    } catch (err) {
      setError(err.reason || err.message || 'Failed to deposit');
    } finally {
      setLoading(false);
    }
  };

  const skipDeposit = () => {
    onComplete(vaultAddress);
  };

  const setMaxAmount = () => {
    setDepositAmount(walletBalance);
  };

  const needsEth = parseFloat(ethBalance) < 0.001;

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div 
            className="step-content"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="step-icon">
              <Droplets size={32} />
            </div>
            <h2>ACQUIRE ASSETS</h2>
            <p>CLAIM TESTNET MNEE TOKENS TO PROCEED</p>

            {wrongChain && (
              <div className="wrong-chain-banner">
                <AlertCircle size={16} />
                <span>WRONG NETWORK DETECTED</span>
                <button className="switch-btn" onClick={switchToCorrectChain}>
                  SWITCH TO {NETWORK_CONFIG[network]?.name?.toUpperCase() || network.toUpperCase()}
                </button>
              </div>
            )}
            
            <div className="balances-grid">
              <div className="balance-box">
                <div className="bal-header">
                  <Coins size={14} />
                  <span>TEST MNEE</span>
                </div>
                <span className="bal-value">{parseFloat(walletBalance).toLocaleString()}</span>
              </div>
              <div className="balance-box">
                <div className="bal-header">
                  <Fuel size={14} />
                  <span>SEPOLIA ETH</span>
                </div>
                <span className={`bal-value ${needsEth ? 'low' : ''}`}>{parseFloat(ethBalance).toFixed(4)}</span>
              </div>
            </div>

            {needsEth && (
              <div className="eth-section">
                <div className="warning-banner">
                  <AlertCircle size={14} />
                  <span>SEPOLIA ETH REQUIRED FOR GAS</span>
                </div>
                
                <div className="wallet-box">
                  <span className="wallet-label">YOUR ADDRESS:</span>
                  <div className="wallet-row">
                    <code>{account?.slice(0, 12)}...{account?.slice(-10)}</code>
                    <button className="copy-btn" onClick={copyAddress}>
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <div className="faucet-list">
                  <span className="faucet-title">GET FREE SEPOLIA ETH:</span>
                  {ETH_FAUCETS.map((faucet, i) => (
                    <a 
                      key={i}
                      href={faucet.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="faucet-link"
                    >
                      <ExternalLink size={12} />
                      <span>{faucet.name}</span>
                    </a>
                  ))}
                </div>

                <button className="refresh-btn" onClick={loadBalanceAndStatus} disabled={refreshing}>
                  {refreshing ? <Loader size={12} className="spin" /> : <Loader size={12} />} 
                  {refreshing ? 'REFRESHING...' : 'REFRESH BALANCE'}
                </button>
              </div>
            )}

            {!needsEth && parseFloat(walletBalance) > 0 && (
              <div className="status-msg success">
                <Check size={14} />
                <span>ASSETS DETECTED</span>
              </div>
            )}

            <div className="action-row">
              {!needsEth && network === 'sepolia' && (
                <button 
                  className="primary-btn"
                  onClick={claimFaucet}
                  disabled={loading || !canClaim}
                >
                  {loading ? <Loader className="spin" size={16} /> : <Droplets size={16} />}
                  {canClaim ? 'CLAIM 1000 MNEE' : 'CLAIMED (WAIT 1HR)'}
                </button>
              )}
              
              {!needsEth && parseFloat(walletBalance) > 0 && (
                <button 
                  className="secondary-btn"
                  onClick={() => setStep(2)}
                >
                  CONTINUE <ArrowRight size={16} />
                </button>
              )}
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div 
            className="step-content"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="step-icon">
              <Shield size={32} />
            </div>
            <h2>DEPLOY VAULT</h2>
            <p>INITIALIZE YOUR PERSONAL SMART CONTRACT</p>
            
            <div className="info-card">
              <AlertCircle size={16} />
              <span>YOU ARE THE SOLE OWNER OF THIS CONTRACT.</span>
            </div>

            <div className="action-row">
              <button 
                className="primary-btn"
                onClick={createVault}
                disabled={loading}
              >
                {loading ? <Loader className="spin" size={16} /> : <Plus size={16} />}
                CREATE VAULT
              </button>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div 
            className="step-content"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="step-icon">
              <Coins size={32} />
            </div>
            <h2>FUND VAULT</h2>
            <p>DEPOSIT INITIAL CAPITAL FOR AI OPERATIONS</p>
            
            <div className="vault-id">
              <Check size={14} />
              VAULT: {vaultAddress?.slice(0, 10)}...{vaultAddress?.slice(-8)}
            </div>

            <div className="deposit-box">
              <div className="bal-row">
                <span>AVAILABLE: {parseFloat(walletBalance).toLocaleString()}</span>
                <button className="max-btn" onClick={setMaxAmount}>MAX</button>
              </div>
              <div className="input-row">
                <input
                  type="number"
                  placeholder="0.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
                <span className="unit">MNEE</span>
              </div>
            </div>

            <div className="action-col">
              <button 
                className="primary-btn"
                onClick={depositToVault}
                disabled={loading || !depositAmount || parseFloat(depositAmount) <= 0}
              >
                {loading ? <Loader className="spin" size={16} /> : <ArrowRight size={16} />}
                DEPOSIT & LAUNCH
              </button>
              
              <button 
                className="text-btn"
                onClick={skipDeposit}
                disabled={loading}
              >
                SKIP DEPOSIT
              </button>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="onboarding-wrap">
      <div className="wizard-card">
        <div className="wizard-header">
          <button className="back-btn" onClick={onBack}>
            <ChevronLeft size={16} /> BACK
          </button>
          <div className="step-indicator">STEP {step} / 3</div>
        </div>

        <div className="progress-track">
          <div className={`track-step ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className="track-line"></div>
          <div className={`track-step ${step >= 2 ? 'active' : ''}`}>2</div>
          <div className="track-line"></div>
          <div className={`track-step ${step >= 3 ? 'active' : ''}`}>3</div>
        </div>

        {error && (
          <motion.div 
            className="error-banner"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AlertCircle size={16} /> {error.toUpperCase()}
          </motion.div>
        )}

        {renderStep()}
      </div>

      <style jsx>{`
        .onboarding-wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary, #1a1a1a);
          padding: 20px;
        }

        .wizard-card {
          width: 100%;
          max-width: 520px;
          border: 4px solid var(--border-color, #ffcc00);
          background: var(--bg-card, #2a2a2a);
          box-shadow: 12px 12px 0px 0px var(--border-color, #ffcc00);
          display: flex;
          flex-direction: column;
        }

        .wizard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          border-bottom: 2px solid var(--border-color, #ffcc00);
        }

        .back-btn {
          background: transparent;
          border: none;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--text-primary, #ffcc00);
        }
        .back-btn:hover { text-decoration: underline; }

        .step-indicator { font-family: var(--font-pixel); font-size: 12px; color: var(--text-primary, #ffcc00); }

        .progress-track {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          border-bottom: 2px solid var(--border-color, #ffcc00);
          background: var(--bg-secondary, #252525);
        }

        .track-step {
          width: 32px;
          height: 32px;
          border: 2px solid var(--border-color, #ffcc00);
          background: var(--bg-card, #2a2a2a);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-pixel);
          font-size: 14px;
          color: var(--text-muted, #b38f00);
        }
        .track-step.active { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); }

        .track-line { width: 40px; height: 2px; background: var(--border-color, #ffcc00); }

        .error-banner {
          background: var(--accent-red);
          color: white;
          padding: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: 700;
          border-bottom: 2px solid var(--border-color, #ffcc00);
        }

        .step-content { padding: 40px 32px; text-align: center; }

        .step-icon {
          width: 64px;
          height: 64px;
          border: 2px solid var(--border-color, #ffcc00);
          margin: 0 auto 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-secondary, #252525);
          box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00);
          color: var(--text-primary, #ffcc00);
        }

        h2 { font-family: var(--font-pixel); font-size: 24px; margin-bottom: 8px; color: var(--text-primary, #ffcc00); }
        p { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted, #b38f00); margin-bottom: 32px; letter-spacing: 1px; }

        .balances-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
        
        .balance-box {
          border: 2px solid var(--border-color, #ffcc00);
          padding: 12px;
          background: var(--bg-secondary, #252525);
          text-align: left;
        }
        .bal-header { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: var(--text-muted, #b38f00); margin-bottom: 4px; }
        .bal-value { font-family: var(--font-mono); font-size: 18px; font-weight: 700; color: var(--text-primary, #ffcc00); }
        .bal-value.low { color: var(--accent-amber); }

        .eth-section {
          border: 2px solid var(--accent-amber);
          background: rgba(255, 204, 0, 0.1);
          padding: 16px;
          margin-bottom: 24px;
          text-align: left;
        }

        .warning-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--accent-amber);
          font-family: var(--font-pixel);
          font-size: 12px;
          margin-bottom: 16px;
        }

        .wrong-chain-banner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: rgba(255, 59, 48, 0.15);
          border: 2px solid var(--accent-red);
          margin-bottom: 20px;
          text-align: center;
        }
        .wrong-chain-banner span {
          font-family: var(--font-pixel);
          font-size: 12px;
          color: var(--accent-red);
        }
        .switch-btn {
          padding: 10px 20px;
          background: var(--accent-red);
          color: white;
          border: none;
          font-family: var(--font-pixel);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .switch-btn:hover {
          background: #ff6b5b;
          transform: translateY(-2px);
        }

        .wallet-box { margin-bottom: 16px; }
        .wallet-label { font-size: 10px; font-weight: 700; color: var(--text-muted, #b38f00); display: block; margin-bottom: 6px; }
        .wallet-row { display: flex; align-items: center; gap: 8px; background: var(--bg-secondary, #252525); border: 2px solid var(--border-color, #ffcc00); padding: 8px 12px; }
        .wallet-row code { flex: 1; font-size: 11px; color: var(--text-primary, #ffcc00); }
        .copy-btn { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); border: none; padding: 4px 8px; cursor: pointer; }

        .faucet-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .faucet-title { font-size: 10px; font-weight: 700; color: var(--text-muted, #b38f00); }
        .faucet-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: var(--bg-secondary, #252525);
          border: 2px solid var(--border-color, #ffcc00);
          color: var(--text-primary, #ffcc00);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          text-decoration: none;
        }
        .faucet-link:hover { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); }

        .refresh-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          background: var(--bg-secondary, #252525);
          border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          color: var(--text-primary, #ffcc00);
        }
        .refresh-btn:hover:not(:disabled) { background: var(--bg-card, #2a2a2a); }
        .refresh-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .status-msg {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          margin-bottom: 24px;
          padding: 8px;
          border: 2px solid var(--accent-emerald);
        }
        .status-msg.success { background: var(--accent-emerald); color: var(--bg-primary, #1a1a1a); }

        .action-row { display: flex; flex-direction: column; gap: 12px; }

        .primary-btn {
          width: 100%;
          padding: 16px;
          background: var(--border-color, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
          border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-pixel);
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: transform 0.1s;
        }
        .primary-btn:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00); }
        .primary-btn:disabled { background: var(--text-muted, #b38f00); border-color: var(--text-muted, #b38f00); cursor: not-allowed; opacity: 0.5; }

        .secondary-btn {
          width: 100%;
          padding: 16px;
          background: var(--bg-secondary, #252525);
          color: var(--text-primary, #ffcc00);
          border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-pixel);
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .secondary-btn:hover { background: var(--bg-card, #2a2a2a); }

        .info-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border: 2px solid var(--accent-cyan);
          background: rgba(0, 204, 255, 0.1);
          margin-bottom: 32px;
          text-align: left;
          font-size: 12px;
          font-weight: 700;
          color: var(--accent-cyan);
        }

        .vault-id {
          background: var(--accent-emerald);
          color: var(--bg-primary, #1a1a1a);
          padding: 8px;
          font-family: var(--font-mono);
          font-size: 12px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .deposit-box { margin-bottom: 24px; text-align: left; }
        .bal-row { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; margin-bottom: 8px; color: var(--text-muted, #b38f00); }
        .max-btn { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); border: none; padding: 2px 6px; font-size: 10px; cursor: pointer; }
        
        .input-row { display: flex; border: 2px solid var(--border-color, #ffcc00); }
        .input-row input { 
          flex: 1; padding: 12px; border: none; outline: none; 
          font-family: var(--font-mono); font-size: 16px; 
          background: var(--bg-secondary, #252525); 
          color: var(--text-primary, #ffcc00); 
        }
        .input-row .unit { padding: 12px; background: var(--bg-card, #2a2a2a); border-left: 2px solid var(--border-color, #ffcc00); font-weight: 700; font-size: 12px; color: var(--text-primary, #ffcc00); }

        .action-col { display: flex; flex-direction: column; gap: 12px; }
        .text-btn { background: transparent; border: none; font-size: 12px; text-decoration: underline; cursor: pointer; color: var(--text-muted, #b38f00); }
        .text-btn:hover { color: var(--text-primary, #ffcc00); }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .wizard-card { margin: 16px; max-width: calc(100% - 32px); }
          .wizard-header { padding: 12px 16px; }
          .step-content { padding: 20px 16px; }
          .step-title { font-size: 18px; }
          .step-desc { font-size: 12px; }
          .config-row { flex-direction: column; }
          .config-row .config-col { flex: auto; }
          .feature-list { gap: 12px; }
          .primary-btn { padding: 14px 24px; font-size: 12px; }
        }

        @media (max-width: 480px) {
          .wizard-card { margin: 12px; }
          .wizard-header { padding: 10px 12px; }
          .step-indicator { font-size: 10px; }
          .step-content { padding: 16px 12px; }
          .step-title { font-size: 16px; }
          .input-row input { padding: 10px; font-size: 14px; }
          .config-box { padding: 12px; }
          .config-box h4 { font-size: 11px; }
          .config-value { font-size: 16px; }
        }
      `}</style>
    </div>
  );
}
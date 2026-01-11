import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import {
  Bot, Wallet, ArrowDownToLine, ArrowUpFromLine, Shield,
  AlertTriangle, CheckCircle, Loader, ExternalLink, Copy,
  RefreshCw, Zap, Lock, Info, X, Settings
} from 'lucide-react';
import sentinelLogo from '../sentinel-logo.png';

export default function AgentWalletPanel({
  agentManager,
  provider,
  signer,
  vaultBalance,
  vaultContract,
  networkConfig,
  onRefresh,
  isOpen,
  onClose
}) {
  const [agentAddress, setAgentAddress] = useState(null);
  const [agentBalance, setAgentBalance] = useState('0');
  const [ethBalance, setEthBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  // Load agent wallet data
  useEffect(() => {
    if (agentManager && provider) {
      loadAgentData();
    }
  }, [agentManager, provider]);

  const loadAgentData = async () => {
    try {
      const address = agentManager.getAddress();
      if (address) {
        setAgentAddress(address);
        const balance = await agentManager.getBalance(provider);
        setAgentBalance(balance);
        const eth = await agentManager.getEthBalance(provider);
        setEthBalance(eth);
      }
    } catch (error) {
      console.error('Error loading agent data:', error);
    }
  };

  const handleInitialize = async () => {
    if (!signer || !agentManager) return;
    
    setInitializing(true);
    setError('');
    
    try {
      const result = await agentManager.initializeWallet(signer);
      setAgentAddress(result.address);
      setSuccess(result.isNew ? 'Agent Wallet created!' : 'Agent Wallet loaded!');
      await loadAgentData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Failed to initialize: ' + (error.message || 'User rejected'));
    } finally {
      setInitializing(false);
    }
  };

  const handleFund = async () => {
    if (!fundAmount || parseFloat(fundAmount) <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (parseFloat(fundAmount) > parseFloat(vaultBalance)) {
      setError('Insufficient vault balance');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Withdraw from vault to agent wallet
      const amountWei = ethers.parseUnits(fundAmount, 18);
      
      // First withdraw to user wallet
      const withdrawTx = await vaultContract.withdraw(amountWei);
      await withdrawTx.wait();

      // Then transfer to agent wallet
      const mneeContract = new ethers.Contract(
        networkConfig.mneeToken,
        ["function transfer(address to, uint256 amount) returns (bool)"],
        signer
      );

      const transferTx = await mneeContract.transfer(agentAddress, amountWei);
      await transferTx.wait();

      setSuccess(`Funded ${fundAmount} MNEE to Agent Wallet`);
      setFundAmount('');
      await loadAgentData();
      onRefresh && onRefresh();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.reason || error.message || 'Funding failed');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (withdrawAll = false) => {
    const amount = withdrawAll ? agentBalance : withdrawAmount;
    if (!amount || parseFloat(amount) <= 0) {
      setError('Enter a valid amount');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = withdrawAll 
        ? await agentManager.withdrawToVault(provider)
        : await agentManager.withdrawAmountToVault(provider, amount);

      if (result.success) {
        setSuccess(`Withdrawn ${amount} MNEE to Vault`);
        setWithdrawAmount('');
        await loadAgentData();
        onRefresh && onRefresh();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(result.error);
      }
    } catch (error) {
      setError(error.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(agentAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setFundPercentage = (percent) => {
    const value = (parseFloat(vaultBalance) * percent / 100).toFixed(2);
    setFundAmount(value);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="agent-panel-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="agent-panel"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="panel-header">
            <div className="header-left">
              <Bot size={20} />
              <span>AGENT WALLET</span>
            </div>
            <button className="close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          {!agentAddress ? (
            <div className="init-section">
              <div className="init-icon">
                <img src={sentinelLogo} alt="Sentinel" style={{ height: '64px' }} />
              </div>
              <h3>INITIALIZE AGENT WALLET</h3>
              <p>Create an automated wallet for recurring payments. No popups required for scheduled transactions.</p>
              
              <div className="security-info">
                <Shield size={16} />
                <span>Funds can only be sent to your Vault, trusted vendors, or savings contract</span>
              </div>

              <button 
                className="init-btn" 
                onClick={handleInitialize}
                disabled={initializing}
              >
                {initializing ? (
                  <><Loader className="spin" size={16} /> SIGNING...</>
                ) : (
                  <><Zap size={16} /> SIGN TO CREATE</>
                )}
              </button>
              
              {error && <div className="error-msg"><AlertTriangle size={14} /> {error}</div>}
            </div>
          ) : (
            <>
              <div className="panel-tabs">
                <button 
                  className={activeTab === 'overview' ? 'active' : ''} 
                  onClick={() => setActiveTab('overview')}
                >
                  OVERVIEW
                </button>
                <button 
                  className={activeTab === 'fund' ? 'active' : ''} 
                  onClick={() => setActiveTab('fund')}
                >
                  FUND
                </button>
                <button 
                  className={activeTab === 'withdraw' ? 'active' : ''} 
                  onClick={() => setActiveTab('withdraw')}
                >
                  WITHDRAW
                </button>
              </div>

              <div className="panel-content">
                {activeTab === 'overview' && (
                  <div className="overview-tab">
                    <div className="balance-card main">
                      <div className="balance-label">AGENT BALANCE</div>
                      <div className="balance-value">{parseFloat(agentBalance).toLocaleString()} MNEE</div>
                      <button className="refresh-btn" onClick={loadAgentData}>
                        <RefreshCw size={14} />
                      </button>
                    </div>

                    <div className="stats-row">
                      <div className="stat-item">
                        <span className="stat-label">ETH (GAS)</span>
                        <span className="stat-value">{parseFloat(ethBalance).toFixed(4)}</span>
                        {parseFloat(ethBalance) < 0.001 && (
                          <span className="low-warning">LOW</span>
                        )}
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">VAULT BALANCE</span>
                        <span className="stat-value">{parseFloat(vaultBalance).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="address-box">
                      <div className="address-label">AGENT ADDRESS</div>
                      <div className="address-row">
                        <span className="address">{agentAddress}</span>
                        <button onClick={copyAddress}>
                          {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                        </button>
                        <a 
                          href={`${networkConfig.explorer}/address/${agentAddress}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>

                    <div className="security-box">
                      <div className="sec-header">
                        <Lock size={14} />
                        <span>SECURITY RESTRICTIONS</span>
                      </div>
                      <ul className="sec-list">
                        <li><CheckCircle size={12} /> Can send to your Vault</li>
                        <li><CheckCircle size={12} /> Can send to Trusted Vendors</li>
                        <li><CheckCircle size={12} /> Can send to Savings Contract</li>
                        <li><X size={12} className="blocked" /> Cannot send to unknown addresses</li>
                      </ul>
                    </div>
                  </div>
                )}

                {activeTab === 'fund' && (
                  <div className="fund-tab">
                    <div className="info-banner">
                      <Info size={14} />
                      <span>Transfer MNEE from Vault to Agent Wallet for automated payments</span>
                    </div>

                    <div className="source-display">
                      <div className="source-item">
                        <span>FROM</span>
                        <strong>VAULT ({parseFloat(vaultBalance).toLocaleString()} MNEE)</strong>
                      </div>
                      <ArrowDownToLine size={20} />
                      <div className="source-item">
                        <span>TO</span>
                        <strong>AGENT WALLET</strong>
                      </div>
                    </div>

                    <div className="input-section">
                      <div className="input-header">
                        <span>AMOUNT</span>
                        <div className="quick-btns">
                          <button onClick={() => setFundPercentage(25)}>25%</button>
                          <button onClick={() => setFundPercentage(50)}>50%</button>
                          <button onClick={() => setFundPercentage(100)}>MAX</button>
                        </div>
                      </div>
                      <div className="input-wrapper">
                        <input
                          type="number"
                          placeholder="0.00"
                          value={fundAmount}
                          onChange={(e) => setFundAmount(e.target.value)}
                          disabled={loading}
                        />
                        <span className="unit">MNEE</span>
                      </div>
                    </div>

                    <button 
                      className="action-btn fund"
                      onClick={handleFund}
                      disabled={loading || !fundAmount}
                    >
                      {loading ? (
                        <><Loader className="spin" size={16} /> PROCESSING...</>
                      ) : (
                        <><ArrowDownToLine size={16} /> FUND AGENT WALLET</>
                      )}
                    </button>

                    <div className="note">
                      <AlertTriangle size={12} />
                      Requires MetaMask confirmation (2 transactions)
                    </div>
                  </div>
                )}

                {activeTab === 'withdraw' && (
                  <div className="withdraw-tab">
                    <div className="info-banner success">
                      <CheckCircle size={14} />
                      <span>Withdrawals go directly to your Vault - no signature needed!</span>
                    </div>

                    <div className="source-display">
                      <div className="source-item">
                        <span>FROM</span>
                        <strong>AGENT ({parseFloat(agentBalance).toLocaleString()} MNEE)</strong>
                      </div>
                      <ArrowUpFromLine size={20} />
                      <div className="source-item">
                        <span>TO</span>
                        <strong>YOUR VAULT</strong>
                      </div>
                    </div>

                    <div className="input-section">
                      <div className="input-header">
                        <span>AMOUNT</span>
                      </div>
                      <div className="input-wrapper">
                        <input
                          type="number"
                          placeholder="0.00"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          disabled={loading}
                        />
                        <span className="unit">MNEE</span>
                      </div>
                    </div>

                    <div className="btn-row">
                      <button 
                        className="action-btn secondary"
                        onClick={() => handleWithdraw(true)}
                        disabled={loading || parseFloat(agentBalance) <= 0}
                      >
                        WITHDRAW ALL
                      </button>
                      <button 
                        className="action-btn"
                        onClick={() => handleWithdraw(false)}
                        disabled={loading || !withdrawAmount}
                      >
                        {loading ? 'PROCESSING...' : 'WITHDRAW'}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="message error">
                    <AlertTriangle size={14} /> {error}
                  </div>
                )}
                {success && (
                  <div className="message success">
                    <CheckCircle size={14} /> {success}
                  </div>
                )}
              </div>
            </>
          )}
        </motion.div>
      </motion.div>

      <style jsx>{`
        .agent-panel-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 1000;
          display: flex;
          justify-content: flex-end;
        }

        .agent-panel {
          width: 400px;
          max-width: 100%;
          height: 100%;
          background: var(--bg-card, #2a2a2a);
          border-left: 4px solid var(--border-color, #ffcc00);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          background: #60a5fa;
          color: white;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font-pixel);
          font-size: 14px;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px;
        }
        .close-btn:hover { opacity: 0.8; }

        .init-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
          text-align: center;
        }

        .init-icon {
          margin-bottom: 24px;
          opacity: 0.8;
        }

        .init-section h3 {
          font-family: var(--font-pixel);
          font-size: 18px;
          margin-bottom: 12px;
          color: var(--text-primary, #ffcc00);
        }

        .init-section p {
          font-size: 13px;
          color: var(--text-secondary, #e6b800);
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .security-info {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(96, 165, 250, 0.1);
          border: 1px solid #60a5fa;
          margin-bottom: 24px;
          font-size: 11px;
          color: #60a5fa;
        }

        .init-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 14px 32px;
          background: var(--border-color, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
          border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-pixel);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .init-btn:hover:not(:disabled) {
          transform: translate(-2px, -2px);
          box-shadow: 4px 4px 0 var(--border-color, #ffcc00);
        }
        .init-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .panel-tabs {
          display: flex;
          border-bottom: 2px solid var(--border-color, #ffcc00);
        }

        .panel-tabs button {
          flex: 1;
          padding: 12px;
          background: transparent;
          border: none;
          font-family: var(--font-pixel);
          font-size: 10px;
          cursor: pointer;
          color: var(--text-muted, #b38f00);
          transition: all 0.2s;
        }
        .panel-tabs button.active {
          background: var(--border-color, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
        }
        .panel-tabs button:hover:not(.active) {
          background: var(--bg-secondary, #252525);
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .balance-card {
          position: relative;
          padding: 20px;
          background: var(--bg-secondary, #252525);
          border: 2px solid #60a5fa;
          margin-bottom: 16px;
        }
        .balance-card.main { border-width: 3px; }

        .balance-label {
          font-size: 10px;
          font-weight: 700;
          color: #60a5fa;
          margin-bottom: 8px;
        }

        .balance-value {
          font-family: var(--font-pixel);
          font-size: 28px;
          color: var(--text-primary, #ffcc00);
        }

        .refresh-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          background: transparent;
          border: 1px solid #60a5fa;
          color: #60a5fa;
          padding: 6px;
          cursor: pointer;
        }
        .refresh-btn:hover { background: rgba(96, 165, 250, 0.2); }

        .stats-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }

        .stat-item {
          padding: 12px;
          background: var(--bg-secondary, #252525);
          border: 1px solid var(--border-color, #ffcc00);
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          font-size: 9px;
          font-weight: 700;
          color: var(--text-muted, #b38f00);
        }

        .stat-value {
          font-family: var(--font-mono);
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary, #ffcc00);
        }

        .low-warning {
          font-size: 9px;
          color: var(--accent-red);
          font-weight: 700;
        }

        .address-box {
          padding: 12px;
          background: var(--bg-secondary, #252525);
          border: 1px solid var(--border-color, #ffcc00);
          margin-bottom: 16px;
        }

        .address-label {
          font-size: 9px;
          font-weight: 700;
          color: var(--text-muted, #b38f00);
          margin-bottom: 8px;
        }

        .address-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .address {
          flex: 1;
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--text-secondary, #e6b800);
          word-break: break-all;
        }

        .address-row button, .address-row a {
          padding: 6px;
          background: var(--bg-card, #2a2a2a);
          border: 1px solid var(--border-color, #ffcc00);
          color: var(--text-primary, #ffcc00);
          cursor: pointer;
          display: flex;
          align-items: center;
        }
        .address-row button:hover, .address-row a:hover {
          background: var(--border-color, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
        }

        .security-box {
          padding: 12px;
          background: rgba(96, 165, 250, 0.1);
          border: 1px solid #60a5fa;
        }

        .sec-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          font-weight: 700;
          color: #60a5fa;
          margin-bottom: 12px;
        }

        .sec-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .sec-list li {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          margin-bottom: 6px;
          color: var(--text-secondary, #e6b800);
        }
        .sec-list li svg { color: var(--accent-emerald); }
        .sec-list li svg.blocked { color: var(--accent-red); }

        .info-banner {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: rgba(96, 165, 250, 0.1);
          border: 1px solid #60a5fa;
          margin-bottom: 20px;
          font-size: 11px;
          color: #60a5fa;
        }
        .info-banner.success {
          background: rgba(0, 204, 102, 0.1);
          border-color: var(--accent-emerald);
          color: var(--accent-emerald);
        }

        .source-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 16px;
          background: var(--bg-secondary, #252525);
          border: 1px solid var(--border-color, #ffcc00);
          margin-bottom: 20px;
        }

        .source-display svg { color: var(--border-color, #ffcc00); }

        .source-item {
          text-align: center;
        }
        .source-item span {
          display: block;
          font-size: 9px;
          color: var(--text-muted, #b38f00);
          margin-bottom: 4px;
        }
        .source-item strong {
          font-size: 12px;
          color: var(--text-primary, #ffcc00);
        }

        .input-section { margin-bottom: 16px; }

        .input-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .input-header span {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-primary, #ffcc00);
        }

        .quick-btns {
          display: flex;
          gap: 6px;
        }
        .quick-btns button {
          padding: 4px 8px;
          background: var(--bg-secondary, #252525);
          border: 1px solid var(--border-color, #ffcc00);
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
          color: var(--text-primary, #ffcc00);
        }
        .quick-btns button:hover {
          background: var(--border-color, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
        }

        .input-wrapper {
          position: relative;
        }
        .input-wrapper input {
          width: 100%;
          padding: 14px;
          padding-right: 60px;
          background: var(--bg-secondary, #252525);
          border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-mono);
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary, #ffcc00);
        }
        .input-wrapper input:focus {
          outline: none;
          box-shadow: 0 0 0 2px #60a5fa;
        }
        .input-wrapper input::placeholder { color: var(--text-muted, #b38f00); }
        .input-wrapper .unit {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted, #b38f00);
        }

        .btn-row {
          display: flex;
          gap: 12px;
        }

        .action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          background: var(--border-color, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
          border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-pixel);
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .action-btn:hover:not(:disabled) {
          transform: translate(-2px, -2px);
          box-shadow: 4px 4px 0 var(--border-color, #ffcc00);
        }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .action-btn.secondary {
          background: var(--bg-secondary, #252525);
          color: var(--text-primary, #ffcc00);
        }
        .action-btn.fund { background: #60a5fa; border-color: #60a5fa; color: white; }

        .note {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          font-size: 10px;
          color: var(--text-muted, #b38f00);
        }

        .message {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          margin-top: 16px;
          font-size: 12px;
          font-weight: 700;
        }
        .message.error {
          background: rgba(255, 59, 48, 0.15);
          border: 1px solid var(--accent-red);
          color: var(--accent-red);
        }
        .message.success {
          background: rgba(0, 204, 102, 0.15);
          border: 1px solid var(--accent-emerald);
          color: var(--accent-emerald);
        }

        .error-msg {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          padding: 12px;
          background: rgba(255, 59, 48, 0.15);
          border: 1px solid var(--accent-red);
          color: var(--accent-red);
          font-size: 12px;
        }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @media (max-width: 480px) {
          .agent-panel { width: 100%; }
        }
      `}</style>
    </AnimatePresence>
  );
}
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, CheckCircle, XCircle, AlertTriangle, Search,
  Filter, ChevronDown, ExternalLink, Copy, Shield,
  ArrowUpRight, MoreVertical, Ban, Eye, Loader, X, Bot
} from 'lucide-react';
import sentinelLogo from '../sentinel-logo.png';

const RevokeModal = ({ isOpen, onClose, onConfirm, txId, isLoading }) => {
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (reason.trim()) {
      onConfirm(txId, reason.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && reason.trim()) {
      handleSubmit();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setReason('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div 
        className="modal-content"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>REVOKE TRANSACTION #{txId}</h3>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body">
          <label>ENTER REASON FOR REVOCATION</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Suspicious activity, wrong recipient..."
            autoFocus
            disabled={isLoading}
          />
          <p className="hint">This reason will be recorded on-chain and cannot be changed.</p>
        </div>

        <div className="modal-footer">
          <button className="cancel-btn" onClick={onClose} disabled={isLoading}>
            CANCEL
          </button>
          <button 
            className="confirm-btn" 
            onClick={handleSubmit}
            disabled={!reason.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <Loader size={14} className="spin" />
                REVOKING...
              </>
            ) : (
              <>
                <Ban size={14} />
                REVOKE TRANSACTION
              </>
            )}
          </button>
        </div>
      </motion.div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: var(--bg-card, #2a2a2a);
          border: 2px solid var(--border-color, #ffcc00);
          box-shadow: 8px 8px 0px 0px var(--border-color, #ffcc00);
          width: 100%;
          max-width: 480px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 2px solid var(--border-color, #ffcc00);
        }

        .modal-header h3 {
          font-family: var(--font-pixel);
          font-size: 16px;
          color: var(--text-primary, #ffcc00);
          margin: 0;
        }

        .close-btn {
          background: none;
          border: none;
          color: var(--text-muted, #b38f00);
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          color: var(--text-primary, #ffcc00);
        }

        .modal-body {
          padding: 24px 20px;
        }

        .modal-body label {
          display: block;
          font-family: var(--font-pixel);
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary, #ffcc00);
          margin-bottom: 12px;
        }

        .modal-body input {
          width: 100%;
          padding: 14px 16px;
          background: var(--bg-secondary, #252525);
          border: 2px solid var(--border-color, #ffcc00);
          color: var(--text-primary, #ffcc00);
          font-family: var(--font-mono);
          font-size: 14px;
        }

        .modal-body input:focus {
          outline: none;
          box-shadow: 0 0 0 2px var(--border-color, #ffcc00);
        }

        .modal-body input::placeholder {
          color: var(--text-muted, #b38f00);
        }

        .modal-body input:disabled {
          opacity: 0.5;
        }

        .hint {
          margin-top: 12px;
          font-size: 11px;
          color: var(--text-muted, #b38f00);
        }

        .modal-footer {
          display: flex;
          gap: 12px;
          padding: 20px;
          border-top: 2px solid var(--border-color, #ffcc00);
          justify-content: flex-end;
        }

        .cancel-btn {
          padding: 12px 20px;
          background: transparent;
          border: 2px solid var(--text-muted, #b38f00);
          color: var(--text-muted, #b38f00);
          font-family: var(--font-pixel);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.1s;
        }

        .cancel-btn:hover {
          border-color: var(--text-primary, #ffcc00);
          color: var(--text-primary, #ffcc00);
        }

        .cancel-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .confirm-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: var(--accent-red, #ff3b30);
          border: 2px solid var(--accent-red, #ff3b30);
          color: white;
          font-family: var(--font-pixel);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.1s;
        }

        .confirm-btn:hover:not(:disabled) {
          background: #cc2f26;
          transform: translate(-2px, -2px);
          box-shadow: 4px 4px 0px 0px var(--accent-red, #ff3b30);
        }

        .confirm-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 480px) {
          .modal-footer {
            flex-direction: column;
          }
          .cancel-btn, .confirm-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

const StatusBadge = ({ status, isAgentTx }) => {
  const config = {
    executed: { icon: CheckCircle, label: 'EXECUTED', color: 'var(--accent-emerald)', bg: 'rgba(0, 204, 102, 0.2)' },
    pending: { icon: Clock, label: 'PENDING', color: 'var(--accent-amber)', bg: 'rgba(255, 204, 0, 0.2)' },
    ready: { icon: CheckCircle, label: 'READY', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)' },
    revoked: { icon: XCircle, label: 'REVOKED', color: 'var(--accent-red)', bg: 'rgba(255, 59, 48, 0.2)' },
    timelocked: { 
      icon: () => <img src={sentinelLogo} alt="" style={{ width: '14px', height: '14px' }} />, 
      label: 'LOCKED', 
      color: 'var(--accent-blue)', 
      bg: 'rgba(0, 102, 255, 0.2)' 
    },
    
    agent_success: { icon: Bot, label: 'AGENT TX', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.2)' },
    agent_failed: { icon: XCircle, label: 'FAILED', color: 'var(--accent-red)', bg: 'rgba(255, 59, 48, 0.2)' }
  };

  
  let statusKey = status;
  if (isAgentTx) {
    statusKey = status === 'success' || status === 'executed' ? 'agent_success' : 'agent_failed';
  }

  const { icon: Icon, label, color, bg } = config[statusKey] || config.pending;

  return (
    <div className="status-badge" style={{ backgroundColor: bg, color: color, borderColor: color }}>
      {typeof Icon === 'function' ? <Icon size={10} strokeWidth={3} /> : <Icon size={10} strokeWidth={3} />}
      <span>{label}</span>
      <style jsx>{`
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border: 2px solid;
          font-family: var(--font-pixel);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>
    </div>
  );
};

const RiskIndicator = ({ score }) => {
  const getLevel = () => {
    if (score < 30) return { label: 'LOW', color: 'var(--accent-emerald)' };
    if (score < 70) return { label: 'MED', color: 'var(--accent-amber)' };
    return { label: 'HIGH', color: 'var(--accent-red)' };
  };

  const { label, color } = getLevel();

  return (
    <div className="risk-indicator">
      <div className="risk-bar">
        <div className="risk-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <span style={{ color }}>{label}</span>
      <style jsx>{`
        .risk-indicator { display: flex; flex-direction: column; gap: 4px; }
        .risk-bar { width: 60px; height: 6px; border: 1px solid var(--border-color, #ffcc00); background: var(--bg-secondary, #252525); padding: 1px; }
        .risk-fill { height: 100%; transition: width 0.3s; }
        span { font-family: var(--font-pixel); font-size: 10px; }
      `}</style>
    </div>
  );
};

const TransactionRow = ({ tx, onRevoke, onExecute, onView, isExpanded, onToggle, isLoading }) => {
  const [showActions, setShowActions] = useState(false);
  const [, setTick] = useState(0);
  
  
  const isAgentTx = tx.isAgentTx || tx.txType === 'agent';
  
  useEffect(() => {
    
    if (isAgentTx) return;
    
    const now = Math.floor(Date.now() / 1000);
    if (!tx.executed && !tx.revoked && tx.executeAfter && tx.executeAfter > now) {
      const timer = setInterval(() => setTick(t => t + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [tx.executed, tx.revoked, tx.executeAfter, isAgentTx]);
  
  const getStatus = () => {
    
    if (isAgentTx) {
      return tx.status === 'success' ? 'executed' : tx.status === 'failed' ? 'revoked' : 'pending';
    }
    
   
    if (tx.executed) return 'executed';
    if (tx.revoked) return 'revoked';
    const now = Math.floor(Date.now() / 1000);
    if (tx.executeAfter && tx.executeAfter <= now) return 'ready';
    return 'pending';
  };
  
  const status = getStatus();
  
  const calculateRiskScore = () => {
    if (tx.riskScore !== null && tx.riskScore !== undefined) return tx.riskScore;
    if (tx.trustedVendor) {
      const amount = parseFloat(tx.amount) || 0;
      return amount > 500 ? 35 : 12;
    }
    const amount = parseFloat(tx.amount) || 0;
    if (amount > 500) return 85;
    if (amount > 100) return 65;
    return 50;
  };
  
  const riskScore = calculateRiskScore();

  const copyAddress = (addr) => {
    navigator.clipboard.writeText(addr);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const timeUntilExecutable = () => {
    if (!tx.executeAfter) return null;
    const now = Math.floor(Date.now() / 1000);
    const diff = tx.executeAfter - now;
    if (diff <= 0) return 'READY';
    const hours = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    return `${hours}H ${mins}M`;
  };

  const canExecute = () => {
    if (status !== 'pending' && status !== 'ready') return false;
    const now = Math.floor(Date.now() / 1000);
    return tx.executeAfter && tx.executeAfter <= now;
  };

  const getTimeRemaining = () => {
    const now = Math.floor(Date.now() / 1000);
    if (!tx.executeAfter || tx.executeAfter <= now) return null;
    const diff = tx.executeAfter - now;
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.ceil(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  const isPending = status === 'pending' || status === 'ready';
  const timeRemaining = getTimeRemaining();

  const handleActionClick = (e, action, ...args) => {
    e.stopPropagation();
    setShowActions(false);
    action(...args);
  };

  return (
    <motion.div
      className={`tx-row ${isExpanded ? 'expanded' : ''} ${isAgentTx ? 'agent-tx-row' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <div className="tx-main" onClick={onToggle}>
        <div className="col id-col">
          {isAgentTx ? (
            <>
              <span className="tx-hash agent-hash">
                <Bot size={12} /> {tx.displayLabel || 'AGENT'}
              </span>
              <StatusBadge status={status} isAgentTx={true} />
            </>
          ) : (
            <>
              <span className="tx-hash">#{tx.id}</span>
              <StatusBadge status={status} isAgentTx={false} />
            </>
          )}
        </div>

        {/* Amount column */}
        <div className="col amount-col">
          <span className="amount-value">{parseFloat(tx.amount).toLocaleString()}</span>
          <span className="amount-token">MNEE</span>
        </div>

        {/* Address column */}
        <div className="col address-col">
          {!isAgentTx && (
            <div className="addr-pair">
              <span className="addr-label">FROM</span>
              <span className="addr-val" onClick={(e) => { e.stopPropagation(); copyAddress(tx.agent); }}>
                {tx.agent?.slice(0, 6)}...{tx.agent?.slice(-4)} <Copy size={10} />
              </span>
            </div>
          )}
          <div className="addr-pair">
            <span className="addr-label">TO</span>
            <span className="addr-val" onClick={(e) => { e.stopPropagation(); copyAddress(tx.vendor); }}>
              {tx.vendor?.slice(0, 6)}...{tx.vendor?.slice(-4)} <Copy size={10} />
            </span>
          </div>
        </div>

        {/* Risk column - N/A for agent transactions */}
        <div className="col risk-col">
          {isAgentTx ? (
            <span className="agent-indicator">AUTOMATED</span>
          ) : (
            <RiskIndicator score={calculateRiskScore()} />
          )}
        </div>

        {/* Time column */}
        <div className="col time-col">
          <span>{formatTime(tx.timestamp)}</span>
          {!isAgentTx && status === 'pending' && tx.executeAfter && (
            <span className="time-lock"><Clock size={10}/> {timeUntilExecutable()}</span>
          )}
          {isAgentTx && tx.txHash && (
            <a 
              href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tx-hash-link"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={10} /> TX
            </a>
          )}
        </div>

        {/* Actions column - only for vault transactions */}
        <div className="col actions-col">
          {!isAgentTx && isPending && (
            <button
              className={`action-trigger ${showActions ? 'active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
              disabled={isLoading}
            >
              {isLoading ? <Loader size={14} className="spin" /> : <MoreVertical size={14} />}
            </button>
          )}
        </div>

        <div className="col expand-col">
          <ChevronDown size={14} className={isExpanded ? 'rotated' : ''} />
        </div>
      </div>

      {/* Action dropdown - only for vault transactions */}
      {!isAgentTx && showActions && (
        <div className="actions-dropdown">
          {canExecute() && (
            <button onClick={(e) => handleActionClick(e, onExecute, tx.id)}>
              <CheckCircle size={12} /> EXECUTE NOW
            </button>
          )}
          <button className="danger" onClick={(e) => handleActionClick(e, onRevoke, tx.id)}>
            <Ban size={12} /> REVOKE
          </button>
        </div>
      )}

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            className="tx-expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="detail-grid">
              {isAgentTx ? (
                <>
                  <div className="detail-item">
                    <span className="detail-label">TYPE</span>
                    <span className="detail-value">{tx.executionType || 'Agent Transaction'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">DESTINATION</span>
                    <span className="detail-value mono">{tx.vendor}</span>
                  </div>
                  {tx.txHash && (
                    <div className="detail-item">
                      <span className="detail-label">TX HASH</span>
                      <a 
                        href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="detail-value mono link"
                      >
                        {tx.txHash.slice(0, 20)}... <ExternalLink size={10} />
                      </a>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">STATUS</span>
                    <span className={`detail-value ${tx.status === 'success' ? 'success' : 'error'}`}>
                      {tx.status?.toUpperCase() || 'UNKNOWN'}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {/* Existing vault transaction details */}
                  <div className="detail-item">
                    <span className="detail-label">AGENT</span>
                    <span className="detail-value mono">{tx.agent}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">VENDOR</span>
                    <span className="detail-value mono">{tx.vendor}</span>
                  </div>
                  {tx.reason && (
                    <div className="detail-item">
                      <span className="detail-label">REASON</span>
                      <span className="detail-value">{tx.reason}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
export default function TransactionList({ transactions = [], onRevoke, onExecute, contract }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [selectedTx, setSelectedTx] = useState(null);
  const [loadingTxId, setLoadingTxId] = useState(null);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [pendingRevokeTxId, setPendingRevokeTxId] = useState(null);

 const filteredTxs = transactions.filter(tx => {
  const isAgentTx = tx.isAgentTx || tx.txType === 'agent';
  
  // Status filter
  if (statusFilter !== 'all') {
    if (statusFilter === 'agent') {
      if (!isAgentTx) return false;
    } else if (isAgentTx) {
      // For agent txs, map status filter
      if (statusFilter === 'executed' && tx.status !== 'success') return false;
      if (statusFilter === 'revoked' && tx.status !== 'failed') return false;
      if (statusFilter === 'pending' && tx.status === 'success') return false;
    } else {
      // Vault tx filter logic
      const txStatus = tx.executed ? 'executed' : tx.revoked ? 'revoked' : 
                       (tx.executeAfter <= Date.now()/1000) ? 'ready' : 'pending';
      if (statusFilter !== txStatus) return false;
    }
  }
  
  // Search filter
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    const searchableFields = [
      tx.agent, tx.vendor, tx.id?.toString(), tx.txHash, tx.displayLabel
    ].filter(Boolean);
    return searchableFields.some(f => f.toLowerCase().includes(term));
  }
  
  return true;
});

  const openRevokeModal = (txId) => {
    setPendingRevokeTxId(txId);
    setRevokeModalOpen(true);
  };

  const handleRevokeConfirm = async (txId, reason) => {
    if (!contract) {
      alert('CONTRACT NOT CONNECTED. PLEASE REFRESH THE PAGE.');
      setRevokeModalOpen(false);
      return;
    }

    setLoadingTxId(txId);
    
    try {
      const txIdNum = Number(txId);
      if (isNaN(txIdNum) || txIdNum < 0) {
        throw new Error('Invalid transaction ID');
      }

      const tx = await contract.revokeTransaction(txIdNum, reason);
      await tx.wait();
      
      setRevokeModalOpen(false);
      setPendingRevokeTxId(null);
      
      if (onRevoke) {
        onRevoke();
      }
    } catch (err) {
      console.error('Revoke failed:', err);
      let errorMessage = 'UNKNOWN ERROR';
      if (err.reason) {
        errorMessage = err.reason;
      } else if (err.message) {
        if (err.message.includes('user rejected')) {
          errorMessage = 'TRANSACTION REJECTED BY USER';
        } else if (err.message.includes('insufficient funds')) {
          errorMessage = 'INSUFFICIENT GAS FUNDS';
        } else {
          errorMessage = err.message.substring(0, 100);
        }
      }
      alert('REVOKE FAILED: ' + errorMessage);
    } finally {
      setLoadingTxId(null);
    }
  };

  const handleExecute = async (txId) => {
    if (!contract) {
      alert('CONTRACT NOT CONNECTED. PLEASE REFRESH THE PAGE.');
      return;
    }

    setLoadingTxId(txId);

    try {
      const txIdNum = Number(txId);
      if (isNaN(txIdNum) || txIdNum < 0) {
        throw new Error('Invalid transaction ID');
      }

      const tx = await contract.executePayment(txIdNum);
      await tx.wait();
      
      if (onExecute) {
        onExecute();
      }
    } catch (err) {
      console.error('Execute failed:', err);
      let errorMessage = 'UNKNOWN ERROR';
      if (err.reason) {
        errorMessage = err.reason;
      } else if (err.message) {
        if (err.message.includes('user rejected')) {
          errorMessage = 'TRANSACTION REJECTED BY USER';
        } else if (err.message.includes('insufficient funds')) {
          errorMessage = 'INSUFFICIENT GAS FUNDS';
        } else if (err.message.includes('Timelock not passed')) {
          errorMessage = 'TIMELOCK HAS NOT PASSED YET';
        } else if (err.message.includes('Already executed')) {
          errorMessage = 'TRANSACTION ALREADY EXECUTED';
        } else if (err.message.includes('revoked')) {
          errorMessage = 'TRANSACTION WAS REVOKED';
        } else {
          errorMessage = err.message.substring(0, 100);
        }
      }
      alert('EXECUTE FAILED: ' + errorMessage);
    } finally {
      setLoadingTxId(null);
    }
  };

  return (
    <div className="transaction-list">
      <div className="list-header">
        <div>
          <h1>TRANSACTION LOG</h1>
          <p>IMMUTABLE LEDGER & OPERATIONS</p>
        </div>
        <div className="header-stats">
          <div className="stat-mini">
            <span className="val">{transactions.length}</span>
            <span className="lbl">TOTAL</span>
          </div>
          <div className="stat-mini pending">
            <span className="val">{transactions.filter(t => !t.executed && !t.revoked).length}</span>
            <span className="lbl">PENDING</span>
          </div>
        </div>
      </div>

      <div className="list-controls">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="SEARCH HASH / AGENT..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <Filter size={14} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
  <option value="all">ALL STATUS</option>
  <option value="pending">PENDING</option>
  <option value="ready">READY</option>
  <option value="executed">EXECUTED</option>
  <option value="revoked">REVOKED</option>
  <option value="agent">AGENT TXS</option>  {/* ADD THIS */}
</select>
        </div>
      </div>

      <div className="tx-table-wrapper">
        <div className="tx-header-row">
          <span>ID / STATUS</span>
          <span>AMOUNT</span>
          <span>ADDRESSES</span>
          <span>RISK</span>
          <span>TIME</span>
          <span>ACTION</span>
          <span></span>
        </div>

        <div className="tx-body">
          {filteredTxs.length > 0 ? (
            filteredTxs.map(tx => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                onRevoke={openRevokeModal}
                onExecute={handleExecute}
                onView={(t) => setSelectedTx(t)}
                isExpanded={expandedId === tx.id}
                onToggle={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                isLoading={loadingTxId === tx.id}
              />
            ))
          ) : (
            <div className="empty-state">
              <AlertTriangle size={32} />
              <span>NO TRANSACTIONS FOUND</span>
            </div>
          )}
        </div>
      </div>

      <RevokeModal
        isOpen={revokeModalOpen}
        onClose={() => {
          setRevokeModalOpen(false);
          setPendingRevokeTxId(null);
        }}
        onConfirm={handleRevokeConfirm}
        txId={pendingRevokeTxId}
        isLoading={loadingTxId === pendingRevokeTxId}
      />

   <style jsx>{`
  .tx-header-row {
    display: grid;
    grid-template-columns: minmax(120px, 1.5fr) minmax(80px, 1fr) minmax(200px, 2fr) minmax(80px, 1fr) minmax(120px, 1.5fr) 50px 40px;
    gap: 24px; /* Increased gap for spacing out texts */
    padding: 16px 24px;
    background: linear-gradient(to right, var(--text-primary, #ffcc00), #e6b800);
    color: var(--bg-primary, #1a1a1a);
    font-family: var(--font-pixel);
    font-size: 11px;
    text-transform: uppercase;
    border-bottom: 2px solid var(--border-color, #ffcc00);
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }

  .tx-row {
    border-bottom: 1px solid var(--bg-secondary, #252525);
    transition: background 0.2s;
  }

  .tx-row:hover .tx-main {
    background: var(--bg-secondary, #252525);
  }

  .tx-main {
    display: grid;
    grid-template-columns: minmax(120px, 1.5fr) minmax(80px, 1fr) minmax(200px, 2fr) minmax(80px, 1fr) minmax(120px, 1.5fr) 50px 40px;
    gap: 24px; /* Increased gap for spacing out texts */
    padding: 16px 24px;
    cursor: pointer;
    align-items: center;
  }

  .col {
    display: flex;
    align-items: center;
    gap: 12px; /* Larger gap for better text/icon spacing */
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .id-col, .time-col { justify-content: flex-start; }
  .amount-col { justify-content: flex-end; font-weight: 700; }
  .address-col { flex-direction: column; gap: 6px; /* Slightly more space in addresses */ }
  .risk-col { justify-content: center; }
  .actions-col, .expand-col { justify-content: center; }

  .tx-expanded {
    padding: 24px;
    background: var(--bg-secondary, #252525);
    border-top: 2px solid var(--border-color, #ffcc00);
    min-height: 50px;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .detail-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .detail-label {
    font-size: 10px;
    color: var(--text-muted, #b38f00);
    text-transform: uppercase;
  }

  .detail-value {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-primary, #ffcc00);
    word-break: break-all;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #1a1a1a; /* Black background for typing area */
    border: 2px solid var(--border-color, #ffcc00);
    padding: 0 16px;
    flex: 1;
    min-width: 200px;
    color: var(--text-primary, #ffcc00);
  }

  .search-box input {
    flex: 1;
    padding: 12px 0;
    border: none;
    background: transparent;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-primary, #ffcc00);
  }

  .search-box input::placeholder {
    color: var(--text-muted, #b38f00);
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 12px; /* Spaced out filters */
    background: var(--bg-card, #2a2a2a);
    border: 2px solid var(--border-color, #ffcc00);
    padding: 0 12px;
    color: var(--text-primary, #ffcc00);
  }

  .filter-group select {
    padding: 12px 8px;
    border: none;
    background: transparent;
    font-family: var(--font-pixel);
    font-size: 11px;
    cursor: pointer;
    color: var(--text-primary, #ffcc00);
  }

  .status-badge, .risk-indicator {
    padding: 6px 12px; /* Wider padding for spaced text */
    border-radius: 4px;
  }

  .tx-hash-link, .addr-val {
    color: #60a5fa;
    text-decoration: none;
    transition: color 0.2s;
  }

  .tx-hash-link:hover, .addr-val:hover {
    color: #3b82f6;
    text-decoration: underline;
  }

  @media (max-width: 1024px) {
    .tx-header-row, .tx-main {
      grid-template-columns: minmax(100px, 1.5fr) minmax(80px, 1fr) minmax(150px, 2fr) 50px 40px;
    }
    .tx-header-row span:nth-child(4), .tx-main .col:nth-child(4) { display: none; }
  }

  @media (max-width: 768px) {
    .tx-header-row, .tx-main {
      grid-template-columns: 1fr 1fr 40px;
      gap: 12px;
      padding: 12px 16px;
    }
    .tx-header-row span:nth-child(3), .tx-main .col:nth-child(3) { display: none; }
    .amount-col { justify-content: flex-start; }
  }
`}</style>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, CheckCircle, XCircle, AlertTriangle, Search,
  Filter, ChevronDown, ExternalLink, Copy, Shield,
  ArrowUpRight, MoreVertical, Ban, Eye, Loader, X
} from 'lucide-react';

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

const StatusBadge = ({ status }) => {
  const config = {
    executed: { icon: CheckCircle, label: 'EXECUTED', color: 'var(--accent-emerald)', bg: 'rgba(0, 204, 102, 0.2)' },
    pending: { icon: Clock, label: 'PENDING', color: 'var(--accent-amber)', bg: 'rgba(255, 204, 0, 0.2)' },
    ready: { icon: CheckCircle, label: 'READY', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)' },
    revoked: { icon: XCircle, label: 'REVOKED', color: 'var(--accent-red)', bg: 'rgba(255, 59, 48, 0.2)' },
    timelocked: { icon: Shield, label: 'LOCKED', color: 'var(--accent-blue)', bg: 'rgba(0, 102, 255, 0.2)' }
  };

  const { icon: Icon, label, color, bg } = config[status] || config.pending;

  return (
    <div className="status-badge" style={{ backgroundColor: bg, color: color, borderColor: color }}>
      <Icon size={10} strokeWidth={3} />
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
  
  useEffect(() => {
    const now = Math.floor(Date.now() / 1000);
    if (!tx.executed && !tx.revoked && tx.executeAfter && tx.executeAfter > now) {
      const timer = setInterval(() => setTick(t => t + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [tx.executed, tx.revoked, tx.executeAfter]);
  
  const getStatus = () => {
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
      className={`tx-row ${isExpanded ? 'expanded' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <div className="tx-main" onClick={onToggle}>
        <div className="col id-col">
          <span className="tx-hash">#{tx.id}</span>
          <StatusBadge status={status} />
        </div>

        <div className="col amount-col">
          <span className="amount-value">{parseFloat(tx.amount).toLocaleString()}</span>
          <span className="amount-token">MNEE</span>
        </div>

        <div className="col address-col">
          <div className="addr-pair">
            <span className="addr-label">FROM</span>
            <span className="addr-val" onClick={(e) => { e.stopPropagation(); copyAddress(tx.agent); }}>
              {tx.agent.slice(0, 6)}...{tx.agent.slice(-4)} <Copy size={10} />
            </span>
          </div>
          <div className="addr-pair">
            <span className="addr-label">TO</span>
            <span className="addr-val" onClick={(e) => { e.stopPropagation(); copyAddress(tx.vendor); }}>
              {tx.vendor.slice(0, 6)}...{tx.vendor.slice(-4)} <Copy size={10} />
            </span>
          </div>
        </div>

        <div className="col risk-col">
          <RiskIndicator score={riskScore} />
        </div>

        <div className="col time-col">
          <span>{formatTime(tx.timestamp)}</span>
          {status === 'pending' && tx.executeAfter && (
            <span className="time-lock"><Clock size={10}/> {timeUntilExecutable()}</span>
          )}
        </div>

        <div className="col actions-col">
          <button
            className={`action-trigger ${showActions ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); setShowActions(!showActions); }}
            disabled={isLoading}
          >
            {isLoading ? <Loader size={16} className="spin" /> : <MoreVertical size={16} />}
          </button>

          <AnimatePresence>
            {showActions && (
              <motion.div
                className="action-menu"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <button onClick={(e) => handleActionClick(e, onView, tx)}>
                  <Eye size={14} /> VIEW DETAILS
                </button>
                {isPending && (
                  <button 
                    className={`success ${!canExecute() ? 'disabled' : ''}`}
                    onClick={(e) => { 
                      if (canExecute()) {
                        handleActionClick(e, onExecute, tx.id);
                      } else {
                        e.stopPropagation();
                      }
                    }}
                    disabled={!canExecute()}
                  >
                    <CheckCircle size={14} /> 
                    {canExecute() ? 'EXECUTE' : `EXECUTE (${timeRemaining})`}
                  </button>
                )}
                {isPending && (
                  <button className="danger" onClick={(e) => handleActionClick(e, onRevoke, tx.id)}>
                    <Ban size={14} /> REVOKE
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); window.open(`https://sepolia.etherscan.io/tx/${tx.txHash}`, '_blank'); setShowActions(false); }}>
                  <ExternalLink size={14} /> ETHERSCAN
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="col expand-col">
           <ChevronDown className={`expand-icon ${isExpanded ? 'rotated' : ''}`} size={16} />
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="tx-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">TRANSACTION HASH</span>
                <span className="detail-value mono">{tx.txHash || 'PENDING...'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">AGENT ADDRESS</span>
                <span className="detail-value mono">{tx.agent}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">VENDOR ADDRESS</span>
                <span className="detail-value mono">{tx.vendor}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">AMOUNT</span>
                <span className="detail-value">{parseFloat(tx.amount).toLocaleString()} MNEE</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">RISK SCORE</span>
                <span className="detail-value">{riskScore}%</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">STATUS</span>
                <span className={`detail-value ${status === 'executed' ? 'text-green' : status === 'revoked' ? 'text-red' : 'text-amber'}`}>
                  {status.toUpperCase()}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">CREATED</span>
                <span className="detail-value">{formatTime(tx.timestamp)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">EXECUTABLE AFTER</span>
                <span className="detail-value">{tx.executeAfter ? formatTime(tx.executeAfter) : 'IMMEDIATELY'}</span>
              </div>
              {tx.reason && (
                <div className="detail-item">
                  <span className="detail-label">REVOKE REASON</span>
                  <span className="detail-value">{tx.reason}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .tx-row {
          background: var(--bg-card, #2a2a2a);
          border: 2px solid var(--border-color, #ffcc00);
          margin-bottom: -2px;
          transition: all 0.1s;
        }
        .tx-row:hover { z-index: 2; box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00); }
        .tx-row.expanded { z-index: 3; box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00); }

        .tx-main {
          display: grid;
          grid-template-columns: 1.5fr 1fr 2fr 1fr 1.5fr 50px 40px;
          gap: 16px;
          align-items: center;
          padding: 16px 20px;
          cursor: pointer;
        }

        .col { display: flex; flex-direction: column; gap: 4px; }
        .id-col { gap: 8px; }
        .tx-hash { font-family: var(--font-mono); font-weight: 700; font-size: 14px; color: var(--text-primary, #ffcc00); }

        .amount-col { align-items: flex-start; }
        .amount-value { font-family: var(--font-mono); font-weight: 700; font-size: 18px; color: var(--text-primary, #ffcc00); }
        .amount-token { font-size: 10px; color: var(--text-muted, #b38f00); }

        .addr-pair { display: flex; align-items: center; gap: 8px; font-size: 12px; }
        .addr-label { font-size: 10px; font-weight: 700; color: var(--text-muted, #b38f00); width: 32px; }
        .addr-val { 
          font-family: var(--font-mono); cursor: pointer; display: flex; align-items: center; gap: 4px; 
          transition: color 0.1s; color: var(--text-secondary, #e6b800);
        }
        .addr-val:hover { color: var(--accent-cyan, #00ccff); }

        .time-col { font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary, #e6b800); gap: 4px; }
        .time-lock { display: flex; align-items: center; gap: 4px; color: var(--accent-amber, #ffcc00); font-weight: 700; font-size: 10px; }

        .actions-col { position: relative; align-items: center; }
        .action-trigger {
          background: var(--bg-secondary, #252525); border: 2px solid var(--border-color, #ffcc00); width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.1s; color: var(--text-primary, #ffcc00);
        }
        .action-trigger:hover, .action-trigger.active { background: var(--text-primary, #ffcc00); color: var(--bg-primary, #1a1a1a); }
        .action-trigger:disabled { opacity: 0.5; cursor: not-allowed; }

        .action-menu {
          position: absolute; right: 0; top: 100%; margin-top: 8px;
          background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); min-width: 160px; z-index: 50;
          box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00);
        }
        .action-menu button {
          display: flex; align-items: center; gap: 8px; width: 100%; padding: 12px;
          background: transparent; border: none; border-bottom: 1px solid var(--bg-secondary, #252525);
          font-family: var(--font-pixel); font-size: 10px; cursor: pointer;
          text-align: left; color: var(--text-primary, #ffcc00);
        }
        .action-menu button:last-child { border-bottom: none; }
        .action-menu button:hover { background: var(--bg-secondary, #252525); }
        .action-menu button.success:hover { background: var(--accent-emerald); color: var(--bg-primary, #1a1a1a); }
        .action-menu button.success.disabled { 
          opacity: 0.5; 
          cursor: not-allowed; 
          background: var(--bg-secondary, #252525);
          color: var(--text-muted, #b38f00);
        }
        .action-menu button.success.disabled:hover { 
          background: var(--bg-secondary, #252525); 
          color: var(--text-muted, #b38f00); 
        }
        .action-menu button.danger:hover { background: var(--accent-red); color: white; }

        .expand-icon { transition: transform 0.2s; color: var(--text-muted, #b38f00); }
        .expand-icon.rotated { transform: rotate(180deg); }

        .tx-details { border-top: 2px dashed var(--border-color, #ffcc00); background: var(--bg-secondary, #252525); padding: 0 20px; overflow: hidden; }
        .details-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 20px 0; }
        
        .detail-item { display: flex; flex-direction: column; gap: 4px; }
        .detail-label { font-size: 10px; font-weight: 700; color: var(--text-muted, #b38f00); }
        .detail-value { font-size: 13px; font-weight: 600; color: var(--text-primary, #ffcc00); }
        .detail-value.mono { font-family: var(--font-mono); font-size: 12px; }
        
        .text-green { color: var(--accent-emerald); }
        .text-amber { color: var(--accent-amber); }
        .text-red { color: var(--accent-red); }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @media (max-width: 1024px) {
          .tx-main { grid-template-columns: 1.5fr 1fr 1fr 50px 40px; }
          .address-col, .risk-col { display: none; }
          .details-grid { grid-template-columns: 1fr; }
        }
      `}</style>
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
    const matchesSearch = !searchTerm ||
      tx.agent.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.id.toString().includes(searchTerm);

    const getStatus = (t) => {
      if (t.executed) return 'executed';
      if (t.revoked) return 'revoked';
      const now = Math.floor(Date.now() / 1000);
      if (t.executeAfter && t.executeAfter <= now) return 'ready';
      return 'pending';
    };
    const status = getStatus(tx);
    const matchesStatus = statusFilter === 'all' || status === statusFilter;

    return matchesSearch && matchesStatus;
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
        .transaction-list { width: 100%; }

        .list-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 24px; gap: 16px; flex-wrap: wrap;
        }
        .list-header h1 { font-family: var(--font-pixel); font-size: 28px; margin: 0; color: var(--text-primary, #ffcc00); }
        .list-header p { color: var(--text-muted, #b38f00); font-size: 12px; margin-top: 4px; }

        .header-stats { display: flex; gap: 16px; }
        .stat-mini {
          background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); padding: 12px 16px;
          display: flex; flex-direction: column; align-items: center;
          box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00);
        }
        .stat-mini.pending { border-color: var(--accent-amber, #ffcc00); }
        .stat-mini .val { font-family: var(--font-mono); font-size: 20px; font-weight: 700; color: var(--text-primary, #ffcc00); }
        .stat-mini .lbl { font-size: 10px; color: var(--text-muted, #b38f00); }

        .list-controls {
          display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;
        }

        .search-box {
          display: flex; align-items: center; gap: 12px;
          background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); padding: 0 16px;
          flex: 1; min-width: 200px; color: var(--text-primary, #ffcc00);
        }
        .search-box input {
          flex: 1; padding: 12px 0; border: none; background: transparent;
          font-family: var(--font-mono); font-size: 12px; color: var(--text-primary, #ffcc00);
        }
        .search-box input::placeholder { color: var(--text-muted, #b38f00); }
        .search-box input:focus { outline: none; }

        .filter-group {
          display: flex; align-items: center; gap: 8px;
          background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); padding: 0 12px;
          color: var(--text-primary, #ffcc00);
        }
        .filter-group select {
          padding: 12px 8px; border: none; background: transparent;
          font-family: var(--font-pixel); font-size: 11px; cursor: pointer;
          color: var(--text-primary, #ffcc00);
        }
        .filter-group select option { background: var(--bg-card, #2a2a2a); color: var(--text-primary, #ffcc00); }
        .filter-group select:focus { outline: none; }

        .tx-table-wrapper {
          background: var(--bg-card, #2a2a2a);
          border: 2px solid var(--border-color, #ffcc00);
          box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00);
        }

        .tx-header-row {
          display: grid;
          grid-template-columns: 1.5fr 1fr 2fr 1fr 1.5fr 50px 40px;
          gap: 16px;
          padding: 12px 20px;
          background: var(--text-primary, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
          font-family: var(--font-pixel);
          font-size: 10px;
        }

        .tx-body { }

        .empty-state {
          display: flex; flex-direction: column; align-items: center; gap: 16px;
          padding: 60px; color: var(--text-muted, #b38f00);
          font-family: var(--font-pixel); font-size: 12px;
        }

        @media (max-width: 1024px) {
          .tx-header-row { grid-template-columns: 1.5fr 1fr 1fr 50px 40px; }
          .tx-header-row span:nth-child(3),
          .tx-header-row span:nth-child(4) { display: none; }
        }

        @media (max-width: 640px) {
          .list-header { flex-direction: column; }
          .list-controls { flex-direction: column; }
          .search-box { width: 100%; }
        }
      `}</style>
    </div>
  );
}
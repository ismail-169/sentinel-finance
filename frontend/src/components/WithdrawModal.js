import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { X, ArrowUpFromLine, Loader, AlertCircle, Check } from 'lucide-react';

export default function WithdrawModal({ 
  isOpen, 
  onClose, 
  vaultBalance, 
  vaultContract,
  onSuccess 
}) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (parseFloat(amount) > parseFloat(vaultBalance)) {
      setError('Insufficient vault balance');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const amountWei = ethers.parseUnits(amount, 18);
      const tx = await vaultContract.withdraw(amountWei);
      await tx.wait();

      setSuccess(true);
      setTimeout(() => {
        onSuccess && onSuccess();
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err.reason || err.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawAll = async () => {
    setLoading(true);
    setError('');

    try {
      const tx = await vaultContract.withdrawAll();
      await tx.wait();

      setSuccess(true);
      setTimeout(() => {
        onSuccess && onSuccess();
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err.reason || err.message || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setError('');
    setSuccess(false);
    onClose();
  };

  const setPercentage = (percent) => {
    const value = (parseFloat(vaultBalance) * percent / 100).toFixed(2);
    setAmount(value);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      >
        <motion.div
          className="modal-box"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div className="header-icon">
              <ArrowUpFromLine size={20} />
            </div>
            <h2>WITHDRAW MNEE</h2>
            <button className="close-btn" onClick={handleClose}>
              <X size={20} />
            </button>
          </div>

          {success ? (
            <div className="success-state">
              <div className="success-icon">
                <Check size={48} strokeWidth={3} />
              </div>
              <h3>WITHDRAWAL COMPLETE</h3>
              <p>MNEE RETURNED TO WALLET</p>
            </div>
          ) : (
            <>
              <div className="modal-body">
                <div className="balance-info">
                  <span className="label">VAULT BALANCE</span>
                  <span className="value">{parseFloat(vaultBalance).toLocaleString()} MNEE</span>
                </div>

                <div className="input-section">
                  <div className="input-header">
                    <span>AMOUNT</span>
                    <div className="quick-amounts">
                      <button onClick={() => setPercentage(25)}>25%</button>
                      <button onClick={() => setPercentage(50)}>50%</button>
                      <button onClick={() => setPercentage(75)}>75%</button>
                      <button onClick={() => setPercentage(100)}>MAX</button>
                    </div>
                  </div>
                  <div className="input-wrapper">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={loading}
                    />
                    <span className="token-label">MNEE</span>
                  </div>
                </div>

                <div className="info-note">
                  <AlertCircle size={14} />
                  <span>FUNDS WILL BE RETURNED TO YOUR CONNECTED WALLET</span>
                </div>

                {error && (
                  <div className="error-box">
                    <AlertCircle size={16} />
                    <span>{error.toUpperCase()}</span>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="cancel-btn" onClick={handleClose} disabled={loading}>
                  CANCEL
                </button>
                <div className="action-group">
                  <button 
                    className="alt-btn"
                    onClick={handleWithdrawAll}
                    disabled={loading || parseFloat(vaultBalance) <= 0}
                  >
                    ALL
                  </button>
                  <button 
                    className="confirm-btn" 
                    onClick={handleWithdraw}
                    disabled={loading || !amount || parseFloat(amount) <= 0}
                  >
                    {loading ? 'PROCESSING...' : 'CONFIRM WITHDRAW'}
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 20px;
        }

        .modal-box {
          background: var(--bg-card, #2a2a2a);
          border: 4px solid var(--border-color, #ffcc00);
          width: 100%; max-width: 480px;
          box-shadow: 12px 12px 0px 0px var(--border-color, #ffcc00);
        }

        .modal-header {
          display: flex; align-items: center; gap: 16px;
          padding: 20px; border-bottom: 2px solid var(--border-color, #ffcc00);
          background: var(--accent-amber); color: var(--bg-primary, #1a1a1a);
        }

        .header-icon {
          width: 40px; height: 40px;
          background: var(--bg-card, #2a2a2a); color: var(--text-primary, #ffcc00); border: 2px solid var(--bg-primary, #1a1a1a);
          display: flex; align-items: center; justify-content: center;
        }

        .modal-header h2 {
          flex: 1; font-family: var(--font-pixel); font-size: 20px; margin: 0;
        }

        .close-btn {
          background: transparent; border: none; color: var(--bg-primary, #1a1a1a); cursor: pointer;
        }
        .close-btn:hover { transform: scale(1.1); }

        .modal-body { padding: 32px; }

        .balance-info {
          display: flex; justify-content: space-between; align-items: center;
          padding: 16px; border: 2px solid var(--border-color, #ffcc00); background: var(--bg-secondary, #252525);
          margin-bottom: 24px;
        }

        .balance-info .label { font-size: 10px; font-weight: 700; color: var(--text-muted, #b38f00); }
        .balance-info .value { font-family: var(--font-mono); font-size: 16px; font-weight: 700; color: var(--text-primary, #ffcc00); }

        .input-section { margin-bottom: 16px; }

        .input-header {
          display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
        }
        .input-header span { font-size: 12px; font-weight: 700; color: var(--text-primary, #ffcc00); }

        .quick-amounts { display: flex; gap: 8px; }
        .quick-amounts button {
          padding: 6px 10px; background: var(--bg-secondary, #252525); border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-mono); font-size: 10px; font-weight: 700; cursor: pointer;
          transition: transform 0.1s; color: var(--text-primary, #ffcc00);
        }
        .quick-amounts button:hover { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); transform: translate(-2px, -2px); box-shadow: 2px 2px 0px 0px var(--border-color, #ffcc00); }

        .input-wrapper { position: relative; }
        .input-wrapper input {
          width: 100%; padding: 16px; padding-right: 80px;
          border: 2px solid var(--border-color, #ffcc00); font-family: var(--font-mono); font-size: 24px; font-weight: 700;
          outline: none; background: var(--bg-secondary, #252525); color: var(--text-primary, #ffcc00);
        }
        .input-wrapper input:focus { box-shadow: 4px 4px 0px 0px var(--accent-amber); }
        .input-wrapper input::placeholder { color: var(--text-muted, #b38f00); }
        .token-label {
          position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
          font-family: var(--font-pixel); font-size: 12px; color: var(--text-muted, #b38f00);
        }

        .info-note {
          display: flex; align-items: center; gap: 8px;
          font-size: 10px; font-weight: 700; color: var(--text-muted, #b38f00); margin-bottom: 16px;
        }

        .error-box {
          display: flex; align-items: center; gap: 8px; padding: 12px;
          border: 2px solid var(--accent-red); background: rgba(255, 59, 48, 0.15); color: var(--accent-red);
          font-weight: 700; font-size: 12px; margin-top: 16px;
        }

        .modal-footer {
          display: flex; justify-content: space-between; align-items: center;
          padding: 24px; border-top: 2px solid var(--border-color, #ffcc00); background: var(--bg-secondary, #252525);
        }

        .action-group { display: flex; gap: 8px; flex: 1; margin-left: 16px; }

        .cancel-btn {
          padding: 16px 24px; background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-pixel); font-size: 12px; cursor: pointer; color: var(--text-primary, #ffcc00);
        }
        .cancel-btn:hover { background: var(--bg-primary, #1a1a1a); }

        .alt-btn {
          padding: 16px; background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); color: var(--text-primary, #ffcc00);
          font-family: var(--font-pixel); font-size: 12px; cursor: pointer; font-weight: 700;
        }
        .alt-btn:hover:not(:disabled) { background: var(--accent-amber); color: var(--bg-primary, #1a1a1a); }

        .confirm-btn {
          flex: 1; padding: 16px; background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-pixel); font-size: 12px; cursor: pointer;
          transition: transform 0.1s;
        }
        .confirm-btn:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00); }
        .confirm-btn:disabled { background: var(--text-muted, #b38f00); border-color: var(--text-muted, #b38f00); cursor: not-allowed; opacity: 0.5; }

        .success-state { padding: 48px; text-align: center; }
        .success-icon { color: var(--accent-emerald); margin-bottom: 24px; }
        .success-state h3 { font-family: var(--font-pixel); font-size: 24px; margin-bottom: 8px; color: var(--text-primary, #ffcc00); }
        .success-state p { font-family: var(--font-mono); font-size: 14px; color: var(--text-secondary, #e6b800); }
      `}</style>
    </AnimatePresence>
  );
}
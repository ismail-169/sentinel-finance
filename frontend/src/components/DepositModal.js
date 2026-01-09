import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { X, ArrowDownToLine, Loader, AlertCircle, Check } from 'lucide-react';

export default function DepositModal({ 
  isOpen, 
  onClose, 
  walletBalance, 
  mneeContract, 
  vaultAddress,
  onSuccess 
}) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (parseFloat(amount) > parseFloat(walletBalance)) {
      setError('Insufficient balance');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const amountWei = ethers.parseUnits(amount, 18);

      setStep(1);
      const approveTx = await mneeContract.approve(vaultAddress, amountWei);
      await approveTx.wait();

      setStep(2);
      const vaultAbi = ["function deposit(uint256 amount)"];
      const vaultContract = new ethers.Contract(
        vaultAddress,
        vaultAbi,
        mneeContract.runner
      );

      const depositTx = await vaultContract.deposit(amountWei);
      await depositTx.wait();

      setSuccess(true);
      setTimeout(() => {
        onSuccess && onSuccess();
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err.reason || err.message || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount('');
    setError('');
    setSuccess(false);
    setStep(1);
    onClose();
  };

  const setPercentage = (percent) => {
    const value = (parseFloat(walletBalance) * percent / 100).toFixed(2);
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
              <ArrowDownToLine size={20} />
            </div>
            <h2>DEPOSIT MNEE</h2>
            <button className="close-btn" onClick={handleClose}>
              <X size={20} />
            </button>
          </div>

          {success ? (
            <div className="success-state">
              <div className="success-icon">
                <Check size={48} strokeWidth={3} />
              </div>
              <h3>DEPOSIT COMPLETE</h3>
              <p>{amount} MNEE ADDED TO VAULT</p>
            </div>
          ) : (
            <>
              <div className="modal-body">
                <div className="balance-info">
                  <span className="label">WALLET BALANCE</span>
                  <span className="value">{parseFloat(walletBalance).toLocaleString()} MNEE</span>
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

                {error && (
                  <div className="error-box">
                    <AlertCircle size={16} />
                    <span>{error.toUpperCase()}</span>
                  </div>
                )}

                {loading && (
                  <div className="loading-steps">
                    <div className={`load-step ${step >= 1 ? 'active' : ''}`}>
                      <div className="step-indicator">1</div>
                      <span>APPROVING TOKENS...</span>
                      {step === 1 && <Loader className="spin" size={14} />}
                    </div>
                    <div className={`load-step ${step >= 2 ? 'active' : ''}`}>
                      <div className="step-indicator">2</div>
                      <span>DEPOSITING TO VAULT...</span>
                      {step === 2 && <Loader className="spin" size={14} />}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button className="cancel-btn" onClick={handleClose} disabled={loading}>
                  CANCEL
                </button>
                <button 
                  className="confirm-btn" 
                  onClick={handleDeposit}
                  disabled={loading || !amount || parseFloat(amount) <= 0}
                >
                  {loading ? 'PROCESSING...' : 'CONFIRM DEPOSIT'}
                </button>
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
          background: var(--accent-blue); color: white;
        }

        .header-icon {
          width: 40px; height: 40px;
          background: var(--bg-card, #2a2a2a); color: var(--text-primary, #ffcc00); border: 2px solid var(--border-color, #ffcc00);
          display: flex; align-items: center; justify-content: center;
        }

        .modal-header h2 {
          flex: 1; font-family: var(--font-pixel); font-size: 20px; margin: 0;
        }

        .close-btn {
          background: transparent; border: none; color: white; cursor: pointer;
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

        .input-section { margin-bottom: 24px; }

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
        .input-wrapper input:focus { box-shadow: 4px 4px 0px 0px var(--accent-cyan); }
        .input-wrapper input::placeholder { color: var(--text-muted, #b38f00); }
        .token-label {
          position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
          font-family: var(--font-pixel); font-size: 12px; color: var(--text-muted, #b38f00);
        }

        .error-box {
          display: flex; align-items: center; gap: 8px; padding: 12px;
          border: 2px solid var(--accent-red); background: rgba(255, 59, 48, 0.15); color: var(--accent-red);
          font-weight: 700; font-size: 12px; margin-top: 16px;
        }

        .loading-steps {
          display: flex; flex-direction: column; gap: 12px; margin-top: 24px;
          padding: 16px; border: 2px dashed var(--border-color, #ffcc00); background: var(--bg-secondary, #252525);
        }

        .load-step { display: flex; align-items: center; gap: 12px; opacity: 0.4; color: var(--text-primary, #ffcc00); }
        .load-step.active { opacity: 1; }
        
        .step-indicator {
          width: 24px; height: 24px; background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-pixel); font-size: 12px;
        }
        .load-step span { font-size: 12px; font-weight: 700; font-family: var(--font-mono); }

        .modal-footer {
          display: flex; gap: 16px; padding: 24px; border-top: 2px solid var(--border-color, #ffcc00); background: var(--bg-secondary, #252525);
        }

        .cancel-btn {
          flex: 1; padding: 16px; background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-pixel); font-size: 12px; cursor: pointer; color: var(--text-primary, #ffcc00);
        }
        .cancel-btn:hover { background: var(--bg-primary, #1a1a1a); }

        .confirm-btn {
          flex: 2; padding: 16px; background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-pixel); font-size: 12px; cursor: pointer;
          transition: transform 0.1s;
        }
        .confirm-btn:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00); }
        .confirm-btn:disabled { background: var(--text-muted, #b38f00); border-color: var(--text-muted, #b38f00); cursor: not-allowed; opacity: 0.5; }

        .success-state { padding: 48px; text-align: center; }
        .success-icon { color: var(--accent-emerald); margin-bottom: 24px; }
        .success-state h3 { font-family: var(--font-pixel); font-size: 24px; margin-bottom: 8px; color: var(--text-primary, #ffcc00); }
        .success-state p { font-family: var(--font-mono); font-size: 14px; color: var(--text-secondary, #e6b800); }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </AnimatePresence>
  );
}
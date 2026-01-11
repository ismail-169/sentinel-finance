import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import {
  Shield, Lock, Unlock, Users, TrendingUp, Settings,
  DollarSign, Clock, CheckCircle, AlertTriangle, Plus,
  Trash2, ExternalLink, Copy, Edit2, Save, X, Loader,
  PiggyBank, Calendar, Repeat
} from 'lucide-react';
import sentinelLogo from '../sentinel-logo.png';

const formatTimeLock = (seconds) => {
  if (!seconds || seconds === 0) return '0 SEC';
  if (seconds < 60) return `${seconds} SEC`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} MIN`;
  return `${(seconds / 3600).toFixed(1)}H`;
};

const StatBox = ({ icon: Icon, label, value, subValue, color, delay }) => (
  <motion.div
    className="stat-box"
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.3, delay }}
  >
    <div className="box-header">
       <Icon size={20} />
       <div className={`indicator ${color}`}></div>
    </div>
    <div className="box-value">{value}</div>
    <div className="box-label">{label}</div>
    {subValue && <div className="box-sub">{subValue}</div>}

    <style jsx>{`
      .stat-box {
        background: var(--bg-card, #2a2a2a);
        border: 2px solid var(--border-color, #ffcc00);
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        position: relative;
        box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00);
      }
      .box-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
      .indicator { width: 12px; height: 12px; border: 2px solid var(--border-color, #ffcc00); }
      .indicator.green { background: var(--accent-emerald); border-radius: 50%; }
      .indicator.blue { background: var(--accent-blue); }
      .indicator.purple { background: var(--accent-purple); }
      .indicator.cyan { background: var(--accent-cyan); }
      .indicator.amber { background: var(--accent-amber); transform: rotate(45deg); }
      
      .box-value { font-family: var(--font-pixel); font-size: 24px; line-height: 1; }
      .box-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted, #b38f00); }
      .box-sub { font-family: var(--font-mono); font-size: 10px; margin-top: auto; padding-top: 8px; border-top: 1px dashed var(--text-muted, #b38f00); }
    `}</style>
  </motion.div>
);

const VendorCard = ({ vendor, onRemove, isTrusted }) => {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(vendor.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      className="vendor-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      layout
    >
      <div className={`status-strip ${isTrusted ? 'trusted' : 'untrusted'}`}></div>
      <div className="vendor-content">
        <div className="vendor-header">
           <div className="vendor-identity">
              {isTrusted ? <CheckCircle size={16} color="var(--accent-emerald)" /> : <AlertTriangle size={16} color="var(--accent-amber)" />}
              <span className="vendor-name">{vendor.name || 'UNKNOWN'}</span>
           </div>
           <div className="vendor-actions">
              <button className="v-btn" onClick={copyAddress}>
                {copied ? <CheckCircle size={12}/> : <Copy size={12}/>}
              </button>
              <a className="v-btn" href={`https://sepolia.etherscan.io/address/${vendor.address}`} target="_blank" rel="noreferrer">
                <ExternalLink size={12}/>
              </a>
              {isTrusted && onRemove && (
                <button className="v-btn danger" onClick={() => onRemove(vendor.address)}>
                  <Trash2 size={12}/>
                </button>
              )}
           </div>
        </div>
        <div className="vendor-address">{vendor.address}</div>
        <div className="vendor-stats">
           <span>{vendor.txCount || 0} TXS</span>
           <span>{parseFloat(vendor.volume || 0).toLocaleString()} MNEE</span>
        </div>
      </div>

      <style jsx>{`
        .vendor-card { display: flex; overflow: hidden; background: var(--bg-secondary, #252525); border: 2px solid var(--border-color, #ffcc00); }
        .status-strip { width: 4px; flex-shrink: 0; }
        .status-strip.trusted { background: var(--accent-emerald); }
        .status-strip.untrusted { background: var(--accent-amber); }
        
        .vendor-content { flex: 1; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
        
        .vendor-header { display: flex; justify-content: space-between; align-items: center; }
        .vendor-identity { display: flex; align-items: center; gap: 8px; }
        .vendor-name { font-weight: 700; font-size: 14px; }
        
        .vendor-actions { display: flex; gap: 4px; }
        .v-btn { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-color, #ffcc00); background: var(--bg-card, #2a2a2a); cursor: pointer; transition: all 0.1s; color: var(--text-primary, #ffcc00); }
        .v-btn:hover { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); }
        .v-btn.danger:hover { background: var(--accent-red); border-color: var(--accent-red); color: white; }
        
        .vendor-address { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted, #b38f00); word-break: break-all; }
        
        .vendor-stats { display: flex; gap: 16px; font-size: 11px; font-weight: 700; color: var(--text-secondary, #e6b800); padding-top: 8px; border-top: 1px dashed var(--text-muted, #b38f00); }
      `}</style>
    </motion.div>
  );
};

// Savings Plans Card Component
const SavingsPlansCard = ({ savingsPlans }) => {
  if (savingsPlans.length === 0) return null;

  return (
    <motion.div
      className="savings-plans-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.4 }}
    >
      <div className="spc-header">
        <PiggyBank size={16} />
        <span>ACTIVE SAVINGS PLANS</span>
        <div className="count-badge">{savingsPlans.length}</div>
      </div>
      <div className="spc-list">
        {savingsPlans.slice(0, 3).map(plan => {
          const progress = Math.min(100, (plan.totalSaved / plan.targetAmount) * 100);
          const daysLeft = Math.max(0, Math.ceil((new Date(plan.unlockDate) - new Date()) / (1000 * 60 * 60 * 24)));
          
          return (
            <div key={plan.id} className="savings-plan-item">
              <div className="spi-header">
                <Lock size={12} />
                <span className="spi-name">{plan.name}</span>
                <span className="spi-days">{daysLeft}d left</span>
              </div>
              <div className="spi-progress">
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <span className="progress-text">{plan.totalSaved.toFixed(0)} / {plan.targetAmount.toFixed(0)} MNEE</span>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .savings-plans-card {
          grid-column: span 2;
          background: var(--bg-card, #2a2a2a);
          border: 2px solid #a855f7;
          padding: 20px;
          box-shadow: 4px 4px 0px 0px rgba(168, 85, 247, 0.3);
        }
        
        .spc-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-bottom: 16px;
          margin-bottom: 16px;
          border-bottom: 2px solid rgba(168, 85, 247, 0.3);
          font-family: var(--font-pixel);
          font-size: 14px;
          color: #a855f7;
        }
        
        .count-badge {
          margin-left: auto;
          padding: 2px 10px;
          background: rgba(168, 85, 247, 0.2);
          border: 1px solid #a855f7;
          font-size: 12px;
        }
        
        .spc-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .savings-plan-item {
          padding: 12px;
          background: var(--bg-secondary, #252525);
          border: 1px solid var(--border-color, #ffcc00);
        }
        
        .spi-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          font-size: 12px;
          color: #a855f7;
        }
        
        .spi-name {
          font-weight: 700;
          color: var(--text-primary, #ffcc00);
        }
        
        .spi-days {
          margin-left: auto;
          font-family: var(--font-mono);
          font-size: 10px;
          padding: 2px 6px;
          background: rgba(168, 85, 247, 0.2);
          border: 1px solid #a855f7;
        }
        
        .spi-progress {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .progress-track {
          height: 8px;
          background: var(--bg-primary, #1a1a1a);
          border: 1px solid var(--border-color, #ffcc00);
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #a855f7, #60a5fa);
          transition: width 0.3s ease;
        }
        
        .progress-text {
          font-size: 10px;
          font-family: var(--font-mono);
          color: var(--text-muted, #b38f00);
        }
      `}</style>
    </motion.div>
  );
};

const LimitEditor = ({ icon: Icon, label, value, unit, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [newValue, setNewValue] = useState(value);

  const handleSave = () => {
    onSave(newValue);
    setEditing(false);
  };

  return (
    <div className="limit-editor">
      <div className="limit-label">
        <Icon size={14} />
        <span>{label}</span>
      </div>
      
      <div className="limit-body">
        {editing ? (
          <div className="edit-mode">
            <input 
              type="number" 
              value={newValue} 
              onChange={(e) => setNewValue(e.target.value)}
              autoFocus
            />
            <div className="edit-actions">
               <button className="save" onClick={handleSave}><Save size={14}/></button>
               <button className="cancel" onClick={() => setEditing(false)}><X size={14}/></button>
            </div>
          </div>
        ) : (
          <div className="view-mode">
            <span className="val">{parseFloat(value).toLocaleString()} <small>{unit}</small></span>
            <button onClick={() => setEditing(true)}><Edit2 size={14}/></button>
          </div>
        )}
      </div>

      <style jsx>{`
        .limit-editor {
          border: 2px solid var(--border-color, #ffcc00);
          background: var(--bg-secondary, #252525);
          padding: 12px;
        }
        .limit-label { 
          display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted, #b38f00); margin-bottom: 8px;
        }
        
        .limit-body { height: 32px; display: flex; align-items: center; }
        
        .view-mode { width: 100%; display: flex; justify-content: space-between; align-items: center; }
        .val { font-family: var(--font-pixel); font-size: 18px; }
        .val small { font-family: var(--font-geo); font-size: 10px; color: var(--text-secondary); margin-left: 4px; }
        
        .view-mode button { background: transparent; border: none; cursor: pointer; color: var(--text-muted, #b38f00); }
        .view-mode button:hover { color: black; }

        .edit-mode { display: flex; width: 100%; gap: 8px; }
        .edit-mode input { flex: 1; border: 2px solid var(--border-color, #ffcc00); padding: 4px; font-family: var(--font-mono); font-size: 14px; }
        .edit-actions { display: flex; gap: 4px; }
        .edit-actions button { 
          width: 28px; height: 100%; border: 2px solid var(--border-color, #ffcc00); display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .save { background: var(--accent-emerald); color: white; border-color: black; }
        .cancel { background: var(--accent-red); color: white; border-color: black; }
      `}</style>
    </div>
  );
};

export default function VaultStats({ vaultData, vendors = [], contract, onRefresh, onSaveVendor, onRemoveVendor, account }) {
  const [newVendorAddress, setNewVendorAddress] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const [addingVendor, setAddingVendor] = useState(false);
  const [localTrustedVendors, setLocalTrustedVendors] = useState([]);
  const [removedVendors, setRemovedVendors] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [savingsPlans, setSavingsPlans] = useState([]);
  const [schedules, setSchedules] = useState([]);
  
  const [editDailyLimit, setEditDailyLimit] = useState('');
  const [editTxLimit, setEditTxLimit] = useState('');
  const [editTimeLock, setEditTimeLock] = useState('');
  const [savingLimits, setSavingLimits] = useState(false);
  const [limitsError, setLimitsError] = useState('');
  const [limitsSuccess, setLimitsSuccess] = useState(false);

  // Load savings plans from localStorage
  useEffect(() => {
    const loadAutomations = () => {
      if (account) {
        try {
          const savedSavings = localStorage.getItem(`sentinel_savings_${account}`);
          const savedSchedules = localStorage.getItem(`sentinel_schedules_${account}`);
          if (savedSavings) setSavingsPlans(JSON.parse(savedSavings));
          if (savedSchedules) setSchedules(JSON.parse(savedSchedules));
        } catch (e) {
          console.error('Error loading automations:', e);
        }
      }
    };

    loadAutomations();
    const interval = setInterval(loadAutomations, 3000);
    return () => clearInterval(interval);
  }, [account]);

  React.useEffect(() => {
    if (vaultData) {
      setEditDailyLimit(vaultData.dailyLimit || '10000');
      setEditTxLimit(vaultData.txLimit || '1000');
      setEditTimeLock(vaultData.timeLockDuration?.toString() || '60');
    }
  }, [vaultData]);

  const allVendors = [
    ...vendors.filter(v => !removedVendors.includes(v.address.toLowerCase())),
    ...localTrustedVendors.filter(lv => !vendors.some(v => v.address.toLowerCase() === lv.address.toLowerCase()))
  ];
  
  const trustedVendors = allVendors.filter(v => v.trusted);
  const recentVendors = allVendors.filter(v => !v.trusted).slice(0, 5);

  // Calculate locked savings
  const totalLockedSavings = savingsPlans.reduce((sum, p) => sum + (p.totalSaved || 0), 0);

  const handleAddVendor = async () => {
    if (!contract || !newVendorAddress) return;
    if (!newVendorName.trim()) {
      alert('ENTER VENDOR NAME');
      return;
    }
    
    try {
      setAddingVendor(true);
      
      const tx = await contract.setTrustedVendor(newVendorAddress, true);
      await tx.wait();
      
      const apiUrl = 'https://api.sentinelfinance.xyz';
      try {
        await fetch(`${apiUrl}/api/v1/vendors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: newVendorAddress,
            name: newVendorName.trim(),
            trusted: true
          })
        });
      } catch (e) { console.warn('API Save failed, using localStorage'); }
      
      const newVendor = {
        address: newVendorAddress,
        name: newVendorName.trim(),
        trusted: true,
        txCount: 0,
        volume: '0'
      };
      
      if (onSaveVendor) {
        onSaveVendor(newVendor);
      } else {
        setLocalTrustedVendors(prev => [...prev, newVendor]);
      }
      
      setNewVendorAddress('');
      setNewVendorName('');
      onRefresh && onRefresh();
      
    } catch (err) {
      alert('FAILED TO ADD VENDOR: ' + (err.reason || err.message));
    } finally {
      setAddingVendor(false);
    }
  };

  const handleRemoveVendor = async (address) => {
    if (!contract) return;
    try {
      const tx = await contract.setTrustedVendor(address, false);
      await tx.wait();
      
      if (onRemoveVendor) {
        onRemoveVendor(address);
      } else {
        setRemovedVendors(prev => [...prev, address.toLowerCase()]);
      }
      
      onRefresh && onRefresh();
    } catch (err) {
      alert('REMOVE FAILED: ' + (err.reason || err.message));
    }
  };

  const handleSaveLimits = async () => {
    if (!contract) {
      setLimitsError('WALLET NOT CONNECTED');
      return;
    }
    
    setSavingLimits(true);
    setLimitsError('');
    setLimitsSuccess(false);
    
    try {
      const dailyLimitWei = ethers.parseUnits(editDailyLimit.toString(), 18);
      const txLimitWei = ethers.parseUnits(editTxLimit.toString(), 18);
      const timeLockSeconds = parseInt(editTimeLock) || 60;
      
      const tx = await contract.setLimits(dailyLimitWei, txLimitWei, timeLockSeconds);
      await tx.wait();
      
      setLimitsSuccess(true);
      setTimeout(() => setLimitsSuccess(false), 3000);
      onRefresh && onRefresh();
    } catch (err) {
      setLimitsError(err.reason || err.message || 'FAILED TO UPDATE');
    } finally {
      setSavingLimits(false);
    }
  };

  const timeLockPresets = [
    { label: '1 MIN', value: 60 },
    { label: '5 MIN', value: 300 },
    { label: '15 MIN', value: 900 },
    { label: '1 HOUR', value: 3600 },
    { label: '24 HOURS', value: 86400 }
  ];

  return (
    <div className="vault-layout">
      <div className="vault-header">
        <div>
           <h1>VAULT OPS</h1>
           <p>CONFIGURATION & SECURITY</p>
        </div>
        <div className="vault-id">
          ID: {vaultData?.address?.slice(0, 8)}...
        </div>
      </div>

      <div className="vault-tabs">
        <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>OVERVIEW</button>
        <button className={activeTab === 'config' ? 'active' : ''} onClick={() => setActiveTab('config')}>SPENDING LIMITS</button>
        <button className={activeTab === 'vendors' ? 'active' : ''} onClick={() => setActiveTab('vendors')}>VENDORS</button>
      </div>

      <div className="vault-content">
        {activeTab === 'overview' && (
          <div className="overview-grid">
             <StatBox 
               icon={DollarSign} label="TOTAL BALANCE" 
               value={vaultData ? `${parseFloat(vaultData.balance).toLocaleString()}` : '—'}
               subValue="MNEE ASSETS" color="blue" delay={0} 
             />
             <StatBox 
               icon={TrendingUp} label="DAILY LIMIT" 
               value={vaultData ? `${parseFloat(vaultData.dailyLimit).toLocaleString()}` : '—'}
               subValue="PER 24 HOURS" color="purple" delay={0.1} 
             />
            <StatBox 
               icon={() => <img src={sentinelLogo} alt="" style={{ width: '20px', height: '20px' }} />} 
               label="TX LIMIT" 
               value={vaultData ? `${parseFloat(vaultData.txLimit).toLocaleString()}` : '—'}
               subValue="SINGLE TX CAP" color="cyan" delay={0.2} 
             />
             <StatBox 
               icon={Clock} label="TIME LOCK" 
               value={vaultData ? formatTimeLock(vaultData.timeLockDuration) : '—'}
               subValue="UNTRUSTED DELAY" color="amber" delay={0.3} 
             />

             {/* Locked Savings Stat Box */}
             {savingsPlans.length > 0 && (
               <StatBox 
                 icon={Lock} label="LOCKED SAVINGS" 
                 value={totalLockedSavings.toFixed(0)}
                 subValue={`${savingsPlans.length} ACTIVE PLAN${savingsPlans.length > 1 ? 'S' : ''}`} 
                 color="purple" delay={0.35} 
               />
             )}

             {/* Scheduled Payments Stat Box */}
             {schedules.length > 0 && (
               <StatBox 
                 icon={Repeat} label="SCHEDULED" 
                 value={schedules.length}
                 subValue="RECURRING PAYMENTS" 
                 color="cyan" delay={0.4} 
               />
             )}
             
             {/* Savings Plans Display */}
             <SavingsPlansCard savingsPlans={savingsPlans} />
             
             <div className="security-card">
             <div className="card-title">
               <img src={sentinelLogo} alt="" style={{ width: '16px', height: '16px', marginRight: '8px' }} />
               SECURITY STATUS
             </div>
               <div className="checklist">
                  <div className="check-item"><CheckCircle size={14} color="var(--accent-emerald)" /> REENTRANCY GUARD ACTIVE</div>
                  <div className="check-item"><CheckCircle size={14} color="var(--accent-emerald)" /> TIME LOCK ENABLED</div>
                  <div className="check-item"><CheckCircle size={14} color="var(--accent-emerald)" /> AI WATCHDOG ONLINE</div>
                  {savingsPlans.length > 0 && (
                    <div className="check-item"><CheckCircle size={14} color="var(--accent-emerald)" /> SAVINGS LOCK ACTIVE</div>
                  )}
               </div>
             </div>

             <div className="emergency-card">
               <div className="card-title"><Lock size={16}/> EMERGENCY CONTROLS</div>
               <div className="controls-row">
                  <button className="btn-danger"><Lock size={14}/> PAUSE VAULT</button>
                  <button className="btn-danger"><Unlock size={14}/> EMERGENCY WITHDRAW</button>
               </div>
             </div>
          </div>
        )}

        {activeTab === 'config' && (
           <div className="config-grid">
              <div className="section-block">
                 <h3>VAULT LIMITS</h3>
                 <p>Configure spending limits and security timelock for your vault.</p>
                 
                 <div className="settings-form">
                    <div className="setting-row">
                       <label>
                          <TrendingUp size={16} />
                          <span>DAILY LIMIT</span>
                       </label>
                       <div className="input-group">
                          <input 
                            type="number" 
                            value={editDailyLimit} 
                            onChange={e => setEditDailyLimit(e.target.value)}
                            placeholder="10000"
                          />
                          <span className="unit">MNEE</span>
                       </div>
                       <span className="hint">MAX SPEND PER 24 HOURS</span>
                    </div>

                    <div className="setting-row">
                      <label>
                          <img src={sentinelLogo} alt="" style={{ width: '16px', height: '16px', marginRight: '8px' }} />
                          <span>TRANSACTION LIMIT</span>
                       </label>
                       <div className="input-group">
                          <input 
                            type="number" 
                            value={editTxLimit} 
                            onChange={e => setEditTxLimit(e.target.value)}
                            placeholder="1000"
                          />
                          <span className="unit">MNEE</span>
                       </div>
                       <span className="hint">MAX PER SINGLE TRANSACTION</span>
                    </div>

                    <div className="setting-row">
                       <label>
                          <Clock size={16} />
                          <span>TIME LOCK (UNTRUSTED)</span>
                       </label>
                       <div className="input-group">
                          <input 
                            type="number" 
                            value={editTimeLock} 
                            onChange={e => setEditTimeLock(e.target.value)}
                            placeholder="300"
                          />
                          <span className="unit">SEC</span>
                       </div>
                       <span className="hint">DELAY BEFORE UNTRUSTED PAYMENTS EXECUTE</span>
                    </div>

                    <div className="timelock-presets">
                       <span className="preset-label">QUICK SET:</span>
                       {timeLockPresets.map(preset => (
                          <button 
                            key={preset.value}
                            className={`preset-btn ${editTimeLock == preset.value ? 'active' : ''}`}
                            onClick={() => setEditTimeLock(preset.value.toString())}
                          >
                            {preset.label}
                          </button>
                       ))}
                    </div>

                    {limitsError && (
                       <div className="error-msg">
                          <AlertTriangle size={14} /> {limitsError}
                       </div>
                    )}

                    {limitsSuccess && (
                       <div className="success-msg">
                          <CheckCircle size={14} /> LIMITS UPDATED SUCCESSFULLY
                       </div>
                    )}

                    <button 
                       className="save-btn" 
                       onClick={handleSaveLimits}
                       disabled={savingLimits}
                    >
                       {savingLimits ? (
                          <><Loader size={16} className="spin" /> SAVING...</>
                       ) : (
                          <><Save size={16} /> SAVE ALL LIMITS</>
                       )}
                    </button>
                 </div>

                 <div className="info-box">
                    <AlertTriangle size={14}/>
                    <div>
                       <strong>TRUSTED VENDORS</strong> execute immediately (no timelock).<br/>
                       <strong>UNTRUSTED VENDORS</strong> wait for timelock period before execution.
                    </div>
                 </div>
              </div>
           </div>
        )}

        {activeTab === 'vendors' && (
           <div className="vendors-layout">
              <div className="add-vendor-section">
                 <h3>ADD TRUSTED VENDOR</h3>
                 <div className="add-form">
                    <input 
                      placeholder="VENDOR NAME (e.g. AWS)" 
                      value={newVendorName} 
                      onChange={e => setNewVendorName(e.target.value)} 
                    />
                    <input 
                      placeholder="WALLET ADDRESS (0x...)" 
                      value={newVendorAddress} 
                      onChange={e => setNewVendorAddress(e.target.value)} 
                      className="mono-input"
                    />
                    <button className="add-btn" onClick={handleAddVendor} disabled={addingVendor}>
                       {addingVendor ? 'ADDING...' : <><Plus size={14}/> ADD</>}
                    </button>
                 </div>
              </div>

              <div className="vendors-lists">
                 <div className="list-col">
                    <h4>TRUSTED ({trustedVendors.length})</h4>
                    {trustedVendors.map(v => (
                       <VendorCard key={v.address} vendor={v} isTrusted={true} onRemove={handleRemoveVendor} />
                    ))}
                    {trustedVendors.length === 0 && <div className="empty">NO TRUSTED VENDORS</div>}
                 </div>
                 
                 <div className="list-col">
                    <h4>RECENT UNTRUSTED</h4>
                    {recentVendors.map(v => (
                       <VendorCard key={v.address} vendor={v} isTrusted={false} />
                    ))}
                    {recentVendors.length === 0 && <div className="empty">NO RECENT ACTIVITY</div>}
                 </div>
              </div>
           </div>
        )}
      </div>

      <style jsx>{`
        .vault-layout { display: flex; flex-direction: column; gap: 24px; }
        .vault-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 4px solid var(--border-color, #ffcc00); padding-bottom: 16px; }
        .vault-header h1 { font-family: var(--font-pixel); font-size: 32px; line-height: 1; margin-bottom: 4px; color: var(--text-primary, #ffcc00); }
        .vault-header p { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted, #b38f00); }
        .vault-id { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); padding: 4px 12px; font-family: var(--font-mono); font-weight: 700; font-size: 12px; }

        .vault-tabs { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .vault-tabs button {
          background: transparent; border: 2px solid var(--border-color, #ffcc00); padding: 12px 24px; font-weight: 700; font-size: 14px; cursor: pointer; color: var(--text-primary, #ffcc00);
        }
        .vault-tabs button.active { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); transform: translate(2px, 2px); }
        .vault-tabs button:hover:not(.active) { background: var(--bg-secondary, #252525); }

        .overview-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
        
        .security-card, .emergency-card { 
          grid-column: span 2; background: var(--bg-secondary); border: 2px solid var(--border-color, #ffcc00); padding: 20px;
        }
        .card-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; margin-bottom: 16px; color: var(--text-primary, #ffcc00); }
        
        .checklist { display: flex; flex-direction: column; gap: 8px; }
        .check-item { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--text-primary, #ffcc00); }
        
        .controls-row { display: flex; gap: 12px; }
        .btn-danger { 
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; 
          background: var(--bg-card, #2a2a2a); border: 2px solid var(--accent-red); color: var(--accent-red); 
          padding: 12px; font-weight: 700; font-size: 12px; cursor: pointer; transition: all 0.1s;
        }
        .btn-danger:hover { background: var(--accent-red); color: white; border-color: black; }

        .config-grid { max-width: 600px; }
        .section-block h3 { font-family: var(--font-pixel); font-size: 18px; margin-bottom: 8px; color: var(--text-primary, #ffcc00); }
        .section-block p { font-size: 13px; color: var(--text-secondary); margin-bottom: 24px; }
        .limits-list { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
        .info-box { 
          display: flex; align-items: center; gap: 8px; padding: 12px; 
          background: rgba(245, 158, 11, 0.1); border: 1px solid var(--accent-amber); 
          color: var(--accent-amber); font-size: 11px; font-weight: 700; 
        }

        .add-vendor-section { background: var(--bg-secondary); border: 2px solid var(--border-color, #ffcc00); padding: 20px; margin-bottom: 24px; }
        .add-vendor-section h3 { font-family: var(--font-pixel); font-size: 14px; margin-bottom: 16px; color: var(--text-primary, #ffcc00); }
        .add-form { display: flex; gap: 12px; }
        .add-form input { flex: 1; padding: 12px; border: 2px solid var(--border-color, #ffcc00); font-size: 12px; background: var(--bg-secondary, #252525); color: var(--text-primary, #ffcc00); }
        .add-form input::placeholder { color: var(--text-muted, #b38f00); }
        .add-form .mono-input { font-family: var(--font-mono); }
        .add-btn { 
          background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); border: none; padding: 0 24px; 
          font-weight: 700; display: flex; align-items: center; gap: 6px; cursor: pointer; 
        }

        .vendors-lists { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .list-col h4 { font-size: 12px; font-weight: 700; margin-bottom: 12px; color: var(--text-muted, #b38f00); }
        .empty { padding: 20px; text-align: center; border: 2px dashed var(--text-muted, #b38f00); font-size: 12px; color: var(--text-muted, #b38f00); }

        .settings-form { display: flex; flex-direction: column; gap: 20px; margin-bottom: 24px; }
        .setting-row { display: flex; flex-direction: column; gap: 8px; }
        .setting-row label { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 12px; color: var(--text-primary, #ffcc00); }
        .setting-row .input-group { display: flex; border: 2px solid var(--border-color, #ffcc00); }
        .setting-row .input-group input { 
          flex: 1; padding: 12px; border: none; outline: none; background: var(--bg-secondary, #252525); color: var(--text-primary, #ffcc00); 
          font-family: var(--font-mono); font-size: 16px; font-weight: 600;
        }
        .setting-row .input-group .unit { 
          padding: 12px 16px; background: var(--bg-secondary, #252525); border-left: 2px solid var(--border-color, #ffcc00); 
          font-weight: 700; font-size: 12px; display: flex; align-items: center; color: var(--text-primary, #ffcc00);
        }
        .setting-row .hint { font-size: 10px; color: var(--text-muted, #b38f00); }

        .timelock-presets { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; }
        .preset-label { font-size: 10px; font-weight: 700; color: var(--text-muted, #b38f00); }
        .preset-btn { 
          padding: 6px 12px; border: 2px solid var(--border-color, #ffcc00); background: var(--bg-card, #2a2a2a); 
          font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.1s; color: var(--text-primary, #ffcc00);
        }
        .preset-btn:hover { background: var(--bg-secondary, #252525); }
        .preset-btn.active { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); }

        .save-btn { 
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 16px; background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); border: 2px solid var(--border-color, #ffcc00);
          font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.1s; margin-top: 8px;
        }
        .save-btn:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 4px 4px 0px 0px rgba(0,0,0,0.2); }
        .save-btn:disabled { background: #ccc; border-color: #ccc; cursor: not-allowed; }

        .error-msg { 
          display: flex; align-items: center; gap: 8px; padding: 12px; 
          background: rgba(255, 59, 48, 0.15); border: 2px solid var(--accent-red); color: var(--accent-red);
          font-size: 12px; font-weight: 700;
        }
        .success-msg { 
          display: flex; align-items: center; gap: 8px; padding: 12px; 
          background: rgba(0, 204, 102, 0.15); border: 2px solid var(--accent-emerald); color: var(--accent-emerald);
          font-size: 12px; font-weight: 700;
        }

        .info-box { 
          display: flex; align-items: flex-start; gap: 12px; padding: 16px; 
          background: rgba(245, 158, 11, 0.1); border: 2px solid var(--accent-amber); 
          font-size: 12px; line-height: 1.5; color: var(--text-primary, #ffcc00);
        }
        .info-box strong { font-weight: 700; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @media (max-width: 1024px) {
          .overview-grid { grid-template-columns: 1fr 1fr; }
          .vendors-lists { grid-template-columns: 1fr; }
          .add-form { flex-direction: column; }
          .timelock-presets { flex-wrap: wrap; }
        }

        @media (max-width: 768px) {
          .vault-stats { padding: 16px; gap: 16px; }
          .overview-grid { grid-template-columns: 1fr; gap: 12px; }
          .stat-box { padding: 16px; }
          .stat-box .value { font-size: 20px; }
          .section-card { padding: 16px; }
          .section-header { flex-direction: column; align-items: flex-start; gap: 8px; }
          .setting-row { flex-direction: column; gap: 12px; }
          .setting-row .input-group { width: 100%; }
          .add-form input { font-size: 14px; }
          .vault-tabs button { padding: 10px 16px; font-size: 12px; }
        }

        @media (max-width: 480px) {
          .vault-stats { padding: 12px; gap: 12px; }
          .stat-box { padding: 12px; }
          .stat-box .value { font-size: 18px; }
          .stat-box .label { font-size: 10px; }
          .section-title { font-size: 12px; }
          .timelock-presets { gap: 6px; }
          .preset-btn { padding: 4px 8px; font-size: 10px; }
          .vendor-item { flex-direction: column; align-items: flex-start; gap: 8px; }
          .vendor-item .actions { width: 100%; justify-content: flex-end; }
          .vault-header { flex-direction: column; align-items: flex-start; gap: 12px; }
          .vault-tabs { gap: 8px; }
          .vault-tabs button { padding: 8px 12px; font-size: 11px; }
        }
      `}</style>
    </div>
  );
}
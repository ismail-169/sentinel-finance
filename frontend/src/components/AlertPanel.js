import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, AlertCircle, Info, CheckCircle, Bell,
  X, Clock, Shield, ChevronRight, Filter, Search,
  ExternalLink, Eye, EyeOff, Trash2, CheckCheck, RefreshCw,
  Calendar, PiggyBank, Repeat, Play
} from 'lucide-react';
import sentinelLogo from '../sentinel-logo.png';

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    color: 'var(--accent-red)',
    bg: 'rgba(255, 59, 48, 0.15)',
    label: 'CRITICAL'
  },
  high: {
    icon: AlertCircle,
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.15)',
    label: 'HIGH'
  },
  medium: {
    icon: Info,
    color: 'var(--accent-amber)',
    bg: 'rgba(255, 204, 0, 0.15)',
    label: 'MEDIUM'
  },
  low: {
    icon: CheckCircle,
    color: 'var(--accent-emerald)',
    bg: 'rgba(0, 204, 102, 0.15)',
    label: 'LOW'
  },
  schedule: {
    icon: Calendar,
    color: '#60a5fa',
    bg: 'rgba(96, 165, 250, 0.15)',
    label: 'SCHEDULE'
  },
  savings: {
    icon: PiggyBank,
    color: '#a855f7',
    bg: 'rgba(168, 85, 247, 0.15)',
    label: 'SAVINGS'
  }
};

const AlertCard = ({ alert, onAcknowledge, onDismiss, onView, onExecute }) => {
  const [expanded, setExpanded] = useState(false);
  const config = severityConfig[alert.severity] || severityConfig.medium;
  const Icon = config.icon;

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'JUST NOW';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}M AGO`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}H AGO`;
    return date.toLocaleDateString();
  };

  return (
    <motion.div
      className={`alert-card ${alert.severity} ${alert.acknowledged ? 'acknowledged' : ''}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      layout
    >
      <div className="alert-strip" style={{ background: config.color }} />
      
      <div className="alert-content">
        <div className="alert-header">
          <div className="badge-group">
            <div className="severity-badge" style={{ background: config.color, color: 'white' }}>
              <Icon size={12} strokeWidth={3} />
              {config.label}
            </div>
            <span className="alert-time">
              <Clock size={12} />
              {formatTime(alert.timestamp)}
            </span>
          </div>

          <div className="alert-actions">
            {/* Execute button for schedule alerts */}
            {alert.severity === 'schedule' && alert.scheduleData && onExecute && (
              <button 
                className="action-btn execute"
                onClick={(e) => { e.stopPropagation(); onExecute(alert.scheduleData); }}
                title="Execute Now"
              >
                <Play size={14} />
              </button>
            )}
            {!alert.acknowledged && onAcknowledge && (
              <button 
                className="action-btn ack"
                onClick={(e) => { e.stopPropagation(); onAcknowledge(alert.id); }}
                title="Acknowledge"
              >
                <CheckCircle size={14} />
              </button>
            )}
            {onDismiss && (
              <button 
                className="action-btn dismiss"
                onClick={(e) => { e.stopPropagation(); onDismiss(alert.id); }}
                title="Dismiss"
              >
                <X size={14} />
              </button>
            )}
            <button 
              className={`action-btn expand ${expanded ? 'open' : ''}`}
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="alert-main-info">
          <div className="alert-title">{alert.title}</div>
          <div className="alert-message">{alert.message}</div>
        </div>

        <AnimatePresence>
          {expanded && alert.details && (
            <motion.div
              className="alert-details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div className="details-grid">
                {alert.details.vendor && (
                  <div className="detail-item">
                    <span className="label">VENDOR</span>
                    <span className="value">{alert.details.vendor}</span>
                  </div>
                )}
                {alert.details.amount && (
                  <div className="detail-item">
                    <span className="label">AMOUNT</span>
                    <span className="value">{alert.details.amount} MNEE</span>
                  </div>
                )}
                {alert.details.frequency && (
                  <div className="detail-item">
                    <span className="label">FREQUENCY</span>
                    <span className="value">{alert.details.frequency.toUpperCase()}</span>
                  </div>
                )}
                {alert.details.nextDate && (
                  <div className="detail-item">
                    <span className="label">NEXT DATE</span>
                    <span className="value">{alert.details.nextDate}</span>
                  </div>
                )}
                {alert.details.daysLeft !== undefined && (
                  <div className="detail-item">
                    <span className="label">DAYS LEFT</span>
                    <span className="value">{alert.details.daysLeft}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        .alert-card {
          display: flex;
          background: var(--bg-card, #2a2a2a);
          border: 2px solid var(--border-color, #ffcc00);
          overflow: hidden;
          transition: all 0.2s;
        }
        .alert-card:hover { transform: translate(-2px, -2px); box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00); }
        .alert-card.acknowledged { opacity: 0.6; }
        
        .alert-strip { width: 6px; flex-shrink: 0; }
        
        .alert-content { flex: 1; padding: 20px; display: flex; flex-direction: column; gap: 12px; }

        .alert-header { display: flex; justify-content: space-between; align-items: flex-start; }
        
        .badge-group { display: flex; gap: 12px; align-items: center; }
        .severity-badge { 
          display: flex; align-items: center; gap: 6px; 
          padding: 4px 8px; 
          font-family: var(--font-pixel); font-size: 10px; 
          border: 2px solid var(--border-color, #ffcc00);
        }
        .alert-time { 
          display: flex; align-items: center; gap: 6px;
          font-family: var(--font-mono); font-size: 10px; color: var(--text-muted, #b38f00); 
        }

        .alert-actions { display: flex; gap: 8px; }
        .action-btn {
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid var(--border-color, #ffcc00);
          background: var(--bg-secondary, #252525);
          cursor: pointer;
          transition: all 0.1s;
          color: var(--text-primary, #ffcc00);
        }
        .action-btn:hover { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); }
        .action-btn.ack:hover { background: var(--accent-emerald); border-color: var(--accent-emerald); color: white; }
        .action-btn.dismiss:hover { background: var(--accent-red); border-color: var(--accent-red); color: white; }
        .action-btn.execute { background: #60a5fa; border-color: #60a5fa; color: white; }
        .action-btn.execute:hover { background: #3b82f6; }
        .action-btn.expand svg { transition: transform 0.2s; }
        .action-btn.expand.open svg { transform: rotate(90deg); }

        .alert-main-info { display: flex; flex-direction: column; gap: 6px; }
        .alert-title { font-family: var(--font-geo); font-size: 16px; font-weight: 700; text-transform: uppercase; color: var(--text-primary, #ffcc00); }
        .alert-message { font-size: 14px; color: var(--text-secondary, #e6b800); line-height: 1.5; }

        .alert-details {
          margin-top: 12px;
          padding-top: 16px;
          border-top: 2px dashed var(--border-color, #ffcc00);
        }

        .details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px; }
        .detail-item { display: flex; flex-direction: column; gap: 4px; }
        .label { font-size: 10px; font-weight: 700; color: var(--text-muted, #b38f00); }
        .value { font-size: 13px; font-weight: 600; color: var(--text-primary, #ffcc00); }
        .value.mono { font-family: var(--font-mono); font-size: 12px; }

        @media (max-width: 600px) {
          .details-grid { grid-template-columns: 1fr; }
          .alert-header { flex-direction: column; gap: 12px; }
          .alert-actions { width: 100%; justify-content: flex-end; }
        }
      `}</style>
    </motion.div>
  );
};

const AlertStats = ({ alerts, scheduleAlerts, savingsAlerts }) => {
  const stats = {
    total: alerts.length + scheduleAlerts.length + savingsAlerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    scheduled: scheduleAlerts.length,
    savings: savingsAlerts.length,
    unacknowledged: alerts.filter(a => !a.acknowledged).length
  };

  return (
    <div className="alert-stats">
      <div className="stat-box">
        <div className="stat-icon"><Bell size={20} /></div>
        <div className="stat-info">
          <span className="stat-val">{stats.total}</span>
          <span className="stat-lbl">TOTAL</span>
        </div>
      </div>
      <div className="stat-box critical">
        <div className="stat-icon"><AlertTriangle size={20} /></div>
        <div className="stat-info">
          <span className="stat-val">{stats.critical}</span>
          <span className="stat-lbl">CRITICAL</span>
        </div>
      </div>
      <div className="stat-box schedule">
        <div className="stat-icon"><Calendar size={20} /></div>
        <div className="stat-info">
          <span className="stat-val">{stats.scheduled}</span>
          <span className="stat-lbl">SCHEDULED</span>
        </div>
      </div>
      <div className="stat-box savings">
        <div className="stat-icon"><PiggyBank size={20} /></div>
        <div className="stat-info">
          <span className="stat-val">{stats.savings}</span>
          <span className="stat-lbl">SAVINGS</span>
        </div>
      </div>

      <style jsx>{`
        .alert-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
        .stat-box {
          background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); padding: 16px;
          display: flex; align-items: center; gap: 16px;
          box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00);
        }
        .stat-icon { opacity: 0.3; color: var(--text-primary, #ffcc00); }
        .stat-info { display: flex; flex-direction: column; }
        .stat-val { font-family: var(--font-pixel); font-size: 24px; line-height: 1; color: var(--text-primary, #ffcc00); }
        .stat-lbl { font-size: 10px; font-weight: 700; color: var(--text-muted, #b38f00); }
        
        .stat-box.critical { border-color: var(--accent-red); }
        .stat-box.critical .stat-val { color: var(--accent-red); }
        .stat-box.critical .stat-icon { color: var(--accent-red); }
        
        .stat-box.schedule { border-color: #60a5fa; }
        .stat-box.schedule .stat-val { color: #60a5fa; }
        .stat-box.schedule .stat-icon { color: #60a5fa; }
        
        .stat-box.savings { border-color: #a855f7; }
        .stat-box.savings .stat-val { color: #a855f7; }
        .stat-box.savings .stat-icon { color: #a855f7; }

        @media (max-width: 768px) { .alert-stats { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
};

export default function AlertPanel({ alerts: propAlerts = [], onAcknowledge, onRefresh, account, onExecuteSchedule }) {
  const [alerts, setAlerts] = useState(propAlerts);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAcknowledged, setShowAcknowledged] = useState(true);
  const [loading, setLoading] = useState(false);
  const [scheduleAlerts, setScheduleAlerts] = useState([]);
  const [savingsAlerts, setSavingsAlerts] = useState([]);

  useEffect(() => {
    setAlerts(propAlerts);
  }, [propAlerts]);

  // Load schedule and savings alerts from localStorage
  useEffect(() => {
    const loadAutomationAlerts = () => {
      if (!account) return;

      try {
        const savedSchedules = localStorage.getItem(`sentinel_schedules_${account}`);
        const savedSavings = localStorage.getItem(`sentinel_savings_${account}`);
        
        const schedules = savedSchedules ? JSON.parse(savedSchedules) : [];
        const savings = savedSavings ? JSON.parse(savedSavings) : [];
        
        const now = new Date();
        const newScheduleAlerts = [];
        const newSavingsAlerts = [];

        // Check for due scheduled payments
        schedules.forEach(schedule => {
          const nextDate = new Date(schedule.nextDate);
          const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
          
          if (daysUntil <= 1) {
            newScheduleAlerts.push({
              id: `sched_alert_${schedule.id}`,
              severity: 'schedule',
              title: daysUntil <= 0 ? 'PAYMENT DUE NOW' : 'PAYMENT DUE TOMORROW',
              message: `${schedule.amount} MNEE to ${schedule.vendor} (${schedule.frequency})`,
              timestamp: now.toISOString(),
              acknowledged: false,
              scheduleData: schedule,
              details: {
                vendor: schedule.vendor,
                amount: schedule.amount,
                frequency: schedule.frequency,
                nextDate: schedule.nextDate
              }
            });
          }
        });

        // Check for savings deposits due
        savings.forEach(plan => {
          const nextDeposit = new Date(plan.nextDeposit);
          const daysUntilDeposit = Math.ceil((nextDeposit - now) / (1000 * 60 * 60 * 24));
          const daysUntilUnlock = Math.ceil((new Date(plan.unlockDate) - now) / (1000 * 60 * 60 * 24));
          
          if (daysUntilDeposit <= 1) {
            newSavingsAlerts.push({
              id: `save_alert_${plan.id}`,
              severity: 'savings',
              title: daysUntilDeposit <= 0 ? 'SAVINGS DEPOSIT DUE' : 'DEPOSIT DUE TOMORROW',
              message: `${plan.amount} MNEE for "${plan.name}"`,
              timestamp: now.toISOString(),
              acknowledged: false,
              details: {
                vendor: plan.name,
                amount: plan.amount,
                frequency: plan.frequency,
                daysLeft: daysUntilUnlock
              }
            });
          }

          // Alert when savings plan is about to unlock
          if (daysUntilUnlock <= 7 && daysUntilUnlock > 0) {
            newSavingsAlerts.push({
              id: `unlock_alert_${plan.id}`,
              severity: 'savings',
              title: 'SAVINGS UNLOCKING SOON',
              message: `"${plan.name}" unlocks in ${daysUntilUnlock} days - ${plan.totalSaved.toFixed(0)} MNEE`,
              timestamp: now.toISOString(),
              acknowledged: false,
              details: {
                vendor: plan.name,
                amount: plan.totalSaved,
                daysLeft: daysUntilUnlock
              }
            });
          }
        });

        setScheduleAlerts(newScheduleAlerts);
        setSavingsAlerts(newSavingsAlerts);
      } catch (e) {
        console.error('Error loading automation alerts:', e);
      }
    };

    loadAutomationAlerts();
    const interval = setInterval(loadAutomationAlerts, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [account]);

  // Combine all alerts
  const allAlerts = [...alerts, ...scheduleAlerts, ...savingsAlerts];

  const filteredAlerts = allAlerts.filter(alert => {
    const matchesFilter = filter === 'all' || alert.severity === filter;
    const matchesSearch = !searchTerm || 
      alert.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.message?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAck = showAcknowledged || !alert.acknowledged;
    return matchesFilter && matchesSearch && matchesAck;
  });

  const handleAcknowledge = async (id) => {
    // Check if it's a schedule or savings alert
    if (id.startsWith('sched_alert_') || id.startsWith('save_alert_') || id.startsWith('unlock_alert_')) {
      setScheduleAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
      setSavingsAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
      return;
    }

    if (onAcknowledge) {
      const success = await onAcknowledge(id);
      if (success) {
        setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
      }
    } else {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    }
  };

  const handleDismiss = (id) => {
    if (id.startsWith('sched_alert_') || id.startsWith('save_alert_') || id.startsWith('unlock_alert_')) {
      setScheduleAlerts(prev => prev.filter(a => a.id !== id));
      setSavingsAlerts(prev => prev.filter(a => a.id !== id));
      return;
    }
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleAcknowledgeAll = async () => {
    for (const alert of allAlerts.filter(a => !a.acknowledged)) {
      await handleAcknowledge(alert.id);
    }
  };

  const handleClearAll = () => {
    setAlerts(prev => prev.filter(a => !a.acknowledged));
    setScheduleAlerts(prev => prev.filter(a => !a.acknowledged));
    setSavingsAlerts(prev => prev.filter(a => !a.acknowledged));
  };

  const handleRefresh = async () => {
    if (onRefresh) {
      setLoading(true);
      await onRefresh();
      setLoading(false);
    }
  };

  return (
    <div className="alert-panel-container">
      <div className="panel-header">
        <div>
          <h1>SECURITY ALERTS</h1>
          <p>AI-POWERED THREAT DETECTION & AUTOMATION MONITOR</p>
        </div>
        <div className="header-actions">
          {onRefresh && (
            <button className="btn-action" onClick={handleRefresh} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              REFRESH
            </button>
          )}
          <button className="btn-action" onClick={handleAcknowledgeAll}>
            <CheckCheck size={14} />
            ACK ALL
          </button>
          <button className="btn-action danger" onClick={handleClearAll}>
            <Trash2 size={14} />
            CLEAR
          </button>
        </div>
      </div>

      <AlertStats alerts={alerts} scheduleAlerts={scheduleAlerts} savingsAlerts={savingsAlerts} />

      <div className="control-bar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="SEARCH LOGS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          {['all', 'critical', 'high', 'medium', 'low', 'schedule', 'savings'].map(severity => (
            <button
              key={severity}
              className={`filter-btn ${filter === severity ? 'active' : ''} ${severity}`}
              onClick={() => setFilter(severity)}
            >
              {severity === 'all' ? 'ALL' : severityConfig[severity]?.label || severity.toUpperCase()}
            </button>
          ))}
        </div>

        <label className="toggle-box">
          <input
            type="checkbox"
            checked={showAcknowledged}
            onChange={(e) => setShowAcknowledged(e.target.checked)}
          />
          <span>SHOW ACKNOWLEDGED</span>
        </label>
      </div>

      <div className="alerts-list">
        <AnimatePresence>
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onAcknowledge={handleAcknowledge}
                onDismiss={handleDismiss}
                onView={() => {}}
                onExecute={onExecuteSchedule}
              />
            ))
          ) : (
          <motion.div 
  className="empty-state"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
>
  <img 
    src={sentinelLogo} 
    alt="Nominal" 
    className="site-logo" 
    style={{ height: '48px', marginBottom: '16px', opacity: 0.5 }} 
  />
  <h3>ALL SYSTEMS NOMINAL</h3>
            <p>No alerts match your current filters</p>
          </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        .alert-panel-container { max-width: 1000px; margin: 0 auto; }
        
        .panel-header { 
          display: flex; justify-content: space-between; align-items: flex-end; 
          margin-bottom: 32px; border-bottom: 4px solid var(--border-color, #ffcc00); padding-bottom: 24px;
        }
        .panel-header h1 { font-family: var(--font-pixel); font-size: 32px; line-height: 1; margin-bottom: 8px; color: var(--text-primary, #ffcc00); }
        .panel-header p { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted, #b38f00); letter-spacing: 1px; }

        .header-actions { display: flex; gap: 12px; }
        .btn-action {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 16px;
          background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-pixel); font-size: 10px;
          cursor: pointer; transition: all 0.1s;
          color: var(--text-primary, #ffcc00);
        }
        .btn-action:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00); }
        .btn-action.danger:hover { background: var(--accent-red); color: white; border-color: var(--accent-red); }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .control-bar { 
          display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin-bottom: 24px; 
          background: var(--bg-secondary, #252525); border: 2px solid var(--border-color, #ffcc00); padding: 16px;
        }

        .search-box {
          flex: 1; min-width: 200px;
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00);
          color: var(--text-primary, #ffcc00);
        }
        .search-box input { border: none; outline: none; width: 100%; font-family: var(--font-mono); font-size: 12px; background: transparent; color: var(--text-primary, #ffcc00); }
        .search-box input::placeholder { color: var(--text-muted, #b38f00); }

        .filter-group { display: flex; flex-wrap: wrap; gap: -2px; }
        .filter-btn {
          padding: 8px 12px; background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-pixel); font-size: 9px; cursor: pointer; margin-right: -2px;
          color: var(--text-primary, #ffcc00);
        }
        .filter-btn:hover { background: var(--bg-secondary, #252525); z-index: 1; }
        .filter-btn.active { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); z-index: 2; }
        .filter-btn.schedule.active { background: #60a5fa; border-color: #60a5fa; }
        .filter-btn.savings.active { background: #a855f7; border-color: #a855f7; }

        .toggle-box { display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 700; cursor: pointer; color: var(--text-primary, #ffcc00); }
        .toggle-box input { width: 16px; height: 16px; accent-color: var(--border-color, #ffcc00); }

        .alerts-list { display: flex; flex-direction: column; gap: 16px; }

        .empty-state {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 60px; background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); border-style: dashed;
          color: var(--text-muted, #b38f00);
        }
        .empty-state h3 { font-family: var(--font-pixel); font-size: 18px; margin: 16px 0 8px; color: var(--text-primary, #ffcc00); }

        @media (max-width: 768px) {
          .panel-header { flex-direction: column; align-items: flex-start; gap: 16px; }
          .panel-header h1 { font-size: 24px; }
          .control-bar { flex-direction: column; align-items: stretch; }
          .filter-group { overflow-x: auto; padding-bottom: 4px; flex-wrap: nowrap; }
          .filter-btn { flex-shrink: 0; }
          .header-actions { flex-wrap: wrap; }
        }

        @media (max-width: 480px) {
          .panel-header h1 { font-size: 20px; }
          .btn-action { padding: 8px 12px; font-size: 9px; }
          .filter-btn { padding: 6px 10px; font-size: 8px; }
        }
      `}</style>
    </div>
  );
}
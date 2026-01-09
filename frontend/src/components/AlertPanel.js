import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, AlertCircle, Info, CheckCircle, Bell,
  X, Clock, Shield, ChevronRight, Filter, Search,
  ExternalLink, Eye, EyeOff, Trash2, CheckCheck, RefreshCw
} from 'lucide-react';

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
  }
};

const AlertCard = ({ alert, onAcknowledge, onDismiss, onView }) => {
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
            {!alert.acknowledged && onAcknowledge && (
              <button 
                className="action-btn ack"
                onClick={(e) => { e.stopPropagation(); onAcknowledge(alert.id); }}
                title="ACKNOWLEDGE"
              >
                <CheckCheck size={14} />
              </button>
            )}
            <button 
              className={`action-btn expand ${expanded ? 'open' : ''}`}
              onClick={() => setExpanded(!expanded)}
              title="DETAILS"
            >
              <ChevronRight size={14} />
            </button>
            {onDismiss && (
              <button 
                className="action-btn dismiss"
                onClick={(e) => { e.stopPropagation(); onDismiss(alert.id); }}
                title="DISMISS"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="alert-main-info">
          <h4 className="alert-title">{alert.title}</h4>
          <p className="alert-message">{alert.message}</p>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              className="alert-details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div className="details-grid">
                <div className="detail-item">
                  <span className="label">TRANSACTION ID</span>
                  <span className="value mono">#{alert.transactionId || 'N/A'}</span>
                </div>
                {alert.riskScore && (
                  <div className="detail-item">
                    <span className="label">RISK SCORE</span>
                    <span className="value">{alert.riskScore}/100</span>
                  </div>
                )}
                {alert.agent && (
                  <div className="detail-item">
                    <span className="label">AGENT</span>
                    <span className="value mono">{alert.agent}</span>
                  </div>
                )}
                {alert.vendor && (
                  <div className="detail-item">
                    <span className="label">VENDOR</span>
                    <span className="value mono">{alert.vendor}</span>
                  </div>
                )}
              </div>

              {alert.recommendations && (
                <div className="recommendation-box">
                  <span className="label">RECOMMENDED ACTION</span>
                  <p>{alert.recommendations}</p>
                </div>
              )}

              {onView && (
                <div className="detail-footer">
                  <button className="view-tx-btn" onClick={() => onView(alert)}>
                    <Eye size={14} />
                    VIEW TRANSACTION
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        .alert-card {
          background: var(--bg-card, #2a2a2a);
          border: 2px solid var(--border-color, #ffcc00);
          margin-bottom: 16px;
          display: flex;
          box-shadow: 4px 4px 0px 0px rgba(255, 204, 0, 0.3);
          transition: all 0.2s;
        }
        .alert-card:hover {
          transform: translate(-2px, -2px);
          box-shadow: 6px 6px 0px 0px var(--border-color, #ffcc00);
        }
        .alert-card.acknowledged { opacity: 0.6; }
        .alert-card.acknowledged:hover { opacity: 1; }

        .alert-strip { width: 8px; flex-shrink: 0; border-right: 2px solid var(--border-color, #ffcc00); }
        
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
        .action-btn.ack:hover { background: var(--accent-emerald); border-color: var(--accent-emerald); }
        .action-btn.dismiss:hover { background: var(--accent-red); border-color: var(--accent-red); color: white; }
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

        .recommendation-box {
          background: var(--bg-secondary, #252525);
          border: 2px solid var(--border-color, #ffcc00);
          padding: 12px;
          margin-bottom: 16px;
        }
        .recommendation-box p { font-size: 13px; margin-top: 4px; color: var(--text-secondary, #e6b800); }

        .view-tx-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 16px;
          background: var(--bg-secondary, #252525); border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-pixel); font-size: 10px;
          cursor: pointer;
          color: var(--text-primary, #ffcc00);
        }
        .view-tx-btn:hover { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); }

        @media (max-width: 600px) {
          .details-grid { grid-template-columns: 1fr; }
          .alert-header { flex-direction: column; gap: 12px; }
          .alert-actions { width: 100%; justify-content: flex-end; }
        }
      `}</style>
    </motion.div>
  );
};

const AlertStats = ({ alerts }) => {
  const stats = {
    total: alerts.length,
    critical: alerts.filter(a => a.severity === 'critical').length,
    unacknowledged: alerts.filter(a => !a.acknowledged).length,
    today: alerts.filter(a => {
      const alertDate = new Date(a.timestamp);
      const today = new Date();
      return alertDate.toDateString() === today.toDateString();
    }).length
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
      <div className="stat-box warning">
        <div className="stat-icon"><EyeOff size={20} /></div>
        <div className="stat-info">
          <span className="stat-val">{stats.unacknowledged}</span>
          <span className="stat-lbl">PENDING</span>
        </div>
      </div>
      <div className="stat-box info">
        <div className="stat-icon"><Clock size={20} /></div>
        <div className="stat-info">
          <span className="stat-val">{stats.today}</span>
          <span className="stat-lbl">TODAY</span>
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
        
        .stat-box.warning { border-color: var(--accent-amber); }
        .stat-box.warning .stat-val { color: var(--accent-amber); }

        @media (max-width: 768px) { .alert-stats { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
};

export default function AlertPanel({ alerts: propAlerts = [], onAcknowledge, onRefresh }) {
  const [alerts, setAlerts] = useState(propAlerts);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAcknowledged, setShowAcknowledged] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAlerts(propAlerts);
  }, [propAlerts]);

  const filteredAlerts = alerts.filter(alert => {
    const matchesFilter = filter === 'all' || alert.severity === filter;
    const matchesSearch = !searchTerm || 
      alert.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.message?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAck = showAcknowledged || !alert.acknowledged;
    return matchesFilter && matchesSearch && matchesAck;
  });

  const handleAcknowledge = async (id) => {
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
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleAcknowledgeAll = async () => {
    for (const alert of alerts.filter(a => !a.acknowledged)) {
      await handleAcknowledge(alert.id);
    }
  };

  const handleClearAll = () => {
    setAlerts(prev => prev.filter(a => !a.acknowledged));
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
          <p>AI-POWERED THREAT DETECTION MONITOR</p>
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

      <AlertStats alerts={alerts} />

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
          {['all', 'critical', 'high', 'medium', 'low'].map(severity => (
            <button
              key={severity}
              className={`filter-btn ${filter === severity ? 'active' : ''}`}
              onClick={() => setFilter(severity)}
            >
              {severity === 'all' ? 'ALL' : severityConfig[severity]?.label || severity}
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
              />
            ))
          ) : (
            <motion.div 
              className="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Shield size={48} strokeWidth={1} />
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

        .filter-group { display: flex; gap: -2px; }
        .filter-btn {
          padding: 8px 16px; background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-pixel); font-size: 10px; cursor: pointer; margin-right: -2px;
          color: var(--text-primary, #ffcc00);
        }
        .filter-btn:hover { background: var(--bg-secondary, #252525); z-index: 1; }
        .filter-btn.active { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); z-index: 2; }

        .toggle-box { display: flex; align-items: center; gap: 8px; font-size: 10px; font-weight: 700; cursor: pointer; color: var(--text-primary, #ffcc00); }
        .toggle-box input { width: 16px; height: 16px; accent-color: var(--border-color, #ffcc00); }

        .empty-state {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 60px; background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); border-style: dashed;
          color: var(--text-muted, #b38f00);
        }
        .empty-state h3 { font-family: var(--font-pixel); font-size: 18px; margin: 16px 0 8px; color: var(--text-primary, #ffcc00); }

        @media (max-width: 768px) {
          .panel-header { flex-direction: column; align-items: flex-start; gap: 16px; }
          .control-bar { flex-direction: column; align-items: stretch; }
          .filter-group { overflow-x: auto; padding-bottom: 4px; }
        }
      `}</style>
    </div>
  );
}
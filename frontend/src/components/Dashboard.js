import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, TrendingUp, Clock, AlertTriangle, 
  CheckCircle, XCircle, Activity, Zap, RefreshCw,
  ArrowUpRight, ArrowDownRight, DollarSign, Users,
  Wallet, Loader, Calendar, PiggyBank, Repeat, Lock, Bot  
} from 'lucide-react';
import sentinelLogo from '../sentinel-logo.png';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const StatCard = ({ title, value, subtitle, icon: Icon, trend, trendValue, color, delay }) => (
  <motion.div 
    className="stat-card"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
  >
    <div className={`geo-badge ${color}`}></div>
    <div className="stat-content">
      <div className="stat-label">{title}</div>
      <div className="stat-value">{value}</div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
    </div>
   <div className="stat-icon-box">
      {title === "PROTOCOL SECURITY" ? (
        <img src={sentinelLogo} alt="Logo" className="site-logo" style={{ height: '24px' }} />
      ) : (
        <Icon size={24} strokeWidth={1.5} />
      )}
    </div>
    {trend && (
      <div className={`trend-badge ${trend}`}>
        {trend === 'up' ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>} 
        {trendValue}
      </div>
    )}
    
    <style jsx>{`
      .stat-card {
        position: relative;
        background: var(--bg-card, #2a2a2a);
        border: 2px solid var(--border-color, #ffcc00);
        padding: 24px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        box-shadow: 4px 4px 0px 0px rgba(255, 204, 0, 0.3);
        transition: transform 0.2s;
        overflow: hidden;
      }
      .stat-card:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0px 0px var(--border-color, #ffcc00); }
      
      .geo-badge {
        position: absolute; top: 0; left: 0; width: 0; height: 0; border-style: solid;
      }
      .geo-badge.blue { border-width: 20px 20px 0 0; border-color: var(--accent-blue) transparent transparent transparent; }
      .geo-badge.purple { border-width: 20px 20px 0 0; border-color: var(--accent-purple) transparent transparent transparent; }
      .geo-badge.cyan { border-width: 20px 20px 0 0; border-color: var(--accent-cyan) transparent transparent transparent; }
      .geo-badge.amber { border-width: 20px 20px 0 0; border-color: var(--accent-amber) transparent transparent transparent; }

      .stat-content { display: flex; flex-direction: column; gap: 8px; z-index: 2; }
      .stat-label { font-size: 10px; font-weight: 700; color: var(--text-muted, #b38f00); text-transform: uppercase; letter-spacing: 1px; }
      .stat-value { font-family: var(--font-pixel); font-size: 24px; line-height: 1.1; color: var(--text-primary, #ffcc00); }
      .stat-subtitle { font-size: 11px; font-family: var(--font-mono); color: var(--text-secondary, #e6b800); }
      
      .stat-icon-box { opacity: 0.2; position: absolute; right: 10px; top: 10px; color: var(--text-primary, #ffcc00); }
      
      .trend-badge {
        position: absolute; bottom: 12px; right: 12px;
        font-size: 10px; font-weight: 700; display: flex; align-items: center; gap: 4px;
        padding: 2px 6px; border: 1px solid var(--border-color, #ffcc00); background: var(--bg-secondary, #252525);
      }
      .trend-badge.up { color: var(--accent-emerald); border-color: var(--accent-emerald); }
      .trend-badge.down { color: var(--accent-red); border-color: var(--accent-red); }
    `}</style>
  </motion.div>
);

const RiskMeter = ({ score }) => {
  const getColor = () => {
    if (score < 30) return 'var(--accent-emerald)';
    if (score < 60) return 'var(--accent-amber)';
    return 'var(--accent-red)';
  };

  const getLabel = () => {
    if (score < 30) return 'LOW RISK';
    if (score < 60) return 'MED RISK';
    return 'HIGH RISK';
  };

  return (
    <div className="risk-meter">
      <div className="risk-header">
        <span>SYSTEM THREAT LEVEL</span>
        <span style={{ color: getColor(), fontWeight: 700 }}>{getLabel()}</span>
      </div>
      <div className="risk-track">
        <motion.div 
          className="risk-fill"
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ background: getColor() }}
        />
        {[25, 50, 75].map(tick => (
          <div key={tick} className="tick" style={{ left: `${tick}%` }} />
        ))}
      </div>
      <div className="risk-labels">
        <span>NOMINAL</span>
        <span>ELEVATED</span>
        <span>CRITICAL</span>
      </div>
      
      <style jsx>{`
        .risk-meter { margin-top: 8px; }
        .risk-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 11px; font-weight: 700; color: var(--text-muted, #b38f00); }
        .risk-track { 
          position: relative; height: 24px; border: 2px solid var(--border-color, #ffcc00); 
          background-image: linear-gradient(45deg, var(--bg-secondary, #252525) 25%, transparent 25%, transparent 50%, var(--bg-secondary, #252525) 50%, var(--bg-secondary, #252525) 75%, transparent 75%, transparent);
          background-size: 10px 10px;
        }
        .risk-fill { height: 100%; border-right: 2px solid var(--border-color, #ffcc00); }
        .tick { position: absolute; top: 0; bottom: 0; width: 2px; background: rgba(255, 204, 0, 0.3); }
        .risk-labels { display: flex; justify-content: space-between; margin-top: 8px; font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--text-muted, #b38f00); }
      `}</style>
    </div>
  );
};


const AutomationSummary = ({ schedules, savingsPlans }) => {
  const nextSchedule = schedules.length > 0 
    ? schedules.reduce((nearest, s) => new Date(s.nextDate) < new Date(nearest.nextDate) ? s : nearest)
    : null;
  
  const totalLockedSavings = savingsPlans.reduce((sum, p) => sum + (p.totalSaved || 0), 0);
  const totalScheduledMonthly = schedules
    .filter(s => s.frequency === 'monthly')
    .reduce((sum, s) => sum + s.amount, 0);

  const hasAutomations = schedules.length > 0 || savingsPlans.length > 0;

  if (!hasAutomations) return null;

  return (
    <motion.div 
      className="automation-summary"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
    >
      <div className="auto-header">
        <div className="auto-title">
          <Calendar size={16} />
          <span>AI AUTOMATION STATUS</span>
        </div>
        <div className="live-indicator">
          <span className="pulse-dot"></span>
          ACTIVE
        </div>
      </div>
      
      <div className="auto-grid">
        <div className="auto-stat">
          <Repeat size={18} />
          <div className="auto-stat-content">
            <span className="auto-val">{schedules.length}</span>
            <span className="auto-label">SCHEDULED</span>
          </div>
        </div>
        
        <div className="auto-stat">
          <PiggyBank size={18} />
          <div className="auto-stat-content">
            <span className="auto-val">{savingsPlans.length}</span>
            <span className="auto-label">SAVINGS PLANS</span>
          </div>
        </div>
        
        <div className="auto-stat">
          <Lock size={18} />
          <div className="auto-stat-content">
            <span className="auto-val">{totalLockedSavings.toFixed(0)}</span>
            <span className="auto-label">LOCKED MNEE</span>
          </div>
        </div>
        
        <div className="auto-stat">
          <TrendingUp size={18} />
          <div className="auto-stat-content">
            <span className="auto-val">{totalScheduledMonthly}</span>
            <span className="auto-label">MNEE/MONTH</span>
          </div>
        </div>
      </div>
      
      {nextSchedule && (
        <div className="next-payment-alert">
          <Clock size={12} />
          <span>NEXT PAYMENT: <strong>{nextSchedule.amount} MNEE</strong> → {nextSchedule.vendor} on {nextSchedule.nextDate}</span>
        </div>
      )}

      <style jsx>{`
        .automation-summary {
          background: var(--bg-card, #2a2a2a);
          border: 2px solid #60a5fa;
          padding: 20px;
          box-shadow: 4px 4px 0px 0px rgba(96, 165, 250, 0.3);
        }
        
        .auto-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 16px;
          margin-bottom: 16px;
          border-bottom: 2px solid rgba(96, 165, 250, 0.3);
        }
        
        .auto-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font-pixel);
          font-size: 14px;
          color: #60a5fa;
        }
        
        .live-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 12px;
          background: rgba(96, 165, 250, 0.15);
          border: 1px solid #60a5fa;
          font-size: 10px;
          font-weight: 700;
          color: #60a5fa;
        }
        
        .pulse-dot {
          width: 8px;
          height: 8px;
          background: #60a5fa;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        
        .auto-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        
        .auto-stat {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: var(--bg-secondary, #252525);
          border: 1px solid var(--border-color, #ffcc00);
        }
        
        .auto-stat svg {
          color: #60a5fa;
          opacity: 0.8;
        }
        
        .auto-stat-content {
          display: flex;
          flex-direction: column;
        }
        
        .auto-val {
          font-family: var(--font-pixel);
          font-size: 20px;
          color: var(--text-primary, #ffcc00);
          line-height: 1;
        }
        
        .auto-label {
          font-size: 9px;
          font-weight: 700;
          color: var(--text-muted, #b38f00);
          margin-top: 4px;
        }
        
        .next-payment-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 16px;
          padding: 12px 16px;
          background: rgba(96, 165, 250, 0.1);
          border: 1px dashed #60a5fa;
          font-size: 11px;
          color: #60a5fa;
          font-family: var(--font-mono);
        }
        
        .next-payment-alert strong {
          color: var(--text-primary, #ffcc00);
        }

        @media (max-width: 1024px) {
          .auto-grid { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 600px) {
          .auto-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .auto-stat { padding: 10px; gap: 8px; }
          .auto-val { font-size: 16px; }
          .auto-header { flex-direction: column; gap: 10px; align-items: flex-start; }
          .next-payment-alert { font-size: 10px; flex-wrap: wrap; }
        }
      `}</style>
    </motion.div>
  );
};

export default function Dashboard({ vaultData, vaultBalance, transactions = [], account, onRefresh }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [savingsPlans, setSavingsPlans] = useState([]);

 
 useEffect(() => {
    const loadAutomations = () => {
      if (account) {
        try {
          const savedSchedules = localStorage.getItem(`sentinel_schedules_${account}`);
          const savedSavings = localStorage.getItem(`sentinel_savings_${account}`);
          if (savedSchedules) setSchedules(JSON.parse(savedSchedules));
          if (savedSavings) setSavingsPlans(JSON.parse(savedSavings));
        } catch (e) {
          console.error('Error loading automations:', e);
        }
      }
    };

    loadAutomations();
    
   
    const handleSavingsUpdate = (event) => {
      console.log('📊 Dashboard: Received savings update');
      if (event.detail?.plans) {
        setSavingsPlans(event.detail.plans);
      } else {
       
        loadAutomations();
      }
    };
    
    window.addEventListener('savingsUpdated', handleSavingsUpdate);
    
   
    const interval = setInterval(loadAutomations, 10000);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('savingsUpdated', handleSavingsUpdate);
    };
  }, [account]);

  const currentBalance = vaultBalance || vaultData?.balance || '0';
  const dailyLimit = vaultData?.dailyLimit || '0';
  const txCount = vaultData?.totalTransactions || transactions.length || 0;
  
  
  const formatTimeLock = (seconds) => {
    if (!seconds || seconds === 0) return '0 SEC';
    if (seconds < 60) return `${seconds} SEC`;
    if (seconds < 3600) return `${Math.round(seconds / 60)} MIN`;
    return `${(seconds / 3600).toFixed(0)}H`;
  };
  const timeLock = formatTimeLock(vaultData?.timeLockDuration);

  const pendingTxs = transactions.filter(tx => !tx.executed && !tx.revoked);
  const executedTxs = transactions.filter(tx => tx.executed);
  const revokedTxs = transactions.filter(tx => tx.revoked);

  const chartData = transactions.slice(0, 10).reverse().map((tx, i) => ({
    name: `TX ${tx.id}`,
    amount: parseFloat(tx.amount || 0),
    risk: Math.random() * 100
  }));

  const pieData = [
    { name: 'EXECUTED', value: executedTxs.length, color: 'var(--accent-emerald)' },
    { name: 'PENDING', value: pendingTxs.length, color: 'var(--accent-amber)' },
    { name: 'REVOKED', value: revokedTxs.length, color: 'var(--accent-red)' }
  ].filter(d => d.value > 0);

  const avgRiskScore = 25;

  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <div className="dashboard-layout">
      <div className="dash-header">
        <div className="dash-header-top">
          <div>
            <h1>SYSTEM DASHBOARD</h1>
            <p>REAL-TIME VAULT TELEMETRY</p>
          </div>
        </div>
        <div className="header-controls">
          {account && (
            <div className="user-badge">
              <Wallet size={14} />
              <span>ID: {account.slice(0, 6)}...{account.slice(-4)}</span>
            </div>
          )}
          <button 
            className={`refresh-btn ${isRefreshing ? 'refreshing' : ''}`} 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <Loader size={14} className="spin" />
                REFRESHING...
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                REFRESH DATA
              </>
            )}
          </button>
        </div>
      </div>

      <div className="stats-row">
        <StatCard
          title="VAULT BALANCE"
          value={`${parseFloat(currentBalance).toLocaleString()} MNEE`}
          subtitle="AVAILABLE LIQUIDITY"
          icon={DollarSign}
          color="blue"
          delay={0}
        />
        <StatCard
          title="TRANSACTIONS"
          value={txCount}
          subtitle={`${pendingTxs.length} PENDING APPROVAL`}
          icon={Activity}
          trend="up"
          trendValue="+12%"
          color="purple"
          delay={0.1}
        />
        <StatCard
          title="DAILY LIMIT"
          value={parseFloat(dailyLimit).toLocaleString() + ' MNEE'}
          subtitle="24H SPENDING CAP"
          icon={TrendingUp}
          color="cyan"
          delay={0.2}
        />
        <StatCard
          title="TIME LOCK"
          value={timeLock}
          subtitle="UNTRUSTED DELAY"
          icon={Clock}
          color="amber"
          delay={0.3}
        />
      </div>

      {/* Automation Summary - Shows scheduled payments & savings */}
      <AutomationSummary schedules={schedules} savingsPlans={savingsPlans} />

      <div className="main-grid">
        <motion.div 
          className="content-card chart-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <div className="card-header">
            <h3>TRANSACTION VOLUME</h3>
            <div className="tag">LAST 10 TX</div>
          </div>
          {chartData.length > 0 ? (
            <div className="chart-wrapper">
              <ResponsiveContainer>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="amtGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffcc00" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ffcc00" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    stroke="transparent" 
                    tick={{ fill: '#b38f00', fontSize: 10, fontFamily: 'monospace' }}
                  />
                  <YAxis 
                    stroke="transparent" 
                    tick={{ fill: '#b38f00', fontSize: 10, fontFamily: 'monospace' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#2a2a2a',
                      border: '2px solid #ffcc00',
                      fontFamily: 'monospace'
                    }}
                  />
                  <Area 
                    type="stepAfter" 
                    dataKey="amount" 
                    stroke="#ffcc00" 
                    strokeWidth={2}
                    fill="url(#amtGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-chart">NO TRANSACTION DATA</div>
          )}
        </motion.div>

        <motion.div 
          className="content-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <div className="card-header">
            <h3>TX DISTRIBUTION</h3>
            <div className="tag">STATUS</div>
          </div>
          {pieData.length > 0 ? (
            <>
              <div style={{ height: 180 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="var(--bg-primary, #1a1a1a)"
                      strokeWidth={2}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="legend-row">
                {pieData.map(d => (
                  <div key={d.name} className="legend-pill">
                    <div className="dot" style={{ background: d.color }}></div>
                    {d.name}: {d.value}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-chart">NO DATA</div>
          )}
        </motion.div>

        <div className="col-stack">
          <motion.div 
            className="content-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.55 }}
          >
            <div className="card-header">
              <h3>THREAT ANALYSIS</h3>
              <div className="tag live">LIVE</div>
            </div>
            <RiskMeter score={avgRiskScore} />
            <div className="risk-stats-box" style={{ marginTop: 16 }}>
              <div className="rs-row"><Shield size={14}/> HIGH RISK TXS <strong>0</strong></div>
              <div className="rs-row"><AlertTriangle size={14}/> ALERTS TODAY <strong>0</strong></div>
              <div className="rs-row"><Zap size={14}/> UPTIME <strong>99.9%</strong></div>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div 
  className="recent-section"
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, delay: 0.5 }}
>
  <div className="card-header">
    <h3>RECENT ACTIVITY</h3>
    <div style={{ display: 'flex', gap: '8px' }}>
      <span className="tag vault-tag">VAULT</span>
      <span className="tag agent-tag">AGENT</span>
    </div>
  </div>
  <div className="recent-list">
    {transactions.length > 0 ? (
      transactions.slice(0, 8).map((tx) => (
        <div 
          key={tx.id} 
          className={`recent-row ${tx.isAgentTx ? 'agent-tx' : 'vault-tx'}`}
        >
          <div className={`status-icon ${tx.executed ? 'success' : tx.revoked ? 'danger' : 'warn'} ${tx.isAgentTx ? 'agent' : ''}`}>
            {tx.isAgentTx ? (
              <Bot size={14} />
            ) : tx.executed ? (
              <CheckCircle size={14}/>
            ) : tx.revoked ? (
              <XCircle size={14}/>
            ) : (
              <Clock size={14}/>
            )}
          </div>
          <div className="tx-details">
            <div className="tx-type-label">
              {tx.isAgentTx ? (
                <span className="agent-label">{tx.displayLabel || 'AGENT TX'}</span>
              ) : (
                <span className="vault-label">VAULT TX #{tx.id}</span>
              )}
            </div>
            <div className="tx-amt">{parseFloat(tx.amount).toFixed(2)} MNEE</div>
            <div className="tx-to">
              {tx.isAgentTx ? 'TO: ' : 'TO: '}
              {tx.vendor?.slice(0, 10)}...
            </div>
          </div>
          <div className="tx-meta">
            <div className="tx-time">
              {new Date(tx.timestamp * 1000).toLocaleTimeString()}
            </div>
            {tx.txHash && (
              <a 
                href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-link"
              >
                VIEW
              </a>
            )}
          </div>
        </div>
      ))
    ) : (
      <div className="empty-list">NO RECENT TRANSACTIONS</div>
    )}
  </div>
</motion.div>

      <style jsx>{`
        .dashboard-layout { display: flex; flex-direction: column; gap: 32px; }
        .dash-header { 
          display: flex; flex-direction: column; gap: 16px;
          border-bottom: 4px solid var(--border-color, #ffcc00); padding-bottom: 24px; 
        }
        .dash-header-top {
          display: flex; justify-content: space-between; align-items: flex-start;
        }
        .dash-header h1 { font-family: var(--font-pixel); font-size: 32px; margin-bottom: 4px; line-height: 1; color: var(--text-primary, #ffcc00); }
        .dash-header p { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted, #b38f00); letter-spacing: 1px; }

        .header-controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        
        .user-badge {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 16px; background: var(--bg-secondary, #252525); border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--text-primary, #ffcc00);
        }

        .refresh-btn { 
          display: flex; align-items: center; gap: 8px; padding: 12px 20px; 
          background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); 
          font-family: var(--font-pixel); font-size: 12px; 
          cursor: pointer; transition: all 0.1s; color: var(--text-primary, #ffcc00);
          box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00);
        }
        .refresh-btn:hover:not(:disabled) { 
          background: var(--text-primary, #ffcc00); 
          color: var(--bg-primary, #1a1a1a); 
          transform: translate(-2px, -2px); 
          box-shadow: 6px 6px 0px 0px var(--border-color, #ffcc00); 
        }
        .refresh-btn:active:not(:disabled) {
          transform: translate(2px, 2px);
          box-shadow: none;
        }
        .refresh-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .refresh-btn.refreshing {
          background: var(--bg-secondary, #252525);
        }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }

        .main-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px; }
        
        .content-card { background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); padding: 20px; }
        .card-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border-color, #ffcc00); padding-bottom: 12px; margin-bottom: 12px; }
        .card-header h3 { font-family: var(--font-pixel); font-size: 14px; color: var(--text-primary, #ffcc00); }
        .tag { background: var(--text-primary, #ffcc00); color: var(--bg-primary, #1a1a1a); padding: 2px 6px; font-size: 10px; font-weight: 700; }
        .tag.live { background: var(--accent-red); color: white; }

        .chart-wrapper { height: 200px; }
        .empty-chart { height: 100%; display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); color: var(--text-muted, #b38f00); }
        .legend-row { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 12px; }
        .legend-pill { font-size: 10px; display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--text-primary, #ffcc00); }
        .dot { width: 8px; height: 8px; border: 1px solid var(--border-color, #ffcc00); }

        .col-stack { display: flex; flex-direction: column; gap: 20px; }
        .risk-stats-box { background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); padding: 16px; display: flex; flex-direction: column; gap: 12px; }
        .rs-row { display: flex; align-items: center; gap: 8px; font-size: 11px; font-family: var(--font-mono); color: var(--text-secondary, #e6b800); }
        .rs-row strong { margin-left: auto; font-size: 14px; color: var(--text-primary, #ffcc00); }

        .recent-section { background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); padding: 20px; }
        .recent-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
        .recent-row { 
          display: flex; align-items: center; gap: 12px; padding: 12px; 
          border: 1px solid var(--border-color, #ffcc00); background: var(--bg-secondary, #252525); 
        }
        .status-icon { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-color, #ffcc00); background: var(--bg-card, #2a2a2a); }
        .status-icon.success { color: var(--accent-emerald); }
        .status-icon.danger { color: var(--accent-red); }
        .status-icon.warn { color: var(--accent-amber); }
        
        .tx-details { flex: 1; }
        .tx-amt { font-weight: 700; font-size: 14px; color: var(--text-primary, #ffcc00); }
        .tx-to { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted, #b38f00); }
        .tx-time { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted, #b38f00); }
        .empty-list { padding: 20px; width: 100%; text-align: center; color: var(--text-muted, #b38f00); font-size: 12px; }

        @media (max-width: 1200px) {
          .stats-row { grid-template-columns: 1fr 1fr; }
          .main-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 768px) {
          .dashboard-layout { gap: 20px; }
          .dash-header { padding-bottom: 16px; gap: 12px; }
          .dash-header h1 { font-size: 24px; }
          .dash-header p { font-size: 10px; }
          .header-controls { gap: 8px; }
          .user-badge { padding: 8px 12px; font-size: 11px; }
          .refresh-btn { padding: 10px 14px; font-size: 10px; }
          .stats-row { grid-template-columns: 1fr 1fr; gap: 12px; }
          .stat-card { padding: 16px; min-height: auto; }
          .stat-value { font-size: 18px; }
          .stat-label { font-size: 10px; }
          .stat-subtitle { font-size: 9px; }
          .stat-icon-box { width: 32px; height: 32px; }
          .stat-icon-box svg { width: 18px; height: 18px; }
          .chart-card { padding: 16px; }
          .chart-header { flex-direction: column; align-items: flex-start; gap: 8px; }
          .chart-title { font-size: 12px; }
          .chart-wrapper { height: 180px; }
          .recent-list { grid-template-columns: 1fr; gap: 12px; }
          .main-grid { gap: 16px; }
        }

        @media (max-width: 480px) {
          .dashboard-layout { gap: 16px; }
          .dash-header { gap: 10px; padding-bottom: 12px; border-bottom-width: 2px; }
          .dash-header h1 { font-size: 20px; }
          .header-controls { width: 100%; }
          .user-badge { flex: 1; justify-content: center; padding: 8px 10px; font-size: 10px; }
          .refresh-btn { flex: 1; justify-content: center; padding: 8px 10px; font-size: 10px; box-shadow: 2px 2px 0px 0px var(--border-color, #ffcc00); }
          .stats-row { grid-template-columns: 1fr; gap: 10px; }
          .stat-card { 
            padding: 14px; 
            flex-direction: row; 
            align-items: center; 
            justify-content: space-between;
          }
          .stat-content { flex: 1; }
          .stat-icon-box { 
            position: relative; 
            top: auto; 
            right: auto; 
            width: 36px; 
            height: 36px;
            opacity: 0.7;
          }
          .stat-value { font-size: 20px; }
          .stat-label { font-size: 11px; }
          .stat-subtitle { font-size: 9px; }
          .trend-badge { position: absolute; top: 8px; right: 8px; }
          .geo-badge { display: none; }
          .chart-wrapper { height: 150px; }
          .chart-card { padding: 12px; }
          .chart-title { font-size: 11px; }
        }
        .recent-row.agent-tx {
  border-color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
}

.recent-row.vault-tx {
  border-color: var(--border-color, #ffcc00);
  background: var(--bg-secondary, #252525);
}

.status-icon.agent {
  background: #60a5fa;
  border-color: #60a5fa;
  color: white;
}

.status-icon.agent.success {
  background: #60a5fa;
  color: white;
}

.tx-type-label {
  font-size: 9px;
  font-weight: 700;
  margin-bottom: 2px;
}

.agent-label {
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.2);
  padding: 2px 6px;
  border: 1px solid #60a5fa;
}

.vault-label {
  color: var(--text-muted, #b38f00);
}

.tag.vault-tag {
  background: var(--text-primary, #ffcc00);
  color: var(--bg-primary, #1a1a1a);
}

.tag.agent-tag {
  background: #60a5fa;
  color: white;
}

.tx-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.tx-link {
  font-size: 9px;
  color: #60a5fa;
  text-decoration: none;
  font-weight: 700;
}

.tx-link:hover {
  text-decoration: underline;
}
      `}</style>
    </div>
  );
}
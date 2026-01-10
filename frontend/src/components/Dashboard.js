import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, TrendingUp, Clock, AlertTriangle, 
  CheckCircle, XCircle, Activity, Zap, RefreshCw,
  ArrowUpRight, ArrowDownRight, DollarSign, Users,
  Wallet, Loader
} from 'lucide-react';
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
      <Icon size={24} strokeWidth={1.5} />
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

export default function Dashboard({ vaultData, vaultBalance, transactions = [], account, onRefresh }) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentBalance = vaultBalance || vaultData?.balance || '0';
  const dailyLimit = vaultData?.dailyLimit || '0';
  const txCount = vaultData?.totalTransactions || transactions.length || 0;
  
  // Format time lock properly
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
        <div>
          <h1>SYSTEM DASHBOARD</h1>
          <p>REAL-TIME VAULT TELEMETRY</p>
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

      <div className="main-grid">
        <motion.div 
          className="content-card big-chart"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <div className="card-header">
            <h3>TRANSACTION VOLUME</h3>
            <div className="tag">LAST 10 TX</div>
          </div>
          <div style={{ height: 240, width: '100%', marginTop: '20px' }}>
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffcc00" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ffcc00" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="name" 
                  axisLine={{ stroke: '#ffcc00', strokeWidth: 2 }}
                  tickLine={false}
                  tick={{ fill: '#b38f00', fontSize: 10, fontFamily: 'monospace' }}
                />
                <YAxis 
                  axisLine={{ stroke: '#ffcc00', strokeWidth: 2 }}
                  tickLine={false}
                  tick={{ fill: '#b38f00', fontSize: 10, fontFamily: 'monospace' }}
                />
                <Tooltip 
                  contentStyle={{
                    background: '#2a2a2a',
                    border: '2px solid #ffcc00',
                    boxShadow: '4px 4px 0px 0px #ffcc00',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    color: '#ffcc00'
                  }}
                />
                <Area 
                  type="step" 
                  dataKey="amount" 
                  stroke="#ffcc00" 
                  strokeWidth={2}
                  fill="url(#colorAmount)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          className="content-card pie-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <div className="card-header">
            <h3>STATUS RATIO</h3>
          </div>
          <div style={{ height: 200, width: '100%' }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="#ffcc00"
                    strokeWidth={1}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      background: '#2a2a2a',
                      border: '2px solid #ffcc00',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      color: '#ffcc00'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-chart">NO DATA</div>
            )}
          </div>
          <div className="legend-row">
            {pieData.map(d => (
              <div key={d.name} className="legend-pill">
                <div className="dot" style={{ background: d.color }}></div>
                {d.name}
              </div>
            ))}
          </div>
        </motion.div>

        <div className="col-stack">
          <motion.div 
            className="content-card risk-box"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
          >
            <div className="card-header">
              <h3>RISK ANALYSIS</h3>
              <div className="tag live">LIVE</div>
            </div>
            <RiskMeter score={avgRiskScore} />
          </motion.div>

          <motion.div 
            className="risk-stats-box"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.7 }}
          >
            <div className="rs-row">
              <Shield size={14} /> Pending High-Risk <strong>{pendingTxs.filter(tx => (tx.riskScore || 0) > 70).length}</strong>
            </div>
            <div className="rs-row">
              <AlertTriangle size={14} /> Alerts Today <strong>0</strong>
            </div>
            <div className="rs-row">
              <Zap size={14} /> System Uptime <strong>99.9%</strong>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div 
        className="recent-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.8 }}
      >
        <div className="card-header">
          <h3>RECENT ACTIVITY</h3>
          <div className="tag">LAST 5</div>
        </div>
        <div className="recent-list">
          {transactions.length > 0 ? (
            transactions.slice(0, 5).map((tx) => (
              <div key={tx.id} className="recent-row">
                <div className={`status-icon ${tx.executed ? 'success' : tx.revoked ? 'danger' : 'warn'}`}>
                  {tx.executed ? <CheckCircle size={14}/> : tx.revoked ? <XCircle size={14}/> : <Clock size={14}/>}
                </div>
                <div className="tx-details">
                  <div className="tx-amt">{parseFloat(tx.amount).toFixed(2)} MNEE</div>
                  <div className="tx-to">TO: {tx.vendor.slice(0, 10)}...</div>
                </div>
                <div className="tx-time">{new Date(tx.timestamp * 1000).toLocaleTimeString()}</div>
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
          display: flex; justify-content: space-between; align-items: flex-end; 
          border-bottom: 4px solid var(--border-color, #ffcc00); padding-bottom: 24px; 
        }
        .dash-header h1 { font-family: var(--font-pixel); font-size: 32px; margin-bottom: 4px; line-height: 1; color: var(--text-primary, #ffcc00); }
        .dash-header p { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted, #b38f00); letter-spacing: 1px; }

        .header-controls { display: flex; gap: 12px; align-items: center; }
        
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
          .dashboard { padding: 16px; gap: 16px; }
          .stats-row { grid-template-columns: 1fr 1fr; gap: 12px; }
          .stat-card { padding: 16px; }
          .stat-value { font-size: 20px; }
          .stat-label { font-size: 10px; }
          .chart-card { padding: 16px; }
          .chart-header { flex-direction: column; align-items: flex-start; gap: 8px; }
          .chart-title { font-size: 12px; }
          .recent-list { grid-template-columns: 1fr; gap: 12px; }
        }

        @media (max-width: 480px) {
          .dashboard { padding: 12px; gap: 12px; }
          .stats-row { grid-template-columns: 1fr; gap: 10px; }
          .stat-card { padding: 12px; flex-direction: column; align-items: flex-start; gap: 8px; }
          .stat-icon-box { position: absolute; top: 12px; right: 12px; }
          .stat-value { font-size: 18px; }
          .trend-badge { position: static; margin-top: 4px; }
          .chart-wrapper { height: 150px; }
        }
      `}</style>
    </div>
  );
}
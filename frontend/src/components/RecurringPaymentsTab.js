import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, PiggyBank, Repeat, Clock, Play, Pause, Trash2,
  Edit2, CheckCircle, AlertTriangle, ChevronRight, DollarSign,
  Lock, Unlock, Settings, RefreshCw, X, Save
} from 'lucide-react';
import RecurringScheduler, { formatScheduleDate, formatTime, getDaysUntil } from '../utils/RecurringScheduler';

export default function RecurringPaymentsTab({ 
  account, 
  scheduler,
  onExecuteSchedule,
  onExecuteSavingsDeposit,
  onRefresh 
}) {
  const [schedules, setSchedules] = useState([]);
  const [savingsPlans, setSavingsPlans] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState('schedules');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [loading, setLoading] = useState(false);

 useEffect(() => {
    if (scheduler) {
      loadData();
    }
  }, [scheduler]);

  const loadData = () => {
    const data = scheduler.load();
    setSchedules(data.schedules || []);
    setSavingsPlans(data.savingsPlans || []);
  };

  useEffect(() => {
    const handleSavingsUpdate = (event) => {
      console.log('📊 RecurringTab: Received savings update');
      if (event.detail?.plans) {
        setSavingsPlans(event.detail.plans);
      } else if (scheduler) {
        loadData();
      }
    };
    
    window.addEventListener('savingsUpdated', handleSavingsUpdate);
    return () => window.removeEventListener('savingsUpdated', handleSavingsUpdate);
  }, [scheduler]);

  const handlePause = (id) => {
    scheduler.pauseSchedule(id);
    loadData();
  };

  const handleResume = (id) => {
    scheduler.resumeSchedule(id);
    loadData();
  };

  const handleDelete = (id, type = 'schedule') => {
    if (!window.confirm('Are you sure you want to delete this?')) return;
    
    if (type === 'savings') {
      scheduler.deleteSavingsPlan(id);
    } else {
      scheduler.deleteSchedule(id);
    }
    loadData();
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      amount: item.amount,
      executionTime: item.executionTime,
      frequency: item.frequency
    });
  };

  const handleSaveEdit = (id, type = 'schedule') => {
    if (type === 'savings') {
      scheduler.updateSavingsPlan(id, editForm);
    } else {
      scheduler.updateSchedule(id, editForm);
    }
    setEditingId(null);
    setEditForm({});
    loadData();
  };

  const handleExecuteNow = async (schedule) => {
    setLoading(true);
    try {
      if (onExecuteSchedule) {
        await onExecuteSchedule(schedule);
        scheduler.markScheduleExecuted(schedule.id, 'manual');
        loadData();
      }
    } catch (error) {
      console.error('Execution failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDepositNow = async (plan) => {
    setLoading(true);
    try {
      if (onExecuteSavingsDeposit) {
        await onExecuteSavingsDeposit(plan);
        scheduler.markSavingsDeposit(plan.id, plan.amount, 'manual');
        loadData();
      }
    } catch (error) {
      console.error('Deposit failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (item) => {
    if (!item.isActive) {
      return <span className="status-badge paused">PAUSED</span>;
    }
    const daysUntil = getDaysUntil(item.nextExecution || item.nextDeposit);
    if (daysUntil <= 0) {
      return <span className="status-badge due">DUE NOW</span>;
    }
    if (daysUntil <= 1) {
      return <span className="status-badge soon">TOMORROW</span>;
    }
    return <span className="status-badge active">ACTIVE</span>;
  };

  const getProgress = (plan) => {
    if (!plan.targetAmount) return 0;
    return Math.min(100, (plan.totalSaved / plan.targetAmount) * 100);
  };

  return (
    <div className="recurring-tab">
      <div className="tab-header">
        <h3>RECURRING PAYMENTS</h3>
        <button className="refresh-btn" onClick={loadData}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="sub-tabs">
        <button 
          className={activeSubTab === 'schedules' ? 'active' : ''}
          onClick={() => setActiveSubTab('schedules')}
        >
          <Repeat size={14} />
          SCHEDULED ({schedules.filter(s => s.isActive).length})
        </button>
        <button 
          className={activeSubTab === 'savings' ? 'active' : ''}
          onClick={() => setActiveSubTab('savings')}
        >
          <PiggyBank size={14} />
          SAVINGS ({savingsPlans.filter(s => s.isActive).length})
        </button>
        <button 
          className={activeSubTab === 'history' ? 'active' : ''}
          onClick={() => setActiveSubTab('history')}
        >
          <Clock size={14} />
          HISTORY
        </button>
      </div>

      <div className="tab-content">
        {activeSubTab === 'schedules' && (
          <div className="schedules-list">
            {schedules.length === 0 ? (
              <div className="empty-state">
                <Calendar size={32} />
                <h4>NO SCHEDULED PAYMENTS</h4>
                <p>Use the AI Chat to set up recurring payments like "Pay Netflix 15 MNEE every month"</p>
              </div>
            ) : (
              schedules.map(schedule => (
                <motion.div 
                  key={schedule.id}
                  className={`schedule-card ${!schedule.isActive ? 'paused' : ''}`}
                  layout
                >
                  <div className="card-header">
                    <div className="vendor-info">
                      <span className="vendor-name">{schedule.vendor}</span>
                      {getStatusBadge(schedule)}
                    </div>
                    <div className="card-actions">
                      {schedule.isActive ? (
                        <button onClick={() => handlePause(schedule.id)} title="Pause">
                          <Pause size={14} />
                        </button>
                      ) : (
                        <button onClick={() => handleResume(schedule.id)} title="Resume">
                          <Play size={14} />
                        </button>
                      )}
                      <button onClick={() => handleEdit(schedule)} title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => handleDelete(schedule.id)} title="Delete" className="danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {editingId === schedule.id ? (
                    <div className="edit-form">
                      <div className="form-row">
                        <label>Amount (MNEE)</label>
                        <input
                          type="number"
                          value={editForm.amount}
                          onChange={(e) => setEditForm({...editForm, amount: e.target.value})}
                        />
                      </div>
                      <div className="form-row">
                        <label>Time (UTC)</label>
                        <input
                          type="time"
                          value={editForm.executionTime}
                          onChange={(e) => setEditForm({...editForm, executionTime: e.target.value})}
                        />
                      </div>
                      <div className="form-row">
                        <label>Frequency</label>
                        <select 
                          value={editForm.frequency}
                          onChange={(e) => setEditForm({...editForm, frequency: e.target.value})}
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                      <div className="form-actions">
                        <button onClick={() => setEditingId(null)}>Cancel</button>
                        <button className="save" onClick={() => handleSaveEdit(schedule.id)}>
                          <Save size={12} /> Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="card-body">
                        <div className="amount-display">
                          <DollarSign size={16} />
                          <span className="amount">{schedule.amount}</span>
                          <span className="currency">MNEE</span>
                          <span className="frequency">/ {schedule.frequency}</span>
                        </div>
                        
                        <div className="details-row">
                          <div className="detail">
                            <Clock size={12} />
                            <span>Next: {formatScheduleDate(schedule.nextExecution)}</span>
                          </div>
                          <div className="detail">
                            <span>@ {formatTime(schedule.executionTime)}</span>
                          </div>
                        </div>

                        {schedule.reason && (
                          <div className="reason">{schedule.reason}</div>
                        )}
                      </div>

                      <div className="card-footer">
                        <div className="stats">
                          <span>Executed: {schedule.executionCount}x</span>
                          {schedule.failedCount > 0 && (
                            <span className="failed">Failed: {schedule.failedCount}x</span>
                          )}
                        </div>
                        {schedule.isActive && getDaysUntil(schedule.nextExecution) <= 0 && (
                          <button 
                            className="execute-btn"
                            onClick={() => handleExecuteNow(schedule)}
                            disabled={loading}
                          >
                            <Play size={12} /> Execute Now
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}

        {activeSubTab === 'savings' && (
          <div className="savings-list">
            {savingsPlans.length === 0 ? (
              <div className="empty-state">
                <PiggyBank size={32} />
                <h4>NO SAVINGS PLANS</h4>
                <p>Use the AI Chat to set up savings like "Save 100 MNEE weekly for 1 year"</p>
              </div>
            ) : (
              savingsPlans.map(plan => (
                <motion.div 
                  key={plan.id}
                  className={`savings-card ${plan.withdrawn ? 'withdrawn' : ''}`}
                  layout
                >
                  <div className="card-header">
                    <div className="plan-info">
                      <Lock size={14} />
                      <span className="plan-name">{plan.name}</span>
                      {plan.withdrawn ? (
                        <span className="status-badge withdrawn">WITHDRAWN</span>
                      ) : new Date(plan.unlockDate) <= new Date() ? (
                        <span className="status-badge unlocked">UNLOCKED</span>
                      ) : (
                        <span className="status-badge locked">LOCKED</span>
                      )}
                    </div>
                    <div className="card-actions">
                      <button onClick={() => handleDelete(plan.id, 'savings')} title="Delete" className="danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="progress-section">
                      <div className="progress-header">
                        <span>{plan.totalSaved.toFixed(0)} / {plan.targetAmount.toFixed(0)} MNEE</span>
                        <span>{getProgress(plan).toFixed(0)}%</span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{ width: `${getProgress(plan)}%` }}
                        />
                      </div>
                    </div>

                    <div className="details-grid">
                      <div className="detail-item">
                        <span className="label">Deposit</span>
                        <span className="value">{plan.amount} MNEE</span>
                      </div>
                       <div className="detail-item">
                        <span className="label">Frequency</span>
                        <span className="value">{plan.isRecurring ? `${plan.frequency} @ ${plan.executionTime || '--:--'}` : 'One-time'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Unlock Date</span>
                        <span className="value">{formatScheduleDate(plan.unlockDate)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Days Left</span>
                        <span className="value">{Math.max(0, getDaysUntil(plan.unlockDate))}</span>
                      </div>
                    </div>

                    {plan.isRecurring && plan.nextDeposit && !plan.withdrawn && (
                      <div className="next-deposit">
                        <Clock size={12} />
                       <span>Next deposit: {formatScheduleDate(plan.nextDeposit)} @ {plan.executionTime || '--:--'}</span>
                        {getDaysUntil(plan.nextDeposit) <= 0 && (
                          <button 
                            className="deposit-btn"
                            onClick={() => handleDepositNow(plan)}
                            disabled={loading}
                          >
                            Deposit Now
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="card-footer">
                    <span>Deposits: {plan.depositsCompleted} / {plan.totalDeposits}</span>
                    {plan.savingsPlanId && (
                      <span className="on-chain">On-chain ID: #{plan.savingsPlanId}</span>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {activeSubTab === 'history' && (
          <div className="history-list">
            <div className="empty-state">
              <Clock size={32} />
              <h4>EXECUTION HISTORY</h4>
              <p>Recent payment executions will appear here</p>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .recurring-tab {
          background: var(--bg-card, #2a2a2a);
          border: 2px solid var(--border-color, #ffcc00);
          padding: 20px;
        }

        .tab-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 2px solid var(--border-color, #ffcc00);
        }

        .tab-header h3 {
          font-family: var(--font-pixel);
          font-size: 16px;
          color: var(--text-primary, #ffcc00);
        }

        .refresh-btn {
          background: var(--bg-secondary, #252525);
          border: 1px solid var(--border-color, #ffcc00);
          color: var(--text-primary, #ffcc00);
          padding: 8px;
          cursor: pointer;
        }
        .refresh-btn:hover {
          background: var(--border-color, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
        }

        .sub-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .sub-tabs button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 16px;
          background: var(--bg-secondary, #252525);
          border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-pixel);
          font-size: 10px;
          cursor: pointer;
          color: var(--text-primary, #ffcc00);
          transition: all 0.2s;
        }
        .sub-tabs button.active {
          background: var(--border-color, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
        }
        .sub-tabs button:hover:not(.active) {
          background: var(--bg-card, #2a2a2a);
        }

        .empty-state {
          text-align: center;
          padding: 48px 24px;
          color: var(--text-muted, #b38f00);
        }
        .empty-state svg {
          margin-bottom: 16px;
          opacity: 0.5;
        }
        .empty-state h4 {
          font-family: var(--font-pixel);
          font-size: 14px;
          margin-bottom: 8px;
          color: var(--text-primary, #ffcc00);
        }
        .empty-state p {
          font-size: 12px;
          line-height: 1.5;
        }

        .schedules-list, .savings-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .schedule-card, .savings-card {
          background: var(--bg-secondary, #252525);
          border: 2px solid var(--border-color, #ffcc00);
          overflow: hidden;
        }
        .schedule-card.paused, .savings-card.withdrawn {
          opacity: 0.6;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--bg-card, #2a2a2a);
          border-bottom: 1px solid var(--border-color, #ffcc00);
        }

        .vendor-info, .plan-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .vendor-name, .plan-name {
          font-weight: 700;
          font-size: 14px;
          color: var(--text-primary, #ffcc00);
        }

        .status-badge {
          padding: 2px 8px;
          font-size: 9px;
          font-weight: 700;
          border: 1px solid;
        }
        .status-badge.active { background: rgba(0, 204, 102, 0.2); border-color: var(--accent-emerald); color: var(--accent-emerald); }
        .status-badge.paused { background: rgba(255, 204, 0, 0.2); border-color: var(--accent-amber); color: var(--accent-amber); }
        .status-badge.due { background: rgba(255, 59, 48, 0.2); border-color: var(--accent-red); color: var(--accent-red); }
        .status-badge.soon { background: rgba(96, 165, 250, 0.2); border-color: #60a5fa; color: #60a5fa; }
        .status-badge.locked { background: rgba(168, 85, 247, 0.2); border-color: #a855f7; color: #a855f7; }
        .status-badge.unlocked { background: rgba(0, 204, 102, 0.2); border-color: var(--accent-emerald); color: var(--accent-emerald); }
        .status-badge.withdrawn { background: rgba(100, 100, 100, 0.2); border-color: #666; color: #666; }

        .card-actions {
          display: flex;
          gap: 6px;
        }
        .card-actions button {
          padding: 6px;
          background: var(--bg-secondary, #252525);
          border: 1px solid var(--border-color, #ffcc00);
          color: var(--text-primary, #ffcc00);
          cursor: pointer;
        }
        .card-actions button:hover {
          background: var(--border-color, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
        }
        .card-actions button.danger:hover {
          background: var(--accent-red);
          border-color: var(--accent-red);
          color: white;
        }

        .card-body {
          padding: 16px;
        }

        .amount-display {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .amount-display svg { color: var(--text-muted, #b38f00); }
        .amount-display .amount {
          font-family: var(--font-pixel);
          font-size: 24px;
          color: var(--text-primary, #ffcc00);
        }
        .amount-display .currency {
          font-size: 12px;
          color: var(--text-muted, #b38f00);
        }
        .amount-display .frequency {
          font-size: 11px;
          color: var(--text-secondary, #e6b800);
          margin-left: auto;
        }

        .details-row {
          display: flex;
          gap: 16px;
          margin-bottom: 8px;
        }
        .detail {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--text-secondary, #e6b800);
        }

        .reason {
          font-size: 11px;
          font-style: italic;
          color: var(--text-muted, #b38f00);
          padding-top: 8px;
          border-top: 1px dashed var(--border-color, #ffcc00);
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          background: var(--bg-card, #2a2a2a);
          border-top: 1px solid var(--border-color, #ffcc00);
          font-size: 10px;
          color: var(--text-muted, #b38f00);
        }
        .card-footer .failed { color: var(--accent-red); }
        .card-footer .on-chain { font-family: var(--font-mono); }

        .execute-btn, .deposit-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          background: var(--accent-emerald);
          border: none;
          color: white;
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
        }
        .execute-btn:hover, .deposit-btn:hover {
          opacity: 0.9;
        }

        .progress-section {
          margin-bottom: 16px;
        }
        .progress-header {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 8px;
          color: var(--text-primary, #ffcc00);
        }
        .progress-bar {
          height: 12px;
          background: var(--bg-primary, #1a1a1a);
          border: 1px solid var(--border-color, #ffcc00);
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #a855f7, #60a5fa);
          transition: width 0.3s;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 12px;
        }
        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .detail-item .label {
          font-size: 9px;
          color: var(--text-muted, #b38f00);
        }
        .detail-item .value {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-primary, #ffcc00);
        }

        .next-deposit {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px;
          background: rgba(168, 85, 247, 0.1);
          border: 1px solid #a855f7;
          font-size: 11px;
          color: #a855f7;
        }
        .next-deposit .deposit-btn {
          margin-left: auto;
          background: #a855f7;
        }

        .edit-form {
          padding: 16px;
          background: var(--bg-primary, #1a1a1a);
        }
        .form-row {
          margin-bottom: 12px;
        }
        .form-row label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          color: var(--text-muted, #b38f00);
          margin-bottom: 6px;
        }
        .form-row input, .form-row select {
          width: 100%;
          padding: 10px;
          background: var(--bg-secondary, #252525);
          border: 2px solid var(--border-color, #ffcc00);
          color: var(--text-primary, #ffcc00);
          font-size: 14px;
        }
        .form-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .form-actions button {
          padding: 8px 16px;
          background: var(--bg-secondary, #252525);
          border: 1px solid var(--border-color, #ffcc00);
          color: var(--text-primary, #ffcc00);
          font-size: 11px;
          cursor: pointer;
        }
        .form-actions button.save {
          background: var(--border-color, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        @media (max-width: 600px) {
          .sub-tabs { flex-direction: column; }
          .sub-tabs button { width: 100%; justify-content: center; }
          .details-grid { grid-template-columns: 1fr; }
          .card-header { flex-direction: column; align-items: flex-start; gap: 10px; }
          .card-actions { width: 100%; justify-content: flex-end; }
        }
      `}</style>
    </div>
  );
}
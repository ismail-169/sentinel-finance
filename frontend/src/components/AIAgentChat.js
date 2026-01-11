import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import {
  Bot, Send, Shield, AlertTriangle, CheckCircle,
  XCircle, Loader, DollarSign, User, Clock,
  ChevronDown, Sparkles, Terminal, Calendar,
  Repeat, PiggyBank, Lock, Trash2, Play, Bell,
  TrendingUp, Target, Wallet, Zap, ArrowRight
} from 'lucide-react';
import sentinelLogo from '../sentinel-logo.png';

const AI_PROVIDERS = {
  grok: {
    name: 'GROK',
    model: 'grok-3-latest',
    icon: '▣',
    envKey: 'REACT_APP_XAI_API_KEY',
    endpoint: 'https://api.x.ai/v1/chat/completions'
  },
  claude: {
    name: 'CLAUDE',
    model: 'claude-sonnet-4-20250514',
    icon: '◆',
    envKey: 'REACT_APP_ANTHROPIC_API_KEY',
    endpoint: 'https://api.anthropic.com/v1/messages'
  },
  openai: {
    name: 'GPT-4',
    model: 'gpt-4-turbo-preview',
    icon: '●',
    envKey: 'REACT_APP_OPENAI_API_KEY',
    endpoint: 'https://api.openai.com/v1/chat/completions'
  }
};

// Enhanced system prompt with Agent Wallet commands
const getSystemPrompt = (trustedVendors, schedules, savingsPlans, hasAgentWallet, agentBalance) => {
  const vendorList = trustedVendors.length > 0
    ? trustedVendors.map(v => `- ${v.name}: ${v.address}`).join('\n')
    : '(No trusted vendors configured yet)';

  const scheduleList = schedules.length > 0
    ? schedules.map(s => `- ${s.amount} MNEE to ${s.vendor} (${s.frequency})`).join('\n')
    : '(No scheduled payments)';

  const savingsList = savingsPlans.length > 0
    ? savingsPlans.map(s => `- ${s.name}: ${s.amount} MNEE/${s.frequency}, locked for ${s.lockDays} days`).join('\n')
    : '(No savings plans)';

  const agentWalletInfo = hasAgentWallet 
    ? `\n\nAGENT WALLET STATUS:\n- Connected: Yes\n- Balance: ${agentBalance} MNEE\n- Can execute automated payments without popups`
    : '\n\nAGENT WALLET STATUS:\n- Not initialized (user needs to set up in Agent Wallet panel)';

  return `You are SENTINEL AI, an advanced financial assistant with access to a secure cryptocurrency vault containing MNEE stablecoins. You can:
1. Execute instant payments (via Main Vault - requires wallet popup)
2. Schedule recurring payments (via Agent Wallet - NO popups!)
3. Create savings plans with locked funds
4. Manage the Agent Wallet for automated payments

PAYMENT ROUTING RULES:
- ONE-TIME payments to UNTRUSTED vendors → Main Vault (popup required)
- ONE-TIME payments to TRUSTED vendors → Main Vault (popup, but auto-executes)
- RECURRING payments → Agent Wallet (no popup, fully automated)
- SAVINGS deposits → Agent Wallet → Savings Contract (no popup)

RESPONSE FORMAT - Always include JSON for actions:
1. INSTANT PAYMENTS: {"action": "payment", "vendor": "name/address", "amount": number, "reason": "description"}
2. SCHEDULED PAYMENTS: {"action": "schedule", "vendor": "name/address", "amount": number, "frequency": "daily|weekly|monthly|yearly", "startDate": "YYYY-MM-DD", "reason": "description"}
3. SAVINGS PLANS: {"action": "savings", "name": "plan name", "amount": number, "frequency": "daily|weekly|monthly", "lockDays": number, "reason": "description"}
4. VIEW SCHEDULES: {"action": "view_schedules"}
5. VIEW SAVINGS: {"action": "view_savings"}
6. CANCEL: {"action": "cancel_schedule", "id": "schedule_id"} or {"action": "cancel_savings", "id": "savings_id"}
7. FUND AGENT WALLET: {"action": "fund_agent", "amount": number}
8. WITHDRAW FROM AGENT: {"action": "withdraw_agent", "amount": number} (amount=0 means withdraw all)
9. CHECK AGENT BALANCE: {"action": "agent_balance"}

USER'S TRUSTED VENDORS:
${vendorList}

ACTIVE SCHEDULED PAYMENTS:
${scheduleList}

ACTIVE SAVINGS PLANS:
${savingsList}
${agentWalletInfo}

FREQUENCY PARSING:
- "every week/weekly" = weekly
- "every month/monthly/1st of each month" = monthly  
- "every day/daily" = daily
- "every year/yearly/annually" = yearly

EXAMPLES:
User: "Pay $50 to Amazon every month starting next week"
Response: "I'll set up a recurring payment to Amazon! This will use your Agent Wallet for automatic execution.
{"action": "schedule", "vendor": "Amazon", "amount": 50, "frequency": "monthly", "startDate": "2026-01-18", "reason": "Monthly Amazon payment"}"

User: "Save 20 MNEE every week for 1 year"
Response: "Great savings goal! I'll create a weekly savings plan locked for 365 days.
{"action": "savings", "name": "Weekly Savings", "amount": 20, "frequency": "weekly", "lockDays": 365, "reason": "52-week savings challenge"}"

User: "Send 100 MNEE to Netflix now"
Response: "Processing instant payment to Netflix! This will require a wallet confirmation.
{"action": "payment", "vendor": "Netflix", "amount": 100, "reason": "Netflix payment"}"

User: "Fund my agent wallet with 500 MNEE"
Response: "I'll transfer 500 MNEE from your vault to your Agent Wallet for automated payments.
{"action": "fund_agent", "amount": 500}"

User: "Check my agent wallet balance"
Response: "{"action": "agent_balance"}"

Be conversational and helpful. Explain whether payments will use the vault (popup) or agent wallet (no popup).`;
};

const MessageBubble = ({ message, isUser, isSystem }) => {
  if (isSystem) {
    return (
      <motion.div
        className={`system-message ${message.type}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="sys-icon">
          {message.type === 'success' && <CheckCircle size={14} />}
          {message.type === 'warning' && <AlertTriangle size={14} />}
          {message.type === 'danger' && <XCircle size={14} />}
          {message.type === 'info' && (
            <img 
              src={sentinelLogo} 
              alt="Sentinel" 
              style={{ width: '14px', height: '14px', marginRight: '4px', verticalAlign: 'middle' }} 
            />
          )}
          {message.type === 'schedule' && <Calendar size={14} />}
          {message.type === 'savings' && <PiggyBank size={14} />}
          {message.type === 'agent' && <Bot size={14} />}
        </div>
        <span>{message.content}</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`message-bubble ${isUser ? 'user' : 'agent'}`}
      initial={{ opacity: 0, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className="bubble-header">
        <span className="sender">{isUser ? 'USER' : 'AGENT'}</span>
        <span className="timestamp">{message.time}</span>
      </div>
      
      <div className="bubble-content">
        <div className="message-text">{message.content}</div>
        
        {message.payment && (
          <div className={`payment-receipt ${message.payment.status}`}>
            <div className="receipt-header">
              <DollarSign size={14} />
              <span>PAYMENT INTENT</span>
              <div className={`status-tag ${message.payment.status}`}>
                {message.payment.status.toUpperCase()}
              </div>
            </div>
            <div className="receipt-body">
              <div className="receipt-row">
                <span>VENDOR:</span>
                <span className="mono">{message.payment.vendor}</span>
              </div>
              <div className="receipt-row">
                <span>AMOUNT:</span>
                <span className="mono bold">{message.payment.amount} MNEE</span>
              </div>
              <div className="receipt-row">
                <span>VIA:</span>
                <span className={`route-tag ${message.payment.viaAgent ? 'agent' : 'vault'}`}>
                  {message.payment.viaAgent ? '⚡ AGENT WALLET' : '🔐 MAIN VAULT'}
                </span>
              </div>
              {message.payment.riskScore !== undefined && (
                <div className="receipt-row risk">
                  <span>RISK:</span>
                  <span className={`risk-val ${message.payment.riskScore > 0.7 ? 'high' : message.payment.riskScore > 0.4 ? 'med' : 'low'}`}>
                    {(message.payment.riskScore * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {message.schedule && (
          <div className="schedule-card">
            <div className="schedule-header">
              <Repeat size={14} />
              <span>SCHEDULED PAYMENT</span>
              <span className="via-badge">⚡ VIA AGENT</span>
            </div>
            <div className="schedule-body">
              <div className="schedule-row"><span>TO:</span><span>{message.schedule.vendor}</span></div>
              <div className="schedule-row"><span>AMOUNT:</span><span>{message.schedule.amount} MNEE</span></div>
              <div className="schedule-row"><span>FREQUENCY:</span><span>{message.schedule.frequency.toUpperCase()}</span></div>
              <div className="schedule-row"><span>NEXT:</span><span>{message.schedule.nextDate}</span></div>
            </div>
          </div>
        )}

        {message.savings && (
          <div className="savings-card">
            <div className="savings-header">
              <PiggyBank size={14} />
              <span>SAVINGS PLAN</span>
              <Lock size={12} />
            </div>
            <div className="savings-body">
              <div className="savings-row"><span>NAME:</span><span>{message.savings.name}</span></div>
              <div className="savings-row"><span>DEPOSIT:</span><span>{message.savings.amount} MNEE/{message.savings.frequency}</span></div>
              <div className="savings-row"><span>LOCK PERIOD:</span><span>{message.savings.lockDays} DAYS</span></div>
              <div className="savings-row"><span>UNLOCK DATE:</span><span>{message.savings.unlockDate}</span></div>
            </div>
          </div>
        )}

        {message.agentWallet && (
          <div className="agent-card">
            <div className="agent-header">
              <Bot size={14} />
              <span>AGENT WALLET</span>
            </div>
            <div className="agent-body">
              <div className="agent-row"><span>BALANCE:</span><span className="mono bold">{message.agentWallet.balance} MNEE</span></div>
              {message.agentWallet.action && (
                <div className="agent-row"><span>ACTION:</span><span>{message.agentWallet.action}</span></div>
              )}
              {message.agentWallet.txHash && (
                <div className="agent-row"><span>TX:</span><span className="mono">{message.agentWallet.txHash.slice(0,10)}...</span></div>
              )}
            </div>
          </div>
        )}
        
        {message.provider && !isUser && (
          <div className="provider-tag">MODEL: {message.provider}</div>
        )}
      </div>
    </motion.div>
  );
};

// Schedule Panel Component
const SchedulePanel = ({ schedules, savingsPlans, onCancel, onExecuteNow }) => {
  const [activeTab, setActiveTab] = useState('schedules');

  return (
    <div className="schedule-panel">
      <div className="panel-tabs">
        <button 
          className={`panel-tab ${activeTab === 'schedules' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedules')}
        >
          <Calendar size={14} /> SCHEDULED ({schedules.length})
        </button>
        <button 
          className={`panel-tab ${activeTab === 'savings' ? 'active' : ''}`}
          onClick={() => setActiveTab('savings')}
        >
          <PiggyBank size={14} /> SAVINGS ({savingsPlans.length})
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'schedules' && (
          schedules.length === 0 ? (
            <div className="empty-state">
              <Calendar size={24} />
              <p>No scheduled payments</p>
              <span>Say "Pay X to Y every month" to create one</span>
            </div>
          ) : (
            schedules.map(schedule => (
              <div key={schedule.id} className="schedule-item">
                <div className="item-icon"><Repeat size={16} /></div>
                <div className="item-details">
                  <div className="item-title">{schedule.amount} MNEE → {schedule.vendor}</div>
                  <div className="item-meta">
                    <span><Clock size={10} /> {schedule.frequency}</span>
                    <span><Calendar size={10} /> Next: {schedule.nextDate}</span>
                  </div>
                  {schedule.useAgentWallet && (
                    <div className="agent-badge">⚡ AUTO</div>
                  )}
                </div>
                <div className="item-actions">
                  <button className="action-btn execute" onClick={() => onExecuteNow(schedule)} title="Execute Now">
                    <Play size={12} />
                  </button>
                  <button className="action-btn cancel" onClick={() => onCancel('schedule', schedule.id)} title="Cancel">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )
        )}

        {activeTab === 'savings' && (
          savingsPlans.length === 0 ? (
            <div className="empty-state">
              <PiggyBank size={24} />
              <p>No savings plans</p>
              <span>Say "Save X every week for Y days" to create one</span>
            </div>
          ) : (
            savingsPlans.map(plan => {
              const progress = Math.min(100, (plan.totalSaved / plan.targetAmount) * 100);
              const daysLeft = Math.max(0, Math.ceil((new Date(plan.unlockDate) - new Date()) / (1000 * 60 * 60 * 24)));
              
              return (
                <div key={plan.id} className="savings-item">
                  <div className="item-icon locked"><Lock size={16} /></div>
                  <div className="item-details">
                    <div className="item-title">{plan.name}</div>
                    <div className="savings-progress">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                      </div>
                      <span>{plan.totalSaved.toFixed(2)} / {plan.targetAmount.toFixed(2)} MNEE</span>
                    </div>
                    <div className="item-meta">
                      <span><Clock size={10} /> {plan.amount} MNEE/{plan.frequency}</span>
                      <span><Lock size={10} /> {daysLeft} days left</span>
                    </div>
                  </div>
                  <div className="item-actions">
                    {daysLeft === 0 ? (
                      <button className="action-btn withdraw" title="Withdraw">
                        <Wallet size={12} />
                      </button>
                    ) : (
                      <div className="locked-badge">LOCKED</div>
                    )}
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
};

// Main Component - Now accepts agentManager prop
export default function AIAgentChat({ 
  contract, 
  account, 
  onTransactionCreated, 
  trustedVendors = [],
  agentManager = null,  // NEW: Agent wallet manager
  provider = null,      // NEW: Ethers provider
  onAgentWalletUpdate   // NEW: Callback when agent wallet changes
}) {
  const [messages, setMessages] = useState([]);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('grok');
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [savingsPlans, setSavingsPlans] = useState([]);
  const [agentBalance, setAgentBalance] = useState('0');
  const messagesEndRef = useRef(null);

  // Load agent wallet balance
  useEffect(() => {
    const loadAgentBalance = async () => {
      if (agentManager && agentManager.hasWallet() && provider) {
        const balance = await agentManager.getBalance(provider);
        setAgentBalance(balance);
      }
    };
    loadAgentBalance();
  }, [agentManager, provider]);

  // Load schedules and savings from localStorage
  useEffect(() => {
    const savedSchedules = localStorage.getItem(`sentinel_schedules_${account}`);
    const savedSavings = localStorage.getItem(`sentinel_savings_${account}`);
    if (savedSchedules) setSchedules(JSON.parse(savedSchedules));
    if (savedSavings) setSavingsPlans(JSON.parse(savedSavings));
  }, [account]);

  // Save schedules and savings to localStorage
  useEffect(() => {
    if (account) {
      localStorage.setItem(`sentinel_schedules_${account}`, JSON.stringify(schedules));
      localStorage.setItem(`sentinel_savings_${account}`, JSON.stringify(savingsPlans));
    }
  }, [schedules, savingsPlans, account]);

  // Check for due payments on load
  useEffect(() => {
    const checkDuePayments = () => {
      const now = new Date();
      schedules.forEach(schedule => {
        const nextDate = new Date(schedule.nextDate);
        if (nextDate <= now && !schedule.notified) {
          addSystemMessage(`⏰ SCHEDULED PAYMENT DUE: ${schedule.amount} MNEE to ${schedule.vendor}`, 'schedule');
          setSchedules(prev => prev.map(s => 
            s.id === schedule.id ? { ...s, notified: true } : s
          ));
        }
      });

      savingsPlans.forEach(plan => {
        const nextDeposit = new Date(plan.nextDeposit);
        if (nextDeposit <= now && !plan.notified) {
          addSystemMessage(`💰 SAVINGS DEPOSIT DUE: ${plan.amount} MNEE for "${plan.name}"`, 'savings');
          setSavingsPlans(prev => prev.map(p => 
            p.id === plan.id ? { ...p, notified: true } : p
          ));
        }
      });
    };

    if (schedules.length > 0 || savingsPlans.length > 0) {
      checkDuePayments();
    }
  }, [schedules, savingsPlans]);

  useEffect(() => {
    console.log('🏪 AIAgentChat received trustedVendors:', trustedVendors);
  }, [trustedVendors]);
  
  useEffect(() => {
    if (hasInitialized) return;
    
    const vendorNames = trustedVendors.map(v => v.name).filter(Boolean).slice(0, 5);
    const vendorList = vendorNames.length > 0 
      ? `\n\nTRUSTED VENDORS:\n${vendorNames.join(', ')}${trustedVendors.length > 5 ? '...' : ''}`
      : '\n\n⚠️ NO TRUSTED VENDORS DETECTED.';

    const agentStatus = agentManager && agentManager.hasWallet()
      ? `\n\n⚡ AGENT WALLET: ACTIVE (${agentBalance} MNEE)`
      : '\n\n💡 TIP: Set up Agent Wallet for automated payments!';
    
    setMessages([{
      id: 1,
      content: `SENTINEL AI ONLINE.\n\nCOMMANDS:\n> "PAY $50 TO [VENDOR]" - Instant payment (vault)\n> "PAY $X TO [VENDOR] EVERY MONTH" - Recurring (agent)\n> "SAVE $X EVERY WEEK FOR Y DAYS" - Savings plan\n> "FUND AGENT WITH $X" - Load agent wallet\n> "SHOW SCHEDULES" - View scheduled payments${vendorList}${agentStatus}`,
      isUser: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    
    if (trustedVendors.length > 0 || hasInitialized === false) {
      setHasInitialized(true);
    }
  }, [trustedVendors, hasInitialized, agentManager, agentBalance]);

  const getApiKey = (providerKey) => {
    const envKey = AI_PROVIDERS[providerKey].envKey;
    return process.env[envKey] || '';
  };

  const availableProviders = Object.entries(AI_PROVIDERS).filter(
    ([key]) => getApiKey(key)
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!getApiKey(selectedProvider) && availableProviders.length > 0) {
      setSelectedProvider(availableProviders[0][0]);
    }
  }, [selectedProvider, availableProviders]);

  const addMessage = (content, isUser = false, extra = {}) => {
    const newMessage = {
      id: Date.now(),
      content,
      isUser,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      ...extra
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  const addSystemMessage = (content, type = 'info') => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      content,
      isSystem: true,
      type
    }]);
  };

  const parseAIResponse = (text) => {
    const jsonMatch = text.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        return null;
      }
    }
    return null;
  };

  const getVendorAddress = (vendorName) => {
    const normalized = vendorName.toLowerCase().trim();
    
    for (const vendor of trustedVendors) {
      const vendorNameLower = (vendor.name || '').toLowerCase();
      
      if (vendorNameLower && (vendorNameLower.includes(normalized) || normalized.includes(vendorNameLower))) {
        return { address: vendor.address, name: vendor.name, isTrusted: true };
      }
      
      if (normalized.startsWith('0x') && (vendor.address || '').toLowerCase() === normalized) {
        return { address: vendor.address, name: vendor.name || 'Trusted Vendor', isTrusted: true };
      }
    }
    
    if (normalized.startsWith('0x') && normalized.length >= 42) {
      return { address: normalized.slice(0, 42), name: 'Unknown Address', isTrusted: false };
    }
    
    return { address: null, name: vendorName, isTrusted: false, notFound: true };
  };

  const calculateNextDate = (frequency, startDate = new Date()) => {
    const next = new Date(startDate);
    switch (frequency) {
      case 'daily': next.setDate(next.getDate() + 1); break;
      case 'weekly': next.setDate(next.getDate() + 7); break;
      case 'monthly': next.setMonth(next.getMonth() + 1); break;
      case 'yearly': next.setFullYear(next.getFullYear() + 1); break;
      default: next.setMonth(next.getMonth() + 1);
    }
    return next.toISOString().split('T')[0];
  };

  // Create schedule - now marks for agent wallet execution
  const createSchedule = (intent) => {
    const vendor = getVendorAddress(intent.vendor);
    const startDate = intent.startDate || new Date().toISOString().split('T')[0];
    
    const newSchedule = {
      id: `sched_${Date.now()}`,
      vendor: vendor.name || intent.vendor,
      vendorAddress: vendor.address,
      amount: parseFloat(intent.amount),
      frequency: intent.frequency || 'monthly',
      startDate: startDate,
      nextDate: calculateNextDate(intent.frequency || 'monthly', new Date(startDate)),
      reason: intent.reason || 'Scheduled payment',
      isTrusted: vendor.isTrusted,
      useAgentWallet: true, // NEW: Flag for agent wallet execution
      createdAt: new Date().toISOString(),
      notified: false
    };

    setSchedules(prev => [...prev, newSchedule]);
    addSystemMessage(`✅ SCHEDULED: ${newSchedule.amount} MNEE to ${newSchedule.vendor} (${newSchedule.frequency}) via Agent Wallet`, 'schedule');
    
    return {
      vendor: newSchedule.vendor,
      amount: newSchedule.amount,
      frequency: newSchedule.frequency,
      nextDate: newSchedule.nextDate
    };
  };

  const createSavingsPlan = async (intent) => {
    const amount = parseFloat(intent.amount);
    const lockDays = parseInt(intent.lockDays) || 365;
    const frequency = intent.frequency || 'weekly';
    
    const depositsPerPeriod = {
      'daily': lockDays,
      'weekly': Math.floor(lockDays / 7),
      'monthly': Math.floor(lockDays / 30)
    };
    
    const totalDeposits = depositsPerPeriod[frequency] || Math.floor(lockDays / 7);
    const targetAmount = amount * totalDeposits;
    
    const unlockDate = new Date();
    unlockDate.setDate(unlockDate.getDate() + lockDays);

    const newPlan = {
      id: `save_${Date.now()}`,
      name: intent.name || `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Savings`,
      amount: amount,
      frequency: frequency,
      lockDays: lockDays,
      targetAmount: targetAmount,
      totalSaved: 0,
      totalDeposits: totalDeposits,
      depositsCompleted: 0,
      startDate: new Date().toISOString(),
      nextDeposit: calculateNextDate(frequency),
      unlockDate: unlockDate.toISOString().split('T')[0],
      reason: intent.reason || 'Savings plan',
      createdAt: new Date().toISOString(),
      notified: false
    };

    setSavingsPlans(prev => [...prev, newPlan]);
    addSystemMessage(`✅ SAVINGS PLAN CREATED: "${newPlan.name}" - ${amount} MNEE/${frequency} for ${lockDays} days`, 'savings');
    
    return {
      name: newPlan.name,
      amount: newPlan.amount,
      frequency: newPlan.frequency,
      lockDays: newPlan.lockDays,
      unlockDate: newPlan.unlockDate,
      targetAmount: newPlan.targetAmount
    };
  };

  const cancelScheduleOrSavings = (type, id) => {
    if (type === 'schedule') {
      setSchedules(prev => prev.filter(s => s.id !== id));
      addSystemMessage(`🗑️ Schedule cancelled`, 'warning');
    } else {
      setSavingsPlans(prev => prev.filter(s => s.id !== id));
      addSystemMessage(`🗑️ Savings plan cancelled`, 'warning');
    }
  };

  // Execute schedule - tries agent wallet first, falls back to vault
  const executeScheduleNow = async (schedule) => {
    // Try agent wallet first if available and has balance
    if (agentManager && agentManager.hasWallet() && schedule.useAgentWallet) {
      const balance = parseFloat(await agentManager.getBalance(provider));
      if (balance >= schedule.amount && schedule.vendorAddress) {
        addSystemMessage(`⚡ EXECUTING VIA AGENT WALLET (no popup)...`, 'agent');
        try {
          const result = await agentManager.sendMNEE(
            provider,
            schedule.vendorAddress,
            schedule.amount.toString(),
            schedule.reason
          );
          
          if (result.success) {
            addSystemMessage(`✅ PAYMENT COMPLETE - ${schedule.amount} MNEE sent to ${schedule.vendor}`, 'success');
            setSchedules(prev => prev.map(s => 
              s.id === schedule.id 
                ? { ...s, nextDate: calculateNextDate(s.frequency), notified: false }
                : s
            ));
            
            // Update agent balance
            const newBalance = await agentManager.getBalance(provider);
            setAgentBalance(newBalance);
            onAgentWalletUpdate && onAgentWalletUpdate();
            return;
          }
        } catch (err) {
          addSystemMessage(`⚠️ Agent wallet failed: ${err.message}. Falling back to vault...`, 'warning');
        }
      }
    }

    // Fallback to vault (requires popup)
    addSystemMessage(`⚡ EXECUTING SCHEDULED PAYMENT VIA VAULT...`, 'info');
    
    const result = await executePayment({
      vendor: schedule.vendor,
      amount: schedule.amount,
      reason: schedule.reason
    });

    if (result && result.status !== 'blocked') {
      setSchedules(prev => prev.map(s => 
        s.id === schedule.id 
          ? { ...s, nextDate: calculateNextDate(s.frequency), notified: false }
          : s
      ));
    }
  };

  // Execute instant payment via vault (requires popup)
  const executePayment = async (paymentIntent) => {
    if (!contract || !account) {
      addSystemMessage('WALLET NOT CONNECTED. UNABLE TO TRANSACT.', 'danger');
      return null;
    }

    const vendor = getVendorAddress(paymentIntent.vendor);
    const amount = parseFloat(paymentIntent.amount);

    if (vendor.notFound || !vendor.address) {
      addSystemMessage(`❌ VENDOR "${paymentIntent.vendor}" NOT FOUND.`, 'danger');
      return {
        vendor: paymentIntent.vendor,
        amount: amount,
        riskScore: 1.0,
        status: 'blocked',
        isTrusted: false,
        viaAgent: false,
        error: 'Vendor not found'
      };
    }

    try {
      addSystemMessage(`INITIALIZING TRANSFER TO ${vendor.name} VIA VAULT...`, 'info');

      const amountWei = ethers.parseUnits(amount.toString(), 18);
      const tx = await contract.requestPayment(vendor.address, amountWei, account);
      
      addSystemMessage(`AWAITING BLOCKCHAIN CONFIRMATION...`, 'info');
      
      const receipt = await tx.wait();

      let txId = null;
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed && parsed.name === 'PaymentRequested') {
            txId = parsed.args.txId;
            break;
          }
        } catch (e) {}
      }

      const riskScore = vendor.isTrusted 
        ? (amount > 500 ? 0.35 : 0.12)
        : (amount > 100 ? 0.85 : 0.65);

      if (vendor.isTrusted && txId !== null) {
        addSystemMessage(`✅ TRUSTED VENDOR - AUTO-EXECUTING...`, 'success');
        
        try {
          const execTx = await contract.executePayment(txId);
          await execTx.wait();
          addSystemMessage(`✅ PAYMENT COMPLETE - ${amount} MNEE SENT TO ${vendor.name}`, 'success');
          
          onTransactionCreated && onTransactionCreated();
          
          return {
            vendor: vendor.name,
            amount: amount,
            riskScore: riskScore,
            status: 'executed',
            isTrusted: true,
            viaAgent: false,
            autoExecuted: true
          };
        } catch (execErr) {
          addSystemMessage(`⚠️ AUTO-EXECUTE FAILED: ${execErr.reason || 'Unknown error'}`, 'warning');
        }
      }

      if (riskScore > 0.7) {
        addSystemMessage(`🚨 HIGH RISK DETECTED - PENDING REVIEW`, 'danger');
      } else if (riskScore > 0.4) {
        addSystemMessage(`⚠️ MEDIUM RISK - TIMELOCK ACTIVE`, 'warning');
      } else {
        addSystemMessage(`✅ PAYMENT QUEUED`, 'success');
      }

      onTransactionCreated && onTransactionCreated();

      return {
        vendor: vendor.name,
        amount: amount,
        riskScore: riskScore,
        status: riskScore > 0.7 ? 'blocked' : riskScore > 0.4 ? 'pending' : 'approved',
        isTrusted: vendor.isTrusted,
        viaAgent: false
      };

    } catch (err) {
      addSystemMessage(`❌ FAILED: ${err.reason || err.message}`, 'danger');
      return null;
    }
  };

  // NEW: Fund agent wallet
  const fundAgentWallet = async (amount) => {
    if (!agentManager) {
      addSystemMessage(`❌ Agent wallet not initialized. Open Agent Wallet panel first.`, 'danger');
      return null;
    }
    
    if (!agentManager.hasWallet()) {
      addSystemMessage(`❌ Agent wallet not set up. Click the bot icon in header to initialize.`, 'danger');
      return null;
    }

    addSystemMessage(`⏳ Funding agent wallet with ${amount} MNEE requires 2 confirmations...`, 'info');
    addSystemMessage(`💡 Use the Agent Wallet panel (bot icon) to fund your agent wallet.`, 'info');
    
    return {
      balance: agentBalance,
      action: 'FUND_REQUIRED_VIA_PANEL'
    };
  };

  // NEW: Withdraw from agent wallet
  const withdrawFromAgent = async (amount) => {
    if (!agentManager || !agentManager.hasWallet()) {
      addSystemMessage(`❌ Agent wallet not available.`, 'danger');
      return null;
    }

    try {
      addSystemMessage(`⏳ Withdrawing from agent wallet to vault...`, 'info');
      
      let result;
      if (amount === 0 || amount >= parseFloat(agentBalance)) {
        result = await agentManager.withdrawToVault(provider);
      } else {
        result = await agentManager.withdrawAmountToVault(provider, amount.toString());
      }

      if (result.success) {
        addSystemMessage(`✅ Withdrawn ${result.amount} MNEE to vault`, 'success');
        const newBalance = await agentManager.getBalance(provider);
        setAgentBalance(newBalance);
        onAgentWalletUpdate && onAgentWalletUpdate();
        
        return {
          balance: newBalance,
          action: `WITHDRAWN ${result.amount} MNEE`,
          txHash: result.txHash
        };
      }
    } catch (err) {
      addSystemMessage(`❌ Withdrawal failed: ${err.message}`, 'danger');
    }
    return null;
  };

  // NEW: Check agent balance
  const checkAgentBalance = async () => {
    if (!agentManager || !agentManager.hasWallet()) {
      return {
        balance: '0',
        action: 'NOT_INITIALIZED'
      };
    }

    const balance = await agentManager.getBalance(provider);
    setAgentBalance(balance);
    
    return {
      balance: balance,
      action: 'BALANCE_CHECKED'
    };
  };

  const callClaude = async (userMessage, apiKey) => {
    const hasAgent = agentManager && agentManager.hasWallet();
    const systemPrompt = getSystemPrompt(trustedVendors, schedules, savingsPlans, hasAgent, agentBalance);
    const response = await fetch(AI_PROVIDERS.claude.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: AI_PROVIDERS.claude.model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });
    if (!response.ok) throw new Error('Claude API request failed');
    const data = await response.json();
    return data.content[0].text;
  };

  const callGrok = async (userMessage, apiKey) => {
    const hasAgent = agentManager && agentManager.hasWallet();
    const systemPrompt = getSystemPrompt(trustedVendors, schedules, savingsPlans, hasAgent, agentBalance);
    try {
      const response = await fetch(AI_PROVIDERS.grok.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: AI_PROVIDERS.grok.model,
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
          max_tokens: 1024,
          stream: false,
          temperature: 0.7
        })
      });
      if (!response.ok) throw new Error('Grok API request failed');
      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) throw new Error('Network error / CORS');
      throw err;
    }
  };

  const callOpenAI = async (userMessage, apiKey) => {
    const hasAgent = agentManager && agentManager.hasWallet();
    const systemPrompt = getSystemPrompt(trustedVendors, schedules, savingsPlans, hasAgent, agentBalance);
    const response = await fetch(AI_PROVIDERS.openai.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: AI_PROVIDERS.openai.model,
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
        max_tokens: 1024
      })
    });
    if (!response.ok) throw new Error('OpenAI API request failed');
    const data = await response.json();
    return data.choices[0].message.content;
  };

  const callAI = async (userMessage) => {
    const apiKey = getApiKey(selectedProvider);
    if (!apiKey) throw new Error(`No API key for ${AI_PROVIDERS[selectedProvider].name}`);

    switch (selectedProvider) {
      case 'claude': return await callClaude(userMessage, apiKey);
      case 'grok': return await callGrok(userMessage, apiKey);
      case 'openai': return await callOpenAI(userMessage, apiKey);
      default: throw new Error('Unknown provider');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    addMessage(userMessage, true);

    const apiKey = getApiKey(selectedProvider);
    if (!apiKey) {
      addSystemMessage(`MISSING KEY: ${AI_PROVIDERS[selectedProvider].name}`, 'danger');
      return;
    }

    setIsLoading(true);

    try {
      const aiResponse = await callAI(userMessage);
      const intent = parseAIResponse(aiResponse);
      const cleanResponse = aiResponse.replace(/\{[\s\S]*?"action"[\s\S]*?\}/, '').trim();
      
      if (intent) {
        switch (intent.action) {
          case 'payment':
            addMessage(cleanResponse, false, { provider: AI_PROVIDERS[selectedProvider].name });
            const paymentResult = await executePayment(intent);
            if (paymentResult) {
              setMessages(prev => {
                const updated = [...prev];
                const lastAgentMsg = updated.filter(m => !m.isUser && !m.isSystem).pop();
                if (lastAgentMsg) lastAgentMsg.payment = paymentResult;
                return updated;
              });
            }
            break;

          case 'schedule':
            const scheduleResult = createSchedule(intent);
            addMessage(cleanResponse, false, { 
              provider: AI_PROVIDERS[selectedProvider].name,
              schedule: scheduleResult
            });
            break;

          case 'savings':
            const savingsResult = await createSavingsPlan(intent);
            addMessage(cleanResponse, false, { 
              provider: AI_PROVIDERS[selectedProvider].name,
              savings: savingsResult
            });
            break;

          case 'view_schedules':
            setShowSchedulePanel(true);
            addMessage(`You have ${schedules.length} scheduled payment(s). Check the panel on the right!`, false, { 
              provider: AI_PROVIDERS[selectedProvider].name 
            });
            break;

          case 'view_savings':
            setShowSchedulePanel(true);
            addMessage(`You have ${savingsPlans.length} savings plan(s). Check the panel on the right!`, false, { 
              provider: AI_PROVIDERS[selectedProvider].name 
            });
            break;

          case 'cancel_schedule':
            cancelScheduleOrSavings('schedule', intent.id);
            addMessage(cleanResponse || 'Schedule cancelled.', false, { provider: AI_PROVIDERS[selectedProvider].name });
            break;

          case 'cancel_savings':
            cancelScheduleOrSavings('savings', intent.id);
            addMessage(cleanResponse || 'Savings plan cancelled.', false, { provider: AI_PROVIDERS[selectedProvider].name });
            break;

          // NEW: Agent wallet actions
          case 'fund_agent':
            const fundResult = await fundAgentWallet(parseFloat(intent.amount));
            addMessage(cleanResponse || 'Check the Agent Wallet panel to fund.', false, { 
              provider: AI_PROVIDERS[selectedProvider].name,
              agentWallet: fundResult
            });
            break;

          case 'withdraw_agent':
            const withdrawResult = await withdrawFromAgent(parseFloat(intent.amount) || 0);
            addMessage(cleanResponse || 'Withdrawal processed.', false, { 
              provider: AI_PROVIDERS[selectedProvider].name,
              agentWallet: withdrawResult
            });
            break;

          case 'agent_balance':
            const balanceResult = await checkAgentBalance();
            addMessage(`Your Agent Wallet balance is ${balanceResult.balance} MNEE.`, false, { 
              provider: AI_PROVIDERS[selectedProvider].name,
              agentWallet: balanceResult
            });
            break;

          default:
            addMessage(cleanResponse || aiResponse, false, { provider: AI_PROVIDERS[selectedProvider].name });
        }
      } else {
        addMessage(cleanResponse || aiResponse, false, { provider: AI_PROVIDERS[selectedProvider].name });
      }
    } catch (err) {
      addSystemMessage(`SYSTEM ERROR: ${err.message}`, 'danger');
    } finally {
      setIsLoading(false);
    }
  };

  const currentProvider = AI_PROVIDERS[selectedProvider];
  const hasSchedules = schedules.length > 0 || savingsPlans.length > 0;
  const hasAgentWallet = agentManager && agentManager.hasWallet();

  return (
    <div className="ai-wrapper">
      <div className={`ai-container ${showSchedulePanel ? 'with-panel' : ''}`}>
        <div className="chat-header">
          <div className="terminal-header">
            <img src={sentinelLogo} alt="Logo" className="site-logo" style={{ height: '20px' }} />
            <span>SENTINEL_AI_CORE // V2.2</span>
            {hasAgentWallet && (
              <span className="agent-indicator">
                <Bot size={12} /> {parseFloat(agentBalance).toFixed(0)} MNEE
              </span>
            )}
          </div>
          
          <div className="header-actions">
            <button 
              className={`schedule-toggle ${hasSchedules ? 'has-items' : ''}`}
              onClick={() => setShowSchedulePanel(!showSchedulePanel)}
              title="Schedules & Savings"
            >
              <Calendar size={16} />
              {hasSchedules && <span className="badge">{schedules.length + savingsPlans.length}</span>}
            </button>
            
            <div className="model-selector">
              <button className="select-btn" onClick={() => setShowProviderMenu(!showProviderMenu)}>
                <span className="icon">{currentProvider.icon}</span>
                {currentProvider.name}
                <ChevronDown size={14} />
              </button>
              
              <AnimatePresence>
                {showProviderMenu && (
                  <motion.div className="menu-dropdown" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
                    {Object.entries(AI_PROVIDERS).map(([key, prov]) => {
                      const hasKey = getApiKey(key);
                      return (
                        <button key={key} className={`menu-item ${!hasKey ? 'disabled' : ''}`} onClick={() => { if (hasKey) { setSelectedProvider(key); setShowProviderMenu(false); } }}>
                          {prov.icon} {prov.name}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="message-area">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isUser={msg.isUser} isSystem={msg.isSystem} />
          ))}
          {isLoading && (
            <div className="system-message info">
              <Loader size={14} className="spin" />
              <span>PROCESSING REQUEST...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-controls">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="ENTER COMMAND... (e.g., 'Save $50 every week for 1 year')"
            disabled={isLoading}
          />
          <button onClick={handleSend} disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader size={18} className="spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showSchedulePanel && (
          <motion.div 
            className="panel-wrapper"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
          >
            <SchedulePanel 
              schedules={schedules}
              savingsPlans={savingsPlans}
              onCancel={cancelScheduleOrSavings}
              onExecuteNow={executeScheduleNow}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .ai-wrapper { display: flex; gap: 16px; height: calc(100vh - 180px); min-height: 500px; }
        .ai-container { display: flex; flex-direction: column; flex: 1; border: 2px solid var(--border-color, #ffcc00); background: var(--bg-card, #2a2a2a); transition: all 0.3s ease; }
        .ai-container.with-panel { flex: 1; }
        .chat-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 2px solid var(--border-color, #ffcc00); background: var(--bg-secondary, #252525); flex-wrap: wrap; gap: 12px; }
        .terminal-header { display: flex; align-items: center; gap: 10px; font-family: var(--font-pixel); font-size: 11px; color: var(--text-primary, #ffcc00); }
        .agent-indicator { display: flex; align-items: center; gap: 4px; padding: 2px 8px; background: rgba(96, 165, 250, 0.2); color: #60a5fa; font-size: 10px; margin-left: 8px; }
        .header-actions { display: flex; align-items: center; gap: 12px; }
        .schedule-toggle { position: relative; padding: 8px 12px; background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); color: var(--text-primary, #ffcc00); cursor: pointer; transition: all 0.2s; }
        .schedule-toggle:hover { background: var(--bg-secondary, #252525); }
        .schedule-toggle.has-items { border-color: #60a5fa; color: #60a5fa; }
        .schedule-toggle .badge { position: absolute; top: -6px; right: -6px; background: #60a5fa; color: white; font-size: 10px; padding: 2px 6px; font-family: var(--font-mono); }
        .model-selector { position: relative; }
        .select-btn { display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); color: var(--text-primary, #ffcc00); font-family: var(--font-pixel); font-size: 12px; cursor: pointer; }
        .select-btn:hover { background: var(--bg-secondary, #252525); }
        .select-btn .icon { font-size: 14px; }
        .menu-dropdown { position: absolute; top: 100%; right: 0; margin-top: 4px; background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); z-index: 100; min-width: 140px; }
        .menu-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; background: none; border: none; color: var(--text-primary, #ffcc00); font-family: var(--font-pixel); font-size: 12px; cursor: pointer; text-align: left; }
        .menu-item:hover { background: var(--bg-secondary, #252525); }
        .menu-item.disabled { opacity: 0.4; cursor: not-allowed; }
        .message-area { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; background: var(--bg-primary, #1a1a1a); }
        .system-message { display: flex; align-items: center; gap: 10px; padding: 10px 14px; font-family: var(--font-mono); font-size: 12px; background: var(--bg-secondary, #252525); border-left: 3px solid var(--text-primary, #ffcc00); }
        .system-message.success { border-color: var(--accent-emerald); color: var(--accent-emerald); }
        .system-message.warning { border-color: var(--accent-amber, #ffcc00); color: var(--accent-amber, #ffcc00); }
        .system-message.danger { border-color: var(--accent-red); color: var(--accent-red); }
        .system-message.info { border-color: #60a5fa; color: #60a5fa; }
        .system-message.schedule { border-color: #60a5fa; color: #60a5fa; }
        .system-message.savings { border-color: #a855f7; color: #a855f7; }
        .system-message.agent { border-color: #60a5fa; color: #60a5fa; }
        .sys-icon { display: flex; }
        .message-bubble { max-width: 85%; padding: 12px 16px; background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); }
        .message-bubble.user { align-self: flex-end; border-color: #60a5fa; }
        .message-bubble.agent { align-self: flex-start; }
        .bubble-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border-color, #ffcc00); }
        .message-bubble.user .bubble-header { border-color: #60a5fa; }
        .sender { font-family: var(--font-pixel); font-size: 10px; color: var(--text-primary, #ffcc00); }
        .message-bubble.user .sender { color: #60a5fa; }
        .timestamp { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted, #b38f00); }
        .message-text { font-family: var(--font-mono); font-size: 13px; line-height: 1.5; color: var(--text-secondary, #e6b800); white-space: pre-wrap; }
        .payment-receipt, .schedule-card, .savings-card, .agent-card { margin-top: 12px; background: var(--bg-secondary, #252525); border: 1px solid var(--border-color, #ffcc00); padding: 10px; }
        .receipt-header, .schedule-header, .savings-header, .agent-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed var(--border-color, #ffcc00); font-family: var(--font-pixel); font-size: 10px; color: var(--text-primary, #ffcc00); }
        .status-tag { margin-left: auto; padding: 2px 8px; font-size: 9px; }
        .status-tag.executed, .status-tag.approved { background: var(--accent-emerald); color: white; }
        .status-tag.pending { background: var(--accent-amber, #ffcc00); color: black; }
        .status-tag.blocked { background: var(--accent-red); color: white; }
        .receipt-body, .schedule-body, .savings-body, .agent-body { display: flex; flex-direction: column; gap: 6px; }
        .receipt-row, .schedule-row, .savings-row, .agent-row { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 11px; color: var(--text-muted, #b38f00); }
        .mono { font-family: var(--font-mono); color: var(--text-secondary, #e6b800); }
        .bold { font-weight: 700; }
        .risk-val.low { color: var(--accent-emerald); }
        .risk-val.med { color: var(--accent-amber, #ffcc00); }
        .risk-val.high { color: var(--accent-red); }
        .route-tag { padding: 2px 6px; font-size: 10px; font-family: var(--font-pixel); }
        .route-tag.agent { background: rgba(96, 165, 250, 0.2); color: #60a5fa; }
        .route-tag.vault { background: rgba(255, 204, 0, 0.2); color: var(--text-primary, #ffcc00); }
        .via-badge { margin-left: auto; padding: 2px 6px; background: rgba(96, 165, 250, 0.2); color: #60a5fa; font-size: 9px; }
        .schedule-card { border-color: #60a5fa; }
        .schedule-header { color: #60a5fa; border-color: #60a5fa; }
        .savings-card { border-color: #a855f7; }
        .savings-header { color: #a855f7; border-color: #a855f7; }
        .agent-card { border-color: #60a5fa; }
        .agent-header { color: #60a5fa; border-color: #60a5fa; }
        .provider-tag { margin-top: 10px; font-family: var(--font-mono); font-size: 9px; color: var(--text-muted, #b38f00); text-align: right; }
        .input-controls { display: flex; padding: 16px; border-top: 2px solid var(--border-color, #ffcc00); background: var(--bg-card, #2a2a2a); }
        .input-controls input { flex: 1; padding: 14px 16px; background: var(--bg-primary, #1a1a1a); border: 2px solid var(--border-color, #ffcc00); color: var(--text-primary, #ffcc00); font-family: var(--font-mono); font-size: 14px; }
        .input-controls input::placeholder { color: var(--text-muted, #b38f00); }
        .input-controls input:focus { outline: none; border-color: #60a5fa; }
        .input-controls button { padding: 14px 20px; background: var(--text-primary, #ffcc00); color: var(--bg-primary, #1a1a1a); border: 2px solid var(--text-primary, #ffcc00); border-left: none; cursor: pointer; font-weight: 700; }
        .input-controls button:hover:not(:disabled) { background: var(--accent-emerald); border-color: var(--accent-emerald); color: white; }
        .input-controls button:disabled { opacity: 0.5; cursor: not-allowed; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .panel-wrapper { overflow: hidden; }
        .schedule-panel { width: 320px; height: 100%; background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); display: flex; flex-direction: column; }
        .panel-tabs { display: flex; border-bottom: 2px solid var(--border-color, #ffcc00); }
        .panel-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; background: var(--bg-secondary, #252525); border: none; color: var(--text-muted, #b38f00); font-family: var(--font-pixel); font-size: 10px; cursor: pointer; transition: all 0.2s; }
        .panel-tab.active { background: var(--bg-card, #2a2a2a); color: var(--text-primary, #ffcc00); }
        .panel-tab:hover:not(.active) { color: var(--text-primary, #ffcc00); }
        .panel-content { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
        .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 40px 20px; color: var(--text-muted, #b38f00); text-align: center; }
        .empty-state p { font-family: var(--font-pixel); font-size: 12px; color: var(--text-primary, #ffcc00); }
        .empty-state span { font-size: 11px; }
        .schedule-item, .savings-item { display: flex; align-items: flex-start; gap: 10px; padding: 12px; background: var(--bg-secondary, #252525); border: 1px solid var(--border-color, #ffcc00); }
        .item-icon { padding: 8px; background: rgba(96, 165, 250, 0.2); color: #60a5fa; }
        .item-icon.locked { background: rgba(168, 85, 247, 0.2); color: #a855f7; }
        .item-details { flex: 1; min-width: 0; }
        .item-title { font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--text-primary, #ffcc00); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .item-meta { display: flex; gap: 12px; font-size: 10px; color: var(--text-muted, #b38f00); }
        .item-meta span { display: flex; align-items: center; gap: 4px; }
        .agent-badge { font-size: 9px; padding: 2px 6px; background: rgba(96, 165, 250, 0.2); color: #60a5fa; margin-top: 4px; display: inline-block; }
        .savings-progress { margin: 6px 0; }
        .progress-bar { height: 6px; background: var(--bg-primary, #1a1a1a); border: 1px solid var(--border-color, #ffcc00); margin-bottom: 4px; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #a855f7, #60a5fa); transition: width 0.3s ease; }
        .savings-progress span { font-size: 10px; color: var(--text-muted, #b38f00); }
        .item-actions { display: flex; flex-direction: column; gap: 4px; }
        .action-btn { padding: 6px; background: var(--bg-card, #2a2a2a); border: 1px solid var(--border-color, #ffcc00); color: var(--text-primary, #ffcc00); cursor: pointer; transition: all 0.2s; }
        .action-btn.execute:hover { background: var(--accent-emerald); border-color: var(--accent-emerald); color: white; }
        .action-btn.cancel:hover { background: var(--accent-red); border-color: var(--accent-red); color: white; }
        .action-btn.withdraw:hover { background: #a855f7; border-color: #a855f7; color: white; }
        .locked-badge { padding: 4px 8px; background: rgba(168, 85, 247, 0.2); color: #a855f7; font-size: 9px; font-family: var(--font-pixel); }
        @media (max-width: 1024px) { .ai-wrapper { flex-direction: column; } .panel-wrapper { width: 100% !important; height: 300px; } .schedule-panel { width: 100%; } }
        @media (max-width: 768px) { .ai-wrapper { height: calc(100vh - 140px); min-height: 400px; } .chat-header { padding: 10px 14px; flex-wrap: wrap; gap: 10px; } .terminal-header { font-size: 10px; } .select-btn { padding: 6px 10px; font-size: 11px; } .message-area { padding: 14px; } .message-bubble { max-width: 92%; padding: 10px 12px; } .message-text { font-size: 12px; } .input-controls { padding: 12px; } .input-controls input { padding: 12px; font-size: 14px; } .input-controls button { padding: 12px 16px; } }
        @media (max-width: 480px) { .header-actions { gap: 8px; } .schedule-toggle { padding: 6px; } .terminal-header span { display: none; } .agent-indicator { display: none; } }
      `}</style>
    </div>
  );
}
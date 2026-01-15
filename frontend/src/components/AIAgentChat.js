import React, { useState, useRef, useEffect, useCallback } from 'react';
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
const API_URL = process.env.REACT_APP_API_URL || 'https://api.sentinelfinance.xyz';
const API_KEY = process.env.REACT_APP_API_KEY || '';
const logAgentTransaction = async (txData) => {
  try {
    const response = await fetch(`${API_URL}/api/v1/agent/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(txData)
    });
    
    if (!response.ok) {
      console.warn('Failed to log agent transaction:', await response.text());
    } else {
      console.log('✅ Agent transaction logged:', txData.tx_type);
    }
  } catch (err) {
    console.error('Error logging agent transaction:', err);
  }
};
const AI_PROVIDERS = {
  grok: {
    name: 'GROK 4',
    model: 'grok-4-latest',
    icon: '▣',
    envKey: 'REACT_APP_XAI_API_KEY',
    endpoint: 'https://api.x.ai/v1/chat/completions'
  },
  claude: {
    name: 'OPUS 4.5',
    model: 'claude-opus-4-5-20251101',
    icon: '◆',
    envKey: 'REACT_APP_ANTHROPIC_API_KEY',
    endpoint: 'https://api.anthropic.com/v1/messages'
  },
  openai: {
    name: 'GPT-4.1',
    model: 'gpt-4.1',
    icon: '●',
    envKey: 'REACT_APP_OPENAI_API_KEY',
    endpoint: 'https://api.openai.com/v1/chat/completions'
  }
};


const getSystemPrompt = (trustedVendors, schedules, savingsPlans, hasAgentWallet, agentBalance, pendingTopUp) => {
  const vendorList = trustedVendors.length > 0 ? trustedVendors.map(v => `- ${v.name}: ${v.address}`).join('\n') : '(No trusted vendors)';
  const scheduleList = schedules.length > 0 ? schedules.map(s => `- ${s.amount} MNEE to ${s.vendor} (${s.frequency})`).join('\n') : '(No scheduled payments)';
   const savingsList = savingsPlans.length > 0 ? savingsPlans.map(s => `- ${s.name}: ${s.amount} MNEE/${s.frequency} at ${s.executionTime || 'anytime'}, locked ${s.lockDays} days`).join('\n') : '(No savings plans)';
  const agentWalletInfo = hasAgentWallet ? `\n\nAGENT WALLET STATUS:\n- Connected: Yes\n- Balance: ${agentBalance} MNEE\n- Can execute automated payments without popups` : '\n\nAGENT WALLET STATUS:\n- Not initialized (user needs to set up in Agent Wallet panel)';

  const topUpContext = pendingTopUp ? `\n\n⚠️ USER NEEDS TO TOP UP AGENT WALLET: Requested ${pendingTopUp.amount} MNEE for "${pendingTopUp.reason}". Ask them to confirm the amount to fund.` : '';

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
3. SAVINGS PLANS: {"action": "savings", "name": "plan name", "amount": number, "frequency": "daily|weekly|monthly", "lockDays": number, "startTime": "HH:MM", "reason": "description"}
    - Ask user what TIME they want deposits to occur (e.g., "9:00 AM", "6:00 PM")
    - If user says "now" or "immediately", use current time
    - startTime should be in 24-hour format like "09:00" or "18:00"
    - Example: User says "save 50 MNEE daily at 9am" → startTime: "09:00"
    - Subsequent deposits occur at the SAME TIME each day/week/month automatically
4. VIEW SCHEDULES: {"action": "view_schedules"}
5. VIEW SAVINGS: {"action": "view_savings"}
6. CANCEL: {"action": "cancel_schedule", "id": "schedule_id"} or {"action": "cancel_savings", "id": "savings_id"}
7. FUND AGENT WALLET: {"action": "fund_agent", "amount": number}
8. WITHDRAW FROM AGENT: {"action": "withdraw_agent", "amount": number} (amount=0 means withdraw all)
9. CHECK AGENT BALANCE: {"action": "agent_balance"}
10. CONFIRM TOP-UP: {"action": "confirm_topup", "amount": number}
11. DEPOSIT TO SAVINGS: {"action": "deposit_savings", "planId": number, "amount": number}
    - even if the user doesnt state what he is depositing assume its mnee being deposited all the time except when eth is specifically mentioned
12. FUND AGENT WITH ETH (FOR GAS): {"action": "fund_agent_eth", "amount": number}
    - Use when user needs to add ETH for gas fees
    - Amount is in ETH (e.g., 0.01)
13. CHECK VAULT BALANCE: {"action": "vault_balance"}
    - Use when user asks about their vault/main balance
    - Shows MNEE balance in the main vault    

USER'S TRUSTED VENDORS:
${vendorList}

ACTIVE SCHEDULED PAYMENTS:
${scheduleList}

ACTIVE SAVINGS PLANS:
${savingsList}
${agentWalletInfo}
${topUpContext}

IMPORTANT BEHAVIOR:
- If user wants to schedule a payment but Agent Wallet balance is LOW, ask them to top up first
- For savings deposits, check if they want one-time or recurring, then after they inform you, process it and also ask them what they would like to name it
- ETH for gas fees for the agent comes directly from MetaMask wallet (1 confirmation)
- when a user says fund agent always assume its MNEEand ask him how much, except when eth is mentipned then you know its for gas from the main metamask wallet since sentinel finance dont hold ETH vaults which is used to deposit agent wallets
- MNEE funding for agent wallet ALWAYS comes from the Vault (2 MetaMask confirmations)
- Be conversational and if they say they want to fund wallet without stating amount ask the amount and process it, explain vault vs agent wallet routing`;

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
          {message.type === 'low-balance' && <AlertTriangle size={14} />}
        </div>
        <span>{message.content}</span>
      </motion.div>
    );
  }

  return (
    <motion.div className={`message-bubble ${isUser ? 'user' : 'agent'}`} initial={{ opacity: 0, x: isUser ? 20 : -20 }} animate={{ opacity: 1, x: 0 }}>
      <div className="bubble-header">
        <span className="sender">{isUser ? 'USER' : 'AGENT'}</span>
        <span className="timestamp">{message.time}</span>
      </div>
      
      <div className="bubble-content">
       <div className="message-text">
            {message.content}
            {message.isStreaming && <span className="streaming-cursor">▌</span>}
          </div>
        
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
              <span>SCHEDULED</span>
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

const SchedulePanel = ({ schedules, savingsPlans, onCancel, onExecuteNow, onWithdrawSavings, withdrawingPlanId }) => {
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
              const progress = Math.min(100, ((plan.totalSaved || 0) / (plan.targetAmount || 1)) * 100);
              const daysLeft = Math.max(0, Math.ceil((new Date(plan.unlockDate) - new Date()) / (1000 * 60 * 60 * 24)));
              const isUnlocked = daysLeft <= 0;
              const isWithdrawn = plan.withdrawn;
              const isWithdrawing = withdrawingPlanId === plan.id;
              
              return (
                <div key={plan.id} className={`savings-item ${isWithdrawn ? 'withdrawn' : ''}`}>
                  <div className={`item-icon ${isUnlocked ? 'unlocked' : 'locked'}`}>
                    {isWithdrawn ? <CheckCircle size={16} /> : isUnlocked ? <Wallet size={16} /> : <Lock size={16} />}
                  </div>
                  <div className="item-details">
                    <div className="item-title">{plan.name}</div>
                    <div className="savings-progress">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                      </div>
                      <span>{(plan.totalSaved || 0).toFixed(2)} / {(plan.targetAmount || 0).toFixed(2)} MNEE</span>
                    </div>
                    <div className="item-meta">
                     <span><Clock size={10} /> {plan.amount} MNEE/{plan.frequency} @ {plan.executionTime || '--:--'}</span>
                      {isWithdrawn ? (
                        <span className="withdrawn-label"><CheckCircle size={10} /> Withdrawn</span>
                      ) : isUnlocked ? (
                        <span className="unlocked-label"><Wallet size={10} /> Ready to withdraw</span>
                      ) : (
                        <span><Lock size={10} /> {daysLeft} days left</span>
                      )}
                    </div>
                  </div>
                  <div className="item-actions">
                    {isWithdrawn ? (
                      <div className="withdrawn-badge">DONE</div>
                    ) : isUnlocked ? (
                      <button 
                        className="action-btn withdraw" 
                        onClick={() => onWithdrawSavings(plan)}
                        disabled={isWithdrawing}
                        title="Withdraw to Vault"
                      >
                        {isWithdrawing ? <Loader size={12} className="spin" /> : <Wallet size={12} />}
                      </button>
                    ) : (
                      <div className="locked-badge">LOCKED</div>
                    )}
                    {!isWithdrawn && (
                      <button 
                        className="action-btn cancel" 
                        onClick={() => onCancel('savings', plan.id)} 
                        title="Cancel Plan"
                        disabled={isWithdrawing}
                      >
                        <Trash2 size={12} />
                      </button>
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

export default function AIAgentChat({
  contract, 
  account, 
  onTransactionCreated, 
  trustedVendors = [],
  agentManager = null,
  provider = null,
  signer = null,
  onAgentWalletUpdate
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
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [pendingSyncs, setPendingSyncs] = useState([]);
  const [agentBalance, setAgentBalance] = useState('0');
  const [agentEthBalance, setAgentEthBalance] = useState('0');
  const [withdrawingPlanId, setWithdrawingPlanId] = useState(null);
  const messagesEndRef = useRef(null);
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const [pendingTopUp, setPendingTopUp] = useState(null);
  const [lastBalanceCheck, setLastBalanceCheck] = useState(0);
  const executionTimerRef = useRef(null);
   const getApiKey = (providerKey) => {
    const envKey = AI_PROVIDERS[providerKey]?.envKey;
    return process.env[envKey] || localStorage.getItem(envKey);
  };

  const availableProviders = Object.entries(AI_PROVIDERS).filter(([key]) => getApiKey(key));
const calculateNextDate = (frequency, startDate = new Date(), executionTime = null) => {
    const next = new Date(startDate);
    switch (frequency) {
      case 'daily': next.setDate(next.getDate() + 1); break;
      case 'weekly': next.setDate(next.getDate() + 7); break;
      case 'monthly': next.setMonth(next.getMonth() + 1); break;
      case 'yearly': next.setFullYear(next.getFullYear() + 1); break;
      default: next.setMonth(next.getMonth() + 1);
    }
    
    if (executionTime) {
      const [hours, minutes] = executionTime.split(':').map(Number);
      next.setHours(hours, minutes, 0, 0);
    }
    
    return next.toISOString();
  };
 const loadAgentBalance = useCallback(async () => {
    if (agentManager && agentManager.hasWallet() && provider) {
      const balance = await agentManager.getBalance(provider);
      const ethBal = await agentManager.getEthBalance(provider);
      setAgentBalance(balance);
      setAgentEthBalance(ethBal);
      return parseFloat(balance);
    }
    return 0;
  }, [agentManager, provider]);

  useEffect(() => { 
    loadAgentBalance(); 
    
    const balanceInterval = setInterval(() => {
      loadAgentBalance();
    }, 10000);
    
    return () => clearInterval(balanceInterval);
  }, [loadAgentBalance]);
 useEffect(() => {
    if (agentManager && trustedVendors.length > 0) {
      agentManager.setTrustedVendors(trustedVendors);
      console.log('✅ Synced', trustedVendors.length, 'trusted vendors to agent wallet');
    }
  }, [agentManager, trustedVendors]);
   useEffect(() => {
    const initializeData = async () => {
      if (!account) return;
      
      setIsDataLoading(true);
      
      try {
        const backendLoaded = await loadFromBackend();
        const pendingKey = `sentinel_pending_sync_${account}`;
        const pendingSyncs = JSON.parse(localStorage.getItem(pendingKey) || '[]');
        if (pendingSyncs.length > 0) {
          console.log(`📤 Found ${pendingSyncs.length} pending syncs, retrying...`);
          const syncSuccess = await syncToBackend(true, true);
          if (syncSuccess) {
            localStorage.removeItem(pendingKey);
            console.log('✅ Pending syncs completed');
          }
        }
        
        if (!backendLoaded) {
          const savedSchedules = localStorage.getItem(`sentinel_schedules_${account}`);
          const savedSavings = localStorage.getItem(`sentinel_savings_${account}`);
          if (savedSchedules) setSchedules(JSON.parse(savedSchedules));
          if (savedSavings) setSavingsPlans(JSON.parse(savedSavings));
        }
        
        if (provider && agentManager?.networkConfig?.savingsContract && agentManager?.getAddress()) {
          try {
            const { syncSavingsWithBlockchain } = await import('../hooks/useSavingsData');
            const synced = await syncSavingsWithBlockchain(
              account,
              agentManager.getAddress(),
              provider,
              agentManager.networkConfig.savingsContract
            );
            if (synced) {
              console.log('🔗 Blockchain sync on load:', synced.totalLocked, 'MNEE locked');
              setSavingsPlans(synced.plans);
            }
          } catch (e) {
            console.warn('Blockchain sync on load failed:', e);
          }
        }
        
      } finally {
        setIsDataLoading(false);
      }
    };
    
    initializeData();
  }, [account, provider, agentManager]);

  useEffect(() => {
    if (account) {
      localStorage.setItem(`sentinel_schedules_${account}`, JSON.stringify(schedules));
      localStorage.setItem(`sentinel_savings_${account}`, JSON.stringify(savingsPlans));
    }
  }, [schedules, savingsPlans, account]);

 useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && account) {
        syncToBackend(true, true);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [account]);

  useEffect(() => {
    const checkAndExecuteDuePayments = async () => {
      if (!agentManager || !agentManager.hasWallet() || !provider) return;
      
      const now = new Date();
      const balance = await loadAgentBalance();
      
      for (const schedule of schedules) {
        if (schedule.paused) continue;
        const nextDate = new Date(schedule.nextDate);
        
        if (nextDate <= now) {
          if (balance >= schedule.amount) {
          
            addSystemMessage(` AUTO-EXECUTING: ${schedule.amount} MNEE to ${schedule.vendor}`, 'agent');
            try {
              const result = await agentManager.sendMNEE(provider, schedule.vendorAddress, schedule.amount.toString(), schedule.reason);
              if (result.success) {
                addSystemMessage(`✅ SENT: ${schedule.amount} MNEE to ${schedule.vendor}`, 'success');
                // LOG THE TRANSACTION
                await logAgentTransaction({
                  user_address: account,
                  agent_address: agentManager.getAddress(),
                  tx_type: 'schedule',
                  amount: schedule.amount,
                  destination: schedule.vendorAddress,
                  destination_name: schedule.vendor,
                  tx_hash: result.txHash,
                  status: 'success',
                  schedule_id: schedule.id
                });
               
                setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, nextDate: calculateNextDate(s.frequency), notified: false } : s));
                await loadAgentBalance();
                onAgentWalletUpdate && onAgentWalletUpdate();
              } else {
                addSystemMessage(`❌ FAILED: ${result.error}`, 'danger');
                await logAgentTransaction({
                  user_address: account,
                  agent_address: agentManager.getAddress(),
                  tx_type: 'schedule',
                  amount: schedule.amount,
                  destination: schedule.vendorAddress,
                  destination_name: schedule.vendor,
                  status: 'failed',
                  schedule_id: schedule.id,
                  error_message: result.error
                });
              }
            } catch (err) {
              addSystemMessage(`❌ ERROR: ${err.message}`, 'danger');
            }
          } else {
            if (!schedule.lowBalanceNotified) {
              const shortfall = schedule.amount - balance;
              addSystemMessage(`⚠️ LOW BALANCE: Can't pay ${schedule.vendor}. Need ${shortfall.toFixed(2)} more MNEE. Say "top up agent with ${Math.ceil(shortfall * 1.2)} MNEE"`, 'low-balance');
              setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, lowBalanceNotified: true } : s));
            }
          }
        }
      }

          for (const plan of savingsPlans) {
        const nextDeposit = new Date(plan.nextDeposit);
        if (nextDeposit <= now) {
          if (balance >= plan.amount) {
           
            addSystemMessage(`💰 AUTO-DEPOSITING: ${plan.amount} MNEE to "${plan.name}"`, 'savings');
           
            if (agentManager.depositToSavings && plan.contractPlanId) {
              try {
                const result = await agentManager.depositToSavings(provider, plan.contractPlanId, plan.amount.toString());
                if (result.success) {
                  addSystemMessage(`✅ DEPOSITED: ${plan.amount} MNEE to savings`, 'success');
                  
                  // LOG THE SAVINGS DEPOSIT
                  await logAgentTransaction({
                    user_address: account,
                    agent_address: agentManager.getAddress(),
                    tx_type: 'savings_deposit',
                    amount: plan.amount,
                    destination: agentManager?.networkConfig?.savingsContract || '',
                    destination_name: plan.name,
                    tx_hash: result.txHash,
                    status: 'success',
                    savings_plan_id: plan.id
                  });
                  
                  try {
                   const { syncSavingsWithBlockchain } = await import('../hooks/useSavingsData');
                    const synced = await syncSavingsWithBlockchain(
                      account,
                      agentManager?.getAddress(),
                      provider,
                      agentManager?.networkConfig?.savingsContract
                    );
                    if (synced) {
                      setSavingsPlans(synced.plans);
                    }
                  } catch (e) {}
                }
              } catch (err) {
                addSystemMessage(`❌ Deposit failed: ${err.message}`, 'danger');
                // LOG FAILED DEPOSIT
                await logAgentTransaction({
                  user_address: account,
                  agent_address: agentManager.getAddress(),
                  tx_type: 'savings_deposit',
                  amount: plan.amount,
                  destination: agentManager?.networkConfig?.savingsContract || '',
                  destination_name: plan.name,
                  status: 'failed',
                  savings_plan_id: plan.id,
                  error_message: err.message
                });
              }
            }

           setSavingsPlans(prev => prev.map(p => p.id === plan.id ? {
              ...p,
              totalSaved: (p.totalSaved || 0) + plan.amount,
              depositsCompleted: (p.depositsCompleted || 0) + 1,
              nextDeposit: calculateNextDate(p.frequency, new Date(), p.executionTime),
              notified: false
            } : p));
            await loadAgentBalance();
          } else if (!plan.lowBalanceNotified) {
            const shortfall = plan.amount - balance;
            addSystemMessage(`⚠️ LOW BALANCE: Can't deposit to "${plan.name}". Need ${shortfall.toFixed(2)} more MNEE.`, 'low-balance');
            setSavingsPlans(prev => prev.map(p => p.id === plan.id ? { ...p, lowBalanceNotified: true } : p));
          }
        }
      }
    };

    checkAndExecuteDuePayments();
    executionTimerRef.current = setInterval(checkAndExecuteDuePayments, 30000);
    
    return () => {
      if (executionTimerRef.current) clearInterval(executionTimerRef.current);
    };
  }, [schedules, savingsPlans, agentManager, provider, loadAgentBalance, onAgentWalletUpdate]);

  useEffect(() => {
    const vendorNames = trustedVendors.map(v => v.name).filter(Boolean).slice(0, 5);
    const vendorList = vendorNames.length > 0 
      ? `\n\nTRUSTED VENDORS:\n${vendorNames.join(', ')}${trustedVendors.length > 5 ? '...' : ''}`
      : '\n\n⚠️ NO TRUSTED VENDORS DETECTED.';

    const agentStatus = agentManager && agentManager.hasWallet()
      ? `\n\n⚡ AGENT WALLET: ACTIVE (${agentBalance} MNEE)`
      : '\n\n💡 TIP: Set up Agent Wallet for automated payments!';
    
    const welcomeContent = `SENTINEL AI ONLINE.\n\nCOMMANDS:\n> "PAY $50 TO [VENDOR]" - Instant payment (vault)\n> "PAY $X TO [VENDOR] EVERY MONTH" - Recurring (agent)\n> "SAVE $X EVERY WEEK FOR Y DAYS" - Savings plan\n> "FUND AGENT WITH $X" - Load agent wallet\n> "SHOW SCHEDULES" - View scheduled payments${vendorList}${agentStatus}`;

    if (!hasInitialized) {
      setMessages([{
        id: 1,
        content: welcomeContent,
        isUser: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      setHasInitialized(true);
    } else {
      setMessages(prev => prev.map(m => 
        m.id === 1 ? { ...m, content: welcomeContent } : m
      ));
    }
  }, [trustedVendors, hasInitialized, agentManager, agentBalance]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!getApiKey(selectedProvider) && availableProviders.length > 0) {
      setSelectedProvider(availableProviders[0][0]);
    }
  }, [selectedProvider, availableProviders]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

   const checkAgentBalance = async (requiredAmount, actionType = 'payment') => {
    const balance = await loadAgentBalance();
    if (balance < requiredAmount) {
      const shortfall = requiredAmount - balance;
      setPendingTopUp({ amount: requiredAmount, reason: actionType, shortfall });
      return { sufficient: false, balance, shortfall, required: requiredAmount };
    }
    setPendingTopUp(null);
    return { sufficient: true, balance };
  };

  const createSchedule = async (intent) => {
    const vendor = getVendorAddress(intent.vendor);
    const amount = parseFloat(intent.amount);
    
    const balanceCheck = await checkAgentBalance(amount, `${intent.vendor} payment`);
    if (!balanceCheck.sufficient) {
      addMessage(`⚠️ Your Agent Wallet only has ${balanceCheck.balance.toFixed(2)} MNEE, but this recurring payment needs ${amount} MNEE. Would you like to top up your Agent Wallet first? Say "top up agent with ${Math.ceil(balanceCheck.shortfall * 1.2)} MNEE"`, false, {
        provider: AI_PROVIDERS[selectedProvider].name,
        topUpPrompt: { type: 'recurring payment', required: amount, current: balanceCheck.balance, shortfall: balanceCheck.shortfall }
      });
      return null;
    }

    const startDate = intent.startDate || new Date().toISOString().split('T')[0];
    const newSchedule = {
      id: `sched_${Date.now()}`,
      vendor: vendor.name || intent.vendor,
      vendorAddress: vendor.address,
      amount: amount,
      frequency: intent.frequency || 'monthly',
      startDate: startDate,
      nextDate: calculateNextDate(intent.frequency || 'monthly', new Date(startDate)),
      reason: intent.reason || 'Scheduled payment',
      isTrusted: vendor.isTrusted,
      useAgentWallet: true,
      createdAt: new Date().toISOString(),
      notified: false,
      lowBalanceNotified: false
    };

    setSchedules(prev => [...prev, newSchedule]);
    syncToBackend(true, false);
    addSystemMessage(`✅ SCHEDULED: ${newSchedule.amount} MNEE to ${newSchedule.vendor} (${newSchedule.frequency}) via Agent Wallet`, 'schedule');
    return { vendor: newSchedule.vendor, amount: newSchedule.amount, frequency: newSchedule.frequency, nextDate: newSchedule.nextDate };
  };

  const createSavingsPlan = async (intent) => {
    const amount = parseFloat(intent.amount);
    const lockDays = parseInt(intent.lockDays) || 365;
    const frequency = intent.frequency || 'weekly';
    
    const balanceCheck = await checkAgentBalance(amount, 'savings deposit');
    if (!balanceCheck.sufficient) {
      addMessage(`Your Agent Wallet needs ${amount} MNEE for the first savings deposit, but only has ${balanceCheck.balance.toFixed(2)} MNEE. Top up your Agent Wallet to continue.`, false, {
        provider: AI_PROVIDERS[selectedProvider].name,
        topUpPrompt: { type: 'savings deposit', required: amount, current: balanceCheck.balance, shortfall: balanceCheck.shortfall }
      });
      return null;
    }

    const depositsPerPeriod = { 'daily': lockDays, 'weekly': Math.floor(lockDays / 7), 'monthly': Math.floor(lockDays / 30) };
    const totalDeposits = depositsPerPeriod[frequency] || Math.floor(lockDays / 7);
    const targetAmount = amount * totalDeposits;
    
    const unlockDate = new Date();
    unlockDate.setDate(unlockDate.getDate() + lockDays);

    let contractPlanId = null;
    let depositSucceeded = false;  
    
    if (agentManager && agentManager.createSavingsPlan) {
      addSystemMessage(`⏳ Creating savings plan on blockchain...`, 'info');
      try {
        const result = await agentManager.createSavingsPlan(provider, intent.name || `${frequency} Savings`, lockDays, amount.toString(), true);
        if (result.success) {
          contractPlanId = result.planId;
          depositSucceeded = true; 
         addSystemMessage(`✅ On-chain savings plan created${contractPlanId ? ` (ID: ${contractPlanId})` : ''}`, 'success');
          await loadAgentBalance();
          onAgentWalletUpdate && onAgentWalletUpdate();
          
          setTimeout(async () => {
            try {
              const { syncSavingsWithBlockchain } = await import('../hooks/useSavingsData');
              const synced = await syncSavingsWithBlockchain(
                account,
                agentManager?.getAddress(),
                provider,
                agentManager?.networkConfig?.savingsContract
              );
              if (synced) {
                setSavingsPlans(synced.plans);
              }
            } catch (e) {
              console.warn('Post-creation sync failed:', e);
            }
          }, 2000); 
        } else {
          addSystemMessage(`⚠️ On-chain creation failed: ${result.error}. Saving locally.`, 'warning');
        }
      } catch (err) {
        addSystemMessage(`⚠️ Contract error: ${err.message}. Saving locally.`, 'warning');
      }
    }

  const now = new Date();
    let executionTime = intent.startTime;
    if (!executionTime || executionTime === 'now') {
      executionTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    }
    
    const nextDepositDate = calculateNextDate(frequency, now, executionTime);
    
    const newPlan = {
      id: `save_${Date.now()}`,
      contractPlanId,
      name: intent.name || `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Savings`,
      amount: amount,
      frequency: frequency,
      lockDays: lockDays,
      targetAmount: targetAmount,
      totalSaved: depositSucceeded ? amount : 0,  
      totalDeposits: totalDeposits,
      depositsCompleted: depositSucceeded ? 1 : 0, 
      startDate: now.toISOString(),
      executionTime: executionTime,  
      nextDeposit: nextDepositDate,
      unlockDate: unlockDate.toISOString().split('T')[0],
      reason: intent.reason || 'Savings plan',
      createdAt: now.toISOString(),
      notified: false,
      lowBalanceNotified: false
    };

    setSavingsPlans(prev => [...prev, newPlan]);
   syncToBackend(false, true);
       addSystemMessage(`✅ SAVINGS PLAN: "${newPlan.name}" - ${amount} MNEE/${frequency} at ${executionTime} for ${lockDays} days`, 'savings');
    
    return {
      name: newPlan.name,
      amount: newPlan.amount,
      frequency: newPlan.frequency,
      lockDays: newPlan.lockDays,
      unlockDate: newPlan.unlockDate,
      targetAmount: newPlan.targetAmount
    };
  };

  const executeScheduleNow = async (schedule) => {
    if (agentManager && agentManager.hasWallet() && schedule.useAgentWallet) {
      const balance = parseFloat(await agentManager.getBalance(provider));
      if (balance >= schedule.amount && schedule.vendorAddress) {
        addSystemMessage(` AUTO-EXECUTING: ${schedule.amount} MNEE to ${schedule.vendor}`, 'agent');
        try {
          const result = await agentManager.sendMNEE(
            provider,
            schedule.vendorAddress,
            schedule.amount.toString(),
            schedule.reason
          );
          if (result.success) {
            addSystemMessage(`✅ PAID: ${schedule.amount} MNEE to ${schedule.vendor}`, 'success');
            // Log the transaction to backend
      await logAgentTransaction({
        user_address: account,
        agent_address: agentManager.getAddress(),
        tx_type: 'schedule',
        amount: schedule.amount,
        destination: schedule.vendorAddress,
        destination_name: schedule.vendor,
        tx_hash: result.txHash,
        status: 'success',
        schedule_id: schedule.id
      });
            setSchedules(prev => prev.map(s => 
              s.id === schedule.id 
                ? { ...s, nextDate: calculateNextDate(s.frequency), notified: false }
                : s
            ));
            await loadAgentBalance();
            onAgentWalletUpdate && onAgentWalletUpdate();
            return;
          }
        } catch (err) {
          addSystemMessage(`❌ FAILED: ${err.message}. Falling back to vault...`, 'danger');
          // Log failed transaction
          await logAgentTransaction({
            user_address: account,
            agent_address: agentManager.getAddress(),
            tx_type: 'schedule',
            amount: schedule.amount,
            destination: schedule.vendorAddress,
            destination_name: schedule.vendor,
            status: 'failed',
            schedule_id: schedule.id,
            error_message: err.message
          });
        }
      }
    };

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

  const fundAgentWallet = async (amount) => {
  if (!agentManager) {
    addSystemMessage(`❌ Agent wallet not initialized. Open Agent Wallet panel first.`, 'danger');
    return null;
  }
  
  if (!agentManager.hasWallet()) {
    addSystemMessage(`❌ Agent wallet not set up. Click the bot icon in header to initialize.`, 'danger');
    return null;
  }

  if (!signer || !contract) {
    addSystemMessage(`❌ Wallet or vault not connected.`, 'danger');
    return null;
  }

  try {
    const agentAddress = agentManager.getAddress();
    if (!agentAddress) {
      addSystemMessage(`❌ Could not get agent wallet address.`, 'danger');
      return null;
    }

    const amountWei = ethers.parseUnits(amount.toString(), 18);

    let vaultBal;
    try {
      vaultBal = await contract.getVaultBalance();
    } catch (e) {
      addSystemMessage(`❌ Could not get vault balance: ${e.message}`, 'danger');
      return null;
    }

    const vaultBalFormatted = parseFloat(ethers.formatUnits(vaultBal, 18)).toFixed(2);

    if (vaultBal < amountWei) {
      addSystemMessage(`❌ Insufficient vault balance. You have ${vaultBalFormatted} MNEE in vault.`, 'danger');
      addSystemMessage(`💡 Deposit more MNEE to your vault first using the DEPOSIT button.`, 'info');
      return null;
    }

    addSystemMessage(`⏳ Step 1/2: Withdrawing ${amount} MNEE from vault...`, 'info');
    addSystemMessage(`💡 Please confirm the withdrawal in MetaMask.`, 'info');
    
    const withdrawTx = await contract.withdraw(amountWei);
    await withdrawTx.wait();
    addSystemMessage(`✅ Withdrawn from vault.`, 'success');

    const MNEE_ADDRESS = agentManager.networkConfig?.mneeToken || '0x250ff89cf1518F42F3A4c927938ED73444491715';
    const ERC20_ABI = [
      'function transfer(address to, uint256 amount) returns (bool)',
      'function balanceOf(address account) view returns (uint256)'
    ];
    const mneeContract = new ethers.Contract(MNEE_ADDRESS, ERC20_ABI, signer);

    addSystemMessage(`⏳ Step 2/2: Transferring to agent wallet...`, 'info');
    addSystemMessage(`💡 Please confirm the transfer in MetaMask.`, 'info');
    
    const transferTx = await mneeContract.transfer(agentAddress, amountWei);
    const receipt = await transferTx.wait();
    
    if (receipt.status === 1) {
      addSystemMessage(`✅ Funded agent wallet with ${amount} MNEE from vault!`, 'success');
      await loadAgentBalance();
      onAgentWalletUpdate && onAgentWalletUpdate();
      onTransactionCreated && onTransactionCreated();
      return { 
        success: true, 
        balance: await agentManager.getBalance(provider), 
        txHash: receipt.hash,
        source: 'vault'
      };
    } else {
      addSystemMessage(`❌ Transfer transaction failed.`, 'danger');
      return null;
    }
    
  } catch (err) {
    console.error('Fund agent error:', err);
    if (err.code === 'ACTION_REJECTED' || err.code === 4001) {
      addSystemMessage(`❌ Transaction cancelled by user.`, 'warning');
    } else {
      addSystemMessage(`❌ Failed to fund agent: ${err.reason || err.message}`, 'danger');
    }
    return null;
  }
};
 const fundAgentWithEth = async (amount) => {
  if (!agentManager?.hasWallet()) {
    addSystemMessage(`❌ Agent wallet not set up.`, 'danger');
    return null;
  }
  if (!signer || !provider) {
    addSystemMessage(`❌ Wallet not connected.`, 'danger');
    return null;
  }
  
  try {
   
    const userAddress = await signer.getAddress();
    const ethBalance = await provider.getBalance(userAddress);
    const amountWei = ethers.parseEther(amount.toString());
    
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    const estimatedGas = BigInt(21000) * gasPrice;
    const totalNeeded = amountWei + estimatedGas;
    
    if (ethBalance < totalNeeded) {
      const ethBalFormatted = parseFloat(ethers.formatEther(ethBalance)).toFixed(4);
      const neededFormatted = parseFloat(ethers.formatEther(totalNeeded)).toFixed(4);
      addSystemMessage(`❌ Insufficient ETH in MetaMask wallet.`, 'danger');
      addSystemMessage(`💰 You have: ${ethBalFormatted} ETH`, 'info');
      addSystemMessage(`💰 You need: ~${neededFormatted} ETH (${amount} + gas)`, 'info');
      addSystemMessage(`💡 Get Sepolia ETH from: https://cloud.google.com/application/web3/faucet/ethereum/sepolia`, 'info');
      return null;
    }
    
    addSystemMessage(`⏳ Sending ${amount} ETH for gas from MetaMask...`, 'info');
    addSystemMessage(`💡 Confirm the ETH transfer in MetaMask.`, 'info');
    
    const result = await agentManager.fundWithEth(signer, amount);
    
    if (result.success) {
      addSystemMessage(`✅ Sent ${amount} ETH to agent wallet for gas!`, 'success');
      const newEthBal = await agentManager.getEthBalance(provider);
      addSystemMessage(`⛽ Agent ETH balance: ${parseFloat(newEthBal).toFixed(4)} ETH`, 'info');
      await loadAgentBalance();
      onAgentWalletUpdate && onAgentWalletUpdate();
      return result;
    } else {
      addSystemMessage(`❌ ${result.error}`, 'danger');
    }
  } catch (err) {
    console.error('Fund ETH error:', err);
    if (err.code === 'ACTION_REJECTED' || err.code === 4001) {
      addSystemMessage(`❌ Transaction cancelled.`, 'warning');
    } else if (err.message?.includes('insufficient funds')) {
      addSystemMessage(`❌ Insufficient ETH for transfer + gas fees.`, 'danger');
    } else {
      addSystemMessage(`❌ ${err.reason || err.message}`, 'danger');
    }
  }
  return null;
};
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
        await loadAgentBalance();
        onAgentWalletUpdate && onAgentWalletUpdate();
        
        return {
          balance: await agentManager.getBalance(provider),
          action: `WITHDRAWN ${result.amount} MNEE`,
          txHash: result.txHash
        };
      }
    } catch (err) {
      addSystemMessage(`❌ Withdrawal failed: ${err.message}`, 'danger');
    }
    return null;
  };
const withdrawFromSavingsPlan = async (plan) => {
    if (!agentManager || !agentManager.hasWallet()) {
      addSystemMessage(`❌ Agent wallet not available.`, 'danger');
      return;
    }

    if (!plan.contractPlanId && plan.contractPlanId !== 0) {
      addSystemMessage(`❌ No on-chain plan ID found. This plan may be local-only.`, 'danger');
      return;
    }

    setWithdrawingPlanId(plan.id);

    try {
      // Check ETH balance first
      const ethBal = await agentManager.getEthBalance(provider);
      if (parseFloat(ethBal) < 0.0001) {
        addSystemMessage(`⚠️ Agent wallet needs ETH for gas to withdraw.`, 'warning');
        addSystemMessage(`💡 Say "fund agent with 0.01 eth" to add gas, then try again.`, 'info');
        setWithdrawingPlanId(null);
        return;
      }

      addSystemMessage(`⏳ Withdrawing savings plan "${plan.name}" to vault...`, 'info');

      const result = await agentManager.withdrawFromSavings(provider, plan.contractPlanId);

      if (result.success) {
        addSystemMessage(`✅ Withdrawn ${plan.totalSaved || plan.amount} MNEE to vault!`, 'success');
        
        // Update plan as withdrawn
        setSavingsPlans(prev => prev.map(p => 
          p.id === plan.id ? { ...p, withdrawn: true } : p
        ));
        
        // Sync to backend
        syncToBackend(false, true);
        
        // Refresh balances
        onAgentWalletUpdate && onAgentWalletUpdate();
        onTransactionCreated && onTransactionCreated();
      } else {
        if (result.daysRemaining) {
          addSystemMessage(`❌ Plan still locked. ${result.daysRemaining} days remaining.`, 'danger');
        } else if (result.needsGas) {
          addSystemMessage(`❌ No ETH for gas. Fund agent wallet with ETH first.`, 'danger');
          addSystemMessage(`💡 Say "fund agent with 0.01 eth" to add gas.`, 'info');
        } else {
          addSystemMessage(`❌ ${result.error}`, 'danger');
        }
      }
    } catch (err) {
      console.error('Withdraw savings error:', err);
      addSystemMessage(`❌ Withdrawal failed: ${err.message}`, 'danger');
    } finally {
      setWithdrawingPlanId(null);
    }
  };
  const checkAgentBalanceAction = async () => {
    if (!agentManager || !agentManager.hasWallet()) {
      return {
        balance: '0',
        action: 'NOT_INITIALIZED'
      };
    }

    const balance = await agentManager.getBalance(provider);
    setAgentBalance(balance);
    
    return {
      balance,
      action: 'BALANCE_CHECKED'
    };
  };
  const cancelScheduleOrSavings = async (type, id) => {
    if (type === 'schedule') {
      setSchedules(prev => prev.filter(s => s.id !== id));
     
      const stored = JSON.parse(localStorage.getItem(`sentinel_schedules_${account}`) || '[]');
      const updated = stored.filter(s => s.id !== id);
      localStorage.setItem(`sentinel_schedules_${account}`, JSON.stringify(updated));
      
      try {
        await fetch(`${API_URL}/api/v1/recurring/schedule/${id}`, {
          method: 'DELETE',
          headers: { 'X-API-Key': API_KEY }
        });
      } catch (err) {
        console.error('Backend delete failed:', err);
      }
      
      addSystemMessage(`🗑️ Schedule cancelled successfully`, 'info');
   } else if (type === 'savings') {
    
      const plan = savingsPlans.find(p => p.id === id);
      
     
      if (plan?.contractPlanId && agentManager?.cancelSavingsPlan) {
        addSystemMessage(`⏳ Cancelling savings plan on blockchain...`, 'info');
        
        try {
          const result = await agentManager.cancelSavingsPlan(provider, plan.contractPlanId);
          
          if (result.success) {
            addSystemMessage(`✅ Plan cancelled - ${plan.totalSaved || 0} MNEE returned to vault`, 'success');
            
           
            try {
              const { syncSavingsWithBlockchain } = await import('../hooks/useSavingsData');
              await syncSavingsWithBlockchain(
                account,
                agentManager.getAddress(),
                provider,
                agentManager.networkConfig.savingsContract
              );
            } catch (e) {
              console.warn('Post-cancel sync failed:', e);
            }
            
            // Refresh vault/wallet balances
            onAgentWalletUpdate && onAgentWalletUpdate();
          } else {
            addSystemMessage(`❌ Cancel failed: ${result.error}`, 'danger');
            return; // Don't remove from local if contract call failed
          }
        } catch (err) {
          addSystemMessage(`❌ Cancel failed: ${err.message}`, 'danger');
          return;
        }
      }
      
      // Remove from local state
      setSavingsPlans(prev => prev.filter(p => p.id !== id));
      const stored = JSON.parse(localStorage.getItem(`sentinel_savings_${account}`) || '[]');
      const updated = stored.filter(p => p.id !== id);
      localStorage.setItem(`sentinel_savings_${account}`, JSON.stringify(updated));
      
      // Delete from backend
      try {
        await fetch(`${API_URL}/api/v1/savings/plan/${id}`, {
          method: 'DELETE',
          headers: { 'X-API-Key': API_KEY }
        });
      } catch (err) {
        console.error('Backend delete failed:', err);
      }
      
      addSystemMessage(`🗑️ Savings plan cancelled successfully`, 'info');
    }
  }
const syncToBackend = async (syncSchedules = true, syncSavings = true, retryCount = 0) => {
    if (!account) return false;
    
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second
    
    try {
      const data = {
        user_address: account,
        schedules: [],
        savings_plans: []
      };
      
      if (syncSchedules) {
        const localSchedules = JSON.parse(localStorage.getItem(`sentinel_schedules_${account}`) || '[]');
        data.schedules = localSchedules.map(s => ({
          id: s.id,
          user_address: account,
          agent_address: agentManager?.getAddress() || '',
          vault_address: contract?.target || '',
          payment_type: 'vendor',
          vendor: s.vendor || s.name,
          vendor_address: s.vendorAddress || s.recipient,
          amount: parseFloat(s.amount),
          frequency: s.frequency,
          execution_time: s.executionTime || '09:00',
          start_date: s.createdAt || new Date().toISOString(),
          next_execution: s.nextRun,
          reason: s.reason || '',
          is_trusted: s.isTrusted || false,
          is_active: !s.paused
        }));
      }
      
      if (syncSavings) {
        const localPlans = JSON.parse(localStorage.getItem(`sentinel_savings_${account}`) || '[]');
        data.savings_plans = localPlans.map(p => ({
          id: p.id,
          user_address: account,
          agent_address: agentManager?.getAddress() || '',
          vault_address: contract?.target || '',
          contract_plan_id: p.contractPlanId || null,
          name: p.name,
          amount: parseFloat(p.amount),
          frequency: p.frequency || 'monthly',
          lock_days: parseInt(p.lockDays) || 30,
          execution_time: p.executionTime || '09:00',
          start_date: p.createdAt || new Date().toISOString(),
          next_deposit: p.nextDeposit,
          unlock_date: p.unlockDate,
          target_amount: parseFloat(p.targetAmount) || parseFloat(p.amount) * 12,
          total_saved: parseFloat(p.totalSaved || p.totalDeposited) || 0,
          is_active: p.status === 'active' || !p.paused,
          withdrawn: p.withdrawn || false
        }));
      }
      
      const response = await fetch(`${API_URL}/api/v1/recurring/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`Sync failed: ${response.status}`);
      }
      
      console.log('✅ Backend sync successful');
      return true;
      
    } catch (error) {
      console.error(`❌ Backend sync failed (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error);
      
      if (retryCount < MAX_RETRIES - 1) {
        console.log(`⏳ Retrying sync in ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return syncToBackend(syncSchedules, syncSavings, retryCount + 1);
      }
      
      const pendingKey = `sentinel_pending_sync_${account}`;
      const pending = JSON.parse(localStorage.getItem(pendingKey) || '[]');
      pending.push({
        timestamp: new Date().toISOString(),
        syncSchedules,
        syncSavings
      });
      localStorage.setItem(pendingKey, JSON.stringify(pending));
      console.warn('⚠️ Sync failed after retries. Marked as pending.');
      
      return false;
    }
  };

const loadFromBackend = async () => {
    if (!account) return false;
    
    const localSchedules = JSON.parse(localStorage.getItem(`sentinel_schedules_${account}`) || '[]');
    const localPlans = JSON.parse(localStorage.getItem(`sentinel_savings_${account}`) || '[]');
    
    try {
      const response = await fetch(`${API_URL}/api/v1/recurring/${account}`, {
        headers: { 'X-API-Key': API_KEY }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        const backendSchedules = (data.schedules || []).map(s => ({
          id: s.id,
          vendor: s.vendor,
          vendorAddress: s.vendor_address,
          amount: s.amount,
          frequency: s.frequency,
          executionTime: s.execution_time,
          nextRun: s.next_execution,
          reason: s.reason,
          isTrusted: s.is_trusted,
          paused: !s.is_active,
          createdAt: s.created_at,
          executionCount: s.execution_count || 0,
          lastExecuted: s.last_executed,
          useAgentWallet: true
        }));
        
        const backendPlans = (data.savingsPlans || []).map(p => ({
          id: p.id,
          name: p.name,
          amount: p.amount,
          frequency: p.frequency,
          lockDays: p.lock_days,
          executionTime: p.execution_time,
          nextDeposit: p.next_deposit,
          unlockDate: p.unlock_date,
          targetAmount: p.target_amount,
          totalSaved: p.total_saved,
          totalDeposited: p.total_saved,
          status: p.is_active ? 'active' : 'paused',
          paused: !p.is_active,
          withdrawn: p.withdrawn,
          createdAt: p.created_at,
          contractPlanId: p.contract_plan_id
        }));
        
       const backendScheduleIds = new Set(backendSchedules.map(s => s.id));
        const backendPlanIds = new Set(backendPlans.map(p => p.id));
        
        const localOnlySchedules = localSchedules.filter(s => !backendScheduleIds.has(s.id));
        const localOnlyPlans = localPlans.filter(p => !backendPlanIds.has(p.id));
        
        const smartMergedPlans = backendPlans.map(bp => {
          const localPlan = localPlans.find(lp => lp.id === bp.id);
          if (localPlan) {
            return {
              ...bp,
              totalSaved: Math.max(bp.totalSaved || 0, localPlan.totalSaved || 0),
              totalDeposited: Math.max(bp.totalDeposited || 0, localPlan.totalDeposited || 0),
              depositsCompleted: Math.max(bp.depositsCompleted || 0, localPlan.depositsCompleted || 0),
              contractPlanId: bp.contractPlanId || localPlan.contractPlanId,
              executionTime: bp.executionTime || localPlan.executionTime || '09:00'
            };
          }
          return bp;
        });
        
        const mergedSchedules = [...backendSchedules, ...localOnlySchedules];
        const mergedPlans = [...smartMergedPlans, ...localOnlyPlans];
        
        setSchedules(mergedSchedules);
        setSavingsPlans(mergedPlans);
        
        localStorage.setItem(`sentinel_schedules_${account}`, JSON.stringify(mergedSchedules));
        localStorage.setItem(`sentinel_savings_${account}`, JSON.stringify(mergedPlans));
        
        console.log('✅ Loaded from backend:', backendSchedules.length, 'schedules,', backendPlans.length, 'plans');
        if (localOnlySchedules.length || localOnlyPlans.length) {
          console.log('📦 Kept local-only:', localOnlySchedules.length, 'schedules,', localOnlyPlans.length, 'plans');
          console.log('🔄 Syncing local-only items to backend...');
          syncToBackend(localOnlySchedules.length > 0, localOnlyPlans.length > 0);
        }
        return true;
      }
    } catch (error) {
      console.error('Backend load failed, using localStorage:', error);
    }
    
    setSchedules(localSchedules);
    setSavingsPlans(localPlans);
    return false;
  };


  const buildConversationHistory = (maxMessages = 10) => {
    const conversationMessages = messages
      .filter(m => !m.isSystem)
      .slice(-maxMessages) 
      .map(m => ({
        role: m.isUser ? 'user' : 'assistant',
        content: m.content
      }));
    
    return conversationMessages;
  };
 const callClaude = async (userMessage, apiKey, onChunk) => {
    const hasAgent = agentManager && agentManager.hasWallet();
    const systemPrompt = getSystemPrompt(trustedVendors, schedules, savingsPlans, hasAgent, agentBalance, pendingTopUp);
    
    const conversationHistory = buildConversationHistory(5);

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
        max_tokens: 512,
        system: systemPrompt,
        messages: [
          ...conversationHistory,
          { role: 'user', content: userMessage }
        ],
        stream: true
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data.trim() === '') continue;

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta') {
            const content = parsed.delta?.text || '';
            if (content) {
              fullResponse += content;
              onChunk && onChunk(fullResponse);
            }
          }
        } catch (e) {}
      }
    }

    return fullResponse;
  };

 const callGrok = async (userMessage, apiKey, onChunk) => {
    const hasAgent = agentManager && agentManager.hasWallet();
    const systemPrompt = getSystemPrompt(trustedVendors, schedules, savingsPlans, hasAgent, agentBalance, pendingTopUp);
    
    const conversationHistory = buildConversationHistory(5);
    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    const response = await fetch(AI_PROVIDERS.grok.endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${apiKey}` 
      },
      body: JSON.stringify({ 
        model: AI_PROVIDERS.grok.model, 
        messages: allMessages, 
        max_tokens: 512,
        stream: true
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            onChunk && onChunk(fullResponse);
          }
        } catch (e) {}
      }
    }

    return fullResponse;
  };

 const callOpenAI = async (userMessage, apiKey, onChunk) => {
    const hasAgent = agentManager && agentManager.hasWallet();
    const systemPrompt = getSystemPrompt(trustedVendors, schedules, savingsPlans, hasAgent, agentBalance, pendingTopUp);
    
    const conversationHistory = buildConversationHistory(5);
    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];
    
    const response = await fetch(AI_PROVIDERS.openai.endpoint, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${apiKey}` 
      },
      body: JSON.stringify({ 
        model: AI_PROVIDERS.openai.model, 
        messages: allMessages, 
        max_tokens: 512,
        stream: true
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            onChunk && onChunk(fullResponse);
          }
        } catch (e) {}
      }
    }

    return fullResponse;
  };

  const callAI = async (userMessage, onChunk) => {
    const apiKey = getApiKey(selectedProvider);
    if (!apiKey) throw new Error('No API key found');
    
    switch (selectedProvider) {
      case 'claude': return await callClaude(userMessage, apiKey, onChunk);
      case 'grok': return await callGrok(userMessage, apiKey, onChunk);
      case 'openai': return await callOpenAI(userMessage, apiKey, onChunk);
      default: return await callGrok(userMessage, apiKey, onChunk);
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
      const streamId = `stream_${Date.now()}`;
      setStreamingMessageId(streamId);
      
      setMessages(prev => [...prev, {
        id: streamId,
        content: '...',
        isUser: false,
        isStreaming: true,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        provider: AI_PROVIDERS[selectedProvider].name
      }]);

      const aiResponse = await callAI(userMessage, (partialResponse) => {
        setMessages(prev => prev.map(m => 
          m.id === streamId 
            ? { ...m, content: partialResponse.replace(/\{[\s\S]*?"action"[\s\S]*?\}/, '').trim() || '...' }
            : m
        ));
      });

      setMessages(prev => prev.map(m => 
        m.id === streamId ? { ...m, isStreaming: false } : m
      ));
      setStreamingMessageId(null);

      const intent = parseAIResponse(aiResponse);
      const cleanResponse = aiResponse.replace(/\{[\s\S]*?"action"[\s\S]*?\}/, '').trim();
      
      setMessages(prev => prev.map(m => 
        m.id === streamId ? { ...m, content: cleanResponse || 'Done!' } : m
      ));
      
      if (intent) {
        switch (intent.action) {
          case 'payment':
            // Update existing streaming message instead of adding new one
            const paymentResult = await executePayment(intent);
            setMessages(prev => prev.map(m => 
              m.id === streamId 
                ? { ...m, content: cleanResponse, payment: paymentResult, provider: AI_PROVIDERS[selectedProvider].name }
                : m
            ));
            break;

          case 'schedule':
            const scheduleResult = await createSchedule(intent);
            // Update existing streaming message instead of adding new one
            setMessages(prev => prev.map(m => 
              m.id === streamId 
                ? { ...m, content: cleanResponse, schedule: scheduleResult, provider: AI_PROVIDERS[selectedProvider].name }
                : m
            ));
            break;

          case 'savings':
            const savingsResult = await createSavingsPlan(intent);
            // Update existing streaming message instead of adding new one
            setMessages(prev => prev.map(m => 
              m.id === streamId 
                ? { ...m, content: cleanResponse, savings: savingsResult, provider: AI_PROVIDERS[selectedProvider].name }
                : m
            ));
            break;

          case 'view_schedules':
            setShowSchedulePanel(true);
            setMessages(prev => prev.map(m => 
              m.id === streamId 
                ? { ...m, content: `You have ${schedules.length} scheduled payment(s). Check the panel on the right!`, provider: AI_PROVIDERS[selectedProvider].name }
                : m
            ));
            break;

          case 'view_savings':
            setShowSchedulePanel(true);
            setMessages(prev => prev.map(m => 
              m.id === streamId 
                ? { ...m, content: `You have ${savingsPlans.length} savings plan(s). Check the panel on the right!`, provider: AI_PROVIDERS[selectedProvider].name }
                : m
            ));
            break;

          case 'cancel_schedule':
            cancelScheduleOrSavings('schedule', intent.id);
            setMessages(prev => prev.map(m => 
              m.id === streamId 
                ? { ...m, content: cleanResponse || 'Schedule cancelled.', provider: AI_PROVIDERS[selectedProvider].name }
                : m
            ));
            break;

          case 'cancel_savings':
            cancelScheduleOrSavings('savings', intent.id);
            setMessages(prev => prev.map(m => 
              m.id === streamId 
                ? { ...m, content: cleanResponse || 'Savings plan cancelled.', provider: AI_PROVIDERS[selectedProvider].name }
                : m
            ));
            break;

          case 'fund_agent':
            const fundResult = await fundAgentWallet(parseFloat(intent.amount));
            setMessages(prev => prev.map(m => 
              m.id === streamId 
                ? { ...m, content: cleanResponse || 'Check the Agent Wallet panel to fund.', agentWallet: fundResult, provider: AI_PROVIDERS[selectedProvider].name }
                : m
            ));
            break;

          case 'fund_agent_eth':
            const ethResult = await fundAgentWithEth(intent.amount);
            setMessages(prev => prev.map(m => 
              m.id === streamId 
                ? { ...m, content: ethResult?.success ? `Funded agent wallet with ${ethResult.amount} ETH for gas.` : (cleanResponse || 'Use the Agent Wallet panel to fund with ETH.'), provider: AI_PROVIDERS[selectedProvider].name }
                : m
            ));
            break;

          case 'withdraw_agent':
            const withdrawResult = await withdrawFromAgent(parseFloat(intent.amount) || 0);
            setMessages(prev => prev.map(m => 
              m.id === streamId 
                ? { ...m, content: cleanResponse || (withdrawResult ? `Withdrawn. New balance: ${withdrawResult.balance} MNEE` : 'Withdrawal failed.'), agentWallet: withdrawResult, provider: AI_PROVIDERS[selectedProvider].name }
                : m
            ));
            break;

          case 'agent_balance':
            const balanceResult = await checkAgentBalanceAction();
            setMessages(prev => prev.map(m => 
              m.id === streamId 
                ? { ...m, content: `Your Agent Wallet balance is ${balanceResult.balance} MNEE.`, agentWallet: balanceResult, provider: AI_PROVIDERS[selectedProvider].name }
                : m
            ));
            break;

          case 'vault_balance':
            try {
              if (!contract) {
                addSystemMessage(`❌ Vault not connected.`, 'danger');
                break;
              }
              const vaultBal = await contract.getVaultBalance();
              const formatted = ethers.formatUnits(vaultBal, 18);
              const balanceValue = parseFloat(formatted).toFixed(2);
              
              setMessages(prev => prev.map(m => 
                m.id === streamId 
                  ? { ...m, content: cleanResponse || `Your vault balance is ${balanceValue} MNEE.`, vaultInfo: { balance: balanceValue, action: 'VAULT_BALANCE_CHECKED' }, provider: AI_PROVIDERS[selectedProvider].name }
                  : m
              ));
              
              addSystemMessage(`💰 VAULT BALANCE: ${balanceValue} MNEE`, 'success');
            } catch (err) {
              console.error('Vault balance error:', err);
              addSystemMessage(`❌ Could not get vault balance: ${err.message}`, 'danger');
            }
            break;  

          case 'confirm_topup':
            await fundAgentWallet(intent.amount);
            setMessages(prev => prev.map(m => 
              m.id === streamId 
                ? { ...m, content: `Please confirm the ${intent.amount} MNEE transfer in the Agent Wallet panel.`, provider: AI_PROVIDERS[selectedProvider].name }
                : m
            ));
            break;

          default:
            // Already updated via streaming, no action needed
            break;
        }
      }
      // If no intent, the streaming message already has the response
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
            <img src={sentinelLogo} alt="Sentinel" className="site-logo" style={{ height: '20px' }} />
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
              onWithdrawSavings={withdrawFromSavingsPlan}
              withdrawingPlanId={withdrawingPlanId}
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
        .message-area { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 14px; background: var(--bg-primary, #1a1a1a); }
        .system-message { display: flex; align-items: center; gap: 10px; padding: 10px 14px; font-family: var(--font-mono); font-size: 12px; background: var(--bg-secondary, #252525); border-left: 3px solid var(--text-primary, #ffcc00); }
        .system-message.success { border-color: var(--accent-emerald); color: var(--accent-emerald); }
        .system-message.warning { border-color: var(--accent-amber, #ffcc00); color: var(--accent-amber, #ffcc00); }
        .system-message.danger { border-color: var(--accent-red); color: var(--accent-red); }
        .system-message.info { border-color: #60a5fa; color: #60a5fa; }
        .system-message.schedule { border-color: #60a5fa; color: #60a5fa; }
        .system-message.savings { border-color: #a855f7; color: #a855f7; }
        .system-message.agent { border-color: #60a5fa; color: #60a5fa; }
        .system-message.low-balance { background: rgba(255, 59, 48, 0.15); border-color: var(--accent-red); color: var(--accent-red); }
        .sys-icon { display: flex; }
        .message-bubble { max-width: 85%; padding: 12px 16px; background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); }
        .message-bubble.user { align-self: flex-end; border-color: #60a5fa; }
        .message-bubble.agent { align-self: flex-start; }
        .bubble-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border-color, #ffcc00); }
        .message-bubble.user .bubble-header { border-color: #60a5fa; }
        .sender { font-family: var(--font-pixel); font-size: 10px; color: var(--text-secondary, #e6b800); }
        .message-bubble.user .sender { color: #60a5fa; }
        .timestamp { font-family: var(--font-mono); font-size: 10px; color: var(--text-muted, #b38f00); }
        .message-text { font-family: var(--font-mono); font-size: 13px; line-height: 1.5; color: var(--text-secondary, #e6b800); white-space: pre-wrap; }
        .payment-receipt, .schedule-card, .savings-card, .agent-card { margin-top: 12px; background: var(--bg-secondary, #252525); border: 1px solid var(--border-color, #ffcc00); padding: 10px; }
        .receipt-header, .schedule-header, .savings-header, .agent-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px dashed var(--border-color, #ffcc00); font-family: var(--font-pixel); font-size: 10px; color: var(--text-muted, #b38f00); }
        .receipt-body, .schedule-body, .savings-body, .agent-body { display: flex; flex-direction: column; gap: 6px; }
        .receipt-row, .sched-row, .save-row, .agent-row { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 11px; color: var(--text-muted, #b38f00); }
        .receipt-row span:first-child, .sched-row span:first-child, .save-row span:first-child, .agent-row span:first-child { color: var(--text-muted, #b38f00); }
        .mono { font-family: var(--font-mono); color: var(--text-secondary, #e6b800); }
        .bold { font-weight: 700; }
        .status-tag { margin-left: auto; padding: 2px 8px; font-size: 9px; }
        .status-tag.executed, .status-tag.approved { background: var(--accent-emerald); color: white; }
        .status-tag.pending { background: var(--accent-amber); color: black; }
        .status-tag.blocked { background: var(--accent-red); color: white; }
        .route-tag { padding: 2px 6px; font-size: 9px; font-weight: 700; }
        .route-tag.agent { background: rgba(96, 165, 250, 0.2); color: #60a5fa; }
        .route-tag.vault { background: rgba(255, 204, 0, 0.2); color: var(--text-primary, #ffcc00); }
        .via-badge { margin-left: auto; padding: 2px 6px; background: rgba(96, 165, 250, 0.2); color: #60a5fa; font-size: 9px; }
        .schedule-card { border-color: #60a5fa; }
        .schedule-header { color: #60a5fa; border-color: #60a5fa; }
        .savings-card { border-color: #a855f7; }
        .savings-header { color: #a855f7; border-color: #a855f7; }
        .agent-card { border-color: #60a5fa; }
        .agent-header { color: #60a5fa; border-color: #60a5fa; }
        .topup-prompt { margin-top: 12px; padding: 12px; background: rgba(255, 59, 48, 0.1); border: 2px solid var(--accent-red); }
        .topup-header { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; color: var(--accent-red); margin-bottom: 10px; }
        .topup-body { font-size: 12px; color: var(--text-secondary, #e6b800); }
        .topup-body p { margin: 0 0 8px 0; }
        .topup-details { display: flex; flex-direction: column; gap: 4px; padding: 8px; background: var(--bg-card, #2a2a2a); margin-bottom: 8px; }
        .topup-details span { font-size: 11px; }
        .topup-hint { font-style: italic; color: var(--text-muted, #b38f00); font-size: 11px; }
        .provider-tag { margin-top: 10px; font-family: var(--font-mono); font-size: 9px; color: var(--text-muted, #b38f00); text-align: right; }
        .input-controls { display: flex; padding: 16px; border-top: 2px solid var(--border-color, #ffcc00); background: var(--bg-card, #2a2a2a); }
        .input-controls input { flex: 1; padding: 14px 16px; background: var(--bg-primary, #1a1a1a); border: 2px solid var(--border-color, #ffcc00); color: var(--text-primary, #ffcc00); font-family: var(--font-mono); font-size: 14px; }
        .input-controls input::placeholder { color: var(--text-secondary, #e6b800); }
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
        .savings-item.withdrawn { opacity: 0.6; }
        .item-icon.unlocked { background: rgba(74, 222, 128, 0.2); color: #4ade80; }
        .unlocked-label { color: #4ade80; }
        .withdrawn-label { color: #60a5fa; }
        .withdrawn-badge { padding: 4px 8px; background: rgba(96, 165, 250, 0.3); color: #60a5fa; font-size: 9px; font-family: var(--font-pixel); }
        .action-btn.withdraw { background: rgba(74, 222, 128, 0.2); border-color: #4ade80; color: #4ade80; }
        .action-btn.withdraw:disabled { opacity: 0.5; cursor: not-allowed; }
        .action-btn .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 1024px) { .ai-wrapper { flex-direction: column; } .panel-wrapper { width: 100% !important; height: 300px; } .schedule-panel { width: 100%; } }
        @media (max-width: 768px) { .ai-wrapper { height: calc(100vh - 140px); min-height: 400px; } .chat-header { padding: 10px 14px; flex-wrap: wrap; gap: 10px; } .terminal-header { font-size: 10px; } .select-btn { padding: 6px 10px; font-size: 11px; } .message-area { padding: 14px; } .message-bubble { max-width: 92%; padding: 10px 12px; } .message-text { font-size: 12px; } .input-controls { padding: 12px; } .input-controls input { padding: 12px; font-size: 14px; } .input-controls button { padding: 12px 16px; } }
        @media (max-width: 480px) { .header-actions { gap: 8px; } .schedule-toggle { padding: 6px; } .terminal-header span { display: none; } .agent-indicator { display: none; } }
        .streaming-cursor {
          display: inline;
          animation: blink 0.7s infinite;
          color: var(--text-primary, #ffcc00);
          font-weight: bold;
        }
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .message-bubble.streaming {
          border-color: var(--accent-color, #60a5fa);
        }
      `}</style>
    </div>
  );
}
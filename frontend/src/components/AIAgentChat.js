import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import {
  Bot, Send, Shield, AlertTriangle, CheckCircle,
  XCircle, Loader, DollarSign, User, Clock,
  ChevronDown, Sparkles, Terminal
} from 'lucide-react';

// AI Provider configurations
const AI_PROVIDERS = {
  grok: {
    name: 'GROK',
    model: 'grok-4-latest',
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

// No hardcoded vendors - we use trusted vendors from the database/settings

// System prompt is generated dynamically with trusted vendors
const getSystemPrompt = (trustedVendors) => {
  const vendorList = trustedVendors.length > 0
    ? trustedVendors.map(v => `- ${v.name}: ${v.address}`).join('\n')
    : '(No trusted vendors configured yet)';

  return `You are an AI shopping assistant with access to a cryptocurrency wallet containing MNEE stablecoins. Your job is to help users make purchases.

IMPORTANT RULES:
1. When the user asks you to buy/pay/purchase/send/transfer something, you MUST respond with a JSON payment instruction
2. The JSON format is: {"action": "payment", "vendor": "vendor name or address", "amount": number, "reason": "description"}
3. Include the JSON in your response along with a friendly message
4. If the user is just chatting (not requesting a purchase), respond normally without JSON
5. Be helpful and conversational
6. If the amount is not specified, ask for clarification
7. Use the EXACT vendor name from the trusted list when possible

USER'S TRUSTED VENDORS:
${vendorList}

RISK LEVELS:
- Payments to TRUSTED vendors (listed above) = LOW RISK, processed quickly
- Payments to UNKNOWN vendors or addresses = HIGH RISK, may be blocked for review

EXAMPLES:
User: "Pay $50 to Amazon" (if Amazon is trusted)
Response: "I'll send $50 to Amazon for you! 

{"action": "payment", "vendor": "Amazon", "amount": 50, "reason": "Payment to Amazon"}

Since Amazon is a trusted vendor, this should be processed quickly."

User: "Send 100 MNEE to 0x1234abcd..."
Response: "I'll transfer 100 MNEE to that address.

{"action": "payment", "vendor": "0x1234abcd...", "amount": 100, "reason": "Direct transfer"}

⚠️ Note: This address isn't in your trusted vendors, so Sentinel may flag it for review."

User: "What vendors do I have?"
Response: "Your trusted vendors are: [list them]. You can add more in the Settings tab!"`;
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
          {message.type === 'info' && <Shield size={14} />}
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
        
        {message.provider && !isUser && (
          <div className="provider-tag">MODEL: {message.provider}</div>
        )}
      </div>
    </motion.div>
  );
};

export default function AIAgentChat({ contract, account, onTransactionCreated, trustedVendors = [] }) {
  const [messages, setMessages] = useState([]);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('grok');
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const messagesEndRef = useRef(null);

  // Debug: Log vendors when they change
  useEffect(() => {
    console.log('🏪 AIAgentChat received trustedVendors:', trustedVendors);
  }, [trustedVendors]);
  
  // Initialize welcome message ONCE
  useEffect(() => {
    if (hasInitialized) return;
    
    const vendorNames = trustedVendors.map(v => v.name).filter(Boolean).slice(0, 5);
    const vendorList = vendorNames.length > 0 
      ? `\n\nTRUSTED VENDORS:\n${vendorNames.join(', ')}${trustedVendors.length > 5 ? '...' : ''}`
      : '\n\n⚠️ NO TRUSTED VENDORS DETECTED.';
    
    setMessages([{
      id: 1,
      content: `SENTINEL AI ONLINE.\n\nCOMMANDS:\n> "PAY $50 TO [VENDOR]"\n> "SEND 100 MNEE TO [ADDR]"\n${vendorList}`,
      isUser: false,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    
    if (trustedVendors.length > 0 || hasInitialized === false) {
      setHasInitialized(true);
    }
  }, [trustedVendors, hasInitialized]);

  // Get API keys from environment variables
  const getApiKey = (provider) => {
    const envKey = AI_PROVIDERS[provider].envKey;
    return process.env[envKey] || '';
  };

  // Check which providers have keys configured
  const availableProviders = Object.entries(AI_PROVIDERS).filter(
    ([key]) => getApiKey(key)
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-select first available provider
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
        error: 'Vendor not found'
      };
    }

    try {
      addSystemMessage(`INITIALIZING TRANSFER TO ${vendor.name}...`, 'info');

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
        isTrusted: vendor.isTrusted
      };

    } catch (err) {
      addSystemMessage(`❌ FAILED: ${err.reason || err.message}`, 'danger');
      return null;
    }
  };

  // API Call Helpers
  const callClaude = async (userMessage, apiKey) => {
    const systemPrompt = getSystemPrompt(trustedVendors);
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
    const systemPrompt = getSystemPrompt(trustedVendors);
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
    const systemPrompt = getSystemPrompt(trustedVendors);
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
      const paymentIntent = parseAIResponse(aiResponse);
      const cleanResponse = aiResponse.replace(/\{[\s\S]*?"action"[\s\S]*?\}/, '').trim();
      
      if (paymentIntent && paymentIntent.action === 'payment') {
        addMessage(cleanResponse, false, { provider: AI_PROVIDERS[selectedProvider].name });
        const result = await executePayment(paymentIntent);
        if (result) {
          setMessages(prev => {
            const updated = [...prev];
            const lastAgentMsg = updated.filter(m => !m.isUser && !m.isSystem).pop();
            if (lastAgentMsg) lastAgentMsg.payment = result;
            return updated;
          });
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

  return (
    <div className="ai-container">
      <div className="chat-header">
        <div className="terminal-header">
          <Terminal size={18} />
          <span>SENTINEL_AI_CORE // V2.0</span>
        </div>
        
        <div className="model-selector">
          <button className="select-btn" onClick={() => setShowProviderMenu(!showProviderMenu)}>
            <span className="icon">{currentProvider.icon}</span>
            {currentProvider.name}
            <ChevronDown size={14} />
          </button>
          
          <AnimatePresence>
            {showProviderMenu && (
              <motion.div className="menu-dropdown" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
                {Object.entries(AI_PROVIDERS).map(([key, provider]) => {
                  const hasKey = getApiKey(key);
                  return (
                    <button key={key} className={`menu-item ${!hasKey ? 'disabled' : ''}`} onClick={() => { if (hasKey) { setSelectedProvider(key); setShowProviderMenu(false); } }}>
                      {provider.icon} {provider.name}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
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
          placeholder="ENTER COMMAND..."
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading || !input.trim()}>
          {isLoading ? <Loader size={18} className="spin" /> : <Send size={18} />}
        </button>
      </div>

      <style jsx>{`
        .ai-container {
          display: flex; flex-direction: column; height: calc(100vh - 180px); min-height: 500px;
          border: 2px solid var(--border-color, #ffcc00); background: var(--bg-card, #2a2a2a);
        }

        .chat-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 20px; border-bottom: 2px solid var(--border-color, #ffcc00); background: var(--bg-secondary, #252525);
        }
        .terminal-header { display: flex; align-items: center; gap: 8px; font-family: var(--font-pixel); font-size: 12px; }
        
        .model-selector { position: relative; }
        .select-btn {
          display: flex; align-items: center; gap: 8px; padding: 6px 12px;
          background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); font-family: var(--font-mono); font-size: 12px; font-weight: 700;
          cursor: pointer; transition: all 0.1s;
        }
        .select-btn:hover { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); }
        .icon { font-size: 14px; }

        .menu-dropdown {
          position: absolute; right: 0; top: 100%; margin-top: 4px; z-index: 50;
          background: var(--bg-card, #2a2a2a); border: 2px solid var(--border-color, #ffcc00); width: 140px; box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00);
        }
        .menu-item {
          display: block; width: 100%; text-align: left; padding: 8px 12px;
          background: transparent; border: none; border-bottom: 1px solid #eee;
          font-family: var(--font-mono); font-size: 11px; cursor: pointer;
        }
        .menu-item:hover:not(.disabled) { background: var(--bg-secondary, #252525); }
        .menu-item.disabled { opacity: 0.5; cursor: not-allowed; }

        .message-area {
          flex: 1; padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px;
          background-image: radial-gradient(#e5e5e5 1px, transparent 1px); background-size: 20px 20px;
        }

        .message-bubble { display: flex; flex-direction: column; max-width: 80%; }
        .message-bubble.user { align-self: flex-end; }
        .message-bubble.agent { align-self: flex-start; }

        .bubble-header { 
          display: flex; justify-content: space-between; margin-bottom: 4px; 
          font-family: var(--font-mono); font-size: 10px; color: var(--text-muted, #b38f00); padding: 0 4px;
        }

        .bubble-content {
          border: 2px solid var(--border-color, #ffcc00); padding: 16px; position: relative;
          box-shadow: 4px 4px 0px 0px rgba(0,0,0,0.1);
        }
        .user .bubble-content { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); border-color: black; }
        .agent .bubble-content { background: var(--bg-card, #2a2a2a); color: black; }

        .message-text { font-size: 14px; line-height: 1.5; white-space: pre-wrap; font-family: var(--font-geo); }

        .payment-receipt {
          margin-top: 16px; border: 2px dashed black; background: var(--bg-secondary, #252525); padding: 12px; color: black;
        }
        .payment-receipt.approved { background: #f0fdf4; border-color: var(--accent-emerald); }
        .payment-receipt.blocked { background: #fef2f2; border-color: var(--accent-red); }
        
        .receipt-header { 
          display: flex; align-items: center; gap: 8px; border-bottom: 2px solid var(--border-color, #ffcc00); padding-bottom: 8px; margin-bottom: 8px;
          font-family: var(--font-pixel); font-size: 12px;
        }
        .status-tag { margin-left: auto; font-size: 10px; padding: 2px 6px; background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); }
        .status-tag.approved { background: var(--accent-emerald); }
        .status-tag.blocked { background: var(--accent-red); }

        .receipt-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; }
        .mono { font-family: var(--font-mono); }
        .bold { font-weight: 700; }
        
        .risk-val { padding: 2px 6px; font-weight: 700; font-family: var(--font-mono); font-size: 10px; border: 1px solid var(--border-color, #ffcc00); }
        .risk-val.low { background: var(--accent-emerald); color: white; }
        .risk-val.med { background: var(--accent-amber); color: black; }
        .risk-val.high { background: var(--accent-red); color: white; }

        .system-message {
          align-self: center; display: flex; align-items: center; gap: 8px;
          padding: 8px 16px; border: 2px solid var(--border-color, #ffcc00); font-size: 11px; font-weight: 700;
          font-family: var(--font-mono); box-shadow: 2px 2px 0px 0px rgba(0,0,0,0.1);
        }
        .system-message.info { background: #eff6ff; border-color: var(--accent-blue); color: var(--accent-blue); }
        .system-message.success { background: #f0fdf4; border-color: var(--accent-emerald); color: var(--accent-emerald); }
        .system-message.danger { background: #fef2f2; border-color: var(--accent-red); color: var(--accent-red); }
        .system-message.warning { background: #fffbeb; border-color: var(--accent-amber); color: var(--accent-amber); }

        .provider-tag {
          display: inline-block; margin-top: 8px; font-size: 9px; padding: 2px 6px; 
          border: 1px solid #ccc; color: #888; font-family: var(--font-mono);
        }

        .input-controls {
          display: flex; gap: 12px; padding: 20px; border-top: 2px solid var(--border-color, #ffcc00); background: var(--bg-card, #2a2a2a);
        }
        .input-controls input {
          flex: 1; border: 2px solid var(--border-color, #ffcc00); padding: 12px; font-family: var(--font-mono); font-size: 14px;
          border-radius: 0; outline: none; transition: box-shadow 0.1s;
        }
        .input-controls input:focus { box-shadow: 4px 4px 0px 0px var(--accent-purple); }
        
        .input-controls button {
          width: 48px; display: flex; align-items: center; justify-content: center;
          background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); border: none; cursor: pointer; transition: transform 0.1s;
        }
        .input-controls button:hover:not(:disabled) { transform: translate(-2px, -2px); box-shadow: 4px 4px 0px 0px var(--accent-blue); }
        .input-controls button:disabled { background: #ccc; cursor: not-allowed; }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
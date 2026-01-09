import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Key, Copy, CheckCircle, Code, Book, Zap,
  RefreshCw, Eye, EyeOff, Terminal, ExternalLink,
  Shield, Bot, Webhook, AlertTriangle, XOctagon
} from 'lucide-react';

const CodeBlock = ({ code, language = 'javascript' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block">
      <div className="code-header">
        <span className="lang-tag">{language.toUpperCase()}</span>
        <button className="copy-btn" onClick={handleCopy}>
          {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <pre><code>{code}</code></pre>
      <style jsx>{`
        .code-block {
          background: var(--bg-secondary, #252525);
          border: 2px solid var(--border-color, #ffcc00);
          margin-top: 16px;
        }
        .code-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 2px solid var(--border-color, #ffcc00);
          background: var(--bg-card, #2a2a2a);
        }
        .lang-tag {
          font-family: var(--font-pixel);
          font-size: 10px;
          background: var(--border-color, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
          padding: 2px 6px;
        }
        .copy-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: 1px solid var(--border-color, #ffcc00);
          padding: 4px 8px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          color: var(--text-primary, #ffcc00);
        }
        .copy-btn:hover {
          background: var(--border-color, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
        }
        pre {
          padding: 16px;
          overflow-x: auto;
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-secondary, #e6b800);
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
};

export default function DeveloperPanel({ vaultAddress, apiUrl = 'https://api.sentinelfinance.xyz' }) {
  const [apiKey, setApiKey] = useState('sk_sentinel_' + Math.random().toString(36).slice(2, 18));
  const [showKey, setShowKey] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [activeExample, setActiveExample] = useState('python');

  const regenerateKey = () => {
    setApiKey('sk_sentinel_' + Math.random().toString(36).slice(2, 18));
  };

  const examples = {
    python: `import requests
import os

# ⚠️ SECURITY: Load API key from environment variable
# NEVER hardcode API keys in your source code!
SENTINEL_API = "${apiUrl}"
API_KEY = os.environ.get("SENTINEL_API_KEY")  # Store in .env file
VAULT_ADDRESS = "${vaultAddress || '0x...'}"

def request_payment(vendor_address, amount, reason=""):
    """Request a payment through Sentinel"""
    response = requests.post(
        f"{SENTINEL_API}/api/v1/agent/payment",
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "vendor": vendor_address,
            "amount": str(amount),
            "reason": reason,
            "vault": VAULT_ADDRESS
        }
    )
    return response.json()

# Example: AI agent requests payment
result = request_payment(
    vendor_address="0x1234...",
    amount=50.0,
    reason="Coffee purchase for user"
)

print(f"Transaction ID: {result['tx_id']}")
print(f"Risk Score: {result['risk_score']}")
print(f"Status: {result['status']}")  # pending, approved, blocked`,

    javascript: `// ⚠️ SECURITY: This code should run SERVER-SIDE ONLY
// NEVER expose API keys in browser/client code!

const SENTINEL_API = "${apiUrl}";
const API_KEY = process.env.SENTINEL_API_KEY;  // Use .env file
const VAULT_ADDRESS = "${vaultAddress || '0x...'}";

async function requestPayment(vendorAddress, amount, reason = "") {
  const response = await fetch(\`\${SENTINEL_API}/api/v1/agent/payment\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${API_KEY}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      vendor: vendorAddress,
      amount: amount.toString(),
      reason: reason,
      vault: VAULT_ADDRESS
    })
  });
  
  return response.json();
}

// Example: AI agent requests payment
const result = await requestPayment(
  "0x1234...",
  50.0,
  "Hotel booking for user trip"
);

console.log(\`Transaction ID: \${result.tx_id}\`);
console.log(\`Risk Score: \${result.risk_score}\`);
console.log(\`Status: \${result.status}\`);`,

    curl: `# ⚠️ SECURITY: Use environment variables for API keys
# export SENTINEL_API_KEY="your_api_key_here"

# Request a payment through Sentinel API
curl -X POST ${apiUrl}/api/v1/agent/payment \\
  -H "Authorization: Bearer $SENTINEL_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "vendor": "0x1234567890123456789012345678901234567890",
    "amount": "50.0",
    "reason": "Coffee purchase",
    "vault": "${vaultAddress || '0x...'}"
  }'

# Check transaction status
curl -X GET ${apiUrl}/api/v1/transactions/0 \\
  -H "Authorization: Bearer $SENTINEL_API_KEY"

# Get vault balance
curl -X GET ${apiUrl}/api/v1/vault/balance \\
  -H "Authorization: Bearer $SENTINEL_API_KEY"`
  };

  return (
    <div className="dev-panel">
      <div className="panel-header">
        <div className="header-icon">
          <Code size={24} />
        </div>
        <div>
          <h2>DEVELOPER API</h2>
          <p>INTEGRATE SENTINEL WITH YOUR AI AGENTS</p>
        </div>
      </div>

      {/* CRITICAL SECURITY WARNING */}
      <motion.div
        className="security-warning critical"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="warning-header">
          <XOctagon size={20} />
          <span>CRITICAL SECURITY WARNING</span>
        </div>
        <div className="warning-content">
          <p><strong>NEVER expose API keys or private keys in:</strong></p>
          <ul>
            <li>❌ Client-side JavaScript / Browser code</li>
            <li>❌ Mobile applications</li>
            <li>❌ Public repositories (GitHub, GitLab)</li>
            <li>❌ Frontend frameworks (React, Vue, Angular)</li>
          </ul>
          <p className="safe-practices"><strong>SAFE PRACTICES:</strong></p>
          <ul>
            <li>✅ Store keys in environment variables (.env files)</li>
            <li>✅ Use server-side code only for API calls</li>
            <li>✅ Use a dedicated agent wallet with spending limits</li>
            <li>✅ Rotate API keys periodically</li>
          </ul>
        </div>
      </motion.div>

      <div className="panel-grid">
        {/* API Key Section */}
        <motion.div
          className="panel-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="card-header">
            <Key size={18} />
            <h3>API ACCESS KEY</h3>
          </div>
          <div className="api-key-box">
            <div className="key-val">
              {showKey ? apiKey : '••••••••••••••••••••••••••••••••'}
            </div>
            <div className="key-actions">
              <button onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button onClick={() => navigator.clipboard.writeText(apiKey)}>
                <Copy size={16} />
              </button>
              <button onClick={regenerateKey}>
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
          <p className="key-warn">
            <AlertTriangle size={12} /> SERVER-SIDE ONLY - NEVER EXPOSE IN CLIENT CODE
          </p>
        </motion.div>

        {/* Webhook Section */}
        <motion.div
          className="panel-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="card-header">
            <Webhook size={18} />
            <h3>WEBHOOKS</h3>
          </div>
          <p className="card-desc">
            REAL-TIME EVENT NOTIFICATIONS FOR TRANSACTIONS
          </p>
          <div className="webhook-form">
            <input
              type="url"
              placeholder="https://api.yourapp.com/webhook"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <button disabled={!webhookUrl}>SAVE</button>
          </div>
          <div className="event-tags">
            <span>payment.requested</span>
            <span>payment.executed</span>
            <span>alert.high_risk</span>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          className="panel-card stats-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="stat-item">
            <div className="icon-box"><Zap size={16} /></div>
            <div className="stat-info">
              <span className="val">247</span>
              <span className="lbl">API CALLS (24H)</span>
            </div>
          </div>
          <div className="stat-item">
            <div className="icon-box"><Bot size={16} /></div>
            <div className="stat-info">
              <span className="val">03</span>
              <span className="lbl">ACTIVE AGENTS</span>
            </div>
          </div>
          <div className="stat-item">
            <div className="icon-box"><Shield size={16} /></div>
            <div className="stat-info">
              <span className="val">12</span>
              <span className="lbl">THREATS BLOCKED</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Code Examples */}
      <motion.div
        className="section-block"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="block-header">
          <Terminal size={18} />
          <h3>INTEGRATION EXAMPLES</h3>
        </div>
        
        <div className="example-warning">
          <AlertTriangle size={14} />
          <span>These examples show SERVER-SIDE patterns. Never run API calls from browsers.</span>
        </div>
        
        <div className="lang-tabs">
          {['python', 'javascript', 'curl'].map(lang => (
            <button
              key={lang}
              className={`tab-btn ${activeExample === lang ? 'active' : ''}`}
              onClick={() => setActiveExample(lang)}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>

        <CodeBlock code={examples[activeExample]} language={activeExample} />
      </motion.div>

      {/* API Endpoints Reference */}
      <motion.div
        className="section-block"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="block-header">
          <Book size={18} />
          <h3>API ENDPOINTS</h3>
        </div>

        <div className="endpoints-list">
          <div className="endpoint-row">
            <span className="method post">POST</span>
            <span className="path">/api/v1/agent/payment</span>
            <span className="desc">REQUEST NEW PAYMENT</span>
          </div>
          <div className="endpoint-row">
            <span className="method get">GET</span>
            <span className="path">/api/v1/vault/balance</span>
            <span className="desc">GET VAULT BALANCE</span>
          </div>
          <div className="endpoint-row">
            <span className="method get">GET</span>
            <span className="path">/api/v1/transactions</span>
            <span className="desc">LIST HISTORY</span>
          </div>
          <div className="endpoint-row">
            <span className="method post">POST</span>
            <span className="path">/api/v1/tx/:id/revoke</span>
            <span className="desc">REVOKE PENDING TX</span>
          </div>
        </div>

        <a href="https://docs.sentinelfinance.xyz" target="_blank" rel="noreferrer" className="docs-btn">
          <Book size={14} />
          FULL DOCUMENTATION
          <ExternalLink size={14} />
        </a>
      </motion.div>

      <style jsx>{`
        .dev-panel {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .panel-header {
          display: flex;
          align-items: center;
          gap: 16px;
          border-bottom: 4px solid var(--border-color, #ffcc00);
          padding-bottom: 24px;
        }

        .header-icon {
          width: 48px;
          height: 48px;
          border: 2px solid var(--border-color, #ffcc00);
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-card, #2a2a2a);
          box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00);
          color: var(--text-primary, #ffcc00);
        }

        .panel-header h2 {
          font-family: var(--font-pixel);
          font-size: 24px;
          margin-bottom: 4px;
          line-height: 1;
          color: var(--text-primary, #ffcc00);
        }

        .panel-header p {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--text-muted, #b38f00);
          letter-spacing: 1px;
        }

        /* SECURITY WARNING STYLES */
        .security-warning {
          border: 3px solid var(--accent-red);
          background: rgba(255, 59, 48, 0.15);
          padding: 0;
        }
        
        .security-warning.critical {
          box-shadow: 0 0 20px rgba(255, 59, 48, 0.3);
        }
        
        .warning-header {
          display: flex;
          align-items: center;
          gap: 10px;
          background: var(--accent-red);
          color: white;
          padding: 12px 16px;
          font-family: var(--font-pixel);
          font-size: 14px;
        }
        
        .warning-content {
          padding: 16px;
          font-size: 13px;
          line-height: 1.6;
          color: var(--text-primary, #ffcc00);
        }
        
        .warning-content ul {
          margin: 8px 0 16px 20px;
          padding: 0;
        }
        
        .warning-content li {
          margin-bottom: 6px;
        }
        
        .warning-content .safe-practices {
          color: var(--accent-emerald);
          margin-top: 16px;
        }

        .panel-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }

        .panel-card {
          background: var(--bg-card, #2a2a2a);
          border: 2px solid var(--border-color, #ffcc00);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 2px solid var(--border-color, #ffcc00);
          padding-bottom: 12px;
          color: var(--text-primary, #ffcc00);
        }

        .card-header h3 {
          font-family: var(--font-pixel);
          font-size: 14px;
        }

        .api-key-box {
          display: flex;
          background: var(--bg-secondary, #252525);
          border: 2px solid var(--border-color, #ffcc00);
          padding: 4px;
        }

        .key-val {
          flex: 1;
          padding: 8px 12px;
          font-family: var(--font-mono);
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--text-primary, #ffcc00);
        }

        .key-actions {
          display: flex;
          border-left: 2px solid var(--border-color, #ffcc00);
        }

        .key-actions button {
          background: var(--bg-card, #2a2a2a);
          border: none;
          border-left: 1px solid var(--bg-secondary, #252525);
          padding: 0 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-primary, #ffcc00);
        }
        .key-actions button:hover { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); }
        .key-actions button:first-child { border-left: none; }

        .key-warn {
          font-size: 10px;
          color: var(--accent-red);
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .card-desc {
          font-size: 11px;
          font-family: var(--font-mono);
          color: var(--text-muted, #b38f00);
        }

        .webhook-form {
          display: flex;
          gap: 8px;
        }

        .webhook-form input {
          flex: 1;
          padding: 8px 12px;
          border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-mono);
          font-size: 12px;
          background: var(--bg-secondary, #252525);
          color: var(--text-primary, #ffcc00);
        }
        .webhook-form input::placeholder { color: var(--text-muted, #b38f00); }

        .webhook-form button {
          background: var(--border-color, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
          border: none;
          padding: 0 16px;
          font-family: var(--font-pixel);
          font-size: 10px;
          cursor: pointer;
        }
        .webhook-form button:disabled { background: var(--text-muted, #b38f00); cursor: not-allowed; }

        .event-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .event-tags span {
          background: var(--bg-secondary, #252525);
          border: 1px solid var(--border-color, #ffcc00);
          padding: 2px 6px;
          font-size: 10px;
          font-family: var(--font-mono);
          color: var(--text-primary, #ffcc00);
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          border: 1px solid var(--border-color, #ffcc00);
          background: var(--bg-secondary, #252525);
        }

        .icon-box {
          width: 32px;
          height: 32px;
          background: var(--border-color, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-info { display: flex; flex-direction: column; }
        .stat-info .val { font-family: var(--font-pixel); font-size: 18px; line-height: 1; color: var(--text-primary, #ffcc00); }
        .stat-info .lbl { font-size: 10px; font-weight: 700; color: var(--text-muted, #b38f00); }

        .section-block {
          background: var(--bg-card, #2a2a2a);
          border: 2px solid var(--border-color, #ffcc00);
          padding: 24px;
        }

        .block-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          color: var(--text-primary, #ffcc00);
        }
        .block-header h3 { font-family: var(--font-pixel); font-size: 16px; }

        .example-warning {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: rgba(255, 204, 0, 0.1);
          border: 1px solid var(--accent-amber);
          color: var(--accent-amber);
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 16px;
        }

        .lang-tabs { display: flex; gap: -2px; margin-bottom: 0; }
        .tab-btn {
          padding: 8px 16px;
          background: var(--bg-secondary, #252525);
          border: 2px solid var(--border-color, #ffcc00);
          font-family: var(--font-pixel);
          font-size: 10px;
          cursor: pointer;
          margin-right: -2px;
          position: relative;
          color: var(--text-primary, #ffcc00);
        }
        .tab-btn:hover { background: var(--bg-card, #2a2a2a); z-index: 1; }
        .tab-btn.active { background: var(--border-color, #ffcc00); color: var(--bg-primary, #1a1a1a); z-index: 2; }

        .endpoints-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
        .endpoint-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: var(--bg-secondary, #252525);
          border: 1px solid var(--border-color, #ffcc00);
        }
        .method {
          font-size: 10px; font-weight: 700; padding: 2px 6px; border: 1px solid var(--bg-primary, #1a1a1a);
        }
        .method.post { background: var(--accent-blue); color: white; }
        .method.get { background: var(--accent-emerald); color: white; }
        
        .path { font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--text-primary, #ffcc00); }
        .desc { font-size: 10px; color: var(--text-muted, #b38f00); margin-left: auto; text-transform: uppercase; }

        .docs-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--border-color, #ffcc00);
          color: var(--bg-primary, #1a1a1a);
          padding: 12px 20px;
          text-decoration: none;
          font-family: var(--font-pixel);
          font-size: 12px;
          transition: transform 0.1s;
        }
        .docs-btn:hover { transform: translate(-2px, -2px); box-shadow: 4px 4px 0px 0px var(--border-color, #ffcc00); }

        @media (max-width: 768px) {
          .panel-grid { grid-template-columns: 1fr; }
          .endpoint-row { flex-wrap: wrap; }
          .desc { width: 100%; margin-left: 0; margin-top: 4px; }
        }
      `}</style>
    </div>
  );
}
# 🤖 Sentinel Finance - Agent Wallet System

## Overview

The Agent Wallet is a **hot wallet** controlled by the browser that enables **automated payments without wallet popups**. It's designed for recurring payments and savings deposits while maintaining strict security constraints.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         THREE-WALLET SYSTEM                              │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────────┐     ┌──────────────────────────┐
│  USER WALLET │────►│   MAIN VAULT     │────►│     AGENT WALLET         │
│  (wallet)  │     │                  │     │     (Hot/Auto)           │
└──────────────┘     └────────┬─────────┘     └───────┬──────────────────┘
                              │                       │
                              │                       ├──► Trusted Vendors
                              │                       │
                              │                       └──► Savings Contract
                              │                               │
                              ◄───────────────────────────────┘
                              (All withdrawals return to Vault)
```

## Security Model

### 🔒 Key Security Features

1. **Closed-Loop System**: Funds can ONLY be sent to:
   - User's own Main Vault
   - Whitelisted Trusted Vendors
   - Savings Contract

2. **Deterministic Wallet Generation**:
   - Private key derived from wallet signature
   - Same signature = same wallet (recoverable)
   - Unique per user address

3. **No External Transfers**: Cannot send to unknown addresses

### 🛡️ Attack Mitigation

| Attack Vector | Mitigation |
|---------------|------------|
| Private key stolen | Can only send to vault/vendors/savings |
| XSS attack | Key is encrypted, needs signature to decrypt |
| LocalStorage cleared | Re-sign message → recover same wallet |
| Malicious vendor | Adding vendors requires wallet signature |
| Over-spending | User controls funding amount |

## Usage

### 1. Initialize Agent Wallet

```javascript
import AgentWalletManager from './utils/AgentWalletManager';

const manager = new AgentWalletManager(
  userAddress,      // wallet connected address
  vaultAddress,     // User's SentinelVault address
  networkConfig     // Network configuration
);

// User signs message to create/recover wallet
const { address, isNew } = await manager.initializeWallet(signer);
```

### 2. Fund Agent Wallet

```javascript
// From Main Vault (requires wallet signature)
// 1. Withdraw from vault to user wallet
// 2. Transfer to agent wallet
```

### 3. Automated Payments

```javascript
// No popup required!
const result = await manager.sendMNEE(
  provider,
  vendorAddress,  // Must be trusted
  amount,
  "Netflix monthly subscription"
);
```

### 4. Withdraw to Vault

```javascript
// No popup required - funds only go to vault
await manager.withdrawToVault(provider);
```

## AI Chat Integration

The AI chat automatically routes payments based on type:

| User Command | Payment Type | Wallet Used | Popup? |
|--------------|-------------|-------------|--------|
| "Send 100 MNEE to John" | One-time | Main Vault | ✅ YES |
| "Pay Netflix 15 MNEE every month" | Recurring | Agent Wallet | ❌ NO |
| "Save 50 MNEE weekly for 1 year" | Savings | Agent → Savings | ❌ NO |
| "Top up agent wallet 500 MNEE" | Fund Agent | Vault → Agent | ✅ YES |

### Example Conversations

```
User: "Pay Netflix 50 MNEE on the 15th of every month"

AI: 📅 RECURRING PAYMENT SCHEDULED
    
    Vendor: Netflix
    Amount: 50 MNEE
    Schedule: 15th of each month
    Wallet: AGENT WALLET (auto-execute)
    
    ✅ No approval needed for future payments!
```

```
User: "Save 100 MNEE every week until December, lock it"

AI: 🐷 SAVINGS PLAN CREATED
    
    Deposit: 100 MNEE weekly
    Lock Period: Until December 1, 2026
    Total Target: ~4,800 MNEE
    
    ⚠️ Funds locked until unlock date.
    Withdraws only to your Vault.
```

## Backend Service

The recurring executor runs as a cron job:

```python
# Every minute: Check for due payments
# Execute from agent wallet
# Update next payment date
# Send notifications
```

### Configuration

```env
# backend/.env
WEB3_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/...
MNEE_TOKEN_ADDRESS=0x250ff89cf1518F42F3A4c927938ED73444491715
SAVINGS_CONTRACT_ADDRESS=0x...
```

## Smart Contracts

### SentinelSavings.sol

```solidity
// Create locked savings plan
function createPlan(
    address _vaultAddress,  // Only destination for withdrawals
    string _name,
    uint256 _lockDays,
    bool _isRecurring
) external returns (uint256 planId);

// Deposit (can be called multiple times)
function deposit(uint256 _planId, uint256 _amount) external;

// Withdraw (only after unlock, only to vault)
function withdraw(uint256 _planId) external;
```

### Setting Up Agent Wallet

1. Click the **🤖 Agent** button in the header
2. Click **"Sign to Create"** 
3. Sign the message in wallet (one-time)
4. Your Agent Wallet is ready!

### Funding Agent Wallet

**Via AI Chat:**
```
"Send 500 MNEE from vault to agent wallet"
```

**Via UI:**
1. Open Agent Wallet panel
2. Click "Fund" tab
3. Enter amount
4. Confirm in wallet (2 transactions)

### Creating Recurring Payments

**Via AI Chat:**
```
"Pay AWS 100 MNEE every Monday"
"Subscribe to Netflix for 15 MNEE monthly"
```

### Creating Savings Plans

**Via AI Chat:**
```
"Save 200 MNEE every month for 2 years"
"Lock 5000 MNEE until January 2027"
"Deposit 50 MNEE weekly to my emergency fund"
```

### Managing Schedules

1. Go to **Settings → Recurring**
2. View all active schedules
3. Pause, edit, or delete as needed

## FAQ

### Q: Is my money safe in the Agent Wallet?

Yes! Even if someone steals the private key, they can only send funds to:
- Your own vault
- Your trusted vendors
- The savings contract

They cannot transfer to external addresses.

### Q: What if I clear my browser data?

Sign the message again in wallet. Because the wallet is derived deterministically from your signature, you'll get the same wallet back.

### Q: Can I have multiple Agent Wallets?

Each wallet address gets one unique Agent Wallet. Different accounts = different agent wallets.

### Q: What happens if a payment fails?

- The system retries on the next cycle
- After 3 failures, the schedule is paused
- You'll receive a notification with the error

### Q: How do I stop recurring payments?

Via AI Chat: "Cancel my Netflix subscription"
Via Settings: Settings → Recurring → Pause/Delete

- GitHub: https://github.com/ismail-169/sentinel-finance
- Docs: https://docs.sentinelfinance.xyz
- Live: https://sentinelfinance.xyz
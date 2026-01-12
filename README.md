# Sentinel Finance

AI-powered programmable finance infrastructure for MNEE stablecoin. A complete financial operating system featuring a three-wallet security architecture, autonomous AI agents, and automated savings — all protected by smart contract vaults with clawback capabilities.

## Features

###  Three-Wallet Security Architecture
- **Main Vault** — Your fortress with time-locks, spending limits, and clawback protection
- **Agent Wallet** — Programmable hot wallet for automated payments to trusted vendors only
- **Savings Contract** — On-chain locked savings with customizable time periods

###  AI-Powered Financial Agent
- Natural language commands for payments and savings
- Multi-provider support — Claude, GPT-4, and Grok
- Autonomous recurring payment execution
- Proactive balance alerts and recommendations

###  Recurring Payments & Savings
- Schedule automatic payments to trusted vendors
- Create savings plans with lock periods (7 days to 1 year)
- Daily, weekly, bi-weekly, and monthly frequencies
- Background execution — no manual signing required

###  Advanced Security
- **Clawback System** — Cancel transactions before execution
- **Trusted Vendor Whitelist** — Agent can only pay approved addresses
- **Daily & Per-Transaction Limits** — Cap exposure even if compromised
- **Time-Lock Protection** — Delay large withdrawals for review
- **AI Risk Scoring** — Real-time threat detection

###  Dashboard & Analytics
- Total value locked overview
- Transaction history with status tracking
- Security score and risk meter
- Pending payment monitoring
- Alert management system

###  Developer API
- RESTful API for integrations
- Webhook notifications for events
- Programmatic vault and vendor management
- Full recurring payment control

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER WALLET                              │
│                                                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   MAIN VAULT    │     │  AGENT WALLET   │
│  (Secure Store) │     │  (Hot Wallet)   │
│  - Time-locks   │     │  - Auto-pay     │
│  - Limits       │     │  - Trusted only │
│  - Clawback     │     │  - Encrypted    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │              ┌────────┴────────┐
         │              ▼                 ▼
         │    ┌─────────────────┐  ┌─────────────┐
         │    │ TRUSTED VENDORS │  │  SAVINGS    │
         │    │  (Whitelist)    │  │  CONTRACT   │
         │    └─────────────────┘  └─────────────┘
         │
         ▼
┌─────────────────┐
│   AI AGENT      │
│  CHAT INTERFACE │
│  - Claude       │
│  - GPT-4        │
│  - Grok         │
└─────────────────┘
```

## Links

- **Live App**: [sentinelfinance.xyz](https://sentinelfinance.xyz)
- **Documentation**: [docs.sentinelfinance.xyz](https://docs.sentinelfinance.xyz)
- **GitHub**: [github.com/ismail-169/sentinel-finance](https://github.com/ismail-169/sentinel-finance)
- **MNEE Token**: [mnee.io](https://mnee.io) 

## Deployed Contracts (Sepolia) -FOR TESTING

| Contract | Address |
|----------|---------|
| MNEE Token | `0x250ff89cf1518F42F3A4c927938ED73444491715` |
| Vault Factory | `0xfD3af9554C45211c228B8E7498B26A325669A484` |
| Sentinel Savings | `0x21955e81ca4063f41080d12d3113F6ec54E7b692` |

## Quick Start

1. Connect your wallet
2. Select Sepolia testnet (or Mainnet)
3. Create your vault and claim test MNEE from faucet
4. Add trusted vendors
5. Initialize your Agent Wallet
6. Start chatting with the AI to automate your finances

<p align="center">
  <img src="docs/sentinel-logo.png" alt="Sentinel Finance Logo" width="200"/>
</p>

<h1 align="center">Sentinel Finance</h1>

<p align="center">
  <strong>AI-powered programmable finance infrastructure for MNEE stablecoin</strong>
</p>

<p align="center">
  <a href="https://sentinelfinance.xyz">Live App</a> •
  <a href="https://docs.sentinelfinance.xyz">Documentation</a> •
  <a href="#quick-start">Quick Start</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"/>
  <img src="https://img.shields.io/badge/Solidity-0.8.19-blue" alt="Solidity"/>
  <img src="https://img.shields.io/badge/React-18-61dafb" alt="React"/>
  <img src="https://img.shields.io/badge/Python-3.11-green" alt="Python"/>
  <img src="https://img.shields.io/badge/Network-Mainnet%20%7C%20Sepolia-purple" alt="Networks"/>
</p>

---

## Overview

A complete financial operating system featuring a three-wallet security architecture, autonomous AI agents, and automated savings, all protected by smart contract vaults with clawback capabilities.

**🌐 Fully operational on both Ethereum Mainnet and Sepolia Testnet.**

## Features

### Three-Wallet Security Architecture
- **Main Vault** — Your fortress with time-locks, spending limits, and clawback protection
- **Agent Wallet** — Programmable hot wallet for automated payments to trusted vendors only
- **Savings Contract** — On-chain locked savings with soft/hard lock options

### AI-Powered Financial Agent
- Natural language commands for payments and savings
- Multi-provider support — Claude, GPT-4, and Grok
- Autonomous recurring payment execution
- Proactive balance alerts and recommendations

### Recurring Payments & Savings
- Schedule automatic payments to trusted vendors
- Create savings plans with lock periods (7 days to 1 year)
- Soft lock (cancel anytime) or hard lock (strict discipline)
- Daily, weekly, bi-weekly, and monthly frequencies
- Background execution — no manual signing required
- Network-specific schedules (Sepolia and Mainnet separate)

### Advanced Security
- **Clawback System** — Instantly recall agent funds to vault
- **Trusted Vendor Whitelist** — Agent can only pay approved addresses
- **Daily & Per-Transaction Limits** — Cap exposure even if compromised
- **Time-Lock Protection** — Delay large withdrawals for review
- **AI Risk Scoring** — Real-time threat detection
- **AES-GCM Encryption** — Secure agent wallet key storage

### Dashboard & Analytics
- Total value locked overview
- Transaction history with status tracking
- Agent transaction execution logs
- Security score and risk meter
- Pending payment monitoring

### Developer API
- RESTful API for integrations
- Webhook notifications for events
- Programmatic vault and vendor management
- Network-aware endpoints

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Smart Contracts** | Solidity, Hardhat, OpenZeppelin |
| **Frontend** | React 18, Ethers.js, Framer Motion |
| **Backend** | Python, FastAPI, PostgreSQL |
| **AI Providers** | Anthropic Claude, OpenAI GPT-4, xAI Grok |
| **Blockchain** | Ethereum Mainnet & Sepolia Testnet |
| **Deployment** | Railway, Vercel |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER WALLET                             │
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
         │    │ TRUSTED VENDORS │  │   SAVINGS   │
         │    │  (Whitelist)    │  │  CONTRACT   │
         │    └─────────────────┘  └─────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│            SENTINEL BACKEND             │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │   AI CHAT   │  │    RECURRING     │  │
│  │  - Claude   │  │    EXECUTOR      │  │
│  │  - GPT-4    │  │  - Auto payments │  │
│  │  - Grok     │  │  - Savings deps  │  │
│  └─────────────┘  └──────────────────┘  │
└─────────────────────────────────────────┘
```

## Deployed Contracts

### Ethereum Mainnet

| Contract | Address |
|----------|---------|
| MNEE Token | `0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF` |
| Vault Factory | `0x4061a452ce5927c2420060eb7a680798b86e0117` |
| Sentinel Savings | `0xb1c74612c81fe8f685c1a3586d753721847d4549` |

### Sepolia Testnet

| Contract | Address |
|----------|---------|
| MockMNEE Token | `0x250ff89cf1518F42F3A4c927938ED73444491715` |
| Vault Factory | `0xfD3af9554C45211c228B8E7498B26A325669A484` |
| Sentinel Savings | `0xcF493dB2D2B4BffB8A38f961276019D5a00480DB` |

## Installation

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 14+
- MetaMask or compatible wallet


## Quick Start

1. Connect your wallet at [sentinelfinance.xyz](https://sentinelfinance.xyz)
2. Select your network (Sepolia for testing, Mainnet for production)
3. Create your vault and claim test MNEE from faucet (Sepolia only), If Mainnet buy from DEX or CEX
4. Add trusted vendors in the Config tab
5. Create your Agent Wallet and fund it with MNEE + ETH for gas
6. Start chatting with the AI to automate your finances!

### Example AI Commands
```
"Pay Walter 50 MNEE every week"
"Save 100 MNEE for 30 days with soft lock"
"Fund agent wallet with 500 MNEE"
"Show my recurring schedules"
"Clawback agent funds"
```

## API Documentation

Full API documentation available at [docs.sentinelfinance.xyz](https://docs.sentinelfinance.xyz)


### Example: Get Agent Transactions
```bash
curl https://api.sentinelfinance.xyz/api/v1/agent/transactions/0xYourAddress \
  -H "X-API-Key: YOUR_API_KEY"
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Changelog

### v3.1.0 (January 2026)
- 🌐 Full dual-network support (Sepolia + Mainnet)
- 🔧 Fixed recurring payments network selection
- 📊 Dashboard shows agent transaction history
- 💾 Network-aware database storage
- 🔐 Improved AES-GCM encryption

### v3.0.0 (January 2026)
- 🚀 Three-wallet architecture
- ⏪ Clawback system
- 💰 Savings plans with soft/hard locks
- 🔄 Recurring payments
- 🤖 Multi-provider AI Chat

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- **Live App**: [sentinelfinance.xyz](https://sentinelfinance.xyz)
- **Documentation**: [docs.sentinelfinance.xyz](https://docs.sentinelfinance.xyz)
- **MNEE Token**: [mnee.io](https://mnee.io)

---

<p align="center">Built with ❤️ for the MNEE ecosystem</p>
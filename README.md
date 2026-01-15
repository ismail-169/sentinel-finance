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
</p>

---

## Overview

A complete financial operating system featuring a three-wallet security architecture, autonomous AI agents, and automated savings, all protected by smart contract vaults with clawback capabilities.

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

###  Developer API
- RESTful API for integrations
- Webhook notifications for events
- Programmatic vault and vendor management

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Smart Contracts** | Solidity, Hardhat, OpenZeppelin |
| **Frontend** | React 18, Ethers.js, Framer Motion |
| **Backend** | Python, FastAPI, SQLite |
| **AI Providers** | Anthropic Claude, OpenAI GPT-4, xAI Grok |
| **Blockchain** | Ethereum (Sepolia Testnet / Mainnet) |

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
┌─────────────────┐
│   AI AGENT      │
│  CHAT INTERFACE │
│  - Claude       │
│  - GPT-4        │
│  - Grok         │
└─────────────────┘
```

## Deployed Contracts (Sepolia Testnet)

| Contract | Address |
|----------|---------|
| MNEE Token | `0x250ff89cf1518F42F3A4c927938ED73444491715` |
| Vault Factory | `0xfD3af9554C45211c228B8E7498B26A325669A484` |
| Sentinel Savings | `0x21955e81ca4063f41080d12d3113F6ec54E7b692` |

## Installation

### Prerequisites
- Node.js 18+
- Python 3.11+
- MetaMask or compatible wallet

### Clone Repository
```bash
git clone https://github.com/ismail-169/sentinel-finance.git
cd sentinel-finance
```

## Quick Start

1. Connect your wallet at [sentinelfinance.xyz](https://sentinelfinance.xyz)
2. Select Sepolia testnet (or Mainnet)
3. Create your vault and claim test MNEE from faucet
4. Add trusted vendors
5. Initialize your Agent Wallet
6. Start chatting with the AI to automate your finances

## API Documentation

Full API documentation available at [docs.sentinelfinance.xyz](https://docs.sentinelfinance.xyz)

### Example: Create Recurring Payment
```bash
curl -X POST https://api.sentinelfinance.xyz/api/v1/recurring/schedule \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor": "Netflix",
    "amount": 15.99,
    "frequency": "monthly"
  }'
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- **Live App**: [sentinelfinance.xyz](https://sentinelfinance.xyz)
- **Documentation**: [docs.sentinelfinance.xyz](https://docs.sentinelfinance.xyz)
- **MNEE Token**: [mnee.io](https://mnee.io)

---
# Sentinel Finance

AI-powered security layer for MNEE stablecoin transactions. Protects user funds from unauthorized AI agent spending through smart contract vaults with risk scoring, timelocks, and spending limits.

## Features

- **Smart Contract Vaults** - Non-custodial vaults with owner-only withdrawals
- **AI Risk Scoring** - Real-time transaction analysis (0-100 risk score)
- **Trusted Vendors** - Whitelist addresses for instant payments
- **Timelocks** - Configurable delays for untrusted transactions
- **Spending Limits** - Daily and per-transaction caps
- **Revocation** - Cancel pending transactions before execution

## Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contracts | Solidity, Hardhat |
| Frontend | React, ethers.js |
| Network | Ethereum Sepolia / Mainnet |

## Architecture

```
User Wallet → Sentinel Vault → AI Agent Request → Risk Analysis → Execute/Block
```

## Links

- **Live App**: [sentinelfinance.xyz](https://sentinelfinance.xyz)
- **Documentation**: [docs.sentinelfinance.xyz](https://docs.sentinelfinance.xyz)
- **MNEE Token**: [mnee.io](https://mnee.io)

## License

MIT
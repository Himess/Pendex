# Pendex

**Private Leveraged Trading for Pre-IPO Assets** | Powered by Zama fhEVM

[![License](https://img.shields.io/badge/license-BSD--3--Clause--Clear-blue.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)](https://soliditylang.org/)
[![fhEVM](https://img.shields.io/badge/fhEVM-0.9.1-purple.svg)](https://www.zama.ai/fhevm)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)

> Trade SpaceX, OpenAI, Stripe, and other pre-IPO companies with **complete privacy**. Your positions, leverage, and P&L are encrypted on-chain using Fully Homomorphic Encryption.

**[Live Demo](https://shadow-protocol-nine.vercel.app/)** | Built for [Zama Builder Track Hackathon 2025](https://dorahacks.io/hackathon/zama-bounty)

---

## The Problem

Traditional DeFi trading exposes everything on-chain:

| What's Visible | Risk |
|----------------|------|
| Position sizes | Whales can be targeted |
| Entry/exit prices | Front-running attacks |
| Trading strategies | Copy trading, manipulation |
| Liquidation levels | Liquidation hunting |
| Portfolio composition | Privacy violation |

**In traditional perps, everyone knows your positions before you exit.**

---

## Our Solution

Pendex encrypts **everything** using Zama's Fully Homomorphic Encryption:

```
                    Traditional Perp              Pendex
                    ---------------               ------
Position Size:      $50,000 LONG                 0x7f3a...encrypted
Entry Price:        $157.25                      0x8b2c...encrypted
Leverage:           10x                          0x1d4f...encrypted
Direction:          LONG                         0x9a3e...encrypted
Owner:              0xABC...123                  Optional: encrypted!
```

**Nobody can see your trades - not validators, not MEV bots, not anyone.**

---

## Live Demo

**Deployed on Sepolia Testnet**: [https://shadow-protocol-nine.vercel.app/](https://shadow-protocol-nine.vercel.app/)

| Contract | Address |
|----------|---------|
| ShadowOracle | [`0x4e819459EEE3061f10D7d0309F4Ba39Af5A68f81`](https://sepolia.etherscan.io/address/0x4e819459EEE3061f10D7d0309F4Ba39Af5A68f81) |
| ShadowUSD | [`0x6ABe3F3791B4Cee0f47dA1F10B4106c50C0EE6BC`](https://sepolia.etherscan.io/address/0x6ABe3F3791B4Cee0f47dA1F10B4106c50C0EE6BC) |
| ShadowLiquidityPool | [`0x548F8CbA6Fa4717BC6890D0f3175094c1FEeaa87`](https://sepolia.etherscan.io/address/0x548F8CbA6Fa4717BC6890D0f3175094c1FEeaa87) |
| ShadowVault | [`0x2ECB31ac17cF357B33CD81AA23983f39249c2322`](https://sepolia.etherscan.io/address/0x2ECB31ac17cF357B33CD81AA23983f39249c2322) |
| WalletManager | [`0x4de6E26b438e61ead479f46BCe309D5d0a16bD71`](https://sepolia.etherscan.io/address/0x4de6E26b438e61ead479f46BCe309D5d0a16bD71) |

---

## Tradeable Assets

6 Pre-IPO companies across 4 categories:

| Category | Asset | Base Price | Symbol |
|----------|-------|------------|--------|
| **AI** | OpenAI | $250 | OPENAI |
| **AI** | Anthropic | $95 | ANTHR |
| **Aerospace** | SpaceX | $180 | SPACEX |
| **FinTech** | Stripe | $48 | STRIPE |
| **Data** | Databricks | $55 | DTBRKS |
| **Social** | ByteDance | $165 | BYTDNC |

*Prices based on latest funding round valuations. 1 synthetic share = $1B market cap.*

---

## Key Features

### Dark Pool Trading
Trade privately without exposing your positions. No front-running, no copy trading, no liquidation hunting.

### Session Wallet (Popup-Free Trading)
One-time wallet setup stores an encrypted session key on-chain using FHE. Trade without MetaMask popups!

### Direct sUSD Trading (Hyperliquid-Style)
No vault deposits required. Get sUSD from faucet and trade immediately.

### Encrypted Limit Orders
Set stop-loss and take-profit orders that are invisible to MEV bots.

### Anonymous Mode
Optional full anonymity with eaddress - even your wallet address is encrypted.

---

## How It Works

### Trading Flow

```
1. Get sUSD from Faucet (or direct mint)
2. Set up Session Wallet (one-time, stores encrypted key on-chain)
3. Initialize Session (decrypt key with EIP-712 signature)
4. Select Asset & Set Leverage (1x-10x)
5. Open Position (encrypted on-chain)
6. Close Position & Collect Profits
7. Withdraw sUSD anytime
```

### FHE Data Types Used

```solidity
// All sensitive data is encrypted
euint64   collateral;        // Position collateral amount
euint64   size;              // Position size
euint64   entryPrice;        // Entry price
euint64   leverage;          // Leverage used
ebool     isLong;            // Direction (long/short)
eaddress  encryptedOwner;    // Anonymous trading!
```

### Privacy Guarantees

| What's Encrypted (FHE) | What's Public |
|------------------------|---------------|
| Position sizes | Asset being traded |
| Entry/exit prices | Position open/close status |
| Leverage amounts | Timestamp of operations |
| P&L amounts | Total Open Interest (aggregated) |
| Wallet balances | Mark prices |
| Order details | Liquidity score |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Smart Contracts** | Solidity 0.8.24, Zama fhEVM 0.9.1 |
| **FHE SDK** | @zama-fhe/relayer-sdk |
| **Frontend** | Next.js 14, React 18, TypeScript |
| **Web3** | wagmi 2.x, viem, RainbowKit |
| **Charts** | TradingView Lightweight Charts |
| **Styling** | Tailwind CSS |

---

## Project Structure

```
pendex/
├── contracts/
│   ├── core/
│   │   ├── ShadowVault.sol          # Main trading vault
│   │   ├── ShadowLiquidityPool.sol  # GMX-style LP pool
│   │   └── ShadowOracle.sol         # Price oracle
│   ├── tokens/
│   │   └── ShadowUSD.sol            # ERC-7984 confidential stablecoin
│   └── session/
│       └── WalletManager.sol        # Session wallet key storage
├── frontend/
│   ├── src/
│   │   ├── app/                     # Next.js 14 App Router
│   │   │   ├── trade/               # Trading interface
│   │   │   ├── wallet/              # Wallet + faucet + staking
│   │   │   ├── markets/             # Asset listings
│   │   │   ├── companies/           # Company profiles
│   │   │   ├── docs/                # Documentation
│   │   │   └── admin/               # Admin dashboard
│   │   ├── components/
│   │   │   ├── TradingPanel.tsx     # Main trade form
│   │   │   ├── PriceChart.tsx       # TradingView chart
│   │   │   ├── OrderBook.tsx        # Encrypted order book
│   │   │   ├── PositionsTable.tsx   # Active positions
│   │   │   └── SessionWalletSetup/  # Session wallet UI
│   │   └── lib/
│   │       ├── fhe/client.ts        # Zama SDK integration
│   │       ├── session-wallet/      # Session wallet manager
│   │       └── contracts/           # Contract configs & ABIs
└── scripts/
    ├── price-simulator.ts           # Price movement bot
    └── keeper-bot.ts                # Liquidation keeper
```

---

## Quick Start

### Prerequisites

- Node.js v20+
- npm or yarn
- MetaMask with Sepolia ETH

### Installation

```bash
# Clone repository
git clone https://github.com/Himess/shadow-protocol.git
cd shadow-protocol

# Install frontend dependencies
cd frontend && npm install

# Start development server
npm run dev
```

### Use the Live Demo

1. Visit [https://shadow-protocol-nine.vercel.app/](https://shadow-protocol-nine.vercel.app/)
2. Connect MetaMask (switch to Sepolia)
3. Go to Wallet → Get sUSD from Faucet
4. Go to Trade → Set up Session Wallet
5. Open your first encrypted position!

---

## FHE Operations Used

| Category | Operations | Use Case |
|----------|------------|----------|
| **Arithmetic** | `FHE.add()`, `FHE.sub()`, `FHE.mul()`, `FHE.div()` | P&L calculation, fee deduction |
| **Comparison** | `FHE.gt()`, `FHE.lt()`, `FHE.ge()`, `FHE.eq()` | Liquidation checks, balance validation |
| **Conditional** | `FHE.select()` | Branchless encrypted logic |
| **Negative** | `FHE.neg()` | Two's complement for losses |
| **Random** | `FHE.randEuint64()` | Bonus generation |
| **ACL** | `FHE.allow()`, `FHE.allowThis()` | Access control for decryption |

---

## Session Wallet Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SESSION WALLET FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SETUP (One-time)           INITIALIZE (Each session)          │
│  ───────────────            ─────────────────────────          │
│                                                                 │
│  1. Generate random         1. Connect main wallet              │
│     session wallet          2. Sign EIP-712 message             │
│  2. Encrypt private key     3. Decrypt session key              │
│     with FHE                   from on-chain                    │
│  3. Store encrypted key     4. Session wallet ready             │
│     on WalletManager           for popup-free trading!          │
│  4. Fund with 0.01 ETH                                          │
│     for gas                                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Why Session Wallets?**
- **No popups**: Trade without MetaMask confirmation each time
- **Secure**: Private key never leaves the browser, stored encrypted on-chain
- **Recoverable**: Re-initialize session anytime by decrypting with main wallet

---

## Price Mechanism

Prices are determined by: **Base Price + Demand Modifier**

```
Mark Price = Base Price × (1 + Demand Modifier)

Where:
  Demand Modifier = (Long OI - Short OI) / 10000
  Max Modifier = ±20%
```

**Example:**
- OpenAI base price: $250
- Long OI: $5,000, Short OI: $3,000
- Demand modifier: +0.2% → Mark price: $250.50

---

## Key Differentiators

| Feature | Traditional Perps | Pendex |
|---------|-------------------|--------|
| Position privacy | Public | Encrypted |
| Leverage visibility | Public | Encrypted |
| Liquidation hunting | Possible | Impossible |
| Front-running | Common | Not possible |
| Copy trading risk | High | None |
| Anonymous trading | Not available | Supported |
| Trade confirmation | Popup each time | Session wallet (no popup) |

---

## Built For

**Zama Builder Track Hackathon 2025** - Demonstrating real-world FHE applications in DeFi

---

## Team

Built by [Himess](https://github.com/Himess)

---

## License

BSD-3-Clause-Clear - See [LICENSE](LICENSE) for details.

---

## Links

- [Live Demo](https://shadow-protocol-nine.vercel.app/)
- [Zama fhEVM Documentation](https://docs.zama.ai/fhevm)
- [Hackathon Page](https://dorahacks.io/hackathon/zama-bounty)

---

*Pendex - Trade in the shadows, not in the spotlight.*

# Pendex

<div align="center">

**Private Leveraged Trading for Pre-IPO Assets**

*The first DeFi Dark Pool powered by Fully Homomorphic Encryption*

[![License](https://img.shields.io/badge/license-BSD--3--Clause--Clear-blue.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)](https://soliditylang.org/)
[![fhEVM](https://img.shields.io/badge/fhEVM-0.9.1-purple.svg)](https://www.zama.ai/fhevm)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![Live Demo](https://img.shields.io/badge/demo-live-success.svg)](https://shadow-protocol-nine.vercel.app/)

[Live Demo](https://shadow-protocol-nine.vercel.app/) · [Documentation](https://shadow-protocol-nine.vercel.app/docs) · [Hackathon](https://dorahacks.io/hackathon/zama-bounty)

</div>

---

## Table of Contents

- [The Problem](#the-problem)
- [Our Solution](#our-solution)
- [How FHE Works](#how-fhe-works)
- [Dark Pool Architecture](#dark-pool-architecture)
- [Tradeable Assets](#tradeable-assets)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Session Wallet](#session-wallet)
- [Price Mechanism](#price-mechanism)
- [Trading Flow](#trading-flow)
- [Fee Structure](#fee-structure)
- [Smart Contracts](#smart-contracts)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Status](#project-status)

---

## The Problem

Traditional DeFi perpetual trading platforms expose **everything** on-chain:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TRADITIONAL PERP PROTOCOL (PUBLIC)                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Position: 0x1234...5678                                                    │
│  ├── Size: $50,000 LONG              ← Everyone sees this                   │
│  ├── Entry Price: $157.25            ← Front-runners exploit this           │
│  ├── Leverage: 10x                   ← Liquidation hunters target this      │
│  ├── Liquidation Price: $141.52      ← Whales manipulate to trigger this    │
│  └── Owner: 0xABC...123              ← Copy traders follow this             │
│                                                                             │
│  Result: Front-running, liquidation hunting, copy trading attacks          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Attack Vector | Description | Impact |
|---------------|-------------|--------|
| **Front-Running** | MEV bots see your trade before execution | Worse execution price |
| **Liquidation Hunting** | Whales push price to trigger liquidations | Forced position closure |
| **Copy Trading** | Others mirror your trades without consent | Alpha extraction |
| **Stop Loss Raids** | Visible stop losses get targeted | Premature exits |

---

## Our Solution

Pendex encrypts **everything** using Zama's Fully Homomorphic Encryption:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PENDEX DARK POOL (ENCRYPTED)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Position: 0x1234...5678                                                    │
│  ├── Size: 0x7f3a...encrypted        ← Nobody can see                       │
│  ├── Entry Price: 0x8b2c...encrypted ← Front-running impossible             │
│  ├── Leverage: 0x1d4f...encrypted    ← Liquidation hunting impossible       │
│  ├── Direction: 0x9a3e...encrypted   ← Long or Short? Unknown               │
│  └── Owner: 0xf2e1...encrypted       ← Optional: Full anonymity             │
│                                                                             │
│  Result: Trade with complete privacy - even validators can't see            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## How FHE Works

**Fully Homomorphic Encryption (FHE)** allows computation on encrypted data without decryption:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     TRADITIONAL vs FHE ENCRYPTION                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TRADITIONAL:                                                               │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Encrypted│ -> │ DECRYPT  │ -> │ Process  │ -> │ Encrypt  │              │
│  │   Data   │    │   ⚠️     │    │   ⚠️     │    │  Again   │              │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘              │
│                        ↑              ↑                                     │
│                    DATA EXPOSED DURING PROCESSING!                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ZAMA FHE:                                                                  │
│  ┌──────────┐    ┌──────────────────────────┐    ┌──────────┐              │
│  │ Encrypted│ -> │ Process while encrypted  │ -> │ Encrypted│              │
│  │   Data   │    │      ✅ SECURE           │    │  Result  │              │
│  └──────────┘    └──────────────────────────┘    └──────────┘              │
│                                                                             │
│                    DATA NEVER EXPOSED - EVER!                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### FHE Data Types in Pendex

| Type | Usage | Example |
|------|-------|---------|
| `euint64` | Encrypted 64-bit unsigned integer | Balance, Price, Size |
| `ebool` | Encrypted boolean | Long/Short direction |
| `eaddress` | Encrypted address | Anonymous position owner |

### FHE Operations Used

| Category | Operations | Use Case |
|----------|------------|----------|
| **Arithmetic** | `FHE.add()`, `FHE.sub()`, `FHE.mul()`, `FHE.div()` | P&L calculation |
| **Comparison** | `FHE.gt()`, `FHE.lt()`, `FHE.ge()`, `FHE.eq()` | Liquidation checks |
| **Conditional** | `FHE.select()` | Branchless encrypted logic |
| **Negative** | `FHE.neg()` | Two's complement for losses |
| **Access Control** | `FHE.allow()`, `FHE.allowThis()` | Decryption permissions |

---

## Dark Pool Architecture

### What Others Can and Cannot See

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRIVACY GUARANTEES                                  │
├────────────────────────────────┬────────────────────────────────────────────┤
│     ❌ ENCRYPTED (Hidden)      │     ✅ PUBLIC (Visible)                    │
├────────────────────────────────┼────────────────────────────────────────────┤
│                                │                                            │
│  • Position size               │  • Asset being traded (SpaceX, OpenAI)    │
│  • Entry price                 │  • Position exists (not details)          │
│  • Leverage amount             │  • Total Open Interest (aggregated)       │
│  • Long/Short direction        │  • Mark prices from oracle                │
│  • Profit & Loss               │  • Liquidity score                        │
│  • Wallet balance              │  • Trading timestamps                     │
│  • Order trigger prices        │                                            │
│  • Owner address (optional)    │                                            │
│                                │                                            │
└────────────────────────────────┴────────────────────────────────────────────┘
```

### Example

```
What an observer sees:
  "Wallet 0x123 has 3 positions on Pendex"

What they DON'T see:
  "Wallet 0x123 is $50K long on SpaceX with 5x leverage, entry $180"
```

---

## Tradeable Assets

### Pre-IPO Synthetic Shares

6 high-growth private companies available for trading:

| Company | Category | Base Price | Valuation | Symbol |
|---------|----------|------------|-----------|--------|
| **OpenAI** | AI | $250 | $250B | OPENAI |
| **Anthropic** | AI | $95 | $95B | ANTHR |
| **SpaceX** | Aerospace | $180 | $180B | SPACEX |
| **Stripe** | FinTech | $48 | $48B | STRIPE |
| **Databricks** | Data | $55 | $55B | DTBRKS |
| **ByteDance** | Social | $165 | $165B | BYTDNC |

### Pricing Formula

```
Synthetic Share Price = Company Valuation / 1,000,000,000 shares

Example: SpaceX
$180B valuation ÷ 1B shares = $180 per synthetic share
```

### Synthetic vs Real Shares

| Feature | Real Pre-IPO Shares | Pendex Synthetic |
|---------|---------------------|------------------|
| Ownership | Company equity | Price exposure only |
| Voting Rights | Yes | No |
| Dividends | Yes | No |
| Short Selling | Very difficult | Easy (1-click) |
| Leverage | Requires margin account | Built-in 1-10x |
| Minimum Investment | $100,000+ | $1 |
| KYC Required | Yes (accredited) | No |
| Trading Hours | Business hours | 24/7 |
| Privacy | Fully tracked | FHE encrypted |

---

## Key Features

### 1. Dark Pool Trading
Trade privately without exposing positions. No front-running, no copy trading, no liquidation hunting.

### 2. Session Wallet (Popup-Free Trading)
One-time wallet setup stores an encrypted session key on-chain using FHE. Trade without MetaMask popups!

### 3. Direct sUSD Trading (Hyperliquid-Style)
No vault deposits required. Get sUSD from faucet and trade immediately.

### 4. Encrypted Limit Orders
Set stop-loss and take-profit orders that are invisible to MEV bots.

### 5. Anonymous Mode (eaddress)
Optional full anonymity - even your wallet address is encrypted.

### 6. GMX-Style Liquidity Pool
Stake LP tokens to earn 50% of trading fees. Trader losses = LP gains.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PENDEX ARCHITECTURE                               │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   USER WALLET   │
                              │   (MetaMask)    │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
          ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
          │   FRONTEND      │ │  SESSION WALLET │ │   FHE SDK       │
          │   (Next.js 14)  │ │  (Popup-free)   │ │   (Encryption)  │
          └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
                   │                   │                   │
                   └───────────────────┼───────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ETHEREUM SEPOLIA + ZAMA FHE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        SHADOW VAULT (Core)                            │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │  │
│  │  │    Encrypted    │  │    Anonymous    │  │   Encrypted     │       │  │
│  │  │    Positions    │  │    Positions    │  │   Limit Orders  │       │  │
│  │  │                 │  │                 │  │                 │       │  │
│  │  │  • euint64 coll │  │  • eaddress own │  │  • euint64 trig │       │  │
│  │  │  • euint64 size │  │  • euint64 coll │  │  • euint64 size │       │  │
│  │  │  • euint64 entr │  │  • ebool isLong │  │  • ebool isLong │       │  │
│  │  │  • ebool isLong │  │                 │  │                 │       │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                       │                                     │
│            ┌──────────────────────────┼──────────────────────────┐          │
│            │                          │                          │          │
│            ▼                          ▼                          ▼          │
│  ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐   │
│  │   SHADOW USD    │       │  SHADOW ORACLE  │       │  LIQUIDITY POOL │   │
│  │   (ERC-7984)    │       │                 │       │   (GMX-style)   │   │
│  │                 │       │  • Base prices  │       │                 │   │
│  │  • Encrypted    │       │  • Demand mod   │       │  • Encrypted LP │   │
│  │    balances     │◄─────►│  • OI tracking  │◄─────►│    balances     │   │
│  │  • Confidential │       │  • 6 assets     │       │  • Fee sharing  │   │
│  │    transfers    │       │                 │       │                 │   │
│  └─────────────────┘       └─────────────────┘       └─────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│                          ┌─────────────────────┐                            │
│                          │   WALLET MANAGER    │                            │
│                          │  (Session Keys)     │                            │
│                          │                     │                            │
│                          │  • Encrypted key    │                            │
│                          │    storage (FHE)    │                            │
│                          │  • EIP-712 decrypt  │                            │
│                          └─────────────────────┘                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Session Wallet

### The Problem with Traditional DeFi

Every transaction requires a MetaMask popup → Poor UX for active traders

### Our Solution: Encrypted Session Keys

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SESSION WALLET FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐        │
│  │      SETUP (One-time)       │    │   INITIALIZE (Each session) │        │
│  ├─────────────────────────────┤    ├─────────────────────────────┤        │
│  │                             │    │                             │        │
│  │  1. Generate random wallet  │    │  1. Connect main wallet     │        │
│  │  2. Encrypt private key     │    │  2. Sign EIP-712 message    │        │
│  │     with FHE                │    │  3. Decrypt session key     │        │
│  │  3. Store encrypted key     │    │     from on-chain           │        │
│  │     on WalletManager        │    │  4. Session ready!          │        │
│  │  4. Fund with 0.01+ ETH     │    │     (no more popups)        │        │
│  │                             │    │                             │        │
│  └─────────────────────────────┘    └─────────────────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Security Guarantees

| Aspect | Protection |
|--------|------------|
| **Limited Permissions** | Session wallet can ONLY execute trades, not access main wallet |
| **Encrypted Storage** | Private key is FHE encrypted on-chain |
| **Owner-Only Decrypt** | Only main wallet owner can decrypt session key |
| **Minimal Risk** | Worst case: only lose small ETH amount for gas |

### Gas Requirements

| Amount | Trades Possible |
|--------|-----------------|
| 0.1 ETH | ~1 trade |
| 0.5 ETH | ~3 trades |
| 1.0 ETH | ~6+ trades |

*FHE transactions are more expensive due to encryption overhead (~0.15 ETH per trade)*

---

## Price Mechanism

### Two-Component Pricing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRICE FORMULA                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    Mark Price = Base Price × (1 + Demand Modifier)                          │
│                                                                             │
│    ┌─────────────────┐         ┌─────────────────────────┐                  │
│    │   BASE PRICE    │    +    │    DEMAND MODIFIER      │                  │
│    ├─────────────────┤         ├─────────────────────────┤                  │
│    │                 │         │                         │                  │
│    │ Latest funding  │         │ (Long OI - Short OI)    │                  │
│    │ round valuation │         │ ───────────────────     │                  │
│    │                 │         │       10,000            │                  │
│    │ Example:        │         │                         │                  │
│    │ OpenAI = $250   │         │ Range: -20% to +20%     │                  │
│    │                 │         │                         │                  │
│    └─────────────────┘         └─────────────────────────┘                  │
│                                                                             │
│    Example Calculation:                                                     │
│    ─────────────────────                                                    │
│    Base Price: $250 (OpenAI)                                                │
│    Long OI: $50,000 | Short OI: $30,000                                     │
│    Demand Modifier: ($50K - $30K) / $10K = +0.2% (+2%)                      │
│    Mark Price: $250 × 1.02 = $255                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Open Interest Impact

| Scenario | Effect |
|----------|--------|
| More Longs than Shorts | Price pushed UP (max +20%) |
| More Shorts than Longs | Price pushed DOWN (max -20%) |
| Equal Long/Short | Price = Base Price |

---

## Trading Flow

### Step-by-Step

```
┌───┐  ┌────────────────────────────────────────────────────────────────────┐
│ 1 │  │ Connect Wallet                                                     │
│   │  │ Connect MetaMask and switch to Sepolia testnet                     │
└───┘  └────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌───┐  ┌────────────────────────────────────────────────────────────────────┐
│ 2 │  │ Setup Session Wallet (One-time)                                    │
│   │  │ Create session wallet, encrypt key with FHE, store on-chain        │
└───┘  └────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌───┐  ┌────────────────────────────────────────────────────────────────────┐
│ 3 │  │ Fund Session Wallet                                                │
│   │  │ Send 0.1-0.5 ETH for gas fees                                      │
└───┘  └────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌───┐  ┌────────────────────────────────────────────────────────────────────┐
│ 4 │  │ Get sUSD                                                           │
│   │  │ Claim test tokens from faucet (Wallet page)                        │
└───┘  └────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌───┐  ┌────────────────────────────────────────────────────────────────────┐
│ 5 │  │ Select Asset & Configure Position                                  │
│   │  │ Choose asset, set Long/Short, leverage (1-10x), and collateral     │
└───┘  └────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌───┐  ┌────────────────────────────────────────────────────────────────────┐
│ 6 │  │ Open Position (No Popup!)                                          │
│   │  │ Session wallet signs transaction automatically                     │
└───┘  └────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌───┐  ┌────────────────────────────────────────────────────────────────────┐
│ 7 │  │ Close Position & Collect Profits                                   │
│   │  │ Close when ready, profits added to sUSD balance                    │
└───┘  └────────────────────────────────────────────────────────────────────┘
```

---

## Fee Structure

### Trading Fees

| Fee Type | Rate | Description |
|----------|------|-------------|
| **Trading Fee** | 0.3% | On position open/close |
| **Liquidation Fee** | 1.0% | If position is liquidated |

### Fee Distribution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FEE DISTRIBUTION                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                        Total Fees Collected                                 │
│                              │                                              │
│                    ┌─────────┴─────────┐                                    │
│                    │                   │                                    │
│                    ▼                   ▼                                    │
│             ┌───────────┐       ┌───────────┐                               │
│             │    50%    │       │    50%    │                               │
│             │ LP Stakers│       │ Protocol  │                               │
│             │           │       │ Treasury  │                               │
│             └───────────┘       └───────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Leverage Example

```
Collateral: $1,000
Leverage: 5x
Position Size: $5,000

┌─────────────────────────────────────────────────────────────────┐
│ If price increases 10%:                                         │
│ Profit = $5,000 × 10% = $500 (+50% on collateral)              │
├─────────────────────────────────────────────────────────────────┤
│ If price decreases 10%:                                         │
│ Loss = $5,000 × 10% = $500 (-50% on collateral)                │
├─────────────────────────────────────────────────────────────────┤
│ Liquidation at -100% collateral loss (varies by leverage)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Smart Contracts

### Deployed on Sepolia Testnet

| Contract | Address | Description |
|----------|---------|-------------|
| **ShadowVault** | [`0x2ECB31ac17cF357B33CD81AA23983f39249c2322`](https://sepolia.etherscan.io/address/0x2ECB31ac17cF357B33CD81AA23983f39249c2322) | Core trading engine |
| **ShadowOracle** | [`0x4e819459EEE3061f10D7d0309F4Ba39Af5A68f81`](https://sepolia.etherscan.io/address/0x4e819459EEE3061f10D7d0309F4Ba39Af5A68f81) | Price oracle |
| **ShadowUSD** | [`0x6ABe3F3791B4Cee0f47dA1F10B4106c50C0EE6BC`](https://sepolia.etherscan.io/address/0x6ABe3F3791B4Cee0f47dA1F10B4106c50C0EE6BC) | ERC-7984 stablecoin |
| **ShadowLiquidityPool** | [`0x548F8CbA6Fa4717BC6890D0f3175094c1FEeaa87`](https://sepolia.etherscan.io/address/0x548F8CbA6Fa4717BC6890D0f3175094c1FEeaa87) | LP staking |
| **WalletManager** | [`0x4de6E26b438e61ead479f46BCe309D5d0a16bD71`](https://sepolia.etherscan.io/address/0x4de6E26b438e61ead479f46BCe309D5d0a16bD71) | Session key storage |

### Contract Architecture

```
ShadowVault.sol (Core)
├── openPosition()           # Encrypted position opening
├── closePosition()          # Encrypted position closing
├── openAnonymousPosition()  # With eaddress (full anonymity)
├── placeLimitOrder()        # Encrypted trigger price
└── liquidatePosition()      # Automatic at -100%

ShadowUSD.sol (ERC-7984)
├── confidentialBalanceOf()  # Returns encrypted balance
├── confidentialTransfer()   # Encrypted token transfer
├── setOperator()            # Grant transfer permissions
└── faucetMint()             # Testnet token minting

ShadowOracle.sol
├── getMarkPrice()           # Base + demand modifier
├── updateOpenInterest()     # Track Long/Short OI
└── getAssetInfo()           # Asset metadata

WalletManager.sol
├── storeSessionKey()        # FHE-encrypted key storage
├── getSessionKey()          # Decrypt with EIP-712
└── revokeSessionWallet()    # Invalidate session
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Smart Contracts** | Solidity 0.8.24 | Core protocol logic |
| **FHE** | Zama fhEVM 0.9.1 | Encryption layer |
| **FHE SDK** | @zama-fhe/relayer-sdk | Client encryption |
| **Frontend** | Next.js 14, React 18 | User interface |
| **Web3** | wagmi 2.x, viem | Blockchain interaction |
| **Wallet** | RainbowKit | Wallet connection |
| **Charts** | TradingView Lightweight | Price visualization |
| **Styling** | Tailwind CSS | UI styling |

---

## Quick Start

### Prerequisites

- Node.js v20+
- MetaMask browser extension
- Sepolia ETH (from faucet)

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
3. Go to **Wallet** → Get sUSD from Faucet
4. Go to **Trade** → Set up Session Wallet
5. Open your first encrypted position!

---

## Project Status

### Completed Features

- [x] FHE encrypted trading (collateral, leverage, direction)
- [x] Session wallet for popup-free trading
- [x] Encrypted session key storage (WalletManager)
- [x] Direct sUSD trading (no vault deposit needed)
- [x] Balance decryption with EIP-712
- [x] Auto-decrypt on page load
- [x] 6 Pre-IPO assets with real valuations
- [x] Limit orders (encrypted trigger prices)
- [x] Anonymous mode with eaddress
- [x] Transaction history from blockchain events
- [x] P&L tracking
- [x] Liquidity Pool staking
- [x] Admin dashboard
- [x] Professional documentation

### Roadmap

- [ ] Mobile responsive optimization
- [ ] Additional Pre-IPO assets
- [ ] Mainnet deployment
- [ ] Cross-chain support

---

## Built For

<div align="center">

**Zama Builder Track Hackathon 2025**

*Demonstrating real-world FHE applications in DeFi*

[DoraHacks Hackathon Page](https://dorahacks.io/hackathon/zama-bounty)

</div>

---

## Team

Built by [Himess](https://github.com/Himess)

---

## License

BSD-3-Clause-Clear - See [LICENSE](LICENSE) for details.

---

## Links

- [Live Demo](https://shadow-protocol-nine.vercel.app/)
- [Documentation](https://shadow-protocol-nine.vercel.app/docs)
- [Zama fhEVM Docs](https://docs.zama.ai/fhevm)

---

<div align="center">

*Pendex - Trade in the shadows, not in the spotlight.*

</div>

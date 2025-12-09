# Shadow Protocol

**Private Leveraged Trading for Pre-IPO Assets** | Powered by Zama fhEVM

[![License](https://img.shields.io/badge/license-BSD--3--Clause--Clear-blue.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)](https://soliditylang.org/)
[![fhEVM](https://img.shields.io/badge/fhEVM-0.9.1-purple.svg)](https://www.zama.ai/fhevm)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)

> Trade SpaceX, OpenAI, Stripe, and other pre-IPO companies with **complete privacy**. Your positions, leverage, and P&L are encrypted on-chain using Fully Homomorphic Encryption.

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

Shadow Protocol encrypts **everything** using Zama's Fully Homomorphic Encryption:

```
                    Traditional Perp              Shadow Protocol
                    ---------------              ---------------
Position Size:      $50,000 LONG                 0x7f3a...encrypted
Entry Price:        $157.25                      0x8b2c...encrypted
Leverage:           10x                          0x1d4f...encrypted
Direction:          LONG                         0x9a3e...encrypted
Owner:              0xABC...123                  Optional: encrypted!
```

**Nobody can see your trades - not validators, not MEV bots, not anyone.**

---

## Live Demo

**Deployed on Sepolia Testnet**

| Contract | Address |
|----------|---------|
| ShadowOracle | [`0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17`](https://sepolia.etherscan.io/address/0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17) |
| ShadowMarketMaker | [`0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb`](https://sepolia.etherscan.io/address/0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb) |
| ShadowVault | [`0xf6C0B8C7332080790a9425c0B888F74e8e9ff5B5`](https://sepolia.etherscan.io/address/0xf6C0B8C7332080790a9425c0B888F74e8e9ff5B5) |
| ShadowUSD | [`0x9093B02c4Ea2402EC72C2ca9dAAb994F7578fAFb`](https://sepolia.etherscan.io/address/0x9093B02c4Ea2402EC72C2ca9dAAb994F7578fAFb) |

---

## Tradeable Assets

17 Pre-IPO companies across 5 categories:

| Category | Assets |
|----------|--------|
| **AI & ML** | OpenAI ($157B), Anthropic ($61B), xAI ($50B), Perplexity ($9B), Groq ($2.8B) |
| **Aerospace** | SpaceX ($350B), Anduril ($14B), Shield AI ($5.3B) |
| **FinTech** | Stripe ($70B), Revolut ($45B), Ripple ($11B), Kraken ($10B) |
| **Data** | Databricks ($62B), Canva ($26B), Vercel ($3.5B) |
| **Social** | ByteDance ($300B), Discord ($15B) |

*Prices based on latest funding round valuations. 1 synthetic share = $1B market cap.*

---

## FHE Features Used

### Encrypted Data Types

```solidity
// All sensitive data is encrypted
euint64   collateral;        // Position collateral amount
euint64   size;              // Position size
euint64   entryPrice;        // Entry price
euint64   leverage;          // Leverage used
ebool     isLong;            // Direction (long/short)
eaddress  encryptedOwner;    // Anonymous trading!
euint8    errorCode;         // Even errors are encrypted
```

### FHE Operations

| Category | Operations | Use Case |
|----------|------------|----------|
| **Arithmetic** | `FHE.add()`, `FHE.sub()`, `FHE.mul()`, `FHE.div()` | P&L calculation, fee deduction |
| **Comparison** | `FHE.gt()`, `FHE.lt()`, `FHE.ge()`, `FHE.le()`, `FHE.eq()` | Liquidation checks, balance validation |
| **Conditional** | `FHE.select()` | Branchless encrypted logic |
| **Min/Max** | `FHE.min()`, `FHE.max()` | Clamping values |
| **Random** | `FHE.randEuint64()`, `FHE.randEuint8()` | Bonus generation, salt creation |

### Advanced Privacy Features

**1. Encrypted Error Handling**
```solidity
// Errors don't leak information
mapping(address => EncryptedError) private _lastErrors;
struct EncryptedError {
    euint8 errorCode;    // Encrypted error type
    uint256 timestamp;
}
```

**2. Anonymous Trading**
```solidity
// Complete identity hiding with eaddress
struct AnonymousPosition {
    eaddress encryptedOwner;  // Nobody knows who owns this!
    euint64 collateral;
    euint64 size;
    // ...
}
```

**3. Encrypted Limit Orders**
```solidity
// Anti-frontrunning limit orders
struct EncryptedLimitOrder {
    euint64 triggerPrice;     // Hidden trigger price
    euint64 collateral;       // Hidden size
    ebool isLong;             // Hidden direction
}
```

**4. Random Bonus Generation**
```solidity
// On-chain random bonuses
function generateRandomBonusMultiplier() returns (euint8) {
    return FHE.randEuint8(16);  // 0-15% encrypted random bonus
}
```

### ACL (Access Control List) Usage

```solidity
// Only position owner can decrypt their data
FHE.allowThis(position.collateral);           // Contract access
FHE.allow(position.collateral, msg.sender);   // Owner access
FHE.allowTransient(ciphertext, address);      // Gas-optimized temp access
```

---

## Architecture

```
shadow-protocol/
├── contracts/
│   ├── core/
│   │   ├── ShadowVault.sol          # Main trading vault (FHE positions)
│   │   ├── ShadowLiquidityPool.sol  # LP pool with encrypted staking
│   │   └── ShadowOracle.sol         # Price oracle with demand modifier
│   ├── tokens/
│   │   └── ShadowUSD.sol            # Stablecoin (OpenZeppelin ERC7984)
│   ├── bots/
│   │   └── ShadowMarketMaker.sol    # Automated market maker bot
│   └── interfaces/
│       └── IShadowTypes.sol         # Shared types & structs
├── frontend/
│   ├── src/
│   │   ├── app/                     # Next.js 14 pages
│   │   ├── components/              # React components
│   │   ├── lib/
│   │   │   ├── fhe/client.ts        # fhevmjs SDK integration
│   │   │   └── contracts/           # Contract ABIs & hooks
│   │   └── hooks/                   # Custom React hooks
│   └── public/
└── scripts/
    └── runBotSimple.ts              # Market maker bot script
```

---

## How It Works

### 1. Client-Side Encryption

```typescript
// Frontend encrypts data before sending to contract
import { initFheInstance, encryptPositionParams } from "@/lib/fhe/client";

const encrypted = await encryptPositionParams(
  collateralAmount,    // e.g., 1000 USDC
  leverageAmount,      // e.g., 5x
  isLong,              // true = long, false = short
  contractAddress,
  userAddress
);

// Send encrypted handles + proof to contract
openPosition(
  assetId,
  encrypted.encryptedCollateral,
  encrypted.encryptedLeverage,
  encrypted.encryptedIsLong,
  encrypted.inputProof
);
```

### 2. On-Chain FHE Operations

```solidity
// Contract performs operations on encrypted data
function openPosition(
    bytes32 assetId,
    externalEuint64 encCollateral,
    externalEuint64 encLeverage,
    externalEbool encIsLong,
    bytes calldata inputProof
) external {
    // Convert external inputs
    euint64 collateral = FHE.fromExternal(encCollateral, inputProof);
    euint64 leverage = FHE.fromExternal(encLeverage, inputProof);
    ebool isLong = FHE.fromExternal(encIsLong, inputProof);

    // Calculate position size (encrypted arithmetic)
    euint64 size = FHE.mul(collateral, leverage);

    // Validate balance (encrypted comparison)
    ebool hasBalance = FHE.ge(balances[msg.sender], collateral);

    // Use FHE.select() instead of if/else
    euint8 errorCode = FHE.select(hasBalance, NO_ERROR, ERROR_INSUFFICIENT);

    // Grant ACL permissions
    FHE.allowThis(size);
    FHE.allow(size, msg.sender);
}
```

### 3. User Decryption

```typescript
// Only the owner can decrypt their own data
const clearValue = await instance.reencrypt(
    handleBigInt,      // Encrypted handle
    privateKey,        // User's private key
    publicKey,         // User's public key
    signature,         // EIP-712 authorization
    contractAddress,
    userAddress
);
```

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
- OpenAI base price: $157
- Long OI: $5,000, Short OI: $3,000
- Demand modifier: +0.2% → Mark price: $157.31

This creates natural price discovery based on platform activity.

---

## Quick Start

### Prerequisites

- Node.js v20+
- npm or yarn

### Installation

```bash
# Clone repository
git clone https://github.com/your-username/shadow-protocol.git
cd shadow-protocol

# Install contract dependencies
npm install

# Install frontend dependencies
cd frontend && npm install
```

### Run Locally (Mock FHE)

```bash
# Terminal 1: Start local node
npx hardhat node

# Terminal 2: Deploy contracts
npx hardhat deploy --network localhost

# Terminal 3: Start frontend
cd frontend && npm run dev
```

### Deploy to Sepolia

```bash
# Set environment variables
npx hardhat vars set MNEMONIC
npx hardhat vars set INFURA_API_KEY

# Deploy
npx hardhat deploy --network sepolia
```

### Run Market Maker Bot

```bash
MARKET_MAKER_ADDRESS=0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb \
ORACLE_ADDRESS=0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17 \
npx hardhat run scripts/runBotSimple.ts --network sepolia
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Smart Contracts** | Solidity 0.8.24, Zama fhEVM 0.9.1 |
| **FHE SDK** | fhevmjs, @zama-fhe/relayer-sdk |
| **Frontend** | Next.js 14, React 18, TypeScript |
| **Web3** | wagmi 2.x, viem, RainbowKit |
| **Charts** | TradingView Lightweight Charts |
| **Styling** | Tailwind CSS |
| **Testing** | Hardhat, Chai |

---

## Key Differentiators

| Feature | Traditional Perps | Shadow Protocol |
|---------|-------------------|-----------------|
| Position privacy | Public | Encrypted |
| Leverage visibility | Public | Encrypted |
| Liquidation hunting | Possible | Impossible |
| Front-running | Common | Not possible |
| Copy trading risk | High | None |
| Anonymous trading | Not available | Supported |

---

## Roadmap

- [x] Core FHE contracts
- [x] Pre-IPO asset oracle
- [x] Trading frontend
- [x] Market maker bot
- [x] fhevmjs SDK integration
- [ ] Automatic liquidation at -100%
- [ ] Revenue sharing (50% LP, 50% protocol)
- [ ] Mobile responsive UI
- [ ] Advanced order types (Stop Loss, Take Profit)

---

## Built For

**Zama Bounty Program** - Demonstrating real-world FHE applications in DeFi

---

## License

BSD-3-Clause-Clear - See [LICENSE](LICENSE) for details.

---

## Links

- [Zama fhEVM Documentation](https://docs.zama.ai/fhevm)
- [OpenZeppelin Confidential Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)

---

*Shadow Protocol - Trade in the shadows, not in the spotlight.*

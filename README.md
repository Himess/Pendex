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

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SHADOW PROTOCOL                                     │
│                     Private Leveraged Pre-IPO Trading                           │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │    USER     │
                                    │   Wallet    │
                                    └──────┬──────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
          ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
          │   FRONTEND      │    │  FHE SDK        │    │   EIP-712       │
          │   (Next.js)     │    │  (Encryption)   │    │   (Signatures)  │
          └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
                   │                      │                      │
                   │         ┌────────────┴────────────┐         │
                   │         │  Encrypted Inputs       │         │
                   │         │  (handles + proofs)     │         │
                   │         └────────────┬────────────┘         │
                   │                      │                      │
                   └──────────────────────┼──────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ETHEREUM SEPOLIA + ZAMA FHE                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                         SHADOWVAULT (Core)                                │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │  │
│  │  │ Encrypted       │  │ Anonymous       │  │ Encrypted       │           │  │
│  │  │ Positions       │  │ Positions       │  │ Limit Orders    │           │  │
│  │  │                 │  │                 │  │                 │           │  │
│  │  │ • euint64 coll  │  │ • eaddress owner│  │ • euint64 price │           │  │
│  │  │ • euint64 size  │  │ • euint64 coll  │  │ • euint64 size  │           │  │
│  │  │ • euint64 entry │  │ • euint64 size  │  │ • ebool isLong  │           │  │
│  │  │ • ebool isLong  │  │ • ebool isLong  │  │                 │           │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘           │  │
│  │                                                                           │  │
│  │  FHE Operations: add, sub, mul, div, select, gt, lt, eq, rand            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                          │                                      │
│            ┌─────────────────────────────┼─────────────────────────────┐        │
│            │                             │                             │        │
│            ▼                             ▼                             ▼        │
│  ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐  │
│  │   SHADOWUSD     │          │  SHADOWORACLE   │          │ LIQUIDITYPOOL   │  │
│  │   (ERC-7984)    │          │                 │          │  (GMX-style)    │  │
│  │                 │          │  • Base prices  │          │                 │  │
│  │ • Encrypted     │          │  • Demand mod   │          │ • Encrypted LP  │  │
│  │   balances      │◄────────►│  • OI tracking  │◄────────►│   balances      │  │
│  │ • Confidential  │          │  • 17 Pre-IPO   │          │ • Epoch rewards │  │
│  │   transfers     │          │    assets       │          │ • Fee sharing   │  │
│  │ • Operators     │          │                 │          │                 │  │
│  └─────────────────┘          └─────────────────┘          └─────────────────┘  │
│                                          │                                      │
└──────────────────────────────────────────┼──────────────────────────────────────┘
                                           │
                                           ▼
                              ┌─────────────────────┐
                              │   MARKET MAKER      │
                              │   BOT (Off-chain)   │
                              │                     │
                              │ • Simulates trades  │
                              │ • Updates OI        │
                              │ • Price discovery   │
                              └─────────────────────┘
```

### Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            TRADING FLOW                                       │
└──────────────────────────────────────────────────────────────────────────────┘

1. DEPOSIT                    2. OPEN POSITION                3. CLOSE POSITION
   ─────────                     ─────────────                   ──────────────

   User                          User                            User
    │                             │                               │
    │ encrypt(amount)             │ encrypt(collateral,           │ prepareClose()
    │                             │         leverage,             │      │
    ▼                             │         isLong)               ▼      │
┌────────┐                        ▼                          ┌────────┐  │
│ FHE.   │                   ┌────────┐                      │ FHE.   │  │
│ from   │                   │ FHE.   │                      │ make   │  │
│External│                   │ from   │                      │Publicly│  │
└───┬────┘                   │External│                      │Decrypt │  │
    │                        └───┬────┘                      └───┬────┘  │
    ▼                            │                               │      │
┌────────┐                       ▼                               ▼      │
│_balance│                  ┌─────────┐                    ┌─────────┐  │
│[user]  │                  │Position │                    │ Zama    │  │
│ += amt │                  │{        │                    │ Gateway │  │
└────────┘                  │ collat, │                    │ decrypt │  │
                            │ size,   │                    └────┬────┘  │
                            │ entry,  │                         │      │
                            │ isLong  │                         ▼      │
                            │}        │                    finalizeClose()
                            └─────────┘                    checkSignatures()
                                                           transfer funds
```

### Privacy Guarantees

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         WHAT'S ENCRYPTED (FHE)                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  POSITIONS                    ORDERS                    BALANCES             │
│  ─────────                    ──────                    ────────             │
│  ✓ Collateral amount          ✓ Trigger price           ✓ sUSD balance       │
│  ✓ Position size              ✓ Order size              ✓ Vault balance      │
│  ✓ Entry price                ✓ Direction               ✓ LP tokens          │
│  ✓ Leverage                   ✓ Owner (optional)        ✓ Pending rewards    │
│  ✓ Direction (long/short)                                                    │
│  ✓ Owner address (optional)                                                  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                         WHAT'S PUBLIC                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  • Asset being traded (SpaceX, OpenAI, etc.)                                │
│  • Position open/close status                                                │
│  • Timestamp of operations                                                   │
│  • Total Open Interest (aggregated, not individual)                         │
│  • Mark prices (derived from OI)                                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
shadow-protocol/
├── contracts/
│   ├── core/
│   │   ├── ShadowVault.sol          # Main trading vault (1800+ lines)
│   │   ├── ShadowLiquidityPool.sol  # GMX-style LP pool
│   │   └── ShadowOracle.sol         # Price oracle + demand modifier
│   ├── tokens/
│   │   └── ShadowUSD.sol            # ERC-7984 confidential stablecoin
│   └── bots/
│       └── ShadowMarketMaker.sol    # On-chain market maker
├── frontend/
│   ├── src/
│   │   ├── app/                     # Next.js 14 App Router
│   │   │   ├── trade/               # Trading interface
│   │   │   ├── wallet/              # Wallet + decryption + operators
│   │   │   ├── markets/             # Asset listings
│   │   │   └── admin/               # Admin dashboard
│   │   └── lib/
│   │       └── fhe/client.ts        # Zama Relayer SDK integration
├── test/
│   └── ShadowProtocol.test.ts       # 53 passing tests
└── scripts/
    └── runBotSimple.ts              # Market maker bot
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

## Anti-Manipulation Protection

### The Problem with Traditional Platforms

On platforms like Binance, Bybit, and other CEX/DEX:

```
TRADITIONAL ORDER BOOK (Everyone sees everything):
┌─────────────────────────────────────────────────┐
│  $158.50  [████████]        $2.5M LONG          │ ← Whales see this
│  $157.00  [██████████████]  $8M LONG            │ ← "Let's pump to liquidate $8M!"
│  $155.00  [████]            $1.2M SHORT         │ ← Easy target
└─────────────────────────────────────────────────┘
Result: Coordinated pump/dump attacks, liquidation cascades
```

**How manipulation works:**
1. Whales see where large positions are (liquidation levels)
2. They coordinate to move price to trigger liquidations
3. Retail traders lose, whales profit from the cascade
4. This is why "stop loss hunting" and "liquidation wicks" are so common

### Shadow Protocol's Solution

```
SHADOW PROTOCOL ORDER BOOK (Privacy-preserving):
┌─────────────────────────────────────────────────┐
│  $158.50  [████████]        ????????            │ ← Amount encrypted
│  $157.00  [██████████████]  ????????            │ ← Who placed it? Unknown
│  $155.00  [████]            ????????            │ ← Can't target anyone
└─────────────────────────────────────────────────┘
Result: Manipulation is economically infeasible
```

**What's visible:**
- Price levels (required for market function)
- Relative liquidity bars (shows "there's liquidity here")

**What's encrypted (FHE):**
- Exact order amounts
- Order owner addresses
- Position sizes and directions
- Leverage used
- Liquidation prices

**Even the platform operators can't see this data** - that's the power of FHE!

### Why This Matters

| Attack Vector | Traditional | Shadow Protocol |
|---------------|-------------|-----------------|
| Liquidation hunting | ✅ Easy - all positions visible | ❌ Impossible - positions encrypted |
| Stop loss raids | ✅ Common - stops are public | ❌ Can't see stop levels |
| Whale tracking | ✅ Anyone can track | ❌ Addresses encrypted |
| Front-running | ✅ MEV bots profit | ❌ Order details hidden |
| Copy trading | ✅ Can copy any address | ❌ Can't identify traders |

**Note:** Shadow Protocol uses Fully Homomorphic Encryption (FHE), not Zero Knowledge proofs. FHE allows computation on encrypted data without ever decrypting it.

---

## New Features (Latest)

### ERC-7984 Operator Pattern

Grant trusted addresses permission to transfer your encrypted funds:

```solidity
// Grant operator access
shadowUSD.setOperator(vaultAddress, true);

// Operator can transfer on user's behalf
shadowUSD.operatorTransfer(from, to, encryptedAmount, proof);
```

**Use Cases:**
- Smart contract vaults
- Multi-sig wallets
- Delegated trading bots
- Account recovery systems

### User Decryption (EIP-712)

Only you can decrypt your own balance:

```typescript
// 1. Generate keypair
const keypair = fhevm.generateKeypair();

// 2. Create & sign EIP-712 authorization
const eip712 = fhevm.createEIP712(keypair.publicKey, [contractAddress], timestamp, days);
const signature = await signer.signTypedData(eip712.domain, eip712.types, eip712.message);

// 3. Decrypt - only user can see the value
const balance = await fhevm.userDecrypt(handles, keypair.privateKey, keypair.publicKey, signature, ...);
```

### Async Decryption with Gateway Callback

For operations requiring public verification (liquidations, position closes):

```solidity
// 1. Request decryption
function requestPositionClose(uint256 positionId) external returns (uint256) {
    bytes32[] memory cts = new bytes32[](2);
    cts[0] = FHE.toBytes32(position.collateral);
    cts[1] = FHE.toBytes32(finalAmount);

    // Request decryption from Zama Gateway
    uint256 requestId = FHE.requestDecryption(cts, this.callbackPositionClose.selector);
    return requestId;
}

// 2. Gateway calls back with decrypted values
function callbackPositionClose(
    uint256 requestId,
    bytes memory cleartexts,
    bytes memory decryptionProof
) external {
    // CRITICAL: Verify KMS signatures!
    FHE.checkSignatures(requestId, cleartexts, decryptionProof);

    // Safe to use decrypted values now
    (uint64 finalAmount, uint64 collateral) = abi.decode(cleartexts, (uint64, uint64));
    // ... process close
}
```

**Features:**
- Two-step async pattern (request → callback)
- KMS signature verification with `FHE.checkSignatures()`
- Tamper-proof decryption proofs
- Used for liquidations and position settlements

### Admin Dashboard

- Protocol fee management (bps)
- Revenue statistics (total fees, LP distribution, treasury)
- Asset listing with categories (AI, Aerospace, FinTech, Data, Social)
- Trading bot control (start/stop, activity monitoring)

### Encrypted Order Book

Privacy-preserving order book where:
- Price levels are visible (for market depth)
- Order amounts are shown as bars (relative size)
- Individual order sizes remain encrypted
- Order ownership is completely hidden

---

## Roadmap

- [x] Core FHE contracts
- [x] Pre-IPO asset oracle
- [x] Trading frontend
- [x] Market maker bot
- [x] fhevmjs SDK integration
- [x] ERC-7984 Operator pattern
- [x] User Decryption (EIP-712)
- [x] Admin Dashboard
- [x] Encrypted Order Book
- [x] @zama-fhe/relayer-sdk integration
- [x] Async Decryption (Gateway Callback)
- [x] FHE.checkSignatures() verification
- [x] Automatic liquidation at -100%
- [x] Revenue sharing (50% LP, 50% protocol)
- [x] Advanced order types (Stop Loss, Take Profit)
- [ ] Mobile responsive UI optimization
- [ ] Mainnet deployment

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

# Pendex Frontend

Next.js 14 trading interface with FHE integration for private leveraged trading.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Web3:** wagmi 2.x, viem, RainbowKit
- **Charts:** TradingView Lightweight Charts
- **FHE SDK:** @zama-fhe/relayer-sdk

## Getting Started

### Prerequisites

- Node.js v20+
- npm or yarn
- MetaMask with Sepolia ETH

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build

```bash
npm run build
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Redirects to /markets |
| `/markets` | Asset market overview with prices |
| `/trade` | Main trading interface |
| `/wallet` | Wallet, staking, faucet |
| `/history` | Transaction history |
| `/companies` | Company profiles |
| `/companies/[symbol]` | Individual company details |
| `/docs` | Documentation and FAQ |
| `/admin` | Protocol admin dashboard |

## Key Features

### Trading Interface
- Real-time price charts
- Encrypted order placement
- Position management with FHE privacy
- Stop Loss / Take Profit orders

### Session Wallet
- One-time setup (encrypted key on-chain)
- Popup-free trading
- Withdraw/refund functionality

### Wallet Features
- Encrypted balance display
- sUSD faucet
- LP staking
- Operator management

### FHE Integration
- Client-side encryption via @zama-fhe/relayer-sdk
- User decryption (EIP-712 signatures)
- Zama Gateway for async decryption

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
```

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js pages
│   ├── components/             # React components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── PriceChart.tsx
│   │   ├── OrderBook.tsx
│   │   ├── TradingPanel.tsx
│   │   ├── PositionsTable.tsx
│   │   ├── SessionWalletSetup.tsx
│   │   └── TradeHistory.tsx
│   ├── lib/
│   │   ├── fhe/
│   │   │   └── client.ts       # FHE SDK integration
│   │   ├── session-wallet/
│   │   │   ├── manager.ts      # Session wallet logic
│   │   │   └── hooks.ts        # React hooks
│   │   ├── contracts/
│   │   │   ├── config.ts       # Contract addresses
│   │   │   └── abis.ts         # Contract ABIs
│   │   └── constants.ts
│   └── hooks/
│       └── useOnChainOracle.ts
├── public/
│   ├── logo.png
│   └── assets/
└── tailwind.config.ts
```

## FHE Client Usage

```typescript
import { initFheInstance, encryptPositionParams } from "@/lib/fhe/client";

// Initialize FHE instance
await initFheInstance();

// Encrypt position parameters
const encrypted = await encryptPositionParams(
  collateral,    // Amount in USD
  leverage,      // 1-10x
  isLong,        // true = long, false = short
  contractAddress,
  userAddress
);

// Use in contract call
await contract.openPosition(
  assetId,
  encrypted.encryptedCollateral,
  encrypted.encryptedLeverage,
  encrypted.encryptedIsLong,
  encrypted.inputProof
);
```

## Session Wallet Usage

```typescript
import { useSessionWallet } from "@/lib/session-wallet/hooks";

const {
  isSessionActive,
  sessionAddress,
  setupSessionWallet,
  initializeSession,
  getSessionSigner,
  withdrawToMainWallet,
  refundSessionWallet,
} = useSessionWallet();

// Setup (one-time)
await setupSessionWallet("0.01"); // Fund with 0.01 ETH

// Initialize (each session)
await initializeSession();

// Get signer for popup-free trading
const signer = getSessionSigner();
```

## Network

- **Sepolia Testnet** (chainId: 11155111)
- Network switching handled via RainbowKit

## Contract Addresses (Sepolia)

```
ShadowOracle:        0x4e819459EEE3061f10D7d0309F4Ba39Af5A68f81
ShadowUSD:           0x6ABe3F3791B4Cee0f47dA1F10B4106c50C0EE6BC
ShadowLiquidityPool: 0x548F8CbA6Fa4717BC6890D0f3175094c1FEeaa87
ShadowVault:         0x2ECB31ac17cF357B33CD81AA23983f39249c2322
WalletManager:       0x4de6E26b438e61ead479f46BCe309D5d0a16bD71
```

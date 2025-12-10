# Shadow Protocol - Frontend

Next.js 14 trading interface with FHE integration for private leveraged trading.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Web3:** wagmi 2.x, viem, RainbowKit
- **Charts:** TradingView Lightweight Charts
- **FHE SDK:** fhevmjs

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js pages
│   │   ├── page.tsx           # Home (redirects to /markets)
│   │   ├── markets/           # Asset market overview
│   │   ├── trade/             # Trading interface
│   │   ├── wallet/            # Wallet management
│   │   ├── history/           # Transaction history
│   │   ├── companies/         # Company profiles
│   │   ├── docs/              # Documentation
│   │   ├── fhe-test/          # FHE Gateway test page
│   │   └── admin/             # Admin dashboard
│   ├── components/
│   │   ├── Header.tsx         # Navigation header
│   │   ├── Footer.tsx         # Footer
│   │   ├── PriceChart.tsx     # TradingView chart
│   │   ├── OrderBook.tsx      # Encrypted order book
│   │   ├── TradingPanel.tsx   # Trade form
│   │   ├── PositionsTable.tsx # Active positions
│   │   └── ...
│   ├── lib/
│   │   ├── fhe/
│   │   │   └── client.ts      # fhevmjs SDK integration
│   │   ├── contracts/
│   │   │   ├── config.ts      # Contract addresses
│   │   │   ├── abis.ts        # Contract ABIs
│   │   │   └── hooks.ts       # wagmi hooks
│   │   ├── constants.ts       # App constants
│   │   └── utils.ts           # Utility functions
│   └── hooks/
│       ├── useOnChainOracle.ts    # Oracle data hook
│       └── useMarketWebSocket.ts  # Real-time prices
├── public/
│   └── assets/                # Static assets
└── tailwind.config.ts
```

## Key Features

### Trading Interface
- Real-time price charts
- Encrypted order placement
- Position management with FHE privacy
- Stop Loss / Take Profit orders

### Wallet Features
- Encrypted balance display
- Confidential transfers
- LP staking (encrypted)
- Faucet for testnet

### FHE Integration
- Client-side encryption via fhevmjs
- User decryption (EIP-712 signatures)
- Zama Gateway integration for async decryption

## Getting Started

### Prerequisites

- Node.js v20+
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
```

## Pages Overview

| Route | Description |
|-------|-------------|
| `/` | Redirects to /markets |
| `/markets` | Asset market overview with prices |
| `/trade` | Main trading interface |
| `/wallet` | Wallet, staking, transfers |
| `/history` | Transaction history |
| `/companies` | Company profiles and details |
| `/docs` | Documentation and guides |
| `/fhe-test` | Zama Gateway integration test |
| `/admin` | Protocol admin dashboard |

## FHE Client Usage

```typescript
import { initFheInstance, encryptPositionParams } from "@/lib/fhe/client";

// Initialize FHE instance
const fhe = await initFheInstance(contractAddress, userAddress);

// Encrypt position parameters
const encrypted = await encryptPositionParams(
  collateral,  // Amount in USD
  leverage,    // 1-10x
  isLong,      // true = long, false = short
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

## Network Support

- **Sepolia Testnet** - Production FHE
- **Hardhat Local** - Mock FHE for development

Network switching is handled automatically via RainbowKit.

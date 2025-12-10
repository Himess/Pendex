# Shadow Protocol - Backend

Express.js backend for real-time price feeds, FHE management, and WebSocket notifications.

## Architecture

```
backend/
├── src/
│   ├── index.ts               # Main entry point
│   ├── api/
│   │   └── fheRoutes.ts       # FHE management API routes
│   ├── fhe/
│   │   ├── DecryptionManager.ts   # Zama Gateway decryption
│   │   └── PositionManager.ts     # Position decryption handling
│   └── websocket/
│       └── FHENotifier.ts     # Real-time FHE event notifications
└── package.json
```

## Features

### FHE Management API

```typescript
// Routes defined in fheRoutes.ts
POST /api/fhe/request-decrypt   // Request async decryption
GET  /api/fhe/decrypt-status    // Check decryption status
POST /api/fhe/public-decrypt    // Public decryption (liquidation)
```

### DecryptionManager

Handles two-step decryption flow:
1. Request decryption from contract (marks ciphertext as decryptable)
2. Poll Zama Gateway for decrypted result
3. Return value to user with ZK proof

### PositionManager

Manages encrypted position data:
- Tracks user positions
- Handles P&L decryption requests
- Coordinates with liquidation bot

### FHENotifier (WebSocket)

Real-time notifications for:
- Decryption completion events
- Position updates
- Liquidation warnings

## Getting Started

### Installation

```bash
cd backend
npm install
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## Environment Variables

```env
PORT=3001
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
PRIVATE_KEY=your_deployer_private_key
SHADOW_VAULT_ADDRESS=0xf6C0B8C7332080790a9425c0B888F74e8e9ff5B5
```

## API Endpoints

### Request Decryption

```bash
POST /api/fhe/request-decrypt
Content-Type: application/json

{
  "ciphertext": "0x...",
  "userAddress": "0x...",
  "contractAddress": "0x..."
}
```

### Check Status

```bash
GET /api/fhe/decrypt-status?requestId=123
```

### WebSocket Events

Connect to `ws://localhost:3001` for:

```typescript
// Events
"decryption:complete" - { requestId, value, proof }
"position:updated"    - { positionId, data }
"liquidation:warning" - { positionId, healthFactor }
```

## Integration with Zama Gateway

The backend acts as a relay between the frontend and Zama's decryption gateway:

```
Frontend → Backend API → Zama Gateway → Backend → Frontend (WebSocket)
```

This async flow is required because FHE decryption is not instant - it requires the decryption gateway to process the request.

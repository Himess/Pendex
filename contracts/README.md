# Shadow Protocol - Smart Contracts

FHE-powered smart contracts for private leveraged trading on pre-IPO assets.

## Contract Architecture

```
contracts/
├── core/
│   ├── ShadowVault.sol          # Main trading vault with FHE positions
│   ├── ShadowLiquidityPool.sol  # LP staking with encrypted balances
│   ├── ShadowOracle.sol         # Price oracle with demand modifier
│   └── ShadowOrderBook.sol      # Privacy-preserving order book
├── tokens/
│   └── ShadowUSD.sol            # Stablecoin (ERC-7984 Confidential Token)
├── bots/
│   └── ShadowMarketMaker.sol    # Automated market maker
├── interfaces/
│   └── IShadowTypes.sol         # Shared types and structs
└── mocks/
    └── MockOracle.sol           # Testing mock
```

## Core Contracts

### ShadowVault.sol

The main trading contract. All position data is FHE-encrypted.

**Encrypted Fields:**
- `euint64 collateral` - Position collateral amount
- `euint64 size` - Position size
- `euint64 entryPrice` - Entry price
- `euint64 leverage` - Leverage used (1-10x)
- `ebool isLong` - Direction (long/short)
- `eaddress encryptedOwner` - For anonymous trading

**Key Functions:**
```solidity
function openPosition(bytes32 assetId, externalEuint64 encCollateral, externalEuint64 encLeverage, externalEbool encIsLong, bytes calldata inputProof) external;
function closePosition(uint256 positionId) external;
function openAnonymousPosition(...) external; // Complete identity hiding
function createLimitOrder(...) external; // Anti-frontrun limit orders
```

### ShadowUSD.sol

ERC-7984 compliant confidential stablecoin.

**Features:**
- Encrypted balances (`euint64`)
- Confidential transfers
- Operator pattern for delegated access
- Faucet for testnet

### ShadowOracle.sol

Price oracle with demand-based price discovery.

**Formula:**
```
Mark Price = Base Price × (1 + Demand Modifier)
Demand Modifier = (Long OI - Short OI) / 10,000
Max Modifier = ±20%
```

### ShadowOrderBook.sol

Privacy-preserving order book.

**What's Public:**
- Price levels
- Relative liquidity (bar visualization)

**What's Encrypted:**
- Exact order amounts
- Order ownership
- Individual order details

## FHE Operations Used

| Category | Functions | Usage |
|----------|-----------|-------|
| Arithmetic | `FHE.add`, `FHE.sub`, `FHE.mul`, `FHE.div` | P&L calculation |
| Comparison | `FHE.gt`, `FHE.lt`, `FHE.ge`, `FHE.le`, `FHE.eq` | Liquidation checks |
| Conditional | `FHE.select` | Branchless encrypted logic |
| Random | `FHE.randEuint64`, `FHE.randEuint8` | Bonus generation |
| ACL | `FHE.allow`, `FHE.allowThis`, `FHE.allowTransient` | Permission management |

## Deployment

### Sepolia (Production FHE)

```bash
npx hardhat deploy --network sepolia
```

### Hardhat (Mock FHE)

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

## Deployed Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| ShadowOracle | `0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17` |
| ShadowMarketMaker | `0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb` |
| ShadowVault | `0xf6C0B8C7332080790a9425c0B888F74e8e9ff5B5` |
| ShadowUSD | `0x9093B02c4Ea2402EC72C2ca9dAAb994F7578fAFb` |

## Testing

```bash
npx hardhat test
```

## Security Considerations

1. All encrypted values must have proper ACL permissions via `FHE.allow()`
2. Never use `if/else` with encrypted values - use `FHE.select()` instead
3. External inputs require `FHE.fromExternal()` with proof validation
4. Liquidation checks use encrypted comparisons for privacy

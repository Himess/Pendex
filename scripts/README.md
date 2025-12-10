# Shadow Protocol - Scripts

Deployment and bot scripts for Shadow Protocol.

## Scripts

```
scripts/
├── deployMarketMaker.ts       # Deploy MarketMaker contract
├── deployMarketMakerSimple.ts # Deploy simplified MarketMaker
├── runBot.ts                  # Full trading bot
├── runBotSimple.ts            # Simplified trading bot
├── runLiquidationBot.ts       # Automated liquidation bot
└── updateScenarioConfig.ts    # Update market scenarios
```

## Trading Bot (runBotSimple.ts)

Automated market maker that creates realistic price action.

### Market Scenarios

| Scenario | Description | Price Range | Trade Size |
|----------|-------------|-------------|------------|
| PUMP | Strong buying pressure | +1-3% | $50-300 |
| DUMP | Strong selling pressure | -1-3% | $50-300 |
| SIDEWAYS | Range-bound | ±0.5% | $20-150 |
| VOLATILE | High volatility | ±2% | $100-500 |
| ACCUMULATION | Smart money buying | +0.5-1.5% | $200-800 |
| DISTRIBUTION | Smart money selling | -0.5-1.5% | $200-800 |

### Running the Bot

```bash
# Set environment variables
export MARKET_MAKER_ADDRESS=0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb
export ORACLE_ADDRESS=0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17

# Run on Sepolia
npx hardhat run scripts/runBotSimple.ts --network sepolia
```

### Bot Output

```
=== Shadow Protocol Trading Bot ===
MarketMaker: 0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb
Oracle: 0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17

[12:34:56] SPACEX: PUMP scenario
  Long OI: $125,000 | Short OI: $98,000
  Base: $350.00 | Mark: $350.94 (+0.27%)
  Trade: $250 LONG
  Tx: 0x1234...5678
```

## Liquidation Bot (runLiquidationBot.ts)

Monitors positions for liquidation opportunities.

### How It Works

1. Scans all open positions
2. Calls `checkFullLiquidation()` for each (FHE comparison)
3. If position is at 100% loss, calls `autoLiquidateAtFullLoss()`
4. Liquidator receives 5% reward

### Revenue Distribution

When a position is liquidated:
- **5%** → Liquidator (reward)
- **47.5%** → LP Pool
- **47.5%** → Protocol Treasury

### Running

```bash
npx hardhat run scripts/runLiquidationBot.ts --network sepolia
```

## Deployment Scripts

### Deploy Market Maker

```bash
npx hardhat run scripts/deployMarketMakerSimple.ts --network sepolia
```

### Update Scenario Config

Modify market behavior:

```bash
npx hardhat run scripts/updateScenarioConfig.ts --network sepolia
```

## Environment Variables

Required for all scripts:

```env
MNEMONIC=your twelve word mnemonic phrase here
INFURA_API_KEY=your_infura_key
```

Set via Hardhat vars:

```bash
npx hardhat vars set MNEMONIC
npx hardhat vars set INFURA_API_KEY
```

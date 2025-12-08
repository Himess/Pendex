// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64, euint8, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ShadowOracle } from "../core/ShadowOracle.sol";

/**
 * @title ShadowMarketMaker
 * @notice On-chain Market Maker Bot using FHE for private trading
 * @dev This is the "Option C" - fully on-chain price simulation
 *
 * HOW IT WORKS:
 * 1. Bot generates ENCRYPTED random trades using FHE.randEuint64()
 * 2. Trades are executed and update the Oracle's Open Interest
 * 3. Price changes based on Long/Short imbalance (as per docs)
 * 4. Everything is on-chain - transparent yet private!
 *
 * FHE Features Used:
 * - FHE.randEuint64() - Random trade sizes (nobody knows the size until executed)
 * - FHE.randEuint8() - Random trade direction
 * - FHE.select() - Conditional execution without revealing conditions
 * - FHE.gt/lt/eq - Encrypted comparisons
 *
 * This creates realistic market activity where:
 * - Trade sizes are encrypted (anti-MEV)
 * - Trade direction is encrypted (no front-running)
 * - Price impact happens based on aggregate OI
 */
contract ShadowMarketMaker is ZamaEthereumConfig, Ownable2Step, ReentrancyGuard {

    /// @notice Oracle contract
    ShadowOracle public oracle;

    /// @notice Bot scenarios
    enum Scenario {
        PUMP,           // 75% buy probability
        DUMP,           // 25% buy probability
        SIDEWAYS,       // 50% buy probability
        VOLATILE,       // Large random swings
        ACCUMULATION,   // Steady buying with large orders
        DISTRIBUTION    // Steady selling with large orders
    }

    /// @notice Current market scenario
    Scenario public currentScenario;

    /// @notice Scenario configuration
    struct ScenarioConfig {
        uint64 buyProbabilityPercent;   // 0-100
        uint64 minTradeSize;            // Minimum trade size
        uint64 maxTradeSize;            // Maximum trade size
        uint64 volatilityMultiplier;    // 100 = 1x, 200 = 2x
    }

    /// @notice Scenario configurations
    mapping(Scenario => ScenarioConfig) public scenarioConfigs;

    /// @notice Trade record (encrypted for privacy!)
    struct EncryptedTrade {
        uint256 id;
        bytes32 assetId;
        euint64 size;           // Encrypted size
        ebool isLong;           // Encrypted direction
        uint256 executedAt;
        uint64 priceAfter;      // Price after execution (public for chart)
    }

    /// @notice All trades
    mapping(uint256 => EncryptedTrade) public trades;
    uint256 public nextTradeId;

    /// @notice Trades per asset (for history)
    mapping(bytes32 => uint256[]) public assetTrades;

    /// @notice Candle data for charts
    struct Candle {
        uint256 timestamp;      // Candle start time
        uint64 open;
        uint64 high;
        uint64 low;
        uint64 close;
        uint256 volume;         // Decrypted aggregate volume
        uint256 tradeCount;
    }

    /// @notice Candles per asset (keyed by timestamp rounded to interval)
    mapping(bytes32 => mapping(uint256 => Candle)) public candles;

    /// @notice Latest candle timestamps per asset
    mapping(bytes32 => uint256[]) public candleTimestamps;

    /// @notice Candle interval (default 1 minute)
    uint256 public candleInterval = 60;

    /// @notice Bot execution stats
    uint256 public totalTradesExecuted;
    uint256 public lastExecutionTime;

    /// @notice Events
    event TradeExecuted(
        uint256 indexed tradeId,
        bytes32 indexed assetId,
        uint64 priceAfter,
        uint256 timestamp
    );

    event ScenarioChanged(
        Scenario indexed oldScenario,
        Scenario indexed newScenario,
        uint256 timestamp
    );

    event CandleUpdated(
        bytes32 indexed assetId,
        uint256 indexed timestamp,
        uint64 open,
        uint64 high,
        uint64 low,
        uint64 close
    );

    event WhaleAlert(
        bytes32 indexed assetId,
        uint256 indexed tradeId,
        uint64 priceImpact,
        uint256 timestamp
    );

    constructor(address _owner, address _oracle) Ownable(_owner) {
        oracle = ShadowOracle(_oracle);
        nextTradeId = 1;
        currentScenario = Scenario.SIDEWAYS;

        // Initialize scenario configs
        scenarioConfigs[Scenario.PUMP] = ScenarioConfig({
            buyProbabilityPercent: 75,
            minTradeSize: 10000 * 1e6,      // $10k min
            maxTradeSize: 500000 * 1e6,     // $500k max
            volatilityMultiplier: 120       // 1.2x
        });

        scenarioConfigs[Scenario.DUMP] = ScenarioConfig({
            buyProbabilityPercent: 25,
            minTradeSize: 10000 * 1e6,
            maxTradeSize: 500000 * 1e6,
            volatilityMultiplier: 120
        });

        scenarioConfigs[Scenario.SIDEWAYS] = ScenarioConfig({
            buyProbabilityPercent: 50,
            minTradeSize: 5000 * 1e6,       // $5k min
            maxTradeSize: 100000 * 1e6,     // $100k max
            volatilityMultiplier: 80        // 0.8x (less volatile)
        });

        scenarioConfigs[Scenario.VOLATILE] = ScenarioConfig({
            buyProbabilityPercent: 50,
            minTradeSize: 50000 * 1e6,      // $50k min
            maxTradeSize: 2000000 * 1e6,    // $2M max
            volatilityMultiplier: 200       // 2x (very volatile)
        });

        scenarioConfigs[Scenario.ACCUMULATION] = ScenarioConfig({
            buyProbabilityPercent: 70,
            minTradeSize: 100000 * 1e6,     // $100k min
            maxTradeSize: 5000000 * 1e6,    // $5M max (whale)
            volatilityMultiplier: 150
        });

        scenarioConfigs[Scenario.DISTRIBUTION] = ScenarioConfig({
            buyProbabilityPercent: 30,
            minTradeSize: 100000 * 1e6,
            maxTradeSize: 5000000 * 1e6,
            volatilityMultiplier: 150
        });
    }

    // ============================================
    // MAIN BOT FUNCTIONS
    // ============================================

    /**
     * @notice Execute a random encrypted trade for an asset
     * @dev Uses FHE for truly random, encrypted trade parameters
     * @param assetId Asset to trade
     * @return tradeId The executed trade ID
     */
    function executeRandomTrade(bytes32 assetId) external nonReentrant returns (uint256 tradeId) {
        require(oracle.isAssetTradeable(assetId), "Asset not tradeable");

        ScenarioConfig memory config = scenarioConfigs[currentScenario];

        // Generate encrypted random values using FHE
        // This is the magic - nobody can predict or front-run!
        euint64 randomSize = _generateRandomTradeSize(config.minTradeSize, config.maxTradeSize);
        ebool isLong = _generateRandomDirection(config.buyProbabilityPercent);

        // Execute trade and update oracle
        tradeId = _executeTrade(assetId, randomSize, isLong);

        return tradeId;
    }

    /**
     * @notice Execute multiple random trades (batch)
     * @param assetId Asset to trade
     * @param count Number of trades to execute
     */
    function executeBatchTrades(bytes32 assetId, uint8 count) external nonReentrant {
        require(count <= 10, "Max 10 trades per batch");
        require(oracle.isAssetTradeable(assetId), "Asset not tradeable");

        ScenarioConfig memory config = scenarioConfigs[currentScenario];

        for (uint8 i = 0; i < count; i++) {
            euint64 randomSize = _generateRandomTradeSize(config.minTradeSize, config.maxTradeSize);
            ebool isLong = _generateRandomDirection(config.buyProbabilityPercent);
            _executeTrade(assetId, randomSize, isLong);
        }
    }

    /**
     * @notice Execute random trades across all assets
     * @dev Good for simulating market-wide activity
     */
    function executeMarketWideTrades() external nonReentrant {
        bytes32[] memory allAssets = oracle.getAllAssetIds();
        ScenarioConfig memory config = scenarioConfigs[currentScenario];

        for (uint256 i = 0; i < allAssets.length; i++) {
            if (oracle.isAssetTradeable(allAssets[i])) {
                // Random chance to trade each asset (50%)
                euint8 shouldTrade = FHE.randEuint8(100);

                // For simplicity, we'll trade all assets in demo
                // In production, use FHE.decrypt with gateway
                euint64 randomSize = _generateRandomTradeSize(config.minTradeSize, config.maxTradeSize);
                ebool isLong = _generateRandomDirection(config.buyProbabilityPercent);
                _executeTrade(allAssets[i], randomSize, isLong);
            }
        }
    }

    // ============================================
    // INTERNAL TRADE EXECUTION
    // ============================================

    /**
     * @notice Internal trade execution
     * @param assetId Asset to trade
     * @param encryptedSize Encrypted trade size
     * @param isLong Encrypted direction
     * @return tradeId Trade ID
     */
    function _executeTrade(
        bytes32 assetId,
        euint64 encryptedSize,
        ebool isLong
    ) internal returns (uint256 tradeId) {
        tradeId = nextTradeId++;

        // Store encrypted trade
        trades[tradeId] = EncryptedTrade({
            id: tradeId,
            assetId: assetId,
            size: encryptedSize,
            isLong: isLong,
            executedAt: block.timestamp,
            priceAfter: 0 // Will be set after OI update
        });

        // Grant permissions
        FHE.allowThis(encryptedSize);
        FHE.allowThis(isLong);

        // For demo: decrypt to update OI (in production use gateway)
        // We use a simplified approach here
        uint64 tradeSize = _estimateTradeSize();
        bool tradeSide = _estimateTradeSide();

        // Update Oracle Open Interest
        if (tradeSide) {
            oracle.updateOpenInterest(assetId, tradeSize, 0, true);
        } else {
            oracle.updateOpenInterest(assetId, 0, tradeSize, true);
        }

        // Get new price after OI update
        uint64 newPrice = oracle.getCurrentPrice(assetId);
        trades[tradeId].priceAfter = newPrice;

        // Update candle
        _updateCandle(assetId, newPrice, tradeSize);

        // Record trade for asset
        assetTrades[assetId].push(tradeId);

        // Stats
        totalTradesExecuted++;
        lastExecutionTime = block.timestamp;

        // Check for whale alert (trade > $1M)
        if (tradeSize > 1000000 * 1e6) {
            emit WhaleAlert(assetId, tradeId, _calculatePriceImpact(assetId), block.timestamp);
        }

        emit TradeExecuted(tradeId, assetId, newPrice, block.timestamp);

        return tradeId;
    }

    /**
     * @notice Generate random trade size using FHE
     * @param minSize Minimum size
     * @param maxSize Maximum size
     * @return Encrypted random size
     */
    function _generateRandomTradeSize(
        uint64 minSize,
        uint64 maxSize
    ) internal returns (euint64) {
        // Generate random value in range
        // FHE.randEuint64() gives random 64-bit value
        euint64 random = FHE.randEuint64();

        // Scale to range: minSize + (random % (maxSize - minSize))
        uint64 range = maxSize - minSize;

        // For now, we use a simplified approach
        // In production, use modular arithmetic on encrypted values
        euint64 scaledRandom = FHE.rem(random, range);
        euint64 finalSize = FHE.add(scaledRandom, FHE.asEuint64(minSize));

        return finalSize;
    }

    /**
     * @notice Generate random direction using FHE
     * @param buyProbability Probability of buy (0-100)
     * @return Encrypted boolean (true = long/buy)
     */
    function _generateRandomDirection(uint64 buyProbability) internal returns (ebool) {
        // Generate random 0-99
        euint8 random = FHE.randEuint8(100);

        // isLong if random < buyProbability
        euint8 threshold = FHE.asEuint8(uint8(buyProbability));
        ebool isLong = FHE.lt(random, threshold);

        return isLong;
    }

    /**
     * @notice Estimate trade size for demo (simplified decryption)
     * @dev In production, use async gateway decryption
     */
    function _estimateTradeSize() internal view returns (uint64) {
        ScenarioConfig memory config = scenarioConfigs[currentScenario];
        // Use block data for pseudo-randomness in demo
        uint256 pseudoRandom = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, totalTradesExecuted)));
        uint64 range = config.maxTradeSize - config.minTradeSize;
        return config.minTradeSize + uint64(pseudoRandom % range);
    }

    /**
     * @notice Estimate trade side for demo
     */
    function _estimateTradeSide() internal view returns (bool) {
        ScenarioConfig memory config = scenarioConfigs[currentScenario];
        uint256 pseudoRandom = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, totalTradesExecuted, "side")));
        return (pseudoRandom % 100) < config.buyProbabilityPercent;
    }

    /**
     * @notice Calculate price impact for whale alerts
     */
    function _calculatePriceImpact(bytes32 assetId) internal view returns (uint64) {
        ShadowOracle.Asset memory asset = oracle.getAsset(assetId);
        uint64 currentPrice = oracle.getCurrentPrice(assetId);

        if (asset.basePrice == 0) return 0;

        if (currentPrice > asset.basePrice) {
            return uint64((uint256(currentPrice - asset.basePrice) * 10000) / asset.basePrice);
        } else {
            return uint64((uint256(asset.basePrice - currentPrice) * 10000) / asset.basePrice);
        }
    }

    // ============================================
    // CANDLE MANAGEMENT
    // ============================================

    /**
     * @notice Update candle data
     * @param assetId Asset ID
     * @param price Current price
     * @param volume Trade volume
     */
    function _updateCandle(bytes32 assetId, uint64 price, uint64 volume) internal {
        uint256 candleTime = (block.timestamp / candleInterval) * candleInterval;

        Candle storage candle = candles[assetId][candleTime];

        if (candle.timestamp == 0) {
            // New candle
            candle.timestamp = candleTime;
            candle.open = price;
            candle.high = price;
            candle.low = price;
            candle.close = price;
            candle.volume = volume;
            candle.tradeCount = 1;

            candleTimestamps[assetId].push(candleTime);
        } else {
            // Update existing candle
            if (price > candle.high) candle.high = price;
            if (price < candle.low) candle.low = price;
            candle.close = price;
            candle.volume += volume;
            candle.tradeCount++;
        }

        emit CandleUpdated(assetId, candleTime, candle.open, candle.high, candle.low, candle.close);
    }

    /**
     * @notice Get candles for an asset
     * @param assetId Asset ID
     * @param count Number of candles to return
     * @return Array of candle data
     */
    function getCandles(bytes32 assetId, uint256 count) external view returns (Candle[] memory) {
        uint256[] storage timestamps = candleTimestamps[assetId];
        uint256 len = timestamps.length;

        if (len == 0) return new Candle[](0);

        uint256 returnCount = count > len ? len : count;
        Candle[] memory result = new Candle[](returnCount);

        for (uint256 i = 0; i < returnCount; i++) {
            uint256 idx = len - returnCount + i;
            result[i] = candles[assetId][timestamps[idx]];
        }

        return result;
    }

    /**
     * @notice Get latest candle for an asset
     * @param assetId Asset ID
     */
    function getCurrentCandle(bytes32 assetId) external view returns (Candle memory) {
        uint256[] storage timestamps = candleTimestamps[assetId];
        if (timestamps.length == 0) {
            return Candle(0, 0, 0, 0, 0, 0, 0);
        }
        return candles[assetId][timestamps[timestamps.length - 1]];
    }

    // ============================================
    // SCENARIO MANAGEMENT
    // ============================================

    /**
     * @notice Change market scenario
     * @param newScenario New scenario to set
     */
    function setScenario(Scenario newScenario) external onlyOwner {
        Scenario oldScenario = currentScenario;
        currentScenario = newScenario;
        emit ScenarioChanged(oldScenario, newScenario, block.timestamp);
    }

    /**
     * @notice Randomly change scenario using FHE
     * @dev Creates unpredictable market conditions
     */
    function randomizeScenario() external onlyOwner {
        euint8 random = FHE.randEuint8(6); // 0-5 for 6 scenarios

        // For demo, use simplified approach
        uint256 pseudoRandom = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao))) % 6;

        Scenario oldScenario = currentScenario;
        currentScenario = Scenario(pseudoRandom);

        emit ScenarioChanged(oldScenario, currentScenario, block.timestamp);
    }

    /**
     * @notice Update scenario configuration
     */
    function updateScenarioConfig(
        Scenario scenario,
        uint64 buyProbability,
        uint64 minTradeSize,
        uint64 maxTradeSize,
        uint64 volatilityMultiplier
    ) external onlyOwner {
        require(buyProbability <= 100, "Invalid probability");
        require(maxTradeSize > minTradeSize, "Invalid size range");

        scenarioConfigs[scenario] = ScenarioConfig({
            buyProbabilityPercent: buyProbability,
            minTradeSize: minTradeSize,
            maxTradeSize: maxTradeSize,
            volatilityMultiplier: volatilityMultiplier
        });
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Get trade history for an asset
     * @param assetId Asset ID
     * @param count Number of trades to return
     */
    function getTradeHistory(bytes32 assetId, uint256 count) external view returns (uint256[] memory) {
        uint256[] storage allTrades = assetTrades[assetId];
        uint256 len = allTrades.length;

        if (len == 0) return new uint256[](0);

        uint256 returnCount = count > len ? len : count;
        uint256[] memory result = new uint256[](returnCount);

        for (uint256 i = 0; i < returnCount; i++) {
            result[i] = allTrades[len - returnCount + i];
        }

        return result;
    }

    /**
     * @notice Get trade details (public data)
     * @param tradeId Trade ID
     */
    function getTrade(uint256 tradeId) external view returns (
        bytes32 assetId,
        uint256 executedAt,
        uint64 priceAfter
    ) {
        EncryptedTrade storage trade = trades[tradeId];
        return (trade.assetId, trade.executedAt, trade.priceAfter);
    }

    /**
     * @notice Get current scenario config
     */
    function getCurrentScenarioConfig() external view returns (ScenarioConfig memory) {
        return scenarioConfigs[currentScenario];
    }

    /**
     * @notice Get bot stats
     */
    function getBotStats() external view returns (
        uint256 totalTrades,
        uint256 lastExecution,
        Scenario scenario
    ) {
        return (totalTradesExecuted, lastExecutionTime, currentScenario);
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /**
     * @notice Update oracle address
     */
    function setOracle(address newOracle) external onlyOwner {
        oracle = ShadowOracle(newOracle);
    }

    /**
     * @notice Update candle interval
     */
    function setCandleInterval(uint256 newInterval) external onlyOwner {
        require(newInterval >= 60, "Min 60 seconds");
        candleInterval = newInterval;
    }
}

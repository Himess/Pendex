// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ShadowOracle } from "../core/ShadowOracle.sol";

/**
 * @title ShadowMarketMakerSimple
 * @notice Simplified Market Maker Bot for non-FHE networks (Sepolia)
 * @dev Uses pseudo-randomness instead of FHE for demo purposes
 *
 * NOTE: This is the Sepolia-compatible version. For Zama network,
 * use ShadowMarketMaker.sol which uses real FHE encryption.
 */
contract ShadowMarketMakerSimple is Ownable2Step, ReentrancyGuard {

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

    /// @notice Trade record
    struct Trade {
        uint256 id;
        bytes32 assetId;
        uint64 size;
        bool isLong;
        uint256 executedAt;
        uint64 priceAfter;
    }

    /// @notice All trades
    mapping(uint256 => Trade) public trades;
    uint256 public nextTradeId;

    /// @notice Trades per asset
    mapping(bytes32 => uint256[]) public assetTrades;

    /// @notice Candle data
    struct Candle {
        uint256 timestamp;
        uint64 open;
        uint64 high;
        uint64 low;
        uint64 close;
        uint256 volume;
        uint256 tradeCount;
    }

    /// @notice Candles per asset
    mapping(bytes32 => mapping(uint256 => Candle)) public candles;
    mapping(bytes32 => uint256[]) public candleTimestamps;

    /// @notice Candle interval (default 1 minute)
    uint256 public candleInterval = 60;

    /// @notice Bot stats
    uint256 public totalTradesExecuted;
    uint256 public lastExecutionTime;
    uint256 private nonce;

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
            minTradeSize: 10000 * 1e6,
            maxTradeSize: 500000 * 1e6,
            volatilityMultiplier: 120
        });

        scenarioConfigs[Scenario.DUMP] = ScenarioConfig({
            buyProbabilityPercent: 25,
            minTradeSize: 10000 * 1e6,
            maxTradeSize: 500000 * 1e6,
            volatilityMultiplier: 120
        });

        scenarioConfigs[Scenario.SIDEWAYS] = ScenarioConfig({
            buyProbabilityPercent: 50,
            minTradeSize: 5000 * 1e6,
            maxTradeSize: 100000 * 1e6,
            volatilityMultiplier: 80
        });

        scenarioConfigs[Scenario.VOLATILE] = ScenarioConfig({
            buyProbabilityPercent: 50,
            minTradeSize: 50000 * 1e6,
            maxTradeSize: 2000000 * 1e6,
            volatilityMultiplier: 200
        });

        scenarioConfigs[Scenario.ACCUMULATION] = ScenarioConfig({
            buyProbabilityPercent: 70,
            minTradeSize: 100000 * 1e6,
            maxTradeSize: 5000000 * 1e6,
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
     * @notice Execute a random trade for an asset
     * @param assetId Asset to trade
     * @return tradeId The executed trade ID
     */
    function executeRandomTrade(bytes32 assetId) external nonReentrant returns (uint256 tradeId) {
        require(oracle.isAssetTradeable(assetId), "Asset not tradeable");

        ScenarioConfig memory config = scenarioConfigs[currentScenario];

        // Generate pseudo-random values
        uint64 tradeSize = _generateRandomTradeSize(config.minTradeSize, config.maxTradeSize);
        bool isLong = _generateRandomDirection(config.buyProbabilityPercent);

        // Execute trade
        tradeId = _executeTrade(assetId, tradeSize, isLong);

        return tradeId;
    }

    /**
     * @notice Execute multiple random trades (batch)
     */
    function executeBatchTrades(bytes32 assetId, uint8 count) external nonReentrant {
        require(count <= 10, "Max 10 trades per batch");
        require(oracle.isAssetTradeable(assetId), "Asset not tradeable");

        ScenarioConfig memory config = scenarioConfigs[currentScenario];

        for (uint8 i = 0; i < count; i++) {
            uint64 tradeSize = _generateRandomTradeSize(config.minTradeSize, config.maxTradeSize);
            bool isLong = _generateRandomDirection(config.buyProbabilityPercent);
            _executeTrade(assetId, tradeSize, isLong);
        }
    }

    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================

    function _executeTrade(
        bytes32 assetId,
        uint64 tradeSize,
        bool isLong
    ) internal returns (uint256 tradeId) {
        tradeId = nextTradeId++;

        // Update Oracle Open Interest
        if (isLong) {
            oracle.updateOpenInterest(assetId, tradeSize, 0, true);
        } else {
            oracle.updateOpenInterest(assetId, 0, tradeSize, true);
        }

        // Get new price
        uint64 newPrice = oracle.getCurrentPrice(assetId);

        // Store trade
        trades[tradeId] = Trade({
            id: tradeId,
            assetId: assetId,
            size: tradeSize,
            isLong: isLong,
            executedAt: block.timestamp,
            priceAfter: newPrice
        });

        // Update candle
        _updateCandle(assetId, newPrice, tradeSize);

        // Record trade
        assetTrades[assetId].push(tradeId);

        // Stats
        totalTradesExecuted++;
        lastExecutionTime = block.timestamp;

        // Whale alert
        if (tradeSize > 1000000 * 1e6) {
            emit WhaleAlert(assetId, tradeId, _calculatePriceImpact(assetId), block.timestamp);
        }

        emit TradeExecuted(tradeId, assetId, newPrice, block.timestamp);

        return tradeId;
    }

    function _generateRandomTradeSize(uint64 minSize, uint64 maxSize) internal returns (uint64) {
        nonce++;
        uint256 random = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            nonce
        )));
        uint64 range = maxSize - minSize;
        return minSize + uint64(random % range);
    }

    function _generateRandomDirection(uint64 buyProbability) internal returns (bool) {
        nonce++;
        uint256 random = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            nonce,
            "direction"
        )));
        return (random % 100) < buyProbability;
    }

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

    function _updateCandle(bytes32 assetId, uint64 price, uint64 volume) internal {
        uint256 candleTime = (block.timestamp / candleInterval) * candleInterval;

        Candle storage candle = candles[assetId][candleTime];

        if (candle.timestamp == 0) {
            candle.timestamp = candleTime;
            candle.open = price;
            candle.high = price;
            candle.low = price;
            candle.close = price;
            candle.volume = volume;
            candle.tradeCount = 1;

            candleTimestamps[assetId].push(candleTime);
        } else {
            if (price > candle.high) candle.high = price;
            if (price < candle.low) candle.low = price;
            candle.close = price;
            candle.volume += volume;
            candle.tradeCount++;
        }

        emit CandleUpdated(assetId, candleTime, candle.open, candle.high, candle.low, candle.close);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

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

    function getCurrentCandle(bytes32 assetId) external view returns (Candle memory) {
        uint256[] storage timestamps = candleTimestamps[assetId];
        if (timestamps.length == 0) {
            return Candle(0, 0, 0, 0, 0, 0, 0);
        }
        return candles[assetId][timestamps[timestamps.length - 1]];
    }

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

    function getTrade(uint256 tradeId) external view returns (
        bytes32 assetId,
        uint256 executedAt,
        uint64 priceAfter
    ) {
        Trade storage trade = trades[tradeId];
        return (trade.assetId, trade.executedAt, trade.priceAfter);
    }

    function getCurrentScenarioConfig() external view returns (ScenarioConfig memory) {
        return scenarioConfigs[currentScenario];
    }

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

    function setScenario(Scenario newScenario) external onlyOwner {
        Scenario oldScenario = currentScenario;
        currentScenario = newScenario;
        emit ScenarioChanged(oldScenario, newScenario, block.timestamp);
    }

    function setOracle(address newOracle) external onlyOwner {
        oracle = ShadowOracle(newOracle);
    }

    function setCandleInterval(uint256 newInterval) external onlyOwner {
        require(newInterval >= 60, "Min 60 seconds");
        candleInterval = newInterval;
    }

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
}

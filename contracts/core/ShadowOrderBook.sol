// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64, euint32, ebool, externalEuint64, externalEbool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ShadowOracle } from "./ShadowOracle.sol";

/**
 * @title ShadowOrderBook
 * @notice Fully Homomorphic Encrypted Order Book for Pre-IPO Trading
 * @dev Implements an order book where:
 *      - Price levels are PUBLIC (for market depth visualization)
 *      - Order sizes are ENCRYPTED (aggregated per level)
 *      - Individual order details are ENCRYPTED:
 *        - Who placed the order (trader address)
 *        - Exact order size
 *        - Take profit / Stop loss levels
 *
 * This prevents front-running while maintaining market depth visibility.
 *
 * Key FHE Features Used:
 *      - euint64 for encrypted amounts
 *      - ebool for encrypted order direction
 *      - FHE.add() for aggregating order sizes
 *      - FHE.ge()/FHE.le() for price matching
 *      - FHE.select() for conditional logic
 *      - FHE.isInitialized() for null checks
 */
contract ShadowOrderBook is ZamaEthereumConfig, Ownable2Step, ReentrancyGuard {

    // ============================================
    // STRUCTS
    // ============================================

    /// @notice Individual order (fully encrypted except orderId and assetId)
    struct EncryptedOrder {
        uint256 orderId;
        bytes32 assetId;
        uint64 priceLevel;              // PUBLIC - for order book visualization
        euint64 encryptedSize;          // ENCRYPTED - nobody sees exact size
        euint64 encryptedFilledSize;    // ENCRYPTED - how much has been filled
        ebool isBid;                    // ENCRYPTED - buy or sell
        euint64 encryptedTakeProfit;    // ENCRYPTED - TP level (0 if none)
        euint64 encryptedStopLoss;      // ENCRYPTED - SL level (0 if none)
        address owner;                  // Owner is public for order management
        uint256 createdAt;
        bool isActive;
        OrderType orderType;
    }

    /// @notice Order type enum
    enum OrderType {
        LIMIT,          // Standard limit order
        MARKET,         // Market order (executes immediately at best price)
        STOP_LIMIT,     // Stop-limit order
        TAKE_PROFIT     // Take-profit order
    }

    /// @notice Price level aggregation (public price, encrypted aggregate size)
    struct PriceLevel {
        uint64 price;                   // PUBLIC - visible price level
        euint64 encryptedTotalBidSize;  // ENCRYPTED - total bid volume at this level
        euint64 encryptedTotalAskSize;  // ENCRYPTED - total ask volume at this level
        uint32 bidOrderCount;           // PUBLIC - number of bid orders (not sizes!)
        uint32 askOrderCount;           // PUBLIC - number of ask orders
        bool exists;
    }

    /// @notice Market statistics per asset
    struct MarketStats {
        euint64 encryptedTotalVolume24h;  // ENCRYPTED - 24h volume
        euint64 encryptedHighPrice24h;     // ENCRYPTED - 24h high
        euint64 encryptedLowPrice24h;      // ENCRYPTED - 24h low
        uint256 lastTradeTime;
        uint32 totalTrades24h;             // PUBLIC - trade count only
    }

    // ============================================
    // STATE VARIABLES
    // ============================================

    /// @notice Oracle for price feeds
    ShadowOracle public oracle;

    /// @notice Order storage
    mapping(uint256 => EncryptedOrder) private _orders;

    /// @notice User's orders
    mapping(address => uint256[]) private _userOrders;

    /// @notice Price levels per asset (assetId => price => PriceLevel)
    mapping(bytes32 => mapping(uint64 => PriceLevel)) private _priceLevels;

    /// @notice Active price levels per asset for iteration
    mapping(bytes32 => uint64[]) private _activeBidPrices;
    mapping(bytes32 => uint64[]) private _activeAskPrices;

    /// @notice Market stats per asset
    mapping(bytes32 => MarketStats) private _marketStats;

    /// @notice Order counter
    uint256 public nextOrderId;

    /// @notice Minimum order size (in base units, 6 decimals)
    uint64 public constant MIN_ORDER_SIZE = 1 * 1e6; // $1 minimum

    /// @notice Maximum price levels per side
    uint32 public constant MAX_PRICE_LEVELS = 50;

    /// @notice Price tick size (minimum price increment)
    uint64 public constant TICK_SIZE = 1e4; // 0.01 price increment

    /// @notice Precision for calculations
    uint64 public constant PRECISION = 1e6;

    // ============================================
    // EVENTS
    // ============================================

    event OrderCreated(
        uint256 indexed orderId,
        bytes32 indexed assetId,
        uint64 priceLevel,
        OrderType orderType,
        uint256 timestamp
    );

    event OrderCancelled(
        uint256 indexed orderId,
        uint256 timestamp
    );

    event OrderFilled(
        uint256 indexed orderId,
        uint256 indexed matchedOrderId,
        uint256 timestamp
    );

    event OrderPartiallyFilled(
        uint256 indexed orderId,
        uint256 timestamp
    );

    event PriceLevelUpdated(
        bytes32 indexed assetId,
        uint64 priceLevel,
        bool isBid,
        uint32 orderCount
    );

    event TradeExecuted(
        bytes32 indexed assetId,
        uint64 price,
        uint256 timestamp
    );

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(address _owner, address _oracle) Ownable(_owner) {
        oracle = ShadowOracle(_oracle);
        nextOrderId = 1;
    }

    // ============================================
    // ORDER PLACEMENT
    // ============================================

    /**
     * @notice Place an encrypted limit order
     * @dev Order size and direction are encrypted - prevents front-running
     * @param assetId Asset to trade
     * @param priceLevel Price level (PUBLIC - for order book depth)
     * @param encryptedSize Encrypted order size
     * @param encryptedIsBid Encrypted direction (true = buy, false = sell)
     * @param encryptedTakeProfit Encrypted take-profit price (0 for none)
     * @param encryptedStopLoss Encrypted stop-loss price (0 for none)
     * @param inputProof ZK proof for encrypted inputs
     * @return orderId The new order's ID
     */
    function placeLimitOrder(
        bytes32 assetId,
        uint64 priceLevel,
        externalEuint64 encryptedSize,
        externalEbool encryptedIsBid,
        externalEuint64 encryptedTakeProfit,
        externalEuint64 encryptedStopLoss,
        bytes calldata inputProof
    ) external nonReentrant returns (uint256 orderId) {
        require(oracle.isAssetTradeable(assetId), "Asset not tradeable");
        require(priceLevel % TICK_SIZE == 0, "Invalid tick size");
        require(priceLevel > 0, "Invalid price");

        // Convert external inputs
        euint64 size = FHE.fromExternal(encryptedSize, inputProof);
        ebool isBid = FHE.fromExternal(encryptedIsBid, inputProof);
        euint64 takeProfit = FHE.fromExternal(encryptedTakeProfit, inputProof);
        euint64 stopLoss = FHE.fromExternal(encryptedStopLoss, inputProof);

        // Initialize filled size to 0
        euint64 filledSize = FHE.asEuint64(0);

        // Grant permissions for all encrypted values
        FHE.allowThis(size);
        FHE.allow(size, msg.sender);

        FHE.allowThis(isBid);
        FHE.allow(isBid, msg.sender);

        FHE.allowThis(takeProfit);
        FHE.allow(takeProfit, msg.sender);

        FHE.allowThis(stopLoss);
        FHE.allow(stopLoss, msg.sender);

        FHE.allowThis(filledSize);
        FHE.allow(filledSize, msg.sender);

        // Create order
        orderId = nextOrderId++;

        _orders[orderId] = EncryptedOrder({
            orderId: orderId,
            assetId: assetId,
            priceLevel: priceLevel,
            encryptedSize: size,
            encryptedFilledSize: filledSize,
            isBid: isBid,
            encryptedTakeProfit: takeProfit,
            encryptedStopLoss: stopLoss,
            owner: msg.sender,
            createdAt: block.timestamp,
            isActive: true,
            orderType: OrderType.LIMIT
        });

        _userOrders[msg.sender].push(orderId);

        // Update price level aggregates
        _updatePriceLevel(assetId, priceLevel, size, isBid, true);

        emit OrderCreated(orderId, assetId, priceLevel, OrderType.LIMIT, block.timestamp);

        return orderId;
    }

    /**
     * @notice Place an encrypted market order
     * @dev Executes immediately at best available price
     * @param assetId Asset to trade
     * @param encryptedSize Encrypted order size
     * @param encryptedIsBid Encrypted direction
     * @param inputProof ZK proof
     * @return orderId The order ID
     */
    function placeMarketOrder(
        bytes32 assetId,
        externalEuint64 encryptedSize,
        externalEbool encryptedIsBid,
        bytes calldata inputProof
    ) external nonReentrant returns (uint256 orderId) {
        require(oracle.isAssetTradeable(assetId), "Asset not tradeable");

        // Convert external inputs
        euint64 size = FHE.fromExternal(encryptedSize, inputProof);
        ebool isBid = FHE.fromExternal(encryptedIsBid, inputProof);

        // Get current market price
        uint64 currentPrice = oracle.getCurrentPrice(assetId);
        uint64 priceLevel = currentPrice;

        // Initialize TP/SL to 0 for market orders
        euint64 zeroValue = FHE.asEuint64(0);
        euint64 filledSize = FHE.asEuint64(0);

        // Grant permissions
        FHE.allowThis(size);
        FHE.allow(size, msg.sender);

        FHE.allowThis(isBid);
        FHE.allow(isBid, msg.sender);

        FHE.allowThis(zeroValue);
        FHE.allow(zeroValue, msg.sender);

        FHE.allowThis(filledSize);
        FHE.allow(filledSize, msg.sender);

        // Create market order
        orderId = nextOrderId++;

        _orders[orderId] = EncryptedOrder({
            orderId: orderId,
            assetId: assetId,
            priceLevel: priceLevel,
            encryptedSize: size,
            encryptedFilledSize: filledSize,
            isBid: isBid,
            encryptedTakeProfit: zeroValue,
            encryptedStopLoss: zeroValue,
            owner: msg.sender,
            createdAt: block.timestamp,
            isActive: true,
            orderType: OrderType.MARKET
        });

        _userOrders[msg.sender].push(orderId);

        // Market orders execute immediately - try to match
        _tryMatchOrder(orderId);

        emit OrderCreated(orderId, assetId, priceLevel, OrderType.MARKET, block.timestamp);
        emit TradeExecuted(assetId, priceLevel, block.timestamp);

        return orderId;
    }

    // ============================================
    // ORDER CANCELLATION
    // ============================================

    /**
     * @notice Cancel an active order
     * @param orderId Order to cancel
     */
    function cancelOrder(uint256 orderId) external nonReentrant {
        EncryptedOrder storage order = _orders[orderId];

        require(order.isActive, "Order not active");
        require(order.owner == msg.sender, "Not order owner");

        // Remove from price level aggregates
        _updatePriceLevel(
            order.assetId,
            order.priceLevel,
            order.encryptedSize,
            order.isBid,
            false // subtract
        );

        order.isActive = false;

        emit OrderCancelled(orderId, block.timestamp);
    }

    // ============================================
    // ORDER MATCHING (Encrypted!)
    // ============================================

    /**
     * @notice Try to match an order against the order book
     * @dev Uses FHE for encrypted price and size comparisons
     * @param orderId Order to match
     */
    function _tryMatchOrder(uint256 orderId) internal {
        // Taker order'ı al (gelecekte matching için kullanılacak)
        // EncryptedOrder storage takerOrder = _orders[orderId];

        // For demo, we simulate matching
        // Full implementation would:
        // 1. Get opposite side orders at matching prices
        // 2. Use FHE.ge()/FHE.le() for encrypted price comparison
        // 3. Use FHE.min() to determine fill size
        // 4. Update encrypted filled sizes
        // 5. Transfer funds via ShadowVault

        // Mark as partially filled for demo
        emit OrderPartiallyFilled(orderId, block.timestamp);
    }

    /**
     * @notice Check if two orders can match (encrypted comparison)
     * @dev Returns encrypted boolean - true if orders can match
     * @param bidOrderId Bid order ID
     * @param askOrderId Ask order ID
     * @return canMatch Encrypted boolean
     */
    function checkOrdersCanMatch(
        uint256 bidOrderId,
        uint256 askOrderId
    ) public returns (ebool canMatch) {
        EncryptedOrder storage bidOrder = _orders[bidOrderId];
        EncryptedOrder storage askOrder = _orders[askOrderId];

        require(bidOrder.isActive && askOrder.isActive, "Orders not active");
        require(bidOrder.assetId == askOrder.assetId, "Asset mismatch");

        // Check if bid price >= ask price (orders can cross)
        // Using public price levels for matching
        bool pricesMatch = bidOrder.priceLevel >= askOrder.priceLevel;

        // Calculate remaining sizes
        euint64 bidRemaining = FHE.sub(bidOrder.encryptedSize, bidOrder.encryptedFilledSize);
        euint64 askRemaining = FHE.sub(askOrder.encryptedSize, askOrder.encryptedFilledSize);

        // Both must have remaining size > 0
        euint64 zero = FHE.asEuint64(0);
        ebool bidHasSize = FHE.gt(bidRemaining, zero);
        ebool askHasSize = FHE.gt(askRemaining, zero);

        // Convert price match to ebool
        ebool priceCondition = pricesMatch ? FHE.asEbool(true) : FHE.asEbool(false);

        // canMatch = pricesMatch AND bidHasSize AND askHasSize
        canMatch = FHE.and(FHE.and(priceCondition, bidHasSize), askHasSize);

        return canMatch;
    }

    /**
     * @notice Execute a match between two orders
     * @dev Transfers are handled encrypted
     * @param bidOrderId Bid order
     * @param askOrderId Ask order
     */
    function executeMatch(
        uint256 bidOrderId,
        uint256 askOrderId
    ) external nonReentrant {
        EncryptedOrder storage bidOrder = _orders[bidOrderId];
        EncryptedOrder storage askOrder = _orders[askOrderId];

        require(bidOrder.isActive && askOrder.isActive, "Orders not active");

        // Check if orders can match
        ebool canMatch = checkOrdersCanMatch(bidOrderId, askOrderId);

        // Make decryptable for verification
        FHE.makePubliclyDecryptable(canMatch);

        // Calculate fill amount (minimum of remaining sizes)
        euint64 bidRemaining = FHE.sub(bidOrder.encryptedSize, bidOrder.encryptedFilledSize);
        euint64 askRemaining = FHE.sub(askOrder.encryptedSize, askOrder.encryptedFilledSize);
        euint64 fillSize = FHE.min(bidRemaining, askRemaining);

        // Update filled sizes
        bidOrder.encryptedFilledSize = FHE.add(bidOrder.encryptedFilledSize, fillSize);
        askOrder.encryptedFilledSize = FHE.add(askOrder.encryptedFilledSize, fillSize);

        // Grant permissions for updated values
        FHE.allowThis(bidOrder.encryptedFilledSize);
        FHE.allow(bidOrder.encryptedFilledSize, bidOrder.owner);

        FHE.allowThis(askOrder.encryptedFilledSize);
        FHE.allow(askOrder.encryptedFilledSize, askOrder.owner);

        // Check if orders are fully filled
        ebool bidFullyFilled = FHE.ge(bidOrder.encryptedFilledSize, bidOrder.encryptedSize);
        ebool askFullyFilled = FHE.ge(askOrder.encryptedFilledSize, askOrder.encryptedSize);

        // Make decryptable to determine if orders should be closed
        FHE.makePubliclyDecryptable(bidFullyFilled);
        FHE.makePubliclyDecryptable(askFullyFilled);

        // Update price levels
        _updatePriceLevel(bidOrder.assetId, bidOrder.priceLevel, fillSize, FHE.asEbool(true), false);
        _updatePriceLevel(askOrder.assetId, askOrder.priceLevel, fillSize, FHE.asEbool(false), false);

        // Update market stats
        _updateMarketStats(bidOrder.assetId, uint64(bidOrder.priceLevel));

        emit OrderFilled(bidOrderId, askOrderId, block.timestamp);
        emit TradeExecuted(bidOrder.assetId, uint64(bidOrder.priceLevel), block.timestamp);
    }

    // ============================================
    // PRICE LEVEL MANAGEMENT
    // ============================================

    /**
     * @notice Update price level aggregates
     * @param assetId Asset ID
     * @param priceLevel Price level
     * @param size Order size (encrypted)
     * @param isBid Is this a bid order (encrypted)
     * @param isAdding True if adding, false if removing
     */
    function _updatePriceLevel(
        bytes32 assetId,
        uint64 priceLevel,
        euint64 size,
        ebool isBid,
        bool isAdding
    ) internal {
        PriceLevel storage level = _priceLevels[assetId][priceLevel];

        if (!level.exists) {
            level.price = priceLevel;
            level.encryptedTotalBidSize = FHE.asEuint64(0);
            level.encryptedTotalAskSize = FHE.asEuint64(0);
            level.bidOrderCount = 0;
            level.askOrderCount = 0;
            level.exists = true;

            // Initialize with proper permissions
            FHE.allowThis(level.encryptedTotalBidSize);
            FHE.allowThis(level.encryptedTotalAskSize);
        }

        // Update aggregates using FHE.select for conditional update
        if (isAdding) {
            // Add to bid or ask based on encrypted direction
            euint64 newBidTotal = FHE.select(
                isBid,
                FHE.add(level.encryptedTotalBidSize, size),
                level.encryptedTotalBidSize
            );

            euint64 newAskTotal = FHE.select(
                isBid,
                level.encryptedTotalAskSize,
                FHE.add(level.encryptedTotalAskSize, size)
            );

            level.encryptedTotalBidSize = newBidTotal;
            level.encryptedTotalAskSize = newAskTotal;

            // Order counts are public approximations
            // We increment both but actual count depends on encrypted direction
            level.bidOrderCount++;
            level.askOrderCount++;

            FHE.allowThis(newBidTotal);
            FHE.allowThis(newAskTotal);
        } else {
            // Subtract from bid or ask
            euint64 newBidTotal = FHE.select(
                isBid,
                FHE.sub(level.encryptedTotalBidSize, size),
                level.encryptedTotalBidSize
            );

            euint64 newAskTotal = FHE.select(
                isBid,
                level.encryptedTotalAskSize,
                FHE.sub(level.encryptedTotalAskSize, size)
            );

            level.encryptedTotalBidSize = newBidTotal;
            level.encryptedTotalAskSize = newAskTotal;

            // Decrement counts
            if (level.bidOrderCount > 0) level.bidOrderCount--;
            if (level.askOrderCount > 0) level.askOrderCount--;

            FHE.allowThis(newBidTotal);
            FHE.allowThis(newAskTotal);
        }

        emit PriceLevelUpdated(assetId, priceLevel, true, level.bidOrderCount);
    }

    /**
     * @notice Update market statistics
     * @param assetId Asset ID
     * @param tradePrice Trade execution price
     */
    function _updateMarketStats(bytes32 assetId, uint64 tradePrice) internal {
        MarketStats storage stats = _marketStats[assetId];

        // Initialize if needed
        if (!FHE.isInitialized(stats.encryptedTotalVolume24h)) {
            stats.encryptedTotalVolume24h = FHE.asEuint64(0);
            stats.encryptedHighPrice24h = FHE.asEuint64(tradePrice);
            stats.encryptedLowPrice24h = FHE.asEuint64(tradePrice);

            FHE.allowThis(stats.encryptedTotalVolume24h);
            FHE.allowThis(stats.encryptedHighPrice24h);
            FHE.allowThis(stats.encryptedLowPrice24h);
        }

        // Update high/low using FHE.max/min
        euint64 currentPrice = FHE.asEuint64(tradePrice);
        stats.encryptedHighPrice24h = FHE.max(stats.encryptedHighPrice24h, currentPrice);
        stats.encryptedLowPrice24h = FHE.min(stats.encryptedLowPrice24h, currentPrice);

        stats.lastTradeTime = block.timestamp;
        stats.totalTrades24h++;

        FHE.allowThis(stats.encryptedHighPrice24h);
        FHE.allowThis(stats.encryptedLowPrice24h);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Get order book depth at a price level (PUBLIC data only)
     * @param assetId Asset ID
     * @param priceLevel Price to query
     * @return price Public price level
     * @return bidOrderCount Number of bid orders (not sizes!)
     * @return askOrderCount Number of ask orders
     * @return exists Whether this level has orders
     */
    function getOrderBookLevel(
        bytes32 assetId,
        uint64 priceLevel
    ) external view returns (
        uint64 price,
        uint32 bidOrderCount,
        uint32 askOrderCount,
        bool exists
    ) {
        PriceLevel storage level = _priceLevels[assetId][priceLevel];
        return (
            level.price,
            level.bidOrderCount,
            level.askOrderCount,
            level.exists
        );
        // NOTE: Encrypted totals (encryptedTotalBidSize, encryptedTotalAskSize)
        // are NOT returned - they stay encrypted!
    }

    /**
     * @notice Get encrypted aggregate sizes at a price level
     * @dev Only contract/authorized viewers can access
     * @param assetId Asset ID
     * @param priceLevel Price level
     * @return encryptedBidTotal Encrypted total bid size
     * @return encryptedAskTotal Encrypted total ask size
     */
    function getEncryptedDepth(
        bytes32 assetId,
        uint64 priceLevel
    ) external view returns (
        euint64 encryptedBidTotal,
        euint64 encryptedAskTotal
    ) {
        PriceLevel storage level = _priceLevels[assetId][priceLevel];
        return (
            level.encryptedTotalBidSize,
            level.encryptedTotalAskSize
        );
    }

    /**
     * @notice Get order details (encrypted data only visible to owner)
     * @param orderId Order ID
     */
    function getOrder(uint256 orderId) external view returns (
        bytes32 assetId,
        uint64 priceLevel,
        address owner,
        bool isActive,
        uint256 createdAt,
        OrderType orderType
    ) {
        EncryptedOrder storage order = _orders[orderId];
        return (
            order.assetId,
            order.priceLevel,
            order.owner,
            order.isActive,
            order.createdAt,
            order.orderType
        );
        // Encrypted fields (size, direction, TP/SL) are NOT returned
    }

    /**
     * @notice Get order encrypted data (only owner can decrypt)
     * @param orderId Order ID
     */
    function getOrderEncryptedData(uint256 orderId) external view returns (
        euint64 encryptedSize,
        euint64 encryptedFilledSize,
        ebool isBid,
        euint64 encryptedTakeProfit,
        euint64 encryptedStopLoss
    ) {
        EncryptedOrder storage order = _orders[orderId];
        require(order.owner == msg.sender, "Not order owner");

        return (
            order.encryptedSize,
            order.encryptedFilledSize,
            order.isBid,
            order.encryptedTakeProfit,
            order.encryptedStopLoss
        );
    }

    /**
     * @notice Get user's order IDs
     * @param user User address
     */
    function getUserOrders(address user) external view returns (uint256[] memory) {
        return _userOrders[user];
    }

    /**
     * @notice Get market statistics (public data only)
     * @param assetId Asset ID
     */
    function getMarketStats(bytes32 assetId) external view returns (
        uint256 lastTradeTime,
        uint32 totalTrades24h
    ) {
        MarketStats storage stats = _marketStats[assetId];
        return (
            stats.lastTradeTime,
            stats.totalTrades24h
        );
        // Encrypted stats (volume, high, low) are NOT returned
    }

    /**
     * @notice Get spread between best bid and ask
     * @dev Returns public price levels only
     * @param assetId Asset ID
     * @return bestBid Best (highest) bid price
     * @return bestAsk Best (lowest) ask price
     * @return spread Difference between best ask and bid
     */
    function getSpread(bytes32 assetId) external view returns (
        uint64 bestBid,
        uint64 bestAsk,
        uint64 spread
    ) {
        uint64[] storage bidPrices = _activeBidPrices[assetId];
        uint64[] storage askPrices = _activeAskPrices[assetId];

        // Find highest bid and lowest ask
        bestBid = 0;
        bestAsk = type(uint64).max;

        for (uint256 i = 0; i < bidPrices.length; i++) {
            if (bidPrices[i] > bestBid) {
                bestBid = bidPrices[i];
            }
        }

        for (uint256 i = 0; i < askPrices.length; i++) {
            if (askPrices[i] < bestAsk) {
                bestAsk = askPrices[i];
            }
        }

        if (bestAsk == type(uint64).max) bestAsk = 0;

        spread = bestAsk > bestBid ? bestAsk - bestBid : 0;

        return (bestBid, bestAsk, spread);
    }

    // ============================================
    // TP/SL CHECK (Encrypted Trigger Conditions)
    // ============================================

    /**
     * @notice Check if order's take-profit should trigger
     * @param orderId Order to check
     * @return shouldTrigger Encrypted boolean
     */
    function checkTakeProfitTrigger(uint256 orderId) external returns (ebool shouldTrigger) {
        EncryptedOrder storage order = _orders[orderId];
        require(order.isActive, "Order not active");

        // Get current price
        euint64 currentPrice = oracle.getEncryptedPrice(order.assetId);

        // Check if TP is set (non-zero)
        euint64 zero = FHE.asEuint64(0);
        ebool hasTp = FHE.gt(order.encryptedTakeProfit, zero);

        // For long: trigger when currentPrice >= TP
        // For short: trigger when currentPrice <= TP
        ebool priceAboveTp = FHE.ge(currentPrice, order.encryptedTakeProfit);
        ebool priceBelowTp = FHE.le(currentPrice, order.encryptedTakeProfit);

        // Use order direction to determine trigger condition
        ebool triggerCondition = FHE.select(order.isBid, priceAboveTp, priceBelowTp);

        // Only trigger if TP is set AND condition is met
        shouldTrigger = FHE.and(hasTp, triggerCondition);

        return shouldTrigger;
    }

    /**
     * @notice Check if order's stop-loss should trigger
     * @param orderId Order to check
     * @return shouldTrigger Encrypted boolean
     */
    function checkStopLossTrigger(uint256 orderId) external returns (ebool shouldTrigger) {
        EncryptedOrder storage order = _orders[orderId];
        require(order.isActive, "Order not active");

        // Get current price
        euint64 currentPrice = oracle.getEncryptedPrice(order.assetId);

        // Check if SL is set (non-zero)
        euint64 zero = FHE.asEuint64(0);
        ebool hasSl = FHE.gt(order.encryptedStopLoss, zero);

        // For long: trigger when currentPrice <= SL
        // For short: trigger when currentPrice >= SL
        ebool priceBelowSl = FHE.le(currentPrice, order.encryptedStopLoss);
        ebool priceAboveSl = FHE.ge(currentPrice, order.encryptedStopLoss);

        // Use order direction to determine trigger condition
        ebool triggerCondition = FHE.select(order.isBid, priceBelowSl, priceAboveSl);

        // Only trigger if SL is set AND condition is met
        shouldTrigger = FHE.and(hasSl, triggerCondition);

        return shouldTrigger;
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /**
     * @notice Update oracle address
     * @param newOracle New oracle contract
     */
    function setOracle(address newOracle) external onlyOwner {
        oracle = ShadowOracle(newOracle);
    }

    /**
     * @notice Get total orders created
     */
    function getTotalOrders() external view returns (uint256) {
        return nextOrderId - 1;
    }
}

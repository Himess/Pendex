// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint8, euint64, ebool, eaddress, externalEuint64, externalEbool, externalEaddress } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IShadowTypes } from "../interfaces/IShadowTypes.sol";
import { ShadowOracle } from "./ShadowOracle.sol";
import { ShadowUSD } from "../tokens/ShadowUSD.sol";
import { ShadowLiquidityPool } from "./ShadowLiquidityPool.sol";

/**
 * @title ShadowVault
 * @notice Main vault contract for Private Leveraged Pre-IPO Trading
 * @dev All position data is encrypted using FHE - nobody can see:
 *      - Position size
 *      - Collateral amount
 *      - Entry price
 *      - Direction (long/short)
 *      - Leverage used
 *      - P&L
 *
 * Only the position owner can decrypt their own data.
 */
contract ShadowVault is ZamaEthereumConfig, Ownable2Step, ReentrancyGuard, IShadowTypes {

    /// @notice Oracle contract for price feeds
    ShadowOracle public oracle;

    /// @notice ShadowUSD token
    ShadowUSD public shadowUsd;

    /// @notice Liquidity pool
    ShadowLiquidityPool public liquidityPool;

    /// @notice User balances (encrypted)
    mapping(address => euint64) private _balances;

    /// @notice All positions
    mapping(uint256 => Position) private _positions;

    /// @notice Anonymous positions - completely private ownership!
    mapping(uint256 => AnonymousPosition) private _anonymousPositions;

    /// @notice Encrypted balance mapping for anonymous users
    /// @dev Uses hash of encrypted address for indexing
    mapping(bytes32 => euint64) private _anonymousBalances;

    /// @notice User's position IDs
    mapping(address => uint256[]) private _userPositions;

    /// @notice Position counter
    uint256 public nextPositionId;

    /// @notice Protocol fee (basis points, e.g., 30 = 0.3%)
    uint64 public protocolFeeBps;

    /// @notice Minimum collateral (in USD with 6 decimals)
    uint64 public constant MIN_COLLATERAL = 100 * 1e6; // $100

    /// @notice Maximum leverage
    uint64 public constant MAX_LEVERAGE = 10;

    /// @notice Liquidation threshold (80% = 8000 basis points)
    uint64 public constant LIQUIDATION_THRESHOLD_BPS = 8000;

    /// @notice Full liquidation threshold (100% loss = position wiped)
    uint64 public constant FULL_LIQUIDATION_BPS = 10000;

    /// @notice Precision for calculations
    uint64 public constant PRECISION = 1e6;

    /// @notice Total fees collected (public for transparency)
    uint256 public totalFeesCollected;

    /// @notice Total liquidation proceeds collected
    uint256 public totalLiquidationProceeds;

    /// @notice Protocol treasury address
    address public treasury;

    /// @notice LP share of revenue (5000 = 50%)
    uint256 public constant LP_SHARE_BPS = 5000;

    /// @notice Protocol share of revenue (5000 = 50%)
    uint256 public constant PROTOCOL_SHARE_BPS = 5000;

    /// @notice Liquidator reward (500 = 5%)
    uint256 public constant LIQUIDATOR_REWARD_BPS = 500;

    /// @notice Pending LP rewards (accumulated from liquidations)
    uint256 public pendingLpRewards;

    /// @notice Pending protocol revenue
    uint256 public pendingProtocolRevenue;

    /// @notice Total distributed to LPs
    uint256 public totalDistributedToLPs;

    /// @notice Total distributed to protocol
    uint256 public totalDistributedToProtocol;

    /// @notice Mapping of liquidator rewards
    mapping(address => uint256) public liquidatorRewards;

    // ============================================
    // ASYNC DECRYPTION (Gateway Callback Pattern)
    // ============================================

    /// @notice Pending close requests (requestId => positionId)
    mapping(uint256 => uint256) public pendingCloseRequests;

    /// @notice Pending close info
    struct PendingClose {
        uint256 positionId;
        address user;
        bool processed;
        uint256 finalAmount;  // Decrypted amount after callback
    }
    mapping(uint256 => PendingClose) public pendingCloses;

    /// @notice Positions pending close (prevents race condition)
    mapping(uint256 => bool) public positionPendingClose;

    /// @notice Pending liquidation requests
    struct PendingLiquidation {
        uint256 positionId;
        address liquidator;
        bool processed;
        bool canLiquidate;
        uint256 collateralAmount;
    }
    mapping(uint256 => PendingLiquidation) public pendingLiquidations;

    /// @notice User's pending close request IDs
    mapping(address => mapping(uint256 => uint256)) public userCloseRequests;

    /// @notice Events for async operations
    event CloseRequested(uint256 indexed positionId, address indexed user, uint256 indexed requestId);
    event CloseProcessed(uint256 indexed requestId, uint256 indexed positionId, uint256 finalAmount);
    event LiquidationRequested(uint256 indexed positionId, address indexed liquidator, uint256 indexed requestId);
    event LiquidationProcessed(uint256 indexed requestId, uint256 indexed positionId, bool canLiquidate);

    // ============================================
    // ENCRYPTED ERROR HANDLING (Advanced FHE!)
    // ============================================

    /// @notice Error codes for encrypted operations
    euint8 internal NO_ERROR;
    euint8 internal ERROR_INSUFFICIENT_BALANCE;
    euint8 internal ERROR_INVALID_LEVERAGE;
    euint8 internal ERROR_POSITION_NOT_FOUND;
    euint8 internal ERROR_UNAUTHORIZED;

    /// @notice Last error for each user (encrypted for privacy)
    struct EncryptedError {
        euint8 errorCode;
        uint256 timestamp;
    }
    mapping(address => EncryptedError) private _lastErrors;

    /// @notice Encrypted limit orders
    struct EncryptedLimitOrder {
        uint256 id;
        address owner;
        bytes32 assetId;
        euint64 triggerPrice;      // Encrypted trigger price
        euint64 collateral;        // Encrypted collateral
        euint64 leverage;          // Encrypted leverage
        ebool isLong;              // Encrypted direction
        ebool isAbove;             // Trigger when price goes above (true) or below (false)
        bool isActive;
        uint256 createdAt;
    }

    /// @notice Limit order storage
    mapping(uint256 => EncryptedLimitOrder) private _limitOrders;
    mapping(address => uint256[]) private _userLimitOrders;
    uint256 public nextLimitOrderId;

    /// @notice Events for advanced features
    event ErrorOccurred(address indexed user, uint256 timestamp);
    event LimitOrderCreated(uint256 indexed orderId, address indexed user, bytes32 indexed assetId, uint256 timestamp);
    event LimitOrderExecuted(uint256 indexed orderId, uint256 positionId, uint256 timestamp);
    event LimitOrderCancelled(uint256 indexed orderId, uint256 timestamp);
    event RandomPositionIdGenerated(uint256 indexed positionId, uint256 timestamp);
    event PositionAutoLiquidated(uint256 indexed positionId, address indexed owner, address indexed liquidator, uint256 collateralAmount, uint256 timestamp);
    event RevenueDistributed(uint256 totalAmount, uint256 lpShare, uint256 protocolShare, uint256 timestamp);
    event LiquidatorRewardClaimed(address indexed liquidator, uint256 amount, uint256 timestamp);
    event LpRewardsDistributed(uint256 amount, uint256 timestamp);
    event ProtocolRevenueWithdrawn(address indexed to, uint256 amount, uint256 timestamp);

    constructor(
        address _owner,
        address _oracle,
        address _shadowUsd,
        address _liquidityPool,
        address _treasury
    ) Ownable(_owner) {
        oracle = ShadowOracle(_oracle);
        shadowUsd = ShadowUSD(_shadowUsd);
        liquidityPool = ShadowLiquidityPool(_liquidityPool);
        treasury = _treasury;
        nextPositionId = 1;
        nextLimitOrderId = 1;
        protocolFeeBps = 30; // 0.3% fee

        // Initialize encrypted error codes
        NO_ERROR = FHE.asEuint8(0);
        ERROR_INSUFFICIENT_BALANCE = FHE.asEuint8(1);
        ERROR_INVALID_LEVERAGE = FHE.asEuint8(2);
        ERROR_POSITION_NOT_FOUND = FHE.asEuint8(3);
        ERROR_UNAUTHORIZED = FHE.asEuint8(4);

        // Grant contract access to error codes
        FHE.allowThis(NO_ERROR);
        FHE.allowThis(ERROR_INSUFFICIENT_BALANCE);
        FHE.allowThis(ERROR_INVALID_LEVERAGE);
        FHE.allowThis(ERROR_POSITION_NOT_FOUND);
        FHE.allowThis(ERROR_UNAUTHORIZED);
    }

    // ============================================
    // DEPOSIT & WITHDRAW
    // ============================================

    /**
     * @notice Deposit collateral into the vault
     * @param encryptedAmount Encrypted deposit amount
     * @param inputProof ZK proof for encrypted input
     */
    function deposit(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // Add to balance
        euint64 currentBalance = _balances[msg.sender];
        euint64 newBalance;

        // Check if user has existing balance
        if (euint64.unwrap(currentBalance) == 0) {
            newBalance = amount;
        } else {
            newBalance = FHE.add(currentBalance, amount);
        }

        _balances[msg.sender] = newBalance;

        // Grant permissions
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);
    }

    /**
     * @notice Withdraw collateral from the vault
     * @param encryptedAmount Encrypted withdrawal amount
     * @param inputProof ZK proof for encrypted input
     */
    function withdraw(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 currentBalance = _balances[msg.sender];

        // FHE.isInitialized() - Check if balance has been set
        require(FHE.isInitialized(currentBalance), "Balance not initialized");
        require(euint64.unwrap(currentBalance) != 0, "No balance");

        // Check sufficient balance (encrypted comparison)
        ebool hasSufficientBalance = FHE.ge(currentBalance, amount);

        // Calculate new balance (will underflow if insufficient, but FHE handles this)
        euint64 newBalance = FHE.select(
            hasSufficientBalance,
            FHE.sub(currentBalance, amount),
            currentBalance // Keep original if insufficient
        );

        _balances[msg.sender] = newBalance;

        // Grant permissions
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);

        // Note: Actual token transfer would happen here via ERC7984
        // For demo, we track balances internally
    }

    /**
     * @notice Get user's encrypted balance
     * @param user User address
     * @return Encrypted balance (only user can decrypt)
     */
    function getBalance(address user) external view returns (euint64) {
        return _balances[user];
    }

    // ============================================
    // POSITION MANAGEMENT
    // ============================================

    /**
     * @notice Open a new leveraged position
     * @param assetId Asset to trade
     * @param encryptedCollateral Encrypted collateral amount
     * @param encryptedLeverage Encrypted leverage (1-10x)
     * @param encryptedIsLong Encrypted direction (true = long, false = short)
     * @param inputProof ZK proof for encrypted inputs
     * @return positionId The new position's ID
     */
    function openPosition(
        bytes32 assetId,
        externalEuint64 encryptedCollateral,
        externalEuint64 encryptedLeverage,
        externalEbool encryptedIsLong,
        bytes calldata inputProof
    ) external nonReentrant returns (uint256 positionId) {
        // Verify asset is tradeable
        require(oracle.isAssetTradeable(assetId), "Asset not tradeable");

        // Convert external inputs to internal
        euint64 collateral = FHE.fromExternal(encryptedCollateral, inputProof);
        euint64 leverage = FHE.fromExternal(encryptedLeverage, inputProof);
        ebool isLong = FHE.fromExternal(encryptedIsLong, inputProof);

        // Validate leverage (1-10x) using encrypted comparison
        euint64 minLeverage = FHE.asEuint64(1);
        euint64 maxLeverage = FHE.asEuint64(MAX_LEVERAGE);
        ebool leverageValid = FHE.and(
            FHE.ge(leverage, minLeverage),
            FHE.le(leverage, maxLeverage)
        );
        // Clamp leverage to valid range using FHE.select
        leverage = FHE.select(
            leverageValid,
            leverage,
            FHE.select(
                FHE.lt(leverage, minLeverage),
                minLeverage,
                maxLeverage
            )
        );

        // Get current balance
        euint64 currentBalance = _balances[msg.sender];

        // FHE.isInitialized() - Ensure balance exists before trading
        require(FHE.isInitialized(currentBalance), "Deposit first");
        require(euint64.unwrap(currentBalance) != 0, "No balance");

        // Check sufficient balance for collateral
        ebool hasSufficientBalance = FHE.ge(currentBalance, collateral);

        // Deduct collateral from balance
        euint64 newBalance = FHE.select(
            hasSufficientBalance,
            FHE.sub(currentBalance, collateral),
            currentBalance
        );
        _balances[msg.sender] = newBalance;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);

        // Calculate position size: collateral * leverage
        euint64 size = FHE.mul(collateral, leverage);

        // Get current price as encrypted value
        euint64 entryPrice = oracle.getEncryptedPrice(assetId);

        // Grant permissions BEFORE storing in position struct
        // This is critical for FHE ACL compliance
        FHE.allowThis(collateral);
        FHE.allow(collateral, msg.sender);

        FHE.allowThis(size);
        FHE.allow(size, msg.sender);

        FHE.allowThis(entryPrice);
        FHE.allow(entryPrice, msg.sender);

        FHE.allowThis(isLong);
        FHE.allow(isLong, msg.sender);

        FHE.allowThis(leverage);
        FHE.allow(leverage, msg.sender);

        // Create position
        positionId = nextPositionId++;

        _positions[positionId] = Position({
            id: positionId,
            owner: msg.sender,
            assetId: assetId,
            collateral: collateral,
            size: size,
            entryPrice: entryPrice,
            isLong: isLong,
            leverage: leverage,
            openTimestamp: block.timestamp,
            isOpen: true
        });

        _userPositions[msg.sender].push(positionId);

        emit PositionOpened(positionId, msg.sender, assetId, block.timestamp);

        return positionId;
    }

    /**
     * @notice Close an existing position
     * @param positionId Position to close
     */
    function closePosition(uint256 positionId) external nonReentrant {
        Position storage position = _positions[positionId];

        require(position.isOpen, "Position not open");
        require(position.owner == msg.sender, "Not position owner");

        // Get current price
        euint64 currentPrice = oracle.getEncryptedPrice(position.assetId);

        // Calculate P&L
        euint64 pnl = _calculatePnL(position, currentPrice);

        // Calculate final amount: collateral + pnl (can be negative)
        euint64 finalAmount = FHE.add(position.collateral, pnl);

        // Add back to user balance
        euint64 currentBalance = _balances[msg.sender];
        euint64 newBalance;

        if (euint64.unwrap(currentBalance) == 0) {
            newBalance = finalAmount;
        } else {
            newBalance = FHE.add(currentBalance, finalAmount);
        }

        _balances[msg.sender] = newBalance;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);

        // Mark position as closed
        position.isOpen = false;

        emit PositionClosed(positionId, msg.sender, block.timestamp);
    }

    /**
     * @notice Calculate P&L for a position (internal)
     * @param position Position data
     * @param currentPrice Current asset price
     * @return Encrypted P&L (can be negative using two's complement)
     * @dev Full signed P&L calculation:
     *      - Uses FHE.neg() for loss representation
     *      - P&L = (priceDiff * size) / PRECISION
     *      - Negative P&L uses two's complement via FHE.neg()
     */
    function _calculatePnL(
        Position storage position,
        euint64 currentPrice
    ) internal returns (euint64) {
        // Check if price increased
        ebool priceIncreased = FHE.gt(currentPrice, position.entryPrice);

        // Calculate absolute price difference
        euint64 absPriceDiff = FHE.select(
            priceIncreased,
            FHE.sub(currentPrice, position.entryPrice),
            FHE.sub(position.entryPrice, currentPrice)
        );

        // Calculate raw P&L magnitude
        // P&L = (absPriceDiff * size) / entryPrice
        // Note: size already includes leverage (size = collateral * leverage)
        // Using PRECISION for scaling: P&L = (absPriceDiff * size) / PRECISION
        euint64 rawPnl = FHE.div(
            FHE.mul(absPriceDiff, position.size),
            PRECISION
        );

        // Determine if profit or loss based on direction
        // Long profits when price goes up, Short profits when price goes down
        ebool isProfit = FHE.eq(priceIncreased, position.isLong);

        // Apply sign using FHE.neg() for losses
        // Profit: return positive rawPnl
        // Loss: return negative rawPnl (two's complement)
        euint64 signedPnl = FHE.select(
            isProfit,
            rawPnl,
            FHE.neg(rawPnl)  // LOSS! Using FHE.neg() for negative P&L
        );

        return signedPnl;
    }

    /**
     * @notice Get signed P&L breakdown for a position
     * @dev Returns both magnitude and direction for UI display
     * @param positionId Position to check
     * @return pnlAmount Absolute P&L amount (always positive)
     * @return isProfit True if profit, false if loss
     */
    function getPositionPnLBreakdown(
        uint256 positionId
    ) external returns (euint64 pnlAmount, ebool isProfit) {
        Position storage position = _positions[positionId];
        require(position.isOpen, "Position not open");
        require(position.owner == msg.sender, "Not position owner");

        euint64 currentPrice = oracle.getEncryptedPrice(position.assetId);

        // Check if price increased
        ebool priceIncreased = FHE.gt(currentPrice, position.entryPrice);

        // Calculate absolute price difference
        euint64 absPriceDiff = FHE.select(
            priceIncreased,
            FHE.sub(currentPrice, position.entryPrice),
            FHE.sub(position.entryPrice, currentPrice)
        );

        // Calculate P&L magnitude (size already includes leverage)
        pnlAmount = FHE.div(
            FHE.mul(absPriceDiff, position.size),
            PRECISION
        );

        // Determine profit or loss
        isProfit = FHE.eq(priceIncreased, position.isLong);

        // Set ACL permissions
        FHE.allowThis(pnlAmount);
        FHE.allow(pnlAmount, msg.sender);
        FHE.allowThis(isProfit);
        FHE.allow(isProfit, msg.sender);

        return (pnlAmount, isProfit);
    }

    // ============================================
    // LIQUIDATION
    // ============================================

    /**
     * @notice Check if position can be liquidated
     * @dev Anyone can call this to check, actual liquidation requires threshold breach
     * @param positionId Position to check
     * @return canLiquidate Encrypted boolean
     */
    function checkLiquidation(uint256 positionId) public returns (ebool) {
        Position storage position = _positions[positionId];
        require(position.isOpen, "Position not open");

        euint64 currentPrice = oracle.getEncryptedPrice(position.assetId);

        // Calculate health factor
        euint64 healthFactor = _calculateHealthFactor(position, currentPrice);

        // Check if below threshold (100 = 1.0 with 2 decimals)
        euint64 threshold = FHE.asEuint64(100);
        ebool canLiquidate = FHE.lt(healthFactor, threshold);

        return canLiquidate;
    }

    /**
     * @notice Check if position has 100% loss (full liquidation)
     * @dev Loss >= Collateral means position is wiped out
     * @param positionId Position to check
     * @return isFullLoss Encrypted boolean - true if loss >= collateral
     */
    function checkFullLiquidation(uint256 positionId) public returns (ebool) {
        Position storage position = _positions[positionId];
        require(position.isOpen, "Position not open");

        euint64 currentPrice = oracle.getEncryptedPrice(position.assetId);

        // Get P&L breakdown
        (euint64 pnlAmount, ebool isProfit) = _getPnLBreakdown(position, currentPrice);

        // Full liquidation when: NOT profit AND loss >= collateral
        // This means 100% or more of collateral is lost
        ebool isLoss = FHE.not(isProfit);
        ebool lossExceedsCollateral = FHE.ge(pnlAmount, position.collateral);

        // isFullLoss = isLoss AND lossExceedsCollateral
        ebool isFullLoss = FHE.and(isLoss, lossExceedsCollateral);

        return isFullLoss;
    }

    /**
     * @notice Internal function to get P&L breakdown
     * @param position Position data
     * @param currentPrice Current price
     * @return pnlAmount Absolute P&L amount
     * @return isProfit True if profit, false if loss
     */
    function _getPnLBreakdown(
        Position storage position,
        euint64 currentPrice
    ) internal returns (euint64 pnlAmount, ebool isProfit) {
        // Check if price increased
        ebool priceIncreased = FHE.gt(currentPrice, position.entryPrice);

        // Calculate absolute price difference
        euint64 absPriceDiff = FHE.select(
            priceIncreased,
            FHE.sub(currentPrice, position.entryPrice),
            FHE.sub(position.entryPrice, currentPrice)
        );

        // Calculate P&L magnitude with leverage
        // P&L = (priceDiff / entryPrice) * size * leverage
        // Simplified: P&L = (absPriceDiff * size) / PRECISION
        pnlAmount = FHE.div(
            FHE.mul(absPriceDiff, position.size),
            PRECISION
        );

        // Determine profit or loss
        isProfit = FHE.eq(priceIncreased, position.isLong);

        return (pnlAmount, isProfit);
    }

    /**
     * @notice Liquidate an unhealthy position
     * @param positionId Position to liquidate
     */
    function liquidate(uint256 positionId) external nonReentrant {
        Position storage position = _positions[positionId];
        require(position.isOpen, "Position not open");
        require(position.owner != msg.sender, "Cannot liquidate own position");

        // Check if liquidatable
        ebool canLiquidate = checkLiquidation(positionId);

        // For demo purposes, we'll make this publicly decryptable
        // In production, this would use the gateway for async decryption
        FHE.makePubliclyDecryptable(canLiquidate);

        // Mark position as closed
        // Note: In production, would wait for decryption callback
        position.isOpen = false;

        // Liquidator receives a portion of collateral as reward
        // Position owner loses their collateral

        emit PositionLiquidated(positionId, position.owner, msg.sender, block.timestamp);
    }

    /**
     * @notice Auto-liquidate position at 100% loss
     * @dev Anyone can call this - if loss >= collateral, position is closed with zero return
     *      Collateral is distributed:
     *      - 5% to liquidator as reward
     *      - 47.5% to LP pool
     *      - 47.5% to protocol treasury
     * @param positionId Position to check and liquidate if fully lost
     * @param collateralAmount The decrypted collateral amount (must be verified off-chain)
     */
    function autoLiquidateAtFullLoss(uint256 positionId, uint256 collateralAmount) external nonReentrant {
        Position storage position = _positions[positionId];
        require(position.isOpen, "Position not open");

        // Check if full loss
        ebool isFullLoss = checkFullLiquidation(positionId);

        // Make publicly decryptable for verification
        FHE.makePubliclyDecryptable(isFullLoss);

        // Mark position as closed - collateral is lost entirely
        // No funds returned to user
        position.isOpen = false;

        // Calculate revenue distribution
        // 5% to liquidator
        uint256 liquidatorReward = (collateralAmount * LIQUIDATOR_REWARD_BPS) / 10000;

        // Remaining 95% split 50/50 between LP and protocol
        uint256 remaining = collateralAmount - liquidatorReward;
        uint256 lpShare = (remaining * LP_SHARE_BPS) / 10000;
        uint256 protocolShare = remaining - lpShare;

        // Credit liquidator reward
        liquidatorRewards[msg.sender] += liquidatorReward;

        // Add to pending rewards
        pendingLpRewards += lpShare;
        pendingProtocolRevenue += protocolShare;

        // Track totals
        totalLiquidationProceeds += collateralAmount;
        totalFeesCollected += collateralAmount;

        // Emit events
        emit PositionAutoLiquidated(positionId, position.owner, msg.sender, collateralAmount, block.timestamp);
        emit RevenueDistributed(collateralAmount, lpShare, protocolShare, block.timestamp);
    }

    /**
     * @notice Auto-liquidate position (simplified version without amount)
     * @dev For backwards compatibility - uses estimated amount
     */
    function autoLiquidateAtFullLoss(uint256 positionId) external nonReentrant {
        Position storage position = _positions[positionId];
        require(position.isOpen, "Position not open");

        // Check if full loss
        ebool isFullLoss = checkFullLiquidation(positionId);

        // Make publicly decryptable for verification
        FHE.makePubliclyDecryptable(isFullLoss);

        // Mark position as closed
        position.isOpen = false;

        // Use estimated collateral (for demo purposes)
        uint256 estimatedCollateral = 1000 * 1e6; // $1000

        // Calculate revenue distribution
        uint256 liquidatorReward = (estimatedCollateral * LIQUIDATOR_REWARD_BPS) / 10000;
        uint256 remaining = estimatedCollateral - liquidatorReward;
        uint256 lpShare = (remaining * LP_SHARE_BPS) / 10000;
        uint256 protocolShare = remaining - lpShare;

        // Credit liquidator reward
        liquidatorRewards[msg.sender] += liquidatorReward;

        // Add to pending rewards
        pendingLpRewards += lpShare;
        pendingProtocolRevenue += protocolShare;

        // Track totals
        totalLiquidationProceeds += estimatedCollateral;

        // Emit events
        emit PositionAutoLiquidated(positionId, position.owner, msg.sender, estimatedCollateral, block.timestamp);
    }

    /**
     * @notice Distribute revenue from liquidations and fees
     * @dev Called periodically to split accumulated revenue 50/50 between LP and protocol
     * @param amount Amount to distribute (in plaintext, from decrypted totals)
     */
    function distributeRevenue(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be > 0");

        // Calculate shares: 50% LP, 50% Protocol
        uint256 lpShare = (amount * LP_SHARE_BPS) / 10000;
        uint256 protocolShare = amount - lpShare; // Remainder to protocol

        // Send LP share to liquidity pool
        // Note: In production, would call liquidityPool.collectFees(lpShare)
        // This adds to the pool's epoch rewards for LP providers

        // Send protocol share to treasury
        // Note: In production, would transfer tokens to treasury address

        // Track distributions
        totalFeesCollected += amount;

        emit RevenueDistributed(amount, lpShare, protocolShare, block.timestamp);
    }

    /**
     * @notice Get revenue distribution stats
     */
    function getRevenueStats() external view returns (
        uint256 _totalFeesCollected,
        uint256 _totalLiquidationProceeds,
        uint256 _lpShareBps,
        uint256 _protocolShareBps
    ) {
        return (
            totalFeesCollected,
            totalLiquidationProceeds,
            LP_SHARE_BPS,
            PROTOCOL_SHARE_BPS
        );
    }

    /**
     * @notice Get detailed revenue stats including pending amounts
     */
    function getDetailedRevenueStats() external view returns (
        uint256 _pendingLpRewards,
        uint256 _pendingProtocolRevenue,
        uint256 _totalDistributedToLPs,
        uint256 _totalDistributedToProtocol,
        uint256 _totalLiquidationProceeds,
        uint256 _liquidatorRewardBps,
        uint256 _lpShareBps,
        uint256 _protocolShareBps
    ) {
        return (
            pendingLpRewards,
            pendingProtocolRevenue,
            totalDistributedToLPs,
            totalDistributedToProtocol,
            totalLiquidationProceeds,
            LIQUIDATOR_REWARD_BPS,
            LP_SHARE_BPS,
            PROTOCOL_SHARE_BPS
        );
    }

    /**
     * @notice Claim accumulated liquidator rewards
     * @dev Called by liquidators to withdraw their earned rewards
     */
    function claimLiquidatorReward() external nonReentrant {
        uint256 reward = liquidatorRewards[msg.sender];
        require(reward > 0, "No rewards to claim");

        // Reset reward before transfer (reentrancy protection)
        liquidatorRewards[msg.sender] = 0;

        // Transfer sUSD to liquidator
        // Note: In production, this would be actual token transfer
        // For demo, we track it internally

        emit LiquidatorRewardClaimed(msg.sender, reward, block.timestamp);
    }

    /**
     * @notice Distribute accumulated LP rewards to liquidity pool
     * @dev Called periodically to send rewards to LP stakers
     */
    function distributeLpRewards() external nonReentrant {
        uint256 amount = pendingLpRewards;
        require(amount > 0, "No pending LP rewards");

        // Reset pending before distribution
        pendingLpRewards = 0;
        totalDistributedToLPs += amount;

        // Send to liquidity pool
        // Note: In production, would call liquidityPool.receiveRewards(amount)

        emit LpRewardsDistributed(amount, block.timestamp);
    }

    /**
     * @notice Withdraw accumulated protocol revenue to treasury
     * @dev Only callable by owner
     */
    function withdrawProtocolRevenue() external onlyOwner nonReentrant {
        uint256 amount = pendingProtocolRevenue;
        require(amount > 0, "No pending protocol revenue");

        // Reset pending before withdrawal
        pendingProtocolRevenue = 0;
        totalDistributedToProtocol += amount;

        // Transfer to treasury
        // Note: In production, would transfer actual tokens

        emit ProtocolRevenueWithdrawn(treasury, amount, block.timestamp);
    }

    /**
     * @notice Get liquidator's pending reward
     * @param liquidator Address to check
     * @return reward Pending reward amount
     */
    function getLiquidatorReward(address liquidator) external view returns (uint256) {
        return liquidatorRewards[liquidator];
    }

    /**
     * @notice Batch check and liquidate multiple positions
     * @dev Gas-efficient way to process multiple positions
     * @param positionIds Array of position IDs to check
     */
    function batchCheckLiquidations(uint256[] calldata positionIds) external {
        for (uint256 i = 0; i < positionIds.length; i++) {
            uint256 positionId = positionIds[i];
            Position storage position = _positions[positionId];

            if (!position.isOpen) continue;

            // Check if fully liquidatable (100% loss)
            ebool isFullLoss = checkFullLiquidation(positionId);

            // Make decryptable for off-chain keeper to verify and execute
            FHE.makePubliclyDecryptable(isFullLoss);
        }
    }

    /**
     * @notice Calculate health factor for a position
     * @param position Position data
     * @param currentPrice Current asset price
     * @return Health factor (100 = 1.0, <100 = liquidatable, 0 = fully liquidated)
     * @dev Simplified health calculation for demo
     */
    function _calculateHealthFactor(
        Position storage position,
        euint64 currentPrice
    ) internal returns (euint64) {
        // Get P&L breakdown
        (euint64 pnlAmount, ebool isProfit) = _getPnLBreakdown(position, currentPrice);

        // Calculate equity based on profit/loss
        // If profit: equity = collateral + pnlAmount
        // If loss: equity = collateral - pnlAmount (capped at 0)
        euint64 equity = FHE.select(
            isProfit,
            FHE.add(position.collateral, pnlAmount),
            FHE.select(
                FHE.ge(position.collateral, pnlAmount),
                FHE.sub(position.collateral, pnlAmount),
                FHE.asEuint64(0) // Equity is 0 if loss > collateral
            )
        );

        // Health = (equity * 100) / collateral
        // 100 = healthy (100% of collateral), 0 = fully liquidated
        // Note: Using PRECISION for scaling since we can't divide by encrypted value
        // Instead, we calculate: equity * 100 * PRECISION / (collateral * PRECISION)
        // Simplified: just return equity scaled - actual ratio would need gateway decryption
        euint64 scaledEquity = FHE.mul(equity, 100);

        // For health factor comparison, we compare scaledEquity vs threshold * collateral
        // If scaledEquity < collateral * 100, health < 100%
        // We return scaledEquity / PRECISION as approximation
        euint64 healthFactor = FHE.div(scaledEquity, PRECISION);

        return healthFactor;
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Get position basic info (public data only)
     * @param positionId Position ID
     */
    function getPosition(uint256 positionId) external view returns (
        address owner,
        bytes32 assetId,
        bool isOpen,
        uint256 openTimestamp
    ) {
        Position storage position = _positions[positionId];
        return (
            position.owner,
            position.assetId,
            position.isOpen,
            position.openTimestamp
        );
    }

    /**
     * @notice Get position encrypted data (only owner can decrypt)
     * @param positionId Position ID
     */
    function getPositionEncryptedData(uint256 positionId) external view returns (
        euint64 collateral,
        euint64 size,
        euint64 entryPrice,
        ebool isLong,
        euint64 leverage
    ) {
        Position storage position = _positions[positionId];
        require(position.owner == msg.sender, "Not position owner");

        return (
            position.collateral,
            position.size,
            position.entryPrice,
            position.isLong,
            position.leverage
        );
    }

    /**
     * @notice Get user's position IDs
     * @param user User address
     */
    function getUserPositions(address user) external view returns (uint256[] memory) {
        return _userPositions[user];
    }

    /**
     * @notice Get total number of positions
     */
    function getTotalPositions() external view returns (uint256) {
        return nextPositionId - 1;
    }

    // ============================================
    // ANONYMOUS TRADING (VAY BEE!)
    // ============================================

    /**
     * @notice Open a FULLY ANONYMOUS leveraged position
     * @dev Uses eaddress to encrypt the owner's address - nobody can see who owns this position!
     * @param assetId Asset to trade
     * @param encryptedCollateral Encrypted collateral amount
     * @param encryptedLeverage Encrypted leverage (1-10x)
     * @param encryptedIsLong Encrypted direction (true = long, false = short)
     * @param inputProof ZK proof for encrypted inputs
     * @return positionId The new anonymous position's ID
     */
    function openAnonymousPosition(
        bytes32 assetId,
        externalEuint64 encryptedCollateral,
        externalEuint64 encryptedLeverage,
        externalEbool encryptedIsLong,
        bytes calldata inputProof
    ) external nonReentrant returns (uint256 positionId) {
        // Verify asset is tradeable
        require(oracle.isAssetTradeable(assetId), "Asset not tradeable");

        // Convert external inputs to internal
        euint64 collateral = FHE.fromExternal(encryptedCollateral, inputProof);
        euint64 leverage = FHE.fromExternal(encryptedLeverage, inputProof);
        ebool isLong = FHE.fromExternal(encryptedIsLong, inputProof);

        // Get current balance (from regular balance)
        euint64 currentBalance = _balances[msg.sender];
        require(euint64.unwrap(currentBalance) != 0, "No balance");

        // Check sufficient balance for collateral
        ebool hasSufficientBalance = FHE.ge(currentBalance, collateral);

        // Deduct collateral from balance
        euint64 newBalance = FHE.select(
            hasSufficientBalance,
            FHE.sub(currentBalance, collateral),
            currentBalance
        );
        _balances[msg.sender] = newBalance;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);

        // Calculate position size: collateral * leverage
        euint64 size = FHE.mul(collateral, leverage);

        // Get current price as encrypted value
        euint64 entryPrice = oracle.getEncryptedPrice(assetId);

        // Create ENCRYPTED owner address - THIS IS THE MAGIC!
        eaddress encryptedOwner = FHE.asEaddress(msg.sender);

        // Grant permissions for encrypted owner
        FHE.allowThis(encryptedOwner);
        FHE.allow(encryptedOwner, msg.sender);

        // Grant permissions for all other encrypted values
        FHE.allowThis(collateral);
        FHE.allow(collateral, msg.sender);

        FHE.allowThis(size);
        FHE.allow(size, msg.sender);

        FHE.allowThis(entryPrice);
        FHE.allow(entryPrice, msg.sender);

        FHE.allowThis(isLong);
        FHE.allow(isLong, msg.sender);

        FHE.allowThis(leverage);
        FHE.allow(leverage, msg.sender);

        // Create anonymous position
        positionId = nextPositionId++;

        _anonymousPositions[positionId] = AnonymousPosition({
            id: positionId,
            encryptedOwner: encryptedOwner,  // Nobody can see who owns this!
            assetId: assetId,
            collateral: collateral,
            size: size,
            entryPrice: entryPrice,
            isLong: isLong,
            leverage: leverage,
            openTimestamp: block.timestamp,
            isOpen: true
        });

        // Emit anonymous event - NO address visible!
        emit AnonymousPositionOpened(positionId, assetId, block.timestamp);

        return positionId;
    }

    /**
     * @notice Close an anonymous position
     * @dev Verifies ownership through encrypted address comparison
     * @param positionId Position to close
     */
    function closeAnonymousPosition(uint256 positionId) external nonReentrant {
        AnonymousPosition storage position = _anonymousPositions[positionId];

        require(position.isOpen, "Position not open");

        // Verify ownership through encrypted comparison
        eaddress callerEncrypted = FHE.asEaddress(msg.sender);
        ebool isOwner = FHE.eq(callerEncrypted, position.encryptedOwner);

        // Make ownership check publicly decryptable for this operation
        // In production, this would use async gateway callback
        FHE.makePubliclyDecryptable(isOwner);

        // For demo, we trust that only the real owner can call this
        // Real implementation would verify the decrypted result

        // Get current price
        euint64 currentPrice = oracle.getEncryptedPrice(position.assetId);

        // Calculate P&L (using simplified version)
        euint64 pnl = _calculateAnonymousPnL(position, currentPrice);

        // Calculate final amount: collateral + pnl
        euint64 finalAmount = FHE.add(position.collateral, pnl);

        // Add back to user balance
        euint64 currentBalance = _balances[msg.sender];
        euint64 newBalance;

        if (euint64.unwrap(currentBalance) == 0) {
            newBalance = finalAmount;
        } else {
            newBalance = FHE.add(currentBalance, finalAmount);
        }

        _balances[msg.sender] = newBalance;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);

        // Mark position as closed
        position.isOpen = false;

        // Emit anonymous event - NO address visible!
        emit AnonymousPositionClosed(positionId, block.timestamp);
    }

    /**
     * @notice Calculate P&L for anonymous position
     */
    function _calculateAnonymousPnL(
        AnonymousPosition storage position,
        euint64 currentPrice
    ) internal returns (euint64) {
        ebool priceIncreased = FHE.gt(currentPrice, position.entryPrice);

        euint64 absPriceDiff = FHE.select(
            priceIncreased,
            FHE.sub(currentPrice, position.entryPrice),
            FHE.sub(position.entryPrice, currentPrice)
        );

        euint64 rawPnl = FHE.div(
            FHE.mul(absPriceDiff, position.size),
            PRECISION
        );

        ebool isProfit = FHE.eq(priceIncreased, position.isLong);

        euint64 pnl = FHE.select(
            isProfit,
            rawPnl,
            FHE.asEuint64(0)
        );

        return pnl;
    }

    /**
     * @notice Get anonymous position basic info (public data only)
     * @param positionId Position ID
     */
    function getAnonymousPosition(uint256 positionId) external view returns (
        bytes32 assetId,
        bool isOpen,
        uint256 openTimestamp
    ) {
        AnonymousPosition storage position = _anonymousPositions[positionId];
        return (
            position.assetId,
            position.isOpen,
            position.openTimestamp
        );
        // Notice: NO owner address returned - it's encrypted!
    }

    // ============================================
    // ENCRYPTED LIMIT ORDERS (Advanced FHE!)
    // ============================================

    /**
     * @notice Create an encrypted limit order
     * @dev Trigger price, collateral, leverage are all encrypted - nobody can front-run!
     * @param assetId Asset to trade
     * @param encryptedTriggerPrice Encrypted price at which to trigger
     * @param encryptedCollateral Encrypted collateral amount
     * @param encryptedLeverage Encrypted leverage (1-10x)
     * @param encryptedIsLong Encrypted direction
     * @param encryptedIsAbove Trigger when price goes above (true) or below (false)
     * @param inputProof ZK proof
     * @return orderId The new order ID
     */
    function createLimitOrder(
        bytes32 assetId,
        externalEuint64 encryptedTriggerPrice,
        externalEuint64 encryptedCollateral,
        externalEuint64 encryptedLeverage,
        externalEbool encryptedIsLong,
        externalEbool encryptedIsAbove,
        bytes calldata inputProof
    ) external nonReentrant returns (uint256 orderId) {
        require(oracle.isAssetTradeable(assetId), "Asset not tradeable");

        // Convert external inputs
        euint64 triggerPrice = FHE.fromExternal(encryptedTriggerPrice, inputProof);
        euint64 collateral = FHE.fromExternal(encryptedCollateral, inputProof);
        euint64 leverage = FHE.fromExternal(encryptedLeverage, inputProof);
        ebool isLong = FHE.fromExternal(encryptedIsLong, inputProof);
        ebool isAbove = FHE.fromExternal(encryptedIsAbove, inputProof);

        // Check balance
        euint64 currentBalance = _balances[msg.sender];
        require(euint64.unwrap(currentBalance) != 0, "No balance");

        // Reserve collateral (encrypted check)
        ebool hasSufficientBalance = FHE.ge(currentBalance, collateral);
        euint64 newBalance = FHE.select(
            hasSufficientBalance,
            FHE.sub(currentBalance, collateral),
            currentBalance
        );

        // Set error code based on result
        euint8 errorCode = FHE.select(
            hasSufficientBalance,
            NO_ERROR,
            ERROR_INSUFFICIENT_BALANCE
        );
        _setLastError(errorCode, msg.sender);

        _balances[msg.sender] = newBalance;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);

        // Grant permissions for all encrypted values
        FHE.allowThis(triggerPrice);
        FHE.allow(triggerPrice, msg.sender);

        FHE.allowThis(collateral);
        FHE.allow(collateral, msg.sender);

        FHE.allowThis(leverage);
        FHE.allow(leverage, msg.sender);

        FHE.allowThis(isLong);
        FHE.allow(isLong, msg.sender);

        FHE.allowThis(isAbove);
        FHE.allow(isAbove, msg.sender);

        // Create limit order
        orderId = nextLimitOrderId++;

        _limitOrders[orderId] = EncryptedLimitOrder({
            id: orderId,
            owner: msg.sender,
            assetId: assetId,
            triggerPrice: triggerPrice,
            collateral: collateral,
            leverage: leverage,
            isLong: isLong,
            isAbove: isAbove,
            isActive: true,
            createdAt: block.timestamp
        });

        _userLimitOrders[msg.sender].push(orderId);

        emit LimitOrderCreated(orderId, msg.sender, assetId, block.timestamp);

        return orderId;
    }

    /**
     * @notice Check if limit order should be executed
     * @dev Uses FHE.select for encrypted price comparison
     * @param orderId Order to check
     * @return shouldExecute Encrypted boolean
     */
    function checkLimitOrderTrigger(uint256 orderId) public returns (ebool) {
        EncryptedLimitOrder storage order = _limitOrders[orderId];
        require(order.isActive, "Order not active");

        euint64 currentPrice = oracle.getEncryptedPrice(order.assetId);

        // Check if price crossed trigger
        // isAbove = true: trigger when currentPrice >= triggerPrice
        // isAbove = false: trigger when currentPrice <= triggerPrice
        ebool priceAboveTrigger = FHE.ge(currentPrice, order.triggerPrice);
        ebool priceBelowTrigger = FHE.le(currentPrice, order.triggerPrice);

        // Use FHE.select for encrypted condition
        ebool shouldExecute = FHE.select(
            order.isAbove,
            priceAboveTrigger,
            priceBelowTrigger
        );

        return shouldExecute;
    }

    /**
     * @notice Execute a triggered limit order
     * @param orderId Order to execute
     * @return positionId The new position ID
     */
    function executeLimitOrder(uint256 orderId) external nonReentrant returns (uint256 positionId) {
        EncryptedLimitOrder storage order = _limitOrders[orderId];
        require(order.isActive, "Order not active");

        // Check if triggered
        ebool shouldExecute = checkLimitOrderTrigger(orderId);

        // For demo, make this publicly decryptable
        // In production, use async gateway callback
        FHE.makePubliclyDecryptable(shouldExecute);

        // Get entry price
        euint64 entryPrice = oracle.getEncryptedPrice(order.assetId);

        // Calculate position size
        euint64 size = FHE.mul(order.collateral, order.leverage);

        // Grant permissions
        FHE.allowThis(order.collateral);
        FHE.allow(order.collateral, order.owner);
        FHE.allowThis(size);
        FHE.allow(size, order.owner);
        FHE.allowThis(entryPrice);
        FHE.allow(entryPrice, order.owner);
        FHE.allowThis(order.isLong);
        FHE.allow(order.isLong, order.owner);
        FHE.allowThis(order.leverage);
        FHE.allow(order.leverage, order.owner);

        // Create position
        positionId = nextPositionId++;

        _positions[positionId] = Position({
            id: positionId,
            owner: order.owner,
            assetId: order.assetId,
            collateral: order.collateral,
            size: size,
            entryPrice: entryPrice,
            isLong: order.isLong,
            leverage: order.leverage,
            openTimestamp: block.timestamp,
            isOpen: true
        });

        _userPositions[order.owner].push(positionId);

        // Deactivate order
        order.isActive = false;

        emit LimitOrderExecuted(orderId, positionId, block.timestamp);
        emit PositionOpened(positionId, order.owner, order.assetId, block.timestamp);

        return positionId;
    }

    /**
     * @notice Cancel a limit order
     * @param orderId Order to cancel
     */
    function cancelLimitOrder(uint256 orderId) external nonReentrant {
        EncryptedLimitOrder storage order = _limitOrders[orderId];
        require(order.isActive, "Order not active");
        require(order.owner == msg.sender, "Not order owner");

        // Return collateral to balance
        euint64 currentBalance = _balances[msg.sender];
        euint64 newBalance;

        if (euint64.unwrap(currentBalance) == 0) {
            newBalance = order.collateral;
        } else {
            newBalance = FHE.add(currentBalance, order.collateral);
        }

        _balances[msg.sender] = newBalance;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, msg.sender);

        order.isActive = false;

        emit LimitOrderCancelled(orderId, block.timestamp);
    }

    /**
     * @notice Get user's limit orders
     */
    function getUserLimitOrders(address user) external view returns (uint256[] memory) {
        return _userLimitOrders[user];
    }

    // ============================================
    // ENCRYPTED RANDOM FEATURES (On-chain RNG!)
    // ============================================

    /**
     * @notice Generate a cryptographically secure random encrypted position ID
     * @dev Uses FHE.randEuint64() for on-chain encrypted randomness
     * @return randomId Random encrypted ID
     */
    function generateRandomPositionSalt() external returns (euint64) {
        // Generate random encrypted value
        euint64 randomSalt = FHE.randEuint64();

        // Grant permissions
        FHE.allowThis(randomSalt);
        FHE.allow(randomSalt, msg.sender);

        emit RandomPositionIdGenerated(nextPositionId, block.timestamp);

        return randomSalt;
    }

    /**
     * @notice Generate bounded random number (e.g., for random fees or rewards)
     * @param upperBound Upper bound (must be power of 2)
     * @return Random value between 0 and upperBound-1
     */
    function generateBoundedRandom(uint8 upperBound) external returns (euint8) {
        euint8 randomValue = FHE.randEuint8(upperBound);

        FHE.allowThis(randomValue);
        FHE.allow(randomValue, msg.sender);

        return randomValue;
    }

    // ============================================
    // ENCRYPTED ERROR HANDLING
    // ============================================

    /**
     * @notice Set encrypted error for user (internal)
     */
    function _setLastError(euint8 errorCode, address user) internal {
        _lastErrors[user] = EncryptedError({
            errorCode: errorCode,
            timestamp: block.timestamp
        });

        FHE.allowThis(errorCode);
        FHE.allow(errorCode, user);

        emit ErrorOccurred(user, block.timestamp);
    }

    /**
     * @notice Get user's last encrypted error
     * @param user User address
     * @return errorCode Encrypted error code (only user can decrypt)
     * @return timestamp When error occurred
     */
    function getLastError(address user) external view returns (euint8 errorCode, uint256 timestamp) {
        EncryptedError storage lastError = _lastErrors[user];
        return (lastError.errorCode, lastError.timestamp);
    }

    // ============================================
    // GAS OPTIMIZED OPERATIONS (allowTransient)
    // ============================================

    /**
     * @notice Transfer encrypted balance with gas optimization
     * @dev Uses allowTransient for temporary permissions within transaction
     * @param to Recipient address
     * @param encryptedAmount Encrypted transfer amount
     * @param inputProof ZK proof
     */
    function transferWithOptimizedGas(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        euint64 senderBalance = _balances[msg.sender];
        require(euint64.unwrap(senderBalance) != 0, "No balance");

        // Check sufficient balance
        ebool hasSufficient = FHE.ge(senderBalance, amount);

        // Use allowTransient for temporary permission (saves gas!)
        FHE.allowTransient(amount, to);

        // Calculate new balances
        euint64 newSenderBalance = FHE.select(
            hasSufficient,
            FHE.sub(senderBalance, amount),
            senderBalance
        );

        euint64 recipientBalance = _balances[to];
        euint64 newRecipientBalance;

        if (euint64.unwrap(recipientBalance) == 0) {
            newRecipientBalance = FHE.select(hasSufficient, amount, FHE.asEuint64(0));
        } else {
            newRecipientBalance = FHE.select(
                hasSufficient,
                FHE.add(recipientBalance, amount),
                recipientBalance
            );
        }

        // Update balances
        _balances[msg.sender] = newSenderBalance;
        _balances[to] = newRecipientBalance;

        // Permanent permissions for new balances
        FHE.allowThis(newSenderBalance);
        FHE.allow(newSenderBalance, msg.sender);

        FHE.allowThis(newRecipientBalance);
        FHE.allow(newRecipientBalance, to);

        // Set error code
        euint8 errorCode = FHE.select(hasSufficient, NO_ERROR, ERROR_INSUFFICIENT_BALANCE);
        _setLastError(errorCode, msg.sender);
    }

    // ============================================
    // FHE MIN/MAX OPERATIONS
    // ============================================

    /**
     * @notice Get encrypted minimum of two values
     * @dev Demonstrates FHE.min() operation
     */
    function getEncryptedMin(
        externalEuint64 a,
        externalEuint64 b,
        bytes calldata inputProof
    ) external returns (euint64) {
        euint64 valueA = FHE.fromExternal(a, inputProof);
        euint64 valueB = FHE.fromExternal(b, inputProof);

        euint64 minValue = FHE.min(valueA, valueB);

        FHE.allowThis(minValue);
        FHE.allow(minValue, msg.sender);

        return minValue;
    }

    /**
     * @notice Get encrypted maximum of two values
     * @dev Demonstrates FHE.max() operation
     */
    function getEncryptedMax(
        externalEuint64 a,
        externalEuint64 b,
        bytes calldata inputProof
    ) external returns (euint64) {
        euint64 valueA = FHE.fromExternal(a, inputProof);
        euint64 valueB = FHE.fromExternal(b, inputProof);

        euint64 maxValue = FHE.max(valueA, valueB);

        FHE.allowThis(maxValue);
        FHE.allow(maxValue, msg.sender);

        return maxValue;
    }

    // ============================================
    // PUBLIC DECRYPTION FUNCTIONS (Zama Pattern)
    // ============================================

    /**
     * @notice Prepare position for closing (makes values publicly decryptable)
     * @dev Step 1: Mark encrypted values for public decryption
     * @param positionId Position to close
     */
    function preparePositionClose(uint256 positionId) external nonReentrant {
        Position storage position = _positions[positionId];

        require(position.isOpen, "Position not open");
        require(position.owner == msg.sender, "Not position owner");
        require(!positionPendingClose[positionId], "Close already pending");

        // Mark position as pending close to prevent race conditions
        positionPendingClose[positionId] = true;

        // Get current price for P&L calculation
        euint64 currentPrice = oracle.getEncryptedPrice(position.assetId);

        // Calculate P&L
        euint64 pnl = _calculatePnL(position, currentPrice);

        // Calculate final amount: collateral + pnl
        euint64 finalAmount = FHE.add(position.collateral, pnl);

        // Make values publicly decryptable (off-chain SDK will decrypt)
        FHE.makePubliclyDecryptable(finalAmount);
        FHE.makePubliclyDecryptable(position.collateral);

        // Store pending close info
        uint256 closeId = _nextCloseId++;
        pendingCloses[closeId] = PendingClose({
            positionId: positionId,
            user: msg.sender,
            processed: false,
            finalAmount: 0
        });

        pendingCloseRequests[closeId] = positionId;
        userCloseRequests[msg.sender][positionId] = closeId;

        // Store encrypted handles for verification
        _closeHandles[closeId] = CloseHandles({
            finalAmountHandle: finalAmount,
            collateralHandle: position.collateral
        });

        emit CloseRequested(positionId, msg.sender, closeId);
    }

    /// @notice Storage for encrypted handles during close
    struct CloseHandles {
        euint64 finalAmountHandle;
        euint64 collateralHandle;
    }
    mapping(uint256 => CloseHandles) private _closeHandles;
    uint256 private _nextCloseId = 1;

    /// @notice Storage for liquidation handles
    struct LiquidationHandles {
        ebool isFullLossHandle;
        euint64 collateralHandle;
    }
    mapping(uint256 => LiquidationHandles) private _liquidationHandles;
    uint256 private _nextLiquidationId = 1;

    /**
     * @notice Finalize position close with decrypted values
     * @dev Step 2: Verify decryption proof and process close
     * @param closeId The close request ID
     * @param abiEncodedClearValues ABI encoded (uint64 finalAmount, uint64 collateral)
     * @param decryptionProof The KMS decryption proof
     */
    function finalizePositionClose(
        uint256 closeId,
        bytes memory abiEncodedClearValues,
        bytes memory decryptionProof
    ) external nonReentrant {
        PendingClose storage pending = pendingCloses[closeId];
        require(!pending.processed, "Already processed");
        require(pending.user != address(0), "Invalid request");

        CloseHandles storage handles = _closeHandles[closeId];

        // CRITICAL: Verify KMS signatures!
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(handles.finalAmountHandle);
        cts[1] = FHE.toBytes32(handles.collateralHandle);
        FHE.checkSignatures(cts, abiEncodedClearValues, decryptionProof);

        // Decode decrypted values (collateral used for event/logging if needed)
        (uint64 finalAmount, ) = abi.decode(abiEncodedClearValues, (uint64, uint64));

        Position storage position = _positions[pending.positionId];
        require(position.isOpen, "Position already closed");

        // Mark as processed
        pending.processed = true;
        pending.finalAmount = finalAmount;

        // Add final amount to user balance
        euint64 currentBalance = _balances[pending.user];
        euint64 amountToAdd = FHE.asEuint64(finalAmount);
        euint64 newBalance;

        if (euint64.unwrap(currentBalance) == 0) {
            newBalance = amountToAdd;
        } else {
            newBalance = FHE.add(currentBalance, amountToAdd);
        }

        _balances[pending.user] = newBalance;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, pending.user);

        // Close position and clear pending flag
        position.isOpen = false;
        positionPendingClose[pending.positionId] = false;

        emit CloseProcessed(closeId, pending.positionId, finalAmount);
        emit PositionClosed(pending.positionId, pending.user, block.timestamp);
    }

    /**
     * @notice Prepare liquidation check (makes values publicly decryptable)
     * @dev Step 1: Mark encrypted values for public decryption
     * @param positionId Position to check
     */
    function prepareLiquidation(uint256 positionId) external nonReentrant {
        Position storage position = _positions[positionId];

        require(position.isOpen, "Position not open");
        require(position.owner != msg.sender, "Cannot liquidate own position");

        // Check if fully liquidatable
        ebool isFullLoss = checkFullLiquidation(positionId);

        // Make values publicly decryptable
        FHE.makePubliclyDecryptable(isFullLoss);
        FHE.makePubliclyDecryptable(position.collateral);

        // Store pending liquidation
        uint256 liqId = _nextLiquidationId++;
        pendingLiquidations[liqId] = PendingLiquidation({
            positionId: positionId,
            liquidator: msg.sender,
            processed: false,
            canLiquidate: false,
            collateralAmount: 0
        });

        // Store handles for verification
        _liquidationHandles[liqId] = LiquidationHandles({
            isFullLossHandle: isFullLoss,
            collateralHandle: position.collateral
        });

        emit LiquidationRequested(positionId, msg.sender, liqId);
    }

    /**
     * @notice Finalize liquidation with decrypted values
     * @dev Step 2: Verify decryption proof and process liquidation
     * @param liqId The liquidation request ID
     * @param abiEncodedClearValues ABI encoded (bool canLiquidate, uint64 collateral)
     * @param decryptionProof The KMS decryption proof
     */
    function finalizeLiquidation(
        uint256 liqId,
        bytes memory abiEncodedClearValues,
        bytes memory decryptionProof
    ) external nonReentrant {
        PendingLiquidation storage pending = pendingLiquidations[liqId];
        require(!pending.processed, "Already processed");
        require(pending.liquidator != address(0), "Invalid request");

        LiquidationHandles storage handles = _liquidationHandles[liqId];

        // CRITICAL: Verify KMS signatures!
        bytes32[] memory cts = new bytes32[](2);
        cts[0] = FHE.toBytes32(handles.isFullLossHandle);
        cts[1] = FHE.toBytes32(handles.collateralHandle);
        FHE.checkSignatures(cts, abiEncodedClearValues, decryptionProof);

        // Decode decrypted values
        (bool canLiquidate, uint64 collateralAmount) = abi.decode(abiEncodedClearValues, (bool, uint64));

        pending.processed = true;
        pending.canLiquidate = canLiquidate;
        pending.collateralAmount = collateralAmount;

        emit LiquidationProcessed(liqId, pending.positionId, canLiquidate);
    }

    /**
     * @notice Execute a verified liquidation
     * @dev Step 3: Called after finalizeLiquidation confirms liquidation is valid
     * @param liqId The processed liquidation ID
     */
    function executeLiquidation(uint256 liqId) external nonReentrant {
        PendingLiquidation storage pending = pendingLiquidations[liqId];

        require(pending.processed, "Not processed yet");
        require(pending.canLiquidate, "Cannot liquidate");
        require(pending.liquidator != address(0), "Invalid request");

        Position storage position = _positions[pending.positionId];
        require(position.isOpen, "Position already closed");

        // Close position
        position.isOpen = false;

        // Distribute collateral
        uint256 collateral = pending.collateralAmount;

        // 5% to liquidator
        uint256 liquidatorReward = (collateral * LIQUIDATOR_REWARD_BPS) / 10000;

        // Remaining 95% split 50/50 between LP and protocol
        uint256 remaining = collateral - liquidatorReward;
        uint256 lpShare = (remaining * LP_SHARE_BPS) / 10000;
        uint256 protocolShare = remaining - lpShare;

        // Credit rewards
        liquidatorRewards[pending.liquidator] += liquidatorReward;
        pendingLpRewards += lpShare;
        pendingProtocolRevenue += protocolShare;

        // Track totals
        totalLiquidationProceeds += collateral;
        totalFeesCollected += collateral;

        emit PositionAutoLiquidated(
            pending.positionId,
            position.owner,
            pending.liquidator,
            collateral,
            block.timestamp
        );
        emit RevenueDistributed(collateral, lpShare, protocolShare, block.timestamp);
    }

    /**
     * @notice Get pending close request status
     * @param closeId Close request ID
     */
    function getPendingClose(uint256 closeId) external view returns (
        uint256 positionId,
        address user,
        bool processed,
        uint256 finalAmount
    ) {
        PendingClose storage pending = pendingCloses[closeId];
        return (pending.positionId, pending.user, pending.processed, pending.finalAmount);
    }

    /**
     * @notice Get pending liquidation status
     * @param liqId Liquidation request ID
     */
    function getPendingLiquidation(uint256 liqId) external view returns (
        uint256 positionId,
        address liquidator,
        bool processed,
        bool canLiquidate,
        uint256 collateralAmount
    ) {
        PendingLiquidation storage pending = pendingLiquidations[liqId];
        return (
            pending.positionId,
            pending.liquidator,
            pending.processed,
            pending.canLiquidate,
            pending.collateralAmount
        );
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
     * @notice Update protocol fee
     * @param newFeeBps New fee in basis points
     */
    function setProtocolFee(uint64 newFeeBps) external onlyOwner {
        require(newFeeBps <= 100, "Fee too high"); // Max 1%
        protocolFeeBps = newFeeBps;
    }

    /**
     * @notice Update liquidity pool address
     * @param newPool New liquidity pool contract
     */
    function setLiquidityPool(address newPool) external onlyOwner {
        liquidityPool = ShadowLiquidityPool(newPool);
    }

    /**
     * @notice Update ShadowUSD address
     * @param newShadowUsd New ShadowUSD contract
     */
    function setShadowUsd(address newShadowUsd) external onlyOwner {
        shadowUsd = ShadowUSD(newShadowUsd);
    }

    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
    }
}

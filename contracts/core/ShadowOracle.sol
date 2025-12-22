// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64, euint8, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { IShadowTypes } from "../interfaces/IShadowTypes.sol";

/**
 * @title ShadowOracle
 * @notice Price oracle for Pre-IPO assets
 * @dev Prices are determined by: Base Price (from funding rounds) + Demand Modifier
 *
 * For testnet/demo:
 * - Admin sets base prices from last known funding rounds
 * - Platform demand (long vs short ratio) adjusts price ±20%
 *
 * Categories:
 * - AI: AI & Machine Learning companies
 * - AEROSPACE: Aerospace & Defense
 * - FINTECH: Financial Technology & Payments
 * - DATA: Data & Enterprise Software
 * - SOCIAL: Social Media & Consumer
 */
contract ShadowOracle is ZamaEthereumConfig, Ownable2Step, IShadowTypes {

    /// @notice Asset categories
    enum Category { AI, AEROSPACE, FINTECH, DATA, SOCIAL }

    /// @notice Mapping of asset ID to asset info
    mapping(bytes32 => Asset) public assets;

    /// @notice Mapping of asset ID to category
    mapping(bytes32 => Category) public assetCategories;

    /// @notice List of all asset IDs
    bytes32[] public assetIds;

    /// @notice Assets by category
    mapping(Category => bytes32[]) public assetsByCategory;

    /// @notice Price precision (6 decimals)
    uint64 public constant PRICE_PRECISION = 1e6;

    /// @notice Maximum demand modifier (20%)
    uint64 public constant MAX_DEMAND_MODIFIER = 20;

    /// @notice OI imbalance threshold for 1% price change (e.g., 100000 = $100k imbalance)
    uint256 public constant OI_IMBALANCE_THRESHOLD = 100000 * 1e6; // $100k in 6 decimals

    /// @notice Authorized contracts that can update OI (Vault, MarketMaker)
    mapping(address => bool) public authorizedContracts;

    /// @notice Modifier for authorized contracts only
    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(address _owner) Ownable(_owner) {}

    /**
     * @notice Set contract authorization
     * @param contractAddress Address to authorize/deauthorize
     * @param authorized Whether to authorize
     */
    function setAuthorizedContract(address contractAddress, bool authorized) external onlyOwner {
        authorizedContracts[contractAddress] = authorized;
        emit ContractAuthorized(contractAddress, authorized);
    }

    /// @notice Event for contract authorization
    event ContractAuthorized(address indexed contractAddress, bool authorized);

    /**
     * @notice Add a new Pre-IPO asset
     * @param name Asset name (e.g., "SpaceX")
     * @param symbol Asset symbol (e.g., "SPACEX")
     * @param basePrice Base price in USD with 6 decimals (e.g., 150000000 = $150)
     */
    function addAsset(
        string calldata name,
        string calldata symbol,
        uint64 basePrice
    ) external onlyOwner {
        _addAsset(name, symbol, basePrice, Category.AI); // Default to AI
    }

    /**
     * @notice Add a new Pre-IPO asset with category
     * @param name Asset name (e.g., "SpaceX")
     * @param symbol Asset symbol (e.g., "SPACEX")
     * @param basePrice Base price in USD with 6 decimals
     * @param category Asset category
     */
    function addAssetWithCategory(
        string calldata name,
        string calldata symbol,
        uint64 basePrice,
        Category category
    ) external onlyOwner {
        _addAsset(name, symbol, basePrice, category);
    }

    /**
     * @notice Internal function to add asset
     */
    function _addAsset(
        string calldata name,
        string calldata symbol,
        uint64 basePrice,
        Category category
    ) internal {
        bytes32 assetId = keccak256(abi.encodePacked(symbol));

        require(assets[assetId].basePrice == 0, "Asset already exists");
        require(basePrice > 0, "Invalid base price");

        // Initialize encrypted OI values to zero
        euint64 zeroOI = FHE.asEuint64(0);
        FHE.allowThis(zeroOI);

        assets[assetId] = Asset({
            name: name,
            symbol: symbol,
            basePrice: basePrice,
            isActive: true,
            encryptedLongOI: zeroOI,
            encryptedShortOI: zeroOI,
            totalOI: 0,
            lastPrice: basePrice,
            volume24h: 0,
            lastTradeTime: block.timestamp,
            lpPoolSize: 0
        });

        assetIds.push(assetId);
        assetCategories[assetId] = category;
        assetsByCategory[category].push(assetId);

        emit AssetAdded(assetId, name, symbol, basePrice);
    }

    /**
     * @notice Update base price (simulates funding round update)
     * @param assetId Asset identifier
     * @param newBasePrice New base price
     */
    function updateBasePrice(bytes32 assetId, uint64 newBasePrice) external onlyOwner {
        require(assets[assetId].basePrice > 0, "Asset does not exist");
        require(newBasePrice > 0, "Invalid price");

        assets[assetId].basePrice = newBasePrice;

        emit PriceUpdated(assetId, newBasePrice);
    }

    /**
     * @notice Toggle asset trading status
     * @param assetId Asset identifier
     * @param isActive New status
     */
    function setAssetStatus(bytes32 assetId, bool isActive) external onlyOwner {
        require(assets[assetId].basePrice > 0, "Asset does not exist");
        assets[assetId].isActive = isActive;
    }

    /// @notice Delayed price modifier (updated by admin periodically)
    /// @dev This is updated via delayed disclosure - prevents real-time manipulation
    mapping(bytes32 => int8) public delayedPriceModifier;

    /// @notice Last modifier update timestamp per asset
    mapping(bytes32 => uint256) public lastModifierUpdate;

    /// @notice Modifier update delay (2 hours for delayed disclosure)
    uint256 public constant MODIFIER_UPDATE_DELAY = 2 hours;

    /**
     * @notice Get current price for an asset (uses delayed modifier)
     * @param assetId Asset identifier
     * @return Current price with 6 decimals
     * @dev Price formula: basePrice * (1 + delayedModifier%)
     *      The modifier is updated periodically via delayed disclosure
     *      This prevents real-time manipulation based on OI direction
     */
    function getCurrentPrice(bytes32 assetId) public view returns (uint64) {
        Asset storage asset = assets[assetId];
        require(asset.basePrice > 0, "Asset does not exist");

        // Use delayed price modifier (updated periodically, not real-time)
        int8 priceModifier = delayedPriceModifier[assetId];

        // Apply modifier to base price
        uint64 adjustedPrice;
        if (priceModifier >= 0) {
            adjustedPrice = uint64((uint256(asset.basePrice) * (100 + uint256(int256(priceModifier)))) / 100);
        } else {
            uint256 absModifier = uint256(int256(-priceModifier));
            adjustedPrice = uint64((uint256(asset.basePrice) * (100 - absModifier)) / 100);
        }

        return adjustedPrice;
    }

    /**
     * @notice Update delayed price modifier (admin function)
     * @dev Called periodically (e.g., every 2 hours) based on decrypted OI
     *      This implements "delayed disclosure" - past modifier revealed, current hidden
     * @param assetId Asset identifier
     * @param newModifier New price modifier (-20 to +20)
     */
    function updateDelayedPriceModifier(
        bytes32 assetId,
        int8 newModifier
    ) external onlyOwner {
        require(newModifier >= -20 && newModifier <= 20, "Modifier out of range");
        require(
            block.timestamp >= lastModifierUpdate[assetId] + MODIFIER_UPDATE_DELAY,
            "Update too frequent"
        );

        delayedPriceModifier[assetId] = newModifier;
        lastModifierUpdate[assetId] = block.timestamp;

        emit PriceModifierUpdated(assetId, newModifier);
    }

    /// @notice Event for price modifier updates
    event PriceModifierUpdated(bytes32 indexed assetId, int8 newModifier);

    /**
     * @notice Get base price (without any modifier)
     * @param assetId Asset identifier
     * @return Base price with 6 decimals
     */
    function getBasePrice(bytes32 assetId) external view returns (uint64) {
        return assets[assetId].basePrice;
    }

    /**
     * @notice Get last trade price
     * @param assetId Asset identifier
     * @return Last execution price
     */
    function getLastPrice(bytes32 assetId) external view returns (uint64) {
        return assets[assetId].lastPrice;
    }

    /**
     * @notice Get current price as encrypted value
     * @param assetId Asset identifier
     * @return Encrypted current price
     */
    function getEncryptedPrice(bytes32 assetId) public returns (euint64) {
        uint64 price = getCurrentPrice(assetId);
        euint64 encryptedPrice = FHE.asEuint64(price);

        // Grant permission to caller (vault) so it can use this value
        FHE.allowThis(encryptedPrice);
        FHE.allow(encryptedPrice, msg.sender);

        return encryptedPrice;
    }

    /**
     * @notice Update open interest with ENCRYPTED values
     * @dev Direction is now hidden - only totalOI (combined) is public
     * @param assetId Asset identifier
     * @param encryptedAmount Encrypted OI amount
     * @param isLong Encrypted direction (hidden from observers)
     * @param isIncrease Whether to increase or decrease
     * @param publicAmount The plaintext amount for totalOI tracking
     */
    function updateOpenInterest(
        bytes32 assetId,
        euint64 encryptedAmount,
        ebool isLong,
        bool isIncrease,
        uint256 publicAmount
    ) external onlyAuthorized {
        Asset storage asset = assets[assetId];

        if (isIncrease) {
            // Update encrypted Long or Short OI based on encrypted direction
            asset.encryptedLongOI = FHE.select(
                isLong,
                FHE.add(asset.encryptedLongOI, encryptedAmount),
                asset.encryptedLongOI
            );
            asset.encryptedShortOI = FHE.select(
                isLong,
                asset.encryptedShortOI,
                FHE.add(asset.encryptedShortOI, encryptedAmount)
            );

            // Update public totalOI (directionless)
            asset.totalOI += publicAmount;
        } else {
            // Decrease encrypted OI
            asset.encryptedLongOI = FHE.select(
                isLong,
                FHE.sub(asset.encryptedLongOI, encryptedAmount),
                asset.encryptedLongOI
            );
            asset.encryptedShortOI = FHE.select(
                isLong,
                asset.encryptedShortOI,
                FHE.sub(asset.encryptedShortOI, encryptedAmount)
            );

            // Update public totalOI
            if (asset.totalOI >= publicAmount) {
                asset.totalOI -= publicAmount;
            } else {
                asset.totalOI = 0;
            }
        }

        // Grant permissions for updated values
        FHE.allowThis(asset.encryptedLongOI);
        FHE.allowThis(asset.encryptedShortOI);

        emit OIUpdated(assetId, asset.totalOI, isIncrease);
    }

    /// @notice Event for OI updates (only shows directionless total)
    event OIUpdated(bytes32 indexed assetId, uint256 totalOI, bool isIncrease);

    /**
     * @notice Legacy updateOpenInterest for backwards compatibility
     * @dev DEPRECATED - Use the new encrypted version
     */
    function updateOpenInterestLegacy(
        bytes32 assetId,
        uint256 longDelta,
        uint256 shortDelta,
        bool isIncrease
    ) external onlyAuthorized {
        Asset storage asset = assets[assetId];

        // Convert to encrypted and call new function internally
        euint64 encLongDelta = FHE.asEuint64(uint64(longDelta / 1e12)); // Scale down for euint64
        euint64 encShortDelta = FHE.asEuint64(uint64(shortDelta / 1e12));

        if (isIncrease) {
            asset.encryptedLongOI = FHE.add(asset.encryptedLongOI, encLongDelta);
            asset.encryptedShortOI = FHE.add(asset.encryptedShortOI, encShortDelta);
            asset.totalOI += longDelta + shortDelta;
        } else {
            asset.encryptedLongOI = FHE.sub(asset.encryptedLongOI, encLongDelta);
            asset.encryptedShortOI = FHE.sub(asset.encryptedShortOI, encShortDelta);
            uint256 delta = longDelta + shortDelta;
            asset.totalOI = asset.totalOI >= delta ? asset.totalOI - delta : 0;
        }

        FHE.allowThis(asset.encryptedLongOI);
        FHE.allowThis(asset.encryptedShortOI);
    }

    /**
     * @notice Get asset info
     * @param assetId Asset identifier
     */
    function getAsset(bytes32 assetId) external view returns (Asset memory) {
        return assets[assetId];
    }

    /**
     * @notice Get all asset IDs
     */
    function getAllAssetIds() external view returns (bytes32[] memory) {
        return assetIds;
    }

    /**
     * @notice Get assets by category
     * @param category Category to filter by
     */
    function getAssetsByCategory(Category category) external view returns (bytes32[] memory) {
        return assetsByCategory[category];
    }

    /**
     * @notice Get asset category
     * @param assetId Asset identifier
     */
    function getAssetCategory(bytes32 assetId) external view returns (Category) {
        return assetCategories[assetId];
    }

    /**
     * @notice Get asset ID from symbol
     * @param symbol Asset symbol
     */
    function getAssetId(string calldata symbol) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(symbol));
    }

    /**
     * @notice Check if asset exists and is active
     * @param assetId Asset identifier
     */
    function isAssetTradeable(bytes32 assetId) external view returns (bool) {
        return assets[assetId].basePrice > 0 && assets[assetId].isActive;
    }

    // ============================================
    // PUBLIC OI GETTER (Directionless)
    // ============================================

    /**
     * @notice Get total OI (Long + Short combined, no direction info)
     * @param assetId Asset identifier
     * @return Total open interest (directionless)
     */
    function getTotalOI(bytes32 assetId) external view returns (uint256) {
        return assets[assetId].totalOI;
    }

    // ============================================
    // LIQUIDITY SCORE SYSTEM
    // ============================================

    /// @notice Liquidity score benchmarks
    uint256 public constant LP_BENCHMARK = 10_000_000 * 1e6;      // $10M LP = max score
    uint256 public constant VOLUME_BENCHMARK = 5_000_000 * 1e6;   // $5M daily volume = max score
    uint256 public constant OI_BENCHMARK = 20_000_000 * 1e6;      // $20M OI = max score

    /// @notice Score weights (total = 100)
    uint8 public constant LP_WEIGHT = 40;
    uint8 public constant VOLUME_WEIGHT = 30;
    uint8 public constant OI_WEIGHT = 20;
    uint8 public constant ACTIVITY_WEIGHT = 10;

    /**
     * @notice Calculate liquidity score for an asset
     * @param assetId Asset identifier
     * @return score 0-100 score
     */
    function calculateLiquidityScore(bytes32 assetId) public view returns (uint8) {
        Asset storage asset = assets[assetId];

        uint256 score = 0;

        // 1. LP Pool Depth (max 40 points)
        if (LP_BENCHMARK > 0) {
            uint256 lpScore = (asset.lpPoolSize * LP_WEIGHT) / LP_BENCHMARK;
            score += lpScore > LP_WEIGHT ? LP_WEIGHT : lpScore;
        }

        // 2. 24h Volume (max 30 points)
        if (VOLUME_BENCHMARK > 0) {
            uint256 volScore = (asset.volume24h * VOLUME_WEIGHT) / VOLUME_BENCHMARK;
            score += volScore > VOLUME_WEIGHT ? VOLUME_WEIGHT : volScore;
        }

        // 3. Total OI (max 20 points)
        if (OI_BENCHMARK > 0) {
            uint256 oiScore = (asset.totalOI * OI_WEIGHT) / OI_BENCHMARK;
            score += oiScore > OI_WEIGHT ? OI_WEIGHT : oiScore;
        }

        // 4. Recent Activity (max 10 points)
        if (block.timestamp - asset.lastTradeTime < 1 hours) {
            score += ACTIVITY_WEIGHT;
        } else if (block.timestamp - asset.lastTradeTime < 6 hours) {
            score += ACTIVITY_WEIGHT / 2;
        }

        return uint8(score > 100 ? 100 : score);
    }

    /**
     * @notice Get liquidity score with category
     * @param assetId Asset identifier
     * @return score 0-100 score
     * @return category Category string (VERY_HIGH, HIGH, MEDIUM, LOW, VERY_LOW)
     */
    function getLiquidityScore(bytes32 assetId) external view returns (uint8 score, string memory category) {
        score = calculateLiquidityScore(assetId);

        if (score >= 90) category = "VERY_HIGH";
        else if (score >= 70) category = "HIGH";
        else if (score >= 50) category = "MEDIUM";
        else if (score >= 30) category = "LOW";
        else category = "VERY_LOW";
    }

    // ============================================
    // MARKET DATA UPDATES
    // ============================================

    /// @notice Event for market data updates
    event MarketDataUpdated(bytes32 indexed assetId, uint64 tradePrice, uint256 tradeSize);

    /**
     * @notice Update market data after a trade
     * @dev Called by Vault after each trade execution
     * @param assetId Asset identifier
     * @param tradePrice Trade execution price
     * @param tradeSize Trade size
     */
    function updateMarketData(
        bytes32 assetId,
        uint64 tradePrice,
        uint256 tradeSize
    ) external onlyAuthorized {
        Asset storage asset = assets[assetId];

        // Update last price
        asset.lastPrice = tradePrice;
        asset.lastTradeTime = block.timestamp;

        // Update 24h volume (simplified - in production use rolling window)
        asset.volume24h += tradeSize;

        emit MarketDataUpdated(assetId, tradePrice, tradeSize);
    }

    /**
     * @notice Update LP pool size for an asset
     * @param assetId Asset identifier
     * @param newSize New LP pool size
     */
    function updateLpPoolSize(bytes32 assetId, uint256 newSize) external onlyAuthorized {
        assets[assetId].lpPoolSize = newSize;
    }

    /**
     * @notice Reset 24h volume (called daily by keeper)
     * @param assetId Asset identifier
     */
    function resetVolume24h(bytes32 assetId) external onlyOwner {
        assets[assetId].volume24h = 0;
    }

    /**
     * @notice Get comprehensive market data
     * @param assetId Asset identifier
     * @return lastPrice Last trade price
     * @return volume24h 24h trading volume
     * @return totalOI Total open interest (directionless)
     * @return liquidityScore Liquidity score (0-100)
     * @return liquidityCategory Category string
     */
    function getMarketData(bytes32 assetId) external view returns (
        uint64 lastPrice,
        uint256 volume24h,
        uint256 totalOI,
        uint8 liquidityScore,
        string memory liquidityCategory
    ) {
        Asset storage asset = assets[assetId];

        lastPrice = asset.lastPrice;
        volume24h = asset.volume24h;
        totalOI = asset.totalOI;
        (liquidityScore, liquidityCategory) = this.getLiquidityScore(assetId);
    }

    // ============================================
    // ADVANCED FHE PRICE FEATURES
    // ============================================

    /**
     * @notice Compare two asset prices (encrypted comparison)
     * @dev Uses FHE.gt() - nobody learns actual prices
     * @param assetId1 First asset
     * @param assetId2 Second asset
     * @return result Encrypted boolean (true if price1 > price2)
     */
    function comparePrices(
        bytes32 assetId1,
        bytes32 assetId2
    ) external returns (ebool result) {
        euint64 price1 = getEncryptedPrice(assetId1);
        euint64 price2 = getEncryptedPrice(assetId2);

        result = FHE.gt(price1, price2);

        FHE.allowThis(result);
        FHE.allow(result, msg.sender);

        return result;
    }

    /**
     * @notice Get encrypted price difference between two assets
     * @dev Uses FHE.sub() with FHE.select() for absolute difference
     * @param assetId1 First asset
     * @param assetId2 Second asset
     * @return diff Encrypted absolute price difference
     */
    function getEncryptedPriceDiff(
        bytes32 assetId1,
        bytes32 assetId2
    ) external returns (euint64 diff) {
        euint64 price1 = getEncryptedPrice(assetId1);
        euint64 price2 = getEncryptedPrice(assetId2);

        // Absolute difference using FHE.select()
        ebool price1Greater = FHE.gt(price1, price2);
        diff = FHE.select(
            price1Greater,
            FHE.sub(price1, price2),
            FHE.sub(price2, price1)
        );

        FHE.allowThis(diff);
        FHE.allow(diff, msg.sender);

        return diff;
    }

    /**
     * @notice Get encrypted average of two asset prices
     * @dev Uses FHE.add() and FHE.div() for privacy-preserving average
     * @param assetId1 First asset
     * @param assetId2 Second asset
     * @return avgPrice Encrypted average price
     */
    function getEncryptedAveragePrice(
        bytes32 assetId1,
        bytes32 assetId2
    ) external returns (euint64 avgPrice) {
        euint64 price1 = getEncryptedPrice(assetId1);
        euint64 price2 = getEncryptedPrice(assetId2);

        // Average = (price1 + price2) / 2
        avgPrice = FHE.div(FHE.add(price1, price2), 2);

        FHE.allowThis(avgPrice);
        FHE.allow(avgPrice, msg.sender);

        return avgPrice;
    }

    /**
     * @notice Get minimum price between two assets
     * @dev Uses FHE.min() for privacy-preserving minimum
     * @param assetId1 First asset
     * @param assetId2 Second asset
     * @return minPrice The lower price (encrypted)
     */
    function getEncryptedMinPrice(
        bytes32 assetId1,
        bytes32 assetId2
    ) external returns (euint64 minPrice) {
        euint64 price1 = getEncryptedPrice(assetId1);
        euint64 price2 = getEncryptedPrice(assetId2);

        minPrice = FHE.min(price1, price2);

        FHE.allowThis(minPrice);
        FHE.allow(minPrice, msg.sender);

        return minPrice;
    }

    /**
     * @notice Get maximum price between two assets
     * @dev Uses FHE.max() for privacy-preserving maximum
     * @param assetId1 First asset
     * @param assetId2 Second asset
     * @return maxPrice The higher price (encrypted)
     */
    function getEncryptedMaxPrice(
        bytes32 assetId1,
        bytes32 assetId2
    ) external returns (euint64 maxPrice) {
        euint64 price1 = getEncryptedPrice(assetId1);
        euint64 price2 = getEncryptedPrice(assetId2);

        maxPrice = FHE.max(price1, price2);

        FHE.allowThis(maxPrice);
        FHE.allow(maxPrice, msg.sender);

        return maxPrice;
    }

    /**
     * @notice Generate random price slippage for orders
     * @dev Uses FHE.randEuint8() for encrypted random slippage
     * @param maxSlippageBps Maximum slippage in basis points (e.g., 50 = 0.5%)
     * @return slippage Random encrypted slippage value
     */
    function generateRandomSlippage(uint8 maxSlippageBps) external returns (euint8 slippage) {
        slippage = FHE.randEuint8(maxSlippageBps);

        FHE.allowThis(slippage);
        FHE.allow(slippage, msg.sender);

        return slippage;
    }

    /**
     * @notice Calculate price with encrypted slippage applied
     * @dev Demonstrates multiple FHE operations in one function
     * @param assetId Asset to get price for
     * @param slippageBps Slippage in basis points
     * @param isPositive True for positive slippage, false for negative
     * @return adjustedPrice Price with slippage applied (encrypted)
     */
    function getPriceWithSlippage(
        bytes32 assetId,
        uint8 slippageBps,
        bool isPositive
    ) external returns (euint64 adjustedPrice) {
        euint64 basePrice = getEncryptedPrice(assetId);

        // Calculate slippage amount: price * slippageBps / 10000
        euint64 slippageAmount = FHE.div(
            FHE.mul(basePrice, uint64(slippageBps)),
            10000
        );

        // Apply slippage (positive or negative)
        if (isPositive) {
            adjustedPrice = FHE.add(basePrice, slippageAmount);
        } else {
            adjustedPrice = FHE.sub(basePrice, slippageAmount);
        }

        FHE.allowThis(adjustedPrice);
        FHE.allow(adjustedPrice, msg.sender);

        return adjustedPrice;
    }
}

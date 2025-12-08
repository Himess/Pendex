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

    /// @notice Modifier per unit of OI imbalance
    uint64 public constant DEMAND_MODIFIER_PER_UNIT = 1; // 0.1% per 1000 units imbalance

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

        assets[assetId] = Asset({
            name: name,
            symbol: symbol,
            basePrice: basePrice,
            isActive: true,
            totalLongOI: 0,
            totalShortOI: 0
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

    /**
     * @notice Get current price for an asset (includes demand modifier)
     * @param assetId Asset identifier
     * @return Current price with 6 decimals
     */
    function getCurrentPrice(bytes32 assetId) public view returns (uint64) {
        Asset storage asset = assets[assetId];
        require(asset.basePrice > 0, "Asset does not exist");

        // Calculate demand modifier based on OI imbalance
        int256 oiDiff = int256(asset.totalLongOI) - int256(asset.totalShortOI);

        // Calculate modifier percentage (capped at ±20%)
        int256 modifierPercent = (oiDiff * int256(uint256(DEMAND_MODIFIER_PER_UNIT))) / 10000;

        if (modifierPercent > int256(uint256(MAX_DEMAND_MODIFIER))) {
            modifierPercent = int256(uint256(MAX_DEMAND_MODIFIER));
        } else if (modifierPercent < -int256(uint256(MAX_DEMAND_MODIFIER))) {
            modifierPercent = -int256(uint256(MAX_DEMAND_MODIFIER));
        }

        // Apply modifier to base price
        uint64 adjustedPrice;
        if (modifierPercent >= 0) {
            adjustedPrice = asset.basePrice + uint64(uint256(modifierPercent) * asset.basePrice / 100);
        } else {
            adjustedPrice = asset.basePrice - uint64(uint256(-modifierPercent) * asset.basePrice / 100);
        }

        return adjustedPrice;
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
     * @notice Update open interest (called by vault or market maker)
     * @param assetId Asset identifier
     * @param longDelta Change in long OI
     * @param shortDelta Change in short OI
     * @param isIncrease Whether to increase or decrease
     */
    function updateOpenInterest(
        bytes32 assetId,
        uint256 longDelta,
        uint256 shortDelta,
        bool isIncrease
    ) external onlyAuthorized {
        Asset storage asset = assets[assetId];

        if (isIncrease) {
            asset.totalLongOI += longDelta;
            asset.totalShortOI += shortDelta;
        } else {
            asset.totalLongOI -= longDelta;
            asset.totalShortOI -= shortDelta;
        }
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

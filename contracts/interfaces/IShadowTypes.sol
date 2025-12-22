// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { euint64, ebool, eaddress } from "@fhevm/solidity/lib/FHE.sol";

/**
 * @title IShadowTypes
 * @notice Common types used across Shadow Protocol contracts
 */
interface IShadowTypes {
    /// @notice Pre-IPO Asset information
    /// @dev OI direction is now ENCRYPTED - prevents manipulation
    struct Asset {
        string name;           // e.g., "SpaceX", "Stripe"
        string symbol;         // e.g., "SPACEX", "STRIPE"
        uint64 basePrice;      // Base price from last funding round (6 decimals)
        bool isActive;         // Whether trading is enabled

        // ENCRYPTED OI - Direction hidden from public
        euint64 encryptedLongOI;   // Encrypted long open interest
        euint64 encryptedShortOI;  // Encrypted short open interest

        // PUBLIC - Only total OI (no direction info)
        uint256 totalOI;           // Combined Long + Short (directionless)

        // Market Data (PUBLIC)
        uint64 lastPrice;          // Last trade price
        uint256 volume24h;         // 24h trading volume
        uint256 lastTradeTime;     // Timestamp of last trade
        uint256 lpPoolSize;        // LP pool liquidity for this asset
    }

    /// @notice Encrypted position data
    struct Position {
        uint256 id;                    // Position ID
        address owner;                 // Position owner (public for liquidation)
        bytes32 assetId;               // Asset being traded
        euint64 collateral;            // Encrypted collateral amount
        euint64 size;                  // Encrypted position size
        euint64 entryPrice;            // Encrypted entry price
        ebool isLong;                  // Encrypted direction
        euint64 leverage;              // Encrypted leverage (1-10x)
        uint256 openTimestamp;         // When position was opened
        bool isOpen;                   // Position status (public)
    }

    /// @notice Fully anonymous position data (VAY BEE feature!)
    /// @dev Uses eaddress for encrypted owner - nobody can see who owns it
    struct AnonymousPosition {
        uint256 id;                    // Position ID (public for reference)
        eaddress encryptedOwner;       // ENCRYPTED owner - totally anonymous!
        bytes32 assetId;               // Asset being traded (public for order book)
        euint64 collateral;            // Encrypted collateral amount
        euint64 size;                  // Encrypted position size
        euint64 entryPrice;            // Encrypted entry price
        ebool isLong;                  // Encrypted direction
        euint64 leverage;              // Encrypted leverage (1-10x)
        uint256 openTimestamp;         // When position was opened
        bool isOpen;                   // Position status (public)
    }

    /// @notice Events
    event PositionOpened(
        uint256 indexed positionId,
        address indexed trader,
        bytes32 indexed assetId,
        uint256 timestamp
    );

    event PositionClosed(
        uint256 indexed positionId,
        address indexed trader,
        uint256 timestamp
    );

    event PositionLiquidated(
        uint256 indexed positionId,
        address indexed trader,
        address indexed liquidator,
        uint256 timestamp
    );

    /// @notice Anonymous position events - NO trader address visible!
    event AnonymousPositionOpened(
        uint256 indexed positionId,
        bytes32 indexed assetId,
        uint256 timestamp
        // Notice: NO address here - completely anonymous!
    );

    event AnonymousPositionClosed(
        uint256 indexed positionId,
        uint256 timestamp
        // Notice: NO address here - completely anonymous!
    );

    event AssetAdded(
        bytes32 indexed assetId,
        string name,
        string symbol,
        uint64 basePrice
    );

    event PriceUpdated(
        bytes32 indexed assetId,
        uint64 newPrice
    );
}

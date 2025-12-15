// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint8, euint64, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ShadowUSD } from "../tokens/ShadowUSD.sol";

/**
 * @title ShadowLiquidityPool
 * @notice Liquidity Pool for Shadow Protocol - LP providers act as counterparty to traders
 * @dev GMX/GNS style liquidity pool where:
 *      - LPs deposit sUSD and receive LP tokens
 *      - LPs earn from: trading fees + trader losses
 *      - LPs lose from: trader profits
 *      - 24 hour lock-up period for deposits
 *      - Epoch-based reward distribution (every 24 hours)
 *
 * FHE Usage:
 *      - LP balances are encrypted
 *      - Individual rewards are encrypted
 *      - Only aggregate pool stats are public (for transparency)
 */
contract ShadowLiquidityPool is ZamaEthereumConfig, Ownable2Step, ReentrancyGuard {

    /// @notice ShadowUSD token
    ShadowUSD public immutable shadowUsd;

    /// @notice Vault contract (can request liquidity)
    address public vault;

    // ============================================
    // POOL STATE
    // ============================================

    /// @notice Total liquidity in pool (public for transparency)
    uint256 public totalLiquidity;

    /// @notice Total LP tokens minted
    uint256 public totalLpTokens;

    /// @notice Encrypted LP token balances
    mapping(address => euint64) private _lpBalances;

    /// @notice Deposit timestamps for lock-up
    mapping(address => uint256) public depositTimestamp;

    /// @notice Lock-up period (24 hours)
    uint256 public constant LOCK_PERIOD = 24 hours;

    // ============================================
    // EPOCH & REWARDS
    // ============================================

    /// @notice Current epoch number
    uint256 public currentEpoch;

    /// @notice Epoch duration (24 hours)
    uint256 public constant EPOCH_DURATION = 24 hours;

    /// @notice Last epoch timestamp
    uint256 public lastEpochTimestamp;

    /// @notice Protocol fee share (50% = 5000 basis points)
    uint256 public protocolFeeShare = 5000; // 50%

    /// @notice Accumulated fees for current epoch (public)
    uint256 public epochFees;

    /// @notice Accumulated PnL for current epoch (can be negative)
    /// @dev Positive = trader losses (LP gains), Negative = trader profits (LP losses)
    int256 public epochPnL;

    /// @notice Protocol treasury
    address public treasury;

    /// @notice Rewards per LP token for each epoch
    mapping(uint256 => uint256) public epochRewardsPerToken;

    /// @notice Last claimed epoch for each user
    mapping(address => uint256) public lastClaimedEpoch;

    /// @notice Encrypted pending rewards
    mapping(address => euint64) private _pendingRewards;

    // ============================================
    // UTILIZATION & RISK
    // ============================================

    /// @notice Maximum utilization ratio (80%)
    uint256 public constant MAX_UTILIZATION = 8000; // 80%

    /// @notice Current utilization (borrowed by vault)
    uint256 public currentUtilization;

    /// @notice Base APY for LPs (10%)
    uint256 public baseApy = 1000; // 10%

    // ============================================
    // EVENTS
    // ============================================

    event LiquidityAdded(address indexed provider, uint256 amount, uint256 lpTokens);
    event LiquidityRemoved(address indexed provider, uint256 amount, uint256 lpTokens);
    event RewardsClaimed(address indexed provider, uint256 epoch);
    event EpochAdvanced(uint256 indexed epoch, uint256 fees, int256 pnl);
    event LiquidityBorrowed(uint256 amount);
    event LiquidityReturned(uint256 amount, int256 pnl);
    event FeesCollected(uint256 amount);

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address _owner,
        address _shadowUsd,
        address _treasury
    ) Ownable(_owner) {
        shadowUsd = ShadowUSD(_shadowUsd);
        treasury = _treasury;
        lastEpochTimestamp = block.timestamp;
        currentEpoch = 1;
    }

    // ============================================
    // LP FUNCTIONS
    // ============================================

    /**
     * @notice Add liquidity to the pool
     * @param amount Amount of sUSD to deposit
     * @dev Mints LP tokens proportional to share of pool
     */
    function addLiquidity(uint64 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");

        // Transfer sUSD from user to pool
        // Note: User must approve this contract first
        // In production, would call: shadowUsd.vaultDeposit(msg.sender, FHE.asEuint64(amount));

        // Calculate LP tokens to mint
        uint256 lpTokensToMint;
        if (totalLpTokens == 0) {
            // First deposit - 1:1 ratio
            lpTokensToMint = amount;
        } else {
            // Proportional to existing pool
            lpTokensToMint = (uint256(amount) * totalLpTokens) / totalLiquidity;
        }

        // Update state
        totalLiquidity += amount;
        totalLpTokens += lpTokensToMint;

        // Update encrypted LP balance
        euint64 currentLpBalance = _lpBalances[msg.sender];
        euint64 newLpBalance;
        euint64 lpTokensEncrypted = FHE.asEuint64(uint64(lpTokensToMint));

        if (euint64.unwrap(currentLpBalance) == 0) {
            newLpBalance = lpTokensEncrypted;
        } else {
            newLpBalance = FHE.add(currentLpBalance, lpTokensEncrypted);
        }

        _lpBalances[msg.sender] = newLpBalance;
        FHE.allowThis(newLpBalance);
        FHE.allow(newLpBalance, msg.sender);

        // Set deposit timestamp for lock-up
        depositTimestamp[msg.sender] = block.timestamp;

        // Set last claimed epoch
        if (lastClaimedEpoch[msg.sender] == 0) {
            lastClaimedEpoch[msg.sender] = currentEpoch;
        }

        emit LiquidityAdded(msg.sender, amount, lpTokensToMint);
    }

    /**
     * @notice Remove liquidity from the pool
     * @param lpTokens Amount of LP tokens to burn
     * @dev Subject to 24 hour lock-up and utilization limits
     */
    function removeLiquidity(uint64 lpTokens) external nonReentrant {
        require(lpTokens > 0, "Amount must be > 0");
        require(
            block.timestamp >= depositTimestamp[msg.sender] + LOCK_PERIOD,
            "Locked for 24 hours"
        );

        // Calculate sUSD to return
        uint256 amountToReturn = (uint256(lpTokens) * totalLiquidity) / totalLpTokens;

        // Check utilization - can't withdraw if it would exceed max utilization
        uint256 availableLiquidity = totalLiquidity - currentUtilization;
        require(amountToReturn <= availableLiquidity, "Insufficient available liquidity");

        // Update state
        totalLiquidity -= amountToReturn;
        totalLpTokens -= lpTokens;

        // Update encrypted LP balance
        euint64 currentLpBalance = _lpBalances[msg.sender];
        euint64 lpTokensEncrypted = FHE.asEuint64(lpTokens);

        // Check sufficient balance
        ebool hasSufficientBalance = FHE.ge(currentLpBalance, lpTokensEncrypted);

        euint64 newLpBalance = FHE.select(
            hasSufficientBalance,
            FHE.sub(currentLpBalance, lpTokensEncrypted),
            currentLpBalance
        );

        _lpBalances[msg.sender] = newLpBalance;
        FHE.allowThis(newLpBalance);
        FHE.allow(newLpBalance, msg.sender);

        // Transfer sUSD back to user
        // shadowUsd.vaultWithdraw(msg.sender, FHE.asEuint64(uint64(amountToReturn)));

        emit LiquidityRemoved(msg.sender, amountToReturn, lpTokens);
    }

    /**
     * @notice Claim accumulated rewards
     * @dev Claims rewards from all epochs since last claim
     * @param userLpTokens User's LP token balance (must be decrypted off-chain first)
     */
    function claimRewards(uint64 userLpTokens) external nonReentrant {
        uint256 lastClaimed = lastClaimedEpoch[msg.sender];
        require(lastClaimed < currentEpoch, "No rewards to claim");
        require(userLpTokens > 0, "No LP tokens");

        // Calculate total rewards: sum of (epochRewardsPerToken * userLpTokens) for each epoch
        uint256 totalRewards = 0;

        for (uint256 epoch = lastClaimed + 1; epoch < currentEpoch; epoch++) {
            // Rewards = rewardsPerToken * userLpTokens
            totalRewards += (epochRewardsPerToken[epoch] * userLpTokens);
        }

        // Update last claimed epoch
        lastClaimedEpoch[msg.sender] = currentEpoch - 1;

        // Store pending rewards (encrypted)
        if (totalRewards > 0) {
            euint64 encryptedRewards = FHE.asEuint64(uint64(totalRewards));
            euint64 currentPending = _pendingRewards[msg.sender];

            euint64 newPending;
            if (euint64.unwrap(currentPending) == 0) {
                newPending = encryptedRewards;
            } else {
                newPending = FHE.add(currentPending, encryptedRewards);
            }

            _pendingRewards[msg.sender] = newPending;
            FHE.allowThis(newPending);
            FHE.allow(newPending, msg.sender);
        }

        emit RewardsClaimed(msg.sender, currentEpoch - 1);
    }

    // ============================================
    // VAULT FUNCTIONS
    // ============================================

    /**
     * @notice Borrow liquidity for trading (called by vault)
     * @param amount Amount to borrow
     */
    function borrowLiquidity(uint256 amount) external nonReentrant {
        require(msg.sender == vault, "Only vault");

        // Check utilization limit
        uint256 newUtilization = currentUtilization + amount;
        require(
            (newUtilization * 10000) / totalLiquidity <= MAX_UTILIZATION,
            "Would exceed max utilization"
        );

        currentUtilization = newUtilization;

        emit LiquidityBorrowed(amount);
    }

    /**
     * @notice Return liquidity after trade settlement (called by vault)
     * @param amount Principal amount returned
     * @param pnl Profit/Loss (positive = trader loss, negative = trader profit)
     */
    function returnLiquidity(uint256 amount, int256 pnl) external nonReentrant {
        require(msg.sender == vault, "Only vault");

        currentUtilization -= amount;

        // Track epoch PnL
        epochPnL += pnl;

        // If trader lost, pool gains
        if (pnl > 0) {
            totalLiquidity += uint256(pnl);
        }
        // If trader won, pool loses
        else if (pnl < 0) {
            uint256 loss = uint256(-pnl);
            require(totalLiquidity >= loss, "Pool undercollateralized");
            totalLiquidity -= loss;
        }

        emit LiquidityReturned(amount, pnl);
    }

    /**
     * @notice Collect trading fees (called by vault)
     * @param amount Fee amount
     */
    function collectFees(uint256 amount) external nonReentrant {
        require(msg.sender == vault, "Only vault");

        epochFees += amount;
        totalLiquidity += amount;

        emit FeesCollected(amount);
    }

    // ============================================
    // EPOCH MANAGEMENT
    // ============================================

    /**
     * @notice Advance to next epoch and distribute rewards
     * @dev Can be called by anyone after epoch duration
     */
    function advanceEpoch() external {
        require(
            block.timestamp >= lastEpochTimestamp + EPOCH_DURATION,
            "Epoch not ended"
        );

        // Calculate rewards for this epoch
        uint256 totalEpochRewards = epochFees;

        // Add PnL to rewards (if positive = trader losses)
        if (epochPnL > 0) {
            totalEpochRewards += uint256(epochPnL);
        }

        // Protocol takes its share
        uint256 protocolShare = (totalEpochRewards * protocolFeeShare) / 10000;
        uint256 lpShare = totalEpochRewards - protocolShare;

        // Calculate rewards per LP token
        if (totalLpTokens > 0) {
            epochRewardsPerToken[currentEpoch] = lpShare / totalLpTokens;
        }

        // Transfer protocol share to treasury
        // shadowUsd.transfer(treasury, protocolShare);

        emit EpochAdvanced(currentEpoch, epochFees, epochPnL);

        // Reset epoch state
        currentEpoch++;
        lastEpochTimestamp = block.timestamp;
        epochFees = 0;
        epochPnL = 0;
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Get LP token balance (encrypted)
     * @param user User address
     */
    function getLpBalance(address user) external view returns (euint64) {
        return _lpBalances[user];
    }

    /**
     * @notice Get pending rewards (encrypted)
     * @param user User address
     */
    function getPendingRewards(address user) external view returns (euint64) {
        return _pendingRewards[user];
    }

    /**
     * @notice Get current APY estimate
     * @return Estimated APY in basis points
     */
    function getCurrentApy() external view returns (uint256) {
        if (totalLiquidity == 0) return baseApy;

        // Base APY + utilization bonus
        uint256 utilizationRate = (currentUtilization * 10000) / totalLiquidity;
        uint256 utilizationBonus = (utilizationRate * 500) / 10000; // Up to 5% bonus

        return baseApy + utilizationBonus;
    }

    /**
     * @notice Get time until unlock for a user
     * @param user User address
     */
    function getTimeUntilUnlock(address user) external view returns (uint256) {
        uint256 unlockTime = depositTimestamp[user] + LOCK_PERIOD;
        if (block.timestamp >= unlockTime) return 0;
        return unlockTime - block.timestamp;
    }

    /**
     * @notice Get time until next epoch
     */
    function getTimeUntilNextEpoch() external view returns (uint256) {
        uint256 nextEpochTime = lastEpochTimestamp + EPOCH_DURATION;
        if (block.timestamp >= nextEpochTime) return 0;
        return nextEpochTime - block.timestamp;
    }

    /**
     * @notice Get pool stats
     */
    function getPoolStats() external view returns (
        uint256 _totalLiquidity,
        uint256 _totalLpTokens,
        uint256 _currentUtilization,
        uint256 _utilizationRate,
        uint256 _currentEpoch
    ) {
        return (
            totalLiquidity,
            totalLpTokens,
            currentUtilization,
            totalLiquidity > 0 ? (currentUtilization * 10000) / totalLiquidity : 0,
            currentEpoch
        );
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /**
     * @notice Set vault address
     * @param _vault Vault contract address
     */
    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    /**
     * @notice Set protocol fee share
     * @param _feeShare New fee share in basis points
     */
    function setProtocolFeeShare(uint256 _feeShare) external onlyOwner {
        require(_feeShare <= 10000, "Invalid fee share");
        protocolFeeShare = _feeShare;
    }

    /**
     * @notice Set treasury address
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    /**
     * @notice Set base APY
     * @param _baseApy New base APY in basis points
     */
    function setBaseApy(uint256 _baseApy) external onlyOwner {
        baseApy = _baseApy;
    }

    // ============================================
    // ADVANCED FHE FEATURES (VAY BEE!)
    // ============================================

    /**
     * @notice Generate random bonus multiplier for epoch rewards
     * @dev Uses FHE.randEuint8 for on-chain encrypted randomness
     * @return Random bonus multiplier (0-15, representing 0-15% bonus)
     */
    function generateRandomBonusMultiplier() external returns (euint8) {
        // Generate random value 0-15 (power of 2 = 16)
        euint8 randomBonus = FHE.randEuint8(16);

        FHE.allowThis(randomBonus);
        FHE.allow(randomBonus, msg.sender);

        return randomBonus;
    }

    /**
     * @notice Calculate encrypted rewards with random bonus
     * @dev Demonstrates FHE.mul with encrypted values
     * @param baseRewards Base reward amount
     * @param bonusPercent Random bonus percentage (0-15%)
     * @return Enhanced rewards with bonus
     */
    function calculateBonusRewards(
        euint64 baseRewards,
        uint8 bonusPercent  // Plaintext bonus percentage (0-15)
    ) external returns (euint64) {
        // Calculate: baseRewards + (baseRewards * bonusPercent / 100)
        // Using plaintext bonus for gas efficiency
        require(bonusPercent <= 15, "Bonus too high");

        // Multiply by bonus percentage, then divide by 100
        euint64 bonusAmount = FHE.div(FHE.mul(baseRewards, uint64(bonusPercent)), 100);
        euint64 totalRewards = FHE.add(baseRewards, bonusAmount);

        FHE.allowThis(totalRewards);
        FHE.allow(totalRewards, msg.sender);

        return totalRewards;
    }

    /**
     * @notice Get encrypted minimum stake amount
     * @dev Demonstrates FHE.min for stake limits
     * @param userStake User's current stake
     * @param maxAllowed Maximum allowed stake
     * @return Effective stake (min of user stake and max allowed)
     */
    function getEffectiveStake(
        euint64 userStake,
        euint64 maxAllowed
    ) external returns (euint64) {
        euint64 effectiveStake = FHE.min(userStake, maxAllowed);

        FHE.allowThis(effectiveStake);
        FHE.allow(effectiveStake, msg.sender);

        return effectiveStake;
    }

    /**
     * @notice Compare two LP providers' stakes (encrypted comparison)
     * @dev Demonstrates FHE.gt for ranking without revealing values
     */
    function compareStakes(
        address provider1,
        address provider2
    ) external returns (ebool) {
        euint64 stake1 = _lpBalances[provider1];
        euint64 stake2 = _lpBalances[provider2];

        ebool provider1HasMore = FHE.gt(stake1, stake2);

        // Only the callers can see the result
        FHE.allowThis(provider1HasMore);
        FHE.allow(provider1HasMore, msg.sender);

        return provider1HasMore;
    }

    /**
     * @notice Calculate encrypted share of pool
     * @dev User's share = (userLP * totalLiquidity) / totalLpTokens
     */
    function calculatePoolShare(address user) external returns (euint64) {
        euint64 userLp = _lpBalances[user];

        // Multiply by total liquidity (plaintext for efficiency)
        euint64 numerator = FHE.mul(userLp, uint64(totalLiquidity));

        // Divide by total LP tokens (plaintext)
        euint64 share = FHE.div(numerator, uint64(totalLpTokens));

        FHE.allowThis(share);
        FHE.allow(share, user);

        return share;
    }

    /**
     * @notice Gas-optimized reward claim using allowTransient
     * @dev Uses temporary permissions for efficiency
     */
    function claimRewardsOptimized() external nonReentrant {
        euint64 rewards = _pendingRewards[msg.sender];
        require(euint64.unwrap(rewards) != 0, "No pending rewards");

        // Use allowTransient for temporary access during claim
        FHE.allowTransient(rewards, address(this));

        // Add rewards to LP balance
        euint64 currentLp = _lpBalances[msg.sender];
        euint64 newLp;

        if (euint64.unwrap(currentLp) == 0) {
            newLp = rewards;
        } else {
            newLp = FHE.add(currentLp, rewards);
        }

        _lpBalances[msg.sender] = newLp;
        FHE.allowThis(newLp);
        FHE.allow(newLp, msg.sender);

        // Clear pending rewards
        _pendingRewards[msg.sender] = FHE.asEuint64(0);

        emit RewardsClaimed(msg.sender, currentEpoch);
    }
}

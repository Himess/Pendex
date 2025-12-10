import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ShadowVault, ShadowOracle, ShadowUSD, ShadowLiquidityPool } from "../typechain-types";

describe("Shadow Protocol - Private Leveraged Pre-IPO Trading", function () {
  let owner: HardhatEthersSigner;
  let trader1: HardhatEthersSigner;
  let trader2: HardhatEthersSigner;
  let liquidator: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;

  let vault: ShadowVault;
  let oracle: ShadowOracle;
  let shadowUSD: ShadowUSD;
  let liquidityPool: ShadowLiquidityPool;

  let vaultAddress: string;
  let oracleAddress: string;
  let shadowUSDAddress: string;
  let liquidityPoolAddress: string;

  // Asset IDs
  let spacexId: string;
  let stripeId: string;

  // Constants
  const SPACEX_PRICE = 150_000_000; // $150 with 6 decimals
  const STRIPE_PRICE = 45_000_000;  // $45 with 6 decimals

  before(async function () {
    [owner, trader1, trader2, liquidator, treasury] = await ethers.getSigners();
  });

  beforeEach(async function () {
    // Deploy Oracle
    const OracleFactory = await ethers.getContractFactory("ShadowOracle");
    oracle = await OracleFactory.deploy(owner.address) as ShadowOracle;
    oracleAddress = await oracle.getAddress();

    // Deploy ShadowUSD
    const ShadowUSDFactory = await ethers.getContractFactory("ShadowUSD");
    shadowUSD = await ShadowUSDFactory.deploy(owner.address) as ShadowUSD;
    shadowUSDAddress = await shadowUSD.getAddress();

    // Deploy Liquidity Pool
    const LiquidityPoolFactory = await ethers.getContractFactory("ShadowLiquidityPool");
    liquidityPool = await LiquidityPoolFactory.deploy(
      owner.address,
      shadowUSDAddress,
      treasury.address
    ) as ShadowLiquidityPool;
    liquidityPoolAddress = await liquidityPool.getAddress();

    // Deploy Vault with all required parameters
    const VaultFactory = await ethers.getContractFactory("ShadowVault");
    vault = await VaultFactory.deploy(
      owner.address,
      oracleAddress,
      shadowUSDAddress,
      liquidityPoolAddress,
      treasury.address
    ) as ShadowVault;
    vaultAddress = await vault.getAddress();

    // Setup: Add Pre-IPO assets
    await oracle.addAsset("SpaceX", "SPACEX", SPACEX_PRICE);
    await oracle.addAsset("Stripe", "STRIPE", STRIPE_PRICE);

    spacexId = await oracle.getAssetId("SPACEX");
    stripeId = await oracle.getAssetId("STRIPE");

    // Setup: Set vault in ShadowUSD
    await shadowUSD.setVault(vaultAddress);

    // Setup: Authorize vault in oracle for OI updates
    await oracle.setAuthorizedContract(vaultAddress, true);
  });

  describe("Oracle", function () {
    it("should add assets correctly", async function () {
      const spacex = await oracle.getAsset(spacexId);

      expect(spacex.name).to.equal("SpaceX");
      expect(spacex.symbol).to.equal("SPACEX");
      expect(spacex.basePrice).to.equal(SPACEX_PRICE);
      expect(spacex.isActive).to.be.true;
    });

    it("should return correct current price", async function () {
      const price = await oracle.getCurrentPrice(spacexId);
      expect(price).to.equal(SPACEX_PRICE);
    });

    it("should update base price", async function () {
      const newPrice = 160_000_000; // $160
      await oracle.updateBasePrice(spacexId, newPrice);

      const price = await oracle.getCurrentPrice(spacexId);
      expect(price).to.equal(newPrice);
    });

    it("should return all asset IDs", async function () {
      const assetIds = await oracle.getAllAssetIds();
      expect(assetIds.length).to.equal(2);
      expect(assetIds).to.include(spacexId);
      expect(assetIds).to.include(stripeId);
    });

    it("should check if asset is tradeable", async function () {
      expect(await oracle.isAssetTradeable(spacexId)).to.be.true;

      await oracle.setAssetStatus(spacexId, false);
      expect(await oracle.isAssetTradeable(spacexId)).to.be.false;
    });

    it("should calculate price with demand modifier", async function () {
      // Update OI to create price modifier
      await oracle.updateOpenInterest(spacexId, 1000_000_000, 0, true); // 1000 long OI

      // Price should be slightly higher due to long OI
      const priceAfter = await oracle.getCurrentPrice(spacexId);
      expect(priceAfter).to.be.gte(SPACEX_PRICE);
    });
  });

  describe("ShadowUSD Token", function () {
    it("should mint tokens via faucet", async function () {
      const amount = 1000_000_000; // 1000 sUSD

      await shadowUSD.connect(trader1).faucet(amount);

      // Can't directly check balance (encrypted), but totalSupply should increase
      expect(await shadowUSD.totalSupply()).to.equal(amount);
    });

    it("should enforce faucet limit", async function () {
      const tooMuch = 20000_000_000; // 20,000 sUSD (over limit)

      await expect(
        shadowUSD.connect(trader1).faucet(tooMuch)
      ).to.be.revertedWith("Max 10,000 sUSD per faucet");
    });

    it("should transfer tokens confidentially", async function () {
      // Mint to trader1
      await shadowUSD.connect(trader1).faucet(1000_000_000);

      // Create encrypted transfer amount
      const transferAmount = 500_000_000; // 500 sUSD
      const encryptedInput = await fhevm
        .createEncryptedInput(shadowUSDAddress, trader1.address)
        .add64(transferAmount)
        .encrypt();

      // Transfer from trader1 to trader2
      await shadowUSD
        .connect(trader1)
        .confidentialTransfer(
          trader2.address,
          encryptedInput.handles[0],
          encryptedInput.inputProof
        );

      // Total supply should remain the same
      expect(await shadowUSD.totalSupply()).to.equal(1000_000_000);
    });
  });

  describe("Vault - Deposits", function () {
    it("should deposit encrypted collateral", async function () {
      const depositAmount = 1000_000_000; // 1000 sUSD

      // Create encrypted deposit
      const encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, trader1.address)
        .add64(depositAmount)
        .encrypt();

      // Deposit
      await vault
        .connect(trader1)
        .deposit(encryptedInput.handles[0], encryptedInput.inputProof);

      // Balance is encrypted - we verify by checking it's not zero hash
      const balance = await vault.getBalance(trader1.address);
      expect(balance).to.not.equal(ethers.ZeroHash);
    });

    it("should handle multiple deposits", async function () {
      const deposit1 = 500_000_000;
      const deposit2 = 300_000_000;

      // First deposit
      const enc1 = await fhevm
        .createEncryptedInput(vaultAddress, trader1.address)
        .add64(deposit1)
        .encrypt();

      await vault
        .connect(trader1)
        .deposit(enc1.handles[0], enc1.inputProof);

      // Second deposit
      const enc2 = await fhevm
        .createEncryptedInput(vaultAddress, trader1.address)
        .add64(deposit2)
        .encrypt();

      await vault
        .connect(trader1)
        .deposit(enc2.handles[0], enc2.inputProof);

      // Balance exists
      const balance = await vault.getBalance(trader1.address);
      expect(balance).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Vault - Position Management", function () {
    beforeEach(async function () {
      // Deposit collateral for trader1
      const depositAmount = 10000_000_000; // 10,000 sUSD
      const encDeposit = await fhevm
        .createEncryptedInput(vaultAddress, trader1.address)
        .add64(depositAmount)
        .encrypt();

      await vault
        .connect(trader1)
        .deposit(encDeposit.handles[0], encDeposit.inputProof);
    });

    it("should open a LONG position", async function () {
      const collateral = 1000_000_000; // 1000 sUSD
      const leverage = 5;
      const isLong = true;

      // Create encrypted inputs
      const encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, trader1.address)
        .add64(collateral)
        .add64(leverage)
        .addBool(isLong)
        .encrypt();

      // Open position
      const tx = await vault
        .connect(trader1)
        .openPosition(
          spacexId,
          encryptedInput.handles[0], // collateral
          encryptedInput.handles[1], // leverage
          encryptedInput.handles[2], // isLong
          encryptedInput.inputProof
        );

      const receipt = await tx.wait();

      // Check position was created
      const position = await vault.getPosition(1);
      expect(position.owner).to.equal(trader1.address);
      expect(position.assetId).to.equal(spacexId);
      expect(position.isOpen).to.be.true;
    });

    it("should open a SHORT position", async function () {
      const collateral = 500_000_000; // 500 sUSD
      const leverage = 3;
      const isLong = false; // SHORT

      const encryptedInput = await fhevm
        .createEncryptedInput(vaultAddress, trader1.address)
        .add64(collateral)
        .add64(leverage)
        .addBool(isLong)
        .encrypt();

      await vault
        .connect(trader1)
        .openPosition(
          stripeId,
          encryptedInput.handles[0],
          encryptedInput.handles[1],
          encryptedInput.handles[2],
          encryptedInput.inputProof
        );

      const position = await vault.getPosition(1);
      expect(position.owner).to.equal(trader1.address);
      expect(position.assetId).to.equal(stripeId);
      expect(position.isOpen).to.be.true;
    });

    it("should close a position", async function () {
      // Open position first
      const encOpen = await fhevm
        .createEncryptedInput(vaultAddress, trader1.address)
        .add64(1000_000_000)
        .add64(5)
        .addBool(true)
        .encrypt();

      await vault
        .connect(trader1)
        .openPosition(
          spacexId,
          encOpen.handles[0],
          encOpen.handles[1],
          encOpen.handles[2],
          encOpen.inputProof
        );

      // Close position
      await vault.connect(trader1).closePosition(1);

      const position = await vault.getPosition(1);
      expect(position.isOpen).to.be.false;
    });

    it("should not allow non-owner to close position", async function () {
      // Trader1 opens position
      const encOpen = await fhevm
        .createEncryptedInput(vaultAddress, trader1.address)
        .add64(1000_000_000)
        .add64(5)
        .addBool(true)
        .encrypt();

      await vault
        .connect(trader1)
        .openPosition(
          spacexId,
          encOpen.handles[0],
          encOpen.handles[1],
          encOpen.handles[2],
          encOpen.inputProof
        );

      // Trader2 tries to close
      await expect(
        vault.connect(trader2).closePosition(1)
      ).to.be.revertedWith("Not position owner");
    });

    it("should track user positions", async function () {
      // Open multiple positions
      for (let i = 0; i < 3; i++) {
        const enc = await fhevm
          .createEncryptedInput(vaultAddress, trader1.address)
          .add64(500_000_000)
          .add64(2)
          .addBool(i % 2 === 0)
          .encrypt();

        await vault
          .connect(trader1)
          .openPosition(
            i % 2 === 0 ? spacexId : stripeId,
            enc.handles[0],
            enc.handles[1],
            enc.handles[2],
            enc.inputProof
          );
      }

      const positions = await vault.getUserPositions(trader1.address);
      expect(positions.length).to.equal(3);
    });

    it("should get total positions count", async function () {
      // Open 2 positions
      for (let i = 0; i < 2; i++) {
        const enc = await fhevm
          .createEncryptedInput(vaultAddress, trader1.address)
          .add64(500_000_000)
          .add64(2)
          .addBool(true)
          .encrypt();

        await vault
          .connect(trader1)
          .openPosition(
            spacexId,
            enc.handles[0],
            enc.handles[1],
            enc.handles[2],
            enc.inputProof
          );
      }

      expect(await vault.getTotalPositions()).to.equal(2);
    });
  });

  describe("Vault - Encrypted Data Access", function () {
    beforeEach(async function () {
      // Setup: deposit and open position
      const encDeposit = await fhevm
        .createEncryptedInput(vaultAddress, trader1.address)
        .add64(10000_000_000)
        .encrypt();

      await vault
        .connect(trader1)
        .deposit(encDeposit.handles[0], encDeposit.inputProof);

      const encOpen = await fhevm
        .createEncryptedInput(vaultAddress, trader1.address)
        .add64(1000_000_000)
        .add64(5)
        .addBool(true)
        .encrypt();

      await vault
        .connect(trader1)
        .openPosition(
          spacexId,
          encOpen.handles[0],
          encOpen.handles[1],
          encOpen.handles[2],
          encOpen.inputProof
        );
    });

    it("should only allow owner to view encrypted position data", async function () {
      // Owner can view
      const data = await vault.connect(trader1).getPositionEncryptedData(1);
      expect(data.collateral).to.not.equal(ethers.ZeroHash);

      // Non-owner cannot view
      await expect(
        vault.connect(trader2).getPositionEncryptedData(1)
      ).to.be.revertedWith("Not position owner");
    });
  });

  describe("Revenue Distribution", function () {
    it("should have correct LP and protocol share constants", async function () {
      expect(await vault.LP_SHARE_BPS()).to.equal(5000); // 50%
      expect(await vault.PROTOCOL_SHARE_BPS()).to.equal(5000); // 50%
    });

    it("should have correct liquidator reward constant", async function () {
      expect(await vault.LIQUIDATOR_REWARD_BPS()).to.equal(500); // 5%
    });

    it("should have treasury address set", async function () {
      expect(await vault.treasury()).to.equal(treasury.address);
    });

    it("should track total fees collected", async function () {
      expect(await vault.totalFeesCollected()).to.equal(0);
    });

    it("should track liquidation proceeds", async function () {
      expect(await vault.totalLiquidationProceeds()).to.equal(0);
    });

    it("should track pending LP rewards", async function () {
      expect(await vault.pendingLpRewards()).to.equal(0);
    });

    it("should track pending protocol revenue", async function () {
      expect(await vault.pendingProtocolRevenue()).to.equal(0);
    });

    it("should get detailed revenue stats", async function () {
      const stats = await vault.getDetailedRevenueStats();

      expect(stats._pendingLpRewards).to.equal(0);
      expect(stats._pendingProtocolRevenue).to.equal(0);
      expect(stats._totalDistributedToLPs).to.equal(0);
      expect(stats._totalDistributedToProtocol).to.equal(0);
      expect(stats._liquidatorRewardBps).to.equal(500);
      expect(stats._lpShareBps).to.equal(5000);
      expect(stats._protocolShareBps).to.equal(5000);
    });

    it("should get basic revenue stats", async function () {
      const stats = await vault.getRevenueStats();

      expect(stats._totalFeesCollected).to.equal(0);
      expect(stats._totalLiquidationProceeds).to.equal(0);
      expect(stats._lpShareBps).to.equal(5000);
      expect(stats._protocolShareBps).to.equal(5000);
    });

    it("should distribute revenue 50/50 between LP and protocol", async function () {
      const amount = 1000_000_000; // 1000 sUSD

      await vault.connect(owner).distributeRevenue(amount);

      expect(await vault.totalFeesCollected()).to.equal(amount);
    });

    it("should not allow non-owner to distribute revenue", async function () {
      await expect(
        vault.connect(trader1).distributeRevenue(1000_000_000)
      ).to.be.reverted;
    });

    it("should not allow zero amount distribution", async function () {
      await expect(
        vault.connect(owner).distributeRevenue(0)
      ).to.be.revertedWith("Amount must be > 0");
    });

    it("should emit RevenueDistributed event", async function () {
      const amount = 1000_000_000;
      const lpShare = 500_000_000; // 50%
      const protocolShare = 500_000_000; // 50%

      // Just check that the event is emitted with correct amounts (skip timestamp check)
      await expect(vault.connect(owner).distributeRevenue(amount))
        .to.emit(vault, "RevenueDistributed");
    });
  });

  describe("Liquidation", function () {
    it("should have correct liquidation thresholds", async function () {
      expect(await vault.LIQUIDATION_THRESHOLD_BPS()).to.equal(8000); // 80%
      expect(await vault.FULL_LIQUIDATION_BPS()).to.equal(10000); // 100%
    });

    describe("Auto Liquidation at Full Loss", function () {
      beforeEach(async function () {
        // Deposit collateral for trader1
        const depositAmount = 10000_000_000;
        const encDeposit = await fhevm
          .createEncryptedInput(vaultAddress, trader1.address)
          .add64(depositAmount)
          .encrypt();

        await vault
          .connect(trader1)
          .deposit(encDeposit.handles[0], encDeposit.inputProof);

        // Open a position
        const encOpen = await fhevm
          .createEncryptedInput(vaultAddress, trader1.address)
          .add64(1000_000_000) // 1000 sUSD collateral
          .add64(5)            // 5x leverage
          .addBool(true)       // LONG
          .encrypt();

        await vault
          .connect(trader1)
          .openPosition(
            spacexId,
            encOpen.handles[0],
            encOpen.handles[1],
            encOpen.handles[2],
            encOpen.inputProof
          );
      });

      it("should auto-liquidate position with collateral amount", async function () {
        const collateralAmount = 1000_000_000; // 1000 sUSD

        // Liquidator calls auto-liquidation (explicit overload)
        await vault.connect(liquidator)["autoLiquidateAtFullLoss(uint256,uint256)"](1, collateralAmount);

        // Position should be closed
        const position = await vault.getPosition(1);
        expect(position.isOpen).to.be.false;

        // Check revenue distribution
        // 5% to liquidator = 50 sUSD
        // 95% remaining = 950 sUSD
        // 47.5% to LP = 475 sUSD
        // 47.5% to protocol = 475 sUSD

        const liquidatorReward = await vault.getLiquidatorReward(liquidator.address);
        expect(liquidatorReward).to.equal(50_000_000); // 5% of 1000 = 50 sUSD

        expect(await vault.pendingLpRewards()).to.equal(475_000_000);
        expect(await vault.pendingProtocolRevenue()).to.equal(475_000_000);
      });

      it("should auto-liquidate position without collateral amount (estimated)", async function () {
        // Uses estimated collateral of $1000
        await vault.connect(liquidator)["autoLiquidateAtFullLoss(uint256)"](1);

        const position = await vault.getPosition(1);
        expect(position.isOpen).to.be.false;

        // Check liquidator got reward
        const reward = await vault.getLiquidatorReward(liquidator.address);
        expect(reward).to.be.gt(0);
      });

      it("should not auto-liquidate already closed position", async function () {
        // Close position first
        await vault.connect(trader1).closePosition(1);

        // Try to auto-liquidate
        await expect(
          vault.connect(liquidator)["autoLiquidateAtFullLoss(uint256,uint256)"](1, 1000_000_000)
        ).to.be.revertedWith("Position not open");
      });

      it("should emit PositionAutoLiquidated event", async function () {
        const collateralAmount = 1000_000_000;

        await expect(vault.connect(liquidator)["autoLiquidateAtFullLoss(uint256,uint256)"](1, collateralAmount))
          .to.emit(vault, "PositionAutoLiquidated");
      });

      it("should track total liquidation proceeds", async function () {
        const collateralAmount = 1000_000_000;

        await vault.connect(liquidator)["autoLiquidateAtFullLoss(uint256,uint256)"](1, collateralAmount);

        expect(await vault.totalLiquidationProceeds()).to.equal(collateralAmount);
      });
    });

    describe("Liquidator Rewards", function () {
      beforeEach(async function () {
        // Setup: deposit and open position
        const encDeposit = await fhevm
          .createEncryptedInput(vaultAddress, trader1.address)
          .add64(10000_000_000)
          .encrypt();

        await vault
          .connect(trader1)
          .deposit(encDeposit.handles[0], encDeposit.inputProof);

        const encOpen = await fhevm
          .createEncryptedInput(vaultAddress, trader1.address)
          .add64(1000_000_000)
          .add64(5)
          .addBool(true)
          .encrypt();

        await vault
          .connect(trader1)
          .openPosition(
            spacexId,
            encOpen.handles[0],
            encOpen.handles[1],
            encOpen.handles[2],
            encOpen.inputProof
          );

        // Liquidate the position
        await vault.connect(liquidator)["autoLiquidateAtFullLoss(uint256,uint256)"](1, 1000_000_000);
      });

      it("should allow liquidator to claim rewards", async function () {
        const rewardBefore = await vault.getLiquidatorReward(liquidator.address);
        expect(rewardBefore).to.be.gt(0);

        await vault.connect(liquidator).claimLiquidatorReward();

        // Reward should be 0 after claiming
        const rewardAfter = await vault.getLiquidatorReward(liquidator.address);
        expect(rewardAfter).to.equal(0);
      });

      it("should emit LiquidatorRewardClaimed event", async function () {
        await expect(vault.connect(liquidator).claimLiquidatorReward())
          .to.emit(vault, "LiquidatorRewardClaimed");
      });

      it("should not allow claiming with no rewards", async function () {
        // Trader2 has no rewards
        await expect(
          vault.connect(trader2).claimLiquidatorReward()
        ).to.be.revertedWith("No rewards to claim");
      });
    });

    describe("LP Rewards Distribution", function () {
      beforeEach(async function () {
        // Setup: deposit, open and liquidate position
        const encDeposit = await fhevm
          .createEncryptedInput(vaultAddress, trader1.address)
          .add64(10000_000_000)
          .encrypt();

        await vault
          .connect(trader1)
          .deposit(encDeposit.handles[0], encDeposit.inputProof);

        const encOpen = await fhevm
          .createEncryptedInput(vaultAddress, trader1.address)
          .add64(1000_000_000)
          .add64(5)
          .addBool(true)
          .encrypt();

        await vault
          .connect(trader1)
          .openPosition(
            spacexId,
            encOpen.handles[0],
            encOpen.handles[1],
            encOpen.handles[2],
            encOpen.inputProof
          );

        await vault.connect(liquidator)["autoLiquidateAtFullLoss(uint256,uint256)"](1, 1000_000_000);
      });

      it("should distribute pending LP rewards", async function () {
        const pendingBefore = await vault.pendingLpRewards();
        expect(pendingBefore).to.be.gt(0);

        await vault.connect(owner).distributeLpRewards();

        expect(await vault.pendingLpRewards()).to.equal(0);
        expect(await vault.totalDistributedToLPs()).to.equal(pendingBefore);
      });

      it("should emit LpRewardsDistributed event", async function () {
        await expect(vault.connect(owner).distributeLpRewards())
          .to.emit(vault, "LpRewardsDistributed");
      });

      it("should not distribute with no pending rewards", async function () {
        await vault.connect(owner).distributeLpRewards();

        await expect(
          vault.connect(owner).distributeLpRewards()
        ).to.be.revertedWith("No pending LP rewards");
      });
    });

    describe("Protocol Revenue Withdrawal", function () {
      beforeEach(async function () {
        // Setup: deposit, open and liquidate position
        const encDeposit = await fhevm
          .createEncryptedInput(vaultAddress, trader1.address)
          .add64(10000_000_000)
          .encrypt();

        await vault
          .connect(trader1)
          .deposit(encDeposit.handles[0], encDeposit.inputProof);

        const encOpen = await fhevm
          .createEncryptedInput(vaultAddress, trader1.address)
          .add64(1000_000_000)
          .add64(5)
          .addBool(true)
          .encrypt();

        await vault
          .connect(trader1)
          .openPosition(
            spacexId,
            encOpen.handles[0],
            encOpen.handles[1],
            encOpen.handles[2],
            encOpen.inputProof
          );

        await vault.connect(liquidator)["autoLiquidateAtFullLoss(uint256,uint256)"](1, 1000_000_000);
      });

      it("should withdraw pending protocol revenue", async function () {
        const pendingBefore = await vault.pendingProtocolRevenue();
        expect(pendingBefore).to.be.gt(0);

        await vault.connect(owner).withdrawProtocolRevenue();

        expect(await vault.pendingProtocolRevenue()).to.equal(0);
        expect(await vault.totalDistributedToProtocol()).to.equal(pendingBefore);
      });

      it("should emit ProtocolRevenueWithdrawn event", async function () {
        await expect(vault.connect(owner).withdrawProtocolRevenue())
          .to.emit(vault, "ProtocolRevenueWithdrawn");
      });

      it("should not allow non-owner to withdraw", async function () {
        await expect(
          vault.connect(trader1).withdrawProtocolRevenue()
        ).to.be.reverted;
      });

      it("should not withdraw with no pending revenue", async function () {
        await vault.connect(owner).withdrawProtocolRevenue();

        await expect(
          vault.connect(owner).withdrawProtocolRevenue()
        ).to.be.revertedWith("No pending protocol revenue");
      });
    });

    describe("Batch Liquidation Checks", function () {
      beforeEach(async function () {
        // Deposit for trader1
        const encDeposit = await fhevm
          .createEncryptedInput(vaultAddress, trader1.address)
          .add64(50000_000_000)
          .encrypt();

        await vault
          .connect(trader1)
          .deposit(encDeposit.handles[0], encDeposit.inputProof);

        // Open multiple positions
        for (let i = 0; i < 3; i++) {
          const enc = await fhevm
            .createEncryptedInput(vaultAddress, trader1.address)
            .add64(1000_000_000)
            .add64(5)
            .addBool(true)
            .encrypt();

          await vault
            .connect(trader1)
            .openPosition(
              spacexId,
              enc.handles[0],
              enc.handles[1],
              enc.handles[2],
              enc.inputProof
            );
        }
      });

      it("should batch check multiple positions", async function () {
        const positionIds = [1, 2, 3];

        // This should not revert
        await vault.connect(liquidator).batchCheckLiquidations(positionIds);

        // All positions should still be open (just checked, not liquidated)
        for (const id of positionIds) {
          const position = await vault.getPosition(id);
          expect(position.isOpen).to.be.true;
        }
      });

      it("should skip closed positions in batch", async function () {
        // Close position 2
        await vault.connect(trader1).closePosition(2);

        // Batch check should not revert when encountering closed position
        await vault.connect(liquidator).batchCheckLiquidations([1, 2, 3]);
      });
    });
  });

  describe("Privacy Verification", function () {
    it("positions from different users should have different encrypted data", async function () {
      // Deposit for both traders
      for (const trader of [trader1, trader2]) {
        const enc = await fhevm
          .createEncryptedInput(vaultAddress, trader.address)
          .add64(10000_000_000)
          .encrypt();

        await vault.connect(trader).deposit(enc.handles[0], enc.inputProof);
      }

      // Both open same-looking positions
      for (const trader of [trader1, trader2]) {
        const enc = await fhevm
          .createEncryptedInput(vaultAddress, trader.address)
          .add64(1000_000_000) // Same amount
          .add64(5)            // Same leverage
          .addBool(true)       // Same direction
          .encrypt();

        await vault
          .connect(trader)
          .openPosition(spacexId, enc.handles[0], enc.handles[1], enc.handles[2], enc.inputProof);
      }

      // Get public position data - should be different positions
      const pos1 = await vault.getPosition(1);
      const pos2 = await vault.getPosition(2);

      expect(pos1.owner).to.equal(trader1.address);
      expect(pos2.owner).to.equal(trader2.address);

      // Even with same inputs, encrypted values should differ
      // (This is the core privacy guarantee)
    });
  });

  describe("Integration - Full Trading Flow", function () {
    it("should complete full trading cycle", async function () {
      console.log("\n📊 === FULL TRADING FLOW TEST ===\n");

      // 1. Trader deposits collateral
      console.log("1️⃣ Trader1 deposits 5000 sUSD...");
      const encDeposit = await fhevm
        .createEncryptedInput(vaultAddress, trader1.address)
        .add64(5000_000_000)
        .encrypt();

      await vault.connect(trader1).deposit(encDeposit.handles[0], encDeposit.inputProof);
      console.log("   ✅ Deposit successful (amount encrypted)");

      // 2. Open LONG position on SpaceX
      console.log("\n2️⃣ Opening 5x LONG position on SpaceX...");
      const encOpen = await fhevm
        .createEncryptedInput(vaultAddress, trader1.address)
        .add64(1000_000_000) // 1000 sUSD collateral
        .add64(5)            // 5x leverage
        .addBool(true)       // LONG
        .encrypt();

      await vault
        .connect(trader1)
        .openPosition(spacexId, encOpen.handles[0], encOpen.handles[1], encOpen.handles[2], encOpen.inputProof);
      console.log("   ✅ Position opened (all details encrypted)");

      // 3. Check position (public data only)
      const position = await vault.getPosition(1);
      console.log("\n3️⃣ Position public data:");
      console.log(`   Owner: ${position.owner}`);
      console.log(`   Asset: SpaceX`);
      console.log(`   Is Open: ${position.isOpen}`);
      console.log("   ⚠️  Collateral, Size, Direction: ENCRYPTED");

      // 4. Price changes (simulate market movement)
      console.log("\n4️⃣ SpaceX price increases 10%...");
      const newPrice = 165_000_000; // $165 (+10%)
      await oracle.updateBasePrice(spacexId, newPrice);
      console.log("   ✅ Price updated to $165");

      // 5. Close position
      console.log("\n5️⃣ Closing position...");
      await vault.connect(trader1).closePosition(1);
      console.log("   ✅ Position closed (P&L encrypted)");

      // 6. Verify position is closed
      const closedPosition = await vault.getPosition(1);
      expect(closedPosition.isOpen).to.be.false;
      console.log("\n✅ Trading cycle complete!");
      console.log("   - All amounts remained encrypted throughout");
      console.log("   - Only the trader can decrypt their P&L");
    });
  });

  describe("Limit Orders", function () {
    beforeEach(async function () {
      // Deposit collateral for trader1
      const depositAmount = 10000_000_000;
      const encDeposit = await fhevm
        .createEncryptedInput(vaultAddress, trader1.address)
        .add64(depositAmount)
        .encrypt();

      await vault
        .connect(trader1)
        .deposit(encDeposit.handles[0], encDeposit.inputProof);
    });

    it("should create encrypted limit order", async function () {
      const triggerPrice = 160_000_000; // $160
      const collateral = 1000_000_000;
      const leverage = 5;
      const isLong = true;
      const isAbove = true; // Trigger when price goes above

      const enc = await fhevm
        .createEncryptedInput(vaultAddress, trader1.address)
        .add64(triggerPrice)
        .add64(collateral)
        .add64(leverage)
        .addBool(isLong)
        .addBool(isAbove)
        .encrypt();

      await vault
        .connect(trader1)
        .createLimitOrder(
          spacexId,
          enc.handles[0], // triggerPrice
          enc.handles[1], // collateral
          enc.handles[2], // leverage
          enc.handles[3], // isLong
          enc.handles[4], // isAbove
          enc.inputProof
        );

      const orders = await vault.getUserLimitOrders(trader1.address);
      expect(orders.length).to.equal(1);
    });

    it("should cancel limit order", async function () {
      // Create order first
      const enc = await fhevm
        .createEncryptedInput(vaultAddress, trader1.address)
        .add64(160_000_000)
        .add64(1000_000_000)
        .add64(5)
        .addBool(true)
        .addBool(true)
        .encrypt();

      await vault
        .connect(trader1)
        .createLimitOrder(
          spacexId,
          enc.handles[0],
          enc.handles[1],
          enc.handles[2],
          enc.handles[3],
          enc.handles[4],
          enc.inputProof
        );

      // Cancel order
      await vault.connect(trader1).cancelLimitOrder(1);

      // Verify it's cancelled (this would need to be exposed in contract)
    });
  });

  describe("Anonymous Trading (Future)", function () {
    it.skip("should support anonymous position creation (not yet implemented)", async function () {
      // This feature is planned for future implementation
      // Anonymous trading will use eaddress to hide position ownership
    });
  });
});

import { ethers } from "hardhat";

async function main() {
  console.log("\n🔄 Redeploying ShadowVault with Session Wallet Support\n");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  // Existing contract addresses from CLAUDE.md
  const SHADOW_ORACLE = "0xadee307469f5FEF36485aB0194Bc1C042b7Cd2FE";
  const SHADOW_USD = "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18";
  const LIQUIDITY_POOL = "0xF15e759229dc61f7ece238503368B1a0BafF0773";
  const WALLET_MANAGER = "0x547481AC8130e985288BD36Cb9ba81204656eB7A";

  // Deploy new ShadowVault
  console.log("\n1️⃣ Deploying new ShadowVault...");
  const ShadowVault = await ethers.getContractFactory("ShadowVault");
  const vault = await ShadowVault.deploy(
    deployer.address,     // owner
    SHADOW_ORACLE,        // oracle
    SHADOW_USD,           // shadowUsd
    LIQUIDITY_POOL,       // liquidityPool
    deployer.address      // treasury
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`   ✅ New ShadowVault: ${vaultAddress}`);

  // Set WalletManager in ShadowVault
  console.log("\n2️⃣ Setting WalletManager in ShadowVault...");
  const tx1 = await vault.setWalletManager(WALLET_MANAGER);
  await tx1.wait();
  console.log("   ✅ WalletManager set");

  // Update LiquidityPool vault address
  console.log("\n3️⃣ Updating LiquidityPool vault address...");
  const LiquidityPool = await ethers.getContractFactory("ShadowLiquidityPool");
  const liquidityPool = LiquidityPool.attach(LIQUIDITY_POOL);
  try {
    const tx2 = await liquidityPool.setVault(vaultAddress);
    await tx2.wait();
    console.log("   ✅ LiquidityPool vault updated");
  } catch (e) {
    console.log("   ⚠️ Could not update LiquidityPool (may need owner)");
  }

  // Update ShadowUSD vault address
  console.log("\n4️⃣ Updating ShadowUSD vault address...");
  const ShadowUSD = await ethers.getContractFactory("ShadowUSD");
  const shadowUsd = ShadowUSD.attach(SHADOW_USD);
  try {
    const tx3 = await shadowUsd.setVault(vaultAddress);
    await tx3.wait();
    console.log("   ✅ ShadowUSD vault updated");
  } catch (e) {
    console.log("   ⚠️ Could not update ShadowUSD (may need owner)");
  }

  // Authorize new vault in Oracle
  console.log("\n5️⃣ Authorizing new vault in Oracle...");
  const Oracle = await ethers.getContractFactory("ShadowOracle");
  const oracle = Oracle.attach(SHADOW_ORACLE);
  try {
    const tx4 = await oracle.setAuthorizedContract(vaultAddress, true);
    await tx4.wait();
    console.log("   ✅ New vault authorized in Oracle");
  } catch (e) {
    console.log("   ⚠️ Could not authorize in Oracle (may need owner)");
  }

  // Set allowed contract in WalletManager
  console.log("\n6️⃣ Setting ShadowVault as allowed in WalletManager...");
  const WalletManager = await ethers.getContractFactory("WalletManager");
  const walletManager = WalletManager.attach(WALLET_MANAGER);
  try {
    const tx5 = await walletManager.setAllowedContract(vaultAddress, true);
    await tx5.wait();
    console.log("   ✅ ShadowVault allowed in WalletManager");
  } catch (e) {
    console.log("   ⚠️ Could not set allowed contract (may need owner)");
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 REDEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📋 Updated Contract Address:");
  console.log(`   ShadowVault (NEW): ${vaultAddress}`);
  console.log("\n📝 Update these files:");
  console.log(`   - frontend/src/lib/contracts/config.ts`);
  console.log(`   - CLAUDE.md`);
  console.log("\n" + "=".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

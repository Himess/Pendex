import { ethers } from "hardhat";

async function main() {
  const SHADOW_ORACLE = "0xadee307469f5FEF36485aB0194Bc1C042b7Cd2FE";
  const SHADOW_VAULT = "0x8bD67c72b563A28C6B917Ad3dC09cF39FB58b292"; // v2 with FHE ACL fix
  const SHADOW_USD = "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18";
  const SHADOW_LP = "0xF15e759229dc61f7ece238503368B1a0BafF0773";

  console.log("=== Checking Contract Configuration ===\n");

  // 1. Check ShadowUSD vault
  console.log("1. Checking ShadowUSD vault...");
  const shadowUSD = await ethers.getContractAt("ShadowUSD", SHADOW_USD);
  const vault = await shadowUSD.vault();
  console.log(`   Current vault: ${vault}`);
  console.log(`   Expected:      ${SHADOW_VAULT}`);
  console.log(`   Status: ${vault.toLowerCase() === SHADOW_VAULT.toLowerCase() ? "✅ OK" : "❌ MISMATCH"}`);

  // 2. Check Oracle authorization
  console.log("\n2. Checking Oracle authorization...");
  const oracle = await ethers.getContractAt("ShadowOracle", SHADOW_ORACLE);
  const vaultAuthorized = await oracle.authorizedContracts(SHADOW_VAULT);
  console.log(`   Vault authorized: ${vaultAuthorized ? "✅ YES" : "❌ NO"}`);

  if (!vaultAuthorized) {
    console.log("   ⚠️ Authorizing vault in Oracle...");
    const tx = await oracle.setAuthorizedContract(SHADOW_VAULT, true);
    await tx.wait();
    console.log("   ✅ Vault authorized!");
  }

  // 3. Check if SpaceX is tradeable
  console.log("\n3. Checking asset tradeability...");
  const spacexId = ethers.keccak256(ethers.toUtf8Bytes("SPACEX"));
  console.log(`   SpaceX asset ID: ${spacexId}`);

  try {
    const isTradeable = await oracle.isAssetTradeable(spacexId);
    console.log(`   SpaceX tradeable: ${isTradeable ? "✅ YES" : "❌ NO"}`);

    // Get price
    const price = await oracle.getPrice(spacexId);
    console.log(`   SpaceX price: $${Number(price) / 1e6}`);
  } catch (e: any) {
    console.log(`   ❌ Error: ${e.message}`);
  }

  // 4. Check LiquidityPool vault
  console.log("\n4. Checking LiquidityPool vault...");
  const liquidityPool = await ethers.getContractAt("ShadowLiquidityPool", SHADOW_LP);
  const lpVault = await liquidityPool.vault();
  console.log(`   LP vault: ${lpVault}`);
  console.log(`   Expected: ${SHADOW_VAULT}`);
  console.log(`   Status: ${lpVault.toLowerCase() === SHADOW_VAULT.toLowerCase() ? "✅ OK" : "❌ MISMATCH"}`);

  if (lpVault.toLowerCase() !== SHADOW_VAULT.toLowerCase()) {
    console.log("   ⚠️ Setting vault in LiquidityPool...");
    const tx = await liquidityPool.setVault(SHADOW_VAULT);
    await tx.wait();
    console.log("   ✅ Vault set in LiquidityPool!");
  }

  // 5. List all available assets
  console.log("\n5. Listing all assets...");
  const assetCount = await oracle.getAssetCount();
  console.log(`   Total assets: ${assetCount}`);

  for (let i = 0; i < Number(assetCount); i++) {
    const assetId = await oracle.assetIds(i);
    const asset = await oracle.assets(assetId);
    console.log(`   [${i}] ${asset.symbol}: $${Number(asset.price) / 1e6} (tradeable: ${asset.isTradeable})`);
  }

  console.log("\n=== Check Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

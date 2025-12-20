import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ShadowVault with:", deployer.address);

  // Existing contract addresses
  const SHADOW_ORACLE = "0xadee307469f5FEF36485aB0194Bc1C042b7Cd2FE";
  const SHADOW_USD = "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18";
  const SHADOW_LP = "0xF15e759229dc61f7ece238503368B1a0BafF0773";
  const TREASURY = deployer.address;

  console.log("\n1. Deploying new ShadowVault...");
  const ShadowVault = await ethers.getContractFactory("ShadowVault");
  const vault = await ShadowVault.deploy(
    deployer.address, // owner
    SHADOW_ORACLE,
    SHADOW_USD,
    SHADOW_LP,
    TREASURY
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`   ✅ New ShadowVault: ${vaultAddress}`);

  console.log("\n2. Updating ShadowUSD vault reference...");
  const shadowUsd = await ethers.getContractAt("ShadowUSD", SHADOW_USD);
  const tx1 = await shadowUsd.setVault(vaultAddress);
  await tx1.wait();
  console.log("   ✅ ShadowUSD vault updated");

  console.log("\n3. Updating LiquidityPool vault reference...");
  const liquidityPool = await ethers.getContractAt("ShadowLiquidityPool", SHADOW_LP);
  const tx2 = await liquidityPool.setVault(vaultAddress);
  await tx2.wait();
  console.log("   ✅ LiquidityPool vault updated");

  console.log("\n4. Authorizing vault in Oracle...");
  const oracle = await ethers.getContractAt("ShadowOracle", SHADOW_ORACLE);
  const tx3 = await oracle.setAuthorizedContract(vaultAddress, true);
  await tx3.wait();
  console.log("   ✅ Vault authorized in Oracle");

  console.log("\n=== DONE ===");
  console.log(`New ShadowVault: ${vaultAddress}`);
  console.log("\nUpdate frontend config.ts with this address!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

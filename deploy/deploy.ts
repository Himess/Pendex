import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("\n🚀 Deploying Shadow Protocol - Private Leveraged Pre-IPO Trading\n");
  console.log(`Deployer: ${deployer}`);

  // 1. Deploy ShadowOracle
  console.log("\n1️⃣ Deploying ShadowOracle...");
  const oracleDeployment = await deploy("ShadowOracle", {
    from: deployer,
    args: [deployer],
    log: true,
  });
  console.log(`   ✅ ShadowOracle: ${oracleDeployment.address}`);

  // 2. Deploy ShadowUSD
  console.log("\n2️⃣ Deploying ShadowUSD...");
  const shadowUSDDeployment = await deploy("ShadowUSD", {
    from: deployer,
    args: [deployer],
    log: true,
  });
  console.log(`   ✅ ShadowUSD: ${shadowUSDDeployment.address}`);

  // 3. Deploy ShadowLiquidityPool
  console.log("\n3️⃣ Deploying ShadowLiquidityPool...");
  const liquidityPoolDeployment = await deploy("ShadowLiquidityPool", {
    from: deployer,
    args: [deployer, shadowUSDDeployment.address, deployer], // owner, shadowUsd, treasury
    log: true,
  });
  console.log(`   ✅ ShadowLiquidityPool: ${liquidityPoolDeployment.address}`);

  // 4. Deploy ShadowVault
  console.log("\n4️⃣ Deploying ShadowVault...");
  const vaultDeployment = await deploy("ShadowVault", {
    from: deployer,
    args: [deployer, oracleDeployment.address, shadowUSDDeployment.address, liquidityPoolDeployment.address, deployer], // deployer as treasury
    log: true,
  });
  console.log(`   ✅ ShadowVault: ${vaultDeployment.address}`);

  // 4. Setup: Add Pre-IPO Assets (Based on Q3 2025 Setter 30 List)
  console.log("\n4️⃣ Adding Pre-IPO Assets...");

  const oracle = await hre.ethers.getContractAt("ShadowOracle", oracleDeployment.address);

  // Categories: 0=AI, 1=AEROSPACE, 2=FINTECH, 3=DATA, 4=SOCIAL

  // ============================================
  // 🤖 AI & MACHINE LEARNING (Category: 0)
  // ============================================
  console.log("\n   🤖 AI & Machine Learning:");

  await oracle.addAssetWithCategory("OpenAI", "OPENAI", 250_000_000, 0);
  console.log("      ✅ OpenAI @ $250");

  await oracle.addAssetWithCategory("Anthropic", "ANTHROPIC", 95_000_000, 0);
  console.log("      ✅ Anthropic @ $95");

  await oracle.addAssetWithCategory("xAI", "XAI", 60_000_000, 0);
  console.log("      ✅ xAI @ $60");

  await oracle.addAssetWithCategory("Perplexity", "PERPLEXITY", 12_000_000, 0);
  console.log("      ✅ Perplexity @ $12");

  await oracle.addAssetWithCategory("Groq", "GROQ", 4_500_000, 0);
  console.log("      ✅ Groq @ $4.50");

  // ============================================
  // 🚀 AEROSPACE & DEFENSE (Category: 1)
  // ============================================
  console.log("\n   🚀 Aerospace & Defense:");

  await oracle.addAssetWithCategory("SpaceX", "SPACEX", 180_000_000, 1);
  console.log("      ✅ SpaceX @ $180");

  await oracle.addAssetWithCategory("Anduril", "ANDURIL", 16_000_000, 1);
  console.log("      ✅ Anduril @ $16");

  await oracle.addAssetWithCategory("Shield AI", "SHIELDAI", 3_200_000, 1);
  console.log("      ✅ Shield AI @ $3.20");

  // ============================================
  // 💳 FINTECH & PAYMENTS (Category: 2)
  // ============================================
  console.log("\n   💳 FinTech & Payments:");

  await oracle.addAssetWithCategory("Stripe", "STRIPE", 48_000_000, 2);
  console.log("      ✅ Stripe @ $48");

  await oracle.addAssetWithCategory("Revolut", "REVOLUT", 24_000_000, 2);
  console.log("      ✅ Revolut @ $24");

  await oracle.addAssetWithCategory("Ripple", "RIPPLE", 8_500_000, 2);
  console.log("      ✅ Ripple @ $8.50");

  await oracle.addAssetWithCategory("Kraken", "KRAKEN", 8_000_000, 2);
  console.log("      ✅ Kraken @ $8");

  // ============================================
  // 📊 DATA & ENTERPRISE (Category: 3)
  // ============================================
  console.log("\n   📊 Data & Enterprise:");

  await oracle.addAssetWithCategory("Databricks", "DATABRICKS", 55_000_000, 3);
  console.log("      ✅ Databricks @ $55");

  await oracle.addAssetWithCategory("Canva", "CANVA", 22_000_000, 3);
  console.log("      ✅ Canva @ $22");

  await oracle.addAssetWithCategory("Vercel", "VERCEL", 5_500_000, 3);
  console.log("      ✅ Vercel @ $5.50");

  // ============================================
  // 📱 SOCIAL & CONSUMER (Category: 4)
  // ============================================
  console.log("\n   📱 Social & Consumer:");

  await oracle.addAssetWithCategory("ByteDance", "BYTEDANCE", 165_000_000, 4);
  console.log("      ✅ ByteDance @ $165");

  await oracle.addAssetWithCategory("Discord", "DISCORD", 9_000_000, 4);
  console.log("      ✅ Discord @ $9");

  // 5. Configure LiquidityPool vault
  console.log("\n5️⃣ Configuring LiquidityPool...");
  const liquidityPool = await hre.ethers.getContractAt("ShadowLiquidityPool", liquidityPoolDeployment.address);
  await liquidityPool.setVault(vaultDeployment.address);
  console.log("   ✅ Vault address set in LiquidityPool");

  // 6. Setup ShadowUSD vault
  console.log("\n6️⃣ Configuring ShadowUSD...");
  const shadowUSD = await hre.ethers.getContractAt("ShadowUSD", shadowUSDDeployment.address);
  await shadowUSD.setVault(vaultDeployment.address);
  console.log("   ✅ Vault address set in ShadowUSD");

  // 7. Deploy ShadowMarketMaker
  console.log("\n7️⃣ Deploying ShadowMarketMaker (On-Chain Bot)...");
  const marketMakerDeployment = await deploy("ShadowMarketMaker", {
    from: deployer,
    args: [deployer, oracleDeployment.address],
    log: true,
  });
  console.log(`   ✅ ShadowMarketMaker: ${marketMakerDeployment.address}`);

  // 8. Authorize contracts in Oracle
  console.log("\n8️⃣ Authorizing contracts in Oracle...");
  await oracle.setAuthorizedContract(vaultDeployment.address, true);
  console.log("   ✅ ShadowVault authorized");
  await oracle.setAuthorizedContract(marketMakerDeployment.address, true);
  console.log("   ✅ ShadowMarketMaker authorized");

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("\n📋 Contract Addresses:");
  console.log(`   ShadowOracle:        ${oracleDeployment.address}`);
  console.log(`   ShadowVault:         ${vaultDeployment.address}`);
  console.log(`   ShadowUSD:           ${shadowUSDDeployment.address}`);
  console.log(`   ShadowLiquidityPool: ${liquidityPoolDeployment.address}`);
  console.log(`   ShadowMarketMaker:   ${marketMakerDeployment.address}`);
  console.log("\n📊 Pre-IPO Assets (Q3 2025 Setter 30):");
  console.log("\n   🤖 AI & ML:");
  console.log("      OPENAI @ $250 | ANTHROPIC @ $95 | XAI @ $60");
  console.log("      PERPLEXITY @ $12 | GROQ @ $4.50");
  console.log("\n   🚀 Aerospace & Defense:");
  console.log("      SPACEX @ $180 | ANDURIL @ $16 | SHIELDAI @ $3.20");
  console.log("\n   💳 FinTech:");
  console.log("      STRIPE @ $48 | REVOLUT @ $24 | RIPPLE @ $8.50 | KRAKEN @ $8");
  console.log("\n   📊 Data & Enterprise:");
  console.log("      DATABRICKS @ $55 | CANVA @ $22 | VERCEL @ $5.50");
  console.log("\n   📱 Social & Consumer:");
  console.log("      BYTEDANCE @ $165 | DISCORD @ $9");
  console.log("\n" + "=".repeat(60));
  console.log("🔐 All trades are FULLY ENCRYPTED with FHE");
  console.log("👁️ No one can see your positions, leverage, or P&L");
  console.log("=".repeat(60));
  console.log("\n🤖 Market Maker Bot Commands:");
  console.log("   npx hardhat run scripts/runBot.ts --network zama");
  console.log("   npx hardhat run scripts/runBot.ts --network sepolia");
  console.log("=".repeat(60) + "\n");
};

export default func;
func.id = "deploy_shadow_protocol";
func.tags = ["ShadowProtocol"];

// Deploy ShadowMarketMakerSimple contract for Sepolia (no FHE)
import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const oracleAddress = "0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17";
  const vaultAddress = "0xf6C0B8C7332080790a9425c0B888F74e8e9ff5B5";

  // Deploy ShadowMarketMakerSimple
  console.log("\nDeploying ShadowMarketMakerSimple...");
  const MarketMaker = await hre.ethers.getContractFactory("ShadowMarketMakerSimple");
  const marketMaker = await MarketMaker.deploy(deployer.address, oracleAddress);
  await marketMaker.waitForDeployment();
  const marketMakerAddress = await marketMaker.getAddress();
  console.log("ShadowMarketMakerSimple deployed to:", marketMakerAddress);

  // Authorize MarketMaker in Oracle
  console.log("\nAuthorizing MarketMaker in Oracle...");
  const oracle = await hre.ethers.getContractAt("ShadowOracle", oracleAddress);
  const tx1 = await oracle.setAuthorizedContract(marketMakerAddress, true);
  await tx1.wait();
  console.log("MarketMaker authorized!");

  console.log("\n===========================================");
  console.log("DEPLOYMENT COMPLETE!");
  console.log("===========================================");
  console.log("ShadowOracle:             ", oracleAddress);
  console.log("ShadowVault:              ", vaultAddress);
  console.log("ShadowMarketMakerSimple:  ", marketMakerAddress);
  console.log("===========================================");
  console.log("\nRun the bot with:");
  console.log(`MARKET_MAKER_ADDRESS=${marketMakerAddress} ORACLE_ADDRESS=${oracleAddress} npx hardhat run scripts/runBotSimple.ts --network sepolia`);
}

main().catch(console.error);

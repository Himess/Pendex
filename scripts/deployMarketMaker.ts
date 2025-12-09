// Deploy only MarketMaker contract
import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const oracleAddress = "0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17";
  const vaultAddress = "0xf6C0B8C7332080790a9425c0B888F74e8e9ff5B5";

  // Deploy MarketMaker
  console.log("\nDeploying ShadowMarketMaker...");
  const MarketMaker = await hre.ethers.getContractFactory("ShadowMarketMaker");
  const marketMaker = await MarketMaker.deploy(deployer.address, oracleAddress);
  await marketMaker.waitForDeployment();
  const marketMakerAddress = await marketMaker.getAddress();
  console.log("ShadowMarketMaker deployed to:", marketMakerAddress);

  // Authorize MarketMaker in Oracle
  console.log("\nAuthorizing MarketMaker in Oracle...");
  const oracle = await hre.ethers.getContractAt("ShadowOracle", oracleAddress);
  const tx1 = await oracle.setAuthorizedContract(marketMakerAddress, true);
  await tx1.wait();
  console.log("MarketMaker authorized!");

  // Authorize Vault in Oracle (if not already)
  console.log("\nAuthorizing Vault in Oracle...");
  const tx2 = await oracle.setAuthorizedContract(vaultAddress, true);
  await tx2.wait();
  console.log("Vault authorized!");

  console.log("\n===========================================");
  console.log("DEPLOYMENT COMPLETE!");
  console.log("===========================================");
  console.log("ShadowOracle:        ", oracleAddress);
  console.log("ShadowVault:         ", vaultAddress);
  console.log("ShadowMarketMaker:   ", marketMakerAddress);
  console.log("===========================================");
}

main().catch(console.error);

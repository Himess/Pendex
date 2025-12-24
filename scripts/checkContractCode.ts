/**
 * Check if contracts exist at their addresses
 */

import { ethers } from "hardhat";

const CONTRACTS = {
  ShadowOracle: "0xadee307469f5FEF36485aB0194Bc1C042b7Cd2FE",
  ShadowUSD: "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18",
  ShadowVault: "0x1713d51049EA31c19545De7f47AcB909e1050a71",
  ShadowLiquidityPool: "0xF15e759229dc61f7ece238503368B1a0BafF0773",
  WalletManager: "0x547481AC8130e985288BD36Cb9ba81204656eB7A",
};

async function main() {
  console.log("\n🔍 Checking contract code at addresses\n");
  console.log("=".repeat(70));

  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  for (const [name, address] of Object.entries(CONTRACTS)) {
    try {
      const code = await provider.getCode(address);
      const hasCode = code !== "0x" && code.length > 2;

      console.log(`${name.padEnd(20)} | ${address} | ${hasCode ? '✅ Has code' : '❌ NO CODE'}`);

      if (hasCode) {
        console.log(`                       Code length: ${code.length} chars`);
      }
    } catch (error) {
      console.log(`${name.padEnd(20)} | ${address} | ❌ Error: ${error}`);
    }
  }

  console.log("\n" + "=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import { ethers } from "hardhat";

async function main() {
  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  const VAULT = "0x1713d51049EA31c19545De7f47AcB909e1050a71";

  const code = await provider.getCode(VAULT);
  console.log("Vault code length:", code.length);
  console.log("Has code:", code !== "0x");

  // Try direct low-level call to walletManager()
  const walletManagerSelector = "0x63d5ab8d"; // keccak256("walletManager()")[:4]

  try {
    const result = await provider.call({
      to: VAULT,
      data: walletManagerSelector
    });
    console.log("walletManager() raw result:", result);
  } catch (e: any) {
    console.log("walletManager() call failed:", e.message);
  }

  // Try oracle()
  const oracleSelector = "0x7dc0d1d0"; // keccak256("oracle()")[:4]
  try {
    const result = await provider.call({
      to: VAULT,
      data: oracleSelector
    });
    console.log("oracle() raw result:", result);
  } catch (e: any) {
    console.log("oracle() call failed:", e.message);
  }
}

main().catch(console.error);

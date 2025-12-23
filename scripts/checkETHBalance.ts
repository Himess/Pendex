import { ethers } from "hardhat";

async function main() {
  const SESSION_WALLET = "0x69926ACCa7239B7d83E84502E3aB9025355Cd027";
  const MAIN_WALLET = "0xF46b0357A6CD11935a8B5e17c329F24544eF316F";

  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  console.log("\n⛽ ETH Bakiye Kontrolü (Gas için)\n");

  const sessionBalance = await provider.getBalance(SESSION_WALLET);
  const mainBalance = await provider.getBalance(MAIN_WALLET);

  console.log(`Session Wallet: ${ethers.formatEther(sessionBalance)} ETH`);
  console.log(`Main Wallet:    ${ethers.formatEther(mainBalance)} ETH`);

  if (Number(ethers.formatEther(sessionBalance)) < 0.01) {
    console.log("\n⚠️ Session wallet'ta gas için ETH az olabilir!");
  }
}

main().then(() => process.exit(0)).catch(console.error);

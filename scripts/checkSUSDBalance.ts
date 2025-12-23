import { ethers } from "hardhat";

async function main() {
  console.log("\n💰 sUSD Bakiye Kontrolü\n");
  console.log("=".repeat(60));

  // Contract addresses
  const SHADOW_USD = "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18";
  const MAIN_WALLET = "0xF46b0357A6CD11935a8B5e17c329F24544eF316F";
  const SESSION_WALLET = "0x69926ACCa7239B7d83E84502E3aB9025355Cd027";
  const SHADOW_VAULT = "0x0EBC28B9e41474c015Aab15B9a2046F4d54FD3D6";

  // ERC20 ABI for balance check
  const erc20ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function allowance(address owner, address spender) view returns (uint256)",
  ];

  // Connect to Sepolia
  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  const sUSD = new ethers.Contract(SHADOW_USD, erc20ABI, provider);

  // Get decimals
  const decimals = await sUSD.decimals();
  const symbol = await sUSD.symbol();
  console.log(`Token: ${symbol} (${decimals} decimals)`);

  // Check main wallet balance
  console.log("\n" + "=".repeat(60));
  console.log("1️⃣  Main Wallet sUSD Bakiyesi");
  console.log("=".repeat(60));

  const mainBalance = await sUSD.balanceOf(MAIN_WALLET);
  const mainBalanceFormatted = ethers.formatUnits(mainBalance, decimals);
  console.log(`   Adres: ${MAIN_WALLET}`);
  console.log(`   Bakiye: ${mainBalanceFormatted} ${symbol}`);

  if (Number(mainBalanceFormatted) === 0) {
    console.log("   ❌ SORUN: Main wallet'ta sUSD YOK!");
    console.log("   📝 Çözüm: Faucet'ten sUSD al");
  } else if (Number(mainBalanceFormatted) < 100) {
    console.log("   ⚠️ Düşük bakiye! Minimum trade $100");
  } else {
    console.log("   ✅ Bakiye yeterli");
  }

  // Check session wallet balance
  console.log("\n" + "=".repeat(60));
  console.log("2️⃣  Session Wallet sUSD Bakiyesi");
  console.log("=".repeat(60));

  const sessionBalance = await sUSD.balanceOf(SESSION_WALLET);
  const sessionBalanceFormatted = ethers.formatUnits(sessionBalance, decimals);
  console.log(`   Adres: ${SESSION_WALLET}`);
  console.log(`   Bakiye: ${sessionBalanceFormatted} ${symbol}`);

  // Check allowance (main wallet → ShadowVault)
  console.log("\n" + "=".repeat(60));
  console.log("3️⃣  sUSD Allowance (Main Wallet → ShadowVault)");
  console.log("=".repeat(60));

  const allowance = await sUSD.allowance(MAIN_WALLET, SHADOW_VAULT);
  const allowanceFormatted = ethers.formatUnits(allowance, decimals);
  console.log(`   Owner: ${MAIN_WALLET.slice(0, 10)}...`);
  console.log(`   Spender: ${SHADOW_VAULT.slice(0, 10)}... (ShadowVault)`);
  console.log(`   Allowance: ${allowanceFormatted} ${symbol}`);

  if (Number(allowanceFormatted) === 0) {
    console.log("   ❌ SORUN: Allowance YOK! ShadowVault sUSD çekemez!");
    console.log("   📝 Çözüm: sUSD.approve(ShadowVault, amount) çağrılmalı");
  } else {
    console.log("   ✅ Allowance var");
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 ÖZET");
  console.log("=".repeat(60));
  console.log(`   Main Wallet Bakiye: ${mainBalanceFormatted} ${symbol}`);
  console.log(`   ShadowVault Allowance: ${allowanceFormatted} ${symbol}`);

  if (Number(mainBalanceFormatted) === 0) {
    console.log("\n   🚨 ASIL SORUN: Main wallet'ta sUSD yok!");
    console.log("   → Faucet'ten sUSD alın");
  } else if (Number(allowanceFormatted) === 0) {
    console.log("\n   🚨 ASIL SORUN: Allowance yok!");
    console.log("   → sUSD.approve(ShadowVault, MAX) çağrılmalı");
  } else if (Number(allowanceFormatted) < Number(mainBalanceFormatted)) {
    console.log("\n   ⚠️ Allowance bakiyeden düşük, büyük trade'ler fail olabilir");
  } else {
    console.log("\n   ✅ Her şey yolunda görünüyor!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

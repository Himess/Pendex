import { ethers } from "hardhat";

async function main() {
  console.log("\n💰 Detaylı sUSD Bakiye Kontrolü\n");
  console.log("=".repeat(60));

  const SHADOW_USD = "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18";
  const MAIN_WALLET = "0xF46b0357A6CD11935a8B5e17c329F24544eF316F";
  const SHADOW_VAULT = "0x0EBC28B9e41474c015Aab15B9a2046F4d54FD3D6";

  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  const sUsdABI = [
    "function totalSupply() view returns (uint256)",
    "function isBalanceInitialized(address) view returns (bool)",
    "function vault() view returns (address)",
  ];

  const sUSD = new ethers.Contract(SHADOW_USD, sUsdABI, provider);

  console.log("1️⃣  Total Supply");
  try {
    const totalSupply = await sUSD.totalSupply();
    console.log(`   Total Supply: ${ethers.formatUnits(totalSupply, 6)} sUSD`);
  } catch (e: any) {
    console.log(`   Hata: ${e.message}`);
  }

  console.log("\n2️⃣  Main Wallet Balance Initialized?");
  try {
    const isInit = await sUSD.isBalanceInitialized(MAIN_WALLET);
    console.log(`   isBalanceInitialized: ${isInit}`);
    if (!isInit) {
      console.log("   ❌ SORUN: Main wallet bakiyesi initialized değil!");
      console.log("   📝 Çözüm: Faucet'ten sUSD al");
    }
  } catch (e: any) {
    console.log(`   Hata: ${e.message}`);
  }

  console.log("\n3️⃣  Vault Balance Initialized?");
  try {
    const isVaultInit = await sUSD.isBalanceInitialized(SHADOW_VAULT);
    console.log(`   Vault balance initialized: ${isVaultInit}`);
  } catch (e: any) {
    console.log(`   Hata: ${e.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 SONUÇ");
  console.log("=".repeat(60));
  console.log("\n⚠️ sUSD encrypted olduğu için gerçek bakiyeyi göremiyoruz.");
  console.log("Bakiyeyi görmek için frontend'de 'Decrypt Balance' butonuna tıkla.");
  console.log("\nEğer bakiye 0 veya yetersizse:");
  console.log("1. /wallet sayfasına git");
  console.log("2. Faucet'ten sUSD al (max 10,000 sUSD)");
  console.log("3. Trade'i tekrar dene");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

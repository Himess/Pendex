/**
 * Debug ShadowUSD Configuration
 *
 * Checks:
 * 1. ShadowUSD vault address
 * 2. Main wallet FHE balance (via isBalanceInitialized)
 * 3. Vault's sUSD balance
 */

import { ethers } from "hardhat";

// Contract addresses
const SHADOW_USD = "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18";
const SHADOW_VAULT = "0x1713d51049EA31c19545De7f47AcB909e1050a71";

// Wallet addresses
const MAIN_WALLET = "0xF46b0357A6CD11935a8B5e17c329F24544eF316F";

async function main() {
  console.log("\n🔍 DEBUG: ShadowUSD Configuration\n");
  console.log("=".repeat(70));

  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  const susdAbi = [
    "function vault() view returns (address)",
    "function totalSupply() view returns (uint256)",
    "function isBalanceInitialized(address) view returns (bool)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)"
  ];

  const susd = new ethers.Contract(SHADOW_USD, susdAbi, provider);

  // Check 1: Contract exists and has correct interface
  console.log("\n📋 CHECK 1: ShadowUSD contract info");
  console.log("-".repeat(50));

  try {
    const name = await susd.name();
    const symbol = await susd.symbol();
    const decimals = await susd.decimals();
    const totalSupply = await susd.totalSupply();

    console.log(`   Contract: ${SHADOW_USD}`);
    console.log(`   Name: ${name}`);
    console.log(`   Symbol: ${symbol}`);
    console.log(`   Decimals: ${decimals}`);
    console.log(`   Total Supply: ${ethers.formatUnits(totalSupply, 6)} ${symbol}`);
    console.log(`   ✅ Contract exists and has correct interface`);
  } catch (error) {
    console.log(`   ❌ Error reading contract: ${error}`);
    console.log(`   → Contract might not exist at this address!`);
    return;
  }

  // Check 2: Vault address
  console.log("\n📋 CHECK 2: ShadowUSD vault address");
  console.log("-".repeat(50));

  try {
    const vault = await susd.vault();
    console.log(`   vault() returns: ${vault}`);

    if (vault === ethers.ZeroAddress) {
      console.log(`   ❌ PROBLEM: vault is NOT SET (address(0))`);
      console.log(`   → vaultDeposit() will fail with "Only vault"`);
      console.log(`   → Owner must call shadowUsd.setVault(${SHADOW_VAULT})`);
    } else if (vault.toLowerCase() === SHADOW_VAULT.toLowerCase()) {
      console.log(`   ✅ vault is correctly set to ShadowVault`);
    } else {
      console.log(`   ⚠️ vault is set to different address: ${vault}`);
      console.log(`   → Expected: ${SHADOW_VAULT}`);
    }
  } catch (error) {
    console.log(`   ❌ Error calling vault(): ${error}`);
  }

  // Check 3: Main wallet balance initialized
  console.log("\n📋 CHECK 3: Main wallet FHE balance initialized");
  console.log("-".repeat(50));

  try {
    const isInit = await susd.isBalanceInitialized(MAIN_WALLET);
    console.log(`   Main wallet: ${MAIN_WALLET}`);
    console.log(`   isBalanceInitialized(): ${isInit}`);

    if (!isInit) {
      console.log(`   ❌ PROBLEM: Main wallet has NO sUSD balance!`);
      console.log(`   → _transfer will fail with "Insufficient balance"`);
      console.log(`   → Main wallet must get sUSD from faucet first`);
    } else {
      console.log(`   ✅ Main wallet has initialized sUSD balance`);
    }
  } catch (error) {
    console.log(`   ❌ Error calling isBalanceInitialized(): ${error}`);
  }

  // Check 4: Vault balance initialized (for withdrawals)
  console.log("\n📋 CHECK 4: Vault FHE balance initialized");
  console.log("-".repeat(50));

  try {
    const isInit = await susd.isBalanceInitialized(SHADOW_VAULT);
    console.log(`   Vault: ${SHADOW_VAULT}`);
    console.log(`   isBalanceInitialized(): ${isInit}`);

    if (!isInit) {
      console.log(`   ⚠️ Vault has no sUSD (normal if no trades yet)`);
    } else {
      console.log(`   ✅ Vault has sUSD (from previous trades)`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 DIAGNOSIS");
  console.log("=".repeat(70));

  console.log(`
Transaction revert sebepleri:

1. ShadowUSD.vault() == address(0)
   → ÇÖZÜM: Owner shadowUsd.setVault(ShadowVault) çağırmalı

2. Main wallet'ta sUSD balance yok
   → ÇÖZÜM: Main wallet ile faucet() çağır:
     - Frontend'de "Get sUSD" butonu MAIN WALLET bağlıyken tıkla
     - Veya contract'ta: shadowUsd.faucet(10000000000) // 10,000 sUSD

3. FHE input proof hatası (eğer yukarıdakiler doğruysa)
   → SDK config problemi
   → gatewayChainId, relayerUrl kontrolü

AKSİYON:
Main wallet (${MAIN_WALLET}) ile direkt faucet çağırmalısın!
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

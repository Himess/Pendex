/**
 * Debug Session Wallet Configuration
 *
 * Checks:
 * 1. ShadowVault's walletManager address
 * 2. WalletManager's sessionToMain mapping
 * 3. isValidSession check
 * 4. Main wallet sUSD balance
 */

import { ethers } from "hardhat";

// Contract addresses from frontend config
const SHADOW_VAULT = "0x1713d51049EA31c19545De7f47AcB909e1050a71";
const WALLET_MANAGER = "0x547481AC8130e985288BD36Cb9ba81204656eB7A";
const SHADOW_USD = "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18";

// Wallet addresses
const SESSION_WALLET = "0x69926ACCa7239B7d83E84502E3aB9025355Cd027";
const MAIN_WALLET = "0xF46b0357A6CD11935a8B5e17c329F24544eF316F";

async function main() {
  console.log("\n🔍 DEBUG: Session Wallet Configuration\n");
  console.log("=".repeat(70));

  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  // Check 1: ShadowVault's walletManager
  console.log("\n📋 CHECK 1: ShadowVault's walletManager address");
  console.log("-".repeat(50));

  const vaultAbi = [
    "function walletManager() view returns (address)"
  ];
  const vault = new ethers.Contract(SHADOW_VAULT, vaultAbi, provider);

  try {
    const vaultWM = await vault.walletManager();
    console.log(`   ShadowVault address: ${SHADOW_VAULT}`);
    console.log(`   walletManager() returns: ${vaultWM}`);

    if (vaultWM === ethers.ZeroAddress) {
      console.log(`   ❌ PROBLEM: walletManager is NOT SET (address(0))`);
      console.log(`   → _resolveTrader() will return msg.sender (session wallet)`);
      console.log(`   → sUSD will be pulled from session wallet (which has none)`);
    } else if (vaultWM.toLowerCase() === WALLET_MANAGER.toLowerCase()) {
      console.log(`   ✅ walletManager is correctly set to ${WALLET_MANAGER}`);
    } else {
      console.log(`   ⚠️ walletManager is set to different address: ${vaultWM}`);
    }
  } catch (error) {
    console.log(`   ❌ Error calling walletManager(): ${error}`);
  }

  // Check 2: WalletManager sessionToMain mapping
  console.log("\n📋 CHECK 2: WalletManager sessionToMain mapping");
  console.log("-".repeat(50));

  const wmAbi = [
    "function sessionToMain(address) view returns (address)",
    "function isValidSession(address) view returns (bool)",
    "function getMainWallet(address) view returns (address)",
    "function getSessionInfo(address) view returns (address sessionAddress, uint256 createdAt, uint256 lastUsedAt, bool isActive)"
  ];
  const walletManager = new ethers.Contract(WALLET_MANAGER, wmAbi, provider);

  try {
    const mainFromSession = await walletManager.sessionToMain(SESSION_WALLET);
    console.log(`   Session wallet: ${SESSION_WALLET}`);
    console.log(`   sessionToMain returns: ${mainFromSession}`);

    if (mainFromSession === ethers.ZeroAddress) {
      console.log(`   ❌ PROBLEM: Session wallet is NOT REGISTERED!`);
      console.log(`   → sessionToMain[${SESSION_WALLET}] = address(0)`);
      console.log(`   → isValidSession() will return false`);
      console.log(`   → _resolveTrader() will return session wallet (no sUSD)`);
    } else if (mainFromSession.toLowerCase() === MAIN_WALLET.toLowerCase()) {
      console.log(`   ✅ Session → Main mapping is correct`);
    } else {
      console.log(`   ⚠️ Session maps to different main wallet: ${mainFromSession}`);
    }
  } catch (error) {
    console.log(`   ❌ Error calling sessionToMain(): ${error}`);
  }

  // Check 3: isValidSession
  console.log("\n📋 CHECK 3: isValidSession check");
  console.log("-".repeat(50));

  try {
    const isValid = await walletManager.isValidSession(SESSION_WALLET);
    console.log(`   isValidSession(${SESSION_WALLET}): ${isValid}`);

    if (!isValid) {
      console.log(`   ❌ PROBLEM: Session wallet is NOT a valid session!`);
      console.log(`   → Either sessionToMain is 0x0 or session is not active`);
    } else {
      console.log(`   ✅ Session wallet is valid`);
    }
  } catch (error) {
    console.log(`   ❌ Error calling isValidSession(): ${error}`);
  }

  // Check 4: getSessionInfo from main wallet's perspective
  console.log("\n📋 CHECK 4: Session info for main wallet");
  console.log("-".repeat(50));

  try {
    const sessionInfo = await walletManager.getSessionInfo(MAIN_WALLET);
    console.log(`   Main wallet: ${MAIN_WALLET}`);
    console.log(`   Session address: ${sessionInfo.sessionAddress}`);
    console.log(`   Created at: ${new Date(Number(sessionInfo.createdAt) * 1000).toISOString()}`);
    console.log(`   Last used: ${new Date(Number(sessionInfo.lastUsedAt) * 1000).toISOString()}`);
    console.log(`   Is active: ${sessionInfo.isActive}`);

    if (sessionInfo.sessionAddress === ethers.ZeroAddress) {
      console.log(`   ❌ PROBLEM: Main wallet has NO registered session!`);
    } else if (sessionInfo.sessionAddress.toLowerCase() !== SESSION_WALLET.toLowerCase()) {
      console.log(`   ⚠️ Main wallet has DIFFERENT session: ${sessionInfo.sessionAddress}`);
    } else if (!sessionInfo.isActive) {
      console.log(`   ❌ PROBLEM: Session exists but is NOT ACTIVE!`);
    } else {
      console.log(`   ✅ Session is correctly configured and active`);
    }
  } catch (error) {
    console.log(`   ❌ Error calling getSessionInfo(): ${error}`);
  }

  // Check 5: Main wallet sUSD balance
  console.log("\n📋 CHECK 5: Main wallet sUSD balance");
  console.log("-".repeat(50));

  const susdAbi = [
    "function balanceOf(address) view returns (uint256)"
  ];
  const susd = new ethers.Contract(SHADOW_USD, susdAbi, provider);

  try {
    const balance = await susd.balanceOf(MAIN_WALLET);
    console.log(`   Main wallet: ${MAIN_WALLET}`);
    console.log(`   sUSD balance: ${ethers.formatUnits(balance, 6)} sUSD`);

    if (balance === 0n) {
      console.log(`   ❌ PROBLEM: Main wallet has NO sUSD!`);
      console.log(`   → Even if session works, there's no sUSD to trade with`);
    } else {
      console.log(`   ✅ Main wallet has sUSD balance`);
    }
  } catch (error) {
    console.log(`   ❌ Error calling balanceOf(): ${error}`);
  }

  // Check 6: Session wallet ETH balance (for gas)
  console.log("\n📋 CHECK 6: Session wallet ETH balance");
  console.log("-".repeat(50));

  try {
    const ethBalance = await provider.getBalance(SESSION_WALLET);
    console.log(`   Session wallet: ${SESSION_WALLET}`);
    console.log(`   ETH balance: ${ethers.formatEther(ethBalance)} ETH`);

    if (ethBalance < ethers.parseEther("0.001")) {
      console.log(`   ⚠️ WARNING: Session wallet has low ETH for gas`);
    } else {
      console.log(`   ✅ Session wallet has enough ETH for gas`);
    }
  } catch (error) {
    console.log(`   ❌ Error getting ETH balance: ${error}`);
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 SUMMARY");
  console.log("=".repeat(70));

  console.log(`
If walletManager is NOT SET on ShadowVault:
  → Solution: Owner must call vault.setWalletManager(${WALLET_MANAGER})

If session is NOT REGISTERED in WalletManager:
  → Solution: Main wallet must call storeSessionKey() again
  → Or: Create new session wallet via frontend

If main wallet has NO sUSD:
  → Solution: Get sUSD from faucet using main wallet

Current flow when session wallet sends TX:
  1. Session wallet calls openPosition()
  2. _resolveTrader() checks walletManager
     - If walletManager is 0x0 → returns session wallet (WRONG!)
     - If walletManager is set → checks isValidSession()
       - If session not valid → returns session wallet (WRONG!)
       - If session valid → returns main wallet (CORRECT!)
  3. sUSD pulled from returned address
     - If session wallet returned → has no sUSD → REVERT!
     - If main wallet returned → has sUSD → SUCCESS!
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

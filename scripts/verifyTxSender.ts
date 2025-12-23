/**
 * Verify TX Sender Address
 *
 * This script checks the `from` address of the failed TX
 * to verify it matches the session wallet used for encryption.
 */

import { ethers } from "hardhat";

async function main() {
  console.log("\n🔍 Verifying TX Sender Address\n");
  console.log("=".repeat(70));

  const provider = new ethers.JsonRpcProvider(
    "https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"
  );

  const txHash = "0x911f1c14299e409ac45bc73e748a77e96d9a435d1cb48117ae9658e796c4e5ad";

  // Expected addresses
  const EXPECTED_SESSION_WALLET = "0x69926ACCa7239B7d83E84502E3aB9025355Cd027";
  const EXPECTED_MAIN_WALLET = "0xF46b0357A6CD11935a8B5e17c329F24544eF316F";
  const EXPECTED_VAULT = "0x1713d51049EA31c19545De7f47AcB909e1050a71";

  console.log("\n📋 EXPECTED ADDRESSES:");
  console.log(`   Session Wallet: ${EXPECTED_SESSION_WALLET}`);
  console.log(`   Main Wallet: ${EXPECTED_MAIN_WALLET}`);
  console.log(`   Vault: ${EXPECTED_VAULT}`);

  const tx = await provider.getTransaction(txHash);

  if (!tx) {
    console.log("\n❌ TX not found!");
    return;
  }

  console.log("\n📜 TRANSACTION DETAILS:");
  console.log(`   TX Hash: ${txHash}`);
  console.log(`   From: ${tx.from}`);
  console.log(`   To: ${tx.to}`);
  console.log(`   Block: ${tx.blockNumber}`);
  console.log(`   Gas Limit: ${tx.gasLimit}`);

  console.log("\n🔍 ADDRESS VERIFICATION:");

  // Check FROM address
  const fromMatch = tx.from.toLowerCase() === EXPECTED_SESSION_WALLET.toLowerCase();
  console.log(`   FROM matches Session Wallet: ${fromMatch ? "✅ YES" : "❌ NO"}`);
  if (!fromMatch) {
    console.log(`      Expected: ${EXPECTED_SESSION_WALLET}`);
    console.log(`      Actual:   ${tx.from}`);

    // Check if it's the main wallet
    const isMainWallet = tx.from.toLowerCase() === EXPECTED_MAIN_WALLET.toLowerCase();
    if (isMainWallet) {
      console.log(`      ⚠️ TX was sent from MAIN WALLET, not Session Wallet!`);
      console.log(`      This is the problem! Encryption used Session Wallet address,`);
      console.log(`      but TX was signed by Main Wallet.`);
    }
  }

  // Check TO address
  const toMatch = tx.to?.toLowerCase() === EXPECTED_VAULT.toLowerCase();
  console.log(`   TO matches Vault: ${toMatch ? "✅ YES" : "❌ NO"}`);
  if (!toMatch) {
    console.log(`      Expected: ${EXPECTED_VAULT}`);
    console.log(`      Actual:   ${tx.to}`);
  }

  // Get receipt for more details
  const receipt = await provider.getTransactionReceipt(txHash);
  if (receipt) {
    console.log("\n📊 RECEIPT:");
    console.log(`   Status: ${receipt.status === 1 ? "SUCCESS" : "FAILED"}`);
    console.log(`   Gas Used: ${receipt.gasUsed}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("📋 DIAGNOSIS:");
  console.log("=".repeat(70));

  if (!fromMatch) {
    console.log(`
❌ ADDRESS MISMATCH DETECTED!

The transaction was sent from:
  ${tx.from}

But encryption was done for Session Wallet:
  ${EXPECTED_SESSION_WALLET}

FHE.fromExternal() requires:
  msg.sender (TX sender) == userAddress (encryption user)

This mismatch causes the ZK proof verification to fail.

SOLUTION:
Ensure the TX is signed by the same address used for FHE encryption.
`);
  } else if (!toMatch) {
    console.log(`
❌ CONTRACT ADDRESS MISMATCH!

The transaction was sent to:
  ${tx.to}

But encryption was done for Vault:
  ${EXPECTED_VAULT}

FHE.fromExternal() requires:
  Contract address in proof == Calling contract

SOLUTION:
Ensure the contract address used in encryption matches the actual contract.
`);
  } else {
    console.log(`
✅ Addresses match correctly.

If TX still fails, possible issues:
1. SDK/Relayer configuration mismatch
2. Proof generation error
3. Network/timing issue with Zama gateway

Try running testFheEncryption.ts to debug further.
`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

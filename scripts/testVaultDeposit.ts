/**
 * Test just the vaultDeposit part
 * Create encrypted amount and call vaultDeposit directly
 */

import { ethers } from "hardhat";

const SHADOW_VAULT = "0x1713d51049EA31c19545De7f47AcB909e1050a71";
const SHADOW_USD = "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18";

// Minimal test contract that just does FHE.fromExternal + vaultDeposit
// We'll deploy this to test the exact pattern

async function main() {
  console.log("\n🧪 Testing vaultDeposit pattern\n");
  console.log("=".repeat(70));

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  // Check if we have balance
  const susdAbi = ["function isBalanceInitialized(address) view returns (bool)"];
  const susd = new ethers.Contract(SHADOW_USD, susdAbi, signer);
  const hasBalance = await susd.isBalanceInitialized(signer.address);
  console.log("Has sUSD balance:", hasBalance ? "✅ YES" : "❌ NO");

  if (!hasBalance) {
    console.log("❌ No balance! Run checkSusdBalance.ts first");
    return;
  }

  // Now let's test calling a simplified contract
  // Deploy a minimal test contract that simulates what ShadowVault does

  console.log("\n📦 Deploying VaultDepositTest...");

  const VaultDepositTest = await ethers.getContractFactory("VaultDepositTest");
  const test = await VaultDepositTest.deploy(SHADOW_USD);
  await test.waitForDeployment();
  const testAddress = await test.getAddress();
  console.log("✅ VaultDepositTest deployed to:", testAddress);

  // Set this contract as vault in ShadowUSD
  // (we need owner to do this)
  console.log("\n⚠️ Note: VaultDepositTest is NOT set as vault in ShadowUSD");
  console.log("   This test will fail with 'Only vault' error");
  console.log("   But that's expected - we just want to test the FHE part");

  // Initialize Relayer SDK
  console.log("\n📡 Initializing Relayer SDK...");
  const sdk = await import("@zama-fhe/relayer-sdk/node");
  const { createInstance, SepoliaConfig } = sdk;
  const fhevm = await createInstance(SepoliaConfig);
  console.log("✅ FHEVM instance created");

  // Create encrypted input
  console.log("\n🔐 Creating encrypted input...");
  const input = fhevm.createEncryptedInput(testAddress, signer.address);
  input.add64(10 * 1000000); // 10 sUSD

  const encrypted = await input.encrypt();
  console.log("✅ Encryption successful!");
  console.log("   Handle:", "0x" + Buffer.from(encrypted.handles[0]).toString("hex"));

  // Try to call the test function
  console.log("\n📤 Calling testVaultDeposit...");
  console.log("   This tests FHE.fromExternal + allowTransient + vaultDeposit call");

  const testAbi = [
    "function testVaultDeposit(bytes32 encryptedAmount, bytes calldata inputProof) external"
  ];
  const testContract = new ethers.Contract(testAddress, testAbi, signer);

  try {
    const tx = await testContract.testVaultDeposit(
      encrypted.handles[0],
      encrypted.inputProof,
      { gasLimit: 5000000 }
    );
    console.log("TX:", tx.hash);
    const receipt = await tx.wait();

    if (receipt.status === 1) {
      console.log("\n✅ VaultDepositTest PASSED!");
    } else {
      console.log("\n❌ VaultDepositTest failed (status 0)");
    }
  } catch (error: any) {
    console.log("\n❌ VaultDepositTest reverted!");
    console.log("   Error:", error.message?.slice(0, 300));

    if (error.message?.includes("Only vault")) {
      console.log("\n💡 This is expected - the test contract is not set as vault");
      console.log("   The FHE.fromExternal + allowTransient part should work fine");
      console.log("   The issue is the vaultDeposit authorization check");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

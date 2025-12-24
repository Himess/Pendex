/**
 * Test MultiInputTest with multiple FHE.fromExternal
 */

import { ethers } from "hardhat";

const MULTI_INPUT_ADDRESS = "0xAFDFc75b7aB296FDDB53eBcFF9AF6Da36286B3A2";

const MULTI_INPUT_ABI = [
  "function testTripleInput(bytes32 encryptedA, bytes32 encryptedB, bytes32 encryptedC, bytes calldata inputProof) external",
  "function testDoubleInput(bytes32 encryptedA, bytes32 encryptedB, bytes calldata inputProof) external"
];

async function main() {
  if (!MULTI_INPUT_ADDRESS) {
    console.log("❌ Please deploy MultiInputTest first and update MULTI_INPUT_ADDRESS");
    console.log("   Run: npx hardhat run scripts/deployMultiInputTest.ts --network sepolia");
    return;
  }

  console.log("\n🧪 Testing MultiInputTest with Multiple FHE.fromExternal\n");
  console.log("=".repeat(70));

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  // Initialize Relayer SDK
  console.log("\n📡 Initializing Relayer SDK...");

  const sdk = await import("@zama-fhe/relayer-sdk/node");
  const { createInstance, SepoliaConfig } = sdk;

  const fhevm = await createInstance(SepoliaConfig);
  console.log("✅ FHEVM instance created");

  const contract = new ethers.Contract(MULTI_INPUT_ADDRESS, MULTI_INPUT_ABI, signer);

  // ====================
  // TEST 1: Double Input (2x euint64)
  // ====================
  console.log("\n" + "=".repeat(70));
  console.log("📋 TEST 1: Double Input (2x euint64)");
  console.log("=".repeat(70));

  try {
    console.log("🔐 Creating encrypted input with 2 values...");
    const input1 = fhevm.createEncryptedInput(MULTI_INPUT_ADDRESS, signer.address);
    input1.add64(100);  // encryptedA
    input1.add64(200);  // encryptedB

    console.log("⏳ Encrypting...");
    const encrypted1 = await input1.encrypt();

    console.log("✅ Encryption successful!");
    console.log("   Handles:", encrypted1.handles.length);
    console.log("   Proof length:", encrypted1.inputProof.length, "bytes");

    console.log("\n📤 Calling testDoubleInput...");
    const tx1 = await contract.testDoubleInput(
      encrypted1.handles[0],
      encrypted1.handles[1],
      encrypted1.inputProof,
      { gasLimit: 5000000 }
    );

    console.log("⏳ TX submitted:", tx1.hash);
    const receipt1 = await tx1.wait();

    if (receipt1.status === 1) {
      console.log("\n✅ TEST 1 PASSED! Double input works!");
      console.log("   Gas used:", receipt1.gasUsed.toString());
    } else {
      console.log("\n❌ TEST 1 FAILED (status 0)");
    }
  } catch (error: any) {
    console.log("\n❌ TEST 1 FAILED!");
    console.log("   Error:", error.message?.slice(0, 200));
  }

  // ====================
  // TEST 2: Triple Input (2x euint64 + 1x ebool)
  // ====================
  console.log("\n" + "=".repeat(70));
  console.log("📋 TEST 2: Triple Input (2x euint64 + 1x ebool)");
  console.log("=".repeat(70));

  try {
    console.log("🔐 Creating encrypted input with 3 values...");
    const input2 = fhevm.createEncryptedInput(MULTI_INPUT_ADDRESS, signer.address);
    input2.add64(1000);   // encryptedA (collateral)
    input2.add64(5);      // encryptedB (leverage)
    input2.addBool(true); // encryptedC (isLong)

    console.log("⏳ Encrypting...");
    const encrypted2 = await input2.encrypt();

    console.log("✅ Encryption successful!");
    console.log("   Handles:", encrypted2.handles.length);
    console.log("   Proof length:", encrypted2.inputProof.length, "bytes");

    // Log each handle
    encrypted2.handles.forEach((h: Uint8Array, i: number) => {
      console.log(`   Handle ${i}: 0x${Buffer.from(h).toString("hex")}`);
    });

    console.log("\n📤 Calling testTripleInput...");
    const tx2 = await contract.testTripleInput(
      encrypted2.handles[0],
      encrypted2.handles[1],
      encrypted2.handles[2],
      encrypted2.inputProof,
      { gasLimit: 5000000 }
    );

    console.log("⏳ TX submitted:", tx2.hash);
    const receipt2 = await tx2.wait();

    if (receipt2.status === 1) {
      console.log("\n✅ TEST 2 PASSED! Triple input works!");
      console.log("   Gas used:", receipt2.gasUsed.toString());
      console.log("\n🎉 Both tests passed! Issue is NOT with multiple FHE.fromExternal");
      console.log("   The problem is likely in cross-contract calls (ShadowUSD, Oracle)");
    } else {
      console.log("\n❌ TEST 2 FAILED (status 0)");
      console.log("   Issue is with triple input (ebool might be the problem)");
    }
  } catch (error: any) {
    console.log("\n❌ TEST 2 FAILED!");
    console.log("   Error:", error.message?.slice(0, 200));
    console.log("\n💡 If TEST 1 passed but TEST 2 failed:");
    console.log("   → The issue might be with ebool (FHE.fromExternal for bool)");
    console.log("   → Or with 3+ encrypted inputs in same transaction");
  }

  // ====================
  // SUMMARY
  // ====================
  console.log("\n" + "=".repeat(70));
  console.log("📊 SUMMARY");
  console.log("=".repeat(70));
  console.log(`
Based on test results:
- If BOTH pass → Problem is in ShadowVault cross-contract calls
- If TEST 1 pass, TEST 2 fail → Problem is with ebool or 3+ inputs
- If BOTH fail → Problem is with multiple FHE.fromExternal
`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

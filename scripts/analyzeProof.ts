/**
 * Analyze the inputProof structure from the failed transaction
 */

const inputProof = "0x030199d1397d040283c0e616d1447f1990d94b3a49720b000000000000aa36a70500dc0aaf8bedca88134b80acea86277e2597121aaa2d010000000000aa36a7050078e8e39e34268bacd96f1d481847dff1338fbe3367020000000000aa36a70000af1713d51049ea31c19545de7f47acb909e1050a71030303699926acca7239b7d83e84502e3ab9025355cd027";

const collateralHandle = "0x99d1397d040283c0e616d1447f1990d94b3a49720b000000000000aa36a70500";
const leverageHandle = "0xdc0aaf8bedca88134b80acea86277e2597121aaa2d010000000000aa36a70500";
const isLongHandle = "0x78e8e39e34268bacd96f1d481847dff1338fbe3367020000000000aa36a70000";

console.log("📋 Input Proof Analysis\n");
console.log("=".repeat(70));

// Remove 0x prefix
const proofHex = inputProof.slice(2);
console.log(`\nTotal proof length: ${proofHex.length / 2} bytes`);
console.log(`Full proof: ${inputProof}`);

// Parse the proof structure
console.log("\n📋 Proof Structure:");

// First byte seems to be count (03 = 3 handles)
const handleCount = parseInt(proofHex.slice(0, 2), 16);
console.log(`  Byte 0: ${proofHex.slice(0, 2)} = ${handleCount} (number of handles?)`);

// Next bytes are type indicators? (01 for each handle type)
console.log(`  Byte 1: ${proofHex.slice(2, 4)} (type indicator?)`);

// The handles appear to be embedded
const handle1Start = 4;
const handle1 = proofHex.slice(handle1Start, handle1Start + 64);
console.log(`  Handle 1: 0x${handle1}`);
console.log(`    Matches collateral: ${('0x' + handle1) === collateralHandle}`);

const handle2Start = handle1Start + 64;
const handle2 = proofHex.slice(handle2Start, handle2Start + 64);
console.log(`  Handle 2: 0x${handle2}`);
console.log(`    Matches leverage: ${('0x' + handle2) === leverageHandle}`);

const handle3Start = handle2Start + 64;
const handle3 = proofHex.slice(handle3Start, handle3Start + 64);
console.log(`  Handle 3: 0x${handle3}`);
console.log(`    Matches isLong: ${('0x' + handle3) === isLongHandle}`);

// After handles (3 * 64 = 192 hex chars) + 4 prefix = 196 hex chars
const remainingStart = handle3Start + 64;
const remaining = proofHex.slice(remainingStart);
console.log(`\n📋 Remaining after handles: ${remaining.length / 2} bytes`);
console.log(`  Remaining hex: 0x${remaining}`);

// Analyze remaining
if (remaining.length > 0) {
  // First byte might be a separator
  console.log(`  Byte 0: ${remaining.slice(0, 2)}`);

  // Look for known addresses
  const vaultInProof = remaining.toLowerCase().includes("1713d51049ea31c19545de7f47acb909e1050a71");
  const sessionInProof = remaining.toLowerCase().includes("69926acca7239b7d83e84502e3ab9025355cd027");

  console.log(`  Contains Vault address: ${vaultInProof ? '✅' : '❌'}`);
  console.log(`  Contains Session address: ${sessionInProof ? '✅' : '❌'}`);

  // Try to extract addresses
  if (remaining.length >= 40) {
    const addr1 = remaining.slice(0, 40);
    console.log(`  First 20 bytes as address: 0x${addr1}`);
  }
}

console.log("\n📋 Handle Analysis:");
console.log("  Each handle contains chainId 0xaa36a7 (11155111) at the end");

// The last bytes of handles show the value type?
console.log(`  Collateral suffix: ${collateralHandle.slice(-4)} (0500 = uint64?)`);
console.log(`  Leverage suffix: ${leverageHandle.slice(-4)} (0500 = uint64?)`);
console.log(`  IsLong suffix: ${isLongHandle.slice(-4)} (0000 = bool?)`);

console.log("\n" + "=".repeat(70));
console.log("📊 SUMMARY:");
console.log("=".repeat(70));
console.log(`
The inputProof structure appears to be:
- 1 byte: number of handles (0x03 = 3)
- 1 byte: type indicator (0x01)
- 3 x 32 bytes: the encrypted handles
- Remaining bytes: contract address + metadata

This is NOT a traditional ZK proof!
It's more like a handle registry + metadata.

The actual FHE proof verification likely happens at the Coprocessor
using the handles as references to off-chain encrypted data.

If this is failing, possible issues:
1. The handles aren't registered with the Coprocessor/InputVerifier
2. The Coprocessor doesn't recognize this proof format
3. There's an infrastructure issue on Sepolia
`);

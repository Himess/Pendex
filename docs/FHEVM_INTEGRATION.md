# Shadow Protocol - FHEVM Integration Guide

This document provides a comprehensive overview of how Shadow Protocol utilizes Zama's Fully Homomorphic Encryption Virtual Machine (fhEVM) to enable private leveraged trading on Pre-IPO assets.

---

## Table of Contents

1. [Overview](#overview)
2. [Encrypted Data Types](#encrypted-data-types)
3. [FHE Operations Used](#fhe-operations-used)
4. [Contract Integration](#contract-integration)
5. [Frontend SDK Integration](#frontend-sdk-integration)
6. [Decryption Patterns](#decryption-patterns)
7. [ACL (Access Control)](#acl-access-control)
8. [Testing FHE Locally](#testing-fhe-locally)
9. [Troubleshooting](#troubleshooting)

---

## Overview

Shadow Protocol uses fhEVM to encrypt sensitive trading data on-chain. This includes:

- **Position Data**: Collateral, size, entry price, leverage, direction
- **Balances**: sUSD balances, LP token balances, pending rewards
- **Orders**: Limit order trigger prices and sizes
- **Identity**: Optional anonymous trading with encrypted owner addresses

### Why FHE over ZK?

| Feature | FHE | ZK Proofs |
|---------|-----|-----------|
| Computation on encrypted data | ✅ Native | ❌ Requires circuits |
| On-chain verification | ✅ Automatic | ✅ Manual |
| State persistence | ✅ Encrypted state | ❌ Must re-prove |
| Flexibility | ✅ General purpose | ❌ Circuit-specific |

---

## Encrypted Data Types

### Location: `contracts/core/ShadowVault.sol`

```solidity
// Line 45-65: Encrypted position storage
struct Position {
    uint256 id;
    address owner;              // Public (optional: eaddress for anonymous)
    bytes32 assetId;            // Public
    euint64 collateral;         // 🔒 ENCRYPTED
    euint64 size;               // 🔒 ENCRYPTED
    euint64 entryPrice;         // 🔒 ENCRYPTED
    ebool isLong;               // 🔒 ENCRYPTED
    euint64 leverage;           // 🔒 ENCRYPTED
    uint256 openTimestamp;      // Public
    bool isOpen;                // Public
}

// Line 70-80: Anonymous positions (UNIQUE FEATURE!)
struct AnonymousPosition {
    uint256 id;
    eaddress encryptedOwner;    // 🔒 ENCRYPTED - Nobody knows the owner!
    bytes32 assetId;
    euint64 collateral;         // 🔒 ENCRYPTED
    euint64 size;               // 🔒 ENCRYPTED
    euint64 entryPrice;         // 🔒 ENCRYPTED
    ebool isLong;               // 🔒 ENCRYPTED
    euint64 leverage;           // 🔒 ENCRYPTED
}

// Line 85-95: Encrypted limit orders
struct EncryptedLimitOrder {
    uint256 id;
    address owner;
    bytes32 assetId;
    euint64 triggerPrice;       // 🔒 ENCRYPTED - Anti-frontrunning!
    euint64 collateral;         // 🔒 ENCRYPTED
    ebool isLong;               // 🔒 ENCRYPTED
    ebool isAbove;              // 🔒 ENCRYPTED
    bool isActive;
}
```

### Location: `contracts/tokens/ShadowUSD.sol`

```solidity
// Line 25: Encrypted balances (ERC-7984 style)
mapping(address => euint64) private _balances;

// Line 30: Encrypted allowances
mapping(address => mapping(address => euint64)) private _allowances;
```

### Location: `contracts/core/ShadowLiquidityPool.sol`

```solidity
// Line 40: Encrypted LP balances
mapping(address => euint64) private _lpBalances;

// Line 45: Encrypted pending rewards
mapping(address => euint64) private _pendingRewards;
```

---

## FHE Operations Used

### Arithmetic Operations

| Operation | Usage | Location |
|-----------|-------|----------|
| `FHE.add(a, b)` | Balance updates, P&L calculation | ShadowVault.sol:420, ShadowUSD.sol:150 |
| `FHE.sub(a, b)` | Fee deduction, withdrawal | ShadowVault.sol:445, ShadowUSD.sol:165 |
| `FHE.mul(a, b)` | Position size = collateral × leverage | ShadowVault.sol:380 |
| `FHE.div(a, b)` | P&L percentage, pool share | ShadowVault.sol:520, ShadowLiquidityPool.sol:180 |

### Comparison Operations

| Operation | Usage | Location |
|-----------|-------|----------|
| `FHE.gt(a, b)` | Liquidation check | ShadowVault.sol:650 |
| `FHE.lt(a, b)` | Slippage check | ShadowVault.sol:390 |
| `FHE.ge(a, b)` | Balance validation | ShadowVault.sol:350, ShadowUSD.sol:140 |
| `FHE.le(a, b)` | Max leverage check | ShadowVault.sol:365 |
| `FHE.eq(a, b)` | Exact match validation | ShadowVault.sol:480 |

### Conditional Operations

| Operation | Usage | Location |
|-----------|-------|----------|
| `FHE.select(cond, a, b)` | Branchless if/else | ShadowVault.sol:400, 520, 680 |

**Example:**
```solidity
// Line 400: Calculate P&L based on direction
euint64 pnl = FHE.select(
    position.isLong,
    FHE.sub(currentPrice, position.entryPrice),  // Long: current - entry
    FHE.sub(position.entryPrice, currentPrice)   // Short: entry - current
);
```

### Random Generation

| Operation | Usage | Location |
|-----------|-------|----------|
| `FHE.randEbool()` | Encrypted coin flip | ShadowMarketMaker.sol:150 |
| `FHE.randEuint8()` | Bonus multiplier (0-15%) | ShadowLiquidityPool.sol:220 |
| `FHE.randEuint64()` | Random trade size | ShadowMarketMaker.sol:180 |

### Type Conversion

| Operation | Usage | Location |
|-----------|-------|----------|
| `FHE.asEuint64(x)` | Convert clear to encrypted | ShadowVault.sol:340 |
| `FHE.asEbool(x)` | Convert clear to encrypted bool | ShadowVault.sol:385 |
| `FHE.asEaddress(x)` | Encrypt address (anonymous trading) | ShadowVault.sol:750 |

### Min/Max Operations

| Operation | Usage | Location |
|-----------|-------|----------|
| `FHE.min(a, b)` | Cap values, slippage limit | ShadowVault.sol:395 |
| `FHE.max(a, b)` | Minimum position size | ShadowVault.sol:370 |

---

## Contract Integration

### Input Handling Pattern

```solidity
// Location: ShadowVault.sol:300-340
function openPosition(
    bytes32 assetId,
    externalEuint64 encCollateral,    // External encrypted input
    externalEuint64 encLeverage,
    externalEbool encIsLong,
    bytes calldata inputProof         // ZK proof from SDK
) external nonReentrant {
    // Step 1: Convert external inputs to internal encrypted types
    euint64 collateral = FHE.fromExternal(encCollateral, inputProof);
    euint64 leverage = FHE.fromExternal(encLeverage, inputProof);
    ebool isLong = FHE.fromExternal(encIsLong, inputProof);

    // Step 2: Grant ACL permissions
    FHE.allowThis(collateral);
    FHE.allow(collateral, msg.sender);

    // Step 3: Perform encrypted operations
    euint64 size = FHE.mul(collateral, leverage);

    // Step 4: Store encrypted values
    _positions[nextPositionId] = Position({
        collateral: collateral,
        size: size,
        // ...
    });
}
```

### Public Decryption Pattern (Liquidation Flow)

```solidity
// Location: ShadowVault.sol:1578-1687

// Step 1: Prepare for decryption
function preparePositionClose(uint256 positionId) external {
    // Calculate final amount (encrypted)
    euint64 finalAmount = FHE.add(position.collateral, pnl);

    // Mark for public decryption
    FHE.makePubliclyDecryptable(finalAmount);
    FHE.makePubliclyDecryptable(position.collateral);

    // Store handles for verification
    _closeHandles[closeId] = CloseHandles({
        finalAmountHandle: finalAmount,
        collateralHandle: position.collateral
    });
}

// Step 2: Verify and finalize (called by relayer/user)
function finalizePositionClose(
    uint256 closeId,
    bytes memory abiEncodedClearValues,
    bytes memory decryptionProof
) external {
    // CRITICAL: Verify KMS signatures
    bytes32[] memory cts = new bytes32[](2);
    cts[0] = FHE.toBytes32(handles.finalAmountHandle);
    cts[1] = FHE.toBytes32(handles.collateralHandle);
    FHE.checkSignatures(cts, abiEncodedClearValues, decryptionProof);

    // Safe to use decrypted values
    (uint64 finalAmount, ) = abi.decode(abiEncodedClearValues, (uint64, uint64));

    // Process close...
}
```

---

## Frontend SDK Integration

### Location: `frontend/src/lib/fhe/client.ts`

```typescript
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/web";

// Singleton FHE instance
let fhevmInstance: FhevmInstance | null = null;

// Initialize
export async function initFheInstance(): Promise<FhevmInstance> {
  if (!fhevmInstance) {
    fhevmInstance = await createInstance(SepoliaConfig);
  }
  return fhevmInstance;
}

// Encrypt single value
export async function encryptUint64(
  value: bigint,
  contractAddress: string,
  userAddress: string
): Promise<{ handle: Uint8Array; inputProof: Uint8Array }> {
  const instance = await initFheInstance();
  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add64(value);
  const encrypted = await input.encrypt();
  return {
    handle: encrypted.handles[0],
    inputProof: encrypted.inputProof,
  };
}

// Encrypt position parameters (multiple values, single proof)
export async function encryptPositionParams(
  collateral: bigint,
  leverage: bigint,
  isLong: boolean,
  contractAddress: string,
  userAddress: string
) {
  const instance = await initFheInstance();
  const input = instance.createEncryptedInput(contractAddress, userAddress);

  input.add64(collateral);   // handles[0]
  input.add64(leverage);     // handles[1]
  input.addBool(isLong);     // handles[2]

  const encrypted = await input.encrypt();

  return {
    encryptedCollateral: encrypted.handles[0],
    encryptedLeverage: encrypted.handles[1],
    encryptedIsLong: encrypted.handles[2],
    inputProof: encrypted.inputProof,  // Single proof for all values
  };
}

// User decryption (EIP-712 signed)
export async function requestUserDecryption(
  handles: Array<{ handle: string; contractAddress: string }>,
  userAddress: string,
  signer: WalletClient
): Promise<Record<string, bigint>> {
  const instance = await initFheInstance();

  // Generate keypair
  const keypair = instance.generateKeypair();

  // Create EIP-712 authorization
  const eip712 = instance.createEIP712(
    keypair.publicKey,
    handles.map(h => h.contractAddress),
    Math.floor(Date.now() / 1000),
    365 // days valid
  );

  // Sign with wallet
  const signature = await signer.signTypedData({
    domain: eip712.domain,
    types: eip712.types,
    primaryType: eip712.primaryType,
    message: eip712.message,
  });

  // Request decryption
  const results = await instance.userDecrypt(
    handles,
    keypair.privateKey,
    keypair.publicKey,
    signature,
    handles.map(h => h.contractAddress),
    userAddress,
    Math.floor(Date.now() / 1000),
    365
  );

  return results;
}
```

---

## Decryption Patterns

### 1. User Decryption (Private)

**Use Case:** User viewing their own balance or position

**Flow:**
```
User → Frontend → EIP-712 Sign → Relayer → KMS → Decrypted Value (only to user)
```

**Code Location:** `frontend/src/app/wallet/page.tsx:294-356`

### 2. Public Decryption (Verified)

**Use Case:** Liquidation, position close settlement

**Flow:**
```
Step 1: preparePositionClose()     → FHE.makePubliclyDecryptable()
Step 2: Off-chain publicDecrypt()  → Get cleartext + proof
Step 3: finalizePositionClose()    → FHE.checkSignatures() + process
```

**Code Location:** `contracts/core/ShadowVault.sol:1578-1687`

---

## ACL (Access Control)

### Persistent Permissions

```solidity
// Grant contract access (required for operations)
FHE.allowThis(encryptedValue);

// Grant user access (required for user decryption)
FHE.allow(encryptedValue, userAddress);

// IMPORTANT: Both are needed for user decryption!
```

### Transient Permissions

```solidity
// Gas-optimized temporary access (same transaction only)
FHE.allowTransient(encryptedValue, recipientAddress);

// Used in transfers and swaps
```

### Location Reference

| Permission Type | Location | Line |
|-----------------|----------|------|
| `FHE.allowThis()` | ShadowVault.sol | 355, 425, 520, 680 |
| `FHE.allow()` | ShadowVault.sol | 356, 426, 521, 681 |
| `FHE.allowTransient()` | ShadowUSD.sol | 175, ShadowLiquidityPool.sol | 195 |

---

## Testing FHE Locally

### Mock Mode (Hardhat)

```bash
# Run local node with mock FHE
npx hardhat node

# Run tests (mock FHE operations)
npx hardhat test
```

**Note:** In mock mode, FHE operations are simulated. Values are not truly encrypted.

### Sepolia Testnet (Real FHE)

```bash
# Set credentials
npx hardhat vars set MNEMONIC
npx hardhat vars set INFURA_API_KEY

# Deploy
npx hardhat deploy --network sepolia
```

---

## Troubleshooting

### Common Issues

#### 1. "ACL: sender not allowed"
**Cause:** Missing permission for encrypted value
**Solution:**
```solidity
FHE.allowThis(value);  // For contract operations
FHE.allow(value, msg.sender);  // For user decryption
```

#### 2. "Invalid input proof"
**Cause:** Proof doesn't match encrypted handles
**Solution:** Ensure all handles come from same `encrypt()` call

#### 3. "User decryption fails"
**Cause:** Missing both `allowThis` AND `allow`
**Solution:** Both permissions required for user decryption

#### 4. "checkSignatures reverts"
**Cause:** Invalid decryption proof or tampered cleartext
**Solution:** Use fresh decryption from KMS, don't modify cleartext

#### 5. "Cannot use encrypted value in if statement"
**Cause:** Solidity branching on encrypted boolean
**Solution:** Use `FHE.select(condition, ifTrue, ifFalse)` instead

### Gas Optimization Tips

1. Use `FHE.allowTransient()` instead of `FHE.allow()` for temporary access
2. Batch multiple encrypted operations in single transaction
3. Use `euint8` or `euint16` when possible instead of `euint64`
4. Store encrypted values once, reference by handle

---

## Summary of FHE Features Used

| Feature | ✅ Used | Location |
|---------|---------|----------|
| `euint8` | ✅ | Error codes, bonus multiplier |
| `euint16` | ❌ | Not needed |
| `euint32` | ❌ | Not needed |
| `euint64` | ✅ | Balances, positions, prices |
| `euint128` | ❌ | Not needed |
| `euint256` | ❌ | Not needed |
| `ebool` | ✅ | Direction (long/short), conditions |
| `eaddress` | ✅ | Anonymous trading |
| `FHE.add()` | ✅ | Balance updates |
| `FHE.sub()` | ✅ | Withdrawals, P&L |
| `FHE.mul()` | ✅ | Position sizing |
| `FHE.div()` | ✅ | Percentages |
| `FHE.select()` | ✅ | Conditional logic |
| `FHE.gt/lt/ge/le/eq()` | ✅ | Validations |
| `FHE.min/max()` | ✅ | Capping values |
| `FHE.randEuint*()` | ✅ | Random generation |
| `FHE.fromExternal()` | ✅ | Input handling |
| `FHE.allowThis()` | ✅ | Contract access |
| `FHE.allow()` | ✅ | User access |
| `FHE.allowTransient()` | ✅ | Temp access |
| `FHE.makePubliclyDecryptable()` | ✅ | Public decryption |
| `FHE.checkSignatures()` | ✅ | Proof verification |

---

## Contact & Resources

- [Zama fhEVM Documentation](https://docs.zama.ai/fhevm)
- [OpenZeppelin Confidential Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts)
- [Shadow Protocol GitHub](https://github.com/Himess/shadow-protocol)

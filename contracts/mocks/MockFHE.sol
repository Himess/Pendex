// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockFHE
 * @notice Mock FHE implementation for non-FHE networks (Sepolia, etc.)
 * @dev This allows the same contract logic to work without actual FHE
 *
 * USE CASES:
 * 1. Testing on Sepolia/Mainnet before FHE deployment
 * 2. Backup if Zama Devnet is down
 * 3. Demo purposes where FHE verification isn't critical
 *
 * IMPORTANT: This is NOT private! All values are plaintext.
 * Only use for testing/demo when FHE network is unavailable.
 */

// Mock encrypted types (just uint256 wrappers)
type euint64 is uint256;
type euint8 is uint256;
type ebool is uint256;
type eaddress is uint256;

// External types for inputs
type externalEuint64 is bytes32;
type externalEuint8 is bytes32;
type externalEbool is bytes32;
type externalEaddress is bytes32;

/**
 * @title MockFHELib
 * @notice Mock implementation of FHE operations
 */
library MockFHE {
    // ============================================
    // CONVERSION FUNCTIONS
    // ============================================

    function asEuint64(uint64 value) internal pure returns (euint64) {
        return euint64.wrap(uint256(value));
    }

    function asEuint8(uint8 value) internal pure returns (euint8) {
        return euint8.wrap(uint256(value));
    }

    function asEbool(bool value) internal pure returns (ebool) {
        return ebool.wrap(value ? 1 : 0);
    }

    function asEaddress(address value) internal pure returns (eaddress) {
        return eaddress.wrap(uint256(uint160(value)));
    }

    // ============================================
    // EXTERNAL INPUT CONVERSION
    // ============================================

    function fromExternal(externalEuint64 value, bytes calldata) internal pure returns (euint64) {
        return euint64.wrap(uint256(bytes32(externalEuint64.unwrap(value))));
    }

    function fromExternal(externalEuint8 value, bytes calldata) internal pure returns (euint8) {
        return euint8.wrap(uint256(bytes32(externalEuint8.unwrap(value))));
    }

    function fromExternal(externalEbool value, bytes calldata) internal pure returns (ebool) {
        return ebool.wrap(uint256(bytes32(externalEbool.unwrap(value))));
    }

    function fromExternal(externalEaddress value, bytes calldata) internal pure returns (eaddress) {
        return eaddress.wrap(uint256(bytes32(externalEaddress.unwrap(value))));
    }

    // ============================================
    // ARITHMETIC OPERATIONS
    // ============================================

    function add(euint64 a, euint64 b) internal pure returns (euint64) {
        return euint64.wrap(euint64.unwrap(a) + euint64.unwrap(b));
    }

    function add(euint64 a, uint64 b) internal pure returns (euint64) {
        return euint64.wrap(euint64.unwrap(a) + uint256(b));
    }

    function sub(euint64 a, euint64 b) internal pure returns (euint64) {
        return euint64.wrap(euint64.unwrap(a) - euint64.unwrap(b));
    }

    function sub(euint64 a, uint64 b) internal pure returns (euint64) {
        return euint64.wrap(euint64.unwrap(a) - uint256(b));
    }

    function mul(euint64 a, euint64 b) internal pure returns (euint64) {
        return euint64.wrap(euint64.unwrap(a) * euint64.unwrap(b));
    }

    function mul(euint64 a, uint64 b) internal pure returns (euint64) {
        return euint64.wrap(euint64.unwrap(a) * uint256(b));
    }

    function div(euint64 a, euint64 b) internal pure returns (euint64) {
        require(euint64.unwrap(b) != 0, "Division by zero");
        return euint64.wrap(euint64.unwrap(a) / euint64.unwrap(b));
    }

    function div(euint64 a, uint64 b) internal pure returns (euint64) {
        require(b != 0, "Division by zero");
        return euint64.wrap(euint64.unwrap(a) / uint256(b));
    }

    function rem(euint64 a, euint64 b) internal pure returns (euint64) {
        require(euint64.unwrap(b) != 0, "Modulo by zero");
        return euint64.wrap(euint64.unwrap(a) % euint64.unwrap(b));
    }

    function rem(euint64 a, uint64 b) internal pure returns (euint64) {
        require(b != 0, "Modulo by zero");
        return euint64.wrap(euint64.unwrap(a) % uint256(b));
    }

    function neg(euint64 a) internal pure returns (euint64) {
        // Two's complement negation
        return euint64.wrap(type(uint256).max - euint64.unwrap(a) + 1);
    }

    // ============================================
    // COMPARISON OPERATIONS
    // ============================================

    function eq(euint64 a, euint64 b) internal pure returns (ebool) {
        return ebool.wrap(euint64.unwrap(a) == euint64.unwrap(b) ? 1 : 0);
    }

    function eq(eaddress a, eaddress b) internal pure returns (ebool) {
        return ebool.wrap(eaddress.unwrap(a) == eaddress.unwrap(b) ? 1 : 0);
    }

    function eq(ebool a, ebool b) internal pure returns (ebool) {
        return ebool.wrap(ebool.unwrap(a) == ebool.unwrap(b) ? 1 : 0);
    }

    function ne(euint64 a, euint64 b) internal pure returns (ebool) {
        return ebool.wrap(euint64.unwrap(a) != euint64.unwrap(b) ? 1 : 0);
    }

    function gt(euint64 a, euint64 b) internal pure returns (ebool) {
        return ebool.wrap(euint64.unwrap(a) > euint64.unwrap(b) ? 1 : 0);
    }

    function ge(euint64 a, euint64 b) internal pure returns (ebool) {
        return ebool.wrap(euint64.unwrap(a) >= euint64.unwrap(b) ? 1 : 0);
    }

    function lt(euint64 a, euint64 b) internal pure returns (ebool) {
        return ebool.wrap(euint64.unwrap(a) < euint64.unwrap(b) ? 1 : 0);
    }

    function lt(euint8 a, euint8 b) internal pure returns (ebool) {
        return ebool.wrap(euint8.unwrap(a) < euint8.unwrap(b) ? 1 : 0);
    }

    function le(euint64 a, euint64 b) internal pure returns (ebool) {
        return ebool.wrap(euint64.unwrap(a) <= euint64.unwrap(b) ? 1 : 0);
    }

    // ============================================
    // MIN/MAX OPERATIONS
    // ============================================

    function min(euint64 a, euint64 b) internal pure returns (euint64) {
        return euint64.unwrap(a) < euint64.unwrap(b) ? a : b;
    }

    function max(euint64 a, euint64 b) internal pure returns (euint64) {
        return euint64.unwrap(a) > euint64.unwrap(b) ? a : b;
    }

    // ============================================
    // SELECT OPERATION (Encrypted Ternary)
    // ============================================

    function select(ebool condition, euint64 ifTrue, euint64 ifFalse) internal pure returns (euint64) {
        return ebool.unwrap(condition) == 1 ? ifTrue : ifFalse;
    }

    function select(ebool condition, euint8 ifTrue, euint8 ifFalse) internal pure returns (euint8) {
        return ebool.unwrap(condition) == 1 ? ifTrue : ifFalse;
    }

    function select(ebool condition, ebool ifTrue, ebool ifFalse) internal pure returns (ebool) {
        return ebool.unwrap(condition) == 1 ? ifTrue : ifFalse;
    }

    // ============================================
    // RANDOM NUMBER GENERATION
    // ============================================

    // Storage slot for nonce (computed at compile time)
    bytes32 private constant NONCE_SLOT = keccak256("MockFHE.nonce");

    function randEuint64() internal returns (euint64) {
        uint256 nonce = _getNonce();
        _incrementNonce();
        return euint64.wrap(uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender, nonce))));
    }

    function randEuint8(uint8 upperBound) internal returns (euint8) {
        uint256 nonce = _getNonce();
        _incrementNonce();
        uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender, nonce)));
        return euint8.wrap(random % uint256(upperBound));
    }

    function _getNonce() private view returns (uint256 nonce) {
        bytes32 slot = NONCE_SLOT;
        assembly {
            nonce := sload(slot)
        }
    }

    function _incrementNonce() private {
        bytes32 slot = NONCE_SLOT;
        assembly {
            let nonce := sload(slot)
            sstore(slot, add(nonce, 1))
        }
    }

    // ============================================
    // ACCESS CONTROL (No-op in mock)
    // ============================================

    function allowThis(euint64) internal pure {}
    function allowThis(euint8) internal pure {}
    function allowThis(ebool) internal pure {}
    function allowThis(eaddress) internal pure {}

    function allow(euint64, address) internal pure {}
    function allow(euint8, address) internal pure {}
    function allow(ebool, address) internal pure {}
    function allow(eaddress, address) internal pure {}

    function allowTransient(euint64, address) internal pure {}

    function makePubliclyDecryptable(ebool) internal pure {}

    // ============================================
    // INITIALIZATION CHECK
    // ============================================

    function isInitialized(euint64 value) internal pure returns (bool) {
        return euint64.unwrap(value) != 0;
    }

    function isInitialized(ebool value) internal pure returns (bool) {
        return true; // ebool is always "initialized" in mock
    }
}

/**
 * @title MockZamaConfig
 * @notice Empty config for non-FHE networks
 */
contract MockZamaConfig {
    // No-op - just for interface compatibility
}

// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint64, ebool, externalEuint64, externalEbool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title MultiInputTest
 * @notice Test contract for multiple FHE.fromExternal with same proof
 * @dev Tests if multiple encrypted inputs work correctly
 */
contract MultiInputTest is ZamaEthereumConfig {
    euint64 public storedA;
    euint64 public storedB;
    ebool public storedC;

    event TestSuccess(address indexed user, uint256 timestamp);
    event TestFailed(address indexed user, string reason);

    constructor() {
        storedA = FHE.asEuint64(0);
        storedB = FHE.asEuint64(0);
        storedC = FHE.asEbool(false);

        FHE.allowThis(storedA);
        FHE.allowThis(storedB);
        FHE.allowThis(storedC);
    }

    /**
     * @notice Test with 3 encrypted inputs (same as ShadowVault openPosition)
     * @param encryptedA First euint64
     * @param encryptedB Second euint64
     * @param encryptedC ebool
     * @param inputProof The combined proof
     */
    function testTripleInput(
        externalEuint64 encryptedA,
        externalEuint64 encryptedB,
        externalEbool encryptedC,
        bytes calldata inputProof
    ) external {
        // This is exactly what ShadowVault does
        euint64 a = FHE.fromExternal(encryptedA, inputProof);
        euint64 b = FHE.fromExternal(encryptedB, inputProof);
        ebool c = FHE.fromExternal(encryptedC, inputProof);

        storedA = a;
        storedB = b;
        storedC = c;

        FHE.allowThis(storedA);
        FHE.allow(storedA, msg.sender);

        FHE.allowThis(storedB);
        FHE.allow(storedB, msg.sender);

        FHE.allowThis(storedC);
        FHE.allow(storedC, msg.sender);

        emit TestSuccess(msg.sender, block.timestamp);
    }

    /**
     * @notice Test with 2 encrypted inputs only
     */
    function testDoubleInput(
        externalEuint64 encryptedA,
        externalEuint64 encryptedB,
        bytes calldata inputProof
    ) external {
        euint64 a = FHE.fromExternal(encryptedA, inputProof);
        euint64 b = FHE.fromExternal(encryptedB, inputProof);

        storedA = a;
        storedB = b;

        FHE.allowThis(storedA);
        FHE.allow(storedA, msg.sender);

        FHE.allowThis(storedB);
        FHE.allow(storedB, msg.sender);

        emit TestSuccess(msg.sender, block.timestamp);
    }
}

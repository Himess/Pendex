// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title SimpleCounter
 * @notice Minimal test contract for FHE.fromExternal verification
 * @dev Copied from Zama's fhevm-hardhat-template
 */
contract SimpleCounter is ZamaEthereumConfig {
    euint32 private _count;

    constructor() {
        _count = FHE.asEuint32(0);
        FHE.allowThis(_count);
    }

    function getCount() public view returns (euint32) {
        return _count;
    }

    function increment(
        externalEuint32 inputEuint32,
        bytes calldata inputProof
    ) public {
        // This is the critical line - FHE.fromExternal
        euint32 encryptedEuint32 = FHE.fromExternal(inputEuint32, inputProof);

        _count = FHE.add(_count, encryptedEuint32);
        FHE.allowThis(_count);
        FHE.allow(_count, msg.sender);
    }

    function decrement(
        externalEuint32 inputEuint32,
        bytes calldata inputProof
    ) public {
        euint32 encryptedEuint32 = FHE.fromExternal(inputEuint32, inputProof);

        _count = FHE.sub(_count, encryptedEuint32);
        FHE.allowThis(_count);
        FHE.allow(_count, msg.sender);
    }
}

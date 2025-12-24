// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import { FHE, euint64, ebool, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title MockTokenForTest
 * @notice Simulates ShadowUSD's balance system
 */
contract MockTokenForTest is ZamaEthereumConfig {
    mapping(address => euint64) private _balances;
    address public vault;

    event TransferSuccess(address from, address to);
    event TransferFailed(string reason);

    constructor() {
        vault = address(0); // Will be set later
    }

    function setVault(address _vault) external {
        vault = _vault;
    }

    function mint(address to, uint64 amount) external {
        euint64 encAmount = FHE.asEuint64(amount);
        euint64 current = _balances[to];

        euint64 newBalance;
        if (euint64.unwrap(current) == 0) {
            newBalance = encAmount;
        } else {
            newBalance = FHE.add(current, encAmount);
        }

        _balances[to] = newBalance;
        FHE.allowThis(newBalance);
        FHE.allow(newBalance, to);
    }

    function vaultDeposit(address from, euint64 amount) external returns (bool) {
        require(msg.sender == vault, "Only vault");

        euint64 fromBalance = _balances[from];
        require(euint64.unwrap(fromBalance) != 0, "No balance");

        // This is the critical operation - does ACL work cross-contract?
        ebool hasSufficient = FHE.ge(fromBalance, amount);

        // Deduct from sender
        euint64 newFromBalance = FHE.select(
            hasSufficient,
            FHE.sub(fromBalance, amount),
            fromBalance
        );
        _balances[from] = newFromBalance;
        FHE.allowThis(newFromBalance);
        FHE.allow(newFromBalance, from);

        emit TransferSuccess(from, vault);
        return true;
    }

    function getBalance(address user) external view returns (euint64) {
        return _balances[user];
    }
}

/**
 * @title MockVaultForTest
 * @notice Simulates ShadowVault calling ShadowUSD
 */
contract MockVaultForTest is ZamaEthereumConfig {
    MockTokenForTest public token;

    event VaultDepositAttempt(address user, uint256 timestamp);
    event VaultDepositSuccess(address user, uint256 timestamp);

    constructor(address _token) {
        token = MockTokenForTest(_token);
    }

    /**
     * @notice Simulates ShadowVault.openPosition's flow
     */
    function testCrossContractFHE(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external {
        emit VaultDepositAttempt(msg.sender, block.timestamp);

        // Step 1: FHE.fromExternal (this works - we tested it)
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // Step 2: Grant transient ACL to token contract
        FHE.allowTransient(amount, address(token));

        // Step 3: Call token contract (this is what might be failing)
        bool success = token.vaultDeposit(msg.sender, amount);

        require(success, "Vault deposit failed");
        emit VaultDepositSuccess(msg.sender, block.timestamp);
    }
}

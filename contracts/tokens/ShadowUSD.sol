// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64, externalEuint64, ebool, externalEbool } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";

/**
 * @title ShadowUSD
 * @notice Confidential stablecoin for Shadow Protocol (ERC7984-like)
 * @dev Simplified ERC7984 implementation for demo purposes
 *      All balances are encrypted - nobody can see how much anyone holds
 */
contract ShadowUSD is ZamaEthereumConfig, Ownable2Step {

    /// @notice Token name
    string public constant name = "Shadow USD";

    /// @notice Token symbol
    string public constant symbol = "sUSD";

    /// @notice Token decimals
    uint8 public constant decimals = 6;

    /// @notice Encrypted balances
    mapping(address => euint64) private _balances;

    /// @notice Encrypted allowances
    mapping(address => mapping(address => euint64)) private _allowances;

    /// @notice Operators (ERC-7984 style) - can transfer on behalf of owner
    mapping(address => mapping(address => bool)) private _operators;

    /// @notice Total supply (public for transparency)
    uint256 public totalSupply;

    /// @notice Vault address (can mint/burn)
    address public vault;

    /// @notice Events
    event ConfidentialTransfer(address indexed from, address indexed to);
    event ConfidentialApproval(address indexed owner, address indexed spender);
    event OperatorSet(address indexed owner, address indexed operator, bool approved);
    event Mint(address indexed to, uint256 publicAmount);
    event Burn(address indexed from, uint256 publicAmount);

    constructor(address _owner) Ownable(_owner) {}

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /**
     * @notice Set vault address
     * @param _vault Vault contract address
     */
    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    /**
     * @notice Mint tokens (for testnet faucet)
     * @param to Recipient address
     * @param amount Amount to mint (clear, will be encrypted)
     */
    function mint(address to, uint64 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @notice Public faucet for testnet (anyone can get test tokens)
     * @param amount Amount to mint (max 10,000 sUSD)
     */
    function faucet(uint64 amount) external {
        require(amount <= 10000 * 1e6, "Max 10,000 sUSD per faucet");
        _mint(msg.sender, amount);
    }

    // ============================================
    // ERC-7984 OPERATOR FUNCTIONS
    // ============================================

    /**
     * @notice Set or revoke an operator (ERC-7984)
     * @dev Operators can transfer on behalf of the owner without allowance limits
     * @param operator Address to set as operator
     * @param approved True to approve, false to revoke
     */
    function setOperator(address operator, bool approved) external {
        require(operator != address(0), "Zero address");
        require(operator != msg.sender, "Cannot set self as operator");

        _operators[msg.sender][operator] = approved;
        emit OperatorSet(msg.sender, operator, approved);
    }

    /**
     * @notice Check if an address is an operator for owner
     * @param owner The token owner
     * @param operator The potential operator
     * @return bool True if operator is approved
     */
    function isOperator(address owner, address operator) external view returns (bool) {
        return _operators[owner][operator];
    }

    /**
     * @notice Transfer as operator (full balance access)
     * @param from Owner address
     * @param to Recipient address
     * @param encryptedAmount Encrypted transfer amount
     * @param inputProof ZK proof
     */
    function operatorTransfer(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool) {
        require(_operators[from][msg.sender], "Not an operator");
        require(to != address(0), "Transfer to zero address");

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _transfer(from, to, amount);

        return true;
    }

    /**
     * @notice Operator transfer with internal euint64
     * @param from Owner address
     * @param to Recipient address
     * @param amount Encrypted amount (internal)
     */
    function operatorTransferInternal(
        address from,
        address to,
        euint64 amount
    ) external returns (bool) {
        require(_operators[from][msg.sender], "Not an operator");
        require(to != address(0), "Transfer to zero address");

        _transfer(from, to, amount);

        return true;
    }

    // ============================================
    // INTERNAL MINT/BURN
    // ============================================

    function _mint(address to, uint64 amount) internal {
        require(to != address(0), "Mint to zero address");

        euint64 encryptedAmount = FHE.asEuint64(amount);
        euint64 currentBalance = _balances[to];

        euint64 newBalance;
        if (euint64.unwrap(currentBalance) == 0) {
            newBalance = encryptedAmount;
        } else {
            newBalance = FHE.add(currentBalance, encryptedAmount);
        }

        _balances[to] = newBalance;
        totalSupply += amount;

        FHE.allowThis(newBalance);
        FHE.allow(newBalance, to);

        emit Mint(to, amount);
    }

    // ============================================
    // ERC7984-LIKE FUNCTIONS
    // ============================================

    /**
     * @notice Get encrypted balance
     * @param account Account address
     * @return Encrypted balance (only account owner can decrypt)
     */
    function confidentialBalanceOf(address account) external view returns (euint64) {
        return _balances[account];
    }

    /**
     * @notice Transfer tokens (encrypted amount)
     * @param to Recipient address
     * @param encryptedAmount Encrypted transfer amount
     * @param inputProof ZK proof
     */
    function confidentialTransfer(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool) {
        require(to != address(0), "Transfer to zero address");

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        _transfer(msg.sender, to, amount);

        return true;
    }

    /**
     * @notice Transfer tokens using internal euint64
     * @param to Recipient address
     * @param amount Encrypted amount
     */
    function confidentialTransferInternal(
        address to,
        euint64 amount
    ) external returns (bool) {
        require(to != address(0), "Transfer to zero address");

        _transfer(msg.sender, to, amount);

        return true;
    }

    /**
     * @notice Approve spender (encrypted amount)
     * @param spender Spender address
     * @param encryptedAmount Encrypted approval amount
     * @param inputProof ZK proof
     */
    function confidentialApprove(
        address spender,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        _allowances[msg.sender][spender] = amount;

        FHE.allowThis(amount);
        FHE.allow(amount, msg.sender);
        FHE.allow(amount, spender);

        emit ConfidentialApproval(msg.sender, spender);

        return true;
    }

    /**
     * @notice Transfer from (encrypted amount)
     * @param from Sender address
     * @param to Recipient address
     * @param encryptedAmount Encrypted amount
     * @param inputProof ZK proof
     */
    function confidentialTransferFrom(
        address from,
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bool) {
        require(to != address(0), "Transfer to zero address");

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        // Check allowance
        euint64 currentAllowance = _allowances[from][msg.sender];
        ebool hasAllowance = FHE.ge(currentAllowance, amount);

        // Deduct from allowance
        euint64 newAllowance = FHE.select(
            hasAllowance,
            FHE.sub(currentAllowance, amount),
            currentAllowance
        );
        _allowances[from][msg.sender] = newAllowance;
        FHE.allowThis(newAllowance);
        FHE.allow(newAllowance, from);
        FHE.allow(newAllowance, msg.sender);

        // Perform transfer
        _transfer(from, to, amount);

        return true;
    }

    /**
     * @notice Get encrypted allowance
     * @param owner Owner address
     * @param spender Spender address
     */
    function confidentialAllowance(
        address owner,
        address spender
    ) external view returns (euint64) {
        return _allowances[owner][spender];
    }

    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================

    function _transfer(
        address from,
        address to,
        euint64 amount
    ) internal {
        euint64 fromBalance = _balances[from];
        require(euint64.unwrap(fromBalance) != 0, "Insufficient balance");

        // Check sufficient balance
        ebool hasSufficientBalance = FHE.ge(fromBalance, amount);

        // Deduct from sender
        euint64 newFromBalance = FHE.select(
            hasSufficientBalance,
            FHE.sub(fromBalance, amount),
            fromBalance
        );
        _balances[from] = newFromBalance;
        FHE.allowThis(newFromBalance);
        FHE.allow(newFromBalance, from);

        // Add to recipient
        euint64 toBalance = _balances[to];
        euint64 newToBalance;

        if (euint64.unwrap(toBalance) == 0) {
            newToBalance = FHE.select(hasSufficientBalance, amount, FHE.asEuint64(0));
        } else {
            newToBalance = FHE.select(
                hasSufficientBalance,
                FHE.add(toBalance, amount),
                toBalance
            );
        }
        _balances[to] = newToBalance;
        FHE.allowThis(newToBalance);
        FHE.allow(newToBalance, to);

        emit ConfidentialTransfer(from, to);
    }

    // ============================================
    // VAULT FUNCTIONS
    // ============================================

    /**
     * @notice Vault deposits user's tokens
     * @param from User address
     * @param amount Encrypted amount
     */
    function vaultDeposit(
        address from,
        euint64 amount
    ) external returns (bool) {
        require(msg.sender == vault, "Only vault");

        _transfer(from, vault, amount);

        return true;
    }

    /**
     * @notice Vault withdraws to user
     * @param to User address
     * @param amount Encrypted amount
     */
    function vaultWithdraw(
        address to,
        euint64 amount
    ) external returns (bool) {
        require(msg.sender == vault, "Only vault");

        _transfer(vault, to, amount);

        return true;
    }

    // ============================================
    // ADVANCED FHE FEATURES
    // ============================================

    /**
     * @notice Compare two balances (encrypted comparison)
     * @dev Uses FHE.gt() - neither party learns the actual values
     * @param user1 First user
     * @param user2 Second user
     * @return result Encrypted boolean (true if user1 > user2)
     */
    function compareBalances(
        address user1,
        address user2
    ) external returns (ebool result) {
        euint64 balance1 = _balances[user1];
        euint64 balance2 = _balances[user2];

        // FHE.isInitialized() checks
        require(FHE.isInitialized(balance1), "User1 has no balance");
        require(FHE.isInitialized(balance2), "User2 has no balance");

        result = FHE.gt(balance1, balance2);

        // Only caller can see result
        FHE.allowThis(result);
        FHE.allow(result, msg.sender);

        return result;
    }

    /**
     * @notice Get the minimum of two balances (encrypted)
     * @dev Uses FHE.min() for privacy-preserving minimum
     * @param user1 First user
     * @param user2 Second user
     * @return minBalance The smaller balance (encrypted)
     */
    function getMinBalance(
        address user1,
        address user2
    ) external returns (euint64 minBalance) {
        euint64 balance1 = _balances[user1];
        euint64 balance2 = _balances[user2];

        minBalance = FHE.min(balance1, balance2);

        FHE.allowThis(minBalance);
        FHE.allow(minBalance, msg.sender);

        return minBalance;
    }

    /**
     * @notice Encrypted balance check (without revealing if sufficient)
     * @dev Uses FHE.ge() for encrypted comparison
     * @param user User to check
     * @param encryptedThreshold Encrypted threshold amount
     * @param inputProof ZK proof
     * @return hasSufficient Encrypted boolean result
     */
    function hasMinimumBalance(
        address user,
        externalEuint64 encryptedThreshold,
        bytes calldata inputProof
    ) external returns (ebool hasSufficient) {
        euint64 threshold = FHE.fromExternal(encryptedThreshold, inputProof);
        euint64 balance = _balances[user];

        require(FHE.isInitialized(balance), "No balance");

        hasSufficient = FHE.ge(balance, threshold);

        FHE.allowThis(hasSufficient);
        FHE.allow(hasSufficient, msg.sender);

        return hasSufficient;
    }

    /**
     * @notice Encrypted conditional transfer
     * @dev Only transfers if condition is met (encrypted condition!)
     * @param to Recipient
     * @param encryptedAmount Amount to transfer
     * @param encryptedCondition Encrypted boolean condition
     * @param inputProof ZK proof
     */
    function conditionalTransfer(
        address to,
        externalEuint64 encryptedAmount,
        externalEbool encryptedCondition,
        bytes calldata inputProof
    ) external returns (bool) {
        require(to != address(0), "Transfer to zero");

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        ebool condition = FHE.fromExternal(encryptedCondition, inputProof);

        // Use FHE.select() - transfer only if condition is true
        euint64 transferAmount = FHE.select(
            condition,
            amount,
            FHE.asEuint64(0)  // Transfer 0 if condition is false
        );

        _transfer(msg.sender, to, transferAmount);

        return true;
    }

    /**
     * @notice Split balance between two recipients (encrypted ratios)
     * @dev Advanced FHE: encrypted arithmetic for splitting
     * @param recipient1 First recipient
     * @param recipient2 Second recipient
     * @param encryptedRatio Percentage to recipient1 (0-100)
     * @param inputProof ZK proof
     */
    function splitTransfer(
        address recipient1,
        address recipient2,
        externalEuint64 encryptedTotalAmount,
        externalEuint64 encryptedRatio,
        bytes calldata inputProof
    ) external returns (bool) {
        require(recipient1 != address(0) && recipient2 != address(0), "Zero address");

        euint64 totalAmount = FHE.fromExternal(encryptedTotalAmount, inputProof);
        euint64 ratio = FHE.fromExternal(encryptedRatio, inputProof);

        // Calculate split: amount1 = total * ratio / 100
        euint64 amount1 = FHE.div(FHE.mul(totalAmount, ratio), 100);
        euint64 amount2 = FHE.sub(totalAmount, amount1);

        // Transfer to both recipients
        _transfer(msg.sender, recipient1, amount1);
        _transfer(msg.sender, recipient2, amount2);

        return true;
    }

    /**
     * @notice Check if balance is initialized
     * @dev Wrapper for FHE.isInitialized()
     */
    function isBalanceInitialized(address user) external view returns (bool) {
        return FHE.isInitialized(_balances[user]);
    }
}

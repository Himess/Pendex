// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint256, externalEuint256 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title WalletManager
 * @notice Manages encrypted session wallet keys for popup-free trading
 * @dev Uses Zama FHE to encrypt/decrypt private keys on-chain
 *
 * Flow:
 * 1. User creates session wallet locally
 * 2. Private key is encrypted with FHE
 * 3. Encrypted key stored on-chain
 * 4. Each session, user decrypts key using FHE ACL
 * 5. Session wallet signs trades (no MetaMask popup!)
 */
contract WalletManager is ZamaEthereumConfig, Ownable2Step, ReentrancyGuard {

    // ============ Structs ============

    struct SessionWallet {
        euint256 encryptedPrivateKey;   // FHE encrypted private key
        address sessionAddress;          // Public address of session wallet
        uint256 createdAt;
        uint256 lastUsedAt;
        bool isActive;
    }

    // ============ State Variables ============

    /// @notice Main wallet → Session wallet data
    mapping(address => SessionWallet) private sessionWallets;

    /// @notice Session address → Main wallet (reverse lookup)
    mapping(address => address) public sessionToMain;

    /// @notice Allowed contracts that session wallet can interact with
    mapping(address => bool) public allowedContracts;

    // ============ Events ============

    event SessionWalletCreated(
        address indexed mainWallet,
        address indexed sessionAddress,
        uint256 timestamp
    );

    event SessionWalletRevoked(
        address indexed mainWallet,
        address indexed sessionAddress,
        uint256 timestamp
    );

    event SessionWalletUsed(
        address indexed sessionAddress,
        uint256 timestamp
    );

    event AllowedContractUpdated(
        address indexed contractAddress,
        bool allowed
    );

    // ============ Errors ============

    error SessionWalletAlreadyExists();
    error SessionWalletNotFound();
    error SessionWalletInactive();
    error UnauthorizedAccess();
    error InvalidSessionAddress();
    error CallerNotAllowed();

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {
        // Allowed contracts will be set after deployment via setAllowedContract
    }

    // ============ Main Functions ============

    /**
     * @notice Store encrypted session wallet private key
     * @param encryptedKey The FHE encrypted private key (externalEuint256)
     * @param inputProof Proof for the encrypted input
     * @param sessionAddress Public address derived from the private key
     */
    function storeSessionKey(
        externalEuint256 encryptedKey,
        bytes calldata inputProof,
        address sessionAddress
    ) external nonReentrant {
        // Check if session wallet already exists
        if (sessionWallets[msg.sender].isActive) {
            revert SessionWalletAlreadyExists();
        }

        // Validate session address
        if (sessionAddress == address(0) || sessionAddress == msg.sender) {
            revert InvalidSessionAddress();
        }

        // Convert external input to euint256 using FHE.fromExternal
        euint256 privateKey = FHE.fromExternal(encryptedKey, inputProof);

        // Store session wallet data
        sessionWallets[msg.sender] = SessionWallet({
            encryptedPrivateKey: privateKey,
            sessionAddress: sessionAddress,
            createdAt: block.timestamp,
            lastUsedAt: block.timestamp,
            isActive: true
        });

        // Set reverse lookup
        sessionToMain[sessionAddress] = msg.sender;

        // Grant ACL permission to main wallet for decryption
        FHE.allow(privateKey, msg.sender);
        FHE.allowThis(privateKey);

        emit SessionWalletCreated(msg.sender, sessionAddress, block.timestamp);
    }

    /**
     * @notice Get encrypted session key (only main wallet can decrypt via ACL)
     * @return The encrypted private key handle
     * @dev This is a VIEW function - no TX needed! Decryption happens off-chain.
     */
    function getSessionKey() external view returns (euint256) {
        SessionWallet storage wallet = sessionWallets[msg.sender];

        if (!wallet.isActive) {
            revert SessionWalletNotFound();
        }

        return wallet.encryptedPrivateKey;
    }

    /**
     * @notice Get session wallet info (public data only)
     * @param mainWallet The main wallet address
     * @return sessionAddress The session wallet address
     * @return createdAt When the session was created
     * @return lastUsedAt Last usage timestamp
     * @return isActive Whether the session is active
     */
    function getSessionInfo(address mainWallet) external view returns (
        address sessionAddress,
        uint256 createdAt,
        uint256 lastUsedAt,
        bool isActive
    ) {
        SessionWallet storage wallet = sessionWallets[mainWallet];
        return (
            wallet.sessionAddress,
            wallet.createdAt,
            wallet.lastUsedAt,
            wallet.isActive
        );
    }

    /**
     * @notice Check if an address is a valid session wallet
     * @param sessionAddress The address to check
     * @return True if the address is an active session wallet
     */
    function isValidSession(address sessionAddress) external view returns (bool) {
        address mainWallet = sessionToMain[sessionAddress];
        if (mainWallet == address(0)) return false;
        return sessionWallets[mainWallet].isActive;
    }

    /**
     * @notice Get main wallet for a session address
     * @param sessionAddress The session wallet address
     * @return The main wallet address (or address(0) if not found)
     */
    function getMainWallet(address sessionAddress) external view returns (address) {
        return sessionToMain[sessionAddress];
    }

    /**
     * @notice Revoke session wallet
     * @dev Only the main wallet owner can revoke their session
     */
    function revokeSessionWallet() external nonReentrant {
        SessionWallet storage wallet = sessionWallets[msg.sender];

        if (!wallet.isActive) {
            revert SessionWalletNotFound();
        }

        address sessionAddress = wallet.sessionAddress;

        // Clear reverse lookup
        delete sessionToMain[sessionAddress];

        // Deactivate (keep data for audit purposes)
        wallet.isActive = false;

        emit SessionWalletRevoked(msg.sender, sessionAddress, block.timestamp);
    }

    /**
     * @notice Update last used timestamp (called by allowed contracts)
     * @param sessionAddress The session wallet address
     * @dev Only allowed contracts (ShadowVault, etc.) can call this
     */
    function recordUsage(address sessionAddress) external {
        if (!allowedContracts[msg.sender]) {
            revert CallerNotAllowed();
        }

        address mainWallet = sessionToMain[sessionAddress];
        if (mainWallet != address(0) && sessionWallets[mainWallet].isActive) {
            sessionWallets[mainWallet].lastUsedAt = block.timestamp;
            emit SessionWalletUsed(sessionAddress, block.timestamp);
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Set allowed contract status
     * @param contractAddress The contract address
     * @param allowed Whether the contract is allowed to call recordUsage
     */
    function setAllowedContract(address contractAddress, bool allowed) external onlyOwner {
        allowedContracts[contractAddress] = allowed;
        emit AllowedContractUpdated(contractAddress, allowed);
    }

    /**
     * @notice Check if session wallet has enough ETH for gas
     * @param sessionAddress The session wallet to check
     * @param minBalance Minimum required balance in wei
     * @return True if balance is sufficient
     */
    function hasEnoughGas(address sessionAddress, uint256 minBalance) external view returns (bool) {
        return sessionAddress.balance >= minBalance;
    }

    /**
     * @notice Check if a main wallet has a session wallet
     * @param mainWallet The main wallet to check
     * @return True if the main wallet has an active session
     */
    function hasSessionWallet(address mainWallet) external view returns (bool) {
        return sessionWallets[mainWallet].isActive;
    }
}

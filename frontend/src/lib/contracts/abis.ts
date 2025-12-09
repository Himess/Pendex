// Contract ABIs - Update these after deployment
// These are placeholder ABIs based on the Solidity contracts

export const SHADOW_VAULT_ABI = [
  // Read functions
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getBalance",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "positionId", type: "uint256" }],
    name: "getPosition",
    outputs: [
      {
        components: [
          { name: "owner", type: "address" },
          { name: "assetId", type: "bytes32" },
          { name: "collateral", type: "bytes32" },
          { name: "leverage", type: "bytes32" },
          { name: "isLong", type: "bytes32" },
          { name: "entryPrice", type: "bytes32" },
          { name: "isOpen", type: "bool" },
          { name: "openTimestamp", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getUserPositions",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  // Write functions
  {
    inputs: [
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "assetId", type: "bytes32" },
      { name: "encryptedCollateral", type: "bytes32" },
      { name: "encryptedLeverage", type: "bytes32" },
      { name: "encryptedIsLong", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    name: "openPosition",
    outputs: [{ name: "positionId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "positionId", type: "uint256" }],
    name: "closePosition",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "amount", type: "bytes32" },
    ],
    name: "Deposit",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "user", type: "address" },
      { indexed: false, name: "amount", type: "bytes32" },
    ],
    name: "Withdraw",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "positionId", type: "uint256" },
      { indexed: true, name: "owner", type: "address" },
      { indexed: false, name: "assetId", type: "bytes32" },
    ],
    name: "PositionOpened",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "positionId", type: "uint256" },
      { indexed: true, name: "owner", type: "address" },
    ],
    name: "PositionClosed",
    type: "event",
  },
] as const;

export const SHADOW_ORACLE_ABI = [
  {
    inputs: [{ name: "assetId", type: "bytes32" }],
    name: "getAsset",
    outputs: [
      {
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "basePrice", type: "uint64" },
          { name: "isActive", type: "bool" },
          { name: "totalLongOI", type: "uint256" },
          { name: "totalShortOI", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "assetId", type: "bytes32" }],
    name: "getCurrentPrice",
    outputs: [{ name: "", type: "uint64" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "assetId", type: "bytes32" }],
    name: "getEncryptedPrice",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "getAllAssetIds",
    outputs: [{ name: "", type: "bytes32[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "assetId", type: "bytes32" }],
    name: "isAssetTradeable",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const SHADOW_USD_ABI = [
  // ERC20 standard
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  // Confidential functions
  {
    inputs: [{ name: "account", type: "address" }],
    name: "confidentialBalanceOf",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    name: "confidentialTransfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    name: "confidentialApprove",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    name: "confidentialTransferFrom",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "confidentialAllowance",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  // Faucet
  {
    inputs: [{ name: "amount", type: "uint64" }],
    name: "faucet",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Token info
  {
    inputs: [],
    name: "name",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ============ SHADOW LIQUIDITY POOL ABI ============
export const SHADOW_LIQUIDITY_POOL_ABI = [
  // View functions
  {
    inputs: [],
    name: "totalLiquidity",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalLpTokens",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "currentEpoch",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "lastEpochTimestamp",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "epochFees",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "epochPnL",
    outputs: [{ name: "", type: "int256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "currentUtilization",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "depositTimestamp",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "lastClaimedEpoch",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getLpBalance",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getPendingRewards",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getCurrentApy",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getTimeUntilUnlock",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getTimeUntilNextEpoch",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getPoolStats",
    outputs: [
      { name: "_totalLiquidity", type: "uint256" },
      { name: "_totalLpTokens", type: "uint256" },
      { name: "_currentUtilization", type: "uint256" },
      { name: "_utilizationRate", type: "uint256" },
      { name: "_currentEpoch", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  // Write functions
  {
    inputs: [{ name: "amount", type: "uint64" }],
    name: "addLiquidity",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "lpTokens", type: "uint64" }],
    name: "removeLiquidity",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "claimRewards",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "advanceEpoch",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "provider", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "lpTokens", type: "uint256" },
    ],
    name: "LiquidityAdded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "provider", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "lpTokens", type: "uint256" },
    ],
    name: "LiquidityRemoved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "provider", type: "address" },
      { indexed: false, name: "epoch", type: "uint256" },
    ],
    name: "RewardsClaimed",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "epoch", type: "uint256" },
      { indexed: false, name: "fees", type: "uint256" },
      { indexed: false, name: "pnl", type: "int256" },
    ],
    name: "EpochAdvanced",
    type: "event",
  },
] as const;

// Network types
export type SupportedNetwork = "sepolia" | "hardhat";

// Contract addresses per network
export const NETWORK_CONTRACTS = {
  sepolia: {
    // Session 10 - FHE.allowTransient Fix for Cross-Contract Calls
    shadowVault: "0x1713d51049EA31c19545De7f47AcB909e1050a71" as `0x${string}`,
    shadowOracle: "0xadee307469f5FEF36485aB0194Bc1C042b7Cd2FE" as `0x${string}`,
    shadowUsd: "0x6C365a341C2A7D94cb0204A3f22CC810A7357F18" as `0x${string}`,
    shadowLiquidityPool: "0xF15e759229dc61f7ece238503368B1a0BafF0773" as `0x${string}`,
    walletManager: "0x547481AC8130e985288BD36Cb9ba81204656eB7A" as `0x${string}`,
    hasFHE: true, // Sepolia with Zama FHE encryption
  },
  hardhat: {
    shadowVault: "0x5FbDB2315678afecb367f032d93F642f64180aa3" as `0x${string}`,
    shadowOracle: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as `0x${string}`,
    shadowUsd: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" as `0x${string}`,
    shadowLiquidityPool: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9" as `0x${string}`,
    shadowMarketMaker: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9" as `0x${string}`,
    hasFHE: false, // Hardhat uses mock FHE
  },
} as const;

// Legacy export for backward compatibility
export const CONTRACTS = NETWORK_CONTRACTS.sepolia;

// Sepolia chain config (already in wagmi)
export const SEPOLIA_CONFIG = {
  id: 11155111,
  name: "Sepolia",
  network: "sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Sepolia Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"],
    },
    public: {
      http: ["https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"],
    },
  },
  blockExplorers: {
    default: {
      name: "Etherscan",
      url: "https://sepolia.etherscan.io",
    },
  },
  testnet: true,
} as const;

// Hardhat Localhost chain config
export const HARDHAT_LOCALHOST = {
  id: 31337,
  name: "Hardhat Localhost",
  network: "hardhat",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
    public: {
      http: ["http://127.0.0.1:8545"],
    },
  },
  blockExplorers: {
    default: {
      name: "Local Explorer",
      url: "http://localhost:8545",
    },
  },
  testnet: true,
} as const;

// Network info for UI
export const NETWORK_INFO = {
  sepolia: {
    name: "Sepolia + Zama FHE",
    shortName: "Sepolia",
    chainId: 11155111,
    icon: "lock",
    description: "FHE encrypted - all trades private on Sepolia",
    badge: "FHE",
    badgeColor: "text-green-500",
  },
  hardhat: {
    name: "Hardhat Localhost",
    shortName: "Localhost",
    chainId: 31337,
    icon: "ethereum",
    description: "Local development - mock FHE",
    badge: "Dev",
    badgeColor: "text-yellow-500",
  },
} as const;

// FHE Gateway URL for decryption
export const FHE_GATEWAY_URL = "https://gateway.devnet.zama.ai";

// Helper to get contracts for current network
export function getContractsForNetwork(network: SupportedNetwork) {
  return NETWORK_CONTRACTS[network];
}

// Helper to get chain ID
export function getChainId(network: SupportedNetwork): number {
  return network === "sepolia" ? 11155111 : 31337;
}

// Asset IDs (keccak256 of asset symbols) - Only 6 supported assets
export const ASSET_IDS: Record<string, `0x${string}`> = {
  spacex: "0x9fd352ac95c287d47bbccf4420d92735fe50f15b7f1bdc85ae12490f555114ab" as `0x${string}`,
  bytedance: "0x7a8e8d0c5008129e8077f29f2b784b6f889f3420f121d5b70b5b3326476bbce1" as `0x${string}`,
  openai: "0xbfe1b9d697e35df099bb4711224ecb98f2ce33a5a09fa3cf15dfb83fc9ec3cd9" as `0x${string}`,
  stripe: "0x8eddee8eb3ba76411ebdccf6d0ad00841d58a803916546a295c2b0346ea86a11" as `0x${string}`,
  databricks: "0x0bf812f25cacc694be173fe6fd2b56e3f94f71dcee99e1f1280b2ce7fba46fca" as `0x${string}`,
  anthropic: "0xee2176d5e35f81b98746f5f98677beb44f0167ae70b6518fbb5b5bdc65da8fdd" as `0x${string}`,
};

// LP Pool Constants
export const LP_CONSTANTS = {
  LOCK_PERIOD: 24 * 60 * 60, // 24 hours in seconds
  EPOCH_DURATION: 24 * 60 * 60, // 24 hours in seconds
  MAX_UTILIZATION: 8000, // 80% in basis points
  PROTOCOL_FEE_SHARE: 5000, // 50% in basis points
} as const;

// Network types
export type SupportedNetwork = "sepolia" | "zama";

// Contract addresses per network
export const NETWORK_CONTRACTS = {
  sepolia: {
    shadowVault: "0xf6C0B8C7332080790a9425c0B888F74e8e9ff5B5" as `0x${string}`,
    shadowOracle: "0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17" as `0x${string}`,
    shadowUsd: "0x9093B02c4Ea2402EC72C2ca9dAAb994F7578fAFb" as `0x${string}`,
    shadowLiquidityPool: "0xF6d944B4B4cDE683111135e43C4D0235Cf14ECDc" as `0x${string}`,
    shadowMarketMaker: "0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb" as `0x${string}`,
    hasFHE: false, // Sepolia uses mock/simple contracts
  },
  zama: {
    shadowVault: "0x..." as `0x${string}`, // Will be updated after Zama deployment
    shadowOracle: "0x..." as `0x${string}`,
    shadowUsd: "0x..." as `0x${string}`,
    shadowLiquidityPool: "0x..." as `0x${string}`,
    shadowMarketMaker: "0x..." as `0x${string}`,
    hasFHE: true, // Zama has real FHE encryption
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
      http: ["https://sepolia.infura.io/v3/84842078b09946638c03157f83405213"],
    },
    public: {
      http: ["https://rpc.sepolia.org"],
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

// Zama Devnet chain config
export const ZAMA_DEVNET = {
  id: 8009,
  name: "Zama Devnet",
  network: "zama-devnet",
  nativeCurrency: {
    decimals: 18,
    name: "Zama",
    symbol: "ZAMA",
  },
  rpcUrls: {
    default: {
      http: ["https://devnet.zama.ai"],
    },
    public: {
      http: ["https://devnet.zama.ai"],
    },
  },
  blockExplorers: {
    default: {
      name: "Zama Explorer",
      url: "https://explorer.devnet.zama.ai",
    },
  },
  testnet: true,
} as const;

// Network info for UI
export const NETWORK_INFO = {
  sepolia: {
    name: "Sepolia Testnet",
    shortName: "Sepolia",
    chainId: 11155111,
    icon: "ethereum",
    description: "Ethereum testnet - trades visible on-chain",
    badge: "Public",
    badgeColor: "text-yellow-500",
  },
  zama: {
    name: "Zama Devnet",
    shortName: "Zama FHE",
    chainId: 8009,
    icon: "lock",
    description: "FHE encrypted - all trades private",
    badge: "Private",
    badgeColor: "text-green-500",
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
  return network === "sepolia" ? 11155111 : 8009;
}

// Asset IDs (keccak256 of asset symbols)
export const ASSET_IDS: Record<string, `0x${string}`> = {
  openai: "0x" as `0x${string}`, // keccak256("OPENAI")
  anthropic: "0x" as `0x${string}`,
  xai: "0x" as `0x${string}`,
  perplexity: "0x" as `0x${string}`,
  groq: "0x" as `0x${string}`,
  spacex: "0x" as `0x${string}`,
  anduril: "0x" as `0x${string}`,
  shieldai: "0x" as `0x${string}`,
  stripe: "0x" as `0x${string}`,
  revolut: "0x" as `0x${string}`,
  ripple: "0x" as `0x${string}`,
  kraken: "0x" as `0x${string}`,
  databricks: "0x" as `0x${string}`,
  canva: "0x" as `0x${string}`,
  vercel: "0x" as `0x${string}`,
  bytedance: "0x" as `0x${string}`,
  discord: "0x" as `0x${string}`,
};

// LP Pool Constants
export const LP_CONSTANTS = {
  LOCK_PERIOD: 24 * 60 * 60, // 24 hours in seconds
  EPOCH_DURATION: 24 * 60 * 60, // 24 hours in seconds
  MAX_UTILIZATION: 8000, // 80% in basis points
  PROTOCOL_FEE_SHARE: 5000, // 50% in basis points
} as const;

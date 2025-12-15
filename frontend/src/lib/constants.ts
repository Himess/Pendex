// Pre-IPO Assets Data
// Selected top 6 most valuable pre-IPO companies for focused trading experience

export const CATEGORIES = {
  AI: { id: 0, name: "AI & ML" },
  AEROSPACE: { id: 1, name: "Aerospace" },
  FINTECH: { id: 2, name: "FinTech" },
  DATA: { id: 3, name: "Data" },
  SOCIAL: { id: 4, name: "Social" },
} as const;

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  price: number; // Synthetic share price (valuation / 1B shares)
  change24h: number;
  category: keyof typeof CATEGORIES;
  logo?: string;
  marketCap: number; // Company valuation in billions (e.g., 250 = $250B)
  // Note: price = marketCap (in $) since we assume 1B synthetic shares
  // Example: SpaceX $350B valuation → price = $350 per synthetic share
}

// Logo URLs from Clearbit/public sources
const LOGOS = {
  openai: "https://logo.clearbit.com/openai.com",
  anthropic: "https://logo.clearbit.com/anthropic.com",
  spacex: "https://logo.clearbit.com/spacex.com",
  stripe: "https://logo.clearbit.com/stripe.com",
  databricks: "https://logo.clearbit.com/databricks.com",
  bytedance: "https://logo.clearbit.com/bytedance.com",
};

// Top 6 Pre-IPO Companies by Valuation
export const ASSETS: Asset[] = [
  // #1 - Aerospace
  { id: "spacex", symbol: "SPACEX", name: "SpaceX", price: 350, change24h: 1.2, category: "AEROSPACE", logo: LOGOS.spacex, marketCap: 350 },

  // #2 - Social & Consumer
  { id: "bytedance", symbol: "BYTEDANCE", name: "ByteDance", price: 300, change24h: -0.8, category: "SOCIAL", logo: LOGOS.bytedance, marketCap: 300 },

  // #3 - AI & ML
  { id: "openai", symbol: "OPENAI", name: "OpenAI", price: 157, change24h: 2.5, category: "AI", logo: LOGOS.openai, marketCap: 157 },

  // #4 - FinTech
  { id: "stripe", symbol: "STRIPE", name: "Stripe", price: 70, change24h: 0.9, category: "FINTECH", logo: LOGOS.stripe, marketCap: 70 },

  // #5 - Data & Enterprise
  { id: "databricks", symbol: "DATABRICKS", name: "Databricks", price: 62, change24h: 1.5, category: "DATA", logo: LOGOS.databricks, marketCap: 62 },

  // #6 - AI & ML
  { id: "anthropic", symbol: "ANTHROPIC", name: "Anthropic", price: 61, change24h: 1.8, category: "AI", logo: LOGOS.anthropic, marketCap: 61 },
];

// Contract Addresses (Sepolia Testnet)
export const CONTRACT_ADDRESSES = {
  SHADOW_VAULT: "0xf6C0B8C7332080790a9425c0B888F74e8e9ff5B5",
  SHADOW_ORACLE: "0xe0Fa3bbeF65d8Cda715645AE02a50874C04BCb17",
  SHADOW_USD: "0x9093B02c4Ea2402EC72C2ca9dAAb994F7578fAFb",
  SHADOW_LIQUIDITY_POOL: "0x...", // Add actual address if deployed
  SHADOW_MARKET_MAKER: "0x4831ac8D60cF7f1B01DeEeA12B3A0fDB083355fb",
} as const;

// Leverage Options
export const LEVERAGE_OPTIONS = [1, 2, 3, 5, 10] as const;

// Format helpers
export const formatUSD = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatPercent = (value: number): string => {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
};

export const formatEncrypted = (): string => {
  return "••••••••";
};

export const formatMarketCap = (billions: number): string => {
  if (billions >= 1000) {
    return `$${(billions / 1000).toFixed(1)}T`;
  }
  return `$${billions.toFixed(1)}B`;
};

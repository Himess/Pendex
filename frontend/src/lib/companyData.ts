// Company data - matches the 6 tradable assets
// Source: Secondary market valuations Q3 2025

export type CompanyCategory = 'AI' | 'AEROSPACE' | 'FINTECH' | 'DATA' | 'SOCIAL';

export interface Company {
  rank: number;
  symbol: string;
  name: string;
  description: string;
  category: CompanyCategory;
  valuationBn: number; // Billion USD
  rankChange: number | 'NEW'; // positive = up, negative = down, 0 = same
  logo?: string;
  // Company details
  founded: number;
  hq: string;
  ceo: string;
  employees: string;
  website: string;
}

// Logo URLs from Clearbit
const LOGOS: Record<string, string> = {
  spacex: 'https://logo.clearbit.com/spacex.com',
  bytedance: 'https://logo.clearbit.com/bytedance.com',
  openai: 'https://logo.clearbit.com/openai.com',
  stripe: 'https://logo.clearbit.com/stripe.com',
  databricks: 'https://logo.clearbit.com/databricks.com',
  anthropic: 'https://logo.clearbit.com/anthropic.com',
};

// 6 tradable pre-IPO assets
export const companies: Company[] = [
  {
    rank: 1,
    symbol: 'SPACEX',
    name: 'SpaceX',
    description: 'Aerospace manufacturer - Falcon rockets, Starlink, Starship',
    category: 'AEROSPACE',
    valuationBn: 350.0,
    rankChange: 0,
    logo: LOGOS.spacex,
    founded: 2002,
    hq: 'Hawthorne, CA',
    ceo: 'Elon Musk',
    employees: '13,000+',
    website: 'spacex.com',
  },
  {
    rank: 2,
    symbol: 'BYTEDANCE',
    name: 'ByteDance',
    description: 'Social media giant - TikTok, Douyin, Toutiao parent company',
    category: 'SOCIAL',
    valuationBn: 300.0,
    rankChange: 0,
    logo: LOGOS.bytedance,
    founded: 2012,
    hq: 'Beijing, China',
    ceo: 'Liang Rubo',
    employees: '150,000+',
    website: 'bytedance.com',
  },
  {
    rank: 3,
    symbol: 'OPENAI',
    name: 'OpenAI',
    description: 'AI research lab - Creator of ChatGPT, GPT-4, DALL-E',
    category: 'AI',
    valuationBn: 157.0,
    rankChange: 0,
    logo: LOGOS.openai,
    founded: 2015,
    hq: 'San Francisco, CA',
    ceo: 'Sam Altman',
    employees: '3,000+',
    website: 'openai.com',
  },
  {
    rank: 4,
    symbol: 'STRIPE',
    name: 'Stripe',
    description: 'Online payment processing platform for internet businesses',
    category: 'FINTECH',
    valuationBn: 70.0,
    rankChange: 0,
    logo: LOGOS.stripe,
    founded: 2010,
    hq: 'San Francisco, CA',
    ceo: 'Patrick Collison',
    employees: '8,000+',
    website: 'stripe.com',
  },
  {
    rank: 5,
    symbol: 'DATABRICKS',
    name: 'Databricks',
    description: 'Unified data analytics and AI platform',
    category: 'DATA',
    valuationBn: 62.0,
    rankChange: 0,
    logo: LOGOS.databricks,
    founded: 2013,
    hq: 'San Francisco, CA',
    ceo: 'Ali Ghodsi',
    employees: '7,000+',
    website: 'databricks.com',
  },
  {
    rank: 6,
    symbol: 'ANTHROPIC',
    name: 'Anthropic',
    description: 'AI safety company and creator of Claude AI assistant',
    category: 'AI',
    valuationBn: 61.0,
    rankChange: 0,
    logo: LOGOS.anthropic,
    founded: 2021,
    hq: 'San Francisco, CA',
    ceo: 'Dario Amodei',
    employees: '1,000+',
    website: 'anthropic.com',
  },
];

// Helper functions
export function getCompanyBySymbol(symbol: string): Company | undefined {
  return companies.find(c => c.symbol === symbol);
}

export function getCompaniesByCategory(category: CompanyCategory): Company[] {
  return companies.filter(c => c.category === category);
}

export function getTopCompanies(limit: number = 6): Company[] {
  return companies.slice(0, limit);
}

export function formatValuation(valuationBn: number): string {
  if (valuationBn >= 100) {
    return `$${valuationBn.toFixed(0)}B`;
  }
  return `$${valuationBn.toFixed(1)}B`;
}

export function getRankChangeDisplay(change: number | 'NEW'): { text: string; color: string } {
  if (change === 'NEW') {
    return { text: 'NEW', color: 'text-info' };
  }
  if (change > 0) {
    return { text: `${change}`, color: 'text-success' };
  }
  if (change < 0) {
    return { text: `${Math.abs(change)}`, color: 'text-danger' };
  }
  return { text: '-', color: 'text-text-muted' };
}

// Category icons
export const categoryIcons: Record<CompanyCategory, string> = {
  AI: '🤖',
  AEROSPACE: '🚀',
  FINTECH: '💳',
  DATA: '📊',
  SOCIAL: '📱',
};

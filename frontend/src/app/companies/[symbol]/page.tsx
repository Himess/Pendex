'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Building2,
  DollarSign,
  BarChart3,
  Globe,
  Twitter,
  Lock,
  Shield,
} from 'lucide-react';
import {
  getCompanyBySymbol,
  formatValuation,
  getRankChangeDisplay,
  categoryIcons,
  companies,
} from '@/lib/companyData';

export default function CompanyDetailPage() {
  const params = useParams();
  const symbol = params.symbol as string;
  const company = getCompanyBySymbol(symbol.toUpperCase());

  if (!company) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-20 px-4 md:px-6 pb-8 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4 text-text-primary">Company Not Found</h1>
            <p className="text-text-muted mb-6">The company you&apos;re looking for doesn&apos;t exist.</p>
            <Link href="/companies" className="btn-primary">
              View All Companies
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const rankChange = getRankChangeDisplay(company.rankChange);

  // Get similar companies (same category)
  const similarCompanies = companies
    .filter((c) => c.category === company.category && c.symbol !== company.symbol)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-20 px-4 md:px-6 pb-8 max-w-6xl mx-auto">
        {/* Back Button */}
        <Link
          href="/companies"
          className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Companies
        </Link>

        {/* Company Header */}
        <div className="card mb-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            {/* Left Side */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-background border border-border flex items-center justify-center overflow-hidden">
                {company.logo ? (
                  <img
                    src={company.logo}
                    alt={company.name}
                    className="w-full h-full object-contain p-2"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <span className={company.logo ? 'hidden' : 'text-3xl'}>{categoryIcons[company.category]}</span>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-text-muted text-sm font-medium">Rank #{company.rank}</span>
                  <div className={cn("flex items-center gap-1",
                    company.rankChange === 'NEW' ? 'text-info' :
                    typeof company.rankChange === 'number' && company.rankChange > 0 ? 'text-success' :
                    typeof company.rankChange === 'number' && company.rankChange < 0 ? 'text-danger' : 'text-text-muted'
                  )}>
                    {company.rankChange === 'NEW' ? (
                      <span className="text-xs font-bold px-2 py-1 bg-info/20 rounded">NEW</span>
                    ) : typeof company.rankChange === 'number' && company.rankChange > 0 ? (
                      <>
                        <ArrowUp className="w-4 h-4" />
                        <span className="text-sm">{rankChange.text}</span>
                      </>
                    ) : typeof company.rankChange === 'number' && company.rankChange < 0 ? (
                      <>
                        <ArrowDown className="w-4 h-4" />
                        <span className="text-sm">{rankChange.text}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <h1 className="text-3xl font-bold mb-2 text-text-primary">{company.name}</h1>
                <p className="text-text-muted">{company.description}</p>
              </div>
            </div>

            {/* Right Side - Trade Button */}
            <div className="flex flex-col items-end gap-3">
              <span className="badge-gold flex items-center gap-2">
                {categoryIcons[company.category]} {company.category}
              </span>
              <Link
                href={`/trade?asset=${company.symbol}`}
                className="btn-primary flex items-center gap-2"
              >
                <TrendingUp className="w-5 h-5" />
                Trade {company.symbol}
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Valuation */}
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <DollarSign className="w-5 h-5 text-gold" />
              <span className="text-text-muted">Last Round Valuation</span>
            </div>
            <p className="text-3xl font-bold text-gold">
              {formatValuation(company.valuationBn)}
            </p>
            <p className="text-text-muted text-sm mt-1">Q3 2025 Secondary Market</p>
          </div>

          {/* Rank */}
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <BarChart3 className="w-5 h-5 text-gold" />
              <span className="text-text-muted">Setter 30 Rank</span>
            </div>
            <p className="text-3xl font-bold text-text-primary">#{company.rank}</p>
            <p className="text-text-muted text-sm mt-1">of 30 companies</p>
          </div>

          {/* Category */}
          <div className="card">
            <div className="flex items-center gap-3 mb-3">
              <Building2 className="w-5 h-5 text-gold" />
              <span className="text-text-muted">Business Category</span>
            </div>
            <p className="text-3xl font-bold text-text-primary">{company.category}</p>
            <p className="text-text-muted text-sm mt-1">{categoryIcons[company.category]} Sector</p>
          </div>
        </div>

        {/* About Section */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-4 text-text-primary">About {company.name}</h2>
          <p className="text-text-muted mb-4">{company.description}</p>

          {/* Company Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-background border border-border rounded-lg p-4">
              <p className="text-text-muted text-xs mb-1">Founded</p>
              <p className="text-text-primary font-bold">{company.founded}</p>
            </div>
            <div className="bg-background border border-border rounded-lg p-4">
              <p className="text-text-muted text-xs mb-1">Headquarters</p>
              <p className="text-text-primary font-bold text-sm">{company.hq}</p>
            </div>
            <div className="bg-background border border-border rounded-lg p-4">
              <p className="text-text-muted text-xs mb-1">CEO</p>
              <p className="text-text-primary font-bold text-sm">{company.ceo}</p>
            </div>
            <div className="bg-background border border-border rounded-lg p-4">
              <p className="text-text-muted text-xs mb-1">Employees</p>
              <p className="text-text-primary font-bold">{company.employees}</p>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-4 mt-6">
            <a
              href={`https://${company.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-background border border-border text-text-muted rounded-lg hover:text-gold hover:border-gold/30 transition-colors"
            >
              <Globe className="w-4 h-4" />
              {company.website}
            </a>
            <a
              href={`https://twitter.com/${company.website.replace('.com', '').replace('.ai', '').replace('.io', '').replace('.net', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-background border border-border text-text-muted rounded-lg hover:text-gold hover:border-gold/30 transition-colors"
            >
              <Twitter className="w-4 h-4" />
              Twitter
            </a>
          </div>
        </div>

        {/* Trading Section */}
        <div className="bg-gold/10 border border-gold/30 rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold mb-1 text-text-primary flex items-center gap-2">
                <Lock className="w-5 h-5 text-gold" />
                Trade {company.name} on Pendex
              </h3>
              <p className="text-text-muted">
                Open encrypted leveraged positions with complete privacy
              </p>
            </div>
            <Link
              href={`/trade?asset=${company.symbol}`}
              className="btn-primary text-lg flex items-center justify-center gap-2"
            >
              <TrendingUp className="w-5 h-5" />
              Start Trading
            </Link>
          </div>
        </div>

        {/* Similar Companies */}
        {similarCompanies.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-4 text-text-primary">Similar Companies</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {similarCompanies.map((similar) => (
                <Link
                  key={similar.symbol}
                  href={`/companies/${similar.symbol}`}
                  className="card-hover"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden">
                      {similar.logo ? (
                        <img
                          src={similar.logo}
                          alt={similar.name}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <span className="text-xl">{categoryIcons[similar.category]}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-text-primary">{similar.name}</h3>
                      <span className="text-text-muted text-sm">#{similar.rank}</span>
                    </div>
                  </div>
                  <p className="text-gold font-bold">{formatValuation(similar.valuationBn)}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Encrypted Badge */}
        <div className="flex items-center justify-center gap-2 text-gold">
          <Shield className="w-4 h-4" />
          <span className="text-sm">All positions are encrypted with FHE</span>
        </div>
      </main>
    </div>
  );
}

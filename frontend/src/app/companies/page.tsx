'use client';

import Link from 'next/link';
import { useState, useMemo, useEffect } from 'react';
import { Header, Footer } from '@/components';
import {
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Search,
  Lock,
  Building2,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  companies,
  Company,
  CompanyCategory,
  formatValuation,
  getRankChangeDisplay,
  categoryIcons,
} from '@/lib/companyData';

const allCategories: CompanyCategory[] = [
  'AI',
  'AEROSPACE',
  'FINTECH',
  'DATA',
  'SOCIAL',
];

// Items per page
const ITEMS_PER_PAGE = 12;

// Sort types
type SortField = 'rank' | 'name' | 'valuation' | 'change';
type SortDirection = 'asc' | 'desc' | null;

export default function CompaniesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CompanyCategory | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField | null>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Load bookmarks from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shadow-company-bookmarks');
      if (saved) {
        try {
          setBookmarks(new Set(JSON.parse(saved)));
        } catch {
          // Invalid JSON
        }
      }
    }
  }, []);

  // Toggle bookmark
  const toggleBookmark = (symbol: string) => {
    setBookmarks(prev => {
      const newBookmarks = new Set(prev);
      if (newBookmarks.has(symbol)) {
        newBookmarks.delete(symbol);
      } else {
        newBookmarks.add(symbol);
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('shadow-company-bookmarks', JSON.stringify(Array.from(newBookmarks)));
      }
      return newBookmarks;
    });
  };

  // 3-click sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter, search, sort companies
  const processedCompanies = useMemo(() => {
    // Step 1: Filter by category
    let filtered = selectedCategory === 'ALL'
      ? [...companies]
      : companies.filter(c => c.category === selectedCategory);

    // Step 2: Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.symbol.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query) ||
        c.category.toLowerCase().includes(query)
      );
    }

    // Step 3: Separate bookmarked and non-bookmarked
    const bookmarked = filtered.filter(c => bookmarks.has(c.symbol));
    const nonBookmarked = filtered.filter(c => !bookmarks.has(c.symbol));

    // Step 4: Sort each group
    const sortItems = (items: Company[]) => {
      if (!sortField || !sortDirection) return items;

      return [...items].sort((a, b) => {
        let comparison = 0;

        switch (sortField) {
          case 'rank':
            comparison = a.rank - b.rank;
            break;
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'valuation':
            comparison = a.valuationBn - b.valuationBn;
            break;
          case 'change':
            const changeA = a.rankChange === 'NEW' ? 100 : a.rankChange;
            const changeB = b.rankChange === 'NEW' ? 100 : b.rankChange;
            comparison = changeA - changeB;
            break;
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    };

    return [...sortItems(bookmarked), ...sortItems(nonBookmarked)];
  }, [selectedCategory, searchQuery, bookmarks, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(processedCompanies.length / ITEMS_PER_PAGE);
  const paginatedCompanies = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedCompanies.slice(start, start + ITEMS_PER_PAGE);
  }, [processedCompanies, currentPage]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery, sortField, sortDirection]);

  const clearSearch = () => setSearchQuery('');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="pt-20 px-4 md:px-6 pb-8 max-w-7xl mx-auto flex-1 w-full">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-8 h-8 text-gold" />
            <h1 className="text-3xl font-bold text-text-primary">Pre-IPO Assets</h1>
          </div>
          <p className="text-text-muted">
            Trade the most valuable private companies with encrypted positions
          </p>
          <p className="text-text-muted text-sm mt-1 flex items-center gap-2">
            <Lock className="w-3 h-3 text-gold" />
            6 Tradable Assets
          </p>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
              selectedCategory === 'ALL'
                ? "bg-gold/20 text-gold border border-gold/30"
                : "bg-card border border-border text-text-muted hover:text-text-primary"
            )}
          >
            All Companies
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2",
                selectedCategory === cat
                  ? "bg-gold/20 text-gold border border-gold/30"
                  : "bg-card border border-border text-text-muted hover:text-text-primary"
              )}
            >
              {categoryIcons[cat]} {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            placeholder="Search by name, symbol, description, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-12 py-3 bg-card border border-border rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-gold/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Sort & Info Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          {/* Sort Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-text-muted">Sort by:</span>
            {[
              { field: 'rank' as SortField, label: 'Rank' },
              { field: 'name' as SortField, label: 'Name' },
              { field: 'valuation' as SortField, label: 'Valuation' },
              { field: 'change' as SortField, label: 'Change' },
            ].map(({ field, label }) => (
              <button
                key={field}
                onClick={() => handleSort(field)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  sortField === field && sortDirection
                    ? "bg-gold/20 text-gold border border-gold/30"
                    : "bg-card border border-border text-text-muted hover:text-text-primary"
                )}
              >
                {label}
                {sortField === field && sortDirection ? (
                  sortDirection === 'asc' ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )
                ) : (
                  <ArrowUpDown className="w-3 h-3 opacity-50" />
                )}
              </button>
            ))}
          </div>

          {/* Info */}
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, processedCompanies.length)} of {processedCompanies.length}
            </span>
            {bookmarks.size > 0 && (
              <span className="flex items-center gap-1 text-gold">
                <Bookmark className="w-3 h-3 fill-current" />
                {bookmarks.size} bookmarked
              </span>
            )}
          </div>
        </div>

        {/* Company Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedCompanies.map((company) => (
            <CompanyCard
              key={company.symbol}
              company={company}
              isBookmarked={bookmarks.has(company.symbol)}
              onToggleBookmark={() => toggleBookmark(company.symbol)}
            />
          ))}
        </div>

        {/* No Results */}
        {paginatedCompanies.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-muted">No companies found matching your criteria</p>
            <button
              onClick={clearSearch}
              className="mt-4 px-4 py-2 bg-gold/20 text-gold rounded-lg font-medium text-sm hover:bg-gold/30 transition-colors"
            >
              Clear Search
            </button>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={cn(
                "flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                currentPage === 1
                  ? "text-text-muted cursor-not-allowed"
                  : "text-text-primary hover:bg-card-hover"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                      currentPage === pageNum
                        ? "bg-gold text-background"
                        : "text-text-muted hover:text-text-primary hover:bg-card-hover"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={cn(
                "flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                currentPage === totalPages
                  ? "text-text-muted cursor-not-allowed"
                  : "text-text-primary hover:bg-card-hover"
              )}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Encrypted Badge */}
        <div className="mt-8 flex items-center justify-center gap-2 text-gold">
          <Lock className="w-4 h-4" />
          <span className="text-sm">All trading positions are encrypted with FHE</span>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function CompanyCard({
  company,
  isBookmarked,
  onToggleBookmark
}: {
  company: Company;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
}) {
  const rankChange = getRankChangeDisplay(company.rankChange);

  return (
    <div className={cn(
      "card-hover cursor-pointer group h-full relative",
      isBookmarked && "ring-2 ring-gold/30 bg-gold/5"
    )}>
      {/* Bookmark Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleBookmark();
        }}
        className={cn(
          "absolute top-3 right-3 p-1.5 rounded-lg transition-colors z-10",
          isBookmarked
            ? "text-gold bg-gold/20"
            : "text-text-muted hover:text-gold hover:bg-gold/10 opacity-50 hover:opacity-100"
        )}
      >
        <Bookmark className={cn("w-4 h-4", isBookmarked && "fill-current")} />
      </button>

      <Link href={`/companies/${company.symbol}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3 pr-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center overflow-hidden">
              {company.logo ? (
                <img
                  src={company.logo}
                  alt={company.name}
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <span className={company.logo ? 'hidden' : 'text-xl'}>{categoryIcons[company.category]}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-sm font-medium">#{company.rank}</span>
                <h3 className="font-bold text-text-primary group-hover:text-gold transition-colors">
                  {company.name}
                </h3>
              </div>
              <span className="text-text-muted text-xs">{company.symbol}</span>
            </div>
          </div>

          {/* Rank Change */}
          <div className={cn("flex items-center gap-1",
            company.rankChange === 'NEW' ? 'text-info' :
            typeof company.rankChange === 'number' && company.rankChange > 0 ? 'text-success' :
            typeof company.rankChange === 'number' && company.rankChange < 0 ? 'text-danger' : 'text-text-muted'
          )}>
            {company.rankChange === 'NEW' ? (
              <span className="text-xs font-bold px-2 py-1 bg-info/20 text-info rounded">NEW</span>
            ) : typeof company.rankChange === 'number' && company.rankChange > 0 ? (
              <>
                <ArrowUp className="w-4 h-4" />
                <span className="text-sm font-medium">{rankChange.text}</span>
              </>
            ) : typeof company.rankChange === 'number' && company.rankChange < 0 ? (
              <>
                <ArrowDown className="w-4 h-4" />
                <span className="text-sm font-medium">{rankChange.text}</span>
              </>
            ) : (
              <span className="text-sm">-</span>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-text-muted text-sm mb-4 line-clamp-2">{company.description}</p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-text-muted text-xs">Valuation</span>
            <p className="text-gold font-bold text-lg">
              {formatValuation(company.valuationBn)}
            </p>
          </div>

          <span className="badge-gold">
            {company.category}
          </span>
        </div>

        {/* Trade Button */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-text-muted text-sm">Trade on Pendex</span>
            <span className="text-gold text-sm font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              Trade <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

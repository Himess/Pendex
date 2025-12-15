"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Header, Footer } from "@/components";
import { ASSETS, CATEGORIES, Asset, formatUSD, formatPercent, formatMarketCap, formatCompactUSD } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useLiveOracle, LiveAsset } from "@/hooks/useLiveOracle";
import { useCurrentNetwork } from "@/lib/contracts/hooks";
import {
  TrendingUp,
  TrendingDown,
  Lock,
  Activity,
  Users,
  DollarSign,
  ArrowRight,
  Cpu,
  Rocket,
  CreditCard,
  Database,
  Users as UsersIcon,
  BarChart3,
  Shield,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Search,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

// Category icons
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  AI: <Cpu className="w-5 h-5" />,
  AEROSPACE: <Rocket className="w-5 h-5" />,
  FINTECH: <CreditCard className="w-5 h-5" />,
  DATA: <Database className="w-5 h-5" />,
  SOCIAL: <UsersIcon className="w-5 h-5" />,
};

// Sort types
type SortField = "name" | "price" | "change" | "marketCap" | "volume" | "oi" | "funding" | "longRatio";
type SortDirection = "asc" | "desc" | null;

// Items per page
const ITEMS_PER_PAGE = 50;

// Generate mock market data with seeded randomness based on asset id
function generateMarketData(asset: Asset) {
  const seed = asset.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const random = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  const baseVolume = asset.price * 1000000 * (0.5 + random(1));
  return {
    volume24h: baseVolume,
    openInterest: baseVolume * 0.4,
    fundingRate: (random(2) - 0.5) * 0.02,
    longRatio: 45 + random(3) * 20,
  };
}

// Platform stats - more realistic numbers
const PLATFORM_STATS = {
  totalVolume: 847_523_891,
  totalTrades: 12_847,
  totalUsers: 3_241,
  totalOI: 156_234_567,
  // Trend percentages
  volumeTrend: 12.5,
  tradesTrend: 8.3,
  usersTrend: 15.2,
  oiTrend: -2.1,
};

// Sortable Header Component with 3-click cycle
function SortableHeader({
  field,
  label,
  currentSort,
  currentDirection,
  onSort,
  className,
}: {
  field: SortField;
  label: string;
  currentSort: SortField | null;
  currentDirection: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = currentSort === field && currentDirection !== null;

  return (
    <th
      className={cn(
        "px-3 py-3 font-medium cursor-pointer hover:bg-card-hover transition-colors select-none text-xs",
        className
      )}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        <span className="truncate">{label}</span>
        {isActive ? (
          currentDirection === "asc" ? (
            <ChevronUp className="w-3 h-3 text-gold flex-shrink-0" />
          ) : (
            <ChevronDown className="w-3 h-3 text-gold flex-shrink-0" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 text-text-muted opacity-50 flex-shrink-0" />
        )}
      </div>
    </th>
  );
}

// Extend Asset type with live data
interface AssetWithLiveData extends Asset {
  livePrice?: number;
  liveChange24h?: number;
  totalLongOI?: number;
  totalShortOI?: number;
  longRatio?: number;
  isLive?: boolean;
}

export default function MarketsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField | null>("marketCap");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  // Live oracle data
  const network = useCurrentNetwork();
  const { assets: liveAssets, isLoading: oracleLoading, lastUpdate } = useLiveOracle(network);

  // Create a map for quick lookup of live data
  const liveDataMap = useMemo(() => {
    const map = new Map<string, LiveAsset>();
    liveAssets.forEach(asset => {
      map.set(asset.symbol.toLowerCase(), asset);
    });
    return map;
  }, [liveAssets]);

  // Merge static ASSETS with live data
  const assetsWithLiveData: AssetWithLiveData[] = useMemo(() => {
    return ASSETS.map(asset => {
      const liveData = liveDataMap.get(asset.symbol.toLowerCase());
      if (liveData) {
        return {
          ...asset,
          livePrice: liveData.price,
          liveChange24h: liveData.change24h,
          totalLongOI: liveData.totalLongOI,
          totalShortOI: liveData.totalShortOI,
          longRatio: liveData.longRatio,
          isLive: true,
        };
      }
      return { ...asset, isLive: false };
    });
  }, [liveDataMap]);

  // Load bookmarks from localStorage (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("shadow-bookmarks");
      if (saved) {
        try {
          setBookmarks(new Set(JSON.parse(saved)));
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
  }, []);

  // Save bookmarks to localStorage
  const toggleBookmark = (assetId: string) => {
    setBookmarks(prev => {
      const newBookmarks = new Set(prev);
      if (newBookmarks.has(assetId)) {
        newBookmarks.delete(assetId);
      } else {
        newBookmarks.add(assetId);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("shadow-bookmarks", JSON.stringify(Array.from(newBookmarks)));
      }
      return newBookmarks;
    });
  };

  // 3-click sorting: Asc -> Desc -> Reset
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        // Reset
        setSortField(null);
        setSortDirection(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filter, search, and sort assets - then apply bookmarks on top
  const processedAssets = useMemo(() => {
    // Step 1: Filter by category
    let filtered = selectedCategory
      ? assetsWithLiveData.filter(a => a.category === selectedCategory)
      : [...assetsWithLiveData];

    // Step 2: Search (global - searches all data)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(query) ||
        a.symbol.toLowerCase().includes(query) ||
        a.category.toLowerCase().includes(query)
      );
    }

    // Step 3: Separate bookmarked and non-bookmarked
    const bookmarked = filtered.filter(a => bookmarks.has(a.id));
    const nonBookmarked = filtered.filter(a => !bookmarks.has(a.id));

    // Step 4: Sort each group
    const sortItems = (items: AssetWithLiveData[]) => {
      if (!sortField || !sortDirection) return items;

      return [...items].sort((a, b) => {
        const dataA = generateMarketData(a);
        const dataB = generateMarketData(b);

        let comparison = 0;

        switch (sortField) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "price":
            comparison = a.price - b.price;
            break;
          case "change":
            comparison = a.change24h - b.change24h;
            break;
          case "marketCap":
            comparison = a.marketCap - b.marketCap;
            break;
          case "volume":
            comparison = dataA.volume24h - dataB.volume24h;
            break;
          case "oi":
            comparison = dataA.openInterest - dataB.openInterest;
            break;
          case "funding":
            comparison = dataA.fundingRate - dataB.fundingRate;
            break;
          case "longRatio":
            comparison = dataA.longRatio - dataB.longRatio;
            break;
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
    };

    // Sort both groups and combine (bookmarked first)
    return [...sortItems(bookmarked), ...sortItems(nonBookmarked)];
  }, [selectedCategory, sortField, sortDirection, searchQuery, bookmarks, assetsWithLiveData]);

  // Pagination
  const totalPages = Math.ceil(processedAssets.length / ITEMS_PER_PAGE);
  const paginatedAssets = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedAssets.slice(start, start + ITEMS_PER_PAGE);
  }, [processedAssets, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery, sortField, sortDirection]);

  const clearSearch = () => {
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="pt-20 px-4 md:px-6 pb-8 max-w-7xl mx-auto flex-1 w-full">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Markets</h1>
          <p className="text-text-muted">
            Trade Pre-IPO synthetic assets with encrypted positions
          </p>
        </div>

        {/* Live Data Status */}
        {liveAssets.length > 0 && (
          <div className="flex items-center gap-2 mb-4 text-sm text-text-muted">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span>
              Live data from oracle • {liveAssets.length} assets • Updated {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : "..."}
            </span>
          </div>
        )}

        {/* Platform Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-card to-card-hover border border-border rounded-xl p-4 hover:border-gold/30 hover:scale-[1.02] transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-text-muted">
                <BarChart3 className="w-4 h-4 text-gold" />
                <span className="text-xs uppercase">24h Volume</span>
              </div>
              <span className={cn("text-xs flex items-center gap-1", PLATFORM_STATS.volumeTrend >= 0 ? "text-success" : "text-danger")}>
                {PLATFORM_STATS.volumeTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {PLATFORM_STATS.volumeTrend >= 0 ? "+" : ""}{PLATFORM_STATS.volumeTrend}%
              </span>
            </div>
            <p className="text-xl font-bold text-text-primary">
              {formatCompactUSD(PLATFORM_STATS.totalVolume)}
            </p>
          </div>
          <div className="bg-gradient-to-br from-card to-card-hover border border-border rounded-xl p-4 hover:border-gold/30 hover:scale-[1.02] transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-text-muted">
                <Activity className="w-4 h-4 text-gold" />
                <span className="text-xs uppercase">Open Interest</span>
              </div>
              <span className={cn("text-xs flex items-center gap-1", PLATFORM_STATS.oiTrend >= 0 ? "text-success" : "text-danger")}>
                {PLATFORM_STATS.oiTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {PLATFORM_STATS.oiTrend >= 0 ? "+" : ""}{PLATFORM_STATS.oiTrend}%
              </span>
            </div>
            <p className="text-xl font-bold text-text-primary flex items-center gap-2">
              {formatCompactUSD(PLATFORM_STATS.totalOI)}
              <Lock className="w-4 h-4 text-gold" />
            </p>
          </div>
          <div className="bg-gradient-to-br from-card to-card-hover border border-border rounded-xl p-4 hover:border-gold/30 hover:scale-[1.02] transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-text-muted">
                <DollarSign className="w-4 h-4 text-gold" />
                <span className="text-xs uppercase">24h Trades</span>
              </div>
              <span className={cn("text-xs flex items-center gap-1", PLATFORM_STATS.tradesTrend >= 0 ? "text-success" : "text-danger")}>
                {PLATFORM_STATS.tradesTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {PLATFORM_STATS.tradesTrend >= 0 ? "+" : ""}{PLATFORM_STATS.tradesTrend}%
              </span>
            </div>
            <p className="text-xl font-bold text-text-primary">
              {PLATFORM_STATS.totalTrades.toLocaleString()}
            </p>
          </div>
          <div className="bg-gradient-to-br from-card to-card-hover border border-border rounded-xl p-4 hover:border-gold/30 hover:scale-[1.02] transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-text-muted">
                <Users className="w-4 h-4 text-gold" />
                <span className="text-xs uppercase">Active Traders</span>
              </div>
              <span className={cn("text-xs flex items-center gap-1", PLATFORM_STATS.usersTrend >= 0 ? "text-success" : "text-danger")}>
                {PLATFORM_STATS.usersTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {PLATFORM_STATS.usersTrend >= 0 ? "+" : ""}{PLATFORM_STATS.usersTrend}%
              </span>
            </div>
            <p className="text-xl font-bold text-text-primary">
              {PLATFORM_STATS.totalUsers.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
              selectedCategory === null
                ? "bg-gold/20 text-gold border border-gold/30"
                : "bg-card border border-border text-text-muted hover:text-text-primary"
            )}
          >
            All Markets
          </button>
          {Object.entries(CATEGORIES).map(([key, category]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2",
                selectedCategory === key
                  ? "bg-gold/20 text-gold border border-gold/30"
                  : "bg-card border border-border text-text-muted hover:text-text-primary"
              )}
            >
              {CATEGORY_ICONS[key]}
              {category.name}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search markets..."
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

        {/* Info Row */}
        <div className="flex items-center justify-between mb-4 text-xs text-text-muted">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3" />
              Click headers to sort (Asc → Desc → Reset)
            </span>
            <span>
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, processedAssets.length)} of {processedAssets.length}
            </span>
          </div>
          {bookmarks.size > 0 && (
            <span className="flex items-center gap-1 text-gold">
              <Bookmark className="w-3 h-3 fill-current" />
              {bookmarks.size} bookmarked
            </span>
          )}
        </div>

        {/* Markets Table - Responsive */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted uppercase tracking-wider">
                  <SortableHeader
                    field="name"
                    label="Market"
                    currentSort={sortField}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="min-w-[180px]"
                  />
                  <SortableHeader
                    field="price"
                    label="Price"
                    currentSort={sortField}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="min-w-[100px]"
                  />
                  <SortableHeader
                    field="change"
                    label="24h"
                    currentSort={sortField}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="min-w-[80px]"
                  />
                  <SortableHeader
                    field="marketCap"
                    label="MCap"
                    currentSort={sortField}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="min-w-[90px]"
                  />
                  <SortableHeader
                    field="volume"
                    label="Volume"
                    currentSort={sortField}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="min-w-[100px] hidden lg:table-cell"
                  />
                  <SortableHeader
                    field="oi"
                    label="Open Interest"
                    currentSort={sortField}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="min-w-[120px] hidden xl:table-cell"
                  />
                  <SortableHeader
                    field="funding"
                    label="Funding"
                    currentSort={sortField}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="min-w-[80px] hidden xl:table-cell"
                  />
                  <SortableHeader
                    field="longRatio"
                    label="L/S"
                    currentSort={sortField}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    className="min-w-[100px] hidden md:table-cell"
                  />
                  <th className="px-3 py-3 font-medium min-w-[80px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedAssets.map((asset) => {
                  const marketData = generateMarketData(asset);
                  const isBookmarked = bookmarks.has(asset.id);
                  return (
                    <tr key={asset.id} className={cn(
                      "hover:bg-card-hover transition-all duration-200",
                      "hover:shadow-[inset_0_0_0_1px_rgba(45,212,191,0.2)]",
                      isBookmarked && "bg-gold/10 border-l-2 border-l-gold"
                    )}>
                      {/* Market + Bookmark */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center text-xs font-bold text-gold border border-border overflow-hidden flex-shrink-0">
                            {asset.logo ? (
                              <img
                                src={asset.logo}
                                alt={asset.symbol}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              asset.symbol.slice(0, 2)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-text-primary text-sm truncate">{asset.name}</p>
                            <p className="text-xs text-text-muted">{asset.symbol}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              toggleBookmark(asset.id);
                            }}
                            className={cn(
                              "p-1.5 rounded-lg transition-all flex-shrink-0",
                              isBookmarked
                                ? "text-gold bg-gold/20"
                                : "text-text-muted hover:text-gold hover:bg-gold/10"
                            )}
                          >
                            <Bookmark className={cn("w-4 h-4", isBookmarked && "fill-current")} />
                          </button>
                        </div>
                      </td>

                      {/* Price - use live data if available */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-text-primary text-sm">
                            {formatUSD(asset.livePrice ?? asset.price)}
                          </span>
                          {asset.isLive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" title="Live" />
                          )}
                        </div>
                      </td>

                      {/* 24h Change - use live data if available */}
                      <td className="px-3 py-3">
                        {(() => {
                          const change = asset.liveChange24h ?? asset.change24h;
                          return (
                            <span
                              className={cn(
                                "flex items-center gap-1 font-medium text-sm",
                                change >= 0 ? "text-success" : "text-danger"
                              )}
                            >
                              {change >= 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              {formatPercent(change)}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Market Cap */}
                      <td className="px-3 py-3">
                        <span className="text-text-primary font-medium text-sm">
                          {formatMarketCap(asset.marketCap)}
                        </span>
                      </td>

                      {/* Volume */}
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <span className="text-text-primary text-sm">
                          {formatCompactUSD(marketData.volume24h)}
                        </span>
                      </td>

                      {/* Open Interest - use live data if available */}
                      <td className="px-3 py-3 hidden xl:table-cell">
                        <span className="flex items-center gap-1 text-text-primary text-sm">
                          {formatCompactUSD(asset.isLive ? (asset.totalLongOI! + asset.totalShortOI!) : marketData.openInterest)}
                          <Lock className="w-3 h-3 text-gold" />
                        </span>
                      </td>

                      {/* Funding Rate */}
                      <td className="px-3 py-3 hidden xl:table-cell">
                        <span
                          className={cn(
                            "font-medium text-sm",
                            marketData.fundingRate >= 0 ? "text-success" : "text-danger"
                          )}
                        >
                          {marketData.fundingRate >= 0 ? "+" : ""}
                          {(marketData.fundingRate * 100).toFixed(3)}%
                        </span>
                      </td>

                      {/* Long/Short - use live data if available */}
                      <td className="px-3 py-3 hidden md:table-cell">
                        {(() => {
                          const ratio = asset.longRatio ?? marketData.longRatio;
                          return (
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden flex">
                                <div
                                  className="h-full bg-success"
                                  style={{ width: `${ratio}%` }}
                                />
                                <div
                                  className="h-full bg-danger"
                                  style={{ width: `${100 - ratio}%` }}
                                />
                              </div>
                              <span className="text-xs text-text-muted">
                                {ratio.toFixed(0)}%
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Trade Button */}
                      <td className="px-3 py-3">
                        <Link
                          href={`/trade?asset=${asset.id}`}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gold/20 text-gold rounded-lg font-medium text-xs hover:bg-gold/30 transition-colors"
                        >
                          Trade
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t border-border">
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
        </div>

        {/* No Results */}
        {paginatedAssets.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-text-muted mx-auto mb-4" />
            <p className="text-text-muted">No markets found matching your search.</p>
            <button
              onClick={clearSearch}
              className="mt-4 px-4 py-2 bg-gold/20 text-gold rounded-lg font-medium text-sm hover:bg-gold/30 transition-colors"
            >
              Clear Search
            </button>
          </div>
        )}

        {/* Encrypted Badge */}
        <div className="mt-6 flex items-center justify-center gap-2 text-gold">
          <Shield className="w-4 h-4" />
          <span className="text-sm">All positions are encrypted with FHE</span>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

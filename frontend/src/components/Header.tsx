"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Lock, BarChart3, LineChart, Wallet, Menu, X, HelpCircle, Building2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { NetworkSelectorCompact } from "./NetworkSelector";

const NAV_ITEMS = [
  { href: "/markets", label: "Markets", icon: <BarChart3 className="w-4 h-4" /> },
  { href: "/companies", label: "Companies", icon: <Building2 className="w-4 h-4" /> },
  { href: "/trade", label: "Trade", icon: <LineChart className="w-4 h-4" /> },
  { href: "/wallet", label: "Wallet", icon: <Wallet className="w-4 h-4" /> },
  { href: "/docs", label: "Docs", icon: <HelpCircle className="w-4 h-4" /> },
  { href: "/admin", label: "Admin", icon: <Settings className="w-4 h-4" /> },
];

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-4 md:px-6 h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 md:gap-3">
          <div className="relative">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gold/20 flex items-center justify-center">
              <Lock className="w-4 h-4 md:w-5 md:h-5 text-gold" />
            </div>
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-text-primary">
              Shadow<span className="text-gold">Protocol</span>
            </h1>
          </div>
        </Link>

        {/* Center - Navigation (Desktop) */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname === item.href || (item.href === "/markets" && pathname === "/")
                  ? "bg-gold/20 text-gold"
                  : "text-text-muted hover:text-text-primary hover:bg-card-hover"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right - Network Selector + Wallet */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Network Selector */}
          <div className="hidden md:block">
            <NetworkSelectorCompact />
          </div>
          <div className="hidden sm:block">
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus={{
                smallScreen: "avatar",
                largeScreen: "full",
              }}
            />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-text-muted hover:text-text-primary"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-md">
          <nav className="p-4 space-y-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors",
                  pathname === item.href || (item.href === "/markets" && pathname === "/")
                    ? "bg-gold/20 text-gold"
                    : "text-text-muted hover:text-text-primary hover:bg-card-hover"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}

            {/* Mobile Wallet Connect */}
            <div className="pt-4 border-t border-border sm:hidden">
              <ConnectButton
                showBalance={false}
                chainStatus="icon"
                accountStatus="avatar"
              />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

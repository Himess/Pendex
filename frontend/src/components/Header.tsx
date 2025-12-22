"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { BarChart3, LineChart, Wallet, Menu, X, HelpCircle, Building2, Sun, Moon, Zap, AlertCircle } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useTheme } from "@/app/providers";
import { useSessionWallet } from "@/lib/session-wallet/hooks";

const NAV_ITEMS = [
  { href: "/markets", label: "Markets", icon: <BarChart3 className="w-4 h-4" /> },
  { href: "/companies", label: "Companies", icon: <Building2 className="w-4 h-4" /> },
  { href: "/trade", label: "Trade", icon: <LineChart className="w-4 h-4" /> },
  { href: "/wallet", label: "Wallet", icon: <Wallet className="w-4 h-4" /> },
  { href: "/docs", label: "Docs", icon: <HelpCircle className="w-4 h-4" /> },
];

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { isSessionActive, needsSetup } = useSessionWallet();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between px-4 md:px-6 h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 md:gap-3">
          <Image
            src="/logo.png"
            alt="Pendex Logo"
            width={40}
            height={40}
            className="w-8 h-8 md:w-10 md:h-10"
          />
          <h1 className="text-lg md:text-xl font-bold text-text-primary">
            Pen<span className="text-gold">dex</span>
          </h1>
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

        {/* Right - Session Badge + Theme Toggle + Wallet */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Session Wallet Badge */}
          {isSessionActive ? (
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-success/20 border border-success/30 rounded-lg">
              <Zap className="w-3 h-3 text-success" />
              <span className="text-[10px] font-medium text-success">Popup-Free</span>
            </div>
          ) : needsSetup ? (
            <Link
              href="/trade"
              className="hidden sm:flex items-center gap-1 px-2 py-1 bg-gold/20 border border-gold/30 rounded-lg hover:bg-gold/30 transition-colors"
            >
              <AlertCircle className="w-3 h-3 text-gold" />
              <span className="text-[10px] font-medium text-gold">Setup Required</span>
            </Link>
          ) : null}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-card-hover transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Wallet Connect - includes network selector */}
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

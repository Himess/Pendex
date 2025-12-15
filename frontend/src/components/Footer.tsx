"use client";

import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-12">
      {/* Top Block - Main Info */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand Block */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Image
                src="/logo.png"
                alt="Pendex Logo"
                width={32}
                height={32}
                className="w-8 h-8"
              />
              <span className="font-bold text-lg text-text-primary">Pendex</span>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              Private leveraged trading for Pre-IPO synthetic assets.
              Powered by Fully Homomorphic Encryption.
            </p>
          </div>

          {/* Links Block */}
          <div>
            <h4 className="font-semibold text-text-primary mb-4">Protocol</h4>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><Link href="/markets" className="hover:text-gold transition-colors">Markets</Link></li>
              <li><Link href="/trade" className="hover:text-gold transition-colors">Trade</Link></li>
              <li><Link href="/wallet" className="hover:text-gold transition-colors">Wallet</Link></li>
              <li><Link href="/docs" className="hover:text-gold transition-colors">Documentation</Link></li>
            </ul>
          </div>

          {/* Resources Block */}
          <div>
            <h4 className="font-semibold text-text-primary mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><a href="https://docs.zama.ai" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">Zama fhEVM Docs</a></li>
              <li><a href="#" className="hover:text-gold transition-colors">Whitepaper</a></li>
              <li><a href="#" className="hover:text-gold transition-colors">Security Audit</a></li>
              <li><a href="#" className="hover:text-gold transition-colors">Bug Bounty</a></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Bottom Block - Copyright & Social */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            &copy; 2025 Pendex. Built for Zama Builder Track.
          </p>

          {/* Social Links */}
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/poppyseedDev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-primary transition-colors"
              aria-label="GitHub"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
            <a
              href="https://x.com/AuroraHimess"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-muted hover:text-text-primary transition-colors"
              aria-label="X (Twitter)"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

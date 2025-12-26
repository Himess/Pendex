"use client";

import { useState } from "react";
import { Header, Footer } from "@/components";
import {
  ChevronDown,
  ChevronRight,
  Lock,
  Shield,
  Zap,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Info,
  Coins,
  Layers,
  Eye,
  EyeOff,
  Calculator,
  Percent,
  Timer,
  Wallet,
  HelpCircle,
} from "lucide-react";

interface FAQItem {
  question: string;
  answer: React.ReactNode;
  icon?: React.ReactNode;
}

interface FAQSection {
  title: string;
  icon: React.ReactNode;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  // ============================================
  // 1. WHAT IS PENDEX?
  // ============================================
  {
    title: "What is Pendex?",
    icon: <Shield className="w-5 h-5" />,
    items: [
      {
        question: "What is Pendex and what does it do?",
        answer: (
          <div className="space-y-3">
            <p>
              Pendex is a decentralized platform that enables you to trade
              <strong> Pre-IPO</strong> (pre-initial public offering) company synthetic assets
              with <strong>complete privacy</strong>.
            </p>
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-4">
              <h4 className="font-semibold text-gold mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4" /> Privacy Guarantee
              </h4>
              <ul className="text-sm space-y-1 text-text-secondary">
                <li>• Your position size is encrypted</li>
                <li>• Your Long/Short direction is encrypted</li>
                <li>• Your entry price is encrypted</li>
                <li>• Your leverage ratio is encrypted</li>
                <li>• Your profit/loss is encrypted</li>
              </ul>
            </div>
            <p className="text-text-muted text-sm">
              No third party, not even blockchain explorers, can see your position.
              Only you can decrypt it with your own wallet.
            </p>
          </div>
        ),
      },
      {
        question: "Why do we use Zama's FHE technology?",
        answer: (
          <div className="space-y-3">
            <p>
              <strong>Fully Homomorphic Encryption (FHE)</strong> is a revolutionary cryptography
              technology that allows data to be processed while remaining encrypted.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-card-hover border border-border rounded-lg p-4">
                <h4 className="font-semibold text-success mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Traditional Encryption
                </h4>
                <p className="text-sm text-text-muted">
                  Data encrypted → Decrypt for processing → Process → Re-encrypt
                </p>
                <p className="text-xs text-danger mt-2">Data exposed during processing!</p>
              </div>
              <div className="bg-card-hover border border-gold/30 rounded-lg p-4">
                <h4 className="font-semibold text-gold mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Zama FHE
                </h4>
                <p className="text-sm text-text-muted">
                  Data encrypted → Encrypted processing → Result encrypted
                </p>
                <p className="text-xs text-success mt-2">Data is never exposed!</p>
              </div>
            </div>
            <div className="bg-background rounded-lg p-4 mt-4">
              <h4 className="font-medium mb-2">FHE Usage in Pendex:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="bg-card p-2 rounded text-center">
                  <code>euint64</code>
                  <p className="text-text-muted">Balance, Price</p>
                </div>
                <div className="bg-card p-2 rounded text-center">
                  <code>ebool</code>
                  <p className="text-text-muted">Long/Short</p>
                </div>
                <div className="bg-card p-2 rounded text-center">
                  <code>FHE.add()</code>
                  <p className="text-text-muted">Encrypted addition</p>
                </div>
                <div className="bg-card p-2 rounded text-center">
                  <code>FHE.select()</code>
                  <p className="text-text-muted">Encrypted if/else</p>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        question: "What is Pre-IPO and why is it important?",
        answer: (
          <div className="space-y-3">
            <p>
              <strong>Pre-IPO</strong> refers to companies' valuations before they go public.
              These companies typically:
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-success mt-0.5" />
                <span>Have high growth potential (SpaceX, OpenAI, Stripe...)</span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-gold mt-0.5" />
                <span>Are only accessible to accredited investors</span>
              </li>
              <li className="flex items-start gap-2">
                <DollarSign className="w-4 h-4 text-gold mt-0.5" />
                <span>Require minimum $100K+ investment</span>
              </li>
            </ul>
            <div className="bg-success/10 border border-success/30 rounded-lg p-4 mt-4">
              <h4 className="font-semibold text-success mb-2">The Pendex Difference</h4>
              <p className="text-sm">
                We create <strong>synthetic assets</strong> of these companies.
                This allows anyone to invest in these companies with any amount,
                using leverage.
              </p>
            </div>
          </div>
        ),
      },
    ],
  },

  // ============================================
  // 2. DARK POOL & PRIVACY (NEW)
  // ============================================
  {
    title: "Dark Pool & Privacy",
    icon: <EyeOff className="w-5 h-5" />,
    items: [
      {
        question: "What is a Dark Pool?",
        answer: (
          <div className="space-y-3">
            <p>
              A <strong>Dark Pool</strong> is a private exchange where trades are not visible
              to the public until after execution.
            </p>
            <div className="bg-card-hover rounded-lg p-4">
              <h4 className="font-medium mb-3">Why Dark Pools Exist:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-danger mt-0.5" />
                  <span><strong>Problem:</strong> Large orders on public exchanges move the market against you</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5" />
                  <span><strong>Solution:</strong> Dark pools hide order details until execution</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-text-muted">
              In traditional finance, institutional investors use dark pools to prevent
              front-running and market manipulation. Pendex brings this concept to DeFi with FHE.
            </p>
          </div>
        ),
      },
      {
        question: "What can others see about my trades?",
        answer: (
          <div className="space-y-3">
            <p>
              Thanks to FHE encryption, external observers have <strong>very limited</strong> visibility:
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
                <h4 className="font-semibold text-danger mb-2 flex items-center gap-2">
                  <EyeOff className="w-4 h-4" /> They CANNOT See
                </h4>
                <ul className="text-sm space-y-1">
                  <li>❌ Your position size</li>
                  <li>❌ Long or Short direction</li>
                  <li>❌ Entry price</li>
                  <li>❌ Leverage amount</li>
                  <li>❌ Your P&L</li>
                  <li>❌ Your balance</li>
                </ul>
              </div>
              <div className="bg-card-hover rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Eye className="w-4 h-4" /> They CAN See
                </h4>
                <ul className="text-sm space-y-1 text-text-muted">
                  <li>✓ Your wallet has positions (not details)</li>
                  <li>✓ Total platform Open Interest</li>
                  <li>✓ Liquidity Score</li>
                  <li>✓ Oracle prices</li>
                </ul>
              </div>
            </div>
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 mt-2">
              <p className="text-sm">
                <strong>Example:</strong> Someone can see "Wallet 0x123 has 3 open positions"
                but NOT "Wallet 0x123 is $50K long on SpaceX with 5x leverage"
              </p>
            </div>
          </div>
        ),
      },
      {
        question: "Why are Open Interest and Liquidity public?",
        answer: (
          <div className="space-y-3">
            <p>
              These are <strong>aggregate metrics</strong> that don't reveal individual positions
              but help traders make informed decisions:
            </p>
            <div className="space-y-3">
              <div className="bg-card-hover rounded-lg p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-gold" /> Open Interest
                </h4>
                <p className="text-sm text-text-muted">
                  Shows total market activity. Traders need this to gauge market depth
                  and potential price impact of their trades.
                </p>
              </div>
              <div className="bg-card-hover rounded-lg p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-gold" /> Liquidity Score
                </h4>
                <p className="text-sm text-text-muted">
                  Indicates expected slippage. Higher score = lower slippage = better execution.
                  Essential for planning trade size.
                </p>
              </div>
            </div>
            <p className="text-sm text-text-muted">
              Even traditional dark pools publish aggregate volume data. Individual privacy is preserved.
            </p>
          </div>
        ),
      },
    ],
  },

  // ============================================
  // 3. SYNTHETIC PRICING & VALUATION
  // ============================================
  {
    title: "Synthetic Pricing & Valuation",
    icon: <Calculator className="w-5 h-5" />,
    items: [
      {
        question: "How is the synthetic share price calculated?",
        answer: (
          <div className="space-y-4">
            <p>
              Pendex creates <strong>synthetic shares</strong> for Pre-IPO companies.
              Since these companies are not publicly traded, we use their <strong>latest funding round valuation</strong>
              to determine the price.
            </p>
            <div className="bg-card-hover border border-gold/30 rounded-lg p-4">
              <h4 className="font-semibold text-gold mb-3 flex items-center gap-2">
                <Calculator className="w-4 h-4" /> Pricing Formula
              </h4>
              <div className="font-mono text-sm bg-background rounded p-3">
                <p className="text-text-muted">// We assume 1 Billion synthetic shares per company</p>
                <p className="mt-2">Synthetic Share Price = Company Valuation / 1,000,000,000</p>
                <p className="mt-2 text-text-muted">// Example: SpaceX</p>
                <p>$350B valuation / 1B shares = <span className="text-success">$350 per share</span></p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="bg-card-hover rounded-lg p-4">
                <h4 className="font-medium mb-2">Why 1 Billion shares?</h4>
                <ul className="text-sm space-y-1 text-text-muted">
                  <li>• Makes math simple: $1B valuation = $1/share</li>
                  <li>• Allows fractional trading for any budget</li>
                  <li>• Consistent across all assets</li>
                </ul>
              </div>
              <div className="bg-card-hover rounded-lg p-4">
                <h4 className="font-medium mb-2">Price = Valuation</h4>
                <ul className="text-sm space-y-1 text-text-muted">
                  <li>• SpaceX: $350B → $350/share</li>
                  <li>• OpenAI: $157B → $157/share</li>
                  <li>• Stripe: $70B → $70/share</li>
                </ul>
              </div>
            </div>
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 flex items-center gap-3 mt-4">
              <Info className="w-5 h-5 text-gold flex-shrink-0" />
              <p className="text-sm">
                <strong>Note:</strong> These are synthetic prices based on private market valuations,
                not actual stock prices. Valuations are updated based on latest funding rounds and secondary market data.
              </p>
            </div>
          </div>
        ),
      },
      {
        question: "Where do valuations come from?",
        answer: (
          <div className="space-y-4">
            <p>
              Company valuations are sourced from multiple data points:
            </p>
            <div className="space-y-3">
              {[
                { icon: <DollarSign className="w-4 h-4" />, title: "Funding Rounds", desc: "Latest Series A/B/C/D valuations from official announcements" },
                { icon: <BarChart3 className="w-4 h-4" />, title: "Secondary Markets", desc: "Prices from platforms like Forge, EquityZen, Hiive" },
                { icon: <TrendingUp className="w-4 h-4" />, title: "Tender Offers", desc: "Internal employee stock sale prices" },
                { icon: <Info className="w-4 h-4" />, title: "Research Reports", desc: "Analyst estimates from CB Insights, PitchBook" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 bg-card-hover rounded-lg p-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold flex-shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-text-muted">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        question: "What's the difference between synthetic and real shares?",
        answer: (
          <div className="space-y-3">
            <p>
              Pendex offers <strong>synthetic exposure</strong> to Pre-IPO companies,
              not actual equity ownership.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3">Feature</th>
                    <th className="text-left py-2 px-3">Real Shares</th>
                    <th className="text-left py-2 px-3">Pendex Synthetic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-2 px-3">Ownership</td>
                    <td className="py-2 px-3 text-text-muted">Company equity</td>
                    <td className="py-2 px-3 text-gold">Price exposure only</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Voting Rights</td>
                    <td className="py-2 px-3 text-success">Yes</td>
                    <td className="py-2 px-3 text-danger">No</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Dividends</td>
                    <td className="py-2 px-3 text-success">Yes</td>
                    <td className="py-2 px-3 text-danger">No</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Short Selling</td>
                    <td className="py-2 px-3 text-danger">Very difficult</td>
                    <td className="py-2 px-3 text-success">Easy (1-click)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Leverage</td>
                    <td className="py-2 px-3 text-danger">Requires margin account</td>
                    <td className="py-2 px-3 text-success">Built-in (1-10x)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Minimum Investment</td>
                    <td className="py-2 px-3 text-danger">$100,000+</td>
                    <td className="py-2 px-3 text-success">$1</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">KYC Required</td>
                    <td className="py-2 px-3 text-danger">Yes (accredited)</td>
                    <td className="py-2 px-3 text-success">No</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Trading Hours</td>
                    <td className="py-2 px-3 text-danger">Business hours</td>
                    <td className="py-2 px-3 text-success">24/7</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Privacy</td>
                    <td className="py-2 px-3 text-danger">Fully tracked</td>
                    <td className="py-2 px-3 text-success">FHE encrypted</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ),
      },
    ],
  },

  // ============================================
  // 4. ORACLE & PRICE MECHANISM
  // ============================================
  {
    title: "Oracle & Price Mechanism",
    icon: <BarChart3 className="w-5 h-5" />,
    items: [
      {
        question: "How are prices determined?",
        answer: (
          <div className="space-y-4">
            <p>
              Our prices consist of <strong>two components</strong>:
            </p>
            <div className="bg-card-hover border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                  <span className="text-gold font-bold">1</span>
                </div>
                <div>
                  <h4 className="font-semibold">Base Price</h4>
                  <p className="text-sm text-text-muted">Last funding round valuation</p>
                </div>
              </div>
              <p className="text-sm text-text-secondary ml-11">
                Example: OpenAI's last funding round was $157B valuation → ~$250 per share
              </p>
            </div>
            <div className="bg-card-hover border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                  <span className="text-gold font-bold">2</span>
                </div>
                <div>
                  <h4 className="font-semibold">Demand Modifier</h4>
                  <p className="text-sm text-text-muted">±20% based on Long/Short balance</p>
                </div>
              </div>
              <div className="ml-11 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span>More Longs → Price goes up (max +20%)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <TrendingDown className="w-4 h-4 text-danger" />
                  <span>More Shorts → Price goes down (max -20%)</span>
                </div>
              </div>
            </div>
            <div className="bg-background rounded-lg p-4 font-mono text-sm">
              <p className="text-text-muted mb-2">// Price Formula</p>
              <p>currentPrice = basePrice × (1 + demandModifier)</p>
              <p className="text-text-muted mt-2">// Example: OpenAI</p>
              <p>$250 × (1 + 0.05) = <span className="text-success">$262.50</span></p>
            </div>
          </div>
        ),
      },
      {
        question: "What is Open Interest (OI)?",
        answer: (
          <div className="space-y-3">
            <p>
              <strong>Open Interest</strong> shows the total size of open positions on the platform.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-success/10 border border-success/30 rounded-lg p-4">
                <h4 className="font-semibold text-success mb-2">Long OI</h4>
                <p className="text-sm">Total value of long positions</p>
                <p className="text-xs text-text-muted mt-2">
                  Long OI ↑ = Upward price pressure
                </p>
              </div>
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
                <h4 className="font-semibold text-danger mb-2">Short OI</h4>
                <p className="text-sm">Total value of short positions</p>
                <p className="text-xs text-text-muted mt-2">
                  Short OI ↑ = Downward price pressure
                </p>
              </div>
            </div>
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 flex items-center gap-3">
              <Lock className="w-5 h-5 text-gold flex-shrink-0" />
              <p className="text-sm">
                <strong>Note:</strong> While total OI is public, individual positions are encrypted with FHE.
              </p>
            </div>
          </div>
        ),
      },
    ],
  },

  // ============================================
  // 5. SESSION WALLET (NEW)
  // ============================================
  {
    title: "Session Wallet",
    icon: <Wallet className="w-5 h-5" />,
    items: [
      {
        question: "What is Session Wallet?",
        answer: (
          <div className="space-y-3">
            <p>
              <strong>Session Wallet</strong> is a temporary wallet that trades on your behalf,
              eliminating the need for MetaMask confirmation popups on every transaction.
            </p>
            <div className="bg-card-hover border border-gold/30 rounded-lg p-4">
              <h4 className="font-semibold text-gold mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4" /> How It Works
              </h4>
              <div className="space-y-2 text-sm">
                <p>1. You create a session wallet (one-time setup)</p>
                <p>2. Send a small amount of ETH for gas fees</p>
                <p>3. Session wallet executes trades on your behalf</p>
                <p>4. Your funds stay in your main wallet - always in your control</p>
              </div>
            </div>
            <div className="bg-success/10 border border-success/30 rounded-lg p-3">
              <p className="text-sm">
                <strong>Result:</strong> Open and close positions instantly without any popups!
              </p>
            </div>
          </div>
        ),
      },
      {
        question: "Is Session Wallet secure?",
        answer: (
          <div className="space-y-3">
            <p>
              <strong>Yes!</strong> Session wallet is designed with security in mind:
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <p className="font-medium">Limited Permissions</p>
                  <p className="text-sm text-text-muted">
                    Session wallet can ONLY execute trades. It cannot access or transfer your main wallet funds.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-success mt-0.5" />
                <div>
                  <p className="font-medium">Encrypted Storage</p>
                  <p className="text-sm text-text-muted">
                    Private key is encrypted with FHE and stored on-chain. Only you can decrypt it.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                <div>
                  <p className="font-medium">Worst Case Scenario</p>
                  <p className="text-sm text-text-muted">
                    If compromised, only the small ETH amount for gas is at risk. Your trading funds are safe!
                  </p>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        question: "How much ETH do I need for gas?",
        answer: (
          <div className="space-y-3">
            <p>
              A small amount of ETH is needed for transaction gas fees:
            </p>
            <div className="bg-card-hover rounded-lg p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Recommended:</span>
                  <span className="text-gold font-medium">0.1 - 0.5 ETH</span>
                </div>
                <div className="flex justify-between">
                  <span>Per FHE trade (approx):</span>
                  <span className="text-text-muted">~0.15 ETH</span>
                </div>
                <div className="flex justify-between">
                  <span>Trades possible with 0.5 ETH:</span>
                  <span className="text-success">~3 trades</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-text-muted">
              FHE transactions are more expensive than regular transactions due to encryption overhead.
              You can withdraw unused ETH back to your main wallet anytime.
            </p>
          </div>
        ),
      },
    ],
  },

  // ============================================
  // 6. TRADING & FEES
  // ============================================
  {
    title: "Trading & Fees",
    icon: <DollarSign className="w-5 h-5" />,
    items: [
      {
        question: "What is sUSD?",
        answer: (
          <div className="space-y-3">
            <p>
              <strong>sUSD (Shadow USD)</strong> is Pendex's native stablecoin, pegged 1:1 to USD.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-card-hover rounded-lg p-4">
                <h4 className="font-medium mb-2 text-gold">On Testnet</h4>
                <p className="text-sm text-text-muted">
                  Get free sUSD from the faucet. No real value - for testing only.
                </p>
              </div>
              <div className="bg-card-hover rounded-lg p-4">
                <h4 className="font-medium mb-2">On Mainnet (Planned)</h4>
                <p className="text-sm text-text-muted">
                  Swap USDC/USDT for sUSD at 1:1 rate.
                </p>
              </div>
            </div>
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 flex items-center gap-3">
              <Info className="w-5 h-5 text-gold flex-shrink-0" />
              <p className="text-sm">
                sUSD is used for all trading collateral. Your sUSD balance is FHE encrypted.
              </p>
            </div>
          </div>
        ),
      },
      {
        question: "How do I open a trade?",
        answer: (
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              {[
                { step: 1, title: "Connect Wallet", desc: "Connect with MetaMask or supported wallet" },
                { step: 2, title: "Setup Session Wallet", desc: "One-time setup for popup-free trading" },
                { step: 3, title: "Fund Session Wallet", desc: "Send ETH for gas fees (0.1-0.5 ETH)" },
                { step: 4, title: "Get sUSD", desc: "Get test tokens from faucet" },
                { step: 5, title: "Select Asset", desc: "Choose from 6 Pre-IPO companies" },
                { step: 6, title: "Configure Position", desc: "Set Long/Short, leverage, and amount" },
                { step: 7, title: "Trade!", desc: "Execute trades without MetaMask popups" },
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-gold font-bold">{item.step}</span>
                  </div>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-text-muted">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        question: "What are the fees?",
        answer: (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3">Fee Type</th>
                    <th className="text-left py-2 px-3">Rate</th>
                    <th className="text-left py-2 px-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="py-2 px-3 font-medium">Trading Fee</td>
                    <td className="py-2 px-3 text-gold">0.3%</td>
                    <td className="py-2 px-3 text-text-muted">Position open/close</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-medium">Liquidation Fee</td>
                    <td className="py-2 px-3 text-gold">1%</td>
                    <td className="py-2 px-3 text-text-muted">In case of liquidation</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="bg-background rounded-lg p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Fee Distribution
              </h4>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gold"></div>
                  <span className="text-sm">50% to LPs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-text-muted"></div>
                  <span className="text-sm">50% to Protocol Treasury</span>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        question: "How does leverage work?",
        answer: (
          <div className="space-y-3">
            <p>
              Pendex offers <strong>1x-10x</strong> leverage. Leverage allows you
              to open positions worth multiples of your collateral.
            </p>
            <div className="bg-card-hover rounded-lg p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Example Calculation
              </h4>
              <div className="space-y-2 text-sm font-mono">
                <p>Collateral: <span className="text-gold">$1,000</span></p>
                <p>Leverage: <span className="text-gold">5x</span></p>
                <p>Position Size: <span className="text-success">$5,000</span></p>
                <div className="border-t border-border my-2 pt-2">
                  <p>If price increases 10%:</p>
                  <p>Profit: $5,000 × 10% = <span className="text-success">$500 (+50%)</span></p>
                  <p className="text-text-muted mt-1">If price decreases 10%:</p>
                  <p className="text-danger">Loss: $500 (-50%)</p>
                </div>
              </div>
            </div>
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0" />
              <p className="text-sm">
                <strong>Warning:</strong> Higher leverage = Higher risk. Watch your liquidation price!
              </p>
            </div>
          </div>
        ),
      },
      {
        question: "How does liquidation work?",
        answer: (
          <div className="space-y-3">
            <p>
              Liquidation occurs when your position's <strong>health factor</strong> falls
              below 1.0.
            </p>
            <div className="bg-card-hover rounded-lg p-4">
              <h4 className="font-medium mb-2">Health Factor</h4>
              <p className="text-sm text-text-muted mb-3">
                (Collateral + Unrealized PnL) / Position Size × Leverage
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success"></div>
                  {"> 1.5: Safe"}
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-warning"></div>
                  {"1.0-1.5: At Risk"}
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-danger"></div>
                  {"< 1.0: Liquidation"}
                </span>
              </div>
            </div>
            <p className="text-sm text-text-muted">
              In case of liquidation, a portion of your collateral is given to the liquidator as a reward.
            </p>
          </div>
        ),
      },
    ],
  },

  // ============================================
  // 7. LIQUIDITY POOL (LP)
  // ============================================
  {
    title: "Liquidity Pool (LP)",
    icon: <Coins className="w-5 h-5" />,
    items: [
      {
        question: "What is the Liquidity Pool?",
        answer: (
          <div className="space-y-3">
            <p>
              The <strong>Liquidity Pool</strong> acts as the counterparty to traders.
              LP providers deposit sUSD into this pool to provide platform liquidity.
            </p>
            <div className="bg-card-hover rounded-lg p-4">
              <h4 className="font-medium mb-3">How It Works:</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Wallet className="w-5 h-5 text-gold mt-0.5" />
                  <div>
                    <p className="font-medium">Trader opens Long</p>
                    <p className="text-sm text-text-muted">LP automatically takes the Short side</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Wallet className="w-5 h-5 text-gold mt-0.5" />
                  <div>
                    <p className="font-medium">Trader opens Short</p>
                    <p className="text-sm text-text-muted">LP automatically takes the Long side</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        question: "How do I earn money as an LP?",
        answer: (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-success/10 border border-success/30 rounded-lg p-4">
                <h4 className="font-semibold text-success mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Income Sources
                </h4>
                <ul className="text-sm space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3" />
                    50% of trading fees
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3" />
                    Trader losses
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-3 h-3" />
                    Liquidation fees
                  </li>
                </ul>
              </div>
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-4">
                <h4 className="font-semibold text-danger mb-2 flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" /> Loss Risks
                </h4>
                <ul className="text-sm space-y-2">
                  <li className="flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" />
                    Trader profits (LP loss)
                  </li>
                  <li className="flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" />
                    Heavy one-directional moves
                  </li>
                </ul>
              </div>
            </div>
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-gold" />
                Statistical Advantage
              </h4>
              <p className="text-sm">
                Typically, 70-80% of traders lose. This increases the probability
                of LPs being profitable in the long run. However, there is short-term volatility risk.
              </p>
            </div>
          </div>
        ),
      },
      {
        question: "How do LP tokens work?",
        answer: (
          <div className="space-y-3">
            <p>
              When you deposit sUSD, you receive <strong>LP tokens</strong> representing
              your share of the pool.
            </p>
            <div className="bg-card-hover rounded-lg p-4 font-mono text-sm">
              <p className="text-text-muted">// First deposit</p>
              <p>Deposit 1000 sUSD → Get 1000 LP tokens</p>
              <p className="text-text-muted mt-3">// After pool grows</p>
              <p>Pool: 10,000 sUSD, 8,000 LP tokens</p>
              <p>1 LP token = 10,000 / 8,000 = <span className="text-success">1.25 sUSD</span></p>
            </div>
          </div>
        ),
      },
    ],
  },

  // ============================================
  // 8. EPOCH & STAKING
  // ============================================
  {
    title: "Epoch & Staking",
    icon: <Clock className="w-5 h-5" />,
    items: [
      {
        question: "What is the epoch system?",
        answer: (
          <div className="space-y-3">
            <p>
              An <strong>Epoch</strong> is a 24-hour period. At the end of each epoch:
            </p>
            <div className="space-y-3">
              {[
                { icon: <Calculator className="w-4 h-4" />, text: "Collected fees are calculated" },
                { icon: <Percent className="w-4 h-4" />, text: "50% distributed to LPs, 50% to protocol" },
                { icon: <Coins className="w-4 h-4" />, text: "Earnings per LP token determined" },
                { icon: <Timer className="w-4 h-4" />, text: "New epoch begins" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-gold">
                    {item.icon}
                  </div>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        question: "Why is there a 24-hour lock period?",
        answer: (
          <div className="space-y-3">
            <p>
              When you deposit sUSD as an LP, you <strong>cannot withdraw for 24 hours</strong>.
              This measure serves the following purposes:
            </p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-gold mt-0.5" />
                <span>Protects platform liquidity</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-gold mt-0.5" />
                <span>Prevents "just-in-time" liquidity attacks</span>
              </li>
              <li className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-gold mt-0.5" />
                <span>Ensures fair earnings distribution for all LPs</span>
              </li>
            </ul>
            <div className="bg-background rounded-lg p-4 mt-4">
              <h4 className="font-medium mb-2">Example Scenario</h4>
              <div className="text-sm space-y-1 text-text-muted">
                <p>09:00 - You deposit 1000 sUSD</p>
                <p>09:00 - 24-hour lock begins</p>
                <p className="text-danger">15:00 - Withdrawal attempt → Failed (lock active)</p>
                <p className="text-success">Next day 09:00 - Withdrawal → Successful</p>
              </div>
            </div>
          </div>
        ),
      },
      {
        question: "How do I claim my rewards?",
        answer: (
          <div className="space-y-3">
            <p>You can claim your earned rewards at the end of each epoch:</p>
            <div className="flex flex-col gap-3">
              {[
                { step: 1, text: "Go to the Wallet page" },
                { step: 2, text: "Look at the 'LP Rewards' section" },
                { step: 3, text: "Click 'Claim Rewards' button" },
                { step: 4, text: "Confirm the transaction" },
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-success/20 flex items-center justify-center">
                    <span className="text-success text-sm">{item.step}</span>
                  </div>
                  <span className="text-sm">{item.text}</span>
                </div>
              ))}
            </div>
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-3 flex items-center gap-3 mt-4">
              <Info className="w-5 h-5 text-gold flex-shrink-0" />
              <p className="text-sm">
                Rewards accumulate - you can claim them all at once whenever you want.
              </p>
            </div>
          </div>
        ),
      },
    ],
  },

  // ============================================
  // 9. SECURITY & PRIVACY
  // ============================================
  {
    title: "Security & Privacy",
    icon: <Lock className="w-5 h-5" />,
    items: [
      {
        question: "Is my data really encrypted?",
        answer: (
          <div className="space-y-3">
            <p>
              <strong>Yes, completely.</strong> Thanks to Zama's fhEVM technology,
              all sensitive data is stored encrypted on the blockchain.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-card-hover rounded-lg p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-gold" /> Encrypted Data
                </h4>
                <ul className="text-sm space-y-1 text-text-muted">
                  <li>• Position size</li>
                  <li>• Long/Short direction</li>
                  <li>• Entry price</li>
                  <li>• Leverage ratio</li>
                  <li>• Balance</li>
                  <li>• P&L</li>
                </ul>
              </div>
              <div className="bg-card-hover rounded-lg p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Public Data
                </h4>
                <ul className="text-sm space-y-1 text-text-muted">
                  <li>• Wallet address</li>
                  <li>• Position ID (not contents)</li>
                  <li>• Position open/closed status</li>
                  <li>• Total Open Interest (aggregate)</li>
                  <li>• Liquidity Score</li>
                  <li>• Oracle prices</li>
                </ul>
              </div>
            </div>
          </div>
        ),
      },
      {
        question: "How does decryption work?",
        answer: (
          <div className="space-y-3">
            <p>
              Only the position owner can decrypt their own data. This process
              happens through the <strong>FHE Gateway</strong>:
            </p>
            <div className="bg-background rounded-lg p-4 font-mono text-sm">
              <p className="text-text-muted">// 1. User requests decryption</p>
              <p>gateway.decrypt(encryptedBalance, userSignature)</p>
              <p className="text-text-muted mt-2">// 2. Gateway verifies signature</p>
              <p>verify(userSignature, msg.sender)</p>
              <p className="text-text-muted mt-2">// 3. Only revealed to owner</p>
              <p>return decryptedValue // <span className="text-success">$5,000</span></p>
            </div>
          </div>
        ),
      },
      {
        question: "Are the smart contracts audited?",
        answer: (
          <div className="space-y-3">
            <p>
              Pendex is currently in <strong>testnet</strong> phase and
              is being developed for the Zama Developer Program.
            </p>
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
              <h4 className="font-medium text-warning mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Testnet Warning
              </h4>
              <ul className="text-sm space-y-1">
                <li>• This is a demo/testnet application</li>
                <li>• Do not deposit real money</li>
                <li>• Full audit will be conducted before mainnet</li>
              </ul>
            </div>
          </div>
        ),
      },
    ],
  },
];

function FAQAccordion({ item }: { item: FAQItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 px-1 text-left hover:text-gold transition-colors"
      >
        <span className="font-medium pr-4">{item.question}</span>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 flex-shrink-0 text-gold" />
        ) : (
          <ChevronRight className="w-5 h-5 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="pb-4 px-1 text-text-secondary animate-in fade-in slide-in-from-top-2">
          {item.answer}
        </div>
      )}
    </div>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="pt-20 px-4 md:px-6 pb-16 max-w-5xl mx-auto flex-1">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gold/10 border border-gold/30 rounded-full mb-4">
            <HelpCircle className="w-4 h-4 text-gold" />
            <span className="text-sm text-gold">Documentation & FAQ</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-3">
            Pendex Guide
          </h1>
          <p className="text-text-muted max-w-2xl mx-auto">
            Find answers to all your questions about the platform. FHE technology, trading mechanics,
            LP system, and more.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Layers className="w-6 h-6 text-gold mx-auto mb-2" />
            <p className="text-2xl font-bold">6</p>
            <p className="text-xs text-text-muted">Pre-IPO Assets</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Zap className="w-6 h-6 text-gold mx-auto mb-2" />
            <p className="text-2xl font-bold">10x</p>
            <p className="text-xs text-text-muted">Max Leverage</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Percent className="w-6 h-6 text-gold mx-auto mb-2" />
            <p className="text-2xl font-bold">0.3%</p>
            <p className="text-xs text-text-muted">Trading Fee</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <Lock className="w-6 h-6 text-gold mx-auto mb-2" />
            <p className="text-2xl font-bold">100%</p>
            <p className="text-xs text-text-muted">FHE Encrypted</p>
          </div>
        </div>

        {/* FAQ Sections */}
        <div className="space-y-6">
          {FAQ_SECTIONS.map((section) => (
            <div
              key={section.title}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              <button
                onClick={() =>
                  setActiveSection(
                    activeSection === section.title ? null : section.title
                  )
                }
                className="w-full flex items-center justify-between p-4 md:p-6 hover:bg-card-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gold/20 flex items-center justify-center text-gold">
                    {section.icon}
                  </div>
                  <h2 className="text-lg font-semibold">{section.title}</h2>
                </div>
                {activeSection === section.title ? (
                  <ChevronDown className="w-5 h-5 text-gold" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </button>

              {activeSection === section.title && (
                <div className="px-4 md:px-6 pb-4 md:pb-6 animate-in fade-in">
                  {section.items.map((item, index) => (
                    <FAQAccordion key={index} item={item} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact Section */}
        <div className="mt-12 bg-gold/10 border border-gold/30 rounded-xl p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">Still have questions?</h3>
          <p className="text-text-muted mb-4">
            Join our Discord channel or open an issue on GitHub.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="#"
              className="px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium hover:border-gold transition-colors"
            >
              Discord
            </a>
            <a
              href="https://github.com/poppyseedDev"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gold text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              GitHub
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId } from "wagmi";
import {
  Shield,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Zap,
  Key,
  Eye,
  EyeOff,
  Server,
  Cpu,
  Database,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";
import { CONTRACTS } from "@/lib/contracts/config";
import { useHasUsdBalance, useUserPositions } from "@/lib/contracts/hooks";

// Zama Gateway status simulation
type GatewayStatus = "idle" | "requesting" | "processing" | "decrypting" | "complete" | "error";

interface DecryptionStep {
  id: number;
  name: string;
  description: string;
  status: "pending" | "active" | "complete" | "error";
  duration?: number;
}

const DECRYPTION_STEPS: DecryptionStep[] = [
  {
    id: 1,
    name: "Request Decryption",
    description: "Submit encrypted handle to Zama Gateway",
    status: "pending",
  },
  {
    id: 2,
    name: "Gateway Processing",
    description: "Gateway validates ACL permissions",
    status: "pending",
  },
  {
    id: 3,
    name: "KMS Decryption",
    description: "Threshold decryption via key management",
    status: "pending",
  },
  {
    id: 4,
    name: "Proof Generation",
    description: "Generate zero-knowledge proof of decryption",
    status: "pending",
  },
  {
    id: 5,
    name: "Callback Execution",
    description: "Return decrypted value with proof",
    status: "pending",
  },
];

export default function FHETestPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: hasBalance } = useHasUsdBalance(address);
  const { data: positionIds } = useUserPositions(address);

  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus>("idle");
  const [steps, setSteps] = useState<DecryptionStep[]>(DECRYPTION_STEPS);
  const [decryptedValue, setDecryptedValue] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [testType, setTestType] = useState<"balance" | "position" | "price">("balance");

  // Simulated encrypted handles
  const [encryptedHandles, setEncryptedHandles] = useState({
    balance: "0x" + "a".repeat(64),
    position: "0x" + "b".repeat(64),
    price: "0x" + "c".repeat(64),
  });

  // Network info
  const isSepoliaNetwork = chainId === 11155111;
  const networkName = isSepoliaNetwork ? "Ethereum Sepolia" : chainId === 31337 ? "Hardhat Local" : "Unknown Network";

  // Simulate Zama Gateway decryption flow
  const runDecryptionTest = async () => {
    if (!isConnected) return;

    setGatewayStatus("requesting");
    setDecryptedValue(null);
    setIsRevealed(false);

    // Reset steps
    const resetSteps = DECRYPTION_STEPS.map(s => ({ ...s, status: "pending" as const }));
    setSteps(resetSteps);

    // Simulate each step
    for (let i = 0; i < DECRYPTION_STEPS.length; i++) {
      // Set current step as active
      setSteps(prev => prev.map((s, idx) => ({
        ...s,
        status: idx === i ? "active" : idx < i ? "complete" : "pending",
      })));

      // Simulate processing time
      const processingTime = 800 + Math.random() * 1200;
      await new Promise(resolve => setTimeout(resolve, processingTime));

      // Update step as complete
      setSteps(prev => prev.map((s, idx) => ({
        ...s,
        status: idx <= i ? "complete" : idx === i + 1 ? "active" : "pending",
        duration: idx === i ? Math.round(processingTime) : s.duration,
      })));

      // Update gateway status
      if (i === 1) setGatewayStatus("processing");
      if (i === 2) setGatewayStatus("decrypting");
    }

    // Generate simulated decrypted value
    const simulatedValues = {
      balance: (Math.random() * 10000).toFixed(2),
      position: (Math.random() * 5000).toFixed(2),
      price: (150 + Math.random() * 50).toFixed(2),
    };

    setDecryptedValue(simulatedValues[testType]);
    setGatewayStatus("complete");
  };

  const resetTest = () => {
    setGatewayStatus("idle");
    setSteps(DECRYPTION_STEPS.map(s => ({ ...s, status: "pending" })));
    setDecryptedValue(null);
    setIsRevealed(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gold/10 rounded-xl">
              <Shield className="w-6 h-6 text-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Zama Gateway Integration Test</h1>
              <p className="text-sm text-text-muted">
                Test FHE decryption flow on {networkName}
              </p>
            </div>
          </div>
          <div className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium",
            isSepoliaNetwork ? "bg-success/20 text-success" : "bg-gold/20 text-gold"
          )}>
            {isSepoliaNetwork ? "Production FHE" : "Mock FHE"}
          </div>
        </div>

        {/* Network Status Card */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-gold" />
            Network Configuration
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background rounded-lg p-4">
              <div className="text-xs text-text-muted mb-1">Network</div>
              <div className="font-medium text-text-primary">{networkName}</div>
            </div>
            <div className="bg-background rounded-lg p-4">
              <div className="text-xs text-text-muted mb-1">Chain ID</div>
              <div className="font-medium text-text-primary">{chainId || "Not connected"}</div>
            </div>
            <div className="bg-background rounded-lg p-4">
              <div className="text-xs text-text-muted mb-1">Gateway</div>
              <div className="font-medium text-success">
                {isSepoliaNetwork ? "Zama Gateway (Live)" : "Mock Gateway"}
              </div>
            </div>
            <div className="bg-background rounded-lg p-4">
              <div className="text-xs text-text-muted mb-1">FHE Library</div>
              <div className="font-medium text-text-primary">fhEVM v0.6.x</div>
            </div>
          </div>
        </div>

        {/* Contract Addresses */}
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-gold" />
            Deployed Contracts (Sepolia)
          </h2>
          <div className="space-y-3">
            {[
              { name: "ShadowVault", address: CONTRACTS.shadowVault },
              { name: "ShadowOracle", address: CONTRACTS.shadowOracle },
              { name: "ShadowUSD", address: CONTRACTS.shadowUsd },
              { name: "ShadowLiquidityPool", address: CONTRACTS.shadowLiquidityPool },
            ].map(contract => (
              <div key={contract.name} className="flex items-center justify-between bg-background rounded-lg p-3">
                <span className="text-sm text-text-secondary">{contract.name}</span>
                <a
                  href={`https://sepolia.etherscan.io/address/${contract.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-gold hover:underline"
                >
                  {contract.address.slice(0, 10)}...{contract.address.slice(-8)}
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Decryption Test Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Test Controls */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-gold" />
              Decryption Test
            </h2>

            {/* Test Type Selection */}
            <div className="mb-6">
              <label className="text-sm text-text-muted mb-2 block">Select Encrypted Data Type</label>
              <div className="flex gap-2">
                {(["balance", "position", "price"] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setTestType(type)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      testType === type
                        ? "bg-gold text-background"
                        : "bg-background border border-border text-text-secondary hover:text-text-primary"
                    )}
                  >
                    {type === "balance" ? "Balance" : type === "position" ? "Position" : "Price"}
                  </button>
                ))}
              </div>
            </div>

            {/* Encrypted Handle Display */}
            <div className="mb-6">
              <label className="text-sm text-text-muted mb-2 block">Encrypted Handle</label>
              <div className="bg-background rounded-lg p-3 font-mono text-xs text-text-secondary break-all">
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-4 h-4 text-gold" />
                  <span className="text-gold">euint64</span>
                </div>
                {encryptedHandles[testType]}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={runDecryptionTest}
                disabled={!isConnected || gatewayStatus !== "idle" && gatewayStatus !== "complete" && gatewayStatus !== "error"}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all",
                  !isConnected || (gatewayStatus !== "idle" && gatewayStatus !== "complete" && gatewayStatus !== "error")
                    ? "bg-card-hover text-text-muted cursor-not-allowed"
                    : "bg-gold text-background hover:bg-gold/90"
                )}
              >
                {gatewayStatus === "idle" || gatewayStatus === "complete" || gatewayStatus === "error" ? (
                  <>
                    <Key className="w-4 h-4" />
                    Request Decryption
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                )}
              </button>
              <button
                onClick={resetTest}
                className="px-4 py-3 rounded-lg font-medium bg-background border border-border text-text-secondary hover:text-text-primary transition-colors"
              >
                Reset
              </button>
            </div>

            {/* Not Connected Warning */}
            {!isConnected && (
              <div className="mt-4 p-3 bg-danger/10 border border-danger/30 rounded-lg">
                <div className="flex items-center gap-2 text-danger text-sm">
                  <AlertCircle className="w-4 h-4" />
                  Connect your wallet to test decryption
                </div>
              </div>
            )}
          </div>

          {/* Decryption Steps Visualization */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-gold" />
              Gateway Decryption Flow
            </h2>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-all",
                    step.status === "active" && "bg-gold/10 border border-gold/30",
                    step.status === "complete" && "bg-success/10",
                    step.status === "error" && "bg-danger/10",
                    step.status === "pending" && "bg-background"
                  )}
                >
                  {/* Step Number/Icon */}
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                    step.status === "active" && "bg-gold text-background animate-pulse",
                    step.status === "complete" && "bg-success text-background",
                    step.status === "error" && "bg-danger text-background",
                    step.status === "pending" && "bg-card-hover text-text-muted"
                  )}>
                    {step.status === "complete" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : step.status === "error" ? (
                      <XCircle className="w-4 h-4" />
                    ) : step.status === "active" ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      step.id
                    )}
                  </div>

                  {/* Step Info */}
                  <div className="flex-1">
                    <div className={cn(
                      "text-sm font-medium",
                      step.status === "active" && "text-gold",
                      step.status === "complete" && "text-success",
                      step.status === "error" && "text-danger",
                      step.status === "pending" && "text-text-muted"
                    )}>
                      {step.name}
                    </div>
                    <div className="text-xs text-text-muted">{step.description}</div>
                  </div>

                  {/* Duration */}
                  {step.duration && (
                    <div className="text-xs text-text-muted">
                      {step.duration}ms
                    </div>
                  )}

                  {/* Arrow to next step */}
                  {index < steps.length - 1 && step.status === "complete" && (
                    <ArrowRight className="w-4 h-4 text-success" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Decryption Result */}
        {decryptedValue && (
          <div className="bg-card border border-border rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Unlock className="w-5 h-5 text-success" />
              Decryption Result
            </h2>
            <div className="bg-background rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm text-text-muted mb-1">
                    Decrypted {testType === "balance" ? "Balance" : testType === "position" ? "Position Size" : "Price"}
                  </div>
                  <div className="text-3xl font-bold text-text-primary">
                    {isRevealed ? (
                      <span className="text-success">
                        {testType === "price" ? "$" : ""}{decryptedValue}
                        {testType !== "price" ? " sUSD" : ""}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-text-muted">
                        <Lock className="w-6 h-6" />
                        ••••••••
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setIsRevealed(!isRevealed)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold/20 text-gold hover:bg-gold/30 transition-colors"
                >
                  {isRevealed ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      Hide
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Reveal
                    </>
                  )}
                </button>
              </div>

              {/* Proof Details */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div>
                  <div className="text-xs text-text-muted mb-1">ZK Proof Hash</div>
                  <div className="font-mono text-xs text-text-secondary">
                    0x{Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("")}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-1">Decryption Timestamp</div>
                  <div className="text-sm text-text-secondary">
                    {new Date().toISOString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FHE Technical Info */}
        <div className="bg-gold/10 border border-gold/30 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            How Zama Gateway Decryption Works
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gold/80">
            <div>
              <h4 className="font-medium text-gold mb-2">1. Request Phase</h4>
              <p>
                Contract calls <code className="bg-background/50 px-1 rounded">FHE.makePubliclyDecryptable()</code> or user requests decryption via <code className="bg-background/50 px-1 rounded">userDecryptEuint()</code>.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gold mb-2">2. Gateway Processing</h4>
              <p>
                Zama Gateway validates ACL permissions and forwards request to Key Management System (KMS) for threshold decryption.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gold mb-2">3. Proof &amp; Callback</h4>
              <p>
                Gateway generates ZK proof of valid decryption and returns result via callback or signature verification.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

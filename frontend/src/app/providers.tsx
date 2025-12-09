"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia, hardhat } from "wagmi/chains";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { useState, createContext, useContext, useEffect } from "react";
import { type SupportedNetwork } from "@/lib/contracts/config";

// Configure chains - both Sepolia (with Zama FHE) and Hardhat (local dev)
const config = createConfig({
  chains: [sepolia, hardhat],
  transports: {
    [sepolia.id]: http("https://sepolia.infura.io/v3/84842078b09946638c03157f83405213"),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
});

// Network context for app-wide network selection
interface NetworkContextType {
  selectedNetwork: SupportedNetwork;
  setSelectedNetwork: (network: SupportedNetwork) => void;
  isFHEEnabled: boolean;
}

const NetworkContext = createContext<NetworkContextType>({
  selectedNetwork: "sepolia",
  setSelectedNetwork: () => {},
  isFHEEnabled: true,
});

export const useNetwork = () => useContext(NetworkContext);

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetwork>("sepolia");
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch with RainbowKit
  useEffect(() => {
    setMounted(true);
  }, []);

  // Sepolia uses real Zama FHE, Hardhat uses mock FHE
  const isFHEEnabled = selectedNetwork === "sepolia";

  return (
    <NetworkContext.Provider value={{ selectedNetwork, setSelectedNetwork, isFHEEnabled }}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider
            theme={darkTheme({
              accentColor: "#F7B731",
              accentColorForeground: "#0A0A0A",
              borderRadius: "medium",
              fontStack: "system",
            })}
          >
            {mounted ? children : null}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </NetworkContext.Provider>
  );
}

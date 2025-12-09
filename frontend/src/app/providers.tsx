"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia, type Chain } from "wagmi/chains";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { useState, createContext, useContext, useEffect } from "react";
import { ZAMA_DEVNET, type SupportedNetwork } from "@/lib/contracts/config";

// Define Zama Devnet as a wagmi chain
const zamaDevnet: Chain = {
  id: ZAMA_DEVNET.id,
  name: ZAMA_DEVNET.name,
  nativeCurrency: ZAMA_DEVNET.nativeCurrency,
  rpcUrls: ZAMA_DEVNET.rpcUrls,
  blockExplorers: ZAMA_DEVNET.blockExplorers,
  testnet: true,
};

// Configure chains - both Sepolia and Zama
const config = createConfig({
  chains: [sepolia, zamaDevnet],
  transports: {
    [sepolia.id]: http("https://sepolia.infura.io/v3/84842078b09946638c03157f83405213"),
    [zamaDevnet.id]: http("https://devnet.zama.ai"),
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
  isFHEEnabled: false,
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

  const isFHEEnabled = selectedNetwork === "zama";

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

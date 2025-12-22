"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia, hardhat } from "wagmi/chains";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { useState, createContext, useContext, useEffect } from "react";
import { type SupportedNetwork } from "@/lib/contracts/config";

// Theme types and context
type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Configure chains - both Sepolia (with Zama FHE) and Hardhat (local dev)
const config = createConfig({
  chains: [sepolia, hardhat],
  transports: {
    [sepolia.id]: http("https://eth-sepolia.g.alchemy.com/v2/QSKgm3HkNCI9KzcjveL9a"),
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
  const [theme, setThemeState] = useState<Theme>("dark");

  // Prevent hydration mismatch with RainbowKit
  useEffect(() => {
    setMounted(true);
    // Check localStorage or system preference
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) {
      setThemeState(stored);
    } else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
      setThemeState("light");
    }
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (mounted) {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("theme", theme);
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    setThemeState(prev => prev === "dark" ? "light" : "dark");
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  // Sepolia uses real Zama FHE, Hardhat uses mock FHE
  const isFHEEnabled = selectedNetwork === "sepolia";

  // RainbowKit theme based on current theme
  const rainbowTheme = theme === "dark"
    ? darkTheme({
        accentColor: "#F7B731",
        accentColorForeground: "#0A0A0A",
        borderRadius: "medium",
        fontStack: "system",
      })
    : lightTheme({
        accentColor: "#D4A017",
        accentColorForeground: "#FFFFFF",
        borderRadius: "medium",
        fontStack: "system",
      });

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      <NetworkContext.Provider value={{ selectedNetwork, setSelectedNetwork, isFHEEnabled }}>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider theme={rainbowTheme}>
              {mounted ? children : null}
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </NetworkContext.Provider>
    </ThemeContext.Provider>
  );
}

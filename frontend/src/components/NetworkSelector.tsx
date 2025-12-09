"use client";

import { useNetwork } from "@/app/providers";
import { NETWORK_INFO, type SupportedNetwork } from "@/lib/contracts/config";
import { useSwitchChain, useChainId } from "wagmi";

export function NetworkSelector() {
  const { selectedNetwork, setSelectedNetwork, isFHEEnabled } = useNetwork();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();

  const handleNetworkChange = (network: SupportedNetwork) => {
    setSelectedNetwork(network);
    const targetChainId = NETWORK_INFO[network].chainId;
    if (chainId !== targetChainId) {
      switchChain?.({ chainId: targetChainId });
    }
  };

  return (
    <div className="flex items-center gap-2 bg-surface-dark rounded-lg p-1">
      {(Object.keys(NETWORK_INFO) as SupportedNetwork[]).map((network) => {
        const info = NETWORK_INFO[network];
        const isActive = selectedNetwork === network;

        return (
          <button
            key={network}
            onClick={() => handleNetworkChange(network)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-md transition-all
              ${isActive
                ? "bg-accent text-background font-medium"
                : "text-text-secondary hover:text-text-primary hover:bg-surface-light"
              }
            `}
          >
            {/* Network Icon */}
            {info.icon === "ethereum" ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1.5l-8 13 8 4.5 8-4.5-8-13zm0 19l-8-4.5 8 11 8-11-8 4.5z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
            )}

            <span className="text-sm">{info.shortName}</span>

            {/* Badge */}
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              isActive ? "bg-background/20" : info.badgeColor
            }`}>
              {info.badge}
            </span>
          </button>
        );
      })}

      {/* FHE Status Indicator */}
      {isFHEEnabled && (
        <div className="flex items-center gap-1 px-2 text-green-500">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs">FHE Active</span>
        </div>
      )}
    </div>
  );
}

// Compact version for header
export function NetworkSelectorCompact() {
  const { selectedNetwork, setSelectedNetwork, isFHEEnabled } = useNetwork();
  const { switchChain } = useSwitchChain();
  const chainId = useChainId();

  const handleNetworkChange = (network: SupportedNetwork) => {
    setSelectedNetwork(network);
    const targetChainId = NETWORK_INFO[network].chainId;
    if (chainId !== targetChainId) {
      switchChain?.({ chainId: targetChainId });
    }
  };

  const currentInfo = NETWORK_INFO[selectedNetwork];

  return (
    <div className="relative group">
      <button className="flex items-center gap-2 px-3 py-2 bg-surface-dark rounded-lg hover:bg-surface-light transition-colors">
        {isFHEEnabled ? (
          <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
        ) : (
          <svg className="w-4 h-4 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1.5l-8 13 8 4.5 8-4.5-8-13zm0 19l-8-4.5 8 11 8-11-8 4.5z"/>
          </svg>
        )}
        <span className="text-sm">{currentInfo.shortName}</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      <div className="absolute right-0 top-full mt-1 w-64 bg-surface-dark rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 border border-border">
        <div className="p-2">
          {(Object.keys(NETWORK_INFO) as SupportedNetwork[]).map((network) => {
            const info = NETWORK_INFO[network];
            const isActive = selectedNetwork === network;

            return (
              <button
                key={network}
                onClick={() => handleNetworkChange(network)}
                className={`
                  w-full flex items-center gap-3 p-3 rounded-lg transition-colors
                  ${isActive ? "bg-accent/20" : "hover:bg-surface-light"}
                `}
              >
                {info.icon === "ethereum" ? (
                  <svg className="w-5 h-5 text-yellow-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1.5l-8 13 8 4.5 8-4.5-8-13zm0 19l-8-4.5 8 11 8-11-8 4.5z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                  </svg>
                )}
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className={isActive ? "text-accent font-medium" : ""}>{info.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${info.badgeColor} bg-surface-light`}>
                      {info.badge}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">{info.description}</p>
                </div>
                {isActive && (
                  <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Info footer */}
        <div className="border-t border-border p-3">
          <p className="text-xs text-text-secondary">
            {isFHEEnabled
              ? "All trades are encrypted with Zama FHE. Nobody can see your positions."
              : "Local development mode with mock FHE. Switch to Sepolia for real encryption."
            }
          </p>
        </div>
      </div>
    </div>
  );
}

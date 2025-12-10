/** @type {import('next').NextConfig} */
const webpack = require("webpack");

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "logo.clearbit.com",
      },
    ],
  },
  // Transpile problematic packages
  transpilePackages: [
    "@rainbow-me/rainbowkit",
    "@walletconnect/ethereum-provider",
    "@walletconnect/universal-provider",
    "@walletconnect/sign-client",
    "@walletconnect/core",
    "@reown/appkit",
  ],
  webpack: (config, { isServer }) => {
    // Node.js polyfills for browser - use require.resolve for actual polyfills
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      stream: false,
      url: false,
      zlib: false,
      http: false,
      https: false,
      assert: false,
      os: false,
      path: false,
      util: false,
      querystring: false,
      // These need actual polyfills for WalletConnect
      events: require.resolve("events/"),
      buffer: require.resolve("buffer/"),
      process: require.resolve("process/browser"),
    };

    // Define global for browser (needed by WalletConnect/crypto libraries)
    if (!isServer) {
      config.plugins.push(
        new webpack.ProvidePlugin({
          global: ["globalThis"],
          Buffer: ["buffer", "Buffer"],
          process: ["process/browser"],
        })
      );

      // Handle ESM/CJS issues
      config.module.rules.push({
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      });
    }

    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;

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
    "@reown/appkit-controllers",
    "@metamask/sdk",
  ],
  webpack: (config, { isServer }) => {
    // CRITICAL: Handle Zama WASM files FIRST (before any other rules)
    // This must be at the beginning to take precedence
    config.module.rules.unshift({
      test: /\.wasm$/,
      include: /node_modules[\\/]@zama-fhe/,
      type: "asset/resource",
      generator: {
        filename: "static/wasm/[name][ext]",
      },
    });

    // Node.js polyfills for browser
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
      // Actual polyfills for WalletConnect
      events: require.resolve("events/"),
      buffer: require.resolve("buffer/"),
      process: require.resolve("process/browser"),
    };

    if (!isServer) {
      // Define globals
      config.plugins.push(
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
          process: ["process/browser"],
        })
      );

      // DefinePlugin for globalThis (not as alias, but as definition)
      config.plugins.push(
        new webpack.DefinePlugin({
          "global": "globalThis",
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

    // WASM support
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },
};

module.exports = nextConfig;

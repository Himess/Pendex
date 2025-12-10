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
  webpack: (config, { isServer }) => {
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
    };

    // Define global for browser (needed by some crypto/FHE libraries)
    if (!isServer) {
      config.plugins.push(
        new webpack.ProvidePlugin({
          global: ["globalThis"],
        })
      );

      config.resolve.alias = {
        ...config.resolve.alias,
        "global": "globalThis",
      };
    }

    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

module.exports = nextConfig;

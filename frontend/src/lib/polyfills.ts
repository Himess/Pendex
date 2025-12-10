// Browser polyfills for Node.js globals
// Required by some crypto/FHE libraries that expect Node.js environment

if (typeof window !== "undefined") {
  // Define global as globalThis for browser
  if (typeof (window as any).global === "undefined") {
    (window as any).global = globalThis;
  }

  // Buffer polyfill (if needed)
  if (typeof (window as any).Buffer === "undefined") {
    (window as any).Buffer = {
      isBuffer: () => false,
      from: (data: any) => new Uint8Array(data),
      alloc: (size: number) => new Uint8Array(size),
    };
  }

  // Process polyfill (if needed)
  if (typeof (window as any).process === "undefined") {
    (window as any).process = {
      env: {},
      browser: true,
      version: "",
      versions: {},
    };
  }
}

export {};

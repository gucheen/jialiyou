import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Next's file tracer can miss the ESM branch of @swc/helpers conditional
  // exports. Include it explicitly so pnpm standalone images are complete.
  outputFileTracingIncludes: {
    "*": [
      "./node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/esm/**",
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;

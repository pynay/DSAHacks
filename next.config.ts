import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @duckdb/node-api ships native bindings; keep it out of the bundle so the
  // /api/zones route can require it at runtime on the server.
  serverExternalPackages: ["@duckdb/node-api"],
};

export default nextConfig;

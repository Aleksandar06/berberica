/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Ship a self-contained server build so the production Docker image only
  // needs `.next/standalone` + `.next/static` + `public` at runtime.
  output: "standalone",
  // Path-based multi-tenant routing (/:slug/*) is wired up in a later step.
};

module.exports = nextConfig;

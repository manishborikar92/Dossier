/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Native / Node-only packages must not be bundled into the server build.
  serverExternalPackages: ['better-sqlite3', '@react-pdf/renderer'],
};

export default nextConfig;

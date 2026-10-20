import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // Load these from node_modules at runtime instead of bundling them (pdfkit reads its font files from disk).
  serverExternalPackages: ['pdfkit', 'docx'],
  // Pin the project root so a stray package-lock.json in a parent folder can never confuse the build.
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
};

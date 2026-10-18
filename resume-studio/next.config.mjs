/** @type {import('next').NextConfig} */
export default {
  // Load these from node_modules at runtime instead of bundling them (pdfkit reads its font files from disk).
  serverExternalPackages: ['pdfkit', 'docx'],
  reactStrictMode: true,
};

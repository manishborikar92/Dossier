/**
 * PDF Generator via Native Headless Microsoft Edge
 *
 * Renders print-tailored HTML and invokes msedge.exe in headless mode to
 * generate ATS-friendly, text-searchable PDF documents without external dependencies.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { PDFParse } = require('pdf-parse');
const { generateResumeHtml } = require('./html-template');

/**
 * Default candidate paths for Microsoft Edge on Windows.
 */
const DEFAULT_EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

/**
 * Resolves the path to the Microsoft Edge executable.
 *
 * @param {string} [customPath] - Explicit path passed in options
 * @returns {string} Verified path to msedge.exe
 * @throws {Error} If Edge executable is not found
 */
function resolveEdgePath(customPath = null) {
  if (customPath) {
    if (fs.existsSync(customPath)) {
      return customPath;
    }
    throw new Error(`Microsoft Edge executable not found at specified path: ${customPath}`);
  }

  // Check config/settings.json if available
  try {
    const settingsPath = path.resolve(__dirname, '../../config/settings.json');
    if (fs.existsSync(settingsPath)) {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (settings?.export?.edge_path && fs.existsSync(settings.export.edge_path)) {
        return settings.export.edge_path;
      }
    }
  } catch {
    // Ignore config read error and proceed to defaults
  }

  // Check standard default locations
  for (const candidate of DEFAULT_EDGE_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    'Microsoft Edge executable not found. Please install Microsoft Edge or specify export.edge_path in config/settings.json.'
  );
}

/**
 * Generates a searchable vector PDF resume using native headless Microsoft Edge.
 *
 * @param {object} resumeModel - Canonical finalResumeModel
 * @param {object} [options]
 * @param {string} [options.outputPath] - Target PDF file path
 * @param {string} [options.edgePath] - Custom path to msedge.exe
 * @param {number} [options.timeout=25000] - Execution timeout in ms
 * @returns {Promise<{ filePath: string, fileSize: number, format: string, pageCount: number }>}
 */
async function generateResumePdf(resumeModel, options = {}) {
  if (!resumeModel || typeof resumeModel !== 'object') {
    throw new Error('Invalid resumeModel provided to generateResumePdf.');
  }

  const edgeExe = resolveEdgePath(options.edgePath);
  const outputDir = options.outputPath
    ? path.dirname(path.resolve(options.outputPath))
    : path.resolve(__dirname, '../../output');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const candidateSlug = (resumeModel.personal?.name || 'Candidate').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetRoleSlug = (resumeModel.metadata?.targetRole || 'fullstack').replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetLength = resumeModel.metadata?.resumeLength || '2page';
  const timestamp = Date.now();
  const defaultFilename = `${candidateSlug}_${targetRoleSlug}_${targetLength}_${timestamp}.pdf`;

  const finalPdfPath = options.outputPath
    ? path.resolve(options.outputPath)
    : path.join(outputDir, defaultFilename);

  // Generate HTML source
  const htmlContent = generateResumeHtml(resumeModel);
  const tempHtmlPath = path.join(outputDir, `.temp_${timestamp}_${Math.random().toString(36).slice(2, 8)}.html`);

  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

  const fileUrl = `file:///${tempHtmlPath.replace(/\\/g, '/')}`;
  const args = [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${finalPdfPath}`,
    fileUrl
  ];

  try {
    await new Promise((resolve, reject) => {
      const proc = execFile(
        edgeExe,
        args,
        { timeout: options.timeout || 25000, windowsHide: true },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`Microsoft Edge PDF conversion failed: ${error.message}`));
          } else {
            resolve({ stdout, stderr });
          }
        }
      );
    });

    if (!fs.existsSync(finalPdfPath)) {
      throw new Error(`PDF generation completed but output file was not created at: ${finalPdfPath}`);
    }

    const stats = fs.statSync(finalPdfPath);
    if (stats.size === 0) {
      throw new Error(`PDF output file was created with 0 bytes: ${finalPdfPath}`);
    }

    // Inspect page count via PDFParse
    const pdfBuffer = fs.readFileSync(finalPdfPath);
    const parser = new PDFParse(new Uint8Array(pdfBuffer));
    const info = await parser.getInfo();
    const pageCount = info.total || 1;

    return {
      filePath: finalPdfPath,
      fileSize: stats.size,
      format: 'pdf',
      pageCount
    };
  } finally {
    // Always clean up temp HTML file
    if (fs.existsSync(tempHtmlPath)) {
      try {
        fs.unlinkSync(tempHtmlPath);
      } catch {
        // Silently ignore cleanup errors
      }
    }
  }
}

module.exports = {
  resolveEdgePath,
  generateResumePdf,
  DEFAULT_EDGE_PATHS
};

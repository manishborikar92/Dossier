const fs = require('fs');
const path = require('path');

/**
 * Inspects project documentation for titles, purpose statements, and live URLs.
 *
 * @param {string} dirPath - Project directory
 * @returns {object} { title, purpose, liveUrls, docEvidenceFiles }
 */
function inspectDocs(dirPath) {
  let title = null;
  let purpose = null;
  const liveUrls = [];
  const docEvidenceFiles = [];

  const candidateFiles = ['README.md', 'readme.md', 'ARCHITECTURE.md', 'docs/README.md'];

  for (const rel of candidateFiles) {
    const fullPath = path.join(dirPath, rel);
    if (!fs.existsSync(fullPath)) continue;

    docEvidenceFiles.push(rel);
    let content = '';
    try {
      content = fs.readFileSync(fullPath, 'utf8');
    } catch {
      continue;
    }

    // 1. Extract Title (first top-level markdown heading)
    if (!title) {
      const titleMatch = content.match(/^#\s+(.+)$/m);
      if (titleMatch) {
        title = titleMatch[1].trim();
        // Remove trailing badges or links
        title = title.replace(/\[!\[.*?\]\(.*?\)\]\(.*?\)/g, '').trim();
      }
    }

    // 2. Extract Purpose (first non-empty paragraph after heading that isn't a badge or image)
    if (!purpose) {
      const lines = content.split('\n');
      let foundHeader = false;
      const paragraphLines = [];

      for (let line of lines) {
        line = line.trim();
        if (line.startsWith('#')) {
          foundHeader = true;
          continue;
        }
        if (!foundHeader) continue;
        if (line.startsWith('[!') || line.startsWith('![') || line.startsWith('```') || line.startsWith('<')) {
          continue;
        }
        if (line.length > 0) {
          paragraphLines.push(line);
          if (paragraphLines.length >= 2) break;
        } else if (paragraphLines.length > 0) {
          break;
        }
      }

      if (paragraphLines.length > 0) {
        purpose = paragraphLines.join(' ');
      }
    }

    // 3. Extract Live URLs
    const urlRegex = /https?:\/\/[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}(\/[^\s\)\>\"\'\\]*)?/g;
    const matches = content.match(urlRegex) || [];
    for (const url of matches) {
      const cleanUrl = url.replace(/[\.\,\)\]]+$/, '');
      const lower = cleanUrl.toLowerCase();
      // Filter out standard documentation, badge, license, and tool homepages
      const isGeneric = [
        'github.com', 'shields.io', 'badgen.net', 'img.shields.io',
        'nextjs.org', 'react.dev', 'reactjs.org', 'nodejs.org', 'npmjs.com',
        'vercel.com/docs', 'mongodb.com', 'opensource.org', 'tailwindcss.com',
        'ffmpeg.org', 'uuidgenerator.net', 'botfather', 'clickup.com',
        'console.firebase.google.com', 'w3.org', 'mozilla.org'
      ].some(domain => lower.includes(domain));

      if (!isGeneric) {
        liveUrls.push(cleanUrl);
      }
    }
  }

  return {
    title,
    purpose,
    liveUrls: Array.from(new Set(liveUrls)),
    docEvidenceFiles
  };
}

module.exports = {
  inspectDocs
};

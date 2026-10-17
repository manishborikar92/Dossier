/**
 * Generates the official final two-page resume deliverables in DOCX and PDF
 * using the canonical Intelligent Resume Builder session pipeline.
 */

const fs = require('fs');
const path = require('path');
const { scanProjects } = require('../src/discovery/scanner');
const { createSession } = require('../src/cli/session-state');
const { generateResumeDocx } = require('../src/export/docx-generator');
const { generateResumePdf } = require('../src/export/pdf-generator');
const { validateDeliverables } = require('../src/export/validator');

async function main() {
  console.log('1. Scanning verified projects catalog...');
  const scanResult = await scanProjects({ refresh: false });
  const catalog = scanResult.catalog;
  console.log(`   Found ${catalog.length} projects in catalog.`);

  console.log('2. Initializing canonical CLI session...');
  const session = createSession({ catalog });
  session.setTargetRole('fullstack');
  session.setResumeLength('2page');

  // Select the 3 required projects
  const targetProjectIds = ['pickleball', 'ca-workflow', 'iwlars'];
  session.selectProjects(targetProjectIds);

  // Enable leadership for complete verified profile representation
  session.toggleSection('leadership', true);

  const model = session.getFinalResumeModel();
  console.log(`   Target Role Title: "${model.metadata.targetRoleTitle}"`);
  console.log(`   Resume Length: ${model.metadata.resumeLength}`);
  console.log(`   Selected Projects: ${model.projects.map(p => p.name).join(', ')} (${model.projects.length} total)`);
  console.log(`   Certifications Count: ${model.certifications.length}`);

  const outputDir = path.resolve(__dirname, '../output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const finalDocxPath = path.join(outputDir, 'Manish_Borikar_Resume.docx');
  const finalPdfPath = path.join(outputDir, 'Manish_Borikar_Resume.pdf');

  console.log('3. Generating editable DOCX deliverable...');
  const docxRes = await generateResumeDocx(model, { outputPath: finalDocxPath });
  console.log(`   DOCX generated: ${docxRes.filePath} (${docxRes.fileSize} bytes)`);

  console.log('4. Generating searchable PDF deliverable via headless Edge...');
  const pdfRes = await generateResumePdf(model, { outputPath: finalPdfPath });
  console.log(`   PDF generated: ${pdfRes.filePath} (${pdfRes.fileSize} bytes, ${pdfRes.pageCount} pages)`);

  console.log('5. Validating deliverables...');
  const validation = await validateDeliverables({ docxPath: finalDocxPath, pdfPath: finalPdfPath }, model);
  console.log(`   Overall Valid: ${validation.allValid}`);
  console.log(`   DOCX Valid: ${validation.docx.valid}, Warnings: ${validation.docx.warnings.length}, Errors: ${validation.docx.errors.length}`);
  console.log(`   PDF Valid: ${validation.pdf.valid}, PageCount: ${validation.pdf.pageCount}/${validation.pdf.expectedPages}, Errors: ${validation.pdf.errors.length}`);

  if (validation.docx.errors.length > 0) {
    console.error('   DOCX Errors:', validation.docx.errors);
  }
  if (validation.pdf.errors.length > 0) {
    console.error('   PDF Errors:', validation.pdf.errors);
  }

  return { model, docxRes, pdfRes, validation };
}

main().catch(err => {
  console.error('Fatal error during resume generation:', err);
  process.exit(1);
});

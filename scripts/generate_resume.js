// Resume generator for Manish Borikar
// Run with:  node generate_resume.js
// Requires:  npm install docx

const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  LevelFormat, BorderStyle, TabStopType, TabStopPosition
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── Output file (saved next to this script) ────────────────────
const OUTPUT_FILE = path.join(__dirname, 'output/Manish-Borikar-Resume.docx');

// ── Color palette ──────────────────────────────────────────────
const ACCENT = "1F3864";   // dark navy
const BLACK  = "000000";
const GRAY   = "444444";

// ── Helpers ────────────────────────────────────────────────────
const hrParagraph = () =>
  new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: ACCENT, space: 1 } },
    spacing: { before: 80, after: 80 },
    children: []
  });

const sectionHeader = (text) =>
  new Paragraph({
    spacing: { before: 220, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 2 } },
    keepNext: true,
    children: [
      new TextRun({ text: text.toUpperCase(), bold: true, size: 22, color: ACCENT, font: "Arial" })
    ]
  });

const bullet = (text) =>
  new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 55, after: 55 },
    children: [new TextRun({ text, size: 20, font: "Arial", color: BLACK })]
  });

const twoColLine = (left, right, leftBold = false, rightGray = false) =>
  new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: 20, after: 20 },
    children: [
      new TextRun({ text: left, bold: leftBold, size: 20, font: "Arial", color: BLACK }),
      new TextRun({ text: "\t" + right, size: 19, font: "Arial", color: rightGray ? GRAY : BLACK, italics: rightGray })
    ]
  });

const jobTitle = (company, title, dates) =>
  new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: 160, after: 40 },
    children: [
      new TextRun({ text: title, bold: true, size: 21, font: "Arial", color: BLACK }),
      new TextRun({ text: " — " + company, size: 20, font: "Arial", color: GRAY }),
      new TextRun({ text: "\t" + dates, size: 19, font: "Arial", color: GRAY, italics: true }),
    ]
  });

const projectHeader = (name, dates) =>
  new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { before: 160, after: 40 },
    children: [
      new TextRun({ text: name, bold: true, size: 21, font: "Arial", color: BLACK }),
      new TextRun({ text: "\t" + dates, size: 19, font: "Arial", color: GRAY, italics: true }),
    ]
  });

const projectSubline = (tech) =>
  new Paragraph({
    spacing: { before: 0, after: 55 },
    children: [
      new TextRun({ text: "Tech Stack: ", bold: true, size: 19, font: "Arial", color: GRAY }),
      new TextRun({ text: tech, size: 19, font: "Arial", color: GRAY, italics: true }),
    ]
  });

const grayLine = (text, after) =>
  new Paragraph({
    spacing: { before: 20, after },
    children: [new TextRun({ text, size: 19, font: "Arial", color: GRAY })]
  });

// ── Document ───────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "\u2022",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 540, hanging: 270 } } }
        }]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } }
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
      }
    },
    children: [

      // ── NAME ──────────────────────────────────────────────────
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 60 },
        children: [new TextRun({ text: "MANISH BORIKAR", bold: true, size: 36, font: "Arial", color: ACCENT })]
      }),

      // ── CONTACT ───────────────────────────────────────────────
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 40 },
        children: [
          new TextRun({
            text: "Hyderabad, India  ·  manishborikar92@gmail.com  ·  +91 9309431756  ·  in/manishborikar  ·  github/manishborikar92",
            size: 17, font: "Arial", color: GRAY
          })
        ]
      }),

      hrParagraph(),

      // ── PROFESSIONAL SUMMARY ─────────────────────────────────
      sectionHeader("Professional Summary"),
      new Paragraph({
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({
            text: "Full Stack Developer with hands-on experience building and deploying production-grade full-stack applications using Next.js, Node.js, Express.js, and MongoDB. Grounded in core Computer Science fundamentals including Object-Oriented Programming, DBMS, and Operating Systems. Experienced across web development, 3D data processing, and desktop application engineering — with a focus on clean code, maintainable systems, and practical problem-solving. Comfortable working across the full stack from frontend interfaces to backend APIs and database integration.",
            size: 20, font: "Arial", color: BLACK
          })
        ]
      }),

      // ── TECHNICAL SKILLS ─────────────────────────────────────
      sectionHeader("Technical Skills"),

      ...[
        ["Languages:",            "Python, JavaScript (ES6+), SQL"],
        ["Frontend:",             "Next.js 16 (App Router), Tailwind CSS, HTML5, CSS3"],
        ["Backend & APIs:",       "Node.js 18+, Express.js 5, REST APIs, JWT Authentication, RBAC"],
        ["Databases:",            "MongoDB/Mongoose, MySQL, Firebase Firestore"],
        ["Core CS:",              "OOP, DBMS, Operating Systems, Data Structures & Algorithms"],
        ["DevOps & Tools:",       "Git/GitHub, npm, VS Code, Postman, PyInstaller"],
        ["Cloud & Integrations:", "Firebase, Cloudinary, Razorpay, Resend, Google OAuth"],
        ["Desktop & 3D:",         "PyQt6, Open3D, NumPy"],
      ].map(([label, value]) =>
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [
            new TextRun({ text: label + "  ", bold: true, size: 20, font: "Arial", color: BLACK }),
            new TextRun({ text: value, size: 20, font: "Arial", color: BLACK }),
          ]
        })
      ),

      // ── EXPERIENCE ───────────────────────────────────────────
      sectionHeader("Professional Experience"),

      jobTitle("Quantneural Pvt Ltd", "Full Stack Developer", "Jun 2025 – Present"),
      bullet("Led end-to-end full-stack development of two production platforms (CA-Workflow and IWLARS), handling system design, implementation, and deployment for real enterprise clients."),
      bullet("Built backend services using Node.js and Express.js with JWT-based RBAC, ensuring secure and role-restricted access across both platforms."),
      bullet("Engineered an end-to-end 3D point cloud preprocessing pipeline using Open3D, implementing downsampling, ground filtering, and wagon segmentation algorithms to process large-scale LiDAR scan data reliably."),
      bullet("Designed wagon load classification algorithms (Underloaded, Overloaded, Unbalanced) and implemented volume estimation using Digital Elevation Models (DEM), enabling automated load quality control at scale."),
      bullet("Built interactive 3D visualization and structural analysis tooling using PyQt6 and Matplotlib, with automated PDF/HTML report generation via WeasyPrint for engineering review workflows."),

      jobTitle("Quantneural Pvt Ltd", "Full Stack Developer Intern", "Feb 2025 – May 2025"),
      bullet("Built and deployed the Second Opinion telemedicine platform — a full-stack healthcare application with secure OAuth authentication and health record integration."),
      bullet("Developed frontend components using Next.js, reducing page load times by optimizing server-side rendering and code-splitting strategies."),
      bullet("Integrated Google OAuth via Firebase for social sign-in and implemented JWT-based email authentication with RBAC to manage role-specific access for doctors and patients."),

      jobTitle("PHN Technology Pvt. Ltd.", "Web Development Intern", "Apr 2023 – Jun 2023"),
      bullet("Designed and implemented responsive web interfaces using HTML, CSS, and JavaScript, delivering client-facing features with cross-browser compatibility and clean, maintainable code."),

      // ── PROJECTS (starts on a new page) ──────────────────────
      new Paragraph({ pageBreakBefore: true, children: [] }),
      sectionHeader("Key Projects"),

      // IWLARS
      projectHeader("IWLARS – Intelligent Wagon Load Analysis & Reporting System", "2025"),
      projectSubline("Python, Open3D, NumPy, Next.js 16, Firebase, Matplotlib, WeasyPrint"),
      bullet("Engineered a dual-component platform combining a Python desktop application for 3D point cloud processing with a Next.js web dashboard for viewing analytics and generated reports."),
      bullet("Developed an end-to-end preprocessing pipeline using Open3D for point cloud downsampling, ground filtering, wagon segmentation, and alignment — processing large LiDAR datasets efficiently."),
      bullet("Designed classification algorithms to detect wagon load status (Underloaded, Overloaded, Unbalanced) with volume estimation via Digital Elevation Models (DEM), enabling automated quality control."),
      bullet("Built a secure Firebase dashboard with RBAC and automated PDF/HTML report generation via WeasyPrint, eliminating manual reporting overhead."),

      // CA-Workflow
      projectHeader("CA-Workflow – Workflow Management Platform  |  caworkflow.com", "2025"),
      projectSubline("Next.js 16, Node.js 18+, Express.js 5, MongoDB/Mongoose 8, Cloudinary, Razorpay, Resend, JWT, RBAC"),
      bullet("Architected a secure, cloud-based workflow management system for Chartered Accountants, streamlining document exchange and client communication for professional CA firms."),
      bullet("Implemented dual authentication (Google OAuth for CA admins, ID-based for clients) with JWT session management and RBAC across all API routes."),
      bullet("Developed and maintained the API backend using Node.js and Express.js, with optimized MongoDB queries handling data operations across multiple users."),
      bullet("Integrated thread-based client communication with read receipts, automated Resend email notifications, and Razorpay payment gateway for three billing models (pay-per-document, invoice, subscriptions)."),

      // Smart Healthcare (college project)
      projectHeader("Smart Healthcare – AI Skin Disease Detection  |  git.new/smart-healthcare", "2024"),
      projectSubline("Python, ResNet50V2, Deep Learning, Hugging Face, JavaScript — College Project"),
      bullet("Built an AI diagnostic web application classifying skin conditions (malignant, benign, burns, healthy) by fine-tuning a ResNet50V2 model on a custom dataset and hosting it on Hugging Face."),
      bullet("Integrated the Hugging Face-hosted model API into the frontend, enabling users to upload skin images and receive classification results directly in the browser."),

      // ── EDUCATION ─────────────────────────────────────────────
      sectionHeader("Education"),

      twoColLine("B.Tech – Information Technology", "May 2025", true),
      grayLine("Kavi Kulguru Institute of Technology and Science, Ramtek  |  CGPA: 6.85/10", 80),

      twoColLine("HSC – Computer Science", "April 2021", true),
      grayLine("Lokmanya Vidhyalaya and Junior College, Warora  |  79.33%", 80),

      twoColLine("SSC", "March 2019", true),
      grayLine("Z.P. (Ex. Govt.) Jubilee High School, Chandrapur  |  66.20%", 80),

      // ── CERTIFICATIONS ────────────────────────────────────────
      sectionHeader("Certifications"),

      bullet("JavaScript Foundations Professional Certificate — Mozilla · 2025"),
      bullet("OpenEDG Python Institute: Programming with Python Professional Certificate — OpenEDG · 2025"),
      bullet("Career Essentials in Software Development, Generative AI & GitHub — Microsoft & LinkedIn / GitHub · 2025"),

      // ── LEADERSHIP & INVOLVEMENT ─────────────────────────────
      sectionHeader("Leadership & Involvement"),

      twoColLine("Technical Head – National Service Scheme (NSS)", "Jun 2024 – Apr 2025", true),
      grayLine("Kavi Kulguru Institute of Technology and Science, Ramtek — led technical initiatives and coordinated cross-departmental teams for community-focused projects.", 40),

    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, buffer);
  console.log("Resume generated successfully: " + OUTPUT_FILE);
});

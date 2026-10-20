// Starting data for the library, taken from the resume you reviewed bullet-by-bullet.
// Everything here is marked "confident" EXCEPT original-resume bullets for projects that were
// cut from the final resume (those start as "prep" so you re-check them before use).
import { bid } from '../src/lib/domain/ids.js';

const B = (prefix, texts, status = 'confident', source = 'resume') =>
  texts.map((text) => ({ id: bid(prefix, text), text, tags: [], status, source }));

export const profile = {
  name: 'Manish Borikar',
  contact: [
    { id: 'c-loc', type: 'location', label: 'Location', value: 'Hyderabad, India', short: '', on: true },
    { id: 'c-email', type: 'email', label: 'Email', value: 'manishborikar92@gmail.com', short: '', on: true },
    { id: 'c-phone', type: 'phone', label: 'Phone', value: '+91 9309431756', short: '', on: true },
    { id: 'c-linkedin', type: 'linkedin', label: 'LinkedIn', value: 'linkedin.com/in/manishborikar', short: 'in/manishborikar', on: true },
    { id: 'c-github', type: 'github', label: 'GitHub', value: 'github.com/manishborikar92', short: 'github/manishborikar92', on: true },
  ],
};

export const summaries = [{
  id: 'sum-fullstack', label: 'Full Stack (default)', status: 'confident',
  text: 'Full Stack Developer with hands-on experience building and deploying production-grade full-stack applications using Next.js, Node.js, Express.js, and MongoDB. Grounded in core Computer Science fundamentals including Object-Oriented Programming, DBMS, and Operating Systems. Experienced across web development, 3D data processing, and desktop application engineering — with a focus on clean code, maintainable systems, and practical problem-solving. Comfortable working across the full stack from frontend interfaces to backend APIs and database integration.',
}];

export const experience = [
  {
    id: 'exp-quantneural-dev', company: 'Quantneural Pvt Ltd', title: 'Full Stack Developer', location: 'Bengaluru, Karnataka', dates: 'Jun 2025 – Present', visible: true,
    bullets: B('b-qd', [
      'Led end-to-end full-stack development of two production platforms (CA-Workflow and IWLARS), handling system design, implementation, and deployment for real enterprise clients.',
      'Built backend services using Node.js and Express.js with JWT-based RBAC, ensuring secure and role-restricted access across both platforms.',
      'Engineered an end-to-end 3D point cloud preprocessing pipeline using Open3D, implementing downsampling, ground filtering, and wagon segmentation algorithms to process large-scale LiDAR scan data reliably.',
      'Designed wagon load classification algorithms (Underloaded, Overloaded, Unbalanced) and implemented volume estimation using Digital Elevation Models (DEM), enabling automated load quality control at scale.',
      'Built interactive 3D visualization and structural analysis tooling using PyQt6 and Matplotlib, with automated PDF/HTML report generation via WeasyPrint for engineering review workflows.',
    ]),
  },
  {
    id: 'exp-quantneural-intern', company: 'Quantneural Pvt Ltd', title: 'Full Stack Developer Intern', location: 'Remote', dates: 'Feb 2025 – May 2025', visible: true,
    bullets: B('b-qi', [
      'Built and deployed the Second Opinion telemedicine platform — a full-stack healthcare application with secure OAuth authentication and health record integration.',
      'Developed frontend components using Next.js, reducing page load times by optimizing server-side rendering and code-splitting strategies.',
      'Integrated Google OAuth via Firebase for social sign-in and implemented JWT-based email authentication with RBAC to manage role-specific access for doctors and patients.',
    ]),
  },
  {
    id: 'exp-phn', company: 'PHN Technology Pvt. Ltd.', title: 'Web Development Intern', location: 'Remote', dates: 'Apr 2023 – Jun 2023', visible: true,
    bullets: B('b-phn', [
      'Designed and implemented responsive web interfaces using HTML, CSS, and JavaScript, delivering client-facing features with cross-browser compatibility and clean, maintainable code.',
    ]),
  },
];

const S = (name, status = 'confident') => ({ id: bid('sk', name), name, status, tags: [] });
const group = (id, label, names, status) => ({ id, label, items: names.map((n) => S(n, status)) });

export const skills = [
  group('sk-languages', 'Languages', ['Python', 'JavaScript (ES6+)', 'SQL']),
  group('sk-frontend', 'Frontend', ['Next.js 16 (App Router)', 'Tailwind CSS', 'HTML5', 'CSS3']),
  group('sk-backend', 'Backend & APIs', ['Node.js 18+', 'Express.js 5', 'REST APIs', 'JWT Authentication', 'RBAC']),
  group('sk-databases', 'Databases', ['MongoDB/Mongoose', 'MySQL', 'Firebase Firestore']),
  group('sk-corecs', 'Core CS', ['OOP', 'DBMS', 'Operating Systems', 'Data Structures & Algorithms']),
  group('sk-devops', 'DevOps & Tools', ['Git/GitHub', 'npm', 'VS Code', 'Postman', 'PyInstaller']),
  group('sk-cloud', 'Cloud & Integrations', ['Firebase', 'Cloudinary', 'Razorpay', 'Resend', 'Google OAuth']),
  group('sk-desktop', 'Desktop & 3D', ['PyQt6', 'Open3D', 'NumPy']),
  // Things you told me you cannot confidently explain. Kept here so they are never claimed by accident.
  group('sk-excluded', 'Not claimed (excluded)', [
    'Docker', 'TypeScript', 'PostgreSQL', 'Flask', 'FastAPI', 'Microservices', 'TensorFlow', 'Scikit-learn',
    'OpenCV', 'SciPy', 'PyVista', 'Jest', 'Supertest', 'Three.js', 'React.js', 'Computer Networks', 'MVC architecture',
  ], 'exclude'),
];

export const resumeProjects = [
  {
    id: 'iwlars', title: 'IWLARS – Intelligent Wagon Load Analysis & Reporting System', ownership: 'company', link: '', year: '2025',
    techStack: ['Python', 'Open3D', 'NumPy', 'Next.js 16', 'Firebase', 'Matplotlib', 'WeasyPrint'], tags: [], visible: true, notes: '', kb: null,
    bullets: B('b-iw', [
      'Engineered a dual-component platform combining a Python desktop application for 3D point cloud processing with a Next.js web dashboard for viewing analytics and generated reports.',
      'Developed an end-to-end preprocessing pipeline using Open3D for point cloud downsampling, ground filtering, wagon segmentation, and alignment — processing large LiDAR datasets efficiently.',
      'Designed classification algorithms to detect wagon load status (Underloaded, Overloaded, Unbalanced) with volume estimation via Digital Elevation Models (DEM), enabling automated quality control.',
      'Built a secure Firebase dashboard with RBAC and automated PDF/HTML report generation via WeasyPrint, eliminating manual reporting overhead.',
    ]),
  },
  {
    id: 'ca-workflow', title: 'CA-Workflow – Workflow Management Platform', ownership: 'company', link: 'caworkflow.com', year: '2025',
    techStack: ['Next.js 16', 'Node.js 18+', 'Express.js 5', 'MongoDB/Mongoose 8', 'Cloudinary', 'Razorpay', 'Resend', 'JWT', 'RBAC'], tags: [], visible: true, notes: '', kb: null,
    bullets: B('b-ca', [
      'Architected a secure, cloud-based workflow management system for Chartered Accountants, streamlining document exchange and client communication for professional CA firms.',
      'Implemented dual authentication (Google OAuth for CA admins, ID-based for clients) with JWT session management and RBAC across all API routes.',
      'Developed and maintained the API backend using Node.js and Express.js, with optimized MongoDB queries handling data operations across multiple users.',
      'Integrated thread-based client communication with read receipts, automated Resend email notifications, and Razorpay payment gateway for three billing models (pay-per-document, invoice, subscriptions).',
    ]),
  },
  {
    id: 'smart-healthcare', title: 'Smart Healthcare – AI Skin Disease Detection', ownership: 'college', link: 'git.new/smart-healthcare', year: '2024',
    techStack: ['Python', 'ResNet50V2', 'Deep Learning', 'Hugging Face', 'JavaScript'], tags: [], visible: true, notes: '', kb: null,
    bullets: B('b-sh', [
      'Built an AI diagnostic web application classifying skin conditions (malignant, benign, burns, healthy) by fine-tuning a ResNet50V2 model on a custom dataset and hosting it on Hugging Face.',
      'Integrated the Hugging Face-hosted model API into the frontend, enabling users to upload skin images and receive classification results directly in the browser.',
    ]),
  },
  {
    id: 'second-opinion', title: 'Second Opinion – Online Healthcare Platform', ownership: 'company', link: '', year: '2025',
    techStack: ['Next.js', 'Node.js', 'Express.js', 'MongoDB', 'Firebase'], tags: [], visible: true,
    notes: 'The original resume also said "real-time communication" - you confirmed that was inaccurate, so it was left out.', kb: null,
    bullets: B('b-so', ['Designed and developed a full-stack online healthcare platform facilitating remote consultations and patient access to specialised medical opinions.'], 'prep', 'original-resume'),
  },
  {
    id: 'enroutear', title: 'EnRouteAR – Augmented Reality Navigation Web App', ownership: 'college', link: 'enroutear.vercel.app', year: 'Jan – Apr 2023',
    techStack: ['JavaScript', 'WebAR', 'HTML/CSS', 'Mapbox', 'AR.js', 'A-Frame'], tags: [], visible: true, notes: '', kb: null,
    bullets: B('b-en', [
      'Developed an AR navigation system for guiding new visitors around the KITS campus using WebAR and real-time geolocation.',
      'Enabled interactive campus navigation using AR elements from user location to selected destination.',
    ], 'prep', 'original-resume'),
  },
  {
    id: 'song-recognition-bot', title: 'Song Recognition Bot', ownership: 'personal', link: 't.me/TuneDetectBot', year: 'Dec 2024 – Feb 2025',
    techStack: ['Python', 'ACRCloud API', 'Telegram Bot API'], tags: [], visible: true, notes: '', kb: null,
    bullets: B('b-sb', [
      'Telegram-based bot that identifies songs from links, videos, or voice notes using ACRCloud, providing detailed metadata and streaming links.',
      'Supports track download functionality alongside recognition from multiple media input formats.',
    ], 'prep', 'original-resume'),
  },
];

export const education = [
  { id: 'edu-btech', degree: 'B.Tech – Information Technology', institution: 'Kavi Kulguru Institute of Technology and Science, Ramtek', dates: 'May 2025', detail: 'CGPA: 6.85/10' },
  { id: 'edu-hsc', degree: 'HSC – Computer Science', institution: 'Lokmanya Vidhyalaya and Junior College, Warora', dates: 'April 2021', detail: '79.33%' },
  { id: 'edu-ssc', degree: 'SSC', institution: 'Z.P. (Ex. Govt.) Jubilee High School, Chandrapur', dates: 'March 2019', detail: '66.20%' },
];

export const certifications = [
  'JavaScript Foundations Professional Certificate — Mozilla · 2025',
  'OpenEDG Python Institute: Programming with Python Professional Certificate — OpenEDG · 2025',
  'Career Essentials in Software Development, Generative AI & GitHub — Microsoft & LinkedIn / GitHub · 2025',
].map((text) => ({ id: bid('cert', text), text, status: 'confident' }));

export const involvement = [{
  id: 'inv-nss', role: 'Technical Head – National Service Scheme (NSS)', org: 'Kavi Kulguru Institute of Technology and Science, Ramtek',
  dates: 'Jun 2024 – Apr 2025', text: 'led technical initiatives and coordinated cross-departmental teams for community-focused projects.',
}];

export const targets = [
  {
    id: 'target-tcs-prime', name: 'TCS NQT Digital / Prime — Software Developer', kind: 'job', company: 'TCS', keywords: [], focusProjectIds: ['iwlars'], notes: 'IWLARS is pinned so it always leads on this resume.',
    jd: `Role Overview: TCS Digital and TCS Prime roles target high-performing candidates with strong problem-solving ability, core CS fundamentals, and hands-on development skills.
Responsibilities: Design, develop, test, and deploy scalable software solutions. Write clean, efficient, and maintainable code. Work on full-stack development (frontend + backend + APIs). Build and integrate RESTful services. Debug, troubleshoot, and optimize performance. Participate in code reviews and follow best practices. Collaborate with cross-functional teams. Contribute to system design and architecture.
Core Requirements: Strong Data Structures and Algorithms (VERY IMPORTANT). Proficiency in Java / JavaScript / Python / C++. Strong understanding of OOP, OS, DBMS, Computer Networks. Experience with web development (frontend + backend). Knowledge of REST APIs and backend architecture. Familiarity with SQL / NoSQL databases. Strong problem-solving and analytical skills.
Preferred: Experience with React.js, Node.js, Express.js. Exposure to microservices architecture. Basic cloud knowledge (AWS / GCP / Azure). Familiarity with Git, Docker, CI/CD. Strong real-world project experience.
Skills: Frontend React.js, JavaScript, HTML, CSS. Backend Node.js, Express.js, REST API development. Database SQL (MySQL / PostgreSQL), NoSQL (MongoDB). Tools Git, Docker, CI/CD, Cloud.`,
  },
  {
    id: 'target-fullstack-generic', name: 'Full Stack Developer (generic example)', kind: 'job', company: '', keywords: [], focusProjectIds: [],
    notes: 'Example only - replace the text with a real job description.',
    jd: 'Full Stack Developer. Build and maintain web applications using Next.js or React with Node.js and Express. Design REST APIs, work with MongoDB or SQL databases, implement authentication (JWT, OAuth), use Git, write clean maintainable code, debug and optimize performance, and collaborate with cross-functional teams. Nice to have: AWS, Docker, CI/CD, TypeScript.',
  },
];

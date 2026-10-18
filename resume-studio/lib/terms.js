// Technology / concept dictionary used for job-description matching.
// Each row: [key, label, ...aliases]. Matching is case-insensitive with word boundaries.
const ROWS = [
  // languages
  ['javascript', 'JavaScript', 'javascript', 'js', 'es6', 'es6+', 'ecmascript'],
  ['typescript', 'TypeScript', 'typescript'],
  ['python', 'Python', 'python'],
  ['java', 'Java', 'java', 'core java', 'j2ee'],
  ['cpp', 'C++', 'c++', 'cpp'],
  ['csharp', 'C#', 'c#'],
  ['sql', 'SQL', 'sql', 'rdbms', 'relational database', 'relational databases'],
  ['php', 'PHP', 'php'],
  ['golang', 'Go', 'golang'],
  ['html', 'HTML', 'html', 'html5'],
  ['css', 'CSS', 'css', 'css3', 'sass', 'scss'],
  ['dart', 'Dart/Flutter', 'dart', 'flutter'],
  // frontend
  ['react', 'React', 'react', 'react.js', 'reactjs'],
  ['nextjs', 'Next.js', 'next.js', 'nextjs'],
  ['angular', 'Angular', 'angular', 'angularjs'],
  ['vue', 'Vue', 'vue', 'vue.js', 'vuejs'],
  ['tailwind', 'Tailwind CSS', 'tailwind', 'tailwind css', 'tailwindcss'],
  ['redux', 'Redux', 'redux', 'zustand'],
  ['responsive', 'Responsive design', 'responsive', 'responsive design'],
  ['frontend', 'Frontend', 'frontend', 'front-end', 'front end'],
  // backend
  ['nodejs', 'Node.js', 'node.js', 'nodejs', 'node'],
  ['express', 'Express.js', 'express', 'express.js', 'expressjs'],
  ['django', 'Django', 'django'],
  ['flask', 'Flask', 'flask'],
  ['fastapi', 'FastAPI', 'fastapi'],
  ['spring', 'Spring Boot', 'spring', 'spring boot', 'springboot'],
  ['laravel', 'Laravel', 'laravel'],
  ['dotnet', '.NET', '.net', 'asp.net'],
  ['backend', 'Backend', 'backend', 'back-end', 'back end'],
  ['fullstack', 'Full stack', 'full stack', 'full-stack', 'fullstack', 'mern', 'mean stack'],
  ['graphql', 'GraphQL', 'graphql'],
  ['websocket', 'WebSockets', 'websocket', 'websockets', 'socket.io'],
  ['microservices', 'Microservices', 'microservice', 'microservices'],
  ['rest', 'REST APIs', 'rest', 'restful', 'rest api', 'rest apis'],
  ['api', 'APIs', 'api', 'apis'],
  ['mvc', 'MVC', 'mvc'],
  // databases
  ['mongodb', 'MongoDB', 'mongodb', 'mongo', 'mongoose'],
  ['mysql', 'MySQL', 'mysql'],
  ['postgresql', 'PostgreSQL', 'postgresql', 'postgres'],
  ['sqlite', 'SQLite', 'sqlite'],
  ['redis', 'Redis', 'redis'],
  ['firebase', 'Firebase', 'firebase', 'firestore'],
  ['nosql', 'NoSQL', 'nosql'],
  ['oracle', 'Oracle', 'oracle'],
  ['database', 'Databases', 'database', 'databases'],
  ['dbms', 'DBMS', 'dbms'],
  // cloud / devops
  ['aws', 'AWS', 'aws', 'amazon web services', 'ec2'],
  ['gcp', 'GCP', 'gcp', 'google cloud'],
  ['azure', 'Azure', 'azure'],
  ['docker', 'Docker', 'docker', 'containerization', 'containerisation'],
  ['kubernetes', 'Kubernetes', 'kubernetes', 'k8s'],
  ['cicd', 'CI/CD', 'ci/cd', 'cicd', 'continuous integration', 'continuous delivery', 'github actions', 'jenkins'],
  ['git', 'Git', 'git', 'github', 'gitlab', 'version control'],
  ['linux', 'Linux', 'linux'],
  ['vercel', 'Vercel', 'vercel'],
  ['cloud', 'Cloud', 'cloud'],
  // concepts
  ['oop', 'OOP', 'oop', 'oops', 'object-oriented', 'object oriented'],
  ['dsa', 'Data Structures & Algorithms', 'data structures', 'algorithms', 'algorithm', 'dsa'],
  ['os', 'Operating Systems', 'operating system', 'operating systems'],
  ['networks', 'Computer Networks', 'computer networks', 'networking'],
  ['systemdesign', 'System design', 'system design', 'architecture', 'design patterns'],
  ['testing', 'Testing', 'unit testing', 'testing', 'jest', 'pytest', 'tdd'],
  ['agile', 'Agile', 'agile', 'scrum'],
  ['debugging', 'Debugging', 'debugging', 'troubleshoot', 'troubleshooting'],
  ['performance', 'Performance', 'performance', 'optimization', 'optimisation', 'optimize', 'optimizing'],
  ['codereview', 'Code reviews', 'code review', 'code reviews'],
  ['jwt', 'JWT', 'jwt', 'json web token'],
  ['rbac', 'RBAC', 'rbac', 'role-based access', 'role based access'],
  ['oauth', 'OAuth', 'oauth', 'google oauth', 'sso'],
  ['auth', 'Authentication', 'authentication', 'authorization', 'authorisation'],
  ['ssr', 'Server-side rendering', 'ssr', 'server-side rendering', 'server side rendering', 'code-splitting', 'code splitting'],
  ['caching', 'Caching', 'caching', 'cache'],
  // ai / data
  ['ml', 'Machine learning', 'machine learning', 'ml'],
  ['dl', 'Deep learning', 'deep learning', 'neural network', 'neural networks', 'cnn', 'resnet', 'resnet50v2', 'resnet-50', 'resnet-50 v2'],
  ['tensorflow', 'TensorFlow', 'tensorflow', 'keras'],
  ['pytorch', 'PyTorch', 'pytorch'],
  ['opencv', 'OpenCV', 'opencv'],
  ['nlp', 'NLP', 'nlp', 'natural language processing'],
  ['llm', 'LLMs / GenAI', 'llm', 'llms', 'large language model', 'generative ai', 'gen ai', 'genai'],
  ['huggingface', 'Hugging Face', 'hugging face', 'huggingface'],
  ['numpy', 'NumPy', 'numpy'],
  ['pandas', 'Pandas', 'pandas'],
  // 3d / desktop
  ['open3d', 'Open3D', 'open3d'],
  ['lidar', 'LiDAR', 'lidar', 'livox'],
  ['pointcloud', 'Point clouds', 'point cloud', 'point clouds', 'point-cloud', 'pcd'],
  ['dem', 'Digital Elevation Models', 'digital elevation model', 'digital elevation models', 'dem'],
  ['pyqt', 'PyQt', 'pyqt', 'pyqt6', 'pyside'],
  ['desktop', 'Desktop apps', 'desktop application', 'desktop app', 'desktop applications'],
  ['pyinstaller', 'PyInstaller', 'pyinstaller'],
  // integrations / tools
  ['payments', 'Payments', 'razorpay', 'payment gateway', 'payments', 'payment', 'phonepe', 'stripe'],
  ['cloudinary', 'Cloudinary', 'cloudinary'],
  ['postman', 'Postman', 'postman'],
  ['npm', 'npm', 'npm'],
  ['vscode', 'VS Code', 'vs code', 'vscode', 'visual studio code'],
];

export const TERM_LABELS = Object.fromEntries(ROWS.map((r) => [r[0], r[1]]));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

const INDEX = ROWS.map(([key, , ...aliases]) => ({
  key,
  res: aliases.map((a) => new RegExp(`(^|[^a-z0-9+#.])${esc(a)}(?![a-z0-9+#])`, 'g')),
}));

/** Returns Map<termKey, occurrenceCount> for every dictionary term found in text. */
export function extractTerms(text = '') {
  const t = String(text).toLowerCase();
  const out = new Map();
  for (const { key, res } of INDEX) {
    let n = 0;
    for (const re of res) {
      re.lastIndex = 0;
      n += [...t.matchAll(re)].length;
    }
    if (n) out.set(key, n);
  }
  return out;
}

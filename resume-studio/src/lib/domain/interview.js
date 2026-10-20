// Likely interview questions per topic, generated from what is actually on the resume.
import { extractTerms, TERM_LABELS } from './terms.js';
import { resolveResume, collectIncluded } from './model.js';

export const QUESTIONS = {
  jwt: ['Walk me through how a user logs in and then calls a protected route: where is the token created, stored and verified?', 'What are the three parts of a JWT, and why can the payload be read but not forged?', 'What happens when a token expires? Access token vs refresh token?'],
  rbac: ['How does your system know a user\'s role, and exactly where is the role checked?', 'How is RBAC different from a simple isAdmin flag? How would you add a new role?'],
  rest: ['What do GET, POST, PUT and DELETE mean, and when would you use each?', 'What does "stateless" mean for an API? Which status codes did you return and why?'],
  api: ['How do you design an endpoint: validation, error responses, naming?', 'How did you test your APIs (Postman or otherwise)?'],
  oauth: ['What happens, step by step, when a user clicks "Sign in with Google"?', 'Where does your app verify the identity that Google returns?'],
  auth: ['Authentication vs authorization: give an example from your project.', 'How do you store passwords safely?'],
  nextjs: ['What is the App Router? Server components vs client components?', 'SSR vs static generation vs client-side rendering: when would you use each?'],
  ssr: ['How does server-side rendering work and how does it affect page load time?', 'What is code splitting and what does Next.js split for you automatically?'],
  react: ['What is the virtual DOM and why does React use it?', 'useState vs useEffect: give an example from your code.'],
  nodejs: ['How does the Node.js event loop work? Why is Node good for I/O-heavy servers?', 'Blocking vs non-blocking code: give an example.'],
  express: ['What is middleware in Express? In what order does a request pass through yours?', 'How did you structure routes, controllers and error handling?'],
  mvc: ['Which parts of your project are the model, the view and the controller?'],
  mongodb: ['Why MongoDB for this project? What were the collections and how were they related?', 'What is an index? Did you add any, and why?'],
  mysql: ['Write a query with a JOIN. INNER vs LEFT JOIN?', 'Primary key vs foreign key?'],
  sql: ['Write a query with GROUP BY and HAVING. What is the difference between WHERE and HAVING?', 'What is normalization (up to 3NF)?'],
  dbms: ['Explain the ACID properties.', 'What is an index and when can it hurt performance?', 'Normalization 1NF to 3NF with a small example.'],
  database: ['SQL vs NoSQL: how did you decide?'],
  nosql: ['When would you choose NoSQL over SQL?'],
  postgresql: ['How does PostgreSQL differ from MongoDB for your use case?'],
  firebase: ['What did Firebase do in your project versus your own backend?', 'How does your backend trust a user signed in through Firebase?'],
  payments: ['Walk through a payment from clicking Pay to confirmation. How do you know it really succeeded (webhook vs client callback)?', 'What happens if the user pays but closes the tab?'],
  cloudinary: ['Why use a media service instead of storing files on your own server or database?', 'How did you enforce upload limits?'],
  open3d: ['What is a point cloud? What does each step (downsampling, ground filtering, segmentation) do, and why in that order?', 'Which Open3D functions did you actually call?'],
  lidar: ['How does LiDAR produce points? What does a single point contain?', 'What problems does noisy scan data cause?'],
  pointcloud: ['How large were the scans and how did you keep processing fast?'],
  dem: ['What is a Digital Elevation Model and how is volume estimated from it?', 'How did you decide what overloaded / underloaded / unbalanced means?'],
  pyqt: ['How did you keep the UI responsive during heavy processing?', 'How did you package the app into an installable program?'],
  pyinstaller: ['What does PyInstaller do, and what problems did you hit when packaging?'],
  desktop: ['Why a desktop app for this problem instead of a web app?'],
  numpy: ['Why NumPy over plain Python lists? What is vectorization?'],
  python: ['list vs tuple vs set vs dict: when to use each?', 'What are decorators or generators? Show a small example.'],
  javascript: ['var vs let vs const; what is a closure?', 'How do promises and async/await work?'],
  html: ['What is semantic HTML? Give an example.'],
  css: ['Explain the box model. Flexbox vs grid?', 'How did you make the layout responsive?'],
  responsive: ['What techniques did you use to make pages responsive?'],
  git: ['Merge vs rebase? How do you resolve a merge conflict?', 'What branching approach did you follow at work?'],
  oop: ['Explain the four OOP pillars with an example from your own code.', 'Abstract class vs interface?'],
  dsa: ['Array vs linked list; time complexity of lookup in a hash map?', 'Explain one sorting algorithm you know. Expect a basic live-coding problem (reverse a string, find duplicates).'],
  os: ['Process vs thread? What is a deadlock?', 'Explain paging in simple terms.'],
  networks: ['What happens when you type a URL and press Enter?', 'TCP vs UDP; HTTP vs HTTPS.'],
  dl: ['What is fine-tuning / transfer learning and why use a pre-trained model?', 'How did you prepare the dataset and avoid overfitting? What accuracy did you reach?'],
  huggingface: ['What does the Hugging Face Space expose, and how does your frontend call it?'],
  tensorflow: ['What is a tensor? How does training differ from inference?'],
  docker: ['Container vs virtual machine? What goes in a Dockerfile?'],
  testing: ['What kinds of tests have you written and what did they catch?'],
  systemdesign: ['Draw the architecture of your main project: components, data flow, where each part runs.'],
  performance: ['Describe a performance problem you fixed and how you measured the improvement.'],
  fullstack: ['Trace one feature from button click to database and back.'],
  backend: ['How is your backend organized, and how does it talk to the database?'],
  frontend: ['How do you manage state and fetch data in the frontend?'],
  cloud: ['Where is your application hosted, and how is it deployed?'],
  typescript: ['What does TypeScript add over JavaScript?'],
  flask: ['How does a Flask route differ from an Express route?'],
};

export const PROJECT_QUESTIONS = (title) => [
  `Explain "${title}" in 60 seconds: the problem, who uses it, your role, the stack, the result.`,
  'Which parts did you write yourself, and how did you verify code you did not write by hand (including AI-generated code)?',
  'What was the hardest bug or decision, and how did you resolve it?',
  'If you rebuilt it today, what would you change?',
];

/** Build a prep sheet for a resume: topics (with where they appear) + per-project questions. */
export function buildPrep(data, resume) {
  const r = resolveResume(data, resume);
  const items = collectIncluded(r);
  const topics = new Map();
  for (const it of items) {
    for (const [key] of extractTerms(it.text)) {
      if (!QUESTIONS[key]) continue;
      const t = topics.get(key) || { key, label: TERM_LABELS[key] || key, count: 0, where: [], questions: QUESTIONS[key] };
      t.count += 1;
      if (!t.where.find((w) => w.label === it.label)) t.where.push({ section: it.section, label: it.label });
      topics.set(key, t);
    }
  }
  return {
    topics: [...topics.values()].sort((a, b) => b.count - a.count),
    projects: r.projects.map((p) => ({ title: p.title, questions: PROJECT_QUESTIONS(p.title) })),
    unverified: items.filter((i) => i.status !== 'confident'),
  };
}

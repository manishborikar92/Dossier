/**
 * Keyword matching between a job description and the user's own library.
 *
 * Deterministic and offline. It only ever ranks and highlights things that already exist in the
 * library; terms in the job description with no evidence become "gaps" and are never suggested for inclusion.
 */

// "Label|canonical|alias1,alias2" - canonical forms use only a-z, 0-9, + and #.
const LEXICON_SOURCE = `
JavaScript|javascript|js,ecmascript,es6
TypeScript|typescript|ts
Python|python|python3
Java|java|
C++|cpp|c++
C#|csharp|c#
Go|golang|golang
Rust|rust|
PHP|php|
Ruby|ruby|
Kotlin|kotlin|
Swift|swift|
Dart|dart|
SQL|sql|
Bash|bash|shell scripting,shell
HTML|html|html5
CSS|css|css3
React|react|react.js,reactjs
Next.js|nextjs|next.js,next js
Vue|vue|vue.js,vuejs
Angular|angular|angularjs
Svelte|svelte|
Redux|redux|
Zustand|zustand|
Tailwind CSS|tailwind|tailwind css,tailwindcss
Node.js|nodejs|node.js,node js,node
Express|express|express.js,expressjs
NestJS|nestjs|nest.js
Django|django|
Flask|flask|
FastAPI|fastapi|
Spring Boot|spring|spring boot
Laravel|laravel|
Ruby on Rails|rails|ruby on rails
Flutter|flutter|
React Native|react native|react-native
GraphQL|graphql|
REST API|rest api|rest apis,restful,rest
gRPC|grpc|
WebSockets|websocket|websockets,web sockets
JWT|jwt|json web token,json web tokens
OAuth|oauth|oauth2,oauth 2.0
RBAC|rbac|role-based access control,role based access control
MongoDB|mongodb|mongo,mongoose
PostgreSQL|postgresql|postgres,psql
MySQL|mysql|
SQLite|sqlite|
Redis|redis|
Firebase|firebase|firestore
DynamoDB|dynamodb|
Elasticsearch|elasticsearch|elastic search
Prisma|prisma|
Drizzle|drizzle|drizzle orm
pgvector|pgvector|
AWS|aws|amazon web services
GCP|gcp|google cloud,google cloud platform
Azure|azure|
Docker|docker|
Kubernetes|kubernetes|k8s
Terraform|terraform|
CI/CD|cicd|ci/cd,ci cd,continuous integration,continuous delivery
GitHub Actions|github actions|
Git|git|
GitHub|github|
Linux|linux|
Nginx|nginx|
Vercel|vercel|
Cloudflare|cloudflare|
Microservices|microservices|microservice,micro-services
System design|system design|
API design|api design|
OOP|oop|object oriented,object-oriented,object oriented programming
Data structures|data structures|dsa,data structures and algorithms
Algorithms|algorithms|
Databases|databases|dbms
Operating systems|operating systems|
Agile|agile|
Scrum|scrum|
Unit testing|unit testing|unit tests
Jest|jest|
Pytest|pytest|
Playwright|playwright|
Cypress|cypress|
TDD|tdd|test driven development,test-driven development
Machine learning|machine learning|ml
Deep learning|deep learning|
Computer vision|computer vision|
NLP|nlp|natural language processing
LLM|llm|llms,large language models,large language model
Generative AI|generative ai|genai,gen ai
TensorFlow|tensorflow|
Keras|keras|
PyTorch|pytorch|
OpenCV|opencv|
NumPy|numpy|
Pandas|pandas|
SciPy|scipy|
scikit-learn|scikit-learn|scikit learn,sklearn
Open3D|open3d|
Jupyter|jupyter|
Pyodide|pyodide|
WebAssembly|webassembly|wasm
PyQt|pyqt|pyqt6,pyqt5
Three.js|threejs|three.js
Framer Motion|framer motion|
Razorpay|razorpay|
Stripe|stripe|
Cloudinary|cloudinary|
Postman|postman|
Figma|figma|
Responsive design|responsive design|responsive web design
Accessibility|accessibility|a11y,wcag
Performance optimization|performance optimization|performance optimisation
Web performance|web performance|
SEO|seo|
PWA|pwa|progressive web app,progressive web apps
Augmented reality|augmented reality|ar.js
`;

interface LexEntry {
  label: string;
  canon: string;
  aliases: string[];
}

const LEXICON: LexEntry[] = LEXICON_SOURCE.trim()
  .split('\n')
  .map((line) => {
    const [label, canon, aliases] = line.split('|');
    return { label, canon, aliases: (aliases ?? '').split(',').map((a) => a.trim()).filter(Boolean) };
  });

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const BOUNDARY_BEFORE = '(?<![a-z0-9+#])';
const BOUNDARY_AFTER = '(?![a-z0-9+#])';
const phraseRe = (phrase: string, flags = 'g') =>
  new RegExp(`${BOUNDARY_BEFORE}${escapeRe(phrase)}${BOUNDARY_AFTER}`, flags);

// Alias -> canonical replacements, longest alias first so "react native" wins over "react".
const ALIAS_RULES: { re: RegExp; canon: string }[] = LEXICON.flatMap((e) =>
  e.aliases.filter((a) => a !== e.canon).map((a) => ({ alias: a, canon: e.canon })),
)
  .sort((a, b) => b.alias.length - a.alias.length)
  .map(({ alias, canon }) => ({ re: phraseRe(alias), canon }));

/** Lower-case text and rewrite known aliases to their canonical form. */
export function normalize(text: string): string {
  let t = text.toLowerCase();
  for (const rule of ALIAS_RULES) t = t.replace(rule.re, rule.canon);
  return t;
}

const countOf = (haystack: string, canon: string): number => (haystack.match(phraseRe(canon)) ?? []).length;
const has = (haystack: string, canon: string): boolean => countOf(haystack, canon) > 0;

/* ---------- inputs and outputs ---------- */

export interface MatchLibrary {
  skills: { id: number; name: string; category: string }[];
  projects: {
    id: number;
    name: string;
    technologies: string[];
    tags: string[];
    keywords: string[];
    overview: string;
    description: string;
    role: string;
    contributions: string;
    features: string;
    results: string;
    bullets: { text: string }[];
  }[];
  experiences: { id: number; title: string; org: string; description: string; bullets: { text: string }[] }[];
}

export interface Evidence {
  type: 'skill' | 'project' | 'experience';
  id: number;
  name: string;
}
export interface MatchedTerm {
  label: string;
  canon: string;
  count: number;
  evidence: Evidence[];
}
export interface MatchResult {
  hasJobDescription: boolean;
  matched: MatchedTerm[];
  gaps: MatchedTerm[];
  projects: { id: number; name: string; score: number; percent: number; terms: string[] }[];
  skills: { id: number; name: string; term: string }[];
  experiences: { id: number; title: string; org: string; score: number; terms: string[] }[];
}

const cleanName = (name: string): string =>
  name
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b\d+(\.\d+)*\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function matchJobDescription(jd: string, lib: MatchLibrary): MatchResult {
  const empty: MatchResult = { hasJobDescription: false, matched: [], gaps: [], projects: [], skills: [], experiences: [] };
  if (jd.trim() === '') return empty;
  const text = normalize(jd);

  // Searchable text per library item.
  const skillText = lib.skills.map((s) => ({ s, text: normalize(`${s.name} ${s.category}`) }));
  const projectText = lib.projects.map((p) => ({
    p,
    tech: normalize([p.name, ...p.technologies, ...p.tags, ...p.keywords].join(' \n ')),
    body: normalize([p.overview, p.description, p.role, p.contributions, p.features, p.results, ...p.bullets.map((b) => b.text)].join(' \n ')),
  }));
  const experienceText = lib.experiences.map((e) => ({
    e,
    text: normalize([e.title, e.org, e.description, ...e.bullets.map((b) => b.text)].join(' \n ')),
  }));

  // Candidate terms: the built-in lexicon plus anything named in the user's own skills and technologies.
  const candidates = new Map<string, string>(); // canon -> label
  for (const e of LEXICON) candidates.set(e.canon, e.label);
  const vocabulary = [...lib.skills.map((s) => s.name), ...lib.projects.flatMap((p) => p.technologies)];
  for (const name of vocabulary) {
    const label = cleanName(name);
    const canon = normalize(label);
    if (canon.length >= 2 && !candidates.has(canon)) candidates.set(canon, label);
  }

  const matched: MatchedTerm[] = [];
  const gaps: MatchedTerm[] = [];
  for (const [canon, label] of candidates) {
    const count = countOf(text, canon);
    if (count === 0) continue;
    const evidence: Evidence[] = [];
    for (const { s, text: t } of skillText) if (has(t, canon)) evidence.push({ type: 'skill', id: s.id, name: s.name });
    for (const { p, tech, body } of projectText) if (has(tech, canon) || has(body, canon)) evidence.push({ type: 'project', id: p.id, name: p.name });
    for (const { e, text: t } of experienceText) if (has(t, canon)) evidence.push({ type: 'experience', id: e.id, name: `${e.title} at ${e.org}` });
    (evidence.length > 0 ? matched : gaps).push({ label, canon, count, evidence });
  }
  const byCount = (a: MatchedTerm, b: MatchedTerm) => b.count - a.count || a.label.localeCompare(b.label);
  matched.sort(byCount);
  gaps.sort(byCount);

  // Rank projects: a term in the technology list counts more than a mention in prose.
  const weight = (count: number) => 1 + Math.log(count);
  const projects = projectText
    .map(({ p, tech, body }) => {
      let score = 0;
      const terms: string[] = [];
      for (const m of matched) {
        if (has(tech, m.canon)) score += 3 * weight(m.count);
        else if (has(body, m.canon)) score += 1.5 * weight(m.count);
        else continue;
        terms.push(m.label);
      }
      return { id: p.id, name: p.name, score, terms };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const top = projects[0]?.score ?? 0;

  const experiences = experienceText
    .map(({ e, text: t }) => {
      let score = 0;
      const terms: string[] = [];
      for (const m of matched) {
        if (!has(t, m.canon)) continue;
        score += weight(m.count);
        terms.push(m.label);
      }
      return { id: e.id, title: e.title, org: e.org, score, terms };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score);

  const skills: MatchResult['skills'] = [];
  for (const { s, text: t } of skillText) {
    const hit = matched.find((m) => has(t, m.canon));
    if (hit) skills.push({ id: s.id, name: s.name, term: hit.label });
  }

  return {
    hasJobDescription: true,
    matched,
    gaps,
    projects: projects.map((p) => ({ ...p, percent: top > 0 ? Math.round((100 * p.score) / top) : 0 })),
    skills,
    experiences,
  };
}

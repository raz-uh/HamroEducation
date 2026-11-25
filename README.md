# Hamro Education

**Hamro Education** is a Nepal-first, full-stack digital learning platform built for **Class 10 / SEE**, **Class 11–12 (NEB +2)**, and **Nepal's Bachelor Entrance Examinations** (IOE, MECEE-BL, CMAT, BSc CSIT, KU, Pokhara, and Purbanchal universities).

Organized around five core learning pillars — **Learn**, **Practice**, **Test**, **Improve**, and **Discover** — it combines bilingual English/नेपाली chapter notes, high-contrast formula sheets, a multi-stage reviewed question bank, timed server-validated mock exams, personalized mistake recovery, verified higher-education guides, AI study tools, and role-based governance.

---

## Core Features

### 1. School Learning System (`/school`)
- **Nepal CDC & NEB Curriculum**: Covers Class 10 / SEE (Compulsory & Optional Group I/II subjects) and Class 11–12 NEB streams (Science, Management, Humanities, Education).
- **Chapter Reader**: Bilingual English / नेपाली toggle, complete notes, concepts & definitions, dark-ink formula sheets, solved examples, interactive practice MCQs, chapter tests, revision sheets, personal notes, and bookmarks.
- **Editorial Guardrail**: Students only see `published` resources; draft and in-review content stays hidden from student and guest views.

### 2. Bachelor Entrance & Question Bank (`/entrance`, `/question-bank`)
- **Entrance Tracks**: Structured hubs for Management (CMAT, PUMAT, KUUMAT), IT & Computer Science (BSc CSIT, BIT, BCA), Engineering (IOE BE/BArch, KU), Medical & Health (MECEE-BL), Law (BALLB), and Agriculture/Forestry.
- **Multi-Format Question Bank**: Supports Single-correct MCQ, Multiple-correct MCQ, True/False, Short/Long Answer, Numerical, Diagram-based, Case-based, Assertion & Reason, and Matching questions across a 5-stage editorial workflow (`Draft` → `Academic Review` → `Correction` → `Approval` → `Published`).

### 3. Timed Server-Validated Mock Exams (`/exams`)
- **Authoritative Server Grading**: Correct answers and explanations are stripped from client exam snapshots and evaluated exclusively on the server with support for section timers, negative marking, and duplicate-submission protection.
- **Instant Breakdown**: Subject, chapter, and topic accuracy reports with automatic syncing to Mistake Book and Weak Topic analytics.

### 4. Student Mastery Hub (`/dashboard`, `/practice/daily`, `/leaderboards`)
- **Recommended Next Action**: Dynamically prioritizes weak topics, unresolved mistakes, pending study tasks, due flashcards, and daily challenges.
- **Mistake Book (`/dashboard/mistakes`)**: Automatically logs incorrect answers from chapter practice and mock exams with an interactive **Reattempt Mode** that marks items `resolved` once mastered.
- **Weak Topic Detection**: Flags topics below 60% accuracy with targeted recovery recommendations.
- **Spaced-Repetition Flashcards & Study Planner**: Custom/curated decks with interval scheduling and goal-oriented study tasks.
- **Daily Challenge, Badges & Leaderboards**: Streak tracking, milestone badges, and privacy-safe student leaderboards.

### 5. Higher-Education & Career Explorer (`/explore`)
- **Course Directory & Comparison (`/explore/courses`)**: Filterable by category and university with a side-by-side 2–4 course comparison matrix.
- **Colleges, Scholarships, Careers & Opportunities**: Verified Nepal university, college, fee (NPR), scholarship, career path, and admission calendar directories backed by mandatory `source` and `last_verified_date` fields.

### 6. AI Learning Suite & Student Community (`/community`)
- **Server-Side Gemini Integration**: Context-aware AI Study Assistant inside Chapter Reader and Exam Result views, AI Career Assistant in Explorer, AI Study Plan Generator, and an Admin/Teacher AI Question Generator (enforced to save strictly as `Draft`).
- **Community Q&A**: Course/subject discussions, voting, educator-verified answers, and moderation reporting.

### 7. Nepal Governance & RBAC Administration (`/admin`, `/rbac`, `/institutions`)
- **12-Role RBAC Matrix**: Guest, Registered Student, Teacher, Academic Reviewer, Content Manager, Question Bank Manager, Examination Manager, Career Information Manager, Moderator, Institutional Administrator, Administrator, and Super Administrator.
- **Admin Console**: Overview metrics, user & role management, curriculum/content governance, CSV bulk question import, exam builder, explorer catalog maintenance, audit logs, and Nepal-scoped system settings.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, Motion
- **Backend**: Node.js (v22 native ESM), Express 4, `tsx` (development)
- **Database & ORM**: PostgreSQL (Cloud SQL) with Drizzle ORM (`drizzle-orm`, `drizzle-kit`, `pg`)
- **Authentication**: Firebase Authentication (`firebase`, `firebase-admin`) + email/password scrypt hashing and signed session tokens
- **AI Runtime**: `@google/genai` (strictly server-side proxy routes)
- **Testing**: Node.js built-in test runner (`node:test`) via `tsx`

---

## Project Structure

```text
├── server.ts                  # Express API server, auth, RBAC, exam engine, and static/Vite serving
├── index.html                 # HTML entry point and metadata
├── vite.config.ts             # Vite configuration + asset copy hook
├── package.json               # Scripts and dependencies
├── firebase-applet-config.json# Public Firebase web app configuration
├── public/                    # Static public assets (favicon.ico)
└── src/
    ├── App.tsx                # Client router shell and view orchestration
    ├── index.css              # Tailwind CSS theme and typography tokens
    ├── components/            # Modular UI views (School, Entrance, Exams, Dashboard, Explore, Community)
    │   └── admin/             # Admin dashboard & governance panels
    ├── context/               # AuthContext (Firebase + session state)
    ├── db/
    │   ├── schema.ts          # PostgreSQL Drizzle schema
    │   ├── drizzle.config.ts  # Drizzle Kit PostgreSQL configuration
    │   ├── index.ts           # PostgreSQL connection pool
    │   ├── *-queries.ts       # Domain query modules
    │   └── seed*.ts           # Idempotent Nepal curriculum, exam, and explorer seeders
    ├── lib/                   # Pure business logic, RBAC, router, grading engine, and *.test.ts unit tests
    ├── middleware/            # Server auth & permission middleware
    ├── server/                # Server-only Gemini AI integration service
    └── types/                 # Shared TypeScript API contracts
```

---

## Key Application Routes

| Route | View |
| --- | --- |
| `/` | Curriculum Workspace & Nepal Student Hero |
| `/school/class-10`, `/school/see`, `/school/class-11`, `/school/class-12` | School Grade & Stream Library |
| `/school/:gradeSlug/:subjectCode/:chapterKey` | Interactive Chapter Reader |
| `/entrance`, `/entrance/:examSlug` | Bachelor Entrance Hub & Exam Guide |
| `/question-bank` | Multi-Format Question Bank |
| `/exams`, `/exams/:examId`, `/exams/:examId/result` | Mock Exam Center, Timed Runner & Result Breakdown |
| `/dashboard`, `/dashboard/mistakes`, `/dashboard/flashcards`, `/dashboard/planner` | Student Mastery Hub |
| `/practice/daily`, `/leaderboards` | Daily Challenge, Achievements & Leaderboards |
| `/explore/courses`, `/explore/courses/:slug`, `/explore/courses/compare` | Course Directory, Detail & Comparison |
| `/explore/colleges`, `/explore/scholarships`, `/explore/careers`, `/explore/opportunities` | Higher-Education & Career Explorer |
| `/community` | Student Community Q&A |
| `/admin`, `/rbac`, `/institutions`, `/schema` | Governance, RBAC Matrix, Institutions & Schema Blueprint |

---

## Getting Started

### Prerequisites
- **Node.js** `>= 22`
- **PostgreSQL** database instance (e.g., Cloud SQL PostgreSQL)
- **Firebase** project configured in `firebase-applet-config.json`

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and populate your runtime secrets and database connection variables:

```bash
cp .env.example .env
```

Required / supported environment variables:

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-side Gemini API key for AI study, career, planner, and question generation tools |
| `APP_URL` | Hosted application base URL |
| `ADMIN_BOOTSTRAP_PASSCODE` | Optional server-side passcode for claiming initial Super Administrator access |
| `SQL_HOST` | PostgreSQL host |
| `SQL_DB_NAME` | PostgreSQL database name |
| `SQL_USER` / `SQL_PASSWORD` | Runtime PostgreSQL credentials used by `src/db/index.ts` |
| `SQL_ADMIN_USER` / `SQL_ADMIN_PASSWORD` | Schema migration credentials used by `src/db/drizzle.config.ts` |
| `SESSION_SECRET` | Optional HMAC signing secret for session tokens |
| `PORT` | Server port (defaults to `3000`) |

> Never expose `GEMINI_API_KEY`, database passwords, or `SESSION_SECRET` in client-side `VITE_*` variables.

### 3. Push Database Schema

```bash
npx drizzle-kit push --config=src/db/drizzle.config.ts
```

### 4. Run Locally

```bash
npm run dev
```

The server starts on `http://localhost:3000` with Express API routes and Vite middleware mounted together, and automatically seeds Nepal curriculum, exam, and explorer data on first boot.

### 5. Build & Run in Production

```bash
npm run build
npm start
```

- `npm run build` outputs the frontend bundle to `dist/`.
- `npm start` runs `node server.ts` on `0.0.0.0:${PORT:-3000}`, serving both `/api/*` and the compiled `dist/` SPA.

---

## Verification & Testing

Run TypeScript type checking and the pure-logic unit test suite:

```bash
npm run lint
npx --yes tsx --test src/lib/*.test.ts
```

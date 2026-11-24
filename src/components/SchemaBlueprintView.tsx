import { useEffect, useState } from 'react';
import { Database, KeyRound, Layers } from 'lucide-react';
import type { SchemaCounts } from '../types/api.ts';

const CURRICULUM_CHAIN = [
  { key: 'countries', label: 'countries', detail: 'ISO-3166 country registry (Nepal primary)' },
  { key: 'languages', label: 'languages', detail: 'Script & medium of instruction per country' },
  { key: 'curricula', label: 'curricula', detail: 'National boards (CDC / NEB, CTEVT)' },
  { key: 'education_levels', label: 'education_levels', detail: 'Basic, Secondary (SEE), Higher Sec (+2)' },
  { key: 'grades', label: 'grades', detail: 'Numeric levels & board examination tiers' },
  { key: 'streams', label: 'streams', detail: 'Science, Management, Humanities, Technical' },
  { key: 'subjects', label: 'subjects', detail: 'Subject codes, credit hours, compulsory flags' },
  { key: 'chapters', label: 'chapters', detail: 'Structured syllabus units & pacing hours' },
  { key: 'topics', label: 'topics', detail: 'Learning objectives & review workflow status' },
] as const;

const IDENTITY_TABLES = [
  { key: 'users', label: 'users', detail: 'Firebase UID & scrypt password credentials' },
  { key: 'profiles', label: 'profiles', detail: 'Country, language, institution & grade context' },
  { key: 'roles', label: 'roles', detail: '12 hierarchical RBAC roles (Guest to Super Admin)' },
  { key: 'permissions', label: 'permissions', detail: 'Granular resource:action access controls' },
  { key: 'role_permissions', label: 'role_permissions', detail: 'Many-to-many role capability bindings' },
  { key: 'user_roles', label: 'user_roles', detail: 'Scoped assignments (global, country, institution)' },
  { key: 'institutions', label: 'institutions', detail: 'Verified school, college, and university tenants' },
] as const;

const CONTENT_TABLES = [
  { key: 'resource_categories', label: 'resource_categories', detail: 'Notes, MCQs, numericals, past papers, tests' },
  { key: 'resources', label: 'resources', detail: 'Published, draft & in_review learning resources' },
  { key: 'resource_versions', label: 'resource_versions', detail: 'Bilingual (EN/NE) versioned JSON content payloads' },
  { key: 'content_reviews', label: 'content_reviews', detail: 'Academic reviewer approval & feedback trail' },
  { key: 'resource_tags', label: 'resource_tags', detail: 'Searchable board & topic tags' },
  { key: 'bookmarks', label: 'bookmarks', detail: 'Saved chapters & resources per learner' },
  { key: 'personal_notes', label: 'personal_notes', detail: 'Student highlights & chapter study notes' },
] as const;

const QUESTION_BANK_TABLES = [
  { key: 'question_sources', label: 'question_sources', detail: 'NEB, CDC, TU IOST, IOE, MEC verified sources' },
  { key: 'questions', label: 'questions', detail: '10 question types with 5-stage editorial workflow' },
  { key: 'question_options', label: 'question_options', detail: 'Normalized bilingual options & correctness flags' },
  { key: 'question_answers', label: 'question_answers', detail: 'Structured server-side grading keys & tolerances' },
  { key: 'question_explanations', label: 'question_explanations', detail: 'Step-by-step post-submission solutions' },
  { key: 'question_tags', label: 'question_tags', detail: 'Examination, board & concept search tags' },
  { key: 'question_versions', label: 'question_versions', detail: 'Immutable revision history per question edit' },
] as const;

const EXAM_ENGINE_TABLES = [
  { key: 'exams', label: 'exams', detail: 'SEE, +2 & Bachelor Entrance exam configs & rules' },
  { key: 'exam_sections', label: 'exam_sections', detail: 'Subject sections & mark distribution quotas' },
  { key: 'exam_questions', label: 'exam_questions', detail: 'Question bank links & per-exam mark overrides' },
  { key: 'exam_attempts', label: 'exam_attempts', detail: 'Immutable question & rule snapshots per attempt' },
  { key: 'attempt_answers', label: 'attempt_answers', detail: 'Auto-saved answers, review marks & awarded marks' },
  { key: 'attempt_events', label: 'attempt_events', detail: 'Start, save, reconnect, timeout & submit audit log' },
  { key: 'exam_results', label: 'exam_results', detail: 'Server-computed scores & subject/chapter/topic metrics' },
] as const;

const STUDENT_FEATURE_TABLES = [
  { key: 'mistake_book', label: 'mistake_book', detail: 'Incorrect practice & exam questions with reattempt resolution' },
  { key: 'learning_progress', label: 'learning_progress', detail: 'Per-topic mastery accuracy & weak topic detection (<60%)' },
  { key: 'achievements', label: 'achievements', detail: 'Automatic 7-badge milestone records per student' },
  { key: 'student_goals', label: 'student_goals', detail: 'Exam countdowns, daily study targets, streaks & privacy mode' },
  { key: 'study_plans', label: 'study_plans', detail: 'Structured exam & subject preparation schedules' },
  { key: 'study_tasks', label: 'study_tasks', detail: 'Daily actionable checklist tasks tied to study plans' },
  { key: 'flashcards', label: 'flashcards', detail: 'Curated & custom cards with SM-2 spaced repetition state' },
] as const;

const EXPLORER_TABLES = [
  { key: 'entrance_exams', label: 'entrance_exams', detail: 'Verified bachelor entrance exam patterns & authorities' },
  { key: 'universities', label: 'universities', detail: 'TU, KU, PU, Purbanchal & autonomous university registry' },
  { key: 'courses', label: 'courses', detail: 'Bachelor programs with curriculum, fees, source & verification date' },
  { key: 'colleges', label: 'colleges', detail: 'Verified facts separated cleanly from promotional highlights' },
  { key: 'course_colleges', label: 'course_colleges', detail: 'Per-college course intake seats, scholarships & NPR fee ranges' },
  { key: 'scholarships', label: 'scholarships', detail: '7 scholarship categories with eligibility, documents & steps' },
  { key: 'career_paths', label: 'career_paths', detail: '5-stage Class 10 to Career & Higher Studies roadmaps' },
  { key: 'opportunities', label: 'opportunities', detail: 'Competitions, olympiads, fellowships & skill programs' },
  { key: 'application_deadlines', label: 'application_deadlines', detail: 'Centralized entrance, scholarship & admission calendar' },
] as const;

const COMMUNITY_MODERATION_TABLES = [
  { key: 'discussion_groups', label: 'discussion_groups', detail: 'Class, subject & entrance preparation community rooms' },
  { key: 'discussion_posts', label: 'discussion_posts', detail: 'Student questions & explanations with Teacher-Verified flags' },
  { key: 'discussion_comments', label: 'discussion_comments', detail: 'Peer replies & Teacher-Verified Explanation endorsements' },
  { key: 'post_votes', label: 'post_votes', detail: 'Unique per-user upvotes on posts and replies' },
  { key: 'reports', label: 'reports', detail: 'One-click youth safety & academic accuracy reports' },
  { key: 'moderation_actions', label: 'moderation_actions', detail: 'Immutable audit trail of moderator review decisions' },
] as const;

const GOVERNANCE_TABLES = [
  { key: 'content_sources', label: 'content_sources', detail: 'Verified Nepal CDC, NEB, TU, KU, PU & MEC attributions' },
  { key: 'system_settings', label: 'system_settings', detail: 'Nepal-scoped defaults (NP, Asia/Kathmandu, NPR) & guardrails' },
  { key: 'notifications', label: 'notifications', detail: 'Official student & educator platform announcements' },
  { key: 'audit_logs', label: 'audit_logs', detail: 'Immutable admin, RBAC, editorial & moderation action log' },
] as const;

export function SchemaBlueprintView() {
  const [counts, setCounts] = useState<SchemaCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/schema-summary')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json?.counts) {
          setCounts(json.counts);
        }
      })
      .catch((err) => console.error('Schema summary load failed:', err))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-labelledby="schema-heading" className="space-y-8">
      <div className="border-b border-slate-200 pb-6">
        <p className="text-xs font-medium text-red-700">Section 15 PostgreSQL Relational Architecture</p>
        <h1
          id="schema-heading"
          className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
        >
          Normalized Country-Aware &amp; RBAC Schema
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
          Live row counts across all 63 relational PostgreSQL tables managed via Drizzle ORM and
          server-side environment credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Curriculum Hierarchy Domain */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Country &amp; Curriculum Chain
                </h2>
                <p className="text-xs text-slate-500">
                  9 cascading tables with strict foreign-key referential integrity
                </p>
              </div>
              <Layers className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>

            <ol className="mt-4 divide-y divide-slate-100">
              {CURRICULUM_CHAIN.map((item, idx) => (
                <li key={item.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-400 tabular-nums">
                        0{idx + 1}
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-900">
                        {item.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                    {loading ? '—' : counts?.[item.key] ?? 0}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* School Learning & Content Storage Domain */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  School Content &amp; Learner Storage
                </h2>
                <p className="text-xs text-slate-500">
                  7 Phase 3 tables for versioned resources, reviews, bookmarks, and notes
                </p>
              </div>
              <Database className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>

            <ul className="mt-4 divide-y divide-slate-100">
              {CONTENT_TABLES.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {item.label}
                    </span>
                    <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                    {loading ? '—' : counts?.[item.key] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Phase 5 Student Features & Dashboard Domain */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Signature Student Features &amp; Dashboard
                </h2>
                <p className="text-xs text-slate-500">
                  7 Phase 5 tables for Mistake Book, Weak Topics, Flashcards, Planner &amp; Badges
                </p>
              </div>
              <Database className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>

            <ul className="mt-4 divide-y divide-slate-100">
              {STUDENT_FEATURE_TABLES.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {item.label}
                    </span>
                    <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                    {loading ? '—' : counts?.[item.key] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Phase 6 Career, Course, College & Scholarship Explorer Domain */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Career, Course, College &amp; Scholarship Explorer
                </h2>
                <p className="text-xs text-slate-500">
                  9 Phase 6 tables enforcing source &amp; last_verified_date integrity
                </p>
              </div>
              <Database className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>

            <ul className="mt-4 divide-y divide-slate-100">
              {EXPLORER_TABLES.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {item.label}
                    </span>
                    <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                    {loading ? '—' : counts?.[item.key] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Identity & RBAC Domain */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Identity, RBAC &amp; Institutions
                </h2>
                <p className="text-xs text-slate-500">
                  7 relational tables governing authentication and multi-role access
                </p>
              </div>
              <KeyRound className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>

            <ul className="mt-4 divide-y divide-slate-100">
              {IDENTITY_TABLES.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {item.label}
                    </span>
                    <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                    {loading ? '—' : counts?.[item.key] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Question Bank Tables */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Question Bank &amp; Review Workflow
                </h2>
                <p className="text-xs text-slate-500">
                  7 Phase 4 tables supporting 10 question types &amp; Draft-to-Published versioning
                </p>
              </div>
              <Database className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>

            <ul className="mt-4 divide-y divide-slate-100">
              {QUESTION_BANK_TABLES.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {item.label}
                    </span>
                    <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                    {loading ? '—' : counts?.[item.key] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Examination Engine Tables */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Timed Examination &amp; Analytics Engine
                </h2>
                <p className="text-xs text-slate-500">
                  7 Phase 4 tables with immutable attempt snapshots &amp; server-side grading
                </p>
              </div>
              <Database className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>

            <ul className="mt-4 divide-y divide-slate-100">
              {EXAM_ENGINE_TABLES.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {item.label}
                    </span>
                    <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                    {loading ? '—' : counts?.[item.key] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Phase 7 Student Community & Youth Safety Moderation Tables */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Student Community &amp; Youth Safety Moderation
                </h2>
                <p className="text-xs text-slate-500">
                  6 Phase 7 tables for discussion rooms, Teacher-Verified Q&amp;A &amp; moderation logs
                </p>
              </div>
              <Database className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>

            <ul className="mt-4 divide-y divide-slate-100">
              {COMMUNITY_MODERATION_TABLES.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {item.label}
                    </span>
                    <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                    {loading ? '—' : counts?.[item.key] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Phase 8 Platform Governance & Audit Trail Tables */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Nepal Platform Governance &amp; Audit Trail
                </h2>
                <p className="text-xs text-slate-500">
                  4 Phase 8 tables for verified sources, Nepal settings, announcements &amp; audit logs
                </p>
              </div>
              <Database className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>

            <ul className="mt-4 divide-y divide-slate-100">
              {GOVERNANCE_TABLES.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <span className="font-mono text-xs font-semibold text-slate-900">
                      {item.label}
                    </span>
                    <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums shrink-0">
                    {loading ? '—' : counts?.[item.key] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
              <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Security Boundaries (Sections 16–18)
                </h3>
                <p>
                  PostgreSQL connections use server-side secrets via pooled credentials, never
                  exposed to the browser bundle. Passwords are salted and hashed with Node{' '}
                  <span className="font-mono">scrypt</span> and verified in constant time.
                </p>
                <p>
                  Timed exams freeze an immutable snapshot inside{' '}
                  <span className="font-mono">exam_attempts</span> when an attempt starts, strip
                  correct answers and explanations from active client payloads, and evaluate all
                  positive and negative marks strictly on the server.
                </p>
                <p>
                  Both school resources and question bank items enforce{' '}
                  <span className="font-mono">published</span> /{' '}
                  <span className="font-mono">Published</span> gating before appearing to learners
                  or live mock tests.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { Database, KeyRound, Layers } from 'lucide-react';
import type { SchemaCounts } from '../types/api.ts';

const CURRICULUM_CHAIN = [
  { key: 'countries', label: 'countries', detail: 'ISO-3166 country registry (Nepal primary)' },
  { key: 'languages', label: 'languages', detail: 'Script & medium of instruction per country' },
  { key: 'curricula', label: 'curricula', detail: 'National boards (CDC / NEB, CTEVT, CBSE)' },
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
          Live row counts across all 16 relational PostgreSQL tables managed via Drizzle ORM and
          server-side environment credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Curriculum Hierarchy Domain */}
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
                  Google Sign-In tokens are verified on the server via Firebase Admin SDK, while
                  Email/Password tokens are signed with HMAC-SHA256 and held strictly in memory.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

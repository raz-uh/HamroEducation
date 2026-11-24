import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  BookOpen,
  ClipboardCheck,
  Compass,
  FileCheck2,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  Lock,
  ScrollText,
  Shield,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { AdminCurriculumContentPanel } from './AdminCurriculumContentPanel.tsx';
import { AdminExplorerPanel } from './AdminExplorerPanel.tsx';
import { AdminGovernancePanel } from './AdminGovernancePanel.tsx';
import { AdminQuestionExamPanel } from './AdminQuestionExamPanel.tsx';
import { AdminUsersRolesPanel } from './AdminUsersRolesPanel.tsx';
import type { AdminModuleId, AdminOverviewMetricsResponse } from '../../types/api.ts';

interface AdminDashboardViewProps {
  section?: string;
  onNavigate: (path: string) => void;
  onOpenAuth: () => void;
}

const ADMIN_NAV_META: Array<{
  id: AdminModuleId;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'roles', label: 'Roles', icon: Shield },
  { id: 'curriculum', label: 'Curriculum', icon: BookOpen },
  { id: 'content', label: 'Content Lifecycle', icon: FileCheck2 },
  { id: 'questions', label: 'Question Bank', icon: HelpCircle },
  { id: 'exams', label: 'Examinations', icon: ClipboardCheck },
  { id: 'entrance', label: 'Entrance', icon: GraduationCap },
  { id: 'explorer', label: 'Explorer Catalog', icon: Compass },
  { id: 'moderation', label: 'Moderation', icon: AlertTriangle },
  { id: 'announcements', label: 'Announcements', icon: BellRing },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Nepal Settings', icon: SlidersHorizontal },
  { id: 'audit_logs', label: 'Audit Logs', icon: ScrollText },
];

export function AdminDashboardView({
  section,
  onNavigate,
  onOpenAuth,
}: AdminDashboardViewProps) {
  const { user, loading: authLoading, apiFetch } = useAuth();
  const [overview, setOverview] = useState<AdminOverviewMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    if (!user) {
      setOverview(null);
      setAuthError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setAuthError(null);
    try {
      const res = await apiFetch('/api/admin/overview');
      const json = await res.json();
      if (!res.ok) {
        setOverview(null);
        setAuthError(
          json.error ||
            'Your account does not have staff or administrator privileges for the Nepal Administration Portal.',
        );
        return;
      }
      setOverview(json as AdminOverviewMetricsResponse);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Unable to reach administration endpoint.',
      );
    } finally {
      setLoading(false);
    }
  }, [apiFetch, user]);

  useEffect(() => {
    if (!authLoading) {
      void loadOverview();
    }
  }, [authLoading, loadOverview]);

  if (authLoading || loading) {
    return (
      <section className="space-y-6">
        <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
        </div>
      </section>
    );
  }

  if (!user || authError || !overview) {
    return (
      <section aria-labelledby="admin-gate-heading" className="space-y-6">
        <div className="border-b border-slate-200 pb-6">
          <p className="text-xs font-medium text-red-700">
            Section 14 &amp; 17 · Nepal Administration &amp; Content Governance
          </p>
          <h1
            id="admin-gate-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            Hamro Education Administration Portal
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
            Role-scoped editorial, curriculum, question bank, examination, career explorer, and
            moderation governance for Nepal.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-4">
          <Lock className="mx-auto h-9 w-9 text-slate-700" aria-hidden="true" />
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold text-slate-900">
              {user ? 'Restricted Staff Governance Workspace (403)' : 'Sign In Required'}
            </h2>
            <p className="mx-auto max-w-xl text-sm text-slate-600">
              {authError ||
                'Sign in with a Teacher, Academic Reviewer, Content Manager, Question Bank Manager, Examination Manager, Career Information Manager, Moderator, Institutional Administrator, Administrator, or Super Administrator account to access permitted governance modules.'}
            </p>
            {user && (
              <p className="text-xs text-slate-500">
                Signed in as <span className="font-mono">{user.email}</span> (
                {user.roles.map((r) => r.name).join(', ')})
              </p>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onOpenAuth}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {user ? 'Switch Account / Manage Auth' : 'Sign In to Admin Portal'}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Return to Student Dashboard
            </button>
          </div>
        </div>
      </section>
    );
  }

  const allowedSet = new Set(overview.allowedModules);
  const requestedSection = (section || 'overview') as AdminModuleId;
  const activeSection: AdminModuleId = allowedSet.has(requestedSection)
    ? requestedSection
    : overview.allowedModules[0] ?? 'overview';

  const visibleNav = ADMIN_NAV_META.filter((item) => allowedSet.has(item.id));

  const selectModule = (mod: AdminModuleId) => {
    onNavigate(mod === 'overview' ? '/admin' : `/admin/${mod}`);
  };

  return (
    <section aria-labelledby="admin-portal-heading" className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-red-700">
            Nepal Governance Scope · NP · Asia/Kathmandu · NPR
          </p>
          <h1
            id="admin-portal-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            Administration &amp; Content Governance
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Signed in as <span className="font-semibold text-slate-900">{user.profile?.fullName || user.email}</span>{' '}
            · Roles: {user.roles.map((r) => r.name).join(' · ')}
          </p>
        </div>

        <div className="text-xs text-slate-500">
          Accessible modules:{' '}
          <span className="font-mono font-semibold text-slate-900">
            {visibleNav.length} / {ADMIN_NAV_META.length}
          </span>
        </div>
      </div>

      {/* Role-scoped Admin Module Navigation */}
      <nav
        aria-label="Admin portal modules"
        className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2"
      >
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectModule(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Active Admin Section */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          {/* Primary Section 14.1 KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Registered Students</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {overview.metrics.registeredStudents}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {overview.metrics.activeStudents} active · +{overview.metrics.newRegistrations7d} new (7d)
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Examination Attempts</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {overview.metrics.examinationAttempts}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {overview.metrics.submittedAttempts} submitted &amp; graded
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Content Awaiting Review</div>
              <div className="mt-1 font-mono text-2xl font-bold text-amber-700 tabular-nums">
                {overview.metrics.contentAwaitingReview}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {overview.metrics.publishedResources} published resources live
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Question Bank Verification</div>
              <div className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
                {overview.metrics.publishedQuestions}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {overview.metrics.aiDraftsPendingReview} AI drafts pending review ·{' '}
                {overview.metrics.openModerationReports} open reports
              </div>
            </div>
          </div>

          {/* 6-Stage Pipelines */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Question Verification Status (6-Stage Pipeline)
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {overview.questionVerificationStatus.map((row) => (
                  <div
                    key={row.stage}
                    className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <div className="text-[11px] text-slate-500">{row.stage}</div>
                    <div className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                      {row.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Resource Editorial Lifecycle
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {overview.resourceLifecycleStatus.map((row) => (
                  <div
                    key={row.stage}
                    className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <div className="text-[11px] text-slate-500">{row.stage}</div>
                    <div className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                      {row.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Popular Resources & Popular Subjects */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-display text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
                Popular Learning Resources
              </h2>
              <ul className="mt-3 divide-y divide-slate-100 text-xs">
                {overview.popularResources.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <div className="font-medium text-slate-900">{r.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {r.subjectName} · {r.status}
                      </div>
                    </div>
                    <span className="font-mono text-slate-700 shrink-0">
                      {r.bookmarkCount} bookmarks
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-display text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
                Popular Subjects by Learner Activity
              </h2>
              <ul className="mt-3 divide-y divide-slate-100 text-xs">
                {overview.popularSubjects.map((s) => (
                  <li key={s.subjectName} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="font-medium text-slate-900">{s.subjectName}</span>
                    <span className="font-mono text-slate-600 tabular-nums">
                      {s.attemptsCount} attempts · {s.avgAccuracyPercent}% acc
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recent Platform Activity */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Recent Platform Governance Activity
              </h2>
              <Activity className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
            <div className="mt-3 divide-y divide-slate-100 text-xs">
              {overview.recentActivity.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <span className="font-mono text-[11px] font-semibold text-slate-800">
                      {log.action}
                    </span>{' '}
                    <span className="text-slate-700">— {log.summary}</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-400 shrink-0">
                    {log.actorEmail} · {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {(activeSection === 'users' || activeSection === 'roles') && (
        <AdminUsersRolesPanel mode={activeSection} onOpenAuth={onOpenAuth} />
      )}

      {(activeSection === 'curriculum' || activeSection === 'content') && (
        <AdminCurriculumContentPanel mode={activeSection} />
      )}

      {(activeSection === 'questions' || activeSection === 'exams') && (
        <AdminQuestionExamPanel mode={activeSection} />
      )}

      {(activeSection === 'entrance' ||
        activeSection === 'explorer' ||
        activeSection === 'moderation') && <AdminExplorerPanel mode={activeSection} />}

      {(activeSection === 'announcements' ||
        activeSection === 'analytics' ||
        activeSection === 'settings' ||
        activeSection === 'audit_logs') && <AdminGovernancePanel mode={activeSection} />}
    </section>
  );
}

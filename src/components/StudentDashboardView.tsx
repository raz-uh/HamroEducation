import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BellRing,
  Bookmark,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Compass,
  Flame,
  GraduationCap,
  Layers,
  RotateCcw,
  ShieldAlert,
  Square,
  Target,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { StudentSubNav } from './StudentSubNav.tsx';
import type { AnnouncementItem, StudentDashboardResponse } from '../types/api.ts';

interface StudentDashboardViewProps {
  onNavigate: (path: string) => void;
  onOpenAuth: () => void;
}

const CAREER_INTEREST_PRESETS = [
  'Software Engineering & AI',
  'Civil & Computer Engineering',
  'Medicine & Public Health',
  'Management, BBA & Finance',
  'Pure Sciences & Research',
  'Law & Civil Service',
];

export function StudentDashboardView({ onNavigate, onOpenAuth }: StudentDashboardViewProps) {
  const { user, apiFetch } = useAuth();
  const [data, setData] = useState<StudentDashboardResponse | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingTaskId, setTogglingTaskId] = useState<number | null>(null);
  const [savingInterest, setSavingInterest] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [res, annRes] = await Promise.all([
        apiFetch('/api/dashboard'),
        fetch('/api/announcements'),
      ]);
      const json = (await res.json()) as StudentDashboardResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not load student dashboard.');
      setData(json);
      if (annRes.ok) {
        const annJson = await annRes.json();
        setAnnouncements(annJson.announcements ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load student dashboard.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, user]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleToggleTodayTask = async (taskId: number, currentDone: boolean) => {
    setTogglingTaskId(taskId);
    try {
      const res = await apiFetch(`/api/planner/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isCompleted: !currentDone }),
      });
      if (!res.ok) throw new Error('Failed to update task.');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update daily study task.');
    } finally {
      setTogglingTaskId(null);
    }
  };

  const handleToggleCareerInterest = async (interest: string) => {
    if (!data) return;
    setSavingInterest(true);
    try {
      const exists = data.careerInterests.includes(interest);
      const next = exists
        ? data.careerInterests.filter((c) => c !== interest)
        : [...data.careerInterests, interest];
      const res = await apiFetch('/api/dashboard/goals', {
        method: 'PATCH',
        body: JSON.stringify({ careerInterests: next }),
      });
      if (!res.ok) throw new Error('Could not update career interests.');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Career interest update failed.');
    } finally {
      setSavingInterest(false);
    }
  };

  if (!user) {
    return (
      <section aria-labelledby="dashboard-guest-heading" className="space-y-6">
        <div className="border-b border-slate-200 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
            Personalized Mastery Hub
          </p>
          <h1
            id="dashboard-guest-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            Student Dashboard &amp; Mastery Workspace
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Access your Recommended Next Action, Mistake Book, Weak Topic Recovery Plan, Spaced
            Flashcards, Daily Study Planner, Exam Countdown, and Career Opportunities in one unified
            workspace.
          </p>
        </div>

        <StudentSubNav active="overview" onNavigate={onNavigate} />

        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-4">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-700">
            <GraduationCap className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="space-y-1.5">
            <h2 className="font-display text-xl font-bold text-slate-900">
              Sign in to open your personalized dashboard
            </h2>
            <p className="mx-auto max-w-lg text-sm text-slate-600">
              Your learning progress, mistake tracking, spaced repetition, and topic mastery graphs
              sync automatically to your learner account.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[44px] rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Sign In or Create Account
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/practice/daily')}
              className="min-h-[44px] rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Preview Daily Challenge
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (loading || !data) {
    return (
      <section className="space-y-6">
        <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-2" />
          <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
        </div>
      </section>
    );
  }

  const nextAction = data.recommendedNextAction;
  const studentDisplayName = user.profile?.fullName || user.email.split('@')[0];
  const unlockedBadges = data.achievements.filter((a) => a.unlocked);

  return (
    <section aria-labelledby="student-dashboard-heading" className="space-y-6">
      <StudentSubNav
        active="overview"
        onNavigate={onNavigate}
        unresolvedMistakes={data.mistakeBookSummary.unresolved}
        dueFlashcards={data.dueFlashcardsCount}
      />

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {announcements.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs text-blue-950 flex items-start gap-2.5">
          <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
          <div className="space-y-0.5">
            <span className="font-semibold">{announcements[0].title}:</span>{' '}
            <span className="text-blue-900">{announcements[0].message}</span>
          </div>
        </div>
      )}

      {/* Prominent Dynamic Recommended Next Action Banner */}
      <div className="rounded-2xl border border-slate-900 bg-slate-900 p-5 sm:p-6 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-amber-300">
                <Target className="h-3.5 w-3.5" aria-hidden="true" />
                Recommended Next Action
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-white">{nextAction.metricBadge}</span>
              <span aria-hidden="true">·</span>
              <span>{data.todayDate}</span>
            </div>
            <h2 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              {nextAction.title}
            </h2>
            <p className="max-w-2xl text-sm text-slate-300 leading-relaxed">{nextAction.reason}</p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate(nextAction.route)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-500 transition-colors whitespace-nowrap shrink-0"
          >
            <span>{nextAction.ctaLabel}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Widget 1: Welcome Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
              Student Mastery Hub · {data.goal.targetTrack}
            </p>
            <h1
              id="student-dashboard-heading"
              className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900"
            >
              Namaste, {studentDisplayName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Target Focus:{' '}
              <strong className="text-slate-900">
                {data.goal.targetExamName || data.goal.targetTrack}
              </strong>{' '}
              · Daily Goal:{' '}
              <span className="font-mono tabular-nums">{data.goal.dailyStudyMinutes} min</span> ·{' '}
              <span className="font-mono tabular-nums">{data.goal.dailyQuestionTarget} Qs/day</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('/dashboard/mistakes')}
              className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              Mistake Book ({data.mistakeBookSummary.unresolved})
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/dashboard/flashcards')}
              className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              Flashcards ({data.dueFlashcardsCount} due)
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/dashboard/planner')}
              className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              Study Planner
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/practice/daily')}
              className="min-h-[40px] rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
            >
              Daily Challenge
            </button>
          </div>
        </div>
      </div>

      {/* Primary Trio Row: Continue Learning (Learn) + Daily Challenge (Practice) + Exam Countdown (Test) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Widget 2: Continue Learning */}
        <article className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-red-700">
                Learn · Continue
              </span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-700">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <h3 className="font-display text-lg font-bold text-slate-900">
              {data.continueLearning.title}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {data.continueLearning.subtitle}
            </p>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-[11px] text-slate-500 capitalize">
              Source: {data.continueLearning.source}
            </span>
            <button
              type="button"
              onClick={() => onNavigate(data.continueLearning.route)}
              className="inline-flex min-h-[36px] items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800"
            >
              Resume <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </article>

        {/* Widget 6: Daily Challenge & Streak */}
        <article className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-amber-800">
                Practice · Streak
              </span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <Flame className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-3xl font-bold text-slate-900 tabular-nums">
                {data.dailyChallenge.streakDays}d
              </span>
              <span
                className={`text-xs font-semibold ${
                  data.dailyChallenge.doneToday ? 'text-emerald-700' : 'text-amber-800'
                }`}
              >
                {data.dailyChallenge.doneToday ? 'Completed Today' : 'Ready Today'}
              </span>
            </div>
            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
              {data.dailyChallenge.questionOfTheDayPrompt
                ? `QOTD (${data.dailyChallenge.questionOfTheDaySubject}): ${data.dailyChallenge.questionOfTheDayPrompt}`
                : 'Daily 5, Subject, Class-wise & Entrance challenge sets ready.'}
            </p>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
              {data.dailyChallenge.dailyChallengesCompleted} sets completed
            </span>
            <button
              type="button"
              onClick={() => onNavigate('/practice/daily')}
              className="inline-flex min-h-[36px] items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-900"
            >
              Open Practice <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </article>

        {/* Widget 7: Upcoming Examination Countdown */}
        <article className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-blue-700">
                Test · Exam Countdown
              </span>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <h3 className="font-display text-base font-bold text-slate-900">
              {data.upcomingExamCountdown.examTitle}
            </h3>
            {data.upcomingExamCountdown.daysRemaining !== null ? (
              <p className="font-mono text-3xl font-bold text-blue-700 tabular-nums">
                {data.upcomingExamCountdown.daysRemaining}d{' '}
                <span className="text-sm font-semibold text-slate-700">remaining</span>
                {data.upcomingExamCountdown.targetDate && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    ({String(data.upcomingExamCountdown.targetDate).slice(0, 10)})
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed">
                Set your official SEE, NEB +2, or Entrance exam target date in Study Planner to
                activate your countdown.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => onNavigate('/dashboard/planner')}
              className="min-h-[36px] text-xs font-semibold text-slate-700 hover:text-slate-900"
            >
              Set Exam Date
            </button>
            <button
              type="button"
              onClick={() =>
                onNavigate(
                  data.upcomingExamCountdown.examSlug
                    ? `/exams/${data.upcomingExamCountdown.examSlug}`
                    : '/exams',
                )
              }
              className="inline-flex min-h-[36px] items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
            >
              Take Mock <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </article>
      </div>

      {/* Main Analytics + Planner Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Widget 9 Performance Overview + Weak Topic Detection + Widget 8 Recent Tests */}
        <div className="space-y-6 lg:col-span-2">
          {/* Widget 9: Performance Overview & Weak Topic Detection / Recovery */}
          <article className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-700" aria-hidden="true" />
                  Performance Overview &amp; Weak Topic Recovery
                </h2>
                <p className="text-xs text-slate-500">
                  Topics under 60% accuracy are automatically flagged with actionable recovery
                  materials.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span>
                  Accuracy:{' '}
                  <strong className="font-mono text-sm text-slate-900 tabular-nums">
                    {data.performanceOverview.overallAccuracy}%
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Solved:{' '}
                  <strong className="font-mono text-sm text-slate-900 tabular-nums">
                    {data.performanceOverview.totalQuestionsSolved}
                  </strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  Mocks:{' '}
                  <strong className="font-mono text-sm text-slate-900 tabular-nums">
                    {data.performanceOverview.completedMockTests}
                  </strong>
                </span>
              </div>
            </div>

            {/* Weak Topic Detection & Recovery */}
            {data.performanceOverview.weakTopics.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Flagged Weak Topics (&lt; 60% Accuracy) — Recovery Action Plan
                </p>
                <div className="divide-y divide-slate-100 border-y border-slate-100">
                  {data.performanceOverview.weakTopics.map((wt) => (
                    <div
                      key={`${wt.subjectName}-${wt.chapterName}-${wt.topicName}`}
                      className="py-4 space-y-3"
                    >
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {wt.topicName}{' '}
                            <span className="font-normal text-xs text-slate-500">
                              · {wt.subjectName} · {wt.chapterName}
                            </span>
                          </p>
                        </div>
                        <span className="font-mono text-xs font-bold text-red-700 tabular-nums">
                          {wt.accuracyPercent}% ({wt.correctAttempts}/{wt.totalAttempts}) ·{' '}
                          {wt.severity === 'critical' ? 'Critical Focus' : 'Needs Practice'}
                        </span>
                      </div>

                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${
                            wt.severity === 'critical' ? 'bg-red-600' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.max(6, Math.min(100, wt.accuracyPercent))}%` }}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => onNavigate(wt.recommendations.chapterNotesRoute)}
                          className="min-h-[38px] rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-200"
                        >
                          Chapter Notes
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate(wt.recommendations.targetedPracticeRoute)}
                          className="min-h-[38px] rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-200"
                        >
                          Targeted Practice
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate(wt.recommendations.miniTestRoute)}
                          className="min-h-[38px] rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-200"
                        >
                          Mini-Test
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onNavigate(
                              wt.recommendations.chapterNotesRoute.replace('tab=notes', 'tab=revision'),
                            )
                          }
                          className="min-h-[38px] rounded-md bg-slate-100 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-200"
                        >
                          Revision Sheet
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate(wt.recommendations.retestRoute)}
                          className="min-h-[38px] rounded-md bg-red-700 px-3 py-1.5 font-semibold text-white hover:bg-red-800"
                        >
                          Retest Mock
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
                No weak topics flagged under 60% accuracy right now. As you solve Daily Challenges,
                Chapter Practice, and Mock Exams, any topic dipping below 60% will generate a
                recovery checklist here.
              </div>
            )}

            {/* Topic Progress Table */}
            {data.performanceOverview.topicProgress.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2 pr-3 font-semibold">Subject / Topic</th>
                      <th className="py-2 px-3 font-semibold text-right">Attempts</th>
                      <th className="py-2 pl-3 font-semibold text-right">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.performanceOverview.topicProgress.slice(0, 6).map((row) => (
                      <tr key={row.id}>
                        <td className="py-2.5 pr-3">
                          <span className="font-medium text-slate-900">{row.topicName}</span>{' '}
                          <span className="text-slate-500">
                            · {row.subjectName} ({row.chapterName})
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                          {row.correctAttempts}/{row.totalAttempts}
                        </td>
                        <td
                          className={`py-2.5 pl-3 text-right font-mono font-semibold tabular-nums ${
                            row.isWeak ? 'text-red-700' : 'text-emerald-700'
                          }`}
                        >
                          {row.accuracyPercent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          {/* Widget 8: Recent Tests + Widget 10: Mistake Book Summary */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Widget 8: Recent Tests */}
            <article className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="font-display text-base font-bold text-slate-900">Recent Tests</h2>
                <button
                  type="button"
                  onClick={() => onNavigate('/exams')}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                >
                  All Exams
                </button>
              </div>
              {data.recentTests.length === 0 ? (
                <div className="space-y-3 text-xs text-slate-600">
                  <p>No timed mock examinations submitted yet.</p>
                  <button
                    type="button"
                    onClick={() => onNavigate('/exams')}
                    className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Start a Mock Exam
                  </button>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.recentTests.map((t) => (
                    <li key={t.attemptUid} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{t.examTitle}</p>
                        <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                          {t.obtainedMarks}/{t.totalMarks} marks · {t.accuracyPercent}%
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onNavigate(`/exams/${t.examSlug}/result?attemptUid=${t.attemptUid}`)
                        }
                        className="shrink-0 font-semibold text-blue-700 hover:text-blue-800"
                      >
                        Review
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            {/* Widget 10: Mistake Book Summary */}
            <article className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-1.5">
                  <RotateCcw className="h-4 w-4 text-red-700" aria-hidden="true" />
                  Mistake Book Summary
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigate('/dashboard/mistakes')}
                  className="text-xs font-semibold text-red-700 hover:text-red-800"
                >
                  Open Reattempt
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 rounded-lg p-3">
                <div>
                  <p className="text-[11px] text-slate-500">Total</p>
                  <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                    {data.mistakeBookSummary.total}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Unresolved</p>
                  <p className="font-mono text-lg font-bold text-red-700 tabular-nums">
                    {data.mistakeBookSummary.unresolved}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500">Resolved</p>
                  <p className="font-mono text-lg font-bold text-emerald-700 tabular-nums">
                    {data.mistakeBookSummary.resolved}
                  </p>
                </div>
              </div>
              {data.mistakeBookSummary.recentUnresolved.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {data.mistakeBookSummary.recentUnresolved.map((m) => (
                    <li key={m.id} className="py-2 text-xs">
                      <p className="font-medium text-slate-900 line-clamp-1">
                        {m.questionSnapshot.prompt}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {m.subjectName} · {m.topicName}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-600">
                  Zero unresolved mistakes. Keep challenging yourself in Daily Practice or Mock Exams.
                </p>
              )}
            </article>
          </div>
        </div>

        {/* Right Column: Widget 5 Daily Study Plan + Widget 3 My Classes + Widget 4 My Subjects + Widget 11 Bookmarks */}
        <div className="space-y-6">
          {/* Widget 5: Daily Study Plan */}
          <article className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">Daily Study Plan</h2>
                <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                  {data.dailyStudyPlan.completedTodayCount} / {data.dailyStudyPlan.totalTodayCount}{' '}
                  completed today
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/dashboard/planner')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                Full Planner
              </button>
            </div>

            {data.dailyStudyPlan.tasksToday.length === 0 ? (
              <div className="space-y-3 text-xs text-slate-600">
                <p>No tasks scheduled for {data.todayDate} yet.</p>
                <button
                  type="button"
                  onClick={() => onNavigate('/dashboard/planner')}
                  className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Add Today’s Study Task
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.dailyStudyPlan.tasksToday.map((task) => (
                  <li key={task.id} className="py-2.5 flex items-start gap-2.5 text-xs">
                    <button
                      type="button"
                      disabled={togglingTaskId === task.id}
                      onClick={() => void handleToggleTodayTask(task.id, task.isCompleted)}
                      aria-label={`Mark ${task.title} as ${task.isCompleted ? 'incomplete' : 'completed'}`}
                      className="mt-0.5 text-slate-500 hover:text-slate-900"
                    >
                      {task.isCompleted ? (
                        <CheckSquare className="h-4 w-4 text-emerald-700" aria-hidden="true" />
                      ) : (
                        <Square className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-medium ${
                          task.isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {task.subjectName} · {task.estimatedMinutes} min
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>

          {/* Widget 3: My Classes */}
          <article className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-slate-500" aria-hidden="true" />
                My Classes
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {data.myClasses.map((cls) => (
                <button
                  key={cls.slug}
                  type="button"
                  onClick={() => onNavigate(cls.route)}
                  className="w-full py-2.5 flex items-center justify-between text-left text-xs hover:text-blue-700 transition-colors"
                >
                  <div>
                    <span className="font-semibold text-slate-900">{cls.name}</span>
                    {cls.isPrimary && (
                      <span className="ml-2 text-[11px] font-semibold text-red-700">Primary</span>
                    )}
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                </button>
              ))}
            </div>
          </article>

          {/* Widget 4: My Subjects */}
          <article className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-base font-bold text-slate-900">My Subjects</h2>
              <button
                type="button"
                onClick={() => onNavigate('/dashboard/planner')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                Edit
              </button>
            </div>
            <ul className="divide-y divide-slate-100">
              {data.mySubjects.map((sub) => (
                <li key={sub.name} className="py-2.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-900">{sub.name}</span>
                  <span className="font-mono text-slate-600 tabular-nums">
                    {sub.attempts > 0 ? `${sub.accuracyPercent}% (${sub.attempts})` : 'Ready'}
                  </span>
                </li>
              ))}
            </ul>
          </article>

          {/* Widget 11: Bookmarks */}
          <article className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-1.5">
                <Bookmark className="h-4 w-4 text-blue-700" aria-hidden="true" />
                Bookmarks
              </h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {data.bookmarks.length}
              </span>
            </div>
            {data.bookmarks.length === 0 ? (
              <p className="text-xs text-slate-600">
                Bookmark any chapter inside the School Reader to pin it here for rapid revision.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.bookmarks.slice(0, 5).map((bm) => (
                  <li key={bm.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-900 truncate">{bm.title}</span>
                    <button
                      type="button"
                      onClick={() => onNavigate('/school/class-10')}
                      className="shrink-0 font-semibold text-blue-700 hover:text-blue-800"
                    >
                      Open
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </div>

      {/* Bottom Row: Widget 12 Achievements + Widget 13 Career Interests + Widget 14 Opportunities */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Widget 12: Achievements */}
        <article className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-emerald-700" aria-hidden="true" />
              Achievements
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('/leaderboards')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800"
            >
              {unlockedBadges.length}/7 Badges
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.achievements.slice(0, 5).map((badge) => (
              <li key={badge.code} className="py-2 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{badge.title}</p>
                  <p className="text-[11px] text-slate-500 truncate">{badge.targetLabel}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 font-semibold shrink-0 ${
                    badge.unlocked ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {badge.unlocked && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                  {badge.unlocked ? 'Earned' : 'Locked'}
                </span>
              </li>
            ))}
          </ul>
        </article>

        {/* Widget 13: Career Interests */}
        <article className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-1.5">
              <Compass className="h-4 w-4 text-slate-600" aria-hidden="true" />
              Career Interests
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('/explore/careers')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800"
            >
              Career Roadmaps →
            </button>
          </div>
          <p className="text-xs text-slate-600">
            Select bachelor &amp; career directions ({data.careerInterests.length} selected) to
            personalize entrance and scholarship alerts:
          </p>
          <div className="flex flex-wrap gap-2">
            {CAREER_INTEREST_PRESETS.map((interest) => {
              const selected = data.careerInterests.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  disabled={savingInterest}
                  onClick={() => void handleToggleCareerInterest(interest)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        </article>

        {/* Widget 14: Opportunities */}
        <article className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-1.5">
              <Target className="h-4 w-4 text-red-700" aria-hidden="true" />
              Opportunities &amp; Scholarships
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/explore/scholarships')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                Scholarships
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/explore/opportunities')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                Calendar
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/entrance')}
                className="text-xs font-semibold text-slate-700 hover:text-slate-900"
              >
                Entrance Hub
              </button>
            </div>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.opportunities.map((opp) => (
              <li key={opp.id} className="py-2.5 space-y-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{opp.title}</span>
                  <button
                    type="button"
                    onClick={() => onNavigate(opp.route)}
                    className="shrink-0 font-semibold text-blue-700 hover:text-blue-800"
                  >
                    Explore
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  {opp.organization} · {opp.windowLabel}
                </p>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

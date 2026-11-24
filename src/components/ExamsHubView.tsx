import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Layers,
  ShieldAlert,
  Shuffle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type { ExamSummaryItem } from '../types/api.ts';

interface ExamsHubViewProps {
  onNavigate: (path: string) => void;
}

export function ExamsHubView({ onNavigate }: ExamsHubViewProps) {
  const { apiFetch } = useAuth();
  const [exams, setExams] = useState<ExamSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'school_board' | 'bachelor_entrance'>('all');

  const loadExams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/exams');
      const json = (await res.json()) as { exams?: ExamSummaryItem[]; error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to load mock examinations.');
      setExams(json.exams ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load examinations.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  const filtered = exams.filter(
    (e) => categoryFilter === 'all' || e.category === categoryFilter,
  );

  return (
    <section aria-labelledby="exams-hub-title" className="space-y-8">
      <div className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Test · Timed Mock Examination Center
            </p>
            <h1
              id="exams-hub-title"
              className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
            >
              Timed Mock Examinations
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
              Complete mock examinations for SEE, Class 12 Science &amp; Management, BSc CSIT,
              CMAT, IOE, and MECEE-BL with live countdowns, question palette, and server-validated
              negative marking.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Exam category filter">
            {[
              { id: 'all' as const, label: 'All Exams' },
              { id: 'school_board' as const, label: 'SEE & +2 Boards' },
              { id: 'bachelor_entrance' as const, label: 'Bachelor Entrances' },
            ].map((tab) => {
              const active = categoryFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`min-h-[40px] rounded-md border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white p-6"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {filtered.map((exam) => (
            <article
              key={exam.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[11px] font-semibold uppercase text-red-700">
                      {exam.category === 'school_board' ? 'School Board' : 'Bachelor Entrance'} ·{' '}
                      {exam.academicLevel}
                    </p>
                    <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">
                      {exam.title}
                    </h2>
                  </div>
                  <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums shrink-0">
                    {exam.durationMinutes} min
                  </span>
                </div>

                <p className="text-xs text-slate-600">
                  <strong className="text-slate-800">Subjects:</strong> {exam.subjectScope}
                </p>

                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Live Questions</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {exam.liveQuestionCount} Published
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Max Marks</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {exam.liveTotalMarks}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Attempts</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {exam.userAttemptCount} / {exam.attemptLimit}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                  <span
                    className={
                      exam.negativeMarkingRule.enabled
                        ? 'font-semibold text-red-700'
                        : 'font-semibold text-emerald-700'
                    }
                  >
                    {exam.negativeMarkingRule.description}
                  </span>
                  {(exam.randomizeQuestions || exam.randomizeOptions) && (
                    <>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Shuffle className="h-3 w-3" aria-hidden="true" />
                        Randomized
                      </span>
                    </>
                  )}
                </div>

                {exam.latestResult && (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Latest Score:{' '}
                      <strong className="font-mono tabular-nums">
                        {exam.latestResult.obtainedMarks}/{exam.latestResult.totalMarks}
                      </strong>
                    </span>
                    <span className="font-mono text-emerald-800 tabular-nums">
                      {exam.latestResult.accuracyPercent}% accuracy
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate(`/exams/${exam.slug}`)}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
                  >
                    {exam.hasActiveAttempt ? (
                      <>
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        Resume Active Exam
                      </>
                    ) : (
                      <>
                        <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        Open Exam Room
                      </>
                    )}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>

                  {exam.latestResult && (
                    <button
                      type="button"
                      onClick={() => onNavigate(`/exams/${exam.slug}/result`)}
                      className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                      Result &amp; Analytics
                    </button>
                  )}
                </div>

                {exam.sections.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-500">
                    <Layers className="h-3 w-3" aria-hidden="true" />
                    {exam.sections.length} sections
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

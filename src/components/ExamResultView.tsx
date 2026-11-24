import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  History,
  Lock,
  MinusCircle,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { QUESTION_TYPE_CATALOG } from '../lib/exam-engine.ts';
import {
  AiStudyAssistantDrawer,
  type AiStudyContextPayload,
} from './AiStudyAssistantDrawer.tsx';
import type {
  AiStudyAction,
  ExamResultDetailResponse,
  PerformanceBreakdownBucket,
  QuestionAnswerJson,
  SubmittedAnswerPayload,
} from '../types/api.ts';

interface ExamResultViewProps {
  examId: string;
  attemptUid?: string;
  onNavigate: (path: string) => void;
  onOpenAuth: () => void;
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatSubmittedAnswer(ans: SubmittedAnswerPayload | null): string {
  if (!ans) return 'Unattempted';
  if (ans.optionKeys?.length) return ans.optionKeys.join(', ');
  if (typeof ans.booleanValue === 'boolean') return ans.booleanValue ? 'True' : 'False';
  if (typeof ans.numericValue === 'number') return String(ans.numericValue);
  if (ans.textValue) return ans.textValue;
  if (ans.matchingMap) {
    return Object.entries(ans.matchingMap)
      .map(([k, v]) => `${k} → ${v}`)
      .join(' | ');
  }
  return 'Unattempted';
}

function formatExpectedAnswer(ans: QuestionAnswerJson): string {
  if (ans.optionKeys?.length) return ans.optionKeys.join(', ');
  if (typeof ans.booleanValue === 'boolean') return ans.booleanValue ? 'True' : 'False';
  if (typeof ans.numericValue === 'number') {
    return `${ans.numericValue} (±${ans.tolerance ?? 0.01})`;
  }
  if (ans.acceptedText) return ans.acceptedText;
  if (ans.matchingMap) {
    return Object.entries(ans.matchingMap)
      .map(([k, v]) => `${k} → ${v}`)
      .join(' | ');
  }
  return '—';
}

export function ExamResultView({
  examId,
  attemptUid,
  onNavigate,
  onOpenAuth,
}: ExamResultViewProps) {
  const { user, apiFetch } = useAuth();
  const [data, setData] = useState<ExamResultDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeBreakdown, setActiveBreakdown] = useState<'subject' | 'chapter' | 'topic'>('subject');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'correct' | 'incorrect' | 'unattempted'>('all');
  const [showAudit, setShowAudit] = useState(false);
  const [aiDrawer, setAiDrawer] = useState<{
    open: boolean;
    action: AiStudyAction | null;
    context: AiStudyContextPayload;
  } | null>(null);

  const loadResult = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = attemptUid ? `?attemptUid=${encodeURIComponent(attemptUid)}` : '';
      const res = await apiFetch(`/api/exams/${encodeURIComponent(examId)}/result${qs}`);
      const json = (await res.json()) as ExamResultDetailResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Result not found.');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exam result.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, attemptUid, examId, user]);

  useEffect(() => {
    void loadResult();
  }, [loadResult]);

  if (!user) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-4">
        <Lock className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
        <h1 className="font-display text-xl font-bold text-slate-900">
          Sign In Required to View Exam Results
        </h1>
        <p className="text-sm text-slate-600">
          Results, negative marking breakdowns, and historical attempts are bound securely to your
          student account.
        </p>
        <button
          type="button"
          onClick={onOpenAuth}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Sign In to Continue
        </button>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => onNavigate(`/exams/${encodeURIComponent(examId)}`)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to Exam Room
        </button>
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error || 'No submitted results available.'}</span>
        </div>
      </div>
    );
  }

  const { exam, attempt, result, review, auditEvents, previousAttempts } = data;
  const breakdownList: PerformanceBreakdownBucket[] =
    activeBreakdown === 'subject'
      ? review.subjectBreakdown
      : activeBreakdown === 'chapter'
        ? review.chapterBreakdown
        : review.topicBreakdown;

  const filteredQuestions = review.gradedQuestions.filter(
    (q) => reviewFilter === 'all' || q.status === reviewFilter,
  );

  return (
    <section aria-labelledby="result-heading" className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-6">
        <button
          type="button"
          onClick={() => onNavigate('/exams')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          All Mock Examinations
        </button>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs font-semibold text-emerald-700 inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Server-Evaluated Result · {attempt.attemptUid} · Attempt #{attempt.attemptNumber}
            </p>
            <h1
              id="result-heading"
              className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
            >
              {exam.title}
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              {exam.negativeMarkingRule.description} · Submitted{' '}
              {attempt.submittedAt
                ? new Date(attempt.submittedAt).toLocaleString()
                : new Date(result.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                setAiDrawer({
                  open: true,
                  action: null,
                  context: {
                    mode: 'exam_result',
                    gradeLevel: exam.academicLevel,
                    subjectName: exam.subjectScope,
                    chapterName: exam.title,
                    chapterSummary: `Score: ${result.obtainedMarks}/${result.totalMarks} (${result.accuracyPercent}% accuracy, ${result.incorrectCount} incorrect)`,
                  },
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-800"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              AI Study Assistant
            </button>
            <button
              type="button"
              onClick={() => onNavigate(`/exams/${exam.slug}`)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Re-Attempt Exam
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Score Obtained
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
            {result.obtainedMarks} / {result.totalMarks}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Accuracy
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-blue-700 tabular-nums">
            {result.accuracyPercent}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Correct
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-700 tabular-nums">
            {result.correctCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Incorrect
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-red-700 tabular-nums">
            {result.incorrectCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Unattempted
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-slate-600 tabular-nums">
            {result.unattemptedCount}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Time Taken
          </p>
          <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums inline-flex items-center gap-1">
            <Clock className="h-4 w-4 text-slate-400" aria-hidden="true" />
            {formatDuration(result.timeTakenSeconds)}
          </p>
        </div>
      </div>

      {/* Subject / Chapter / Topic Performance Analytics */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Granular Performance Breakdown
            </h2>
            <p className="text-xs text-slate-500">
              Compare marks and accuracy across Subjects, Chapters, and individual Topics.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Breakdown granularity">
            {[
              { id: 'subject' as const, label: 'By Subject' },
              { id: 'chapter' as const, label: 'By Chapter' },
              { id: 'topic' as const, label: 'By Topic' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeBreakdown === tab.id}
                onClick={() => setActiveBreakdown(tab.id)}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeBreakdown === tab.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase text-slate-500">
                <th className="py-2 pr-4 font-semibold">Dimension</th>
                <th className="py-2 px-3 font-semibold text-right">Questions</th>
                <th className="py-2 px-3 font-semibold text-right">Correct</th>
                <th className="py-2 px-3 font-semibold text-right">Incorrect</th>
                <th className="py-2 px-3 font-semibold text-right">Marks</th>
                <th className="py-2 pl-3 font-semibold text-right">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {breakdownList.map((b) => (
                <tr key={b.key}>
                  <td className="py-2.5 pr-4 font-medium text-slate-900">{b.label}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {b.totalQuestions}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-700 tabular-nums">
                    {b.correct}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-red-700 tabular-nums">
                    {b.incorrect}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                    {b.obtainedMarks} / {b.maxMarks}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono font-semibold text-blue-700 tabular-nums">
                    {b.accuracyPercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Previous Attempts Comparison & Audit Trail */}
      {previousAttempts.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h2 className="font-display text-base font-semibold text-slate-900 inline-flex items-center gap-1.5">
              <History className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Attempt History &amp; Comparison ({previousAttempts.length})
            </h2>
            <button
              type="button"
              onClick={() => setShowAudit((v) => !v)}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800"
            >
              {showAudit ? 'Hide Server Audit Events' : `View Server Audit Trail (${auditEvents.length})`}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase text-slate-500">
                  <th className="py-2 pr-4">Attempt</th>
                  <th className="py-2 px-3">Mode</th>
                  <th className="py-2 px-3 text-right">Score</th>
                  <th className="py-2 px-3 text-right">Accuracy</th>
                  <th className="py-2 px-3 text-right">Time</th>
                  <th className="py-2 pl-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previousAttempts.map((prev) => {
                  const isCurrent = prev.attemptUid === attempt.attemptUid;
                  return (
                    <tr key={prev.attemptId} className={isCurrent ? 'bg-slate-50/80' : ''}>
                      <td className="py-2.5 pr-4 font-mono font-semibold text-slate-900">
                        #{prev.attemptNumber} · {prev.attemptUid}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{prev.status}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold tabular-nums">
                        {prev.obtainedMarks} / {prev.totalMarks}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-blue-700 tabular-nums">
                        {prev.accuracyPercent}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 tabular-nums">
                        {formatDuration(prev.timeTakenSeconds)}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        {isCurrent ? (
                          <span className="font-mono text-[11px] font-semibold text-emerald-700">
                            Active View
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onNavigate(
                                `/exams/${encodeURIComponent(exam.slug)}/result?attemptUid=${encodeURIComponent(prev.attemptUid)}`,
                              )
                            }
                            className="font-semibold text-blue-700 hover:text-blue-800"
                          >
                            Load Attempt
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {showAudit && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-800">
                Server Attempt Audit Log (<span className="font-mono">attempt_events</span>)
              </p>
              <ul className="divide-y divide-slate-200 text-[11px] font-mono text-slate-600">
                {auditEvents.map((ev) => (
                  <li key={ev.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="font-semibold text-slate-800">{ev.eventType}</span>
                    <span>{new Date(ev.createdAt).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Full Question-by-Question Answer Review */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-xl font-bold text-slate-900">
            Full Answer Review &amp; Explanations
          </h2>

          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all' as const, label: `All (${review.gradedQuestions.length})` },
              { id: 'correct' as const, label: `Correct (${result.correctCount})` },
              { id: 'incorrect' as const, label: `Incorrect (${result.incorrectCount})` },
              { id: 'unattempted' as const, label: `Unattempted (${result.unattemptedCount})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setReviewFilter(f.id)}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  reviewFilter === f.id
                    ? 'border-red-700 bg-red-700 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredQuestions.map((q, idx) => {
            const typeMeta = QUESTION_TYPE_CATALOG.find((t) => t.id === q.questionType);
            return (
              <article
                key={q.questionId}
                className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-slate-600">
                    <span className="font-mono font-bold text-slate-900">#{idx + 1}</span>
                    <span className="font-mono text-red-700">{q.questionUid}</span>
                    <span>·</span>
                    <span>
                      {q.subjectName} / {q.chapterName} / {q.topicName}
                    </span>
                    <span>·</span>
                    <span>{typeMeta?.shortLabel ?? q.questionType}</span>
                  </div>

                  <div className="flex items-center gap-2 font-mono font-semibold tabular-nums">
                    {q.status === 'correct' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        +{q.marksAwarded} marks
                      </span>
                    ) : q.status === 'incorrect' ? (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        {q.marksAwarded} marks
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <MinusCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        0 marks (Unattempted)
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm font-medium text-slate-900 leading-relaxed">
                  {q.questionContent.prompt}
                </p>

                <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs sm:grid-cols-2">
                  <div>
                    <span className="text-slate-500 block">Your Answer</span>
                    <span
                      className={`font-semibold ${
                        q.status === 'correct'
                          ? 'text-emerald-800'
                          : q.status === 'incorrect'
                            ? 'text-red-800'
                            : 'text-slate-600'
                      }`}
                    >
                      {formatSubmittedAnswer(q.submittedAnswer)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Correct Answer</span>
                    <span className="font-semibold text-emerald-800">
                      {formatExpectedAnswer(q.correctAnswer)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between text-xs leading-relaxed text-slate-700">
                  <div>
                    <strong className="text-slate-900">Explanation: </strong>
                    {q.explanation}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAiDrawer({
                        open: true,
                        action: q.status === 'incorrect' ? 'explain_incorrect' : 'explain_simple',
                        context: {
                          mode: 'exam_result',
                          gradeLevel: exam.academicLevel,
                          subjectName: q.subjectName,
                          chapterName: q.chapterName,
                          topicName: q.topicName,
                          questionPrompt: q.questionContent.prompt,
                          studentAnswer: formatSubmittedAnswer(q.submittedAnswer),
                          correctAnswer: formatExpectedAnswer(q.correctAnswer),
                          officialExplanation: q.explanation,
                        },
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:border-red-300 hover:bg-red-50 hover:text-red-800 shrink-0"
                  >
                    <Sparkles className="h-3 w-3 text-red-700" aria-hidden="true" />
                    {q.status === 'incorrect' ? 'AI: Why Incorrect?' : 'AI: Explain'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {aiDrawer && (
        <AiStudyAssistantDrawer
          open={aiDrawer.open}
          onClose={() => setAiDrawer(null)}
          initialAction={aiDrawer.action}
          context={aiDrawer.context}
        />
      )}
    </section>
  );
}

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Filter,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { AiStudyAssistantDrawer } from './AiStudyAssistantDrawer.tsx';
import { StudentSubNav } from './StudentSubNav.tsx';
import type {
  MistakeBookItem,
  MistakesSummaryResponse,
  SubmittedAnswerPayload,
} from '../types/api.ts';

interface MistakeBookViewProps {
  onNavigate: (path: string) => void;
  onOpenAuth: () => void;
}

function formatAnswerText(
  ans: Record<string, unknown> | null | undefined,
  options: Array<{ optionKey: string; optionText: string }>,
): string {
  if (!ans) return 'No response recorded';
  if (Array.isArray(ans.optionKeys) && ans.optionKeys.length > 0) {
    return (ans.optionKeys as string[])
      .map((k) => {
        const found = options.find((o) => o.optionKey === k);
        return found ? `${k}. ${found.optionText}` : k;
      })
      .join(', ');
  }
  if (typeof ans.booleanValue === 'boolean') {
    return ans.booleanValue ? 'True' : 'False';
  }
  if (typeof ans.numericValue === 'number') {
    return String(ans.numericValue);
  }
  if (typeof ans.textValue === 'string' && ans.textValue.trim()) {
    return ans.textValue;
  }
  if (typeof ans.acceptedText === 'string' && ans.acceptedText.trim()) {
    return ans.acceptedText;
  }
  if (ans.matchingMap && typeof ans.matchingMap === 'object') {
    return Object.entries(ans.matchingMap as Record<string, string>)
      .map(([l, r]) => `${l} → ${r}`)
      .join(' | ');
  }
  return 'Attempt recorded';
}

export function MistakeBookView({ onNavigate, onOpenAuth }: MistakeBookViewProps) {
  const { user, apiFetch } = useAuth();
  const [data, setData] = useState<MistakesSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [subjectFilter, setSubjectFilter] = useState('all');
  const [chapterFilter, setChapterFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');

  // Reattempt interactive state
  const [activeMistakeId, setActiveMistakeId] = useState<number | null>(null);
  const [draftAnswer, setDraftAnswer] = useState<SubmittedAnswerPayload | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [feedbackById, setFeedbackById] = useState<
    Record<number, { isCorrect: boolean; message: string; explanation: string }>
  >({});
  const [aiMistakeItem, setAiMistakeItem] = useState<MistakeBookItem | null>(null);

  const loadMistakes = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (subjectFilter !== 'all') params.set('subject', subjectFilter);
      if (chapterFilter !== 'all') params.set('chapter', chapterFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await apiFetch(`/api/mistakes?${params.toString()}`);
      const json = (await res.json()) as MistakesSummaryResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not load mistake book.');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load mistakes.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, chapterFilter, statusFilter, subjectFilter, user]);

  useEffect(() => {
    void loadMistakes();
  }, [loadMistakes]);

  const startReattempt = (item: MistakeBookItem) => {
    setActiveMistakeId(item.id);
    setDraftAnswer(null);
  };

  const handleSubmitReattempt = async (item: MistakeBookItem) => {
    if (!draftAnswer) return;
    setSubmittingId(item.id);
    setError(null);
    try {
      const res = await apiFetch(`/api/mistakes/${item.id}/reattempt`, {
        method: 'POST',
        body: JSON.stringify({ selectedAnswer: draftAnswer }),
      });
      const json = (await res.json()) as {
        isCorrect: boolean;
        explanation: string;
        newlyUnlockedBadges?: Array<{ title: string }>;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || 'Failed to evaluate reattempt.');

      const badgeNote =
        json.newlyUnlockedBadges && json.newlyUnlockedBadges.length > 0
          ? ` Badge unlocked: ${json.newlyUnlockedBadges.map((b) => b.title).join(', ')}.`
          : '';

      setFeedbackById((prev) => ({
        ...prev,
        [item.id]: {
          isCorrect: json.isCorrect,
          message: json.isCorrect
            ? `Correct! Marked as Resolved and topic mastery updated.${badgeNote}`
            : 'Still incorrect — review the step-by-step explanation and try again.',
          explanation: json.explanation,
        },
      }));
      if (json.isCorrect) {
        setActiveMistakeId(null);
      }
      await loadMistakes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reattempt failed.');
    } finally {
      setSubmittingId(null);
    }
  };

  if (!user) {
    return (
      <section className="space-y-6">
        <StudentSubNav active="mistakes" onNavigate={onNavigate} />

        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Improve · Automatic Mistake Recovery
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900">
              Personal Mistake Book
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Every missed question from Chapter Practice, Daily Challenges, and Mock Exams is saved
              here automatically for guided reattempt until resolved.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 self-start sm:self-auto"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Dashboard
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-4">
          <BookOpen className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Sign in to access your Mistake Book
            </h2>
            <p className="mx-auto max-w-md text-sm text-slate-600">
              Sign in with your learner account to track unresolved mistakes, launch Reattempt Mode,
              and boost weak-topic mastery.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAuth}
            className="min-h-[44px] rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Sign In to Open Mistake Book
          </button>
        </div>
      </section>
    );
  }

  const total = data?.counts.total ?? 0;
  const unresolved = data?.counts.unresolved ?? 0;
  const resolved = data?.counts.resolved ?? 0;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return (
    <section aria-labelledby="mistakes-heading" className="space-y-6">
      <StudentSubNav
        active="mistakes"
        onNavigate={onNavigate}
        unresolvedMistakes={unresolved}
      />

      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Improve · Automatic Mistake Recovery
          </p>
          <h1
            id="mistakes-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            Mistake Book &amp; Reattempt Mode
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Incorrect answers from Chapter Practice, Daily Challenges, and Mock Examinations appear
            here automatically. Answer correctly in Reattempt Mode to mark an item Resolved.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('/practice/daily')}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            Daily Challenge
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/exams')}
            className="min-h-[40px] rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          >
            Mock Exam Center
          </button>
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Logged</p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">{total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Unresolved</p>
          <p className="mt-1 font-mono text-2xl font-bold text-red-700 tabular-nums">
            {unresolved}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Resolved</p>
          <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums">
            {resolved}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Resolution Rate</p>
          <p className="mt-1 font-mono text-2xl font-bold text-blue-700 tabular-nums">
            {resolutionRate}%
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" aria-hidden="true" />
          {(['all', 'unresolved', 'resolved'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`min-h-[38px] rounded-md px-3.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span>Subject</span>
            <select
              aria-label="Filter mistakes by subject"
              value={subjectFilter}
              onChange={(e) => {
                setSubjectFilter(e.target.value);
                setChapterFilter('all');
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800"
            >
              <option value="all">All Subjects</option>
              {(data?.subjects ?? []).map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span>Chapter</span>
            <select
              aria-label="Filter mistakes by chapter"
              value={chapterFilter}
              onChange={(e) => setChapterFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800"
            >
              <option value="all">All Chapters</option>
              {(data?.chapters ?? []).map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white" />
        </div>
      ) : (data?.mistakes.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-3">
          <Target className="mx-auto h-8 w-8 text-emerald-700" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-slate-900">
            {total === 0
              ? 'No mistakes recorded yet'
              : 'No mistakes match your selected filters'}
          </h2>
          <p className="mx-auto max-w-md text-sm text-slate-600">
            {total === 0
              ? 'Practice chapter MCQs, try today’s Daily Challenge, or complete a timed Mock Exam. Any missed question will appear here for structured review.'
              : 'Try resetting your subject, chapter, or status filters above.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('/school/class-10/MATH-10/1?tab=practice')}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Try Chapter Practice
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/practice/daily')}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Take Daily Challenge
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.mistakes.map((item) => {
            const isReattempting = activeMistakeId === item.id;
            const feedback = feedbackById[item.id];
            const isResolved = item.status === 'resolved';
            const snap = item.questionSnapshot;

            return (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-800">{item.subjectName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.chapterName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.topicName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{item.difficulty}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-[11px] uppercase">{item.sourceType.replace('_', ' ')}</span>
                    </div>
                    <h2 className="font-display text-base font-bold text-slate-900">
                      {snap.prompt}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        isResolved ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {isResolved ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {isResolved ? 'Resolved' : 'Unresolved'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAiMistakeItem(item)}
                      className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 whitespace-nowrap"
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      AI Explain
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        isReattempting ? setActiveMistakeId(null) : startReattempt(item)
                      }
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      {isReattempting ? 'Close Reattempt' : 'Reattempt'}
                    </button>
                  </div>
                </div>

                {snap.diagramSvg && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <img
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(snap.diagramSvg)}`}
                      alt={snap.diagramLabel || 'Question diagram'}
                      className="mx-auto max-h-48 w-auto"
                    />
                  </div>
                )}

                {!isReattempting ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                    <div className="rounded-lg bg-red-50/70 p-3 space-y-1">
                      <p className="font-semibold text-red-900">Your Wrong Answer</p>
                      <p className="text-red-800">
                        {formatAnswerText(
                          item.studentWrongAnswer as Record<string, unknown> | null,
                          snap.options,
                        )}
                      </p>
                    </div>
                    <div className="rounded-lg bg-emerald-50/70 p-3 space-y-1">
                      <p className="font-semibold text-emerald-900">Correct Answer</p>
                      <p className="text-emerald-800">
                        {formatAnswerText(
                          item.correctAnswer as Record<string, unknown>,
                          snap.options,
                        )}
                      </p>
                    </div>
                    <div className="sm:col-span-2 rounded-lg bg-slate-50 p-3 text-slate-700 leading-relaxed">
                      <strong className="font-semibold text-slate-900">Explanation: </strong>
                      {item.explanation}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <p className="text-xs font-semibold text-slate-800">
                      Interactive Reattempt Mode — answer correctly to resolve this mistake
                    </p>

                    {(snap.questionType === 'single_mcq' ||
                      snap.questionType === 'diagram_based' ||
                      snap.questionType === 'case_based' ||
                      snap.questionType === 'assertion_reason') && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {snap.options.map((opt) => {
                          const selected =
                            draftAnswer?.optionKeys?.[0] === opt.optionKey;
                          return (
                            <button
                              key={opt.optionKey}
                              type="button"
                              onClick={() =>
                                setDraftAnswer({ optionKeys: [opt.optionKey] })
                              }
                              className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-3.5 py-2.5 text-left text-xs transition-colors ${
                                selected
                                  ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                                  : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                              }`}
                            >
                              <span className="font-mono text-[11px] opacity-75">
                                {opt.optionKey}.
                              </span>
                              <span>{opt.optionText}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {snap.questionType === 'multiple_mcq' && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {snap.options.map((opt) => {
                          const current = draftAnswer?.optionKeys ?? [];
                          const selected = current.includes(opt.optionKey);
                          return (
                            <button
                              key={opt.optionKey}
                              type="button"
                              onClick={() => {
                                const next = selected
                                  ? current.filter((k) => k !== opt.optionKey)
                                  : [...current, opt.optionKey];
                                setDraftAnswer({ optionKeys: next });
                              }}
                              className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-3.5 py-2.5 text-left text-xs transition-colors ${
                                selected
                                  ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                                  : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                              }`}
                            >
                              <span className="font-mono text-[11px] opacity-75">
                                {opt.optionKey}.
                              </span>
                              <span>{opt.optionText}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {snap.questionType === 'true_false' && (
                      <div className="flex gap-3">
                        {[true, false].map((val) => {
                          const selected = draftAnswer?.booleanValue === val;
                          return (
                            <button
                              key={String(val)}
                              type="button"
                              onClick={() => setDraftAnswer({ booleanValue: val })}
                              className={`min-h-[44px] rounded-lg border px-5 py-2 text-xs font-semibold ${
                                selected
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-200 bg-white text-slate-800'
                              }`}
                            >
                              {val ? 'True' : 'False'}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {snap.questionType === 'numerical' && (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="any"
                          aria-label="Enter numerical answer"
                          value={
                            typeof draftAnswer?.numericValue === 'number'
                              ? draftAnswer.numericValue
                              : ''
                          }
                          onChange={(e) => {
                            const num = Number(e.target.value);
                            setDraftAnswer({
                              numericValue: e.target.value === '' || Number.isNaN(num) ? null : num,
                            });
                          }}
                          placeholder="Enter numeric value..."
                          className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900"
                        />
                        {snap.unitHint && (
                          <span className="text-xs text-slate-500">{snap.unitHint}</span>
                        )}
                      </div>
                    )}

                    {(snap.questionType === 'short_answer' ||
                      snap.questionType === 'long_answer' ||
                      snap.questionType === 'matching') && (
                      <textarea
                        rows={2}
                        aria-label="Enter reattempt answer"
                        value={draftAnswer?.textValue ?? ''}
                        onChange={(e) => setDraftAnswer({ textValue: e.target.value })}
                        placeholder="Type your response..."
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                      />
                    )}

                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                        Attempts so far: {item.attemptCount}
                      </span>
                      <button
                        type="button"
                        disabled={!draftAnswer || submittingId === item.id}
                        onClick={() => void handleSubmitReattempt(item)}
                        className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-40"
                      >
                        {submittingId === item.id ? 'Checking...' : 'Submit Reattempt'}
                      </button>
                    </div>
                  </div>
                )}

                {feedback && (
                  <div
                    className={`rounded-lg border p-3 text-xs space-y-1 ${
                      feedback.isCorrect
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-amber-200 bg-amber-50 text-amber-900'
                    }`}
                  >
                    <p className="font-semibold">{feedback.message}</p>
                    <p>{feedback.explanation}</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {aiMistakeItem && (
        <AiStudyAssistantDrawer
          open={Boolean(aiMistakeItem)}
          onClose={() => setAiMistakeItem(null)}
          initialAction="explain_incorrect"
          context={{
            mode: 'mistake',
            gradeLevel: aiMistakeItem.academicLevel,
            subjectName: aiMistakeItem.subjectName,
            chapterName: aiMistakeItem.chapterName,
            topicName: aiMistakeItem.topicName,
            questionPrompt: aiMistakeItem.questionSnapshot.prompt,
            studentAnswer: formatAnswerText(
              aiMistakeItem.studentWrongAnswer as Record<string, unknown> | null,
              aiMistakeItem.questionSnapshot.options,
            ),
            correctAnswer: formatAnswerText(
              aiMistakeItem.correctAnswer as Record<string, unknown>,
              aiMistakeItem.questionSnapshot.options,
            ),
            officialExplanation: aiMistakeItem.explanation,
          }}
        />
      )}
    </section>
  );
}

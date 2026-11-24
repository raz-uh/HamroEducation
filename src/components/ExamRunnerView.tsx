import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Grid,
  Lock,
  PanelRightClose,
  PanelRightOpen,
  ShieldAlert,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { QUESTION_TYPE_CATALOG, isAnswerProvided } from '../lib/exam-engine.ts';
import type {
  ExamAttemptStartResponse,
  ExamOverviewResponse,
  SanitizedExamQuestion,
  SavedAnswerState,
  SubmittedAnswerPayload,
} from '../types/api.ts';

interface ExamRunnerViewProps {
  examId: string;
  onNavigate: (path: string) => void;
  onOpenAuth: () => void;
}

type DraftStorageMap = Record<
  number,
  {
    selectedAnswer: SubmittedAnswerPayload | null;
    isMarkedForReview: boolean;
    status: SavedAnswerState['status'];
    pendingSync?: boolean;
  }
>;

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ExamRunnerView({ examId, onNavigate, onOpenAuth }: ExamRunnerViewProps) {
  const { user, apiFetch } = useAuth();
  const [overview, setOverview] = useState<ExamOverviewResponse | null>(null);
  const [attemptData, setAttemptData] = useState<ExamAttemptStartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answerStates, setAnswerStates] = useState<Record<number, SavedAnswerState>>({});
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'offline_queued'>('idle');
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  const autoSubmittedRef = useRef(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/exams/${encodeURIComponent(examId)}`);
      const json = (await res.json()) as ExamOverviewResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to load examination details.');
      setOverview(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load examination.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, examId]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const storageKey = attemptData
    ? `hamro_exam_draft_${attemptData.attempt.attemptUid}`
    : null;

  const persistLocalDraft = useCallback(
    (uid: string, nextMap: Record<number, SavedAnswerState>, pendingIds: Set<number>) => {
      try {
        const payload: DraftStorageMap = {};
        for (const [k, st] of Object.entries(nextMap)) {
          const qId = Number(k);
          payload[qId] = {
            selectedAnswer: st.selectedAnswer,
            isMarkedForReview: st.isMarkedForReview,
            status: st.status,
            pendingSync: pendingIds.has(qId),
          };
        }
        window.localStorage.setItem(`hamro_exam_draft_${uid}`, JSON.stringify(payload));
      } catch {
        // Ignore storage quota errors
      }
    },
    [],
  );

  const syncSingleAnswerToServer = useCallback(
    async (
      attemptUid: string,
      questionId: number,
      selectedAnswer: SubmittedAnswerPayload | null,
      isMarkedForReview: boolean,
      visitedOnly = false,
    ): Promise<boolean> => {
      try {
        if (!visitedOnly) setSyncStatus('saving');
        const res = await apiFetch(
          `/api/exams/attempts/${encodeURIComponent(attemptUid)}/answer`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionId,
              selectedAnswer,
              isMarkedForReview,
              visitedOnly,
            }),
          },
        );
        const json = (await res.json()) as { expired?: boolean; error?: string };
        if (json.expired) {
          onNavigate(`/exams/${encodeURIComponent(examId)}/result?attemptUid=${encodeURIComponent(attemptUid)}`);
          return true;
        }
        if (!res.ok) {
          throw new Error(json.error || 'Sync error');
        }
        if (!visitedOnly) setSyncStatus('saved');
        return true;
      } catch {
        setSyncStatus('offline_queued');
        return false;
      }
    },
    [apiFetch, examId, onNavigate],
  );

  // Sync any local drafts that were saved during network outage
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (!attemptData || !storageKey) return;
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw) as DraftStorageMap;
        for (const [k, entry] of Object.entries(parsed)) {
          if (entry.pendingSync) {
            void syncSingleAnswerToServer(
              attemptData.attempt.attemptUid,
              Number(k),
              entry.selectedAnswer,
              entry.isMarkedForReview,
              false,
            );
          }
        }
      } catch {
        // ignore parse errors
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [attemptData, storageKey, syncSingleAnswerToServer]);

  const handleStartExam = async (forceNew = false) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setStarting(true);
    setError(null);
    autoSubmittedRef.current = false;
    try {
      const res = await apiFetch(`/api/exams/${encodeURIComponent(examId)}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceNew }),
      });
      const json = (await res.json()) as ExamAttemptStartResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Unable to start exam.');

      const initialStates: Record<number, SavedAnswerState> = {};
      for (const s of json.savedAnswers) {
        initialStates[s.questionId] = s;
      }

      // Merge any localStorage draft recovery for this attempt
      try {
        const draftRaw = window.localStorage.getItem(
          `hamro_exam_draft_${json.attempt.attemptUid}`,
        );
        if (draftRaw) {
          const parsed = JSON.parse(draftRaw) as DraftStorageMap;
          for (const [k, entry] of Object.entries(parsed)) {
            const qId = Number(k);
            if (entry.pendingSync && initialStates[qId]) {
              initialStates[qId] = {
                questionId: qId,
                selectedAnswer: entry.selectedAnswer,
                isMarkedForReview: entry.isMarkedForReview,
                status: entry.status,
              };
              void syncSingleAnswerToServer(
                json.attempt.attemptUid,
                qId,
                entry.selectedAnswer,
                entry.isMarkedForReview,
                false,
              );
            }
          }
        }
      } catch {
        // ignore recovery parse issues
      }

      // Mark first question visited if currently unvisited
      const firstQ = json.snapshot.questions[0];
      if (firstQ && initialStates[firstQ.questionId]?.status === 'unvisited') {
        initialStates[firstQ.questionId] = {
          ...initialStates[firstQ.questionId],
          status: 'not_answered',
        };
      }

      const expMs = Date.parse(json.attempt.expiresAt);
      setRemainingSeconds(Math.max(0, Math.floor((expMs - Date.now()) / 1000)));
      setAnswerStates(initialStates);
      setCurrentIndex(0);
      setAttemptData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start exam.');
    } finally {
      setStarting(false);
    }
  };

  const handleFinalSubmit = useCallback(
    async (reason: 'manual' | 'timeout' = 'manual') => {
      if (!attemptData || submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        const res = await apiFetch(
          `/api/exams/attempts/${encodeURIComponent(attemptData.attempt.attemptUid)}/submit`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
          },
        );
        const json = (await res.json()) as { attemptUid?: string; error?: string };
        if (!res.ok) throw new Error(json.error || 'Submission failed.');
        try {
          window.localStorage.removeItem(`hamro_exam_draft_${attemptData.attempt.attemptUid}`);
        } catch {
          // ignore
        }
        setConfirmModalOpen(false);
        onNavigate(
          `/exams/${encodeURIComponent(examId)}/result?attemptUid=${encodeURIComponent(attemptData.attempt.attemptUid)}`,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Submission error. Please retry.');
        setSubmitting(false);
      }
    },
    [apiFetch, attemptData, examId, onNavigate, submitting],
  );

  // Live countdown timer + auto-submit at 00:00
  useEffect(() => {
    if (!attemptData) return;
    const interval = window.setInterval(() => {
      const expMs = Date.parse(attemptData.attempt.expiresAt);
      const secs = Math.max(0, Math.floor((expMs - Date.now()) / 1000));
      setRemainingSeconds(secs);
      if (secs <= 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        void handleFinalSubmit('timeout');
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [attemptData, handleFinalSubmit]);

  const updateQuestionAnswer = (
    question: SanitizedExamQuestion,
    nextAnswer: SubmittedAnswerPayload | null,
    nextMarked: boolean,
  ) => {
    if (!attemptData) return;
    const answered = isAnswerProvided(question.questionType, nextAnswer);
    const nextStatus: SavedAnswerState['status'] = nextMarked
      ? 'marked_for_review'
      : answered
        ? 'answered'
        : 'not_answered';

    const updatedState: SavedAnswerState = {
      questionId: question.questionId,
      selectedAnswer: nextAnswer,
      isMarkedForReview: nextMarked,
      status: nextStatus,
    };

    const nextMap = { ...answerStates, [question.questionId]: updatedState };
    setAnswerStates(nextMap);

    const pending = new Set<number>([question.questionId]);
    persistLocalDraft(attemptData.attempt.attemptUid, nextMap, pending);

    void syncSingleAnswerToServer(
      attemptData.attempt.attemptUid,
      question.questionId,
      nextAnswer,
      nextMarked,
      false,
    ).then((ok) => {
      if (ok) {
        persistLocalDraft(attemptData.attempt.attemptUid, nextMap, new Set());
      }
    });
  };

  const navigateToQuestion = (targetIdx: number) => {
    if (!attemptData) return;
    const qs = attemptData.snapshot.questions;
    if (targetIdx < 0 || targetIdx >= qs.length) return;
    const targetQ = qs[targetIdx];
    const currentState = answerStates[targetQ.questionId];
    if (currentState && currentState.status === 'unvisited') {
      const visitedState: SavedAnswerState = { ...currentState, status: 'not_answered' };
      const nextMap = { ...answerStates, [targetQ.questionId]: visitedState };
      setAnswerStates(nextMap);
      void syncSingleAnswerToServer(
        attemptData.attempt.attemptUid,
        targetQ.questionId,
        visitedState.selectedAnswer,
        visitedState.isMarkedForReview,
        true,
      );
    }
    setCurrentIndex(targetIdx);
  };

  const paletteCounts = useMemo(() => {
    const values = Object.values(answerStates);
    return {
      answered: values.filter((v) => v.status === 'answered').length,
      marked: values.filter((v) => v.status === 'marked_for_review').length,
      notAnswered: values.filter((v) => v.status === 'not_answered').length,
      unvisited: values.filter((v) => v.status === 'unvisited').length,
    };
  }, [answerStates]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
      </div>
    );
  }

  if (!attemptData) {
    // Pre-Start Exam Configuration & Instructions Screen
    if (!overview) {
      return (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => onNavigate('/exams')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All Mock Examinations
          </button>
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error || 'Examination could not be found.'}</span>
          </div>
        </div>
      );
    }

    const { exam, sections, userAttemptCount, activeAttempt, recentResults } = overview;
    const attemptsExhausted = !activeAttempt && userAttemptCount >= exam.attemptLimit;

    return (
      <section aria-labelledby="exam-overview-title" className="space-y-8">
        <div className="border-b border-slate-200 pb-6">
          <button
            type="button"
            onClick={() => onNavigate('/exams')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Mock Examinations
          </button>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium text-red-700">
                {exam.category === 'school_board' ? 'School Board Simulation' : 'Bachelor Entrance CBT'} ·{' '}
                {exam.academicLevel}
              </p>
              <h1
                id="exam-overview-title"
                className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
              >
                {exam.title}
              </h1>
              <p className="mt-1.5 text-sm text-slate-600">
                <strong className="text-slate-800">Subjects:</strong> {exam.subjectScope}
                {exam.chapterScope ? ` · ${exam.chapterScope}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {!user ? (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-red-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-800"
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Sign In to Start Timed Exam
                </button>
              ) : (
                <button
                  type="button"
                  disabled={starting || attemptsExhausted}
                  onClick={() => void handleStartExam(false)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-red-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                >
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {starting
                    ? 'Preparing Immutable Snapshot...'
                    : activeAttempt
                      ? `Resume Attempt #${activeAttempt.attemptNumber}`
                      : attemptsExhausted
                        ? 'Attempt Limit Reached'
                        : 'Start Timed Examination'}
                </button>
              )}

              {recentResults.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate(`/exams/${exam.slug}/result`)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  View Past Results ({recentResults.length})
                </button>
              )}
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

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Published Questions
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
              {exam.liveQuestionCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Live Total Marks
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
              {exam.liveTotalMarks}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Time Allowed
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
              {exam.durationMinutes} min
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Attempt Limit
            </p>
            <p className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums">
              {userAttemptCount} / {exam.attemptLimit}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Exam Rules &amp; Integrity Snapshot
            </h2>
            <p className="text-sm leading-relaxed text-slate-700">{exam.instructions}</p>
            <ul className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <li>
                <strong className="text-slate-900">Negative Marking:</strong>{' '}
                {exam.negativeMarkingRule.description}
              </li>
              <li>
                <strong className="text-slate-900">Randomization:</strong> Questions{' '}
                {exam.randomizeQuestions ? 'shuffled per attempt' : 'ordered by section'} · Options{' '}
                {exam.randomizeOptions ? 'shuffled per question' : 'standard sequence'}
              </li>
              <li>
                <strong className="text-slate-900">Result Visibility:</strong>{' '}
                {exam.resultVisibility === 'immediate'
                  ? 'Immediate server-graded review upon submission'
                  : 'Published after exam window'}
              </li>
              <li>
                <strong className="text-slate-900">Security &amp; Snapshots:</strong> Starting
                freezes an immutable question &amp; marking snapshot in PostgreSQL; all grading runs
                strictly on the server.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Section Blueprint
            </h2>
            <ul className="mt-3 divide-y divide-slate-100">
              {sections.map((sec) => (
                <li key={sec.id} className="flex items-center justify-between gap-4 py-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">{sec.title}</p>
                    <p className="text-slate-500">{sec.description || sec.subjectName}</p>
                  </div>
                  <span className="font-mono font-semibold text-slate-800 tabular-nums shrink-0">
                    {sec.sectionMarks} Marks
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    );
  }

  // Active Timed Examination Runner
  const questions = attemptData.snapshot.questions;
  const activeQ = questions[currentIndex];
  const activeState = answerStates[activeQ.questionId] ?? {
    questionId: activeQ.questionId,
    selectedAnswer: null,
    status: 'not_answered',
    isMarkedForReview: false,
  };
  const qTypeMeta = QUESTION_TYPE_CATALOG.find((t) => t.id === activeQ.questionType);
  const timerLow = remainingSeconds <= 120;

  return (
    <section aria-labelledby="active-exam-title" className="space-y-5">
      {/* Sticky Exam Runner Header Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[11px] font-semibold text-red-700">
              {attemptData.attempt.attemptUid} · Attempt #{attemptData.attempt.attemptNumber}
            </p>
            <h1
              id="active-exam-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              {attemptData.examConfig.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div
              aria-live="polite"
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-sm font-bold tabular-nums ${
                timerLow
                  ? 'border-red-300 bg-red-50 text-red-800'
                  : 'border-slate-200 bg-slate-50 text-slate-900'
              }`}
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              {isOnline ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
              )}
              <span>
                {syncStatus === 'saving'
                  ? 'Syncing...'
                  : syncStatus === 'offline_queued'
                    ? 'Saved Locally (Offline)'
                    : 'Auto-saved'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setPaletteOpen((v) => !v)}
              aria-expanded={paletteOpen}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {paletteOpen ? (
                <PanelRightClose className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Palette
            </button>

            <button
              type="button"
              onClick={() => setConfirmModalOpen(true)}
              className="min-h-[40px] rounded-lg bg-red-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
            >
              Submit Exam
            </button>
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

      <div
        className={`grid grid-cols-1 gap-6 ${paletteOpen ? 'lg:grid-cols-12' : ''}`}
      >
        {/* Main Question Card */}
        <div className={paletteOpen ? 'lg:col-span-8' : 'w-full'}>
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-slate-600">
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  Question {currentIndex + 1} / {questions.length}
                </span>
                <span>·</span>
                <span className="font-medium text-blue-700">{activeQ.sectionTitle}</span>
                <span>·</span>
                <span>{activeQ.topicName}</span>
              </div>

              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
                  {qTypeMeta?.label ?? activeQ.questionType}
                </span>
                <span className="text-emerald-700 font-semibold tabular-nums">
                  +{activeQ.marks}
                </span>
                {activeQ.negativeMarks > 0 && (
                  <span className="text-red-700 font-semibold tabular-nums">
                    -{activeQ.negativeMarks}
                  </span>
                )}
              </div>
            </div>

            {activeQ.questionContent.passage && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
                <strong className="block text-slate-900 mb-1">Case Study Passage</strong>
                {activeQ.questionContent.passage}
              </div>
            )}

            {activeQ.questionContent.assertion && activeQ.questionContent.reason && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-800 space-y-1.5">
                <p>
                  <strong>Assertion (A): </strong>
                  {activeQ.questionContent.assertion}
                </p>
                <p>
                  <strong>Reason (R): </strong>
                  {activeQ.questionContent.reason}
                </p>
              </div>
            )}

            {activeQ.questionContent.diagramSvg && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-[11px] font-medium text-slate-500">
                  {activeQ.questionContent.diagramLabel || 'Diagram'}
                </p>
                <img
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(activeQ.questionContent.diagramSvg)}`}
                  alt={activeQ.questionContent.diagramLabel || 'Question diagram'}
                  className="max-w-full h-auto"
                />
              </div>
            )}

            <p className="text-base font-medium leading-relaxed text-slate-900">
              {activeQ.questionContent.prompt}
            </p>

            {/* Input Control Based on Question Type */}
            {['single_mcq', 'diagram_based', 'case_based', 'assertion_reason'].includes(
              activeQ.questionType,
            ) && (
              <div className="space-y-2.5" role="radiogroup" aria-label="Answer options">
                {activeQ.options.map((opt) => {
                  const selected =
                    activeState.selectedAnswer?.optionKeys?.[0] === opt.optionKey;
                  return (
                    <button
                      key={opt.optionKey}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() =>
                        updateQuestionAnswer(
                          activeQ,
                          { optionKeys: [opt.optionKey] },
                          activeState.isMarkedForReview,
                        )
                      }
                      className={`flex min-h-[48px] w-full items-start gap-3 rounded-lg border p-3.5 text-left text-sm transition-colors ${
                        selected
                          ? 'border-blue-700 bg-blue-50/70 text-slate-900'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border font-mono text-xs font-bold ${
                          selected
                            ? 'border-blue-700 bg-blue-700 text-white'
                            : 'border-slate-300 bg-slate-50 text-slate-700'
                        }`}
                      >
                        {opt.optionKey}
                      </span>
                      <span className="leading-snug">{opt.optionText}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeQ.questionType === 'multiple_mcq' && (
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-blue-700">
                  Select ALL correct options:
                </p>
                {activeQ.options.map((opt) => {
                  const currentKeys = activeState.selectedAnswer?.optionKeys ?? [];
                  const checked = currentKeys.includes(opt.optionKey);
                  return (
                    <button
                      key={opt.optionKey}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => {
                        const nextKeys = checked
                          ? currentKeys.filter((k) => k !== opt.optionKey)
                          : [...currentKeys, opt.optionKey];
                        updateQuestionAnswer(
                          activeQ,
                          nextKeys.length > 0 ? { optionKeys: nextKeys } : null,
                          activeState.isMarkedForReview,
                        );
                      }}
                      className={`flex min-h-[48px] w-full items-start gap-3 rounded-lg border p-3.5 text-left text-sm transition-colors ${
                        checked
                          ? 'border-blue-700 bg-blue-50/70 text-slate-900'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border font-mono text-xs font-bold ${
                          checked
                            ? 'border-blue-700 bg-blue-700 text-white'
                            : 'border-slate-300 bg-slate-50 text-slate-700'
                        }`}
                      >
                        {checked ? '✓' : opt.optionKey}
                      </span>
                      <span>{opt.optionText}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeQ.questionType === 'true_false' && (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'True', value: true },
                  { label: 'False', value: false },
                ].map((choice) => {
                  const selected =
                    activeState.selectedAnswer?.booleanValue === choice.value;
                  return (
                    <button
                      key={choice.label}
                      type="button"
                      onClick={() =>
                        updateQuestionAnswer(
                          activeQ,
                          { booleanValue: choice.value },
                          activeState.isMarkedForReview,
                        )
                      }
                      className={`min-h-[48px] rounded-lg border p-4 text-sm font-semibold transition-colors ${
                        selected
                          ? 'border-blue-700 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {choice.label}
                    </button>
                  );
                })}
              </div>
            )}

            {activeQ.questionType === 'numerical' && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Enter Numeric Answer{' '}
                  {activeQ.questionContent.unitHint
                    ? `(${activeQ.questionContent.unitHint})`
                    : ''}
                </label>
                <input
                  type="number"
                  step="any"
                  value={
                    typeof activeState.selectedAnswer?.numericValue === 'number'
                      ? String(activeState.selectedAnswer.numericValue)
                      : ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      updateQuestionAnswer(activeQ, null, activeState.isMarkedForReview);
                    } else {
                      const num = Number(val);
                      if (Number.isFinite(num)) {
                        updateQuestionAnswer(
                          activeQ,
                          { numericValue: num },
                          activeState.isMarkedForReview,
                        );
                      }
                    }
                  }}
                  placeholder="Type numeric value..."
                  className="w-full max-w-xs rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>
            )}

            {(activeQ.questionType === 'short_answer' ||
              activeQ.questionType === 'long_answer') && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Written Response
                </label>
                <textarea
                  rows={activeQ.questionType === 'long_answer' ? 5 : 3}
                  value={activeState.selectedAnswer?.textValue ?? ''}
                  onChange={(e) =>
                    updateQuestionAnswer(
                      activeQ,
                      e.target.value.trim() ? { textValue: e.target.value } : null,
                      activeState.isMarkedForReview,
                    )
                  }
                  placeholder="Write your concise scientific or analytical response..."
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              </div>
            )}

            {activeQ.questionType === 'matching' && (
              <div className="space-y-3">
                <p className="text-xs font-medium text-slate-600">
                  Match each item on the left with the corresponding entry on the right:
                </p>
                {(activeQ.questionContent.matchingLeft ?? []).map((leftItem) => {
                  const currentMap = activeState.selectedAnswer?.matchingMap ?? {};
                  return (
                    <div
                      key={leftItem}
                      className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-sm font-medium text-slate-900">{leftItem}</span>
                      <select
                        value={currentMap[leftItem] ?? ''}
                        onChange={(e) => {
                          const nextMap = { ...currentMap, [leftItem]: e.target.value };
                          updateQuestionAnswer(
                            activeQ,
                            { matchingMap: nextMap },
                            activeState.isMarkedForReview,
                          );
                        }}
                        aria-label={`Match for ${leftItem}`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                      >
                        <option value="">Select match...</option>
                        {(activeQ.questionContent.matchingRight ?? []).map((rightItem) => (
                          <option key={rightItem} value={rightItem}>
                            {rightItem}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer Controls */}
            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    updateQuestionAnswer(
                      activeQ,
                      activeState.selectedAnswer,
                      !activeState.isMarkedForReview,
                    )
                  }
                  className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                    activeState.isMarkedForReview
                      ? 'border-amber-400 bg-amber-50 text-amber-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                  {activeState.isMarkedForReview ? 'Marked for Review' : 'Mark for Review'}
                </button>

                <button
                  type="button"
                  onClick={() => updateQuestionAnswer(activeQ, null, false)}
                  className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Clear Response
                </button>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => navigateToQuestion(currentIndex - 1)}
                  className="inline-flex min-h-[42px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Previous
                </button>
                {currentIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => navigateToQuestion(currentIndex + 1)}
                    className="inline-flex min-h-[42px] items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmModalOpen(true)}
                    className="inline-flex min-h-[42px] items-center gap-1 rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800"
                  >
                    Finish &amp; Submit
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Question Navigation Palette */}
        {paletteOpen && (
          <aside
            aria-label="Question navigation palette"
            className="lg:col-span-4"
          >
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="font-display text-sm font-semibold text-slate-900 inline-flex items-center gap-1.5">
                  <Grid className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  Question Palette
                </h2>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {paletteCounts.answered}/{questions.length} answered
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, idx) => {
                  const st = answerStates[q.questionId]?.status ?? 'unvisited';
                  const isCurrent = idx === currentIndex;
                  const statusClasses =
                    st === 'answered'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                      : st === 'marked_for_review'
                        ? 'border-amber-500 bg-amber-50 text-amber-900'
                        : st === 'not_answered'
                          ? 'border-red-300 bg-red-50 text-red-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600';

                  return (
                    <button
                      key={q.questionId}
                      type="button"
                      onClick={() => navigateToQuestion(idx)}
                      aria-label={`Question ${idx + 1}, status ${st.replace(/_/g, ' ')}`}
                      className={`h-9 rounded-md border font-mono text-xs font-bold tabular-nums transition-colors ${statusClasses} ${
                        isCurrent ? 'ring-2 ring-slate-900 ring-offset-1' : ''
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Dual-Coded Status Legend */}
              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                  <span>Answered ({paletteCounts.answered})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <BookmarkCheck className="h-3.5 w-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                  <span>Marked ({paletteCounts.marked})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-700 shrink-0" aria-hidden="true" />
                  <span>Not Answered ({paletteCounts.notAnswered})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded border border-slate-300 bg-slate-100 shrink-0" />
                  <span>Unvisited ({paletteCounts.unvisited})</span>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Submit Confirmation Modal */}
      {confirmModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <h2 id="submit-modal-title" className="font-display text-lg font-bold text-slate-900">
              Confirm Final Examination Submission
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Once submitted, answers are locked and evaluated on the server against your
              immutable attempt snapshot.
            </p>

            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div>
                Answered:{' '}
                <strong className="font-mono text-emerald-700 tabular-nums">
                  {paletteCounts.answered}
                </strong>
              </div>
              <div>
                Marked for Review:{' '}
                <strong className="font-mono text-amber-700 tabular-nums">
                  {paletteCounts.marked}
                </strong>
              </div>
              <div>
                Not Answered:{' '}
                <strong className="font-mono text-red-700 tabular-nums">
                  {paletteCounts.notAnswered}
                </strong>
              </div>
              <div>
                Unvisited:{' '}
                <strong className="font-mono text-slate-700 tabular-nums">
                  {paletteCounts.unvisited}
                </strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setConfirmModalOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Return to Exam
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleFinalSubmit('manual')}
                className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-60"
              >
                {submitting ? 'Grading on Server...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

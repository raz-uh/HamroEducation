import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Flame,
  Lock,
  Shield,
  ShieldAlert,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { StudentSubNav } from './StudentSubNav.tsx';
import type {
  DailyChallengeResponse,
  DailyChallengeSubmitResponse,
  LeaderboardResponse,
  SanitizedExamQuestion,
  SubmittedAnswerPayload,
} from '../types/api.ts';

interface DailyChallengeViewProps {
  initialSection?: 'challenges' | 'leaderboards' | 'achievements';
  onNavigate: (path: string) => void;
  onOpenAuth: () => void;
}

const CHALLENGE_MODES = [
  { id: 'daily_5', label: 'Daily 5' },
  { id: 'daily_10', label: 'Daily 10' },
  { id: 'subject', label: 'Subject' },
  { id: 'class_wise', label: 'Class-wise' },
  { id: 'entrance', label: 'Entrance' },
  { id: 'weekly', label: 'Weekly' },
] as const;

const LEADERBOARD_SCOPES = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'class_wise', label: 'Class-wise' },
  { id: 'subject_wise', label: 'Subject-wise' },
  { id: 'mock_exam', label: 'Mock Exam' },
  { id: 'improvement', label: 'Improvement' },
] as const;

const GRADE_OPTIONS = ['Class 10 / SEE', 'Class 11', 'Class 12 / NEB', 'Bachelor Entrance'];
const ENTRANCE_OPTIONS = [
  { slug: 'bsc-csit', label: 'B.Sc. CSIT' },
  { slug: 'cmat', label: 'CMAT' },
  { slug: 'ioe', label: 'IOE Engineering' },
  { slug: 'mecee-bl', label: 'MECEE-BL Medical' },
];

function QuestionInputBlock({
  question,
  value,
  onChange,
}: {
  question: SanitizedExamQuestion;
  value: SubmittedAnswerPayload | undefined;
  onChange: (next: SubmittedAnswerPayload) => void;
}) {
  const { questionType, questionContent, options } = question;

  if (
    questionType === 'single_mcq' ||
    questionType === 'diagram_based' ||
    questionType === 'case_based' ||
    questionType === 'assertion_reason'
  ) {
    return (
      <div className="space-y-3">
        {questionContent.passage && (
          <div className="rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
            {questionContent.passage}
          </div>
        )}
        {questionContent.assertion && (
          <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1 text-slate-800">
            <p>
              <strong>Assertion (A):</strong> {questionContent.assertion}
            </p>
            {questionContent.reason && (
              <p>
                <strong>Reason (R):</strong> {questionContent.reason}
              </p>
            )}
          </div>
        )}
        {questionContent.diagramSvg && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(questionContent.diagramSvg)}`}
              alt={questionContent.diagramLabel || 'Question diagram'}
              className="mx-auto max-h-48 w-auto"
            />
          </div>
        )}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {options.map((opt) => {
            const selected = value?.optionKeys?.[0] === opt.optionKey;
            return (
              <button
                key={opt.optionKey}
                type="button"
                onClick={() => onChange({ optionKeys: [opt.optionKey] })}
                className={`flex min-h-[44px] items-start gap-2.5 rounded-lg border px-4 py-3 text-left text-xs transition-colors ${
                  selected
                    ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                }`}
              >
                <span className="font-mono text-[11px] opacity-75 shrink-0">{opt.optionKey}.</span>
                <span>{opt.optionText}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (questionType === 'multiple_mcq') {
    const selectedKeys = value?.optionKeys ?? [];
    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {options.map((opt) => {
          const checked = selectedKeys.includes(opt.optionKey);
          return (
            <button
              key={opt.optionKey}
              type="button"
              onClick={() => {
                const next = checked
                  ? selectedKeys.filter((k) => k !== opt.optionKey)
                  : [...selectedKeys, opt.optionKey];
                onChange({ optionKeys: next });
              }}
              className={`flex min-h-[44px] items-start gap-2.5 rounded-lg border px-4 py-3 text-left text-xs transition-colors ${
                checked
                  ? 'border-slate-900 bg-slate-900 text-white font-semibold'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
              }`}
            >
              <span className="font-mono text-[11px] opacity-75 shrink-0">[{checked ? 'x' : ' '}]</span>
              <span>
                {opt.optionKey}. {opt.optionText}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (questionType === 'true_false') {
    return (
      <div className="flex gap-3">
        {[true, false].map((val) => {
          const selected = value?.booleanValue === val;
          return (
            <button
              key={String(val)}
              type="button"
              onClick={() => onChange({ booleanValue: val })}
              className={`min-h-[44px] rounded-lg border px-5 py-2 text-xs font-semibold transition-colors ${
                selected
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
              }`}
            >
              {val ? 'True' : 'False'}
            </button>
          );
        })}
      </div>
    );
  }

  if (questionType === 'numerical') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="any"
          aria-label="Numerical response"
          value={typeof value?.numericValue === 'number' ? value.numericValue : ''}
          onChange={(e) => {
            const num = Number(e.target.value);
            onChange({ numericValue: e.target.value === '' || Number.isNaN(num) ? null : num });
          }}
          placeholder="Enter numeric value..."
          className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs text-slate-900"
        />
        {questionContent.unitHint && (
          <span className="text-xs text-slate-500">{questionContent.unitHint}</span>
        )}
      </div>
    );
  }

  return (
    <textarea
      rows={2}
      aria-label="Written response"
      value={value?.textValue ?? ''}
      onChange={(e) => onChange({ textValue: e.target.value })}
      placeholder="Write your concise response..."
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
    />
  );
}

export function DailyChallengeView({
  initialSection = 'challenges',
  onNavigate,
  onOpenAuth,
}: DailyChallengeViewProps) {
  const { user, apiFetch } = useAuth();
  const [section, setSection] = useState<'challenges' | 'leaderboards' | 'achievements'>(
    initialSection,
  );

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  // Challenge State
  const [mode, setMode] = useState<string>('daily_5');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('Class 10 / SEE');
  const [selectedEntrance, setSelectedEntrance] = useState<string>('bsc-csit');

  const [challengeData, setChallengeData] = useState<DailyChallengeResponse | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(true);
  const [answersById, setAnswersById] = useState<Record<number, SubmittedAnswerPayload>>({});
  const [qotdAnswer, setQotdAnswer] = useState<SubmittedAnswerPayload | undefined>(undefined);

  const [submitting, setSubmitting] = useState(false);
  const [qotdResult, setQotdResult] = useState<DailyChallengeSubmitResponse | null>(null);
  const [challengeResult, setChallengeResult] = useState<DailyChallengeSubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Leaderboard & Achievements State
  const [lbScope, setLbScope] = useState<string>('weekly');
  const [lbSubject, setLbSubject] = useState<string>('');
  const [lbGrade, setLbGrade] = useState<string>('Class 10 / SEE');
  const [lbData, setLbData] = useState<LeaderboardResponse | null>(null);
  const [lbLoading, setLbLoading] = useState(true);
  const [privacyMode, setPrivacyMode] = useState<'masked' | 'alias' | 'public_name'>('masked');
  const [aliasInput, setAliasInput] = useState('');
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyNotice, setPrivacyNotice] = useState<string | null>(null);

  const loadChallenge = useCallback(async () => {
    setChallengeLoading(true);
    setError(null);
    setChallengeResult(null);
    try {
      const params = new URLSearchParams({ mode });
      if (mode === 'subject' && selectedSubject) params.set('subject', selectedSubject);
      if (mode === 'class_wise' && selectedGrade) params.set('gradeLevel', selectedGrade);
      if (mode === 'entrance' && selectedEntrance) params.set('examSlug', selectedEntrance);

      const res = await apiFetch(`/api/practice/daily?${params.toString()}`);
      const json = (await res.json()) as DailyChallengeResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not load daily practice.');
      setChallengeData(json);
      setAnswersById({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load daily challenge.');
    } finally {
      setChallengeLoading(false);
    }
  }, [apiFetch, mode, selectedEntrance, selectedGrade, selectedSubject]);

  const loadLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      const params = new URLSearchParams({ scope: lbScope });
      if (lbScope === 'subject_wise' && lbSubject) params.set('subject', lbSubject);
      if (lbScope === 'class_wise' && lbGrade) params.set('gradeLevel', lbGrade);

      const res = await apiFetch(`/api/leaderboards?${params.toString()}`);
      const json = (await res.json()) as LeaderboardResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not load leaderboards.');
      setLbData(json);
      if (json.myPrivacy) {
        const modeVal = json.myPrivacy.leaderboardPrivacy;
        if (modeVal === 'masked' || modeVal === 'alias' || modeVal === 'public_name') {
          setPrivacyMode(modeVal);
        }
        setAliasInput(json.myPrivacy.leaderboardAlias ?? '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboards.');
    } finally {
      setLbLoading(false);
    }
  }, [apiFetch, lbGrade, lbScope, lbSubject]);

  useEffect(() => {
    void loadChallenge();
  }, [loadChallenge]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const answeredCount = useMemo(() => {
    const questions = challengeData?.challengeQuestions ?? [];
    return questions.filter((q) => Boolean(answersById[q.questionId])).length;
  }, [answersById, challengeData?.challengeQuestions]);

  const syncProgressAfterSubmit = (json: DailyChallengeSubmitResponse) => {
    setChallengeData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        userProgress: {
          streakDays: json.streakDays,
          dailyChallengesCompleted: json.dailyChallengesCompleted,
          doneToday: true,
          totalQuestionsSolved:
            (prev.userProgress?.totalQuestionsSolved ?? 0) + json.gradedItems.length,
        },
      };
    });
  };

  const handleSubmitQotd = async () => {
    const qotd = challengeData?.questionOfTheDay;
    if (!qotd || !qotdAnswer) return;
    if (!user) {
      onOpenAuth();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch('/api/practice/daily/submit', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'question_of_the_day',
          answers: [{ questionId: qotd.questionId, selectedAnswer: qotdAnswer }],
        }),
      });
      const json = (await res.json()) as DailyChallengeSubmitResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not verify Question of the Day.');
      setQotdResult(json);
      syncProgressAfterSubmit(json);
      await loadLeaderboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'QOTD verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitChallenge = async () => {
    const questions = challengeData?.challengeQuestions ?? [];
    if (questions.length === 0) return;
    if (!user) {
      onOpenAuth();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = questions.map((q) => ({
        questionId: q.questionId,
        selectedAnswer: answersById[q.questionId] ?? null,
      }));
      const res = await apiFetch('/api/practice/daily/submit', {
        method: 'POST',
        body: JSON.stringify({ mode, answers: payload }),
      });
      const json = (await res.json()) as DailyChallengeSubmitResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Could not grade challenge.');
      setChallengeResult(json);
      syncProgressAfterSubmit(json);
      await loadLeaderboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Challenge submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePrivacy = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setSavingPrivacy(true);
    setPrivacyNotice(null);
    try {
      const res = await apiFetch('/api/dashboard/goals', {
        method: 'PATCH',
        body: JSON.stringify({
          leaderboardPrivacy: privacyMode,
          leaderboardAlias: aliasInput.trim() || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to update privacy setting.');
      setPrivacyNotice('Leaderboard privacy updated.');
      await loadLeaderboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save privacy mode.');
    } finally {
      setSavingPrivacy(false);
    }
  };

  const qotd = challengeData?.questionOfTheDay ?? null;
  const challengeQuestions = challengeData?.challengeQuestions ?? [];
  const badges = lbData?.achievementsCatalog ?? [];
  const unlockedBadgeCount = badges.filter((b) => b.unlocked).length;

  return (
    <section aria-labelledby="daily-practice-heading" className="space-y-6">
      <StudentSubNav
        active={section === 'leaderboards' || section === 'achievements' ? 'leaderboard' : 'daily'}
        onNavigate={onNavigate}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">
            Practice Streaks &amp; Recognition
          </p>
          <h1
            id="daily-practice-heading"
            className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
          >
            Daily Challenge, Achievements &amp; Leaderboards
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Solve today’s curated challenge sets, unlock mastery badges automatically, and compare
            progress on privacy-safe leaderboards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('/dashboard')}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            Student Dashboard
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/dashboard/mistakes')}
            className="min-h-[40px] rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          >
            Mistake Book
          </button>
        </div>
      </div>

      {/* Section Switcher + Live Streak Metrics */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSection('challenges')}
            className={`min-h-[38px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              section === 'challenges'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daily Challenges &amp; QOTD
          </button>
          <button
            type="button"
            onClick={() => setSection('leaderboards')}
            className={`min-h-[38px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              section === 'leaderboards'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Privacy-Safe Leaderboards
          </button>
          <button
            type="button"
            onClick={() => setSection('achievements')}
            className={`min-h-[38px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              section === 'achievements'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Achievements ({unlockedBadgeCount}/{badges.length || 7})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Flame className="h-4 w-4 text-amber-600" aria-hidden="true" />
            Streak:{' '}
            <strong className="font-mono text-slate-900 tabular-nums">
              {challengeData?.userProgress?.streakDays ?? 0}d
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Challenges Done:{' '}
            <strong className="font-mono text-slate-900 tabular-nums">
              {challengeData?.userProgress?.dailyChallengesCompleted ?? 0}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Solved:{' '}
            <strong className="font-mono text-slate-900 tabular-nums">
              {challengeData?.userProgress?.totalQuestionsSolved ?? 0}
            </strong>
          </span>
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

      {section === 'challenges' && (
        <div className="space-y-6">
          {/* Question of the Day Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium text-blue-700">
                  Question of the Day · {challengeData?.todayDate ?? 'Today'}
                </p>
                <h2 className="mt-0.5 font-display text-lg font-bold text-slate-900">
                  Featured Concept Check
                </h2>
              </div>
              {qotd && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{qotd.subjectName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{qotd.chapterName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{qotd.difficulty}</span>
                </div>
              )}
            </div>

            {challengeLoading || !qotd ? (
              <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                  {qotd.questionContent.prompt}
                </p>
                <QuestionInputBlock
                  question={qotd}
                  value={qotdAnswer}
                  onChange={(next) => {
                    setQotdAnswer(next);
                    setQotdResult(null);
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-slate-500">
                    {user
                      ? 'Wrong responses automatically feed your Mistake Book & Weak Topic Tracker.'
                      : 'Sign in to check your answer and earn streak credit.'}
                  </span>
                  <button
                    type="button"
                    disabled={!qotdAnswer || submitting}
                    onClick={() => void handleSubmitQotd()}
                    className="rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-40 whitespace-nowrap"
                  >
                    {user ? 'Check Question of the Day' : 'Sign In & Check Answer'}
                  </button>
                </div>

                {qotdResult && qotdResult.gradedItems[0] && (
                  <div
                    className={`rounded-lg border p-3.5 text-xs space-y-1.5 ${
                      qotdResult.gradedItems[0].isCorrect
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-red-200 bg-red-50 text-red-900'
                    }`}
                  >
                    <p className="font-semibold flex items-center gap-1.5">
                      {qotdResult.gradedItems[0].isCorrect ? (
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                      )}
                      {qotdResult.gradedItems[0].isCorrect
                        ? 'Correct! Streak & topic accuracy updated.'
                        : 'Incorrect — saved to your Mistake Book for Reattempt Mode.'}
                    </p>
                    <p className="leading-relaxed">{qotdResult.gradedItems[0].explanation}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Challenge Modes & Filters */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Interactive Challenge Sets
                </h2>
                <p className="text-xs text-slate-500">
                  Choose Daily 5, Daily 10, Subject, Class-wise, Entrance, or Weekly marathon sets
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {CHALLENGE_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      mode === m.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {mode === 'subject' && (
              <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span>Select Subject</span>
                  <select
                    aria-label="Challenge subject filter"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-900"
                  >
                    {(challengeData?.availableSubjects ?? []).map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {mode === 'class_wise' && (
              <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span>Select Class / Board Level</span>
                  <select
                    aria-label="Challenge class filter"
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-900"
                  >
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {mode === 'entrance' && (
              <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span>Select Entrance Track</span>
                  <select
                    aria-label="Challenge entrance exam filter"
                    value={selectedEntrance}
                    onChange={(e) => setSelectedEntrance(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-900"
                  >
                    {ENTRANCE_OPTIONS.map((ex) => (
                      <option key={ex.slug} value={ex.slug}>
                        {ex.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>

          {/* Graded Summary if submitted */}
          {challengeResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-6 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-emerald-800">
                    Challenge Evaluated Server-Side
                  </p>
                  <h3 className="mt-0.5 font-display text-xl font-bold text-slate-900">
                    Score: {challengeResult.correctCount} / {challengeResult.totalQuestions} (
                    <span className="font-mono tabular-nums">
                      {challengeResult.accuracyPercent}%
                    </span>
                    )
                  </h3>
                  <p className="mt-1 text-xs text-slate-700">
                    Mistakes auto-logged to Mistake Book:{' '}
                    <strong className="font-mono tabular-nums">
                      {challengeResult.mistakesRecorded}
                    </strong>{' '}
                    · Existing mistakes resolved:{' '}
                    <strong className="font-mono tabular-nums">
                      {challengeResult.mistakesResolved}
                    </strong>{' '}
                    · Active Streak:{' '}
                    <strong className="font-mono tabular-nums">
                      {challengeResult.streakDays} days
                    </strong>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('/dashboard/mistakes')}
                    className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Review Mistake Book
                  </button>
                  <button
                    type="button"
                    onClick={() => setChallengeResult(null)}
                    className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Try Another Set
                  </button>
                </div>
              </div>

              {challengeResult.newlyUnlockedBadges.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <strong>New Badge Unlocked:</strong>{' '}
                  {challengeResult.newlyUnlockedBadges.map((b) => b.title).join(', ')}
                </div>
              )}

              <div className="divide-y divide-emerald-200/70 border-t border-emerald-200 pt-2">
                {challengeResult.gradedItems.map((item, idx) => (
                  <div key={item.questionId} className="py-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">
                        Q{idx + 1}. {item.prompt}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-semibold shrink-0 ${
                          item.isCorrect ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {item.isCorrect ? (
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {item.isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>
                    <p className="text-slate-600">{item.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Questions List */}
          {challengeLoading ? (
            <div className="space-y-4">
              <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />
              <div className="h-32 animate-pulse rounded-xl border border-slate-200 bg-white" />
            </div>
          ) : challengeQuestions.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center space-y-2">
              <Target className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
              <p className="font-display text-base font-bold text-slate-900">
                No questions found for that specific filter
              </p>
              <p className="text-xs text-slate-500">
                Switch to Daily 5 or select another subject/class above.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {challengeQuestions.map((q, idx) => (
                <article
                  key={q.questionId}
                  className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-slate-900">Q{idx + 1}</span>
                      <span aria-hidden="true">·</span>
                      <span>{q.subjectName}</span>
                      <span aria-hidden="true">·</span>
                      <span>{q.chapterName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{q.difficulty}</span>
                    </div>
                    <span className="font-mono tabular-nums text-[11px]">{q.examination}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 leading-relaxed">
                    {q.questionContent.prompt}
                  </h3>
                  <QuestionInputBlock
                    question={q}
                    value={answersById[q.questionId]}
                    onChange={(next) =>
                      setAnswersById((prev) => ({
                        ...prev,
                        [q.questionId]: next,
                      }))
                    }
                  />
                </article>
              ))}

              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-slate-600">
                  Answered{' '}
                  <strong className="font-mono text-slate-900 tabular-nums">
                    {answeredCount} / {challengeQuestions.length}
                  </strong>{' '}
                  questions in this challenge
                </span>
                <button
                  type="button"
                  disabled={answeredCount === 0 || submitting}
                  onClick={() => void handleSubmitChallenge()}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
                >
                  {submitting
                    ? 'Grading on Server...'
                    : user
                      ? 'Submit Challenge for Grading'
                      : 'Sign In to Grade & Save Progress'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {section === 'leaderboards' && (
        <div className="space-y-6">
          {/* Scope Tabs + Privacy Controls */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Privacy-Safe Student Leaderboards
                </h2>
                <p className="text-xs text-slate-500">
                  Emails, phone numbers, and private student records are never exposed on public
                  rankings.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {LEADERBOARD_SCOPES.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setLbScope(sc.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      lbScope === sc.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>

            {lbScope === 'subject_wise' && (
              <div className="border-t border-slate-100 pt-3">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span>Filter by Subject</span>
                  <select
                    aria-label="Leaderboard subject filter"
                    value={lbSubject}
                    onChange={(e) => setLbSubject(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-900"
                  >
                    <option value="">All Subjects</option>
                    {(challengeData?.availableSubjects ?? []).map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {lbScope === 'class_wise' && (
              <div className="border-t border-slate-100 pt-3">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                  <span>Filter by Class</span>
                  <select
                    aria-label="Leaderboard class filter"
                    value={lbGrade}
                    onChange={(e) => setLbGrade(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-900"
                  >
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {/* Privacy Mode Setting */}
            {user && (
              <div className="border-t border-slate-100 pt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs font-medium text-slate-700 space-y-1">
                    <span className="inline-flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                      My Leaderboard Display Privacy
                    </span>
                    <select
                      aria-label="My Leaderboard Display Privacy"
                      value={privacyMode}
                      onChange={(e) =>
                        setPrivacyMode(e.target.value as 'masked' | 'alias' | 'public_name')
                      }
                      className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-900"
                    >
                      <option value="masked">Masked Name (Default · e.g. Aa** · #14)</option>
                      <option value="alias">Chosen Alias Handle</option>
                      <option value="public_name">Chosen Display Name</option>
                    </select>
                  </label>

                  {privacyMode === 'alias' && (
                    <label className="text-xs font-medium text-slate-700 space-y-1">
                      <span>Alias Handle</span>
                      <input
                        type="text"
                        value={aliasInput}
                        onChange={(e) => setAliasInput(e.target.value)}
                        placeholder="e.g. EverestSolver"
                        maxLength={32}
                        className="block rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900"
                      />
                    </label>
                  )}

                  <button
                    type="button"
                    disabled={savingPrivacy}
                    onClick={() => void handleSavePrivacy()}
                    className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
                  >
                    {savingPrivacy ? 'Saving...' : 'Save Privacy'}
                  </button>
                </div>

                {privacyNotice && (
                  <span className="text-xs font-medium text-emerald-700">{privacyNotice}</span>
                )}
              </div>
            )}
          </div>

          {/* Leaderboard Table */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {lbLoading ? (
              <div className="p-6 space-y-3">
                <div className="h-10 animate-pulse rounded bg-slate-100" />
                <div className="h-10 animate-pulse rounded bg-slate-100" />
              </div>
            ) : (lbData?.entries.length ?? 0) === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Trophy className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
                <p className="font-display text-base font-bold text-slate-900">
                  No leaderboard entries in this scope yet
                </p>
                <p className="text-xs text-slate-500">
                  Complete a Daily Challenge or Mock Exam to claim Rank #1.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Rank</th>
                      <th className="px-4 py-3 font-semibold">Learner</th>
                      <th className="px-4 py-3 font-semibold">Track</th>
                      <th className="px-4 py-3 font-semibold text-right">Standing Metric</th>
                      <th className="px-4 py-3 font-semibold text-right">Accuracy</th>
                      <th className="px-4 py-3 font-semibold text-right">Streak</th>
                      <th className="px-4 py-3 font-semibold text-right">Solved</th>
                      <th className="px-4 py-3 font-semibold text-right">Badges</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lbData?.entries.map((entry) => (
                      <tr
                        key={`${entry.rank}-${entry.displayLabel}`}
                        className={entry.isCurrentUser ? 'bg-blue-50/60 font-medium' : 'hover:bg-slate-50'}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-slate-900 tabular-nums">
                          #{entry.rank}
                        </td>
                        <td className="px-4 py-3 text-slate-900">
                          {entry.displayLabel}
                          {entry.isCurrentUser && (
                            <span className="ml-2 font-mono text-[11px] font-semibold text-blue-700">
                              (You)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{entry.targetTrack}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {entry.scoreMetric} {entry.metricUnit}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                          {entry.accuracyPercent}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                          {entry.streakDays}d
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                          {entry.questionsSolved}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums">
                          {entry.badgesCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {section === 'achievements' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Automatic Student Achievements
              </h2>
              <p className="text-xs text-slate-600">
                Badges unlock automatically as you complete tests, sustain streaks, resolve mistakes,
                and master chapters.
              </p>
            </div>
            <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
              {unlockedBadgeCount} / {badges.length || 7} Unlocked
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {badges.map((badge) => (
              <article
                key={badge.code}
                className={`rounded-xl border p-5 space-y-2.5 ${
                  badge.unlocked
                    ? 'border-emerald-200 bg-white'
                    : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium text-slate-500 capitalize">
                      {badge.category} · {badge.targetLabel}
                    </p>
                    <h3 className="mt-0.5 font-display text-base font-bold text-slate-900">
                      {badge.title}
                    </h3>
                  </div>
                  {badge.unlocked ? (
                    <Award className="h-5 w-5 text-emerald-700 shrink-0" aria-hidden="true" />
                  ) : (
                    <Lock className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                  )}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{badge.description}</p>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                  <span
                    className={`font-semibold ${
                      badge.unlocked ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {badge.unlocked ? 'Unlocked' : 'In Progress'}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {badge.unlocked && badge.unlockedAt
                      ? new Date(badge.unlockedAt).toLocaleDateString()
                      : `Progress: ${badge.metricValue}`}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

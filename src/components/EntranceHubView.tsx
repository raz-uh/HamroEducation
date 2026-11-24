import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Layers,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type { EntranceCategoryMeta, EntranceExamProfile } from '../lib/entrance-catalog.ts';
import { QUESTION_TYPE_CATALOG } from '../lib/exam-engine.ts';
import type { ExamSummaryItem, QuestionBankItem } from '../types/api.ts';

interface EntranceHubViewProps {
  examSlug?: string;
  onNavigate: (path: string) => void;
}

interface EntranceListResponse {
  categories: EntranceCategoryMeta[];
  profiles: Array<EntranceExamProfile & { liveMockExam: ExamSummaryItem | null }>;
}

interface EntranceDetailResponse {
  profile: EntranceExamProfile;
  mockExams: ExamSummaryItem[];
  sampleQuestions: QuestionBankItem[];
}

export function EntranceHubView({ examSlug, onNavigate }: EntranceHubViewProps) {
  const { apiFetch } = useAuth();
  const [listData, setListData] = useState<EntranceListResponse | null>(null);
  const [detailData, setDetailData] = useState<EntranceDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [revealedQuestions, setRevealedQuestions] = useState<Record<number, boolean>>({});

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      const res = await apiFetch(`/api/entrance?${params.toString()}`);
      const json = (await res.json()) as EntranceListResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to load bachelor entrances.');
      setListData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load bachelor entrances.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, searchQuery, selectedCategory]);

  const loadDetail = useCallback(
    async (slug: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/entrance/${encodeURIComponent(slug)}`);
        const json = (await res.json()) as EntranceDetailResponse & { error?: string };
        if (!res.ok) throw new Error(json.error || 'Entrance exam details not found.');
        setDetailData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load entrance profile.');
      } finally {
        setLoading(false);
      }
    },
    [apiFetch],
  );

  useEffect(() => {
    if (examSlug) {
      void loadDetail(examSlug);
    } else {
      void loadList();
    }
  }, [examSlug, loadDetail, loadList]);

  if (examSlug) {
    if (loading) {
      return (
        <div className="space-y-6">
          <div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
          <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white p-6" />
        </div>
      );
    }

    if (error || !detailData) {
      return (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => onNavigate('/entrance')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Bachelor Entrances
          </button>
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error || 'Entrance exam profile not found.'}</span>
          </div>
        </div>
      );
    }

    const { profile, mockExams, sampleQuestions } = detailData;
    const primaryMock = mockExams[0] ?? null;

    return (
      <section aria-labelledby="entrance-detail-title" className="space-y-8">
        {/* Top Header & Actions */}
        <div className="border-b border-slate-200 pb-6">
          <button
            type="button"
            onClick={() => onNavigate('/entrance')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All Bachelor Entrances
          </button>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium text-red-700">{profile.authority}</p>
              <h1
                id="entrance-detail-title"
                className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
              >
                {profile.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                {profile.overview}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {primaryMock && (
                <button
                  type="button"
                  onClick={() => onNavigate(`/exams/${primaryMock.slug}`)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-800"
                >
                  <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                  Launch Timed Mock Exam
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigate('/question-bank')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Layers className="h-4 w-4" aria-hidden="true" />
                Open Question Bank
              </button>
            </div>
          </div>

          {/* Verified Pattern Key Metrics */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Total Marks
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
                {profile.examinationPattern.totalMarks}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Duration
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
                {profile.examinationPattern.durationText}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Questions
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
                {profile.examinationPattern.totalQuestions}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                Negative Marking
              </p>
              <p
                className={`mt-1 text-xs font-semibold ${
                  profile.examinationPattern.negativeMarkingEnabled
                    ? 'text-red-700'
                    : 'text-emerald-700'
                }`}
              >
                {profile.examinationPattern.negativeMarkingText}
              </p>
            </div>
          </div>
        </div>

        {/* Overview, Degree Programs, Eligibility & Admission Requirements */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Degree Programs
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {profile.degreePrograms.map((deg) => (
                <li key={deg} className="flex items-start gap-2">
                  <GraduationCap
                    className="mt-0.5 h-4 w-4 shrink-0 text-blue-700"
                    aria-hidden="true"
                  />
                  <span>{deg}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Eligibility Criteria
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {profile.eligibility.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Admission Requirements
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {profile.admissionRequirements.map((req) => (
                <li key={req} className="flex items-start gap-2">
                  <FileText
                    className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
                    aria-hidden="true"
                  />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Official Syllabus, Subjects & Examination Pattern */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Official Syllabus, Subjects &amp; Examination Pattern
              </h2>
              <p className="text-xs text-slate-600">{profile.examinationPattern.format}</p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {profile.officialSyllabus.length} subjects
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {profile.officialSyllabus.map((sub) => (
              <div
                key={sub.subject}
                className="rounded-lg border border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    {sub.subject}
                  </h3>
                  <span className="font-mono text-xs font-semibold text-red-700 tabular-nums">
                    {sub.weightage}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                  {sub.topics.join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Mock Examinations, Model Sets & Performance Analysis */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Mock Examinations, Model Sets &amp; Previous Questions
              </h2>
              <p className="text-xs text-slate-500">
                Server-validated timed simulations using immutable attempt snapshots and verified
                question sources.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/exams')}
              className="text-xs font-semibold text-blue-700 hover:text-blue-800"
            >
              Browse All Mock Tests
            </button>
          </div>

          {mockExams.length === 0 ? (
            <p className="text-sm text-slate-600">
              Practice questions for this entrance are available in the Question Bank below.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {mockExams.map((exam) => (
                <div
                  key={exam.id}
                  className="flex flex-col justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[11px] font-semibold text-red-700">
                          {exam.academicLevel}
                        </p>
                        <h3 className="mt-0.5 font-display text-base font-semibold text-slate-900">
                          {exam.title}
                        </h3>
                      </div>
                      <span className="font-mono text-xs text-slate-600 tabular-nums shrink-0">
                        {exam.durationMinutes} min
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">
                      {exam.liveQuestionCount} Published Questions ·{' '}
                      <span className="font-mono tabular-nums">{exam.liveTotalMarks}</span> Marks
                      {' · '}
                      {exam.negativeMarkingRule.description}
                    </p>
                    {exam.latestResult && (
                      <p className="mt-2 text-xs font-medium text-emerald-700 font-mono tabular-nums">
                        Last score: {exam.latestResult.obtainedMarks}/{exam.latestResult.totalMarks}{' '}
                        ({exam.latestResult.accuracyPercent}% accuracy)
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                    <button
                      type="button"
                      onClick={() => onNavigate(`/exams/${exam.slug}`)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      {exam.hasActiveAttempt ? 'Resume Exam' : 'Start Mock Exam'}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    {exam.latestResult && (
                      <button
                        type="button"
                        onClick={() => onNavigate(`/exams/${exam.slug}/result`)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                      >
                        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                        Performance Analysis
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Topic-wise Notes & Practice Questions Preview */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Topic-Wise High-Yield Notes
              </h2>
              <BookOpen className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
            <div className="space-y-3">
              {profile.topicNotes.map((note) => (
                <div
                  key={note.topic}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-4"
                >
                  <h3 className="text-sm font-semibold text-slate-900">{note.topic}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{note.summary}</p>
                  {note.schoolBridgeLink && (
                    <button
                      type="button"
                      onClick={() => onNavigate(note.schoolBridgeLink!)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800"
                    >
                      Review +2 Chapter Notes
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Published Practice Questions
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('/question-bank')}
                className="text-xs font-semibold text-blue-700 hover:text-blue-800"
              >
                Full Question Bank
              </button>
            </div>

            {sampleQuestions.length === 0 ? (
              <p className="text-sm text-slate-600">
                Open the Question Bank workspace to filter across all published practice sets.
              </p>
            ) : (
              <div className="space-y-3">
                {sampleQuestions.slice(0, 4).map((q) => {
                  const isOpen = Boolean(revealedQuestions[q.id]);
                  const typeLabel =
                    QUESTION_TYPE_CATALOG.find((t) => t.id === q.questionType)?.shortLabel ??
                    q.questionType;
                  return (
                    <div
                      key={q.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
                        <span>
                          {q.questionUid} · {q.subjectName} · {typeLabel}
                        </span>
                        <span>{q.source}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-900">
                        {q.questionContent.prompt}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedQuestions((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                        }
                        className="text-xs font-semibold text-red-700 hover:text-red-800"
                      >
                        {isOpen ? 'Hide Answer & Explanation' : 'Show Answer & Explanation'}
                      </button>
                      {isOpen && (
                        <div className="rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                          <p className="font-semibold text-emerald-700">
                            Answer:{' '}
                            {q.correctAnswer.optionKeys?.join(', ') ??
                              (typeof q.correctAnswer.booleanValue === 'boolean'
                                ? String(q.correctAnswer.booleanValue)
                                : q.correctAnswer.numericValue ??
                                  q.correctAnswer.acceptedText ??
                                  JSON.stringify(q.correctAnswer.matchingMap ?? ''))}
                          </p>
                          <p className="mt-1 leading-relaxed">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Important Dates & Official Application Links */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Important Dates &amp; Admission Windows
              </h2>
              <Calendar className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
            <ul className="mt-3 divide-y divide-slate-100">
              {profile.importantDates.map((d) => (
                <li
                  key={d.milestone}
                  className="flex items-center justify-between gap-4 py-2.5 text-xs"
                >
                  <span className="font-medium text-slate-800">{d.milestone}</span>
                  <span className="font-mono text-slate-600">{d.window}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Official Application Portals
              </h2>
              <ExternalLink className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </div>
            <ul className="mt-3 space-y-2.5">
              {profile.officialLinks.map((link) => (
                <li key={link.url}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 hover:border-slate-300 hover:bg-white"
                  >
                    <span>{link.label}</span>
                    <span className="inline-flex items-center gap-1 font-mono text-blue-700">
                      {link.url.replace(/^https?:\/\//, '')}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    );
  }

  // Bachelor Entrance Directory (/entrance)
  const categories = listData?.categories ?? [];
  const profiles = listData?.profiles ?? [];

  return (
    <section aria-labelledby="entrance-hub-title" className="space-y-8">
      <div className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium text-red-700">
              Section 6 · Post-NEB Higher Education Admissions
            </p>
            <h1
              id="entrance-hub-title"
              className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl"
            >
              Bachelor Entrance Preparation Hub
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-600">
              Official syllabus patterns, eligibility, previous questions, and server-validated
              timed mock tests across Management, IT, Engineering, Medical, Science, Law, and
              Agriculture.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/exams')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Timed Mock Exams
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/question-bank')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              Question Bank
            </button>
          </div>
        </div>

        {/* Category Filter Tabs + Search */}
        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Entrance categories">
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedCategory === 'all'
                  ? 'border-red-700 bg-red-700 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              All Tracks
            </button>
            {categories.map((cat) => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-red-700 bg-red-700 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-64 shrink-0">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search CMAT, CSIT, IOE..."
              aria-label="Search bachelor entrance exams"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
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
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="h-56 animate-pulse rounded-xl border border-slate-200 bg-white p-6"
            />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-900">
            No entrance tracks matched your filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setSearchQuery('');
            }}
            className="mt-3 text-xs font-semibold text-red-700 hover:text-red-800"
          >
            Reset Entrance Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((exam) => (
            <article
              key={exam.slug}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold uppercase text-red-700">
                    {categories.find((c) => c.id === exam.category)?.label ?? exam.category}
                  </span>
                  <span className="font-mono text-xs text-slate-600 tabular-nums shrink-0">
                    {exam.examinationPattern.totalMarks} Marks · {exam.examinationPattern.durationText.split(' ')[0]}m
                  </span>
                </div>

                <h2 className="mt-1.5 font-display text-lg font-semibold text-slate-900">
                  {exam.title}
                </h2>
                <p className="mt-0.5 text-xs font-medium text-blue-700">{exam.authority}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 line-clamp-3">
                  {exam.overview}
                </p>

                <div className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-600 space-y-1">
                  <p>
                    <strong className="text-slate-800">Degrees:</strong>{' '}
                    {exam.degreePrograms.slice(0, 3).join(', ')}
                    {exam.degreePrograms.length > 3 ? '…' : ''}
                  </p>
                  <p
                    className={
                      exam.examinationPattern.negativeMarkingEnabled
                        ? 'font-medium text-red-700'
                        : 'font-medium text-emerald-700'
                    }
                  >
                    {exam.examinationPattern.negativeMarkingText}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => onNavigate(`/entrance/${exam.slug}`)}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Syllabus &amp; Details
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {exam.liveMockExam && (
                  <button
                    type="button"
                    onClick={() => onNavigate(`/exams/${exam.liveMockExam!.slug}`)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Mock Test
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

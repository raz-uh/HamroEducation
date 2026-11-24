import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Globe,
  Plus,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type {
  ChapterNode,
  CurriculumHierarchyResponse,
  CurriculumNode,
  EducationLevelNode,
  GradeNode,
  StreamNode,
  SubjectNode,
} from '../types/api.ts';

interface CurriculumWorkspaceProps {
  onOpenAuth: () => void;
}

export function CurriculumWorkspace({ onOpenAuth }: CurriculumWorkspaceProps) {
  const { user, apiFetch } = useAuth();
  const [countryIso, setCountryIso] = useState('NP');
  const [data, setData] = useState<CurriculumHierarchyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Cascading selection IDs
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<number | null>(null);
  const [selectedLevelId, setSelectedLevelId] = useState<number | null>(null);
  const [selectedGradeId, setSelectedGradeId] = useState<number | null>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);

  // Add Topic inline form state
  const [addingChapterId, setAddingChapterId] = useState<number | null>(null);
  const [topicNumber, setTopicNumber] = useState('');
  const [topicTitle, setTopicTitle] = useState('');
  const [topicObjectives, setTopicObjectives] = useState('');
  const [topicDifficulty, setTopicDifficulty] = useState('intermediate');
  const [topicMinutes, setTopicMinutes] = useState('45');
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadHierarchy = useCallback(
    async (iso: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/curriculum?country=${encodeURIComponent(iso)}`);
        const json = (await res.json()) as CurriculumHierarchyResponse & { error?: string };
        if (!res.ok) {
          throw new Error(json.error || 'Failed to load curriculum hierarchy.');
        }
        setData(json);

        // Auto-select valid defaults down the chain
        const firstCur = json.curricula[0] ?? null;
        setSelectedCurriculumId((prev) =>
          json.curricula.some((c) => c.id === prev) ? prev : firstCur?.id ?? null,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to fetch curriculum data.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadHierarchy(countryIso);
  }, [countryIso, loadHierarchy]);

  const activeCurriculum: CurriculumNode | null = useMemo(() => {
    if (!data?.curricula.length) return null;
    return data.curricula.find((c) => c.id === selectedCurriculumId) ?? data.curricula[0];
  }, [data, selectedCurriculumId]);

  const activeLevel: EducationLevelNode | null = useMemo(() => {
    if (!activeCurriculum?.educationLevels.length) return null;
    return (
      activeCurriculum.educationLevels.find((l) => l.id === selectedLevelId) ??
      activeCurriculum.educationLevels.find((l) => l.code === 'higher_secondary') ??
      activeCurriculum.educationLevels[0]
    );
  }, [activeCurriculum, selectedLevelId]);

  const activeGrade: GradeNode | null = useMemo(() => {
    if (!activeLevel?.grades.length) return null;
    return activeLevel.grades.find((g) => g.id === selectedGradeId) ?? activeLevel.grades[0];
  }, [activeLevel, selectedGradeId]);

  const activeStream: StreamNode | null = useMemo(() => {
    if (!activeGrade?.streams.length) return null;
    return activeGrade.streams.find((s) => s.id === selectedStreamId) ?? activeGrade.streams[0];
  }, [activeGrade, selectedStreamId]);

  const activeSubject: SubjectNode | null = useMemo(() => {
    if (!activeStream?.subjects.length) return null;
    return activeStream.subjects.find((s) => s.id === selectedSubjectId) ?? activeStream.subjects[0];
  }, [activeStream, selectedSubjectId]);

  const filteredChapters: ChapterNode[] = useMemo(() => {
    if (!activeSubject) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeSubject.chapters;
    return activeSubject.chapters
      .map((ch) => {
        const chapterMatches =
          ch.title.toLowerCase().includes(q) || ch.summary.toLowerCase().includes(q);
        const matchingTopics = ch.topics.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.learningObjectives.toLowerCase().includes(q) ||
            t.topicNumber.toLowerCase().includes(q),
        );
        if (chapterMatches) return ch;
        if (matchingTopics.length > 0) return { ...ch, topics: matchingTopics };
        return null;
      })
      .filter((ch): ch is ChapterNode => ch !== null);
  }, [activeSubject, searchQuery]);

  const handleCreateTopic = async (e: React.FormEvent, chapterId: number) => {
    e.preventDefault();
    setSubmitting(true);
    setActionFeedback(null);
    try {
      const res = await apiFetch('/api/curriculum/topics', {
        method: 'POST',
        body: JSON.stringify({
          chapterId,
          topicNumber,
          title: topicTitle,
          learningObjectives: topicObjectives,
          difficultyLevel: topicDifficulty,
          estimatedMinutes: Number(topicMinutes) || 45,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionFeedback({
          type: 'error',
          message: json.error || 'Permission denied or invalid topic details.',
        });
        return;
      }
      setActionFeedback({
        type: 'success',
        message: `Added topic "${json.topic.topicNumber} ${json.topic.title}" to PostgreSQL.`,
      });
      setTopicNumber('');
      setTopicTitle('');
      setTopicObjectives('');
      setAddingChapterId(null);
      await loadHierarchy(countryIso);
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to save topic.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewTopic = async (topicId: number, reviewStatus: 'approved' | 'in_review') => {
    setActionFeedback(null);
    try {
      const res = await apiFetch(`/api/curriculum/topics/${topicId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ reviewStatus }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionFeedback({
          type: 'error',
          message: json.error || 'Review action requires Academic Reviewer or Administrator role.',
        });
        return;
      }
      setActionFeedback({
        type: 'success',
        message: `Topic status updated to ${reviewStatus}.`,
      });
      await loadHierarchy(countryIso);
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update review status.',
      });
    }
  };

  const canWriteCurriculum = user?.permissions.includes('curriculum:write') ?? false;
  const canReviewCurriculum = user?.permissions.includes('curriculum:review') ?? false;

  return (
    <section aria-labelledby="curriculum-heading" className="space-y-6">
      {/* Workspace Header & Country Selector */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-medium text-red-700">
            Nepal-First Country-Aware Curriculum Tree
          </p>
          <h1
            id="curriculum-heading"
            className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl text-balance"
          >
            Nepal National Curriculum Architecture
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            Explore the 9-tier relational hierarchy from country and medium of instruction down to
            chapters and verified learning objectives across CDC/NEB and CTEVT tracks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Select country curriculum"
            className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
          >
            {(data?.countries ?? [
              { isoCode: 'NP', name: 'Nepal', nativeName: 'नेपाल' },
            ]).map((country) => {
              const isSelected = countryIso === country.isoCode;
              return (
                <button
                  key={country.isoCode}
                  type="button"
                  onClick={() => {
                    setCountryIso(country.isoCode);
                    setSelectedCurriculumId(null);
                    setSelectedLevelId(null);
                    setSelectedGradeId(null);
                    setSelectedStreamId(null);
                    setSelectedSubjectId(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {country.name}
                  <span className="ml-1.5 font-mono text-[11px] text-slate-400">
                    {country.isoCode}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Country Context Strip */}
      {data?.activeCountry && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <Globe className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span className="font-semibold text-slate-900">
              {data.activeCountry.name} ({data.activeCountry.nativeName})
            </span>
            <span aria-hidden="true">·</span>
            <span>Timezone: {data.activeCountry.defaultTimezone}</span>
            <span aria-hidden="true">·</span>
            <span>Currency: {data.activeCountry.currencyCode}</span>
            <span aria-hidden="true">·</span>
            <span>
              Languages:{' '}
              {data.languages.map((l) => `${l.name} (${l.nativeName})`).join(', ')}
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <label htmlFor="curriculum-search" className="sr-only">
              Filter chapters and topics
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="curriculum-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics or objectives..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            actionFeedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
            ) : (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          {!user && actionFeedback.type === 'error' && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="text-xs font-semibold underline shrink-0"
            >
              Sign In
            </button>
          )}
        </div>
      )}

      {/* Loading / Error / Main Workspace */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-4" />
          <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white lg:col-span-8" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-800">
          <p className="font-semibold">Unable to load curriculum hierarchy</p>
          <p className="mt-1 text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void loadHierarchy(countryIso)}
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Rail: Cascading Hierarchy Selector */}
          <aside
            aria-label="Curriculum hierarchy navigation"
            className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4"
          >
            {/* 1. Curriculum */}
            <div className="space-y-1.5">
              <label
                htmlFor="select-curriculum"
                className="block text-xs font-semibold text-slate-700"
              >
                01. National Curriculum
              </label>
              <select
                id="select-curriculum"
                value={activeCurriculum?.id ?? ''}
                onChange={(e) => {
                  setSelectedCurriculumId(Number(e.target.value));
                  setSelectedLevelId(null);
                  setSelectedGradeId(null);
                  setSelectedStreamId(null);
                  setSelectedSubjectId(null);
                }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:bg-white focus:outline-none"
              >
                {data?.curricula.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              {activeCurriculum && (
                <p className="text-xs text-slate-500">
                  {activeCurriculum.governingBody} · {activeCurriculum.academicCalendar}
                </p>
              )}
            </div>

            {/* 2. Education Level */}
            {activeCurriculum && (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-700">02. Education Level</p>
                <div className="space-y-1">
                  {activeCurriculum.educationLevels.map((lvl) => {
                    const isSelected = activeLevel?.id === lvl.id;
                    return (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => {
                          setSelectedLevelId(lvl.id);
                          setSelectedGradeId(null);
                          setSelectedStreamId(null);
                          setSelectedSubjectId(null);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                          isSelected
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{lvl.name}</span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Grade */}
            {activeLevel && (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-700">03. Grade / Year</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeLevel.grades.map((grade) => {
                    const isSelected = activeGrade?.id === grade.id;
                    return (
                      <button
                        key={grade.id}
                        type="button"
                        onClick={() => {
                          setSelectedGradeId(grade.id);
                          setSelectedStreamId(null);
                          setSelectedSubjectId(null);
                        }}
                        className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          isSelected
                            ? 'border-red-700 bg-red-50 text-red-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {grade.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. Stream */}
            {activeGrade && (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-700">04. Academic Stream</p>
                <div className="space-y-1">
                  {activeGrade.streams.map((stream) => {
                    const isSelected = activeStream?.id === stream.id;
                    return (
                      <button
                        key={stream.id}
                        type="button"
                        onClick={() => {
                          setSelectedStreamId(stream.id);
                          setSelectedSubjectId(null);
                        }}
                        className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'border-blue-700 bg-blue-50/70 text-blue-950'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-semibold">{stream.name}</div>
                        {stream.description && (
                          <div className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">
                            {stream.description}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. Subjects */}
            {activeStream && (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-700">05. Subjects</p>
                <div className="space-y-1">
                  {activeStream.subjects.map((subj) => {
                    const isSelected = activeSubject?.id === subj.id;
                    return (
                      <button
                        key={subj.id}
                        type="button"
                        onClick={() => setSelectedSubjectId(subj.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors ${
                          isSelected
                            ? 'bg-slate-100 font-semibold text-slate-900'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{subj.name}</span>
                        <span className="ml-2 font-mono text-[11px] text-slate-500 shrink-0 tabular-nums">
                          {subj.code}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>

          {/* Right Viewport: Subject, Chapters & Topics */}
          <div className="space-y-5 lg:col-span-8">
            {activeSubject ? (
              <>
                {/* Subject Header */}
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono text-slate-700">{activeSubject.code}</span>
                        <span aria-hidden="true">·</span>
                        <span>{activeStream?.name}</span>
                        <span aria-hidden="true">·</span>
                        <span>{activeSubject.isCompulsory ? 'Compulsory' : 'Elective'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {activeSubject.creditHours} Credit Hrs
                        </span>
                      </div>
                      <h2 className="font-display text-xl font-bold text-slate-900">
                        {activeSubject.name}
                      </h2>
                      <p className="text-xs text-slate-600">
                        Path: {data?.activeCountry?.name} / {activeCurriculum?.code} /{' '}
                        {activeLevel?.name} / {activeGrade?.name}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-slate-500">
                        Write access:{' '}
                        <strong className="font-medium text-slate-900">
                          {canWriteCurriculum ? 'Authorized' : 'Read-Only'}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Chapters & Topics */}
                {filteredChapters.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                    <BookOpen className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      No chapters match "{searchQuery}"
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Clear the search filter or choose another subject from the hierarchy rail.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredChapters.map((chapter) => (
                      <article
                        key={chapter.id}
                        className="rounded-xl border border-slate-200 bg-white p-6"
                      >
                        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="font-mono font-medium text-slate-700 tabular-nums">
                                Chapter {String(chapter.chapterNumber).padStart(2, '0')}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {chapter.estimatedHours} hrs
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>Status: {chapter.reviewStatus}</span>
                            </div>
                            <h3 className="font-display text-lg font-semibold text-slate-900">
                              {chapter.title}
                            </h3>
                            <p className="text-sm text-slate-600">{chapter.summary}</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setActionFeedback(null);
                              setAddingChapterId(
                                addingChapterId === chapter.id ? null : chapter.id,
                              );
                              setTopicNumber(`${chapter.chapterNumber}.${chapter.topics.length + 1}`);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            Add Topic
                          </button>
                        </div>

                        {/* Inline Add Topic Form (Protected server-side by curriculum:write) */}
                        {addingChapterId === chapter.id && (
                          <form
                            onSubmit={(e) => void handleCreateTopic(e, chapter.id)}
                            className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-slate-900">
                                New Curriculum Topic (Server-Side RBAC: curriculum:write)
                              </p>
                              {!canWriteCurriculum && (
                                <span className="text-xs text-amber-800">
                                  Current role lacks curriculum:write — submitting will trigger a 403 check
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                              <div>
                                <label
                                  htmlFor={`topic-num-${chapter.id}`}
                                  className="block text-xs font-medium text-slate-700"
                                >
                                  Topic No.
                                </label>
                                <input
                                  id={`topic-num-${chapter.id}`}
                                  type="text"
                                  required
                                  value={topicNumber}
                                  onChange={(e) => setTopicNumber(e.target.value)}
                                  placeholder="1.3"
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label
                                  htmlFor={`topic-title-${chapter.id}`}
                                  className="block text-xs font-medium text-slate-700"
                                >
                                  Topic Title
                                </label>
                                <input
                                  id={`topic-title-${chapter.id}`}
                                  type="text"
                                  required
                                  value={topicTitle}
                                  onChange={(e) => setTopicTitle(e.target.value)}
                                  placeholder="e.g. Angular Impulse & Torque Couples"
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`topic-diff-${chapter.id}`}
                                  className="block text-xs font-medium text-slate-700"
                                >
                                  Difficulty
                                </label>
                                <select
                                  id={`topic-diff-${chapter.id}`}
                                  value={topicDifficulty}
                                  onChange={(e) => setTopicDifficulty(e.target.value)}
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                                >
                                  <option value="foundational">Foundational</option>
                                  <option value="intermediate">Intermediate</option>
                                  <option value="advanced">Advanced</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                              <div className="sm:col-span-3">
                                <label
                                  htmlFor={`topic-obj-${chapter.id}`}
                                  className="block text-xs font-medium text-slate-700"
                                >
                                  Learning Objectives
                                </label>
                                <input
                                  id={`topic-obj-${chapter.id}`}
                                  type="text"
                                  required
                                  value={topicObjectives}
                                  onChange={(e) => setTopicObjectives(e.target.value)}
                                  placeholder="Measurable learning outcome aligned with CDC/NEB syllabus..."
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor={`topic-min-${chapter.id}`}
                                  className="block text-xs font-medium text-slate-700"
                                >
                                  Duration (min)
                                </label>
                                <input
                                  id={`topic-min-${chapter.id}`}
                                  type="number"
                                  min={10}
                                  max={240}
                                  value={topicMinutes}
                                  onChange={(e) => setTopicMinutes(e.target.value)}
                                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 font-mono tabular-nums"
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setAddingChapterId(null)}
                                className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={submitting}
                                className="rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                              >
                                {submitting ? 'Saving...' : 'Save Topic'}
                              </button>
                            </div>
                          </form>
                        )}

                        {/* Topics List */}
                        <div className="mt-4 divide-y divide-slate-100">
                          {chapter.topics.map((topic) => (
                            <div
                              key={topic.id}
                              className="flex flex-col gap-2 py-3.5 first:pt-1 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  <span className="font-mono font-medium text-slate-800 tabular-nums">
                                    {topic.topicNumber}
                                  </span>
                                  <span className="font-medium text-slate-900 text-sm">
                                    {topic.title}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                  {topic.learningObjectives}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  <span className="capitalize">{topic.difficultyLevel}</span>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                                    <Clock className="h-3 w-3" aria-hidden="true" />
                                    {topic.estimatedMinutes} min
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span
                                    className={`inline-flex items-center gap-1 font-medium ${
                                      topic.reviewStatus === 'approved'
                                        ? 'text-emerald-700'
                                        : 'text-amber-700'
                                    }`}
                                  >
                                    {topic.reviewStatus === 'approved' ? (
                                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                    ) : (
                                      <Clock className="h-3 w-3" aria-hidden="true" />
                                    )}
                                    {topic.reviewStatus === 'approved' ? 'Approved' : 'In Review'}
                                  </span>
                                </div>
                              </div>

                              {canReviewCurriculum && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleReviewTopic(
                                      topic.id,
                                      topic.reviewStatus === 'approved' ? 'in_review' : 'approved',
                                    )
                                  }
                                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                                >
                                  {topic.reviewStatus === 'approved'
                                    ? 'Reopen Review'
                                    : 'Approve Topic'}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
                Select a curriculum, grade, stream, and subject to inspect chapters and topics.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
